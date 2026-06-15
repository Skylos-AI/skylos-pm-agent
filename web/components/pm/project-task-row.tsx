"use client";

import { useState, useTransition } from "react";
import { formatDate } from "@/lib/format/date";
import { t } from "@/lib/i18n/es";
import { TaskStatusPill } from "@/components/pm/status-pill";
import { updateTaskStatus } from "@/lib/mutations/tasks";
import type { ProjectTask } from "@/lib/types/projects";

const STATUSES = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as const;

export function ProjectTaskRow({ task }: { task: ProjectTask }) {
  const [status, setStatus] = useState<ProjectTask["status"]>(task.status);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onChange(next: ProjectTask["status"]) {
    const prev = status;
    setStatus(next);
    setError(null);
    startTransition(async () => {
      const res = await updateTaskStatus({ id: task.id, status: next });
      if (!res.ok) {
        setStatus(prev);
        setError(res.error.message);
      }
    });
  }

  return (
    <li className="py-3 flex items-start gap-3">
      <TaskStatusPill status={status} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{task.title}</p>
        <p className="text-xs text-[var(--brand-fg-muted)] truncate">
          {task.assignee?.full_name ?? "—"}
          {task.due_date ? ` · ${formatDate(task.due_date)}` : ""}
          {task.priority !== "MEDIUM" ? ` · ${t.priority[task.priority]}` : ""}
        </p>
        {error && <p className="text-xs text-[var(--brand-magenta)]">{error}</p>}
      </div>
      <select
        value={status}
        disabled={pending}
        onChange={(e) => onChange(e.target.value as ProjectTask["status"])}
        className="text-xs border border-[var(--brand-border)] rounded-md px-2 py-1 bg-white"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {t.status[s]}
          </option>
        ))}
      </select>
    </li>
  );
}
