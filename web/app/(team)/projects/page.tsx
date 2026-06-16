import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/current-user";
import { getProjectsList, type ProjectStatus } from "@/lib/data/projects";
import { ProjectsFilterBar } from "@/components/pm/projects-filter-bar";
import { StatusPill, PaceBadge } from "@/components/pm/status-pill";
import { formatDate } from "@/lib/format/date";
import { t } from "@/lib/i18n/es";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; owner?: string; service?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const filters = {
    status: (sp.status as ProjectStatus) || undefined,
    ownerId: sp.owner || undefined,
    serviceType: sp.service || undefined,
  };
  const { projects, owners } = await getProjectsList(filters);

  return (
    <div className="min-h-screen p-8 lg:p-10">
      <header className="mb-6 flex items-end justify-between">
        <h1 className="font-display text-5xl tracking-tight leading-tight">
          {t.projects.title}
        </h1>
        <span className="text-xs text-[var(--brand-fg-muted)]">
          {projects.length} {projects.length === 1 ? "proyecto" : "proyectos"}
        </span>
      </header>
      <ProjectsFilterBar owners={owners} />

      <div className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-xl overflow-hidden">
        {projects.length === 0 ? (
          <p className="p-8 text-sm text-[var(--brand-fg-muted)] text-center">
            {t.projects.empty}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--brand-bg)]">
              <tr className="text-xs uppercase tracking-wide text-[var(--brand-fg-muted)]">
                <th className="text-left px-4 py-3 font-medium">
                  {t.projects.columnName}
                </th>
                <th className="text-left px-4 py-3 font-medium">
                  {t.projects.columnCompany}
                </th>
                <th className="text-left px-4 py-3 font-medium">
                  {t.projects.columnStatus}
                </th>
                <th className="text-left px-4 py-3 font-medium">
                  {t.projects.columnOwner}
                </th>
                <th className="text-left px-4 py-3 font-medium">
                  {t.projects.columnProgress}
                </th>
                <th className="text-left px-4 py-3 font-medium">
                  {t.projects.columnPace}
                </th>
                <th className="text-left px-4 py-3 font-medium">
                  {t.projects.columnTarget}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--brand-border)]">
              {projects.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-[var(--brand-bg)] transition cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/projects/${p.id}`}
                      className="font-medium text-[var(--brand-fg)] hover:text-[var(--brand-blue)]"
                    >
                      {p.name}
                    </Link>
                    <p className="text-xs text-[var(--brand-fg-muted)]">
                      {t.serviceType[
                        p.service_type as keyof typeof t.serviceType
                      ] ?? p.service_type}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-[var(--brand-fg-muted)]">
                    {p.company?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill status={p.status} />
                  </td>
                  <td className="px-4 py-3 text-[var(--brand-fg-muted)]">
                    {p.owner?.full_name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 rounded-full bg-[var(--brand-bg)] overflow-hidden">
                        <div
                          className="h-full"
                          style={{
                            width: `${p.progress_pct}%`,
                            background: "var(--brand-gradient)",
                          }}
                        />
                      </div>
                      <span className="text-xs">{p.progress_pct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <PaceBadge pace={p.pace} />
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--brand-fg-muted)]">
                    {formatDate(p.target_end_date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
