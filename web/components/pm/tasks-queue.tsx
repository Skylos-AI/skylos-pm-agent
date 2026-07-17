"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/format/date";
import { t } from "@/lib/i18n/es";
import { TaskStatusPill } from "@/components/pm/status-pill";
import { Modal } from "@/components/pm/modal";
import {
  createTask,
  updateTaskDescription,
  updateTaskStatus,
} from "@/lib/mutations/tasks";
import type { MyTaskRow, TaskStatus } from "@/lib/types/tasks";

function isOverdue(row: MyTaskRow): boolean {
  if (!row.due_date || row.status === "DONE") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(row.due_date) < today;
}

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
    key: "OVERDUE",
    label: t.tasks.tabOverdue,
    match: (r: MyTaskRow) => isOverdue(r),
  },
  {
    key: "DONE",
    label: t.tasks.tabDone,
    match: (r: MyTaskRow) => r.status === "DONE",
  },
] as const;

const STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export function TasksQueue({
  initialTasks,
  teamMembers,
  currentUserId,
}: {
  initialTasks: MyTaskRow[];
  teamMembers: { id: string; full_name: string }[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("TODO");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<TaskStatus | "">("");
  const [newTitle, setNewTitle] = useState("");
  const [inlineAssignee, setInlineAssignee] = useState(currentUserId);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Rich modal state
  const [richOpen, setRichOpen] = useState(false);
  const [richTitle, setRichTitle] = useState("");
  const [richAssignee, setRichAssignee] = useState(currentUserId);
  const [richPriority, setRichPriority] = useState<(typeof PRIORITIES)[number]>(
    "MEDIUM",
  );
  const [richDue, setRichDue] = useState("");
  const [richHours, setRichHours] = useState("");
  const [richDescription, setRichDescription] = useState("");
  const [richResources, setRichResources] = useState("");
  const [richError, setRichError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const def = TABS.find((tt) => tt.key === tab);
    return def ? initialTasks.filter(def.match) : initialTasks;
  }, [initialTasks, tab]);

  const allSelected =
    filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  function toggleAll() {
    const next = new Set(selected);
    if (allSelected) filtered.forEach((r) => next.delete(r.id));
    else filtered.forEach((r) => next.add(r.id));
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
    const assigneeId = inlineAssignee;
    startTransition(async () => {
      const res = await createTask({
        title,
        priority: "MEDIUM",
        assigneeId,
      });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      setNewTitle("");
      setInlineAssignee(currentUserId);
      router.refresh();
    });
  }

  function submitRich() {
    setRichError(null);
    if (!richTitle.trim()) {
      setRichError("El título es obligatorio.");
      return;
    }
    startTransition(async () => {
      const res = await createTask({
        title: richTitle.trim(),
        assigneeId: richAssignee,
        priority: richPriority,
        dueDate: richDue ? new Date(richDue).toISOString() : null,
        estimatedHours: richHours ? Number(richHours) : undefined,
        description: richDescription.trim() || undefined,
        resources: richResources.trim() || undefined,
      });
      if (!res.ok) {
        setRichError(res.error.message);
        return;
      }
      setRichOpen(false);
      setRichTitle("");
      setRichAssignee(currentUserId);
      setRichPriority("MEDIUM");
      setRichDue("");
      setRichHours("");
      setRichDescription("");
      setRichResources("");
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
        className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-2xl p-4 [box-shadow:var(--shadow-card)] flex flex-wrap items-center gap-3"
      >
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder={t.tasks.inlineCreatePlaceholder}
          className="flex-1 min-w-[200px] text-sm border border-[var(--brand-border)] rounded-md px-3 py-2 focus:outline-none focus:border-[var(--brand-blue)]"
        />
        <select
          value={inlineAssignee}
          onChange={(e) => setInlineAssignee(e.target.value)}
          className="text-sm border border-[var(--brand-border)] rounded-md px-2 py-2 bg-white"
          title={t.projects.newTaskAssignee}
        >
          {teamMembers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending || !newTitle.trim()}
          className="px-4 py-2 text-sm rounded-md bg-[var(--brand-blue)] text-white disabled:opacity-50"
        >
          {t.tasks.inlineCreate}
        </button>
        <button
          type="button"
          onClick={() => setRichOpen(true)}
          className="text-xs text-[var(--brand-blue)] hover:underline"
        >
          + detalle
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

      <div className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-2xl overflow-hidden [box-shadow:var(--shadow-card)]">
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
                  {t.projects.newTaskAssignee}
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

      <Modal
        open={richOpen}
        onClose={() => setRichOpen(false)}
        title="Nueva tarea con detalle"
      >
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-[var(--brand-fg-muted)] uppercase tracking-wide">
              {t.projects.newTaskTitle}
            </span>
            <input
              autoFocus
              value={richTitle}
              onChange={(e) => setRichTitle(e.target.value)}
              placeholder={t.projects.newTaskTitlePlaceholder}
              className="mt-1 w-full text-sm border border-[var(--brand-border)] rounded-md px-3 py-2 focus:outline-none focus:border-[var(--brand-blue)]"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-[var(--brand-fg-muted)] uppercase tracking-wide">
                {t.projects.newTaskAssignee}
              </span>
              <select
                value={richAssignee}
                onChange={(e) => setRichAssignee(e.target.value)}
                className="mt-1 w-full text-sm border border-[var(--brand-border)] rounded-md px-2 py-2 bg-white"
              >
                {teamMembers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-[var(--brand-fg-muted)] uppercase tracking-wide">
                {t.projects.newTaskPriority}
              </span>
              <select
                value={richPriority}
                onChange={(e) =>
                  setRichPriority(
                    e.target.value as (typeof PRIORITIES)[number],
                  )
                }
                className="mt-1 w-full text-sm border border-[var(--brand-border)] rounded-md px-2 py-2 bg-white"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {t.priority[p]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-[var(--brand-fg-muted)] uppercase tracking-wide">
                {t.projects.newTaskDue}
              </span>
              <input
                type="date"
                value={richDue}
                onChange={(e) => setRichDue(e.target.value)}
                className="mt-1 w-full text-sm border border-[var(--brand-border)] rounded-md px-2 py-2"
              />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--brand-fg-muted)] uppercase tracking-wide">
                {t.projects.newTaskEstimate}
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={richHours}
                onChange={(e) => setRichHours(e.target.value)}
                placeholder="3"
                className="mt-1 w-full text-sm border border-[var(--brand-border)] rounded-md px-3 py-2"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs text-[var(--brand-fg-muted)] uppercase tracking-wide">
              {t.tasks.noteLabel}
            </span>
            <textarea
              rows={2}
              maxLength={500}
              value={richDescription}
              onChange={(e) => setRichDescription(e.target.value)}
              placeholder={t.tasks.notePlaceholder}
              className="mt-1 w-full text-sm border border-[var(--brand-border)] rounded-md px-3 py-2 resize-none focus:outline-none focus:border-[var(--brand-blue)]"
            />
          </label>
          <label className="block">
            <span className="text-xs text-[var(--brand-fg-muted)] uppercase tracking-wide">
              {t.projects.newTaskResources}
            </span>
            <textarea
              rows={3}
              value={richResources}
              onChange={(e) => setRichResources(e.target.value)}
              placeholder={t.projects.newTaskResourcesPlaceholder}
              className="mt-1 w-full text-sm border border-[var(--brand-border)] rounded-md px-3 py-2 resize-none focus:outline-none focus:border-[var(--brand-blue)]"
            />
          </label>
          {richError && (
            <p className="text-sm text-[var(--brand-magenta)]">{richError}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setRichOpen(false)}
              className="px-4 py-2 text-sm rounded-md border border-[var(--brand-border)] hover:bg-[var(--brand-bg)]"
            >
              {t.projects.newTaskCancel}
            </button>
            <button
              type="button"
              onClick={submitRich}
              disabled={pending}
              className="px-4 py-2 text-sm rounded-md bg-[var(--brand-blue)] text-white disabled:opacity-50"
            >
              {pending ? "…" : t.projects.newTaskCreate}
            </button>
          </div>
        </div>
      </Modal>
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
  const [showResources, setShowResources] = useState(false);
  const [description, setDescription] = useState(row.description ?? "");
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(row.description ?? "");
  const [noteErr, setNoteErr] = useState<string | null>(null);
  const [savingNote, startNoteTransition] = useTransition();

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

  function saveNote() {
    setNoteErr(null);
    const next = noteDraft.trim().slice(0, 500);
    startNoteTransition(async () => {
      const res = await updateTaskDescription({
        id: row.id,
        description: next,
      });
      if (!res.ok) {
        setNoteErr(res.error.message);
        return;
      }
      setDescription(next);
      setEditingNote(false);
      onRefresh();
    });
  }

  function cancelNote() {
    setNoteDraft(description);
    setEditingNote(false);
    setNoteErr(null);
  }

  const hasResources = Boolean(row.resources && row.resources.trim().length);
  const overdue = isOverdue(row);
  const hasNote = Boolean(description && description.trim().length);

  return (
    <>
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
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="font-medium">{row.title}</p>
            {overdue && (
              <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-[var(--brand-magenta)]/10 text-[var(--brand-magenta)] border border-[var(--brand-magenta)]/30">
                {t.tasks.overdueBadge}
              </span>
            )}
            {row.estimated_hours != null && (
              <span className="text-xs text-[var(--brand-fg-muted)] bg-[var(--brand-bg)] px-1.5 py-0.5 rounded">
                ⏱ {row.estimated_hours}h
              </span>
            )}
            {hasResources && (
              <button
                type="button"
                onClick={() => setShowResources((s) => !s)}
                className="text-xs text-[var(--brand-blue)] hover:underline"
              >
                📎 {showResources ? "Ocultar" : "Recursos"}
              </button>
            )}
            {!hasNote && !editingNote && (
              <button
                type="button"
                onClick={() => {
                  setNoteDraft("");
                  setEditingNote(true);
                }}
                className="text-xs text-[var(--brand-blue)] hover:underline"
                title="Agregar nota"
              >
                + {t.tasks.addNote}
              </button>
            )}
          </div>
          {hasNote && !editingNote && (
            <button
              type="button"
              onClick={() => {
                setNoteDraft(description);
                setEditingNote(true);
              }}
              className="mt-1 block text-left text-xs italic text-[var(--brand-fg-muted)] hover:text-[var(--brand-fg)] cursor-text max-w-md line-clamp-2"
              title="Editar nota"
            >
              📝 {description}
            </button>
          )}
          {editingNote && (
            <div className="mt-2 max-w-md space-y-1">
              <textarea
                autoFocus
                value={noteDraft}
                maxLength={500}
                rows={2}
                onChange={(e) => setNoteDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") cancelNote();
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveNote();
                }}
                placeholder={t.tasks.notePlaceholder}
                className="w-full text-xs border border-[var(--brand-border)] rounded-md px-2 py-1.5 resize-none focus:outline-none focus:border-[var(--brand-blue)]"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={saveNote}
                  disabled={savingNote}
                  className="px-2 py-0.5 text-xs rounded bg-[var(--brand-blue)] text-white disabled:opacity-50"
                >
                  {savingNote ? "…" : t.tasks.noteSave}
                </button>
                <button
                  type="button"
                  onClick={cancelNote}
                  disabled={savingNote}
                  className="text-xs text-[var(--brand-fg-muted)] hover:text-[var(--brand-fg)]"
                >
                  {t.tasks.noteCancel}
                </button>
                <span className="text-xs text-[var(--brand-fg-muted)] ml-auto tabular-nums">
                  {noteDraft.length}/500
                </span>
              </div>
              {noteErr && (
                <p className="text-xs text-[var(--brand-magenta)]">{noteErr}</p>
              )}
            </div>
          )}
          {err && <p className="text-xs text-[var(--brand-magenta)]">{err}</p>}
        </td>
        <td className="px-3 py-3 text-[var(--brand-fg-muted)] text-xs">
          {row.assignee?.full_name ?? "—"}
        </td>
        <td className="px-3 py-3 text-[var(--brand-fg-muted)] text-xs">
          {row.project?.name ?? "—"}
        </td>
        <td
          className={`px-3 py-3 text-xs ${
            overdue
              ? "text-[var(--brand-magenta)] font-medium"
              : "text-[var(--brand-fg-muted)]"
          }`}
        >
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
      {hasResources && showResources && (
        <tr className="bg-[var(--brand-bg)]">
          <td colSpan={7} className="px-4 py-3">
            <pre className="text-xs text-[var(--brand-fg)] whitespace-pre-wrap font-mono">
              {row.resources}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}
