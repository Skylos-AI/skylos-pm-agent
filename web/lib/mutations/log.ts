import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type AgentLogInput = {
  source?: "WHATSAPP" | "CRON" | "WEB" | "MANUAL_TEST";
  toolCalled: string;
  actionType: string;
  requestSummary?: string;
  responseSummary?: string;
  entitiesAffected?: Array<{ table: string; id: string }> | null;
  status: "SUCCESS" | "ERROR" | "PARTIAL";
  errorMessage?: string | null;
  durationMs?: number | null;
  requestedByUserId?: string | null;
};

export async function writeAgentLog(input: AgentLogInput): Promise<string | null> {
  try {
    const supa = createServiceRoleClient();
    const { data, error } = await supa
      .from("agent_log")
      .insert({
        source: input.source ?? "WEB",
        tool_called: input.toolCalled,
        action_type: input.actionType,
        request_summary: input.requestSummary ?? "",
        response_summary: input.responseSummary ?? "",
        entities_affected: input.entitiesAffected ?? null,
        status: input.status,
        error_message: input.errorMessage ?? null,
        duration_ms: input.durationMs ?? null,
        requested_by_user_id: input.requestedByUserId ?? null,
      })
      .select("id")
      .single();
    if (error) {
      console.error("agent_log write failed", error.message);
      return null;
    }
    return data.id as string;
  } catch (e) {
    console.error("agent_log write threw", e);
    return null;
  }
}
