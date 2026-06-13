#!/usr/bin/env node
const { runTool } = require("../lib/runner");
const { getClient } = require("../lib/supabase");
const { appError } = require("../lib/envelope");
const { parseRelative } = require("../lib/time");

runTool({
  name: "create-reminder",
  actionType: "write.reminder_create",
  yargsBuilder: (y) =>
    y
      .option("target", { type: "string" })
      .option("message", { type: "string", demandOption: true })
      .option("trigger-at", { type: "string", demandOption: true })
      .option("company", { type: "string" })
      .option("project", { type: "string" })
      .option("task", { type: "string" }),
  handler: async (argv, { user }) => {
    const supa = getClient();

    let targetId = user.id;
    let targetLabel = user.full_name;
    if (argv.target) {
      const { data: u, error: e } = await supa
        .from("users")
        .select("id, full_name")
        .eq("email", argv.target)
        .maybeSingle();
      if (e) throw appError("DB_ERROR", e.message);
      if (!u) throw appError("NOT_FOUND", `Target ${argv.target} no encontrado.`);
      targetId = u.id;
      targetLabel = u.full_name;
    }

    const triggerDate = parseRelative(argv["trigger-at"]);
    if (!triggerDate)
      throw appError(
        "INVALID_ARGS",
        `--trigger-at inválido: "${argv["trigger-at"]}". Usa ISO o "tomorrow" / "next monday" / "in 3 days".`,
      );

    const refs = [argv.company, argv.project, argv.task].filter(Boolean);
    if (refs.length > 1) {
      throw appError(
        "VALIDATION",
        "Solo un --company, --project, o --task por recordatorio.",
      );
    }

    const { data, error } = await supa
      .from("reminders")
      .insert({
        target_user_id: targetId,
        related_company_id: argv.company ?? null,
        related_project_id: argv.project ?? null,
        related_task_id: argv.task ?? null,
        message: argv.message,
        trigger_at: triggerDate.toISOString(),
        created_by_agent: true,
      })
      .select("*")
      .single();
    if (error) throw appError("DB_ERROR", error.message);

    const summary = `Recordatorio para ${targetLabel} el ${triggerDate.toISOString().slice(0, 10)}: ${argv.message}.`;

    return {
      data: { reminder: data },
      summary,
      requestSummary: `Crear recordatorio para ${targetLabel}.`,
      entitiesAffected: [{ table: "reminders", id: data.id }],
    };
  },
});
