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
    <section className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-2xl p-5 shadow-sm hover:shadow-md transition">
      <header className="flex items-baseline justify-between mb-4">
        <h2 className="font-display text-lg tracking-tight">{title}</h2>
        {count !== undefined && (
          <span className="text-xs text-[var(--brand-fg-muted)] tabular-nums">
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
    <p className="text-sm text-[var(--brand-fg-muted)] py-2">{children}</p>
  );
}
