import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";

export default function CompaniesLoading() {
  return (
    <div className="min-h-screen p-8 lg:p-10">
      <header className="mb-6 flex items-end justify-between">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-3 w-24" />
      </header>
      <div className="flex flex-wrap gap-2 mb-4">
        <Skeleton className="h-8 w-32 rounded-lg" />
        <Skeleton className="h-8 w-28 rounded-lg" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
      <SkeletonTable
        columns={["22%", "16%", "14%", "14%", "16%", "12%"]}
        rows={7}
      />
    </div>
  );
}
