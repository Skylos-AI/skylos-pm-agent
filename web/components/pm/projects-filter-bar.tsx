"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { t } from "@/lib/i18n/es";

const STATUSES = [
  "PLANNING",
  "ACTIVE",
  "ON_HOLD",
  "COMPLETED",
  "CANCELLED",
] as const;
const SERVICES = [
  "AI_AUDIT",
  "AUTOMATION",
  "CUSTOM_SOFTWARE",
  "BLOCKCHAIN_WEB3",
  "TRAINING",
  "RETAINER",
] as const;

export function ProjectsFilterBar({
  owners,
}: {
  owners: { id: string; full_name: string }[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const status = sp.get("status") ?? "";
  const owner = sp.get("owner") ?? "";
  const service = sp.get("service") ?? "";

  function update(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/projects?${next.toString()}`);
  }

  return (
    <div className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-xl p-4 mb-5 flex flex-wrap items-end gap-4">
      <label className="flex flex-col text-xs gap-1 text-[var(--brand-fg-muted)] uppercase tracking-wide">
        {t.projects.filterStatus}
        <select
          value={status}
          onChange={(e) => update("status", e.target.value)}
          className="text-sm border border-[var(--brand-border)] rounded-md px-2 py-1.5 bg-white min-w-[140px]"
        >
          <option value="">{t.pipeline.filterAll}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t.projectStatus[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-xs gap-1 text-[var(--brand-fg-muted)] uppercase tracking-wide">
        {t.projects.filterOwner}
        <select
          value={owner}
          onChange={(e) => update("owner", e.target.value)}
          className="text-sm border border-[var(--brand-border)] rounded-md px-2 py-1.5 bg-white min-w-[160px]"
        >
          <option value="">{t.pipeline.filterAll}</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.full_name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-xs gap-1 text-[var(--brand-fg-muted)] uppercase tracking-wide">
        {t.projects.filterService}
        <select
          value={service}
          onChange={(e) => update("service", e.target.value)}
          className="text-sm border border-[var(--brand-border)] rounded-md px-2 py-1.5 bg-white min-w-[160px]"
        >
          <option value="">{t.pipeline.filterAll}</option>
          {SERVICES.map((s) => (
            <option key={s} value={s}>
              {t.serviceType[s]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
