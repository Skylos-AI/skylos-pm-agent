import {
  Skeleton,
  SkeletonSectionCard,
  SkeletonStatCard,
} from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="min-h-screen p-8 lg:p-10">
      <header className="mb-8 flex items-end justify-between">
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-12 w-80" />
        </div>
        <Skeleton className="h-3 w-28" />
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonSectionCard rows={4} />
        <SkeletonSectionCard rows={4} />
        <SkeletonSectionCard rows={3} />
        <SkeletonSectionCard rows={3} />
      </div>
    </div>
  );
}
