import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { currentUser } from "@/lib/auth/current-user";
import { getCompanyDetail } from "@/lib/data/companies";
import { CompanyStatusPill } from "@/components/pm/company-status-pill";
import { SectionCard, EmptyRow } from "@/components/pm/section-card";
import { OutreachButton } from "@/components/pm/outreach-drawer";
import { LogActivityButton } from "@/components/pm/log-activity-button";
import {
  ConvertToClientButton,
  NewProjectButton,
} from "@/components/pm/company-phase-actions";
import { formatBob } from "@/lib/format/currency";
import { formatDate, formatRelative } from "@/lib/format/date";
import { t } from "@/lib/i18n/es";

function waHref(num: string | null): string | null {
  if (!num) return null;
  const digits = num.replace(/[^\d]/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const company = await getCompanyDetail(id);
  if (!company) notFound();

  const contactsForLog = company.contacts.map((c) => ({
    id: c.id,
    full_name: c.full_name,
  }));
  const contactsForOutreach = company.contacts.map((c) => ({
    id: c.id,
    full_name: c.full_name,
    whatsapp: c.whatsapp,
    email: c.email,
    is_primary: c.is_primary,
  }));

  return (
    <div className="min-h-screen p-8 lg:p-10 space-y-6">
      <header className="space-y-3">
        <Link
          href="/companies"
          className="text-xs text-[var(--brand-fg-muted)] hover:text-[var(--brand-fg)]"
        >
          ← {t.companies.title}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl tracking-tight">
              {company.name}
            </h1>
            <p className="text-sm text-[var(--brand-fg-muted)] mt-1">
              {company.nit ? `NIT ${company.nit} · ` : ""}
              {company.sector ?? "—"}
              {company.department ? ` · ${company.department}` : ""}
              {company.city ? ` · ${company.city}` : ""}
            </p>
            <p className="text-xs text-[var(--brand-fg-muted)] mt-1">
              {company.assigned_to
                ? `Dueño: ${company.assigned_to.full_name}`
                : "Sin dueño asignado"}
              {company.primary_persona
                ? ` · Persona: ${company.primary_persona.name}`
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CompanyStatusPill status={company.status} />
            {company.website && (
              <a
                href={company.website}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[var(--brand-blue)] hover:underline"
              >
                {t.companies.siteLink} ↗
              </a>
            )}
            <OutreachButton
              companyName={company.name}
              contacts={contactsForOutreach}
              persona={company.primary_persona}
            />
            <LogActivityButton companyId={company.id} contacts={contactsForLog} />
            <ConvertToClientButton
              companyId={company.id}
              currentStatus={company.status}
            />
            <NewProjectButton
              companyId={company.id}
              currentStatus={company.status}
            />
          </div>
        </div>
        {company.notes && (
          <p className="text-sm text-[var(--brand-fg)] bg-[var(--brand-bg)] rounded-md px-3 py-2">
            {company.notes}
          </p>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard
          title={t.companies.sectionContacts}
          count={company.contacts.length}
        >
          {company.contacts.length === 0 ? (
            <EmptyRow>{t.companies.noContacts}</EmptyRow>
          ) : (
            <ul className="divide-y divide-[var(--brand-border)]">
              {company.contacts.map((c) => {
                const wa = waHref(c.whatsapp ?? c.phone);
                return (
                  <li key={c.id} className="py-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {c.full_name}
                        {c.is_primary && (
                          <span className="ml-2 text-xs text-[var(--brand-blue)]">
                            · {t.companies.contactPrimary}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-[var(--brand-fg-muted)] truncate">
                        {c.role ?? "—"}
                        {c.email ? ` · ${c.email}` : ""}
                      </p>
                    </div>
                    {wa && (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-[var(--brand-blue)] hover:underline shrink-0"
                      >
                        {t.companies.waLink} ↗
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title={t.companies.sectionSuggestions}
          count={company.next_actions_suggested.length}
        >
          {company.next_actions_suggested.length === 0 ? (
            <EmptyRow>{t.companies.noSuggestions}</EmptyRow>
          ) : (
            <ul className="space-y-2">
              {company.next_actions_suggested.map((s, i) => (
                <li
                  key={i}
                  className="text-sm bg-[var(--brand-blue)]/5 text-[var(--brand-fg)] rounded-md px-3 py-2"
                >
                  → {s}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title={t.companies.sectionProjects}
          count={company.active_projects.length}
        >
          {company.active_projects.length === 0 ? (
            <EmptyRow>{t.companies.noProjects}</EmptyRow>
          ) : (
            <ul className="divide-y divide-[var(--brand-border)]">
              {company.active_projects.map((p) => (
                <li
                  key={p.id}
                  className="py-3 flex items-start justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/projects/${p.id}`}
                      className="text-sm font-medium hover:text-[var(--brand-blue)] truncate"
                    >
                      {p.name}
                    </Link>
                    <p className="text-xs text-[var(--brand-fg-muted)]">
                      {p.progress_summary}
                    </p>
                  </div>
                  <div className="text-right shrink-0 text-xs">
                    <p>{formatBob(p.value_bob)}</p>
                    <p className="text-[var(--brand-fg-muted)]">
                      {formatDate(p.target_end_date)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title={t.companies.sectionDeals}
          count={company.open_deals.length}
        >
          {company.open_deals.length === 0 ? (
            <EmptyRow>{t.companies.noDeals}</EmptyRow>
          ) : (
            <ul className="divide-y divide-[var(--brand-border)]">
              {company.open_deals.map((d) => (
                <li
                  key={d.id}
                  className="py-3 flex items-start justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{d.title}</p>
                    <p className="text-xs text-[var(--brand-fg-muted)]">
                      {t.stage[d.stage as keyof typeof t.stage] ?? d.stage}
                    </p>
                  </div>
                  <div className="text-right shrink-0 text-xs">
                    <p>{formatBob(d.value_bob)}</p>
                    {d.expected_close_date && (
                      <p className="text-[var(--brand-fg-muted)]">
                        → {formatDate(d.expected_close_date)}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title={t.companies.sectionActivity}
        count={company.recent_activities.length}
      >
        {company.recent_activities.length === 0 ? (
          <EmptyRow>{t.companies.noActivity}</EmptyRow>
        ) : (
          <ul className="divide-y divide-[var(--brand-border)]">
            {company.recent_activities.map((a) => (
              <li key={a.id} className="py-3">
                <p className="text-sm">{a.description}</p>
                <p className="text-xs text-[var(--brand-fg-muted)] mt-1">
                  {t.activityType[a.type as keyof typeof t.activityType] ??
                    a.type}{" "}
                  ·{" "}
                  {t.activityChannel[
                    a.channel as keyof typeof t.activityChannel
                  ] ?? a.channel}{" "}
                  · {formatRelative(a.occurred_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
