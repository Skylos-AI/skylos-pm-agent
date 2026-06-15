import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/current-user";
import { getActivityFeed } from "@/lib/data/activity";
import type {
  ActivityChannel,
  ActivityType,
} from "@/lib/types/activity";
import { ActivityFilterBar } from "@/components/pm/activity-filter-bar";
import { formatDateTime, formatRelative } from "@/lib/format/date";
import { t } from "@/lib/i18n/es";

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{
    company?: string;
    project?: string;
    user?: string;
    type?: string;
    channel?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const { activities, companies, projects, users } = await getActivityFeed({
    companyId: sp.company,
    projectId: sp.project,
    userId: sp.user,
    type: (sp.type as ActivityType) || undefined,
    channel: (sp.channel as ActivityChannel) || undefined,
    fromDate: sp.from ? new Date(sp.from).toISOString() : undefined,
    toDate: sp.to
      ? new Date(`${sp.to}T23:59:59`).toISOString()
      : undefined,
  });

  return (
    <div className="min-h-screen p-8 lg:p-10">
      <header className="mb-6 flex items-end justify-between">
        <h1 className="font-display text-4xl tracking-tight">
          {t.activity.title}
        </h1>
        <span className="text-xs text-[var(--brand-fg-muted)]">
          {activities.length}{" "}
          {activities.length === 1 ? "registro" : "registros"}
        </span>
      </header>
      <ActivityFilterBar
        companies={companies}
        projects={projects}
        users={users}
      />

      <div className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-xl overflow-hidden">
        {activities.length === 0 ? (
          <p className="p-8 text-sm text-[var(--brand-fg-muted)] text-center">
            {t.activity.empty}
          </p>
        ) : (
          <ul className="divide-y divide-[var(--brand-border)]">
            {activities.map((a) => (
              <li key={a.id} className="p-4 hover:bg-[var(--brand-bg)] transition">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{a.description}</p>
                    <p className="text-xs text-[var(--brand-fg-muted)] mt-1">
                      {t.activityType[a.type] ?? a.type} ·{" "}
                      {t.activityChannel[a.channel] ?? a.channel}
                      {a.company && (
                        <>
                          {" · "}
                          <Link
                            href={`/companies/${a.company.id}`}
                            className="hover:text-[var(--brand-blue)] underline-offset-2 hover:underline"
                          >
                            {a.company.name}
                          </Link>
                        </>
                      )}
                      {a.project && (
                        <>
                          {" · "}
                          <Link
                            href={`/projects/${a.project.id}`}
                            className="hover:text-[var(--brand-blue)] underline-offset-2 hover:underline"
                          >
                            {a.project.name}
                          </Link>
                        </>
                      )}
                      {a.logged_by && ` · ${a.logged_by.full_name}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0 text-xs text-[var(--brand-fg-muted)]">
                    <p>{formatRelative(a.occurred_at)}</p>
                    <p>{formatDateTime(a.occurred_at)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
