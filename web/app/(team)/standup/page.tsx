import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/current-user";
import { getStandupData, type StandupTask } from "@/lib/data/standup";
import { SectionCard, EmptyRow } from "@/components/pm/section-card";
import { CopyButton } from "@/components/pm/copy-button";
import { TaskStatusPill } from "@/components/pm/status-pill";
import { formatBob } from "@/lib/format/currency";
import { formatDate, formatRelative } from "@/lib/format/date";
import { t } from "@/lib/i18n/es";

export default async function StandupPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const data = await getStandupData(user.id, user.full_name);

  return (
    <div className="min-h-screen p-8 lg:p-10 space-y-6">
      <header className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-4xl tracking-tight">
            {t.standup.title}
          </h1>
          <p className="text-sm text-[var(--brand-fg-muted)] mt-1">
            {t.standup.subtitle}
          </p>
        </div>
        <CopyButton text={data.summary_text} />
      </header>

      <pre className="bg-[var(--brand-bg)] border border-[var(--brand-border)] rounded-xl p-4 text-sm font-mono whitespace-pre-wrap">
        {data.summary_text}
      </pre>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title={t.standup.dueToday} count={data.due_today.length}>
          <TaskList tasks={data.due_today} />
        </SectionCard>
        <SectionCard title={t.standup.overdue} count={data.overdue.length}>
          <TaskList tasks={data.overdue} />
        </SectionCard>
        <SectionCard title={t.standup.inProgress} count={data.in_progress.length}>
          <TaskList tasks={data.in_progress} />
        </SectionCard>
        <SectionCard title={t.standup.blocked} count={data.blocked.length}>
          <TaskList tasks={data.blocked} />
        </SectionCard>
        <SectionCard
          title={t.standup.completedYesterday}
          count={data.completed_yesterday.length}
        >
          <TaskList tasks={data.completed_yesterday} />
        </SectionCard>
        <SectionCard
          title={t.standup.pipelineYesterday}
          count={data.pipeline_moves_yesterday.length}
        >
          {data.pipeline_moves_yesterday.length === 0 ? (
            <EmptyRow>{t.standup.emptyDeals}</EmptyRow>
          ) : (
            <ul className="divide-y divide-[var(--brand-border)]">
              {data.pipeline_moves_yesterday.map((d) => (
                <li
                  key={d.id}
                  className="py-3 flex items-start justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{d.title}</p>
                    {d.company && (
                      <Link
                        href={`/companies/${d.company.id}`}
                        className="text-xs text-[var(--brand-fg-muted)] hover:text-[var(--brand-blue)] truncate"
                      >
                        {d.company.name}
                      </Link>
                    )}
                  </div>
                  <div className="text-right text-xs shrink-0">
                    <p className="font-medium">
                      {t.stage[d.stage as keyof typeof t.stage] ?? d.stage}
                    </p>
                    <p className="text-[var(--brand-fg-muted)]">
                      {formatBob(d.value_bob)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title={t.standup.recentActivity}
        count={data.recent_activity.length}
      >
        {data.recent_activity.length === 0 ? (
          <EmptyRow>{t.standup.emptyActivity}</EmptyRow>
        ) : (
          <ul className="divide-y divide-[var(--brand-border)]">
            {data.recent_activity.map((a) => (
              <li key={a.id} className="py-3">
                <p className="text-sm">{a.description}</p>
                <p className="text-xs text-[var(--brand-fg-muted)] mt-1">
                  {a.company?.name ?? "—"} · {a.type} ·{" "}
                  {formatRelative(a.occurred_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function TaskList({ tasks }: { tasks: StandupTask[] }) {
  if (tasks.length === 0) return <EmptyRow>{t.standup.empty}</EmptyRow>;
  return (
    <ul className="divide-y divide-[var(--brand-border)]">
      {tasks.map((task) => (
        <li key={task.id} className="py-3 flex items-start gap-3">
          <TaskStatusPill
            status={task.status as "TODO" | "IN_PROGRESS" | "BLOCKED" | "DONE"}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{task.title}</p>
            {task.project && (
              <Link
                href={`/projects/${task.project.id}`}
                className="text-xs text-[var(--brand-fg-muted)] hover:text-[var(--brand-blue)] truncate"
              >
                {task.project.name}
              </Link>
            )}
          </div>
          {task.due_date && (
            <span className="text-xs text-[var(--brand-fg-muted)] shrink-0">
              {formatDate(task.due_date)}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
