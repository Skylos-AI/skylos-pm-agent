import { Skeleton, SkeletonSectionCard } from "@/components/ui/skeleton";

export default function StandupLoading() {
  return (
    <div className="min-h-screen p-8 lg:p-10">
      <header className="mb-8 space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-12 w-72" />
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonSectionCard rows={4} />
        <SkeletonSectionCard rows={4} />
        <SkeletonSectionCard rows={3} />
        <SkeletonSectionCard rows={3} />
      </div>
    </div>
  );
}
