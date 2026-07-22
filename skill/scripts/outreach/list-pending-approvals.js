#!/usr/bin/env node
const { runTool } = require("../lib/runner");
const { getClient } = require("../lib/supabase");
const { appError } = require("../lib/envelope");

const STATUSES = ["PENDING", "APPROVED", "REJECTED", "SENT"];

runTool({
  name: "list-pending-approvals",
  actionType: "outreach.approvals_list",
  source: "CRON",
  requireUser: false,
  yargsBuilder: (y) =>
    y.option("status", { type: "string", default: "PENDING" }),
  handler: async (argv) => {
    const status = argv.status.toUpperCase();
    if (!STATUSES.includes(status))
      throw appError("INVALID_ARGS", `--status debe ser uno de: ${STATUSES.join(", ")}.`);

    const supa = getClient();
    const { data, error } = await supa
      .from("pending_approvals")
      .select(
        "id, company_id, template_id, rendered_body, status, reviewed_by_id, reviewed_at, created_at, companies(name, wa_jid, sector, status)",
      )
      .eq("status", status)
      .order("created_at", { ascending: true });
    if (error) throw appError("DB_ERROR", error.message);

    return {
      data: { approvals: data },
      summary: `${data.length} aprobación(es) en estado ${status}.`,
      requestSummary: `Listar aprobaciones ${status}.`,
    };
  },
});
