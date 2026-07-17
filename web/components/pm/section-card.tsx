import { ReactNode } from "react";

export function SectionCard({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <section className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-2xl p-5 [box-shadow:var(--shadow-card)] hover:[box-shadow:var(--shadow-card-hover)] transition duration-200">
      <header className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg tracking-tight">{title}</h2>
        {count !== undefined && (
          <span className="text-xs text-[var(--brand-fg-muted)] tabular-nums bg-[var(--brand-fg)]/[0.05] rounded-full px-2 py-0.5 min-w-6 text-center">
            {count}
          </span>
        )}
      </header>
      {children}
    </section>
  );
}

export function EmptyRow({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm text-[var(--brand-fg-muted)] py-4 text-center bg-[var(--brand-fg)]/[0.02] border border-dashed border-[var(--brand-border)] rounded-xl">
      {children}
    </p>
  );
}
