import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/current-user";
import { getCompaniesList } from "@/lib/data/companies";
import type { CompanyStatus } from "@/lib/types/companies";
import { CompaniesFilterBar } from "@/components/pm/companies-filter-bar";
import { CompanyStatusPill } from "@/components/pm/company-status-pill";
import { t } from "@/lib/i18n/es";

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    sector?: string;
    department?: string;
    owner?: string;
  }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const { companies, owners, sectors, departments } = await getCompaniesList({
    q: sp.q,
    status: (sp.status as CompanyStatus) || undefined,
    sector: sp.sector,
    department: sp.department,
    assignedToId: sp.owner,
  });

  return (
    <div className="min-h-screen p-8 lg:p-10">
      <header className="mb-6 flex items-end justify-between">
        <h1 className="font-display text-4xl tracking-tight">
          {t.companies.title}
        </h1>
        <span className="text-xs text-[var(--brand-fg-muted)]">
          {companies.length} {companies.length === 1 ? "empresa" : "empresas"}
        </span>
      </header>
      <CompaniesFilterBar
        owners={owners}
        sectors={sectors}
        departments={departments}
      />

      <div className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-xl overflow-hidden">
        {companies.length === 0 ? (
          <p className="p-8 text-sm text-[var(--brand-fg-muted)] text-center">
            {t.companies.empty}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--brand-bg)]">
              <tr className="text-xs uppercase tracking-wide text-[var(--brand-fg-muted)]">
                <th className="text-left px-4 py-3 font-medium">
                  {t.companies.columnName}
                </th>
                <th className="text-left px-4 py-3 font-medium">
                  {t.companies.columnNit}
                </th>
                <th className="text-left px-4 py-3 font-medium">
                  {t.companies.columnSector}
                </th>
                <th className="text-left px-4 py-3 font-medium">
                  {t.companies.columnDept}
                </th>
                <th className="text-left px-4 py-3 font-medium">
                  {t.companies.columnStatus}
                </th>
                <th className="text-left px-4 py-3 font-medium">
                  {t.companies.columnOwner}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--brand-border)]">
              {companies.map((c) => (
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
                    {c.city && (
                      <p className="text-xs text-[var(--brand-fg-muted)]">
                        {c.city}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[var(--brand-fg-muted)]">
                    {c.nit ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--brand-fg-muted)]">
                    {c.sector ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--brand-fg-muted)]">
                    {c.department ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <CompanyStatusPill status={c.status} />
                  </td>
                  <td className="px-4 py-3 text-[var(--brand-fg-muted)]">
                    {c.assigned_to?.full_name ?? "—"}
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
