#!/usr/bin/env node
const { runTool } = require("../lib/runner");
const { getClient } = require("../lib/supabase");
const { appError } = require("../lib/envelope");

// Global kill switch. Human decision — requires --as-user. When off,
// list-due-actions returns empty so the runner sends nothing.
runTool({
  name: "set-outreach-enabled",
  actionType: "outreach.kill_switch_set",
  yargsBuilder: (y) =>
    y.option("enabled", { type: "boolean", demandOption: true }),
  handler: async (argv, { user }) => {
    const supa = getClient();
    const { error } = await supa
      .from("app_settings")
      .upsert({ key: "outreach_enabled", value: argv.enabled });
    if (error) throw appError("DB_ERROR", error.message);

    return {
      data: { outreach_enabled: argv.enabled },
      summary: argv.enabled
        ? `Outreach automático ACTIVADO por ${user.full_name}.`
        : `Outreach automático DESACTIVADO por ${user.full_name}.`,
      requestSummary: `Kill switch → ${argv.enabled}.`,
      entitiesAffected: [{ table: "app_settings", id: "outreach_enabled" }],
    };
  },
});
