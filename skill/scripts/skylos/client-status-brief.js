#!/usr/bin/env node
const { runTool } = require("../lib/runner");
const { getClient } = require("../lib/supabase");
const { findCompanyByAny } = require("../lib/db-helpers");
const { todayIso, daysBetween, formatDate, cap } = require("../lib/time");

const isUuid = (s) => /^[0-9a-f-]{36}$/i.test(String(s ?? ""));

runTool({
  name: "client-status-brief",
  actionType: "skylos.client_status_brief",
  yargsBuilder: (y) => y.option("company", { type: "string", demandOption: true }),
  handler: async (argv) => {
    const company = await findCompanyByAny(
      isUuid(argv.company)
        ? { id: argv.company }
        : /^\d+$/.test(argv.company)
          ? { nit: argv.company }
          : { name: argv.company },
    );

    const supa = getClient();
    const [
      { data: projects },
      { data: deals },
      { data: activities },
    ] = await Promise.all([
      supa
        .from("projects")
        .select("id, name, status, value_bob, target_end_date")
        .eq("company_id", company.id)
        .in("status", ["ACTIVE", "ON_HOLD", "PLANNING"]),
      supa
        .from("pipeline_deals")
        .select("id, title, stage, value_bob, expected_close_date")
        .eq("company_id", company.id)
        .not("stage", "in", "(WON,LOST)"),
      supa
        .from("activities")
        .select("id, type, channel, description, occurred_at")
        .eq("company_id", company.id)
        .order("occurred_at", { ascending: false })
        .limit(5),
    ]);

    const projectIds = (projects ?? []).map((p) => p.id);
    let outstandingTasks = [];
    let activeProjectsEnriched = [];
    if (projectIds.length > 0) {
      const { data: tasks } = await supa
        .from("tasks")
        .select("id, title, status, priority, due_date, project_id")
        .in("project_id", projectIds);
      outstandingTasks = (tasks ?? []).filter((t) =>
        ["TODO", "IN_PROGRESS", "BLOCKED"].includes(t.status),
      );
      activeProjectsEnriched = (projects ?? []).map((p) => {
        const pt = (tasks ?? []).filter((t) => t.project_id === p.id);
        const done = pt.filter((t) => t.status === "DONE").length;
        return {
          ...p,
          progress_summary: `${done} de ${pt.length} tareas completadas`,
        };
      });
    } else {
      activeProjectsEnriched = projects ?? [];
    }

    // Heuristic next-action suggestions.
    const suggestions = [];
    const lastActivity = activities?.[0];
    if (!lastActivity || daysBetween(lastActivity.occurred_at, todayIso()) > 14) {
      suggestions.push("Contactar al cliente — sin interacciones recientes.");
    }
    const blockedTasks = outstandingTasks.filter((t) => t.status === "BLOCKED");
    if (blockedTasks.length > 0) {
      suggestions.push(
        `Desbloquear ${blockedTasks.length} tarea(s): ${blockedTasks
          .map((t) => `"${t.title}"`)
          .join(", ")}.`,
      );
    }
    if ((deals?.length ?? 0) > 0) {
      suggestions.push(
        `Avanzar ${deals.length} oportunidad(es) abierta(s) en pipeline.`,
      );
    }

    const summary =
      `${company.name}: ${activeProjectsEnriched.length} proyectos activos, ` +
      `${outstandingTasks.length} tareas abiertas, ${deals?.length ?? 0} negocios en pipeline.`;

    return {
      data: {
        company: { id: company.id, name: company.name, status: company.status },
        active_projects: activeProjectsEnriched,
        outstanding_tasks: cap(outstandingTasks, 10, (t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          due_date: t.due_date,
        })),
        recent_activities: (activities ?? []).map((a) => ({
          id: a.id,
          type: a.type,
          channel: a.channel,
          description: a.description,
          occurred_at: formatDate(a.occurred_at),
        })),
        open_deals: deals ?? [],
        next_actions_suggested: suggestions,
      },
      summary,
      requestSummary: `Brief de cliente ${company.name}.`,
      entitiesAffected: [{ table: "companies", id: company.id }],
    };
  },
});
