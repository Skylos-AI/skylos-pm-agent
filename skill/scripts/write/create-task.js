#!/usr/bin/env node
const { runTool } = require("../lib/runner");
const { getClient } = require("../lib/supabase");
const { appError } = require("../lib/envelope");
const { findProjectByAny } = require("../lib/db-helpers");
const { parseRelative } = require("../lib/time");

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

runTool({
  name: "create-task",
  actionType: "write.task_create",
  yargsBuilder: (y) =>
    y
      .option("title", { type: "string", demandOption: true })
      .option("assignee", { type: "string" })
      .option("project", { type: "string" })
      .option("priority", { type: "string", choices: PRIORITIES, default: "MEDIUM" })
      .option("due", { type: "string" })
      .option("description", { type: "string" }),
  handler: async (argv, { user }) => {
    const supa = getClient();

    let assigneeId = user.id;
    let assigneeLabel = user.full_name;
    if (argv.assignee) {
      const { data: u, error: e } = await supa
        .from("users")
        .select("id, full_name")
        .eq("email", argv.assignee)
        .maybeSingle();
      if (e) throw appError("DB_ERROR", e.message);
      if (!u) throw appError("NOT_FOUND", `Asignado ${argv.assignee} no encontrado.`);
      assigneeId = u.id;
      assigneeLabel = u.full_name;
    }

    let projectId = null;
    let projectName = null;
    if (argv.project) {
      const isUuid = /^[0-9a-f-]{36}$/i.test(argv.project);
      const project = await findProjectByAny(
        isUuid ? { id: argv.project } : { name: argv.project },
      );
      projectId = project.id;
      projectName = project.name;
    }

    let dueDate = null;
    if (argv.due) {
      const parsed = parseRelative(argv.due);
      if (!parsed)
        throw appError(
          "INVALID_ARGS",
          `No pude entender --due="${argv.due}". Usa YYYY-MM-DD o relativos como "tomorrow", "next monday".`,
        );
      dueDate = parsed.toISOString();
    }

    const { data, error } = await supa
      .from("tasks")
      .insert({
        title: argv.title,
        description: argv.description ?? null,
        assignee_id: assigneeId,
        project_id: projectId,
        priority: argv.priority,
        due_date: dueDate,
        created_by_id: user.id,
        created_by_agent: true,
      })
      .select("*")
      .single();
    if (error) throw appError("DB_ERROR", error.message);

    const summary =
      `Tarea "${argv.title}" creada para ${assigneeLabel}` +
      (projectName ? ` en proyecto ${projectName}` : "") +
      (dueDate ? `, vence ${dueDate.slice(0, 10)}` : "") +
      ".";

    return {
      data: { task: data },
      summary,
      requestSummary: `Crear tarea "${argv.title}" para ${assigneeLabel}.`,
      entitiesAffected: [{ table: "tasks", id: data.id }],
    };
  },
});
