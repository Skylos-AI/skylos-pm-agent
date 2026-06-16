"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { t } from "@/lib/i18n/es";
import type { CompanyPhase } from "@/lib/types/companies";

const TABS: { key: CompanyPhase; label: string; hint: string }[] = [
  {
    key: "outreach",
    label: t.companies.phaseOutreach,
    hint: t.companies.phaseOutreachHint,
  },
  {
    key: "clientes",
    label: t.companies.phaseClientes,
    hint: t.companies.phaseClientesHint,
  },
  {
    key: "todos",
    label: t.companies.phaseAll,
    hint: t.companies.phaseAllHint,
  },
];

export function PhaseTabs({
  counts,
}: {
  counts: Record<CompanyPhase, number>;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const current: CompanyPhase =
    (sp.get("phase") as CompanyPhase) || "outreach";

  function select(phase: CompanyPhase) {
    const next = new URLSearchParams(sp.toString());
    next.set("phase", phase);
    router.push(`/companies?${next.toString()}`);
  }

  const activeHint = TABS.find((tt) => tt.key === current)?.hint ?? "";

  return (
    <div className="mb-4">
      <div className="flex gap-1.5 mb-1.5">
        {TABS.map((tt) => {
          const on = tt.key === current;
          return (
            <button
              key={tt.key}
              type="button"
              onClick={() => select(tt.key)}
              className={`px-4 py-2 text-sm rounded-md border transition ${
                on
                  ? "bg-[var(--brand-blue)] text-white border-[var(--brand-blue)]"
                  : "bg-white text-[var(--brand-fg-muted)] border-[var(--brand-border)] hover:text-[var(--brand-fg)]"
              }`}
            >
              {tt.label}{" "}
              <span className="text-xs opacity-70">({counts[tt.key]})</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-[var(--brand-fg-muted)] italic">{activeHint}</p>
    </div>
  );
}
