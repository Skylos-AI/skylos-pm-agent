import { Skeleton } from "@/components/ui/skeleton";

export default function ActivityLoading() {
  return (
    <div className="min-h-screen p-8 lg:p-10">
      <header className="mb-6">
        <Skeleton className="h-12 w-56" />
      </header>
      <div className="flex flex-wrap gap-2 mb-4">
        <Skeleton className="h-8 w-32 rounded-lg" />
        <Skeleton className="h-8 w-32 rounded-lg" />
        <Skeleton className="h-8 w-28 rounded-lg" />
        <Skeleton className="h-8 w-24 rounded-lg" />
        <Skeleton className="h-8 w-28 rounded-lg" />
      </div>
      <div className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-xl divide-y divide-[var(--brand-border)]">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="px-5 py-4 flex items-start gap-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-3 w-20 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
