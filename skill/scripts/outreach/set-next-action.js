#!/usr/bin/env node
const { runTool } = require("../lib/runner");
const { getClient } = require("../lib/supabase");
const { appError } = require("../lib/envelope");

// Manual scheduling and error flagging. --action none clears the sequence.
// Error markers ("error_missing_vars" etc.) use --action error_* with no --at;
// list-due-actions skips them and the Today view surfaces them.
runTool({
  name: "set-next-action",
  actionType: "outreach.next_action_set",
  source: "CRON",
  requireUser: false,
  yargsBuilder: (y) =>
    y
      .option("company", { type: "string", demandOption: true })
      .option("action", {
        type: "string",
        demandOption: true,
        describe: "Template id, error_* marker, or 'none' to clear.",
      })
      .option("at", {
        type: "string",
        describe: "ISO timestamp (UTC). Omit for error markers or 'none'.",
      }),
  handler: async (argv) => {
    const supa = getClient();

    const clearing = argv.action === "none";
    const isError = argv.action.startsWith("error_");
    let at = null;
    if (!clearing && !isError) {
      // Real template action: validate the template exists and require --at.
      const { data: t, error: te } = await supa
        .from("message_templates")
        .select("id")
        .eq("id", argv.action)
        .maybeSingle();
      if (te) throw appError("DB_ERROR", te.message);
      if (!t)
        throw appError(
          "NOT_FOUND",
          `Template ${argv.action} no existe (usa un id de template, error_*, o 'none').`,
        );
      if (!argv.at)
        throw appError("INVALID_ARGS", "--at es obligatorio para acciones de template.");
      at = new Date(argv.at);
      if (isNaN(at.getTime()))
        throw appError("INVALID_ARGS", `--at inválido: "${argv.at}". Usa ISO UTC.`);
    }

    const { data, error } = await supa
      .from("companies")
      .update({
        next_action: clearing ? null : argv.action,
        next_action_at: at ? at.toISOString() : null,
      })
      .eq("id", argv.company)
      .select("id, name")
      .maybeSingle();
    if (error) throw appError("DB_ERROR", error.message);
    if (!data) throw appError("NOT_FOUND", `Empresa ${argv.company} no encontrada.`);

    const desc = clearing
      ? "secuencia limpiada"
      : isError
        ? `marcada con ${argv.action}`
        : `${argv.action} programado para ${at.toISOString()}`;
    return {
      data: { company_id: data.id, next_action: clearing ? null : argv.action },
      summary: `${data.name}: ${desc}.`,
      requestSummary: `set-next-action ${argv.action} para ${data.name}.`,
      entitiesAffected: [{ table: "companies", id: data.id }],
    };
  },
});
