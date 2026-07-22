#!/usr/bin/env node
const { runTool } = require("../lib/runner");
const { getClient } = require("../lib/supabase");
const { appError } = require("../lib/envelope");

runTool({
  name: "get-template",
  actionType: "outreach.template_get",
  source: "CRON",
  requireUser: false,
  yargsBuilder: (y) => y.option("id", { type: "string", demandOption: true }),
  handler: async (argv) => {
    const supa = getClient();
    const { data, error } = await supa
      .from("message_templates")
      .select("*")
      .eq("id", argv.id)
      .maybeSingle();
    if (error) throw appError("DB_ERROR", error.message);
    if (!data) throw appError("NOT_FOUND", `Template ${argv.id} no existe.`);
    return {
      data: { template: data },
      summary: `Template ${argv.id} (${data.channel}, trigger ${data.stage_trigger}).`,
      requestSummary: `Obtener template ${argv.id}.`,
    };
  },
});
