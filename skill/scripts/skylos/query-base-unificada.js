#!/usr/bin/env node
const { runTool } = require("../lib/runner");
const { getClient } = require("../lib/supabase");
const { appError } = require("../lib/envelope");

const DEPT_WEIGHTS = { Cochabamba: 1.0, "Santa Cruz": 0.8, "La Paz": 0.6 };
const STATUS_WEIGHTS = { LEAD: 1.0, PROSPECT: 0.7 };

runTool({
  name: "query-base-unificada",
  actionType: "skylos.query_base_unificada",
  yargsBuilder: (y) =>
    y
      .option("department", { type: "string" })
      .option("sector", { type: "string" })
      .option("status", { type: "string", default: "LEAD" })
      .option("unassigned", { type: "boolean" })
      .option("no-recent-activity", { type: "number" })
      .option("limit", { type: "number", default: 20 }),
  handler: async (argv) => {
    const supa = getClient();
    let q = supa
      .from("companies")
      .select(
        "id, name, nit, sector, city, department, status, assigned_to_id, updated_at",
      )
      .eq("source", "BASE_UNIFICADA")
      .eq("status", argv.status)
      .limit(200);

    if (argv.department) q = q.eq("department", argv.department);
    if (argv.sector) q = q.eq("sector", argv.sector);
    if (argv.unassigned) q = q.is("assigned_to_id", null);

    const { data: rows, error } = await q;
    if (error) throw appError("DB_ERROR", error.message);

    let pool = rows ?? [];

    if (argv["no-recent-activity"]) {
      const cutoff = new Date(
        Date.now() - argv["no-recent-activity"] * 86400000,
      ).toISOString();
      const ids = pool.map((r) => r.id);
      if (ids.length > 0) {
        const { data: recent, error: e2 } = await supa
          .from("activities")
          .select("company_id")
          .in("company_id", ids)
          .gte("occurred_at", cutoff);
        if (e2) throw appError("DB_ERROR", e2.message);
        const recentSet = new Set((recent ?? []).map((a) => a.company_id));
        pool = pool.filter((c) => !recentSet.has(c.id));
      }
    }

    const now = Date.now();
    const scored = pool.map((c) => {
      const statusW = STATUS_WEIGHTS[c.status] ?? 0.3;
      const deptW = DEPT_WEIGHTS[c.department] ?? 0.5;
      const daysSinceUpdate = Math.max(
        0,
        (now - new Date(c.updated_at).getTime()) / 86400000,
      );
      const staleW = Math.min(daysSinceUpdate / 30, 1);
      const score = +(statusW * 0.4 + deptW * 0.4 + staleW * 0.2).toFixed(3);
      const reasons = [];
      if (c.status === "LEAD") reasons.push("Lead nuevo");
      if (c.department) reasons.push(`en ${c.department}`);
      if (!c.assigned_to_id) reasons.push("sin dueño asignado");
      if (daysSinceUpdate > 14) reasons.push("sin contacto reciente");
      return {
        id: c.id,
        name: c.name,
        nit: c.nit,
        department: c.department,
        sector: c.sector,
        score,
        reason: reasons.join(", "),
      };
    });

    scored.sort((a, b) => b.score - a.score);
    const candidates = scored.slice(0, argv.limit);

    const summary =
      candidates.length === 0
        ? "No hay candidatos con los filtros provistos."
        : `Top ${candidates.length} candidatos. Mejor: ${candidates[0].name} (${candidates[0].score}).`;

    return {
      data: { candidates },
      summary,
      requestSummary: `Query base unificada (dept=${argv.department ?? "*"}, sector=${argv.sector ?? "*"}, status=${argv.status}).`,
    };
  },
});
