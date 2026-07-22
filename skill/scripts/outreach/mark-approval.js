#!/usr/bin/env node
const { runTool } = require("../lib/runner");
const { getClient } = require("../lib/supabase");
const { appError } = require("../lib/envelope");
const { resolveUser } = require("../lib/users");

// approved/rejected are human decisions (pass --as-user); sent is set by the
// runner after wa-baileys-mcp confirms delivery. Legal transitions:
// PENDING → APPROVED | REJECTED, APPROVED → SENT.
const LEGAL = {
  APPROVED: ["PENDING"],
  REJECTED: ["PENDING"],
  SENT: ["APPROVED"],
};

runTool({
  name: "mark-approval",
  actionType: "outreach.approval_mark",
  source: "CRON",
  requireUser: false,
  yargsBuilder: (y) =>
    y
      .option("id", { type: "string", demandOption: true })
      .option("status", { type: "string", demandOption: true }),
  handler: async (argv) => {
    const status = argv.status.toUpperCase();
    if (!LEGAL[status])
      throw appError("INVALID_ARGS", `--status debe ser approved, rejected o sent.`);

    let reviewer = null;
    if (status === "APPROVED" || status === "REJECTED") {
      if (!argv["as-user"])
        throw appError("INVALID_ARGS", `${status} requiere --as-user (decisión humana).`);
      reviewer = await resolveUser(argv["as-user"]);
    }

    const supa = getClient();
    const { data: approval, error: ge } = await supa
      .from("pending_approvals")
      .select("id, status, companies(name)")
      .eq("id", argv.id)
      .maybeSingle();
    if (ge) throw appError("DB_ERROR", ge.message);
    if (!approval) throw appError("NOT_FOUND", `Aprobación ${argv.id} no encontrada.`);
    if (!LEGAL[status].includes(approval.status))
      throw appError(
        "VALIDATION",
        `Transición inválida: ${approval.status} → ${status}.`,
      );

    const update = { status };
    if (reviewer) {
      update.reviewed_by_id = reviewer.id;
      update.reviewed_at = new Date().toISOString();
    }
    const { error: ue } = await supa
      .from("pending_approvals")
      .update(update)
      .eq("id", argv.id)
      .eq("status", approval.status); // guard against concurrent review
    if (ue) throw appError("DB_ERROR", ue.message);

    return {
      data: { approval_id: argv.id, status },
      summary: `Aprobación para ${approval.companies?.name ?? "?"} → ${status}.`,
      requestSummary: `Marcar aprobación ${argv.id} como ${status}.`,
      entitiesAffected: [{ table: "pending_approvals", id: argv.id }],
    };
  },
});
