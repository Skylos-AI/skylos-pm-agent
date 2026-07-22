#!/usr/bin/env node
const { runTool } = require("../lib/runner");
const { getClient } = require("../lib/supabase");
const { appError } = require("../lib/envelope");

runTool({
  name: "list-due-actions",
  actionType: "outreach.due_actions_list",
  source: "CRON",
  requireUser: false,
  yargsBuilder: (y) =>
    y.option("now", {
      type: "string",
      describe: "ISO timestamp override for testing; defaults to now.",
    }),
  handler: async (argv) => {
    const supa = getClient();

    const { data: setting, error: se } = await supa
      .from("app_settings")
      .select("value")
      .eq("key", "outreach_enabled")
      .maybeSingle();
    if (se) throw appError("DB_ERROR", se.message);
    if (setting?.value !== true) {
      return {
        data: { enabled: false, due: [] },
        summary: "Outreach deshabilitado (kill switch off). Nada que enviar.",
        requestSummary: "Listar acciones pendientes.",
      };
    }

    const nowIso = argv.now ?? new Date().toISOString();
    const { data, error } = await supa
      .from("companies")
      .select(
        "id, name, sector, city, status, wa_jid, next_action, next_action_at, sequence_position, preferred_channel, contacts(id, full_name, role, phone, whatsapp, is_primary)",
      )
      .not("next_action", "is", null)
      .not("next_action_at", "is", null)
      .lte("next_action_at", nowIso)
      .not("next_action", "like", "error\\_%")
      .order("next_action_at", { ascending: true });
    if (error) throw appError("DB_ERROR", error.message);

    return {
      data: { enabled: true, due: data },
      summary: `${data.length} acción(es) pendiente(s) de envío.`,
      requestSummary: `Listar acciones con next_action_at <= ${nowIso}.`,
    };
  },
});
