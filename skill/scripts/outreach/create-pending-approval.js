#!/usr/bin/env node
const { runTool } = require("../lib/runner");
const { getClient } = require("../lib/supabase");
const { appError } = require("../lib/envelope");

// First-touch messages are never auto-sent: the runner parks them here for a
// human to approve. Also clears next_action_at so the company stops showing
// as due while the approval waits.
runTool({
  name: "create-pending-approval",
  actionType: "outreach.approval_create",
  source: "CRON",
  requireUser: false,
  yargsBuilder: (y) =>
    y
      .option("company", { type: "string", demandOption: true })
      .option("template", { type: "string", demandOption: true })
      .option("body", { type: "string", demandOption: true }),
  handler: async (argv) => {
    const supa = getClient();

    const { data: existing, error: xe } = await supa
      .from("pending_approvals")
      .select("id")
      .eq("company_id", argv.company)
      .eq("template_id", argv.template)
      .in("status", ["PENDING", "APPROVED"])
      .maybeSingle();
    if (xe) throw appError("DB_ERROR", xe.message);
    if (existing) {
      return {
        data: { already_exists: true, approval_id: existing.id },
        summary: `Ya hay una aprobación abierta para esta empresa+template; sin cambios.`,
        requestSummary: `Crear aprobación ${argv.template}.`,
      };
    }

    const { data, error } = await supa
      .from("pending_approvals")
      .insert({
        company_id: argv.company,
        template_id: argv.template,
        rendered_body: argv.body,
      })
      .select("id, companies(name)")
      .single();
    if (error) throw appError("DB_ERROR", error.message);

    const { error: ue } = await supa
      .from("companies")
      .update({ next_action_at: null })
      .eq("id", argv.company);
    if (ue) throw appError("DB_ERROR", ue.message);

    return {
      data: { approval_id: data.id },
      summary: `Primer toque para ${data.companies?.name ?? argv.company} en cola de aprobación.`,
      requestSummary: `Crear aprobación ${argv.template} para ${argv.company}.`,
      entitiesAffected: [{ table: "pending_approvals", id: data.id }],
    };
  },
});
