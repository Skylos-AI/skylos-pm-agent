import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/current-user";
import { getDashboardData } from "@/lib/data/dashboard";
import { StatCard } from "@/components/pm/stat-card";
import { SectionCard, EmptyRow } from "@/components/pm/section-card";
import { formatBob } from "@/lib/format/currency";
import { formatDate, formatRelative } from "@/lib/format/date";
import { t } from "@/lib/i18n/es";
import {
  ListTodo,
  AlertTriangle,
  TrendingUp,
  CircleDollarSign,
} from "lucide-react";

export default async function DashboardPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const data = await getDashboardData(user.id);

  const firstName = user.full_name.split(" ")[0];

  return (
    <div className="min-h-screen p-8 lg:p-10">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-sm text-[var(--brand-fg-muted)] mb-1">
            Hola, {firstName}
          </p>
          <h1 className="font-display text-4xl tracking-tight">
            {t.dashboard.title}
          </h1>
        </div>
        <span className="text-xs text-[var(--brand-fg-muted)] uppercase tracking-wide">
          {formatDate(new Date())}
        </span>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label={t.dashboard.statTasksOpen}
          value={data.stats.open_tasks}
          accent="blue"
          icon={<ListTodo size={18} />}
        />
        <StatCard
          label={t.dashboard.statTasksOverdue}
          value={data.stats.overdue_tasks}
          accent={data.stats.overdue_tasks > 0 ? "magenta" : "blue"}
          icon={<AlertTriangle size={18} />}
        />
        <StatCard
          label={t.dashboard.statPipelineValue}
          value={formatBob(data.stats.pipeline_value_bob)}
          accent="gradient"
          icon={<CircleDollarSign size={18} />}
        />
        <StatCard
          label={t.dashboard.statDealsInMotion}
          value={data.stats.deals_in_motion}
          accent="cyan"
          icon={<TrendingUp size={18} />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard
          title={t.dashboard.dueToday}
          count={data.due_today.length}
        >
          {data.due_today.length === 0 ? (
            <EmptyRow>{t.dashboard.emptyTasks}</EmptyRow>
          ) : (
            <ul className="divide-y divide-[var(--brand-border)]">
              {data.due_today.map((task) => (
                <li key={task.id} className="py-3 flex items-start gap-3">
                  <span
                    className={`mt-1 inline-block w-2 h-2 rounded-full ${
                      task.priority === "URGENT" || task.priority === "HIGH"
                        ? "bg-[var(--brand-magenta)]"
                        : "bg-[var(--brand-blue)]"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    {task.project && (
                      <p className="text-xs text-[var(--brand-fg-muted)] truncate">
                        {task.project.name}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-[var(--brand-fg-muted)] shrink-0">
                    {task.status === "BLOCKED"
                      ? "🚧 " + t.status.BLOCKED
                      : t.status[task.status as keyof typeof t.status] ?? ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title={t.dashboard.pipelineMoves}
          count={data.pipeline_moves.length}
        >
          {data.pipeline_moves.length === 0 ? (
            <EmptyRow>{t.dashboard.emptyDeals}</EmptyRow>
          ) : (
            <ul className="divide-y divide-[var(--brand-border)]">
              {data.pipeline_moves.map((deal) => (
                <li key={deal.id} className="py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {deal.title}
                    </p>
                    {deal.company && (
                      <p className="text-xs text-[var(--brand-fg-muted)] truncate">
                        {deal.company.name}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-medium">
                      {t.stage[deal.stage as keyof typeof t.stage] ?? deal.stage}
                    </p>
                    <p className="text-xs text-[var(--brand-fg-muted)]">
                      {formatBob(deal.value_bob)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title={t.dashboard.recentActivity}
          count={data.recent_activity.length}
        >
          {data.recent_activity.length === 0 ? (
            <EmptyRow>{t.dashboard.emptyActivity}</EmptyRow>
          ) : (
            <ul className="divide-y divide-[var(--brand-border)]">
              {data.recent_activity.map((act) => (
                <li key={act.id} className="py-3">
                  <p className="text-sm">{act.description}</p>
                  <p className="text-xs text-[var(--brand-fg-muted)] mt-1">
                    {act.company?.name ?? "—"} · {act.type} ·{" "}
                    {formatRelative(act.occurred_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title={t.dashboard.remindersToday}
          count={data.reminders_today.length}
        >
          {data.reminders_today.length === 0 ? (
            <EmptyRow>{t.dashboard.emptyReminders}</EmptyRow>
          ) : (
            <ul className="divide-y divide-[var(--brand-border)]">
              {data.reminders_today.map((r) => (
                <li key={r.id} className="py-3">
                  <p className="text-sm">{r.message}</p>
                  <p className="text-xs text-[var(--brand-fg-muted)] mt-1">
                    {formatDate(r.trigger_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
