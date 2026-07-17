#!/usr/bin/env node
const { runTool } = require("../lib/runner");
const { getClient } = require("../lib/supabase");
const { appError } = require("../lib/envelope");
const { todayIso, endOfDayUtc } = require("../lib/time");

const CHANNEL_LABEL = {
  IN_PERSON: "presencial",
  EMAIL: "email",
  PHONE: "teléfono",
  WHATSAPP: "WhatsApp",
  MIXED: "mixto",
};

runTool({
  name: "plan-outreach-day",
  actionType: "read.outreach_plan_day",
  yargsBuilder: (y) =>
    y
      .option("date", {
        type: "string",
        describe: "Fecha ISO (YYYY-MM-DD). Default: hoy.",
      })
      .option("limit", { type: "number", default: 20 }),
  handler: async (argv, { user }) => {
    const supa = getClient();
    const today = argv.date ?? todayIso();
    const endOfDay = endOfDayUtc(today).toISOString();

    // No notes/pitch content here — 20 queued companies × full pitch scripts
    // would blow up the response. Use get-company for the detail.
    const { data, error } = await supa
      .from("companies")
      .select(
        "id, name, status, city, department, preferred_channel, next_touch_at",
      )
      .lte("next_touch_at", endOfDay)
      .not("next_touch_at", "is", null)
      .in("status", ["LEAD", "PROSPECT", "ACTIVE_CLIENT"])
      .order("next_touch_at", { ascending: true })
      .limit(argv.limit);
    if (error) throw appError("DB_ERROR", error.message);

    const buckets = { IN_PERSON: [], EMAIL: [], PHONE: [], WHATSAPP: [], MIXED: [], SIN_CANAL: [] };
    for (const c of data) {
      const key = c.preferred_channel ?? "SIN_CANAL";
      (buckets[key] ?? buckets.SIN_CANAL).push(c);
    }

    const parts = [];
    for (const [k, list] of Object.entries(buckets)) {
      if (list.length === 0) continue;
      const label = CHANNEL_LABEL[k] ?? "sin canal preferido";
      const items = list
        .map(
          (c) =>
            `${c.name}${c.city ? ` (${c.city})` : ""}${c.next_touch_at ? ` — programado ${c.next_touch_at.slice(0, 10)}` : ""}`,
        )
        .join("; ");
      parts.push(`${label}: ${items}`);
    }

    const summary =
      data.length === 0
        ? `Ningún seguimiento programado para hoy (${today}). Día libre.`
        : `Para ${today} hay ${data.length} empresa${data.length === 1 ? "" : "s"} para chasear. ${parts.join(". ")}.`;

    return {
      data: {
        date: today,
        total: data.length,
        buckets,
      },
      summary,
      requestSummary: `Planear día de outreach para ${today} (usuario ${user.full_name}).`,
      entitiesAffected: null,
    };
  },
});
