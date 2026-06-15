"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format/date";
import { t } from "@/lib/i18n/es";
import { TaskStatusPill } from "@/components/pm/status-pill";
import { createTask, updateTaskStatus } from "@/lib/mutations/tasks";
import type { MyTaskRow, TaskStatus } from "@/lib/types/tasks";

const TABS = [
  { key: "ALL", label: t.tasks.tabAll, match: () => true },
  {
    key: "TODO",
    label: t.tasks.tabOpen,
    match: (r: MyTaskRow) => r.status === "TODO",
  },
  {
    key: "IN_PROGRESS",
    label: t.tasks.tabInProgress,
    match: (r: MyTaskRow) => r.status === "IN_PROGRESS",
  },
  {
    key: "BLOCKED",
    label: t.tasks.tabBlocked,
    match: (r: MyTaskRow) => r.status === "BLOCKED",
  },
  {
    key: "DONE",
    label: t.tasks.tabDone,
    match: (r: MyTaskRow) => r.status === "DONE",
  },
] as const;

const STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"];

export function TasksQueue({ initialTasks }: { initialTasks: MyTaskRow[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("TODO");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<TaskStatus | "">("");
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const def = TABS.find((tt) => tt.key === tab);
    return def ? initialTasks.filter(def.match) : initialTasks;
  }, [initialTasks, tab]);

  const allSelected =
    filtered.length > 0 &&
    filtered.every((r) => selected.has(r.id));

  function toggleAll() {
    const next = new Set(selected);
    if (allSelected) {
      filtered.forEach((r) => next.delete(r.id));
    } else {
      filtered.forEach((r) => next.add(r.id));
    }
    setSelected(next);
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function applyBulk() {
    if (!bulkStatus || selected.size === 0) return;
    setError(null);
    const ids = [...selected];
    startTransition(async () => {
      for (const id of ids) {
        const res = await updateTaskStatus({ id, status: bulkStatus });
        if (!res.ok) {
          setError(res.error.message);
          break;
        }
      }
      setSelected(new Set());
      setBulkStatus("");
      router.refresh();
    });
  }

  function createInline() {
    setError(null);
    if (!newTitle.trim()) return;
    const title = newTitle.trim();
    startTransition(async () => {
      const res = await createTask({ title, priority: "MEDIUM" });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      setNewTitle("");
      router.refresh();
    });
  }

  function counts(key: (typeof TABS)[number]["key"]) {
    const def = TABS.find((tt) => tt.key === key);
    if (!def) return 0;
    return initialTasks.filter(def.match).length;
  }

  return (
    <div className="space-y-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          createInline();
        }}
        className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-xl p-4 flex gap-3"
      >
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder={t.tasks.inlineCreatePlaceholder}
          className="flex-1 text-sm border border-[var(--brand-border)] rounded-md px-3 py-2 focus:outline-none focus:border-[var(--brand-blue)]"
        />
        <button
          type="submit"
          disabled={pending || !newTitle.trim()}
          className="px-4 py-2 text-sm rounded-md bg-[var(--brand-blue)] text-white disabled:opacity-50"
        >
          {t.tasks.inlineCreate}
        </button>
      </form>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1.5">
          {TABS.map((tt) => {
            const on = tt.key === tab;
            return (
              <button
                key={tt.key}
                type="button"
                onClick={() => {
                  setTab(tt.key);
                  setSelected(new Set());
                }}
                className={`px-3 py-1.5 text-sm rounded-md border transition ${
                  on
                    ? "bg-[var(--brand-blue)] text-white border-[var(--brand-blue)]"
                    : "bg-white text-[var(--brand-fg-muted)] border-[var(--brand-border)] hover:text-[var(--brand-fg)]"
                }`}
              >
                {tt.label}{" "}
                <span className="text-xs opacity-70">({counts(tt.key)})</span>
              </button>
            );
          })}
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2 text-xs text-[var(--brand-fg-muted)]">
            <span>{t.tasks.bulkSelected(selected.size)}</span>
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as TaskStatus | "")}
              className="text-sm border border-[var(--brand-border)] rounded-md px-2 py-1 bg-white"
            >
              <option value="">{t.tasks.bulkChoose}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t.status[s]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={applyBulk}
              disabled={pending || !bulkStatus}
              className="px-3 py-1 text-sm rounded-md bg-[var(--brand-blue)] text-white disabled:opacity-50"
            >
              {t.tasks.bulkApply}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="px-4 py-2 rounded-md bg-[var(--brand-magenta)]/10 text-[var(--brand-magenta)] text-sm border border-[var(--brand-magenta)]/30">
          {error}
        </div>
      )}

      <div className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <p className="p-8 text-sm text-[var(--brand-fg-muted)] text-center">
            {t.tasks.empty}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--brand-bg)]">
              <tr className="text-xs uppercase tracking-wide text-[var(--brand-fg-muted)]">
                <th className="px-3 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="seleccionar todas"
                  />
                </th>
                <th className="text-left px-3 py-3 font-medium">
                  {t.tasks.columnTitle}
                </th>
                <th className="text-left px-3 py-3 font-medium">
                  {t.tasks.columnProject}
                </th>
                <th className="text-left px-3 py-3 font-medium">
                  {t.tasks.columnDue}
                </th>
                <th className="text-left px-3 py-3 font-medium">
                  {t.tasks.columnPriority}
                </th>
                <th className="text-left px-3 py-3 font-medium">
                  {t.tasks.columnStatus}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--brand-border)]">
              {filtered.map((row) => (
                <TaskRow
                  key={row.id}
                  row={row}
                  checked={selected.has(row.id)}
                  onToggle={() => toggle(row.id)}
                  onRefresh={() => router.refresh()}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function TaskRow({
  row,
  checked,
  onToggle,
  onRefresh,
}: {
  row: MyTaskRow;
  checked: boolean;
  onToggle: () => void;
  onRefresh: () => void;
}) {
  const [status, setStatus] = useState<TaskStatus>(row.status);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function onChange(next: TaskStatus) {
    const prev = status;
    setStatus(next);
    setErr(null);
    startTransition(async () => {
      const res = await updateTaskStatus({ id: row.id, status: next });
      if (!res.ok) {
        setStatus(prev);
        setErr(res.error.message);
        return;
      }
      onRefresh();
    });
  }

  return (
    <tr className="hover:bg-[var(--brand-bg)] transition">
      <td className="px-3 py-3 w-8">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          aria-label={`seleccionar ${row.title}`}
        />
      </td>
      <td className="px-3 py-3">
        <p className="font-medium">{row.title}</p>
        {err && <p className="text-xs text-[var(--brand-magenta)]">{err}</p>}
      </td>
      <td className="px-3 py-3 text-[var(--brand-fg-muted)] text-xs">
        {row.project?.name ?? "—"}
      </td>
      <td className="px-3 py-3 text-[var(--brand-fg-muted)] text-xs">
        {formatDate(row.due_date)}
      </td>
      <td className="px-3 py-3 text-xs">{t.priority[row.priority]}</td>
      <td className="px-3 py-3 flex items-center gap-2">
        <TaskStatusPill status={status} />
        <select
          value={status}
          disabled={pending}
          onChange={(e) => onChange(e.target.value as TaskStatus)}
          className="text-xs border border-[var(--brand-border)] rounded-md px-2 py-1 bg-white"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t.status[s]}
            </option>
          ))}
        </select>
      </td>
    </tr>
  );
}
