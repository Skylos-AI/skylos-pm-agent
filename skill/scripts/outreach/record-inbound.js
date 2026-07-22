#!/usr/bin/env node
const { runTool } = require("../lib/runner");
const { getClient } = require("../lib/supabase");
const { appError } = require("../lib/envelope");

// Called by the runner for every inbound WA message it pulls. Idempotent on
// wa_message_id (wa_inbound PK). Unknown JIDs are logged and ignored — never
// create companies from random senders. On a match: log the reply, KILL the
// automated sequence (worst outcome would be a scheduled bump after a human
// replied), and move LEAD → PROSPECT so the company shows as engaged.
runTool({
  name: "record-inbound",
  actionType: "outreach.inbound_record",
  source: "CRON",
  requireUser: false,
  yargsBuilder: (y) =>
    y
      .option("jid", { type: "string", demandOption: true })
      .option("text", { type: "string", default: "" })
      .option("timestamp", {
        type: "number",
        demandOption: true,
        describe: "Unix seconds",
      })
      .option("wa-message-id", { type: "string", demandOption: true }),
  handler: async (argv) => {
    const supa = getClient();
    const waMessageId = argv["wa-message-id"];

    const { data: company, error: ce } = await supa
      .from("companies")
      .select("id, name, status, next_action")
      .eq("wa_jid", argv.jid)
      .maybeSingle();
    if (ce) throw appError("DB_ERROR", ce.message);

    const { data: inserted, error: ie } = await supa
      .from("wa_inbound")
      .upsert(
        {
          wa_message_id: waMessageId,
          jid: argv.jid,
          company_id: company?.id ?? null,
          text: argv.text || null,
          received_at: new Date(argv.timestamp * 1000).toISOString(),
        },
        { onConflict: "wa_message_id", ignoreDuplicates: true },
      )
      .select();
    if (ie) throw appError("DB_ERROR", ie.message);
    if (!inserted || inserted.length === 0) {
      return {
        data: { deduped: true },
        summary: `Mensaje ${waMessageId} ya estaba registrado; sin cambios.`,
        requestSummary: `Registrar entrante de ${argv.jid}.`,
      };
    }

    if (!company) {
      return {
        data: { matched: false },
        summary: `Entrante de ${argv.jid} sin empresa asociada; registrado y descartado.`,
        requestSummary: `Registrar entrante de ${argv.jid}.`,
      };
    }

    const { error: ae } = await supa.from("activities").insert({
      company_id: company.id,
      type: "MESSAGE_RECEIVED",
      channel: "WHATSAPP",
      description: argv.text
        ? `[wa_outreach] respuesta: ${argv.text}`
        : `[wa_outreach] respuesta (sin texto) wa_message_id=${waMessageId}`,
      occurred_at: new Date(argv.timestamp * 1000).toISOString(),
      logged_by_agent: true,
    });
    if (ae) throw appError("DB_ERROR", ae.message);

    const update = { next_action: null, next_action_at: null };
    let transitioned = false;
    if (company.status === "LEAD") {
      update.status = "PROSPECT";
      transitioned = true;
    }
    const { error: ue } = await supa
      .from("companies")
      .update(update)
      .eq("id", company.id);
    if (ue) throw appError("DB_ERROR", ue.message);

    return {
      data: {
        matched: true,
        company_id: company.id,
        sequence_cancelled: company.next_action !== null,
        transitioned_to_prospect: transitioned,
      },
      summary: `Respuesta de ${company.name} registrada; secuencia cancelada${transitioned ? ", ahora PROSPECT" : ""}.`,
      requestSummary: `Registrar entrante de ${company.name}.`,
      entitiesAffected: [{ table: "companies", id: company.id }],
    };
  },
});
