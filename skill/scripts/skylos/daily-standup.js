#!/usr/bin/env node
const { runTool } = require("../lib/runner");
const { getClient } = require("../lib/supabase");
const { appError } = require("../lib/envelope");
const {
  todayIso,
  startOfDayUtc,
  endOfDayUtc,
} = require("../lib/time");

const OPEN = ["TODO", "IN_PROGRESS", "BLOCKED"];

runTool({
  name: "daily-standup",
  actionType: "skylos.daily_standup",
  yargsBuilder: (y) =>
    y.option("user", { type: "string" }).option("date", { type: "string" }),
  handler: async (argv, { user }) => {
    const supa = getClient();

    let target = user;
    if (argv.user && argv.user !== user.email) {
      const { data: u, error: e } = await supa
        .from("users")
        .select("id, email, full_name")
        .eq("email", argv.user)
        .maybeSingle();
      if (e) throw appError("DB_ERROR", e.message);
      if (!u) throw appError("NOT_FOUND", `Usuario ${argv.user} no encontrado.`);
      target = u;
    }

    const date = argv.date ?? todayIso();
    const startUtc = startOfDayUtc(date);
    const endUtc = endOfDayUtc(date);
    const startIso = startUtc.toISOString();
    const endIso = endUtc.toISOString();
    const yesterdayIso = new Date(startUtc.getTime() - 86400000).toISOString();

    const [
      { data: dueToday },
      { data: overdue },
      { data: pipelineMoves },
      { data: ownedCompanies },
      { data: remindersToday },
    ] = await Promise.all([
      supa
        .from("tasks")
        .select("id, title, status, priority, due_date, project:projects(name)")
        .eq("assignee_id", target.id)
        .in("status", OPEN)
        .gte("due_date", startIso)
        .lte("due_date", endIso),
      supa
        .from("tasks")
        .select("id, title, status, priority, due_date, project:projects(name)")
        .eq("assignee_id", target.id)
        .in("status", OPEN)
        .lt("due_date", startIso),
      supa
        .from("pipeline_deals")
        .select("id, title, stage, value_bob, updated_at, company:companies(name)")
        .eq("owner_id", target.id)
        .gte("updated_at", yesterdayIso),
      supa
        .from("companies")
        .select("id")
        .eq("assigned_to_id", target.id),
      supa
        .from("reminders")
        .select("id, message, trigger_at, status")
        .eq("target_user_id", target.id)
        .gte("trigger_at", startIso)
        .lte("trigger_at", endIso),
    ]);

    const ownedCompanyIds = (ownedCompanies ?? []).map((c) => c.id);
    let recentActivities = [];
    if (ownedCompanyIds.length > 0) {
      const { data: acts } = await supa
        .from("activities")
        .select("id, type, channel, description, occurred_at, company:companies(name)")
        .in("company_id", ownedCompanyIds)
        .gte("occurred_at", yesterdayIso)
        .order("occurred_at", { ascending: false })
        .limit(10);
      recentActivities = acts ?? [];
    }

    const summary =
      `${target.full_name.split(" ")[0]}, hoy: ${dueToday?.length ?? 0} tareas, ` +
      `${overdue?.length ?? 0} vencidas, ${pipelineMoves?.length ?? 0} movimientos de pipeline, ` +
      `${recentActivities.length} interacciones recientes.`;

    return {
      data: {
        date,
        user: target.email,
        tasks_due_today: dueToday ?? [],
        overdue_tasks: overdue ?? [],
        new_pipeline_movements: pipelineMoves ?? [],
        recent_activities_on_owned_clients: recentActivities,
        reminders_today: remindersToday ?? [],
      },
      summary,
      requestSummary: `Standup de ${target.email} para ${date}.`,
    };
  },
});
