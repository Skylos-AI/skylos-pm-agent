import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/current-user";
import { getPipelineBoard } from "@/lib/data/pipeline";
import { KanbanBoard } from "@/components/pm/kanban-board";
import { t } from "@/lib/i18n/es";

export default async function PipelinePage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { deals, owners } = await getPipelineBoard();

  return (
    <div className="min-h-screen p-8 lg:p-10">
      <header className="mb-6">
        <h1 className="font-display text-4xl tracking-tight">
          {t.pipeline.title}
        </h1>
      </header>
      <KanbanBoard initialDeals={deals} owners={owners} />
    </div>
  );
}
