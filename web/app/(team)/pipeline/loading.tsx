import { Skeleton, SkeletonKanbanColumn } from "@/components/ui/skeleton";

export default function PipelineLoading() {
  return (
    <div className="min-h-screen p-8 lg:p-10">
      <header className="mb-6">
        <Skeleton className="h-10 w-56" />
      </header>
      <div className="flex gap-4 overflow-x-auto pb-2">
        <SkeletonKanbanColumn cards={3} />
        <SkeletonKanbanColumn cards={2} />
        <SkeletonKanbanColumn cards={4} />
        <SkeletonKanbanColumn cards={2} />
        <SkeletonKanbanColumn cards={1} />
      </div>
    </div>
  );
}
