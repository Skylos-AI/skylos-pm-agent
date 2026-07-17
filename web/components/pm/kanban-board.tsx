"use client";

import { useMemo, useState, useTransition } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { formatBob } from "@/lib/format/currency";
import { formatDate } from "@/lib/format/date";
import { t } from "@/lib/i18n/es";
import {
  STAGES,
  type PipelineDealRow,
  type PipelineOwner,
  type Stage,
} from "@/lib/types/pipeline";
import { Modal, Drawer } from "@/components/pm/modal";
import { updatePipelineDeal } from "@/lib/mutations/pipeline";

type Pending =
  | { kind: "won"; dealId: string; fromStage: Stage }
  | { kind: "lost"; dealId: string; fromStage: Stage }
  | null;

export function KanbanBoard({
  initialDeals,
  owners,
}: {
  initialDeals: PipelineDealRow[];
  owners: PipelineOwner[];
}) {
  const [deals, setDeals] = useState(initialDeals);
  const [activeDealId, setActiveDealId] = useState<string | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<PipelineDealRow | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [lostReason, setLostReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const [filterOwner, setFilterOwner] = useState<string>("");
  const [filterStages, setFilterStages] = useState<Set<Stage>>(
    new Set(STAGES),
  );
  const [filterMin, setFilterMin] = useState<string>("");
  const [filterMax, setFilterMax] = useState<string>("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const filtered = useMemo(() => {
    return deals.filter((d) => {
      if (filterOwner && d.owner_id !== filterOwner) return false;
      if (!filterStages.has(d.stage)) return false;
      const v = Number(d.value_bob ?? 0);
      if (filterMin && v < Number(filterMin)) return false;
      if (filterMax && v > Number(filterMax)) return false;
      return true;
    });
  }, [deals, filterOwner, filterStages, filterMin, filterMax]);

  const byStage = useMemo(() => {
    const out = Object.fromEntries(STAGES.map((s) => [s, [] as PipelineDealRow[]])) as Record<
      Stage,
      PipelineDealRow[]
    >;
    for (const d of filtered) out[d.stage].push(d);
    return out;
  }, [filtered]);

  const activeDeal = activeDealId
    ? deals.find((d) => d.id === activeDealId) ?? null
    : null;

  function commitStage(
    dealId: string,
    newStage: Stage,
    extra: { lostReason?: string } = {},
  ) {
    const before = deals;
    setDeals((cur) =>
      cur.map((d) =>
        d.id === dealId
          ? {
              ...d,
              stage: newStage,
              lost_reason: extra.lostReason ?? d.lost_reason,
              actual_close_date:
                newStage === "WON" || newStage === "LOST"
                  ? new Date().toISOString()
                  : d.actual_close_date,
              updated_at: new Date().toISOString(),
            }
          : d,
      ),
    );
    setError(null);
    startTransition(async () => {
      const res = await updatePipelineDeal({
        id: dealId,
        stage: newStage,
        lostReason: extra.lostReason,
      });
      if (!res.ok) {
        setDeals(before);
        setError(res.error.message);
      }
    });
  }

  function handleDragStart(e: DragStartEvent) {
    setActiveDealId(String(e.active.id));
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveDealId(null);
    const dealId = String(e.active.id);
    const overId = e.over ? String(e.over.id) : null;
    if (!overId) return;
    if (!STAGES.includes(overId as Stage)) return;
    const newStage = overId as Stage;
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage === newStage) return;
    if (newStage === "WON") {
      setPending({ kind: "won", dealId, fromStage: deal.stage });
      return;
    }
    if (newStage === "LOST") {
      setPending({ kind: "lost", dealId, fromStage: deal.stage });
      setLostReason("");
      return;
    }
    commitStage(dealId, newStage);
  }

  function confirmPending() {
    if (!pending) return;
    if (pending.kind === "won") {
      commitStage(pending.dealId, "WON");
      setPending(null);
      return;
    }
    if (pending.kind === "lost") {
      const reason = lostReason.trim();
      if (!reason) {
        setError("La razón de pérdida es obligatoria.");
        return;
      }
      commitStage(pending.dealId, "LOST", { lostReason: reason });
      setPending(null);
      setLostReason("");
    }
  }

  function clearFilters() {
    setFilterOwner("");
    setFilterStages(new Set(STAGES));
    setFilterMin("");
    setFilterMax("");
  }

  return (
    <>
      <div className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-xl p-4 mb-5 flex flex-wrap items-end gap-4">
        <label className="flex flex-col text-xs gap-1 text-[var(--brand-fg-muted)] uppercase tracking-wide">
          {t.pipeline.filterOwner}
          <select
            className="text-sm border border-[var(--brand-border)] rounded-md px-2 py-1.5 bg-white text-[var(--brand-fg)] min-w-[160px]"
            value={filterOwner}
            onChange={(e) => setFilterOwner(e.target.value)}
          >
            <option value="">{t.pipeline.filterAll}</option>
            {owners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.full_name}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col text-xs gap-1 text-[var(--brand-fg-muted)] uppercase tracking-wide">
          {t.pipeline.filterStage}
          <div className="flex flex-wrap gap-1.5">
            {STAGES.map((s) => {
              const on = filterStages.has(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() =>
                    setFilterStages((cur) => {
                      const next = new Set(cur);
                      if (next.has(s)) next.delete(s);
                      else next.add(s);
                      return next;
                    })
                  }
                  className={`px-2 py-1 text-xs rounded-md border transition ${
                    on
                      ? "bg-[var(--brand-blue)] text-white border-[var(--brand-blue)]"
                      : "bg-white text-[var(--brand-fg-muted)] border-[var(--brand-border)]"
                  }`}
                >
                  {t.stage[s]}
                </button>
              );
            })}
          </div>
        </div>

        <label className="flex flex-col text-xs gap-1 text-[var(--brand-fg-muted)] uppercase tracking-wide">
          {t.pipeline.filterValueMin}
          <input
            type="number"
            inputMode="numeric"
            className="text-sm border border-[var(--brand-border)] rounded-md px-2 py-1.5 w-28"
            value={filterMin}
            onChange={(e) => setFilterMin(e.target.value)}
          />
        </label>
        <label className="flex flex-col text-xs gap-1 text-[var(--brand-fg-muted)] uppercase tracking-wide">
          {t.pipeline.filterValueMax}
          <input
            type="number"
            inputMode="numeric"
            className="text-sm border border-[var(--brand-border)] rounded-md px-2 py-1.5 w-28"
            value={filterMax}
            onChange={(e) => setFilterMax(e.target.value)}
          />
        </label>

        <button
          type="button"
          onClick={clearFilters}
          className="text-xs text-[var(--brand-fg-muted)] hover:text-[var(--brand-fg)] underline"
        >
          {t.pipeline.clearFilters}
        </button>

        <span className="ml-auto text-xs text-[var(--brand-fg-muted)] italic">
          {t.pipeline.dragHint}
        </span>
      </div>

      {error && (
        <div className="mb-4 px-4 py-2 rounded-md bg-[var(--brand-magenta)]/10 text-[var(--brand-magenta)] text-sm border border-[var(--brand-magenta)]/30">
          {error}
        </div>
      )}

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 min-h-[60vh]">
          {STAGES.map((stage) => (
            <KanbanColumn
              key={stage}
              stage={stage}
              deals={byStage[stage]}
              onSelect={setSelectedDeal}
            />
          ))}
        </div>
        <DragOverlay>
          {activeDeal ? <DealCard deal={activeDeal} dragging /> : null}
        </DragOverlay>
      </DndContext>

      <Modal
        open={pending?.kind === "won"}
        onClose={() => setPending(null)}
        title={t.pipeline.confirmWonTitle}
      >
        <p className="text-sm text-[var(--brand-fg-muted)] mb-6">
          {t.pipeline.confirmWonBody}
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setPending(null)}
            className="px-4 py-2 text-sm rounded-md border border-[var(--brand-border)] hover:bg-[var(--brand-bg)]"
          >
            {t.pipeline.cancel}
          </button>
          <button
            type="button"
            onClick={confirmPending}
            className="px-4 py-2 text-sm rounded-md bg-[var(--brand-blue)] text-white"
          >
            {t.pipeline.confirm}
          </button>
        </div>
      </Modal>

      <Modal
        open={pending?.kind === "lost"}
        onClose={() => setPending(null)}
        title={t.pipeline.confirmLostTitle}
      >
        <p className="text-sm text-[var(--brand-fg-muted)] mb-3">
          {t.pipeline.confirmLostBody}
        </p>
        <textarea
          autoFocus
          rows={3}
          value={lostReason}
          onChange={(e) => setLostReason(e.target.value)}
          placeholder={t.pipeline.lostReasonPlaceholder}
          className="w-full text-sm border border-[var(--brand-border)] rounded-md px-3 py-2 mb-4 resize-none focus:outline-none focus:border-[var(--brand-blue)]"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setPending(null)}
            className="px-4 py-2 text-sm rounded-md border border-[var(--brand-border)] hover:bg-[var(--brand-bg)]"
          >
            {t.pipeline.cancel}
          </button>
          <button
            type="button"
            onClick={confirmPending}
            disabled={!lostReason.trim()}
            className="px-4 py-2 text-sm rounded-md bg-[var(--brand-magenta)] text-white disabled:opacity-50"
          >
            {t.pipeline.confirm}
          </button>
        </div>
      </Modal>

      <Drawer
        open={!!selectedDeal}
        onClose={() => setSelectedDeal(null)}
        title={selectedDeal?.title ?? ""}
      >
        {selectedDeal && <DealDrawerBody deal={selectedDeal} />}
      </Drawer>
    </>
  );
}

