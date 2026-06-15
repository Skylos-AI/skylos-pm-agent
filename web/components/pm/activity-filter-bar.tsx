"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { t } from "@/lib/i18n/es";

const TYPES = [
  "CALL",
  "MEETING",
  "MESSAGE_SENT",
  "MESSAGE_RECEIVED",
  "EMAIL",
  "NOTE",
  "MILESTONE",
  "PROPOSAL_SENT",
  "CONTRACT_SIGNED",
] as const;
const CHANNELS = [
  "WHATSAPP",
  "PHONE",
  "IN_PERSON",
  "EMAIL",
  "VIDEO_CALL",
  "OTHER",
] as const;

export function ActivityFilterBar({
  companies,
  projects,
  users,
}: {
  companies: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  users: { id: string; full_name: string }[];
}) {
  const router = useRouter();
  const sp = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/activity?${next.toString()}`);
  }

  const get = (k: string) => sp.get(k) ?? "";

  return (
    <div className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-xl p-4 mb-5 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 items-end">
      <Field label={t.activity.filterCompany}>
        <select
          value={get("company")}
          onChange={(e) => update("company", e.target.value)}
          className="text-sm border border-[var(--brand-border)] rounded-md px-2 py-1.5 bg-white w-full"
        >
          <option value="">{t.pipeline.filterAll}</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t.activity.filterProject}>
        <select
          value={get("project")}
          onChange={(e) => update("project", e.target.value)}
          className="text-sm border border-[var(--brand-border)] rounded-md px-2 py-1.5 bg-white w-full"
        >
          <option value="">{t.pipeline.filterAll}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t.activity.filterUser}>
        <select
          value={get("user")}
          onChange={(e) => update("user", e.target.value)}
          className="text-sm border border-[var(--brand-border)] rounded-md px-2 py-1.5 bg-white w-full"
        >
          <option value="">{t.pipeline.filterAll}</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.full_name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t.activity.filterType}>
        <select
          value={get("type")}
          onChange={(e) => update("type", e.target.value)}
          className="text-sm border border-[var(--brand-border)] rounded-md px-2 py-1.5 bg-white w-full"
        >
          <option value="">{t.pipeline.filterAll}</option>
          {TYPES.map((tt) => (
            <option key={tt} value={tt}>
              {t.activityType[tt]}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t.activity.filterChannel}>
        <select
          value={get("channel")}
          onChange={(e) => update("channel", e.target.value)}
          className="text-sm border border-[var(--brand-border)] rounded-md px-2 py-1.5 bg-white w-full"
        >
          <option value="">{t.pipeline.filterAll}</option>
          {CHANNELS.map((ch) => (
            <option key={ch} value={ch}>
              {t.activityChannel[ch]}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t.activity.filterFrom}>
        <input
          type="date"
          value={get("from")}
          onChange={(e) => update("from", e.target.value)}
          className="text-sm border border-[var(--brand-border)] rounded-md px-2 py-1.5 w-full"
        />
      </Field>
      <Field label={t.activity.filterTo}>
        <input
          type="date"
          value={get("to")}
          onChange={(e) => update("to", e.target.value)}
          className="text-sm border border-[var(--brand-border)] rounded-md px-2 py-1.5 w-full"
        />
      </Field>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col text-xs gap-1 text-[var(--brand-fg-muted)] uppercase tracking-wide">
      {label}
      {children}
    </label>
  );
}
