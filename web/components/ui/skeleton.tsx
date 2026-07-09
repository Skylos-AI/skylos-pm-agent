import { HTMLAttributes } from "react";

type SkeletonProps = HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className = "", style, ...rest }: SkeletonProps) {
  return (
    <div
      className={`skeleton-shimmer ${className}`}
      style={style}
      aria-hidden="true"
      {...rest}
    />
  );
}

export function SkeletonText({
  width = "100%",
  className = "",
}: {
  width?: string | number;
  className?: string;
}) {
  return (
    <Skeleton
      className={`h-3.5 ${className}`}
      style={{ width: typeof width === "number" ? `${width}px` : width }}
    />
  );
}

export function SkeletonStatCard() {
  return (
    <div className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-5 rounded-md" />
      </div>
      <Skeleton className="h-9 w-28" />
    </div>
  );
}

export function SkeletonSectionCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-xl">
      <div className="flex items-center justify-between border-b border-[var(--brand-border)] px-5 py-4">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-8" />
      </div>
      <ul className="divide-y divide-[var(--brand-border)]">
        {Array.from({ length: rows }).map((_, i) => (
          <li key={i} className="px-5 py-3 flex items-start gap-3">
            <Skeleton className="mt-1 h-2 w-2 rounded-full" />
            <div className="flex-1 min-w-0 space-y-2">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-3 w-16 shrink-0" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SkeletonTable({
  columns,
  rows = 6,
}: {
  columns: Array<string | number>;
  rows?: number;
}) {
  return (
    <div className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-xl overflow-hidden">
      <div className="bg-[var(--brand-bg)] px-4 py-3 flex items-center gap-4">
        {columns.map((w, i) => (
          <Skeleton
            key={i}
            className="h-3"
            style={{ width: typeof w === "number" ? `${w}px` : w }}
          />
        ))}
      </div>
      <ul className="divide-y divide-[var(--brand-border)]">
        {Array.from({ length: rows }).map((_, r) => (
          <li key={r} className="px-4 py-4 flex items-center gap-4">
            {columns.map((w, c) => (
              <Skeleton
                key={c}
                className="h-3.5"
                style={{
                  width: typeof w === "number" ? `${w}px` : w,
                  opacity: 0.85,
                }}
              />
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SkeletonKanbanColumn({ cards = 3 }: { cards?: number }) {
  return (
    <div className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-xl p-3 min-w-[260px] space-y-3">
      <div className="flex items-center justify-between px-1 pb-2 border-b border-[var(--brand-border)]">
        <Skeleton className="h-3.5 w-24" />
        <Skeleton className="h-3 w-6" />
      </div>
      {Array.from({ length: cards }).map((_, i) => (
        <div
          key={i}
          className="bg-[var(--brand-bg)] border border-[var(--brand-border)] rounded-lg p-3 space-y-2"
        >
          <Skeleton className="h-3.5 w-5/6" />
          <Skeleton className="h-3 w-1/2" />
          <div className="flex items-center gap-2 pt-1">
            <Skeleton className="h-4 w-12 rounded-full" />
            <Skeleton className="h-4 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonPageHeader({
  withMeta = true,
}: {
  withMeta?: boolean;
}) {
  return (
    <header className="mb-8 flex items-end justify-between">
      <div className="space-y-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-10 w-72" />
      </div>
      {withMeta && <Skeleton className="h-3 w-24" />}
    </header>
  );
}
