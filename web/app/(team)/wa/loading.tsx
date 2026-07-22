import { Skeleton } from "@/components/ui/skeleton";

export default function WaLoading() {
  return (
    <div className="min-h-screen p-8 lg:p-10 space-y-6 max-w-6xl">
      <header className="space-y-2">
        <Skeleton className="h-12 w-96" />
        <Skeleton className="h-4 w-2/3" />
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-2xl p-5 space-y-3"
          >
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
