#!/usr/bin/env node
const { runTool } = require("../lib/runner");
const { getClient } = require("../lib/supabase");
const { appError } = require("../lib/envelope");
const {
  todayIso,
  startOfDayUtc,
  endOfDayUtc,
  formatDateTime,
  cap,
  truncate,
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
      { data: outreachDue },
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
      // Chase queue — same criteria as plan-outreach-day (campaign is solo-Jhonny,
      // so no per-user filter)
      supa
        .from("companies")
        .select("id, name, city, preferred_channel, next_touch_at")
        .not("next_touch_at", "is", null)
        .lte("next_touch_at", endIso)
        .in("status", ["LEAD", "PROSPECT", "ACTIVE_CLIENT"])
        .order("next_touch_at", { ascending: true })
        .limit(10),
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

    const CHANNEL_LABEL = {
      IN_PERSON: "presencial",
      EMAIL: "email",
      PHONE: "teléfono",
      WHATSAPP: "WhatsApp",
      MIXED: "mixto",
    };
    const byChannel = {};
    for (const c of outreachDue ?? []) {
      const label = CHANNEL_LABEL[c.preferred_channel] ?? "sin canal";
      byChannel[label] = (byChannel[label] ?? 0) + 1;
    }
    const outreachLine =
      (outreachDue?.length ?? 0) === 0
        ? ""
        : ` ${outreachDue.length} empresa(s) para chasear (${Object.entries(byChannel)
            .map(([k, n]) => `${n} ${k}`)
            .join(", ")}).`;

    const summary =
      `${target.full_name.split(" ")[0]}, hoy: ${dueToday?.length ?? 0} tareas, ` +
      `${overdue?.length ?? 0} vencidas, ${pipelineMoves?.length ?? 0} movimientos de pipeline, ` +
      `${recentActivities.length} interacciones recientes.` +
      outreachLine;

    const flatTask = (t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      due_date: t.due_date,
      project: t.project?.name ?? null,
    });
    const flatDeal = (d) => ({
      id: d.id,
      title: d.title,
      stage: d.stage,
      value_bob: d.value_bob,
      updated_at: formatDateTime(d.updated_at),
      company: d.company?.name ?? null,
    });
    const flatActivity = (a) => ({
      id: a.id,
      type: a.type,
      channel: a.channel,
      description: truncate(a.description),
      occurred_at: formatDateTime(a.occurred_at),
      company: a.company?.name ?? null,
    });
    const flatReminder = (r) => ({
      id: r.id,
      message: truncate(r.message),
      trigger_at: formatDateTime(r.trigger_at),
      status: r.status,
    });

    return {
      data: {
        date,
        user: target.email,
        tasks_due_today: cap(dueToday ?? [], 10, flatTask),
        overdue: cap(overdue ?? [], 10, flatTask),
        pipeline_moves: cap(pipelineMoves ?? [], 10, flatDeal),
        recent_activities: cap(recentActivities ?? [], 10, flatActivity),
        reminders: cap(remindersToday ?? [], 10, flatReminder),
        outreach_due: cap(outreachDue ?? [], 10, (c) => ({
          id: c.id,
          name: c.name,
          city: c.city,
          channel: c.preferred_channel,
          next_touch_at: c.next_touch_at?.slice(0, 10) ?? null,
        })),
      },
      summary,
      requestSummary: `Standup de ${target.email} para ${date}.`,
    };
  },
});
