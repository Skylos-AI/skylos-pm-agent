import { ReactNode } from "react";

export type PillTone = "blue" | "cyan" | "magenta" | "neutral" | "dark";

const TONE_CLASS: Record<PillTone, string> = {
  blue: "bg-[var(--brand-blue)]/[0.08] text-[var(--brand-blue)] ring-[var(--brand-blue)]/15",
  cyan: "bg-[var(--brand-cyan)]/[0.12] text-[var(--brand-cyan-text)] ring-[var(--brand-cyan)]/25",
  magenta:
    "bg-[var(--brand-magenta)]/[0.08] text-[var(--brand-magenta)] ring-[var(--brand-magenta)]/15",
  neutral:
    "bg-[var(--brand-fg-muted)]/[0.08] text-[var(--brand-fg-muted)] ring-[var(--brand-fg-muted)]/15",
  dark: "bg-[var(--brand-fg)]/[0.06] text-[var(--brand-fg)] ring-[var(--brand-fg)]/10",
};

export function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 pl-2 pr-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${TONE_CLASS[tone]}`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full bg-current opacity-70 shrink-0"
        aria-hidden
      />
      {children}
    </span>
  );
}
