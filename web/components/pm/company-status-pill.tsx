import { t } from "@/lib/i18n/es";
import type { CompanyStatus } from "@/lib/types/companies";
import { Pill, type PillTone } from "@/components/pm/pill";

export function CompanyStatusPill({ status }: { status: CompanyStatus }) {
  const tone: PillTone =
    status === "ACTIVE_CLIENT"
      ? "cyan"
      : status === "PROSPECT"
        ? "blue"
        : status === "LEAD"
          ? "neutral"
          : status === "PAST_CLIENT"
            ? "dark"
            : "magenta";
  return <Pill tone={tone}>{t.companyStatus[status]}</Pill>;
}