function KanbanColumn({
  stage,
  deals,
  onSelect,
}: {
  stage: Stage;
  deals: PipelineDealRow[];
  onSelect: (d: PipelineDealRow) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const total = deals.reduce((acc, d) => acc + Number(d.value_bob ?? 0), 0);

  return (
    <div
      ref={setNodeRef}
      className={`bg-[var(--brand-fg)]/[0.03] border rounded-xl p-3 flex flex-col min-h-[60vh] transition ${
        isOver
          ? "border-[var(--brand-blue)] bg-[var(--brand-blue)]/5 ring-2 ring-[var(--brand-blue)]/20"
          : "border-[var(--brand-border)]"
      }`}
    >
      <header className="mb-3 flex items-baseline justify-between">
        <div>
          <h2 className="font-display text-sm tracking-tight">
            {t.stage[stage]}
          </h2>
          <p className="text-xs text-[var(--brand-fg-muted)] tabular-nums">
            {t.pipeline.countDeals(deals.length)}
          </p>
        </div>
        <span className="text-xs font-medium tabular-nums">{formatBob(total)}</span>
      </header>
      <div className="flex-1 space-y-2 overflow-y-auto">
        {deals.length === 0 ? (
          <p className="text-xs text-[var(--brand-fg-muted)] italic py-2">
            {t.pipeline.emptyColumn}
          </p>
        ) : (
          deals.map((d) => (
            <DraggableDealCard key={d.id} deal={d} onSelect={onSelect} />
          ))
        )}
      </div>
    </div>
  );
}

function DraggableDealCard({
  deal,
  onSelect,
}: {
  deal: PipelineDealRow;
  onSelect: (d: PipelineDealRow) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: deal.id,
  });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onSelect(deal)}
      className={`cursor-grab active:cursor-grabbing ${
        isDragging ? "opacity-30" : ""
      }`}
    >
      <DealCard deal={deal} />
    </div>
  );
}

