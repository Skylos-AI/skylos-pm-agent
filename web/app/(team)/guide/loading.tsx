import { Skeleton } from "@/components/ui/skeleton";

export default function GuideLoading() {
  return (
    <div className="min-h-screen p-8 lg:p-10">
      <header className="mb-8 space-y-3">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-3 w-1/2" />
      </header>
      <div className="space-y-6 max-w-3xl">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-xl p-6 space-y-3"
          >
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
