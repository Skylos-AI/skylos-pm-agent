import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type {
  AgentLogRow,
  AgentSource,
  AgentActionStatus,
} from "@/lib/types/activity";

export type { AgentLogRow };

export type AgentLogFilters = {
  source?: AgentSource;
  status?: AgentActionStatus;
  tool?: string;
  userId?: string;
  fromDate?: string;
  toDate?: string;
};

export async function getAgentLog(filters?: AgentLogFilters): Promise<{
  entries: AgentLogRow[];
  tools: string[];
  users: { id: string; full_name: string }[];
}> {
  const supa = createServiceRoleClient();
  let q = supa
    .from("agent_log")
    .select(
      "id, source, tool_called, action_type, request_summary, response_summary, entities_affected, status, error_message, duration_ms, created_at, requested_by:users(id, full_name)",
    )
    .order("created_at", { ascending: false })
    .limit(200);
  if (filters?.source) q = q.eq("source", filters.source);
  if (filters?.status) q = q.eq("status", filters.status);
  if (filters?.tool) q = q.eq("tool_called", filters.tool);
  if (filters?.userId) q = q.eq("requested_by_user_id", filters.userId);
  if (filters?.fromDate) q = q.gte("created_at", filters.fromDate);
  if (filters?.toDate) q = q.lte("created_at", filters.toDate);

  const [{ data: entries }, { data: toolsRows }, { data: users }] =
    await Promise.all([
      q,
      supa.from("agent_log").select("tool_called").limit(1000),
      supa
        .from("users")
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name", { ascending: true }),
    ]);

  const tools = Array.from(
    new Set((toolsRows ?? []).map((r) => r.tool_called as string)),
  ).sort();

  return {
    entries: (entries ?? []) as unknown as AgentLogRow[],
    tools,
    users: (users ?? []) as { id: string; full_name: string }[],
  };
}
