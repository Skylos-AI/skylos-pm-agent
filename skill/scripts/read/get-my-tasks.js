#!/usr/bin/env node
const { runTool } = require("../lib/runner");
const { getClient } = require("../lib/supabase");
const { todayIso, daysBetween } = require("../lib/time");

const OPEN_STATUSES = ["TODO", "IN_PROGRESS", "BLOCKED"];

runTool({
  name: "get-my-tasks",
  actionType: "read.tasks",
  yargsBuilder: (y) =>
    y
      .option("status", {
        type: "string",
        choices: ["todo", "in_progress", "blocked", "done", "open"],
        default: "open",
      })
      .option("limit", { type: "number", default: 20 })
      .option("include-overdue", { type: "boolean", default: true }),
  handler: async (argv, { user }) => {
    const supa = getClient();
    let q = supa
      .from("tasks")
      .select(
        "id, title, status, priority, due_date, project:projects(name)",
      )
      .eq("assignee_id", user.id)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(argv.limit);

    if (argv.status === "open") {
      q = q.in("status", OPEN_STATUSES);
    } else {
      q = q.eq("status", argv.status.toUpperCase());
    }

    const { data, error } = await q;
    if (error) throw Object.assign(new Error(error.message), { code: "DB_ERROR" });

    const today = todayIso();
    const tasks = (data ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      due_date: t.due_date,
      project: t.project?.name ?? null,
      is_overdue:
        argv["include-overdue"] &&
        t.due_date &&
        OPEN_STATUSES.includes(t.status) &&
        daysBetween(today, t.due_date) < 0,
    }));

    const counts = {
      total: tasks.length,
      overdue: tasks.filter((t) => t.is_overdue).length,
      due_today: tasks.filter((t) => t.due_date && t.due_date.startsWith(today))
        .length,
    };

    const summary =
      counts.total === 0
        ? `${user.full_name.split(" ")[0]} no tiene tareas ${argv.status === "open" ? "pendientes" : argv.status}.`
        : `${counts.total} tareas ${argv.status === "open" ? "pendientes" : argv.status} para ${user.full_name.split(" ")[0]}` +
          (counts.overdue > 0 ? `, ${counts.overdue} vencidas` : "") +
          (counts.due_today > 0 ? `, ${counts.due_today} para hoy` : "") +
          ".";

    return {
      data: { tasks, counts },
      summary,
      requestSummary: `Listar tareas ${argv.status} de ${user.email} (limit ${argv.limit}).`,
      entitiesAffected: tasks.map((t) => ({ table: "tasks", id: t.id })),
    };
  },
});
