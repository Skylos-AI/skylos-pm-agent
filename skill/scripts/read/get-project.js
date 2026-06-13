#!/usr/bin/env node
const { runTool } = require("../lib/runner");
const { getClient } = require("../lib/supabase");
const { findProjectByAny } = require("../lib/db-helpers");

runTool({
  name: "get-project",
  actionType: "read.project",
  yargsBuilder: (y) =>
    y.option("id", { type: "string" }).option("name", { type: "string" }),
  handler: async (argv) => {
    const project = await findProjectByAny({ id: argv.id, name: argv.name });
    const supa = getClient();

    const [
      { data: company },
      { data: owner },
      { data: tasks },
      { data: activities },
    ] = await Promise.all([
      supa
        .from("companies")
        .select("id, name")
        .eq("id", project.company_id)
        .maybeSingle(),
      supa
        .from("users")
        .select("email, full_name")
        .eq("id", project.owner_id)
        .maybeSingle(),
      supa
        .from("tasks")
        .select("id, title, status, priority, due_date")
        .eq("project_id", project.id),
      supa
        .from("activities")
        .select("id, type, channel, description, occurred_at")
        .eq("project_id", project.id)
        .order("occurred_at", { ascending: false })
        .limit(5),
    ]);

    const open = (tasks ?? []).filter((t) =>
      ["TODO", "IN_PROGRESS", "BLOCKED"].includes(t.status),
    );
    const done = (tasks ?? []).filter((t) => t.status === "DONE");

    const summary =
      `${project.name} (${project.status}): ${open.length} tareas abiertas, ${done.length} completadas. ` +
      `Cliente: ${company?.name ?? "?"}. Dueño: ${owner?.full_name ?? "?"}.`;

    return {
      data: {
        project,
        company,
        owner,
        tasks: { open: open.length, done: done.length, items: open },
        recent_activities: activities ?? [],
      },
      summary,
      requestSummary: `Estado del proyecto ${project.name}.`,
      entitiesAffected: [{ table: "projects", id: project.id }],
    };
  },
});
