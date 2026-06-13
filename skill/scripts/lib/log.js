const { getClient } = require("./supabase");

async function writeAgentLog({
  source = "WHATSAPP",
  toolCalled,
  actionType,
  requestSummary,
  responseSummary,
  entitiesAffected,
  status,
  errorMessage,
  durationMs,
  requestedByUserId,
  tokensUsed,
}) {
  try {
    const supa = getClient();
    const { data, error } = await supa
      .from("agent_log")
      .insert({
        source,
        tool_called: toolCalled,
        action_type: actionType,
        request_summary: requestSummary ?? "",
        response_summary: responseSummary ?? "",
        entities_affected: entitiesAffected ?? null,
        status,
        error_message: errorMessage ?? null,
        duration_ms: durationMs ?? null,
        tokens_used: tokensUsed ?? null,
        requested_by_user_id: requestedByUserId ?? null,
      })
      .select("id")
      .single();
    if (error) {
      process.stderr.write(`agent_log write failed: ${error.message}\n`);
      return null;
    }
    return data.id;
  } catch (e) {
    process.stderr.write(`agent_log write threw: ${e.message}\n`);
    return null;
  }
}

module.exports = { writeAgentLog };
