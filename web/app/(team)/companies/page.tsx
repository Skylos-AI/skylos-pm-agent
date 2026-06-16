import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/current-user";
import { getCompaniesList } from "@/lib/data/companies";
import type { CompanyPhase, CompanyStatus } from "@/lib/types/companies";
import { CompaniesFilterBar } from "@/components/pm/companies-filter-bar";
import { CompanyStatusPill } from "@/components/pm/company-status-pill";
import { PhaseTabs } from "@/components/pm/phase-tabs";
import { MarkContactedButton } from "@/components/pm/mark-contacted-button";
import { t } from "@/lib/i18n/es";

function waHref(num: string | null): string | null {
  if (!num) return null;
  const digits = num.replace(/[^\d]/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    phase?: string;
    sector?: string;
    department?: string;
    owner?: string;
  }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const phase: CompanyPhase =
    sp.phase === "clientes" || sp.phase === "todos" ? sp.phase : "outreach";

  // Fetch the active-phase view once for the table, plus a lean counts pull
  // so the tabs show real numbers (without re-running 3 full queries).
  const [active, allForCounts] = await Promise.all([
    getCompaniesList({
      q: sp.q,
      status: (sp.status as CompanyStatus) || undefined,
      phase,
      sector: sp.sector,
      department: sp.department,
      assignedToId: sp.owner,
    }),
    getCompaniesList({ phase: "todos" }),
  ]);

  const counts: Record<CompanyPhase, number> = {
    outreach: allForCounts.companies.filter(
      (c) => c.status === "LEAD" || c.status === "PROSPECT",
    ).length,
    clientes: allForCounts.companies.filter((c) => c.status === "ACTIVE_CLIENT")
      .length,
    todos: allForCounts.companies.length,
  };

  const { companies, owners, sectors, departments } = active;

  return (
    <div className="min-h-screen p-8 lg:p-10">
      <header className="mb-6 flex items-end justify-between">
        <h1 className="font-display text-5xl tracking-tight leading-tight">
          {t.companies.title}
        </h1>
        <span className="text-xs text-[var(--brand-fg-muted)]">
          {companies.length} {companies.length === 1 ? "empresa" : "empresas"}
        </span>
      </header>

      <PhaseTabs counts={counts} />

      <CompaniesFilterBar
        owners={owners}
        sectors={sectors}
        departments={departments}
      />

      <div className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-xl overflow-hidden">
        {companies.length === 0 ? (
          <p className="p-8 text-sm text-[var(--brand-fg-muted)] text-center">
            {phase === "clientes"
              ? t.companies.emptyClientes
              : phase === "outreach"
                ? t.companies.emptyOutreach
                : t.companies.empty}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--brand-bg)]">
              <tr className="text-xs uppercase tracking-wide text-[var(--brand-fg-muted)]">
                <th className="text-left px-4 py-3 font-medium">
                  {t.companies.columnName}
                </th>
                <th className="text-left px-4 py-3 font-medium">
                  {t.companies.columnSector}
                </th>
                <th className="text-left px-4 py-3 font-medium">
                  {t.companies.columnPhone}
                </th>
                <th className="text-left px-4 py-3 font-medium">
                  {t.companies.columnEmail}
                </th>
                <th className="text-left px-4 py-3 font-medium">
                  {t.companies.columnStatus}
                </th>
                <th className="text-left px-4 py-3 font-medium">
                  {t.companies.columnOwner}
                </th>
                {phase === "outreach" && (
                  <th className="text-left px-4 py-3 font-medium">
                    {t.activity.title}
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--brand-border)]">
              {companies.map((c) => {
                const wa = waHref(
                  c.primary_contact?.whatsapp ?? c.primary_contact?.phone ?? null,
                );
                const phoneText =
                  c.primary_contact?.whatsapp ?? c.primary_contact?.phone ?? null;
                const email = c.primary_contact?.email ?? null;
                return (
                  <tr
                    key={c.id}
                    className="hover:bg-[var(--brand-bg)] transition"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/companies/${c.id}`}
                        className="font-medium text-[var(--brand-fg)] hover:text-[var(--brand-blue)]"
                      >
                        {c.name}
                      </Link>
                      {c.department && (
                        <p className="text-xs text-[var(--brand-fg-muted)]">
                          {c.department}
                          {c.city ? ` · ${c.city}` : ""}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--brand-fg-muted)] text-xs">
                      {c.sector ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {phoneText ? (
                        wa ? (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[var(--brand-blue)] hover:underline"
                          >
                            {phoneText}
                          </a>
                        ) : (
                          phoneText
                        )
                      ) : (
                        <span className="text-[var(--brand-fg-muted)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {email ? (
                        <a
                          href={`mailto:${email}`}
                          className="text-[var(--brand-blue)] hover:underline"
                        >
                          {email}
                        </a>
                      ) : (
                        <span className="text-[var(--brand-fg-muted)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <CompanyStatusPill status={c.status} />
                    </td>
                    <td className="px-4 py-3 text-[var(--brand-fg-muted)] text-xs">
                      {c.assigned_to?.full_name ?? "—"}
                    </td>
                    {phase === "outreach" && (
                      <td className="px-4 py-3">
                        <MarkContactedButton companyId={c.id} />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
