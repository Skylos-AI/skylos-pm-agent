function ok(data, summary, agentLogId) {
  const out = { ok: true, data };
  if (summary) out.summary = summary;
  if (agentLogId) out.agent_log_id = agentLogId;
  return out;
}

function err(code, message, details, agentLogId) {
  const out = { ok: false, error: { code, message } };
  if (details) out.error.details = details;
  if (agentLogId) out.agent_log_id = agentLogId;
  return out;
}

function appError(code, message, details) {
  const e = new Error(message);
  e.code = code;
  if (details) e.details = details;
  return e;
}

module.exports = { ok, err, appError };
