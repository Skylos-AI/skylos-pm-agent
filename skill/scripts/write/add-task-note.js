#!/usr/bin/env node
const { runTool } = require("../lib/runner");
const { getClient } = require("../lib/supabase");
const { appError } = require("../lib/envelope");

const isUuid = (s) => /^[0-9a-f-]{36}$/i.test(String(s ?? ""));

runTool({
  name: "add-task-note",
  actionType: "write.task_note_create",
  yargsBuilder: (y) =>
    y
      .option("task", { type: "string", demandOption: true })
      .option("body", { type: "string", demandOption: true }),
  handler: async (argv, { user }) => {
    const supa = getClient();

    let taskRow = null;
    if (isUuid(argv.task)) {
      const { data, error } = await supa
        .from("tasks")
        .select("id, title")
        .eq("id", argv.task)
        .maybeSingle();
      if (error) throw appError("DB_ERROR", error.message);
      taskRow = data;
    } else {
      const { data, error } = await supa
        .from("tasks")
        .select("id, title")
        .ilike("title", `%${argv.task}%`)
        .limit(5);
      if (error) throw appError("DB_ERROR", error.message);
      if (!data || data.length === 0)
        throw appError("NOT_FOUND", `Tarea "${argv.task}" no encontrada.`);
      if (data.length > 1)
        throw appError(
          "VALIDATION",
          `Múltiples tareas coinciden con "${argv.task}". Especifica con id.`,
          { candidates: data.map((r) => ({ id: r.id, title: r.title })) },
        );
      taskRow = data[0];
    }

    if (!taskRow) throw appError("NOT_FOUND", `Tarea "${argv.task}" no encontrada.`);

    const body = String(argv.body).trim();
    if (!body) throw appError("INVALID_ARGS", "--body no puede estar vacío.");
    if (body.length > 2000)
      throw appError("INVALID_ARGS", "--body no puede superar 2000 caracteres.");

    const { data, error } = await supa
      .from("task_notes")
      .insert({
        task_id: taskRow.id,
        author_id: user.id,
        author_agent: true,
        body,
      })
      .select("*")
      .single();
    if (error) throw appError("DB_ERROR", error.message);

    const summary = `Nota agregada a "${taskRow.title}" por ${user.full_name} (agente).`;

    return {
      data: { note: data },
      summary,
      requestSummary: `Nota en tarea "${taskRow.title}".`,
      entitiesAffected: [
        { table: "task_notes", id: data.id },
        { table: "tasks", id: taskRow.id },
      ],
    };
  },
});
