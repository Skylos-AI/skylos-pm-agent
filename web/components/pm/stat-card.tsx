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
  const accentClass =
    accent === "magenta"
      ? "text-[var(--brand-magenta)]"
      : accent === "cyan"
        ? "text-[var(--brand-cyan)]"
        : accent === "gradient"
          ? "brand-gradient-text"
          : "text-[var(--brand-blue)]";

  return (
    <div className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-2xl p-5 relative overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition">
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
          <span className={`opacity-60 ${accentClass}`}>{icon}</span>
        )}
      </div>
      <div
        className={`font-display text-4xl tracking-tight leading-none ${accentClass}`}
      >
        {value}
      </div>
      {hint && (
        <p className="text-xs text-[var(--brand-fg-muted)] mt-2">{hint}</p>
      )}
    </div>
  );
}
