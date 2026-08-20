"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { t } from "@/lib/i18n/es";
import { TaskStatusPill } from "@/components/pm/status-pill";
import { Modal } from "@/components/pm/modal";
import {
  createTask,
  updateTaskDescription,
  updateTaskStatus,
  setTaskReviewers,
  approveTaskAsReviewer,
  rejectTaskAsReviewer,
} from "@/lib/mutations/tasks";
import {
  createTaskNote,
  deleteTaskNote,
} from "@/lib/mutations/task-notes";
import {
  cancelReminder,
  createReminder,
  updateReminder,
} from "@/lib/mutations/reminders";
import type {
  MyTaskRow,
  TaskNoteRow,
  TaskReminderRow,
  TaskReviewerRow,
  TaskStatus,
} from "@/lib/types/tasks";

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
    key: "IN_REVIEW",
    label: t.tasks.tabInReview,
    match: (r: MyTaskRow) => r.status === "IN_REVIEW",
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
  // Special tab: draws from `awaitingReviewTasks` prop, not from initialTasks.
  { key: "AWAITING_MY_REVIEW", label: t.tasks.tabAwaitingMyReview, match: () => false },
] as const;

const STATUSES: TaskStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "BLOCKED",
  "IN_REVIEW",
  "DONE",
];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export function TasksQueue({
  initialTasks,
  awaitingReviewTasks,
  teamMembers,
  currentUserId,
  scope,
}: {
  initialTasks: MyTaskRow[];
  awaitingReviewTasks: MyTaskRow[];
  teamMembers: { id: string; full_name: string }[];
  currentUserId: string;
  scope: "mine" | "all" | string;
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
  const [richReviewers, setRichReviewers] = useState<string[]>([]);
  const [richError, setRichError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    // The review tab bypasses the initialTasks list — it always shows tasks
    // where the current user is a pending reviewer, regardless of scope.
    if (tab === "AWAITING_MY_REVIEW") return awaitingReviewTasks;
    const def = TABS.find((tt) => tt.key === tab);
    return def ? initialTasks.filter(def.match) : initialTasks;
  }, [initialTasks, awaitingReviewTasks, tab]);

  // Group tasks by project so the same visual table is chunked into
  // per-project sections. "Sin proyecto" collects the loose ones.
  const grouped = useMemo(() => {
    const groups = new Map<
      string,
      { id: string | null; name: string; rows: MyTaskRow[] }
    >();
    for (const row of filtered) {
      const key = row.project?.id ?? "__none";
      const g = groups.get(key);
      if (g) g.rows.push(row);
      else
        groups.set(key, {
          id: row.project?.id ?? null,
          name: row.project?.name ?? t.tasks.groupNoProject,
          rows: [row],
        });
    }
    // Named projects first (alphabetical), "Sin proyecto" last.
    return Array.from(groups.values()).sort((a, b) => {
      if (a.id === null) return 1;
      if (b.id === null) return -1;
      return a.name.localeCompare(b.name);
    });
  }, [filtered]);

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
        reviewerIds: richReviewers,
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
      setRichReviewers([]);
      router.refresh();
    });
  }

  function counts(key: (typeof TABS)[number]["key"]) {
    if (key === "AWAITING_MY_REVIEW") return awaitingReviewTasks.length;
    const def = TABS.find((tt) => tt.key === key);
    if (!def) return 0;
    return initialTasks.filter(def.match).length;
  }

  function scopeHref(next: "mine" | "all" | string): string {
    if (next === "mine") return "/tasks";
    return `/tasks?assignee=${encodeURIComponent(next)}`;
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

      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="text-[var(--brand-fg-muted)] uppercase tracking-wider">
          Ver:
        </span>
        <Link
          href={scopeHref("mine")}
          className={`px-2.5 py-1 rounded-md border ${
            scope === "mine"
              ? "bg-[var(--brand-blue)] text-white border-[var(--brand-blue)]"
              : "bg-white text-[var(--brand-fg-muted)] border-[var(--brand-border)] hover:text-[var(--brand-fg)]"
          }`}
        >
          {t.tasks.scopeMine}
        </Link>
        <Link
          href={scopeHref("all")}
          className={`px-2.5 py-1 rounded-md border ${
            scope === "all"
              ? "bg-[var(--brand-blue)] text-white border-[var(--brand-blue)]"
              : "bg-white text-[var(--brand-fg-muted)] border-[var(--brand-border)] hover:text-[var(--brand-fg)]"
          }`}
        >
          {t.tasks.scopeAll}
        </Link>
        {teamMembers
          .filter((m) => m.id !== currentUserId)
          .map((m) => {
            const on = scope === m.id;
            return (
              <Link
                key={m.id}
                href={scopeHref(m.id)}
                className={`px-2.5 py-1 rounded-md border ${
                  on
                    ? "bg-[var(--brand-blue)] text-white border-[var(--brand-blue)]"
                    : "bg-white text-[var(--brand-fg-muted)] border-[var(--brand-border)] hover:text-[var(--brand-fg)]"
                }`}
              >
                {t.tasks.scopeUserPrefix} {m.full_name}
              </Link>
            );
          })}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1.5 flex-wrap">
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
            {grouped.map((g) => (
              <tbody
                key={`g-${g.id ?? "none"}`}
                className="divide-y divide-[var(--brand-border)]"
              >
                <tr className="bg-[var(--brand-bg)]">
                  <td
                    colSpan={7}
                    className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--brand-fg-muted)]"
                  >
                    {g.name}
                    <span className="ml-2 font-normal tabular-nums">
                      ({g.rows.length})
                    </span>
                  </td>
                </tr>
                {g.rows.map((row) => (
                  <TaskRow
                    key={row.id}
                    row={row}
                    currentUserId={currentUserId}
                    teamMembers={teamMembers}
                    checked={selected.has(row.id)}
                    onToggle={() => toggle(row.id)}
                    onRefresh={() => router.refresh()}
                  />
                ))}
              </tbody>
            ))}
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
          <div>
            <span className="text-xs text-[var(--brand-fg-muted)] uppercase tracking-wide">
              {t.tasks.reviewersLabel}
            </span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {teamMembers
                .filter((m) => m.id !== richAssignee)
                .map((m) => {
                  const on = richReviewers.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() =>
                        setRichReviewers((prev) =>
                          on
                            ? prev.filter((id) => id !== m.id)
                            : [...prev, m.id],
                        )
                      }
                      className={`px-2 py-1 text-xs rounded-full border transition ${
                        on
                          ? "bg-[var(--brand-blue)] text-white border-[var(--brand-blue)]"
                          : "bg-white text-[var(--brand-fg-muted)] border-[var(--brand-border)] hover:text-[var(--brand-fg)]"
                      }`}
                    >
                      {m.full_name}
                    </button>
                  );
                })}
              {teamMembers.filter((m) => m.id !== richAssignee).length === 0 && (
                <span className="text-xs text-[var(--brand-fg-muted)] italic">
                  Sin otros miembros disponibles.
                </span>
              )}
            </div>
            {richReviewers.length > 0 && (
              <p className="mt-1 text-[11px] text-[var(--brand-fg-muted)]">
                Al marcar la tarea como hecha, necesitará la aprobación de
                estos revisores antes de cerrarse.
              </p>
            )}
          </div>
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
  currentUserId,
  teamMembers,
  checked,
  onToggle,
  onRefresh,
}: {
  row: MyTaskRow;
  currentUserId: string;
  teamMembers: { id: string; full_name: string }[];
  checked: boolean;
  onToggle: () => void;
  onRefresh: () => void;
}) {
  const [status, setStatus] = useState<TaskStatus>(row.status);
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [showResources, setShowResources] = useState(false);
  const [showThread, setShowThread] = useState(false);
  const [description, setDescription] = useState(row.description ?? "");
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(row.description ?? "");
  const [noteErr, setNoteErr] = useState<string | null>(null);
  const [savingNote, startNoteTransition] = useTransition();
  const notes = row.notes ?? [];
  const noteCount = notes.length;
  const reminders = row.reminders ?? [];
  const reminderCount = reminders.length;

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
  const reviewers = row.reviewers ?? [];
  const reviewerCount = reviewers.length;
  const pendingReviewers = reviewers.filter((r) => !r.approved_at).length;
  const myReviewerRow = reviewers.find((r) => r.user_id === currentUserId);
  const iAmPendingReviewer = Boolean(
    myReviewerRow && !myReviewerRow.approved_at,
  );

  return (
    <>
      <tr
        id={`task-${row.id}`}
        className="hover:bg-[var(--brand-bg)] transition scroll-mt-24 target:bg-[var(--brand-blue)]/[0.06]"
      >
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
            <button
              type="button"
              onClick={() => setShowThread((s) => !s)}
              className="text-xs text-[var(--brand-blue)] hover:underline"
              title={t.tasks.threadOpen}
            >
              💬 {t.tasks.threadOpen}
              {noteCount > 0 && (
                <span className="ml-1 tabular-nums">({noteCount})</span>
              )}
              {reminderCount > 0 && (
                <span className="ml-1 tabular-nums">⏰{reminderCount}</span>
              )}
              {reviewerCount > 0 && (
                <span
                  className={`ml-1 tabular-nums ${
                    pendingReviewers > 0
                      ? "text-[var(--brand-magenta)]"
                      : "text-[var(--brand-fg-muted)]"
                  }`}
                >
                  ✓ {reviewerCount - pendingReviewers}/{reviewerCount}
                </span>
              )}
            </button>
            {iAmPendingReviewer && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[var(--brand-blue)]/10 text-[var(--brand-blue)] border border-[var(--brand-blue)]/30">
                revisá esto
              </span>
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
      {showThread && (
        <tr className="bg-[var(--brand-bg)]">
          <td colSpan={7} className="px-4 py-3 space-y-5">
            <ReviewersPanel
              taskId={row.id}
              assigneeId={row.assignee?.id ?? null}
              reviewers={reviewers}
              teamMembers={teamMembers}
              currentUserId={currentUserId}
              onRefresh={onRefresh}
            />
            <NotesThread
              taskId={row.id}
              notes={notes}
              currentUserId={currentUserId}
              onRefresh={onRefresh}
            />
            <RemindersPanel
              taskId={row.id}
              reminders={reminders}
              onRefresh={onRefresh}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function ReviewersPanel({
  taskId,
  assigneeId,
  reviewers,
  teamMembers,
  currentUserId,
  onRefresh,
}: {
  taskId: string;
  assigneeId: string | null;
  reviewers: TaskReviewerRow[];
  teamMembers: { id: string; full_name: string }[];
  currentUserId: string;
  onRefresh: () => void;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [approveComment, setApproveComment] = useState("");
  const canManage =
    assigneeId === currentUserId || reviewers.length === 0;
  const myRow = reviewers.find((r) => r.user_id === currentUserId);
  const iAmPending = Boolean(myRow && !myRow.approved_at);

  function approve() {
    setErr(null);
    startTransition(async () => {
      const res = await approveTaskAsReviewer({
        taskId,
        comment: approveComment.trim() || undefined,
      });
      if (!res.ok) {
        setErr(res.error.message);
        return;
      }
      setApproveComment("");
      onRefresh();
    });
  }

  function reject() {
    const comment = window.prompt(t.tasks.reviewerRejectPrompt);
    if (!comment || !comment.trim()) return;
    setErr(null);
    startTransition(async () => {
      const res = await rejectTaskAsReviewer({
        taskId,
        comment: comment.trim(),
      });
      if (!res.ok) {
        setErr(res.error.message);
        return;
      }
      onRefresh();
    });
  }

  function toggleReviewer(userId: string) {
    if (userId === assigneeId) return; // guard: assignee can't be reviewer
    const next = reviewers.some((r) => r.user_id === userId)
      ? reviewers.filter((r) => r.user_id !== userId).map((r) => r.user_id)
      : [...reviewers.map((r) => r.user_id), userId];
    setErr(null);
    startTransition(async () => {
      const res = await setTaskReviewers({ taskId, reviewerIds: next });
      if (!res.ok) {
        setErr(res.error.message);
        return;
      }
      onRefresh();
    });
  }

  return (
    <div className="max-w-2xl space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wider text-[var(--brand-fg-muted)]">
          {t.tasks.reviewersLabel}
        </span>
        {canManage && (
          <button
            type="button"
            onClick={() => setPickerOpen((s) => !s)}
            disabled={pending}
            className="text-xs text-[var(--brand-blue)] hover:underline disabled:opacity-50"
          >
            {pickerOpen ? "Cerrar" : t.tasks.reviewersPick}
          </button>
        )}
      </div>

      {pickerOpen && canManage && (
        <div className="flex flex-wrap gap-1.5">
          {teamMembers
            .filter((m) => m.id !== assigneeId)
            .map((m) => {
              const on = reviewers.some((r) => r.user_id === m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  disabled={pending}
                  onClick={() => toggleReviewer(m.id)}
                  className={`px-2 py-1 text-xs rounded-full border transition ${
                    on
                      ? "bg-[var(--brand-blue)] text-white border-[var(--brand-blue)]"
                      : "bg-white text-[var(--brand-fg-muted)] border-[var(--brand-border)] hover:text-[var(--brand-fg)]"
                  }`}
                >
                  {m.full_name}
                </button>
              );
            })}
        </div>
      )}

      {reviewers.length === 0 ? (
        <p className="text-xs italic text-[var(--brand-fg-muted)]">
          {t.tasks.reviewersEmpty}
        </p>
      ) : (
        <ul className="space-y-1">
          {reviewers.map((r) => {
            const name = r.user?.full_name ?? "—";
            const state = r.approved_at
              ? "approved"
              : r.rejected_at
                ? "rejected"
                : "pending";
            return (
              <li
                key={r.id}
                className="flex items-center gap-2 text-xs text-[var(--brand-fg)]"
              >
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${
                    state === "approved"
                      ? "bg-[var(--brand-blue)]/10 text-[var(--brand-blue)] border-[var(--brand-blue)]/30"
                      : state === "rejected"
                        ? "bg-[var(--brand-magenta)]/10 text-[var(--brand-magenta)] border-[var(--brand-magenta)]/30"
                        : "bg-white text-[var(--brand-fg-muted)] border-[var(--brand-border)]"
                  }`}
                >
                  {state === "approved" && "✓"}
                  {state === "rejected" && "✗"}
                  {state === "pending" && "•"} {name}
                </span>
                {r.approved_at && (
                  <span className="text-[10px] text-[var(--brand-fg-muted)]">
                    {formatDateTime(r.approved_at)}
                  </span>
                )}
                {r.comment && (
                  <span className="text-[var(--brand-fg-muted)] italic truncate">
                    "{r.comment}"
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {iAmPending && (
        <div className="pt-2 border-t border-[var(--brand-border)] space-y-2">
          <input
            value={approveComment}
            onChange={(e) => setApproveComment(e.target.value)}
            placeholder="Comentario opcional…"
            className="w-full text-xs border border-[var(--brand-border)] rounded-md px-2 py-1.5 focus:outline-none focus:border-[var(--brand-blue)]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={approve}
              disabled={pending}
              className="px-3 py-1 text-xs rounded-md bg-[var(--brand-blue)] text-white disabled:opacity-50"
            >
              ✓ {t.tasks.reviewerApprove}
            </button>
            <button
              type="button"
              onClick={reject}
              disabled={pending}
              className="px-3 py-1 text-xs rounded-md bg-white text-[var(--brand-magenta)] border border-[var(--brand-magenta)]/30 hover:bg-[var(--brand-magenta)]/5 disabled:opacity-50"
            >
              ✗ {t.tasks.reviewerReject}
            </button>
          </div>
        </div>
      )}
      {err && (
        <p className="text-xs text-[var(--brand-magenta)]">{err}</p>
      )}
    </div>
  );
}

function NotesThread({
  taskId,
  notes,
  currentUserId,
  onRefresh,
}: {
  taskId: string;
  notes: TaskNoteRow[];
  currentUserId: string;
  onRefresh: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function send() {
    setErr(null);
    const body = draft.trim();
    if (!body) return;
    startTransition(async () => {
      const res = await createTaskNote({ taskId, body });
      if (!res.ok) {
        setErr(res.error.message);
        return;
      }
      setDraft("");
      onRefresh();
    });
  }

  function remove(id: string) {
    if (!confirm(t.tasks.threadDeleteConfirm)) return;
    startTransition(async () => {
      const res = await deleteTaskNote({ id });
      if (!res.ok) {
        setErr(res.error.message);
        return;
      }
      onRefresh();
    });
  }

  return (
    <div className="max-w-2xl space-y-3">
      {notes.length === 0 ? (
        <p className="text-xs text-[var(--brand-fg-muted)] italic">
          {t.tasks.threadEmpty}
        </p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => {
            const authorName = n.author_agent
              ? "Manu"
              : n.author?.full_name ?? t.tasks.threadUnknownAuthor;
            const ownedByMe =
              !n.author_agent && n.author?.id === currentUserId;
            return (
              <li
                key={n.id}
                className="rounded-md border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium text-[var(--brand-fg)]">
                      {authorName}
                    </span>
                    {n.author_agent && (
                      <span className="px-1.5 py-0.5 rounded-full bg-[var(--brand-blue)]/10 text-[var(--brand-blue)] border border-[var(--brand-blue)]/30 text-[10px] uppercase tracking-wide">
                        {t.tasks.threadAgentBadge}
                      </span>
                    )}
                    <span className="text-[var(--brand-fg-muted)]">
                      {formatDateTime(n.created_at)}
                    </span>
                  </div>
                  {ownedByMe && (
                    <button
                      type="button"
                      onClick={() => remove(n.id)}
                      disabled={pending}
                      className="text-xs text-[var(--brand-magenta)] hover:underline disabled:opacity-50"
                    >
                      {t.tasks.threadDelete}
                    </button>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap text-[var(--brand-fg)]">
                  {n.body}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      <div className="space-y-1">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={2000}
          rows={2}
          placeholder={t.tasks.threadPlaceholder}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
          }}
          className="w-full text-sm border border-[var(--brand-border)] rounded-md px-3 py-2 bg-white resize-none focus:outline-none focus:border-[var(--brand-blue)]"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={send}
            disabled={pending || !draft.trim()}
            className="px-3 py-1.5 text-xs rounded-md bg-[var(--brand-blue)] text-white disabled:opacity-50"
          >
            {pending ? "…" : t.tasks.threadSend}
          </button>
          <span className="text-xs text-[var(--brand-fg-muted)] ml-auto tabular-nums">
            {draft.length}/2000
          </span>
        </div>
        {err && (
          <p className="text-xs text-[var(--brand-magenta)]">{err}</p>
        )}
      </div>
    </div>
  );
}

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function RemindersPanel({
  taskId,
  reminders,
  onRefresh,
}: {
  taskId: string;
  reminders: TaskReminderRow[];
  onRefresh: () => void;
}) {
  const [message, setMessage] = useState("");
  const [triggerAt, setTriggerAt] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMessage, setEditMessage] = useState("");
  const [editTriggerAt, setEditTriggerAt] = useState("");

  function create() {
    setErr(null);
    if (!message.trim() || !triggerAt) return;
    startTransition(async () => {
      const res = await createReminder({
        message: message.trim(),
        triggerAt: new Date(triggerAt).toISOString(),
        relatedTaskId: taskId,
      });
      if (!res.ok) {
        setErr(res.error.message);
        return;
      }
      setMessage("");
      setTriggerAt("");
      onRefresh();
    });
  }

  function beginEdit(r: TaskReminderRow) {
    setEditingId(r.id);
    setEditMessage(r.message);
    setEditTriggerAt(toLocalInputValue(r.trigger_at));
    setErr(null);
  }

  function saveEdit() {
    if (!editingId) return;
    setErr(null);
    startTransition(async () => {
      const res = await updateReminder({
        id: editingId,
        message: editMessage.trim(),
        triggerAt: editTriggerAt
          ? new Date(editTriggerAt).toISOString()
          : undefined,
      });
      if (!res.ok) {
        setErr(res.error.message);
        return;
      }
      setEditingId(null);
      onRefresh();
    });
  }

  function cancel(id: string) {
    if (!confirm(t.tasks.reminderCancelConfirm)) return;
    startTransition(async () => {
      const res = await cancelReminder({ id });
      if (!res.ok) {
        setErr(res.error.message);
        return;
      }
      onRefresh();
    });
  }

  return (
    <div className="max-w-2xl space-y-3 border-t border-[var(--brand-border)] pt-4">
      <h4 className="text-xs uppercase tracking-wide text-[var(--brand-fg-muted)] font-medium">
        ⏰ {t.tasks.remindersTitle}
      </h4>
      {reminders.length === 0 ? (
        <p className="text-xs text-[var(--brand-fg-muted)] italic">
          {t.tasks.remindersEmpty}
        </p>
      ) : (
        <ul className="space-y-2">
          {reminders.map((r) => {
            const isEditing = editingId === r.id;
            return (
              <li
                key={r.id}
                className="rounded-md border border-[var(--brand-border)] bg-[var(--brand-surface)] px-3 py-2"
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      value={editMessage}
                      onChange={(e) => setEditMessage(e.target.value)}
                      className="w-full text-sm border border-[var(--brand-border)] rounded-md px-2 py-1"
                    />
                    <input
                      type="datetime-local"
                      value={editTriggerAt}
                      onChange={(e) => setEditTriggerAt(e.target.value)}
                      className="text-xs border border-[var(--brand-border)] rounded-md px-2 py-1"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={saveEdit}
                        disabled={pending || !editMessage.trim()}
                        className="px-2 py-0.5 text-xs rounded bg-[var(--brand-blue)] text-white disabled:opacity-50"
                      >
                        {t.tasks.reminderSave}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="text-xs text-[var(--brand-fg-muted)] hover:text-[var(--brand-fg)]"
                      >
                        {t.tasks.reminderCancel}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-[var(--brand-fg)]">
                        {r.message}
                      </p>
                      <p className="text-xs text-[var(--brand-fg-muted)] mt-0.5">
                        {formatDateTime(r.trigger_at)}
                        {r.created_by_agent && (
                          <span className="ml-2 px-1.5 py-0.5 rounded-full bg-[var(--brand-blue)]/10 text-[var(--brand-blue)] border border-[var(--brand-blue)]/30 text-[10px] uppercase tracking-wide">
                            {t.tasks.threadAgentBadge}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => beginEdit(r)}
                        className="text-xs text-[var(--brand-blue)] hover:underline"
                      >
                        {t.tasks.reminderEdit}
                      </button>
                      <button
                        type="button"
                        onClick={() => cancel(r.id)}
                        disabled={pending}
                        className="text-xs text-[var(--brand-magenta)] hover:underline disabled:opacity-50"
                      >
                        {t.tasks.reminderCancelBtn}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t.tasks.reminderMessagePlaceholder}
          className="flex-1 min-w-[200px] text-sm border border-[var(--brand-border)] rounded-md px-3 py-2 bg-white"
        />
        <input
          type="datetime-local"
          value={triggerAt}
          onChange={(e) => setTriggerAt(e.target.value)}
          className="text-sm border border-[var(--brand-border)] rounded-md px-2 py-2 bg-white"
        />
        <button
          type="button"
          onClick={create}
          disabled={pending || !message.trim() || !triggerAt}
          className="px-3 py-2 text-xs rounded-md bg-[var(--brand-blue)] text-white disabled:opacity-50"
        >
          {pending ? "…" : t.tasks.reminderCreate}
        </button>
      </div>
      {err && <p className="text-xs text-[var(--brand-magenta)]">{err}</p>}
    </div>
  );
}
