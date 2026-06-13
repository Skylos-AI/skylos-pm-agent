#!/usr/bin/env node
const { runTool } = require("../lib/runner");
const { getClient } = require("../lib/supabase");
const { appError } = require("../lib/envelope");
const { findTaskByAny } = require("../lib/db-helpers");

const STATUSES = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"];

runTool({
  name: "update-task-status",
  actionType: "write.task_update_status",
  yargsBuilder: (y) =>
    y
      .option("id", { type: "string" })
      .option("title", { type: "string" })
      .option("status", { type: "string", choices: STATUSES, demandOption: true }),
  handler: async (argv, { user }) => {
    const task = await findTaskByAny({
      id: argv.id,
      title: argv.title,
      assigneeId: argv.id ? undefined : user.id,
    });
    const supa = getClient();

    const update = {
      status: argv.status,
      completed_at: argv.status === "DONE" ? new Date().toISOString() : null,
    };

    const { data, error } = await supa
      .from("tasks")
      .update(update)
      .eq("id", task.id)
      .select("*")
      .single();
    if (error) throw appError("DB_ERROR", error.message);

    const summary = `Tarea "${task.title}" pasó de ${task.status} a ${argv.status}.`;

    return {
      data: { task: data },
      summary,
      requestSummary: `Mover tarea ${task.id} a ${argv.status}.`,
      entitiesAffected: [{ table: "tasks", id: task.id }],
    };
  },
});
