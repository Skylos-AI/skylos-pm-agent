import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/current-user";
import { getMyTasks } from "@/lib/data/tasks";
import { TasksQueue } from "@/components/pm/tasks-queue";
import { t } from "@/lib/i18n/es";

export default async function TasksPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const tasks = await getMyTasks(user.id);
  const openCount = tasks.filter((row) => row.status !== "DONE").length;

  return (
    <div className="min-h-screen p-8 lg:p-10">
      <header className="mb-6 flex items-end justify-between">
        <h1 className="font-display text-5xl tracking-tight leading-tight">
          {t.tasks.title}
        </h1>
        <span className="text-xs text-[var(--brand-fg-muted)]">
          {t.tasks.countOpen(openCount)}
        </span>
      </header>
      <TasksQueue initialTasks={tasks} />
    </div>
  );
}
