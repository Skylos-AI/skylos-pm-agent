#!/usr/bin/env node
const { runTool } = require("../lib/runner");
const { getClient } = require("../lib/supabase");
const { appError } = require("../lib/envelope");
const { findProjectByAny } = require("../lib/db-helpers");
const { todayIso, daysBetween } = require("../lib/time");

const OPEN = ["TODO", "IN_PROGRESS", "BLOCKED"];

async function analyzeProject(supa, project) {
  const [{ data: tasks }, { data: activities }, { data: company }, { data: owner }] =
    await Promise.all([
      supa
        .from("tasks")
        .select("id, title, status, priority, due_date, updated_at")
        .eq("project_id", project.id),
      supa
        .from("activities")
        .select("occurred_at")
        .eq("project_id", project.id)
        .order("occurred_at", { ascending: false })
        .limit(1),
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
    ]);

  const total = tasks?.length ?? 0;
  const done = (tasks ?? []).filter((t) => t.status === "DONE").length;
  const open = (tasks ?? []).filter((t) => OPEN.includes(t.status)).length;
  const blocked = (tasks ?? []).filter((t) => t.status === "BLOCKED").length;
  const progress_pct = total === 0 ? 0 : Math.round((done / total) * 100);

  const today = todayIso();
  const lastActivityAt = activities?.[0]?.occurred_at ?? project.created_at;
  const days_since_last_activity = Math.max(
    0,
    daysBetween(lastActivityAt, today),
  );

  const upcoming = (tasks ?? [])
    .filter((t) => OPEN.includes(t.status) && t.due_date)
    .filter((t) => {
      const dlt = daysBetween(today, t.due_date);
      return dlt >= 0 && dlt <= 7;
    })
    .map((t) => ({
      title: t.title,
      due_date: t.due_date,
      days_until: daysBetween(today, t.due_date),
    }));

  const blockers = (tasks ?? [])
    .filter((t) => t.status === "BLOCKED")
    .map((t) => ({
      task_id: t.id,
      title: t.title,
      blocked_for_days: Math.max(0, daysBetween(t.updated_at, today)),
    }));

  let pace = "unknown";
  let days_to_target_end = null;
  if (project.target_end_date && project.start_date) {
    const totalSpan = daysBetween(project.start_date, project.target_end_date);
    const elapsed = daysBetween(project.start_date, today);
    days_to_target_end = daysBetween(today, project.target_end_date);
    if (totalSpan > 0) {
      const expected_pct = Math.max(0, Math.min(100, (elapsed / totalSpan) * 100));
      if (progress_pct > expected_pct + 10) pace = "ahead";
      else if (progress_pct < expected_pct - 10) pace = "behind";
      else pace = "on_track";
    }
  }

  const suggestions = [];
  if (blockers.length > 0) {
    suggestions.push(`Desbloquear: ${blockers.map((b) => `"${b.title}"`).join(", ")}.`);
  }
  if (days_since_last_activity > 14) {
    suggestions.push("Registrar contacto con el cliente — sin actividad reciente.");
  }
  if (pace === "behind") {
    suggestions.push("Re-priorizar tareas o ajustar fecha objetivo: vamos atrasados.");
  }
  if (upcoming.length > 0) {
    suggestions.push(
      `Cerrar tareas próximas: ${upcoming.map((u) => u.title).join(", ")}.`,
    );
  }

  return {
    project: {
      id: project.id,
      name: project.name,
      status: project.status,
      service_type: project.service_type,
      owner: owner?.email ?? null,
    },
    company,
    progress_pct,
    tasks: { done, open, blocked, total },
    days_since_last_activity,
    upcoming_milestones: upcoming,
    blockers,
    pace,
    days_to_target_end,
    value_bob: project.value_bob,
    suggested_actions: suggestions,
  };
}

runTool({
  name: "project-follow-up",
  actionType: "skylos.project_follow_up",
  yargsBuilder: (y) =>
    y
      .option("id", { type: "string" })
      .option("name", { type: "string" })
      .option("all-active", { type: "boolean" })
      .option("owner", { type: "string" }),
  handler: async (argv) => {
    const supa = getClient();

    if (argv["all-active"]) {
      let q = supa.from("projects").select("*").eq("status", "ACTIVE");
      if (argv.owner) {
        const { data: u, error: e } = await supa
          .from("users")
          .select("id")
          .eq("email", argv.owner)
          .maybeSingle();
        if (e) throw appError("DB_ERROR", e.message);
        if (!u) throw appError("NOT_FOUND", `Dueño ${argv.owner} no encontrado.`);
        q = q.eq("owner_id", u.id);
      }
      const { data: projects, error } = await q;
      if (error) throw appError("DB_ERROR", error.message);

      const analyses = await Promise.all(
        (projects ?? []).map((p) => analyzeProject(supa, p)),
      );

      const compact = analyses.map((a) => ({
        id: a.project.id,
        name: a.project.name,
        progress_pct: a.progress_pct,
        pace: a.pace,
        days_since_last_activity: a.days_since_last_activity,
        blocker_count: a.blockers.length,
      }));

      const attention = analyses
        .filter(
          (a) =>
            a.blockers.length > 0 ||
            a.days_since_last_activity > 14 ||
            a.pace === "behind",
        )
        .map((a) => {
          const reasons = [];
          if (a.pace === "behind") reasons.push("atrasado");
          if (a.days_since_last_activity > 14)
            reasons.push(`${a.days_since_last_activity}d sin actividad`);
          if (a.blockers.length > 0)
            reasons.push(`${a.blockers.length} bloqueador(es)`);
          return { id: a.project.id, name: a.project.name, reason: reasons.join(", ") };
        });

      const summary =
        `${compact.length} proyectos activos, ${attention.length} requieren atención.`;

      return {
        data: { projects: compact, needing_attention: attention },
        summary,
        requestSummary: `Follow-up de todos los proyectos activos${argv.owner ? ` (${argv.owner})` : ""}.`,
        entitiesAffected: compact.map((p) => ({ table: "projects", id: p.id })),
      };
    }

    const project = await findProjectByAny({ id: argv.id, name: argv.name });
    const analysis = await analyzeProject(supa, project);

    const summary =
      `${analysis.project.name}: ${analysis.progress_pct}% progreso, ritmo ${analysis.pace}` +
      (analysis.blockers.length > 0
        ? `, ${analysis.blockers.length} bloqueador(es)`
        : "") +
      ".";

    return {
      data: analysis,
      summary,
      requestSummary: `Follow-up del proyecto ${analysis.project.name}.`,
      entitiesAffected: [{ table: "projects", id: project.id }],
    };
  },
});
