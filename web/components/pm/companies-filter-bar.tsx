"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { t } from "@/lib/i18n/es";

const STATUSES = [
  "LEAD",
  "PROSPECT",
  "ACTIVE_CLIENT",
  "PAST_CLIENT",
  "DISQUALIFIED",
] as const;

export function CompaniesFilterBar({
  owners,
  sectors,
  departments,
  cities,
}: {
  owners: { id: string; full_name: string }[];
  sectors: string[];
  departments: string[];
  cities: string[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const status = sp.get("status") ?? "";
  const sector = sp.get("sector") ?? "";
  const department = sp.get("department") ?? "";
  const city = sp.get("city") ?? "";
  const owner = sp.get("owner") ?? "";
  const [q, setQ] = useState(sp.get("q") ?? "");

  useEffect(() => {
    setQ(sp.get("q") ?? "");
  }, [sp]);

  function update(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/companies?${next.toString()}`);
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    update("q", q.trim());
  }

  return (
    <div className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-xl p-4 mb-5 flex flex-wrap items-end gap-4">
      <form onSubmit={submitSearch} className="flex-1 min-w-[220px]">
        <label className="flex flex-col text-xs gap-1 text-[var(--brand-fg-muted)] uppercase tracking-wide">
          Buscar
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.companies.search}
            className="text-sm border border-[var(--brand-border)] rounded-md px-3 py-1.5 bg-white focus:outline-none focus:border-[var(--brand-blue)]"
          />
        </label>
      </form>
      <label className="flex flex-col text-xs gap-1 text-[var(--brand-fg-muted)] uppercase tracking-wide">
        {t.companies.filterStatus}
        <select
          value={status}
          onChange={(e) => update("status", e.target.value)}
          className="text-sm border border-[var(--brand-border)] rounded-md px-2 py-1.5 bg-white min-w-[140px]"
        >
          <option value="">{t.pipeline.filterAll}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t.companyStatus[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-xs gap-1 text-[var(--brand-fg-muted)] uppercase tracking-wide">
        {t.companies.filterSector}
        <select
          value={sector}
          onChange={(e) => update("sector", e.target.value)}
          className="text-sm border border-[var(--brand-border)] rounded-md px-2 py-1.5 bg-white min-w-[140px]"
        >
          <option value="">{t.pipeline.filterAll}</option>
          {sectors.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-xs gap-1 text-[var(--brand-fg-muted)] uppercase tracking-wide">
        {t.companies.filterDepartment}
        <select
          value={department}
          onChange={(e) => update("department", e.target.value)}
          className="text-sm border border-[var(--brand-border)] rounded-md px-2 py-1.5 bg-white min-w-[140px]"
        >
          <option value="">{t.pipeline.filterAll}</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-xs gap-1 text-[var(--brand-fg-muted)] uppercase tracking-wide">
        {t.companies.filterCity}
        <select
          value={city}
          onChange={(e) => update("city", e.target.value)}
          className="text-sm border border-[var(--brand-border)] rounded-md px-2 py-1.5 bg-white min-w-[140px]"
        >
          <option value="">{t.pipeline.filterAll}</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col text-xs gap-1 text-[var(--brand-fg-muted)] uppercase tracking-wide">
        {t.companies.filterOwner}
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
    </div>
  );
}
