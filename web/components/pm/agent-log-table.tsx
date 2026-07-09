"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDateTime } from "@/lib/format/date";
import { t } from "@/lib/i18n/es";
import type { AgentLogRow } from "@/lib/types/activity";

const SOURCES = ["WHATSAPP", "CRON", "WEB", "MANUAL_TEST"] as const;
const STATUSES = ["SUCCESS", "ERROR", "PARTIAL"] as const;

function humanize(slug: string): string {
  const clean = slug.replace(/^[a-z]+:/i, "").replace(/[_-]+/g, " ").trim();
  if (!clean) return slug;
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function actionLabel(row: AgentLogRow): string {
  const mapped = t.agentLog.actionByType[row.action_type];
  if (mapped) return mapped;
  const [bucket, ...rest] = (row.action_type || "").split(".");
  const subject = rest.join(".") || row.tool_called;
  const subjectHuman = humanize(subject);
  switch (bucket) {
    case "read":
      return `${t.agentLog.actionFallbackRead}: ${subjectHuman}`;
    case "write":
      return `${t.agentLog.actionFallbackWrite}: ${subjectHuman}`;
    case "list":
      return `${t.agentLog.actionFallbackList}: ${subjectHuman}`;
    case "search":
      return `${t.agentLog.actionFallbackSearch}: ${subjectHuman}`;
    default:
      return humanize(row.tool_called || t.agentLog.actionFallbackOther);
  }
}

export function AgentLogFilterBar({
  tools,
  users,
}: {
  tools: string[];
  users: { id: string; full_name: string }[];
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const get = (k: string) => sp.get(k) ?? "";

  function update(key: string, value: string) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/agent-log?${next.toString()}`);
  }

  return (
    <div className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-xl p-4 mb-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
      <Field label={t.agentLog.filterSource}>
        <select
          value={get("source")}
          onChange={(e) => update("source", e.target.value)}
          className="text-sm border border-[var(--brand-border)] rounded-md px-2 py-1.5 bg-white w-full"
        >
          <option value="">{t.pipeline.filterAll}</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {t.agentLog.sourceLabel[s]}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t.agentLog.filterTool}>
        <select
          value={get("tool")}
          onChange={(e) => update("tool", e.target.value)}
          className="text-sm border border-[var(--brand-border)] rounded-md px-2 py-1.5 bg-white w-full"
        >
          <option value="">{t.pipeline.filterAll}</option>
          {tools.map((tool) => (
            <option key={tool} value={tool}>
              {tool}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t.agentLog.filterStatus}>
        <select
          value={get("status")}
          onChange={(e) => update("status", e.target.value)}
          className="text-sm border border-[var(--brand-border)] rounded-md px-2 py-1.5 bg-white w-full"
        >
          <option value="">{t.pipeline.filterAll}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t.agentLog.statusLabel[s]}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t.agentLog.filterUser}>
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
      <Field label={t.agentLog.filterFrom}>
        <input
          type="date"
          value={get("from")}
          onChange={(e) => update("from", e.target.value)}
          className="text-sm border border-[var(--brand-border)] rounded-md px-2 py-1.5 w-full"
        />
      </Field>
      <Field label={t.agentLog.filterTo}>
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

export function AgentLogTable({ entries }: { entries: AgentLogRow[] }) {
  const [open, setOpen] = useState<string | null>(null);

  if (entries.length === 0) {
    return (
      <div className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-xl p-8 text-center text-sm text-[var(--brand-fg-muted)]">
        {t.agentLog.empty}
      </div>
    );
  }

  return (
    <div className="bg-[var(--brand-surface)] border border-[var(--brand-border)] rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-[var(--brand-bg)]">
          <tr className="text-xs uppercase tracking-wide text-[var(--brand-fg-muted)]">
            <th className="text-left px-3 py-3 font-medium w-8" />
            <th className="text-left px-3 py-3 font-medium">
              {t.agentLog.columnWhen}
            </th>
            <th className="text-left px-3 py-3 font-medium">
              {t.agentLog.columnAction}
            </th>
            <th className="text-left px-3 py-3 font-medium">
              {t.agentLog.columnSource}
            </th>
            <th className="text-left px-3 py-3 font-medium">
              {t.agentLog.columnUser}
            </th>
            <th className="text-left px-3 py-3 font-medium">
              {t.agentLog.columnStatus}
            </th>
            <th className="text-right px-3 py-3 font-medium">
              {t.agentLog.columnDuration}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--brand-border)]">
          {entries.map((row) => (
            <AgentLogRowComp
              key={row.id}
              row={row}
              expanded={open === row.id}
              onToggle={() => setOpen(open === row.id ? null : row.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AgentLogRowComp({
  row,
  expanded,
  onToggle,
}: {
  row: AgentLogRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const statusClass =
    row.status === "ERROR"
      ? "bg-[var(--brand-magenta)]/10 text-[var(--brand-magenta)]"
      : row.status === "PARTIAL"
        ? "bg-[var(--brand-fg-muted)]/10 text-[var(--brand-fg-muted)]"
        : "bg-[var(--brand-cyan)]/10 text-[var(--brand-cyan)]";
  const label = actionLabel(row);
  return (
    <>
      <tr
        onClick={onToggle}
        title={t.agentLog.expandHint}
        className="hover:bg-[var(--brand-bg)] transition cursor-pointer"
      >
        <td className="px-3 py-3 w-8 text-[var(--brand-fg-muted)] text-xs select-none">
          <span
            className="inline-block transition-transform"
            style={{ transform: expanded ? "rotate(90deg)" : "none" }}
            aria-hidden="true"
          >
            ▸
          </span>
        </td>
        <td className="px-3 py-3 text-xs text-[var(--brand-fg-muted)] whitespace-nowrap">
          {formatDateTime(row.created_at)}
        </td>
        <td className="px-3 py-3">
          <p className="text-sm font-medium text-[var(--brand-fg)]">{label}</p>
          {row.request_summary && (
            <p className="text-xs text-[var(--brand-fg-muted)] truncate max-w-[480px] mt-0.5">
              {row.request_summary}
            </p>
          )}
        </td>
        <td className="px-3 py-3 text-xs">
          {t.agentLog.sourceLabel[row.source] ?? row.source}
        </td>
        <td className="px-3 py-3 text-xs text-[var(--brand-fg-muted)]">
          {row.requested_by?.full_name ?? "—"}
        </td>
        <td className="px-3 py-3">
          <span
            className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusClass}`}
          >
            {t.agentLog.statusLabel[row.status] ?? row.status}
          </span>
        </td>
        <td className="px-3 py-3 text-xs text-right text-[var(--brand-fg-muted)]">
          {row.duration_ms != null ? `${row.duration_ms} ms` : "—"}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-[var(--brand-bg)]">
          <td colSpan={7} className="px-4 py-4">
            <DetailBlock
              label={t.agentLog.detailRequest}
              text={row.request_summary}
            />
            <DetailBlock
              label={t.agentLog.detailResponse}
              text={row.response_summary}
            />
            {row.error_message && (
              <DetailBlock
                label={t.agentLog.detailError}
                text={row.error_message}
                error
              />
            )}
            <DetailBlock
              label={t.agentLog.detailEntities}
              text={JSON.stringify(row.entities_affected ?? [], null, 2)}
              mono
            />
            <div className="mt-3 pt-3 border-t border-[var(--brand-border)]">
              <p className="text-xs uppercase tracking-wide text-[var(--brand-fg-muted)] mb-2">
                {t.agentLog.detailTechnical}
              </p>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">
                <div className="flex gap-2">
                  <dt className="text-[var(--brand-fg-muted)] min-w-[110px]">
                    {t.agentLog.detailToolLabel}
                  </dt>
                  <dd className="font-mono text-[var(--brand-fg)]">
                    {row.tool_called}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-[var(--brand-fg-muted)] min-w-[110px]">
                    {t.agentLog.detailActionType}
                  </dt>
                  <dd className="font-mono text-[var(--brand-fg)]">
                    {row.action_type || "—"}
                  </dd>
                </div>
              </dl>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function DetailBlock({
  label,
  text,
  error,
  mono,
}: {
  label: string;
  text: string;
  error?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="text-xs uppercase tracking-wide text-[var(--brand-fg-muted)] mb-1">
        {label}
      </p>
      <pre
        className={`text-xs whitespace-pre-wrap rounded-md px-3 py-2 ${
          error
            ? "bg-[var(--brand-magenta)]/10 text-[var(--brand-magenta)]"
            : "bg-white border border-[var(--brand-border)]"
        } ${mono ? "font-mono" : ""}`}
      >
        {text}
      </pre>
    </div>
  );
}
