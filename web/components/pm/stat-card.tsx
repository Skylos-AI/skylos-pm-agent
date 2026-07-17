import { ReactNode } from "react";

export function StatCard({
  label,
  value,
  hint,
  accent = "blue",
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: "blue" | "magenta" | "cyan" | "gradient";
  icon?: ReactNode;
}) {
  const valueClass =
    accent === "magenta"
      ? "text-[var(--brand-magenta)]"
      : accent === "cyan"
        ? "text-[var(--brand-cyan-text)]"
        : accent === "gradient"
          ? "brand-gradient-text"
          : "text-[var(--brand-blue)]";
  const chipClass =
    accent === "magenta"
      ? "bg-[var(--brand-magenta)]/10 text-[var(--brand-magenta)]"
      : accent === "cyan"
        ? "bg-[var(--brand-cyan)]/15 text-[var(--brand-cyan-text)]"
        : accent === "gradient"
          ? "brand-gradient text-white"
          : "bg-[var(--brand-blue)]/10 text-[var(--brand-blue)]";

  return (
    <div className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-2xl p-5 relative overflow-hidden [box-shadow:var(--shadow-card)] hover:[box-shadow:var(--shadow-card-hover)] hover:-translate-y-0.5 transition duration-200">
      {accent === "gradient" && (
        <div
          className="absolute inset-x-0 top-0 h-0.5 brand-gradient"
          aria-hidden
        />
      )}
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs uppercase tracking-wide text-[var(--brand-fg-muted)] font-medium">
          {label}
        </span>
        {icon && (
          <span
            className={`h-7 w-7 rounded-lg flex items-center justify-center ${chipClass}`}
          >
            {icon}
          </span>
        )}
      </div>
      <div
        className={`font-display text-4xl tracking-tight leading-none tabular-nums ${valueClass}`}
      >
        {value}
      </div>
      {hint && (
        <p className="text-xs text-[var(--brand-fg-muted)] mt-2">{hint}</p>
      )}
    </div>
  );
}
