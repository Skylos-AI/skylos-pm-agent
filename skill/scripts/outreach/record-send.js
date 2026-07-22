#!/usr/bin/env node
const { runTool } = require("../lib/runner");
const { getClient } = require("../lib/supabase");
const { appError } = require("../lib/envelope");

// Called by the runner right after wa-baileys-mcp confirms a send. Owns ALL
// sequence-state advancement: logs the send, bumps sequence_position, and
// schedules the next touch from the template chain. Idempotent — a repeat call
// for the same (company, template) is a no-op, so a runner crash between send
// and record cannot double-advance (and the wa_sends UNIQUE blocks re-sends).
// Deliberately records even if the kill switch was flipped mid-cycle: the
// message already went out, and the log must reflect reality.
runTool({
  name: "record-send",
  actionType: "outreach.send_record",
  source: "CRON",
  requireUser: false,
  yargsBuilder: (y) =>
    y
      .option("company", { type: "string", demandOption: true })
      .option("template", { type: "string", demandOption: true })
      .option("wa-message-id", { type: "string", demandOption: true }),
  handler: async (argv) => {
    const supa = getClient();

    const { data: company, error: ce } = await supa
      .from("companies")
      .select("id, name, sequence_position")
      .eq("id", argv.company)
      .maybeSingle();
    if (ce) throw appError("DB_ERROR", ce.message);
    if (!company) throw appError("NOT_FOUND", `Empresa ${argv.company} no encontrada.`);

    const { data: template, error: te } = await supa
      .from("message_templates")
      .select("id, next_template_id")
      .eq("id", argv.template)
      .maybeSingle();
    if (te) throw appError("DB_ERROR", te.message);
    if (!template) throw appError("NOT_FOUND", `Template ${argv.template} no existe.`);

    const { error: ie } = await supa.from("wa_sends").insert({
      company_id: company.id,
      template_id: template.id,
      wa_message_id: argv["wa-message-id"],
    });
    if (ie) {
      if (ie.code === "23505") {
        return {
          data: { already_recorded: true },
          summary: `Envío ${argv.template} → ${company.name} ya estaba registrado; sin cambios.`,
          requestSummary: `Registrar envío ${argv.template} a ${company.name}.`,
        };
      }
      throw appError("DB_ERROR", ie.message);
    }

    const { error: ae } = await supa.from("activities").insert({
      company_id: company.id,
      type: "MESSAGE_SENT",
      channel: "WHATSAPP",
      description: `[wa_outreach] template=${template.id} wa_message_id=${argv["wa-message-id"]}`,
      logged_by_agent: true,
    });
    if (ae) throw appError("DB_ERROR", ae.message);

    let nextAction = null;
    let nextActionAt = null;
    if (template.next_template_id) {
      const { data: next, error: ne } = await supa
        .from("message_templates")
        .select("id, send_delay_hours, active")
        .eq("id", template.next_template_id)
        .maybeSingle();
      if (ne) throw appError("DB_ERROR", ne.message);
      if (next && next.active) {
        nextAction = next.id;
        nextActionAt = new Date(
          Date.now() + next.send_delay_hours * 3600 * 1000,
        ).toISOString();
      }
    }

    const { error: ue } = await supa
      .from("companies")
      .update({
        sequence_position: company.sequence_position + 1,
        next_action: nextAction,
        next_action_at: nextActionAt,
      })
      .eq("id", company.id);
    if (ue) throw appError("DB_ERROR", ue.message);

    const nextDesc = nextAction
      ? `próximo: ${nextAction} el ${nextActionAt.slice(0, 16)}Z`
      : "secuencia terminada";
    return {
      data: {
        recorded: true,
        sequence_position: company.sequence_position + 1,
        next_action: nextAction,
        next_action_at: nextActionAt,
      },
      summary: `Envío ${template.id} → ${company.name} registrado; ${nextDesc}.`,
      requestSummary: `Registrar envío ${template.id} a ${company.name}.`,
      entitiesAffected: [{ table: "companies", id: company.id }],
    };
  },
});
