import { Skeleton, SkeletonTable } from "@/components/ui/skeleton";

export default function AssetsLoading() {
  return (
    <div className="min-h-screen p-8 lg:p-10 space-y-6 max-w-5xl">
      <header className="space-y-2">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-4 w-2/3" />
      </header>
      <SkeletonTable columns={["28%", "14%", "12%", "16%", "16%", "14%"]} rows={5} />
    </div>
  );
}