function DealCard({
  deal,
  dragging,
}: {
  deal: PipelineDealRow;
  dragging?: boolean;
}) {
  const daysInStage = Math.max(
    0,
    Math.round((Date.now() - Date.parse(deal.updated_at)) / 86400000),
  );
  return (
    <div
      className={`bg-white border border-[var(--brand-border)] rounded-lg p-3 text-sm transition ${
        dragging
          ? "[box-shadow:var(--shadow-pop)] rotate-1 scale-[1.02]"
          : "[box-shadow:var(--shadow-card)] hover:border-[var(--brand-blue)]/50 hover:[box-shadow:var(--shadow-card-hover)] hover:-translate-y-px"
      }`}
    >
      <p className="font-medium leading-snug line-clamp-2 mb-1">{deal.title}</p>
      {deal.company && (
        <p className="text-xs text-[var(--brand-fg-muted)] truncate">
          {deal.company.name}
        </p>
      )}
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs font-medium">{formatBob(deal.value_bob)}</span>
        <span className="text-xs text-[var(--brand-fg-muted)]">
          {daysInStage}d
        </span>
      </div>
      {deal.expected_close_date && (
        <p className="text-xs text-[var(--brand-fg-muted)] mt-1">
          → {formatDate(deal.expected_close_date)}
        </p>
      )}
    </div>
  );
}

function DealDrawerBody({ deal }: { deal: PipelineDealRow }) {
  return (
    <div className="space-y-4 text-sm">
      <Row label={t.pipeline.drawerCompany} value={deal.company?.name ?? "—"} />
      <Row label={t.pipeline.drawerOwner} value={deal.owner?.full_name ?? "—"} />
      <Row
        label={t.dashboard.statPipelineValue}
        value={formatBob(deal.value_bob)}
      />
      <Row
        label={t.pipeline.drawerProbability}
        value={deal.probability !== null ? `${deal.probability}%` : "—"}
      />
      <Row
        label={t.pipeline.drawerExpectedClose}
        value={formatDate(deal.expected_close_date)}
      />
      {deal.actual_close_date && (
        <Row
          label={t.pipeline.drawerClosedOn}
          value={formatDate(deal.actual_close_date)}
        />
      )}
      {deal.lost_reason && (
        <div>
          <p className="text-xs text-[var(--brand-fg-muted)] uppercase tracking-wide mb-1">
            {t.pipeline.drawerLostReason}
          </p>
          <p className="text-sm bg-[var(--brand-magenta)]/10 text-[var(--brand-magenta)] rounded-md px-3 py-2">
            {deal.lost_reason}
          </p>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-xs text-[var(--brand-fg-muted)] uppercase tracking-wide">
        {label}
      </span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}
