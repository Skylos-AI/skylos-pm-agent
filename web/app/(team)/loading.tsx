import { Skeleton } from "@/components/ui/skeleton";

export default function TeamLoading() {
  return (
    <div className="min-h-screen p-8 lg:p-10">
      <header className="mb-8 space-y-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-10 w-72" />
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-xl p-6 space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </div>
        <div className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-xl p-6 space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </div>
      </div>
    </div>
  );
}
