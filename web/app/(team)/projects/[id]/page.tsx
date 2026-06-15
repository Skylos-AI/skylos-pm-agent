import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { currentUser } from "@/lib/auth/current-user";
import { getProjectDetail } from "@/lib/data/projects";
import { ProjectProgressStrip } from "@/components/pm/project-progress-strip";
import { ProjectTaskRow } from "@/components/pm/project-task-row";
import { NewTaskButton } from "@/components/pm/new-task-button";
import { SectionCard, EmptyRow } from "@/components/pm/section-card";
import { StatusPill } from "@/components/pm/status-pill";
import { formatBob } from "@/lib/format/currency";
import { formatDate, formatRelative } from "@/lib/format/date";
import { t } from "@/lib/i18n/es";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const project = await getProjectDetail(id);
  if (!project) notFound();

  return (
    <div className="min-h-screen p-8 lg:p-10 space-y-6">
      <header className="space-y-3">
        <Link
          href="/projects"
          className="text-xs text-[var(--brand-fg-muted)] hover:text-[var(--brand-fg)]"
        >
          ← {t.projects.title}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl tracking-tight">
              {project.name}
            </h1>
            <p className="text-sm text-[var(--brand-fg-muted)] mt-1">
              {project.company?.name ?? "—"} ·{" "}
              {t.serviceType[
                project.service_type as keyof typeof t.serviceType
              ] ?? project.service_type}
              {project.owner ? ` · ${project.owner.full_name}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusPill status={project.status} />
            <span className="text-sm font-medium">
              {formatBob(project.value_bob)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-[var(--brand-fg-muted)]">
          {project.start_date && (
            <span>Inicio: {formatDate(project.start_date)}</span>
          )}
          {project.target_end_date && (
            <span>Objetivo: {formatDate(project.target_end_date)}</span>
          )}
          {project.actual_end_date && (
            <span>Cierre: {formatDate(project.actual_end_date)}</span>
          )}
        </div>
      </header>

      <ProjectProgressStrip
        progressPct={project.progress_pct}
        pace={project.pace}
        daysToTargetEnd={project.days_to_target_end}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard
          title={t.projects.sectionBlockers}
          count={project.blockers.length}
        >
          {project.blockers.length === 0 ? (
            <EmptyRow>{t.projects.noBlockers}</EmptyRow>
          ) : (
            <ul className="divide-y divide-[var(--brand-border)]">
              {project.blockers.map((b) => (
                <li key={b.id} className="py-2 text-sm">
                  🚧 {b.title}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title={t.projects.sectionMilestones}
          count={project.upcoming_milestones.length}
        >
          {project.upcoming_milestones.length === 0 ? (
            <EmptyRow>{t.projects.noMilestones}</EmptyRow>
          ) : (
            <ul className="divide-y divide-[var(--brand-border)]">
              {project.upcoming_milestones.map((m) => (
                <li
                  key={m.id}
                  className="py-2 flex items-baseline justify-between gap-3"
                >
                  <span className="text-sm truncate">{m.title}</span>
                  <span className="text-xs text-[var(--brand-fg-muted)] shrink-0">
                    {m.days_until === 0
                      ? "hoy"
                      : m.days_until === 1
                        ? "mañana"
                        : `en ${m.days_until}d`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <section className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg tracking-tight">
            {t.projects.sectionTasksOpen}
          </h2>
          <NewTaskButton projectId={project.id} />
        </div>
        {project.tasks_open.length === 0 ? (
          <EmptyRow>{t.projects.noOpenTasks}</EmptyRow>
        ) : (
          <ul className="divide-y divide-[var(--brand-border)]">
            {project.tasks_open.map((task) => (
              <ProjectTaskRow key={task.id} task={task} />
            ))}
          </ul>
        )}

        {project.tasks_done.length > 0 && (
          <details className="mt-6">
            <summary className="text-sm text-[var(--brand-fg-muted)] cursor-pointer">
              {t.projects.sectionTasksDone} ({project.tasks_done.length})
            </summary>
            <ul className="divide-y divide-[var(--brand-border)] mt-2">
              {project.tasks_done.map((task) => (
                <ProjectTaskRow key={task.id} task={task} />
              ))}
            </ul>
          </details>
        )}
      </section>

      <SectionCard
        title={t.projects.sectionActivity}
        count={project.recent_activities.length}
      >
        {project.recent_activities.length === 0 ? (
          <EmptyRow>{t.projects.noActivity}</EmptyRow>
        ) : (
          <ul className="divide-y divide-[var(--brand-border)]">
            {project.recent_activities.map((a) => (
              <li key={a.id} className="py-3">
                <p className="text-sm">{a.description}</p>
                <p className="text-xs text-[var(--brand-fg-muted)] mt-1">
                  {a.type} · {a.channel} · {formatRelative(a.occurred_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
