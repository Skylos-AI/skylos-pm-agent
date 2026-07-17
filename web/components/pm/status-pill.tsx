import { t } from "@/lib/i18n/es";
import type { Pace } from "@/lib/types/projects";
import { Pill, type PillTone } from "@/components/pm/pill";

export function StatusPill({
  status,
}: {
  status: "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
}) {
  const tone: PillTone =
    status === "ACTIVE"
      ? "blue"
      : status === "COMPLETED"
        ? "cyan"
        : status === "CANCELLED"
          ? "magenta"
          : "neutral";
  return <Pill tone={tone}>{t.projectStatus[status]}</Pill>;
}

export function PaceBadge({ pace }: { pace: Pace }) {
  const tone: PillTone =
    pace === "on_track"
      ? "blue"
      : pace === "ahead"
        ? "cyan"
        : pace === "behind"
          ? "magenta"
          : "neutral";
  return <Pill tone={tone}>{t.pace[pace]}</Pill>;
}

export function TaskStatusPill({
  status,
}: {
  status: "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE";
}) {
  const tone: PillTone =
    status === "DONE"
      ? "cyan"
      : status === "BLOCKED"
        ? "magenta"
        : status === "IN_PROGRESS"
          ? "blue"
          : "neutral";
  return <Pill tone={tone}>{t.status[status]}</Pill>;
}
