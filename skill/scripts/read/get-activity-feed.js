#!/usr/bin/env node
const { runTool } = require("../lib/runner");
const { getClient } = require("../lib/supabase");
const { appError } = require("../lib/envelope");
const { formatDateTime } = require("../lib/time");

runTool({
  name: "get-activity-feed",
  actionType: "read.activity_feed",
  yargsBuilder: (y) =>
    y
      .option("company-id", { type: "string" })
      .option("project-id", { type: "string" })
      .option("user", { type: "string" })
      .option("since", { type: "string" })
      .option("limit", { type: "number", default: 30 }),
  handler: async (argv) => {
    const supa = getClient();
    const since =
      argv.since ?? new Date(Date.now() - 7 * 86400000).toISOString();

    let userId = null;
    if (argv.user) {
      const { data: u, error: e } = await supa
        .from("users")
        .select("id")
        .eq("email", argv.user)
        .maybeSingle();
      if (e) throw appError("DB_ERROR", e.message);
      if (!u) throw appError("NOT_FOUND", `Usuario ${argv.user} no encontrado.`);
      userId = u.id;
    }

    let q = supa
      .from("activities")
      .select(
        "id, type, channel, description, occurred_at, company:companies(name), project:projects(name)",
      )
      .gte("occurred_at", since)
      .order("occurred_at", { ascending: false })
      .limit(argv.limit);

    if (argv["company-id"]) q = q.eq("company_id", argv["company-id"]);
    if (argv["project-id"]) q = q.eq("project_id", argv["project-id"]);
    if (userId) q = q.eq("logged_by_id", userId);

    const { data, error } = await q;
    if (error) throw appError("DB_ERROR", error.message);

    const summary =
      (data?.length ?? 0) === 0
        ? "Sin actividades en el rango."
        : `${data.length} actividades en los últimos ${argv.since ? "días filtrados" : "7 días"}.`;

    const activities = (data ?? []).map((a) => ({
      id: a.id,
      type: a.type,
      channel: a.channel,
      description: a.description,
      occurred_at: formatDateTime(a.occurred_at),
      company: a.company?.name ?? null,
      project: a.project?.name ?? null,
    }));

    return {
      data: { activities },
      summary,
      requestSummary: `Feed de actividades since=${since}, limit=${argv.limit}.`,
    };
  },
});
