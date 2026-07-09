import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";

export default function AgentLogLoading() {
  return (
    <div className="min-h-screen p-8 lg:p-10">
      <header className="mb-6 flex items-end justify-between">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-3 w-24" />
      </header>
      <SkeletonTable
        columns={["3%", "14%", "30%", "12%", "14%", "12%", "10%"]}
        rows={9}
      />
    </div>
  );
}
