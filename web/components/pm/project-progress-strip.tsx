import { PaceBadge } from "@/components/pm/status-pill";
import { t } from "@/lib/i18n/es";
import type { Pace } from "@/lib/types/projects";

export function ProjectProgressStrip({
  progressPct,
  pace,
  daysToTargetEnd,
}: {
  progressPct: number;
  pace: Pace;
  daysToTargetEnd: number | null;
}) {
  return (
    <div className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs uppercase tracking-wide text-[var(--brand-fg-muted)]">
          {t.projects.progressOf(progressPct)}
        </p>
        <div className="flex items-center gap-3">
          {daysToTargetEnd !== null && (
            <span className="text-xs text-[var(--brand-fg-muted)]">
              {t.projects.daysRemaining(daysToTargetEnd)}
            </span>
          )}
          <PaceBadge pace={pace} />
        </div>
      </div>
      <div className="h-3 rounded-full bg-[var(--brand-bg)] overflow-hidden">
        <div
          className="h-full"
          style={{
            width: `${Math.max(0, Math.min(100, progressPct))}%`,
            background: "var(--brand-gradient)",
          }}
        />
      </div>
    </div>
  );
}
