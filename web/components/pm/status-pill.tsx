import { t } from "@/lib/i18n/es";
import type { Pace } from "@/lib/types/projects";

export function StatusPill({
  status,
}: {
  status: "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
}) {
  const color =
    status === "ACTIVE"
      ? "bg-[var(--brand-blue)]/10 text-[var(--brand-blue)]"
      : status === "COMPLETED"
        ? "bg-[var(--brand-cyan)]/10 text-[var(--brand-cyan)]"
        : status === "CANCELLED"
          ? "bg-[var(--brand-magenta)]/10 text-[var(--brand-magenta)]"
          : "bg-[var(--brand-fg-muted)]/10 text-[var(--brand-fg-muted)]";
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${color}`}
    >
      {t.projectStatus[status]}
    </span>
  );
}

export function PaceBadge({ pace }: { pace: Pace }) {
  const color =
    pace === "on_track"
      ? "bg-[var(--brand-blue)]/10 text-[var(--brand-blue)]"
      : pace === "ahead"
        ? "bg-[var(--brand-cyan)]/10 text-[var(--brand-cyan)]"
        : pace === "behind"
          ? "bg-[var(--brand-magenta)]/10 text-[var(--brand-magenta)]"
          : "bg-[var(--brand-fg-muted)]/10 text-[var(--brand-fg-muted)]";
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${color}`}
    >
      {t.pace[pace]}
    </span>
  );
}

export function TaskStatusPill({
  status,
}: {
  status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
}) {
  const color =
    status === "DONE"
      ? "bg-[var(--brand-cyan)]/10 text-[var(--brand-cyan)]"
      : status === "BLOCKED"
        ? "bg-[var(--brand-magenta)]/10 text-[var(--brand-magenta)]"
        : status === "IN_PROGRESS"
          ? "bg-[var(--brand-blue)]/10 text-[var(--brand-blue)]"
          : "bg-[var(--brand-fg-muted)]/10 text-[var(--brand-fg-muted)]";
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${color}`}
    >
      {t.status[status]}
    </span>
  );
}
