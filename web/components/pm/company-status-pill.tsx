import { t } from "@/lib/i18n/es";
import type { CompanyStatus } from "@/lib/types/companies";

export function CompanyStatusPill({ status }: { status: CompanyStatus }) {
  const color =
    status === "ACTIVE_CLIENT"
      ? "bg-[var(--brand-cyan)]/10 text-[var(--brand-cyan)]"
      : status === "PROSPECT"
        ? "bg-[var(--brand-blue)]/10 text-[var(--brand-blue)]"
        : status === "LEAD"
          ? "bg-[var(--brand-fg-muted)]/10 text-[var(--brand-fg-muted)]"
          : status === "PAST_CLIENT"
            ? "bg-[var(--brand-fg)]/5 text-[var(--brand-fg)]"
            : "bg-[var(--brand-magenta)]/10 text-[var(--brand-magenta)]";
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${color}`}
    >
      {t.companyStatus[status]}
    </span>
  );
}
