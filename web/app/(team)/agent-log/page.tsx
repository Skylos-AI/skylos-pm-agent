import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/current-user";
import { getAgentLog } from "@/lib/data/agent-log";
import type {
  AgentActionStatus,
  AgentSource,
} from "@/lib/types/activity";
import {
  AgentLogFilterBar,
  AgentLogTable,
} from "@/components/pm/agent-log-table";
import { t } from "@/lib/i18n/es";

export default async function AgentLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    source?: string;
    tool?: string;
    status?: string;
    user?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const { entries, tools, users } = await getAgentLog({
    source: (sp.source as AgentSource) || undefined,
    status: (sp.status as AgentActionStatus) || undefined,
    tool: sp.tool,
    userId: sp.user,
    fromDate: sp.from ? new Date(sp.from).toISOString() : undefined,
    toDate: sp.to
      ? new Date(`${sp.to}T23:59:59`).toISOString()
      : undefined,
  });

  return (
    <div className="min-h-screen p-8 lg:p-10">
      <header className="mb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-5xl tracking-tight leading-tight">
            {t.agentLog.title}
          </h1>
          <p className="text-sm text-[var(--brand-fg-muted)] mt-1">
            {t.agentLog.subtitle}
          </p>
        </div>
        <span className="text-xs text-[var(--brand-fg-muted)]">
          {entries.length} {entries.length === 1 ? "entrada" : "entradas"}
        </span>
      </header>
      <AgentLogFilterBar tools={tools} users={users} />
      <AgentLogTable entries={entries} />
    </div>
  );
}
