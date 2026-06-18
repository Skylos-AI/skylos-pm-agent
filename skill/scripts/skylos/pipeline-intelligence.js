#!/usr/bin/env node
const { runTool } = require("../lib/runner");
const { getClient } = require("../lib/supabase");
const { appError } = require("../lib/envelope");

const STAGES = ["LEAD", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"];

runTool({
  name: "pipeline-intelligence",
  actionType: "skylos.pipeline_intelligence",
  yargsBuilder: (y) =>
    y
      .option("owner", { type: "string" })
      .option("stuck-days", { type: "number", default: 14 }),
  handler: async (argv) => {
    const supa = getClient();

    let ownerId = null;
    if (argv.owner) {
      const { data: u, error: e } = await supa
        .from("users")
        .select("id")
        .eq("email", argv.owner)
        .maybeSingle();
      if (e) throw appError("DB_ERROR", e.message);
      if (!u) throw appError("NOT_FOUND", `Dueño ${argv.owner} no encontrado.`);
      ownerId = u.id;
    }

    let q = supa
      .from("pipeline_deals")
      .select(
        "id, title, stage, value_bob, probability, expected_close_date, owner_id, updated_at",
      );
    if (ownerId) q = q.eq("owner_id", ownerId);

    const { data: deals, error } = await q;
    if (error) throw appError("DB_ERROR", error.message);

    const now = Date.now();
    const stuckCutoffMs = argv["stuck-days"] * 86400000;

    const stuckAll = (deals ?? [])
      .filter((d) => !["WON", "LOST"].includes(d.stage))
      .map((d) => ({
        id: d.id,
        title: d.title,
        stage: d.stage,
        days_in_stage: Math.floor(
          (now - new Date(d.updated_at).getTime()) / 86400000,
        ),
        value_bob: d.value_bob,
      }))
      .filter((d) => d.days_in_stage > argv["stuck-days"])
      .sort((a, b) => b.days_in_stage - a.days_in_stage);

    const stuck =
      stuckAll.length > 15
        ? { items: stuckAll.slice(0, 15), total: stuckAll.length, shown: 15 }
        : { items: stuckAll, total: stuckAll.length };

    const hot = (deals ?? [])
      .filter(
        (d) =>
          ["QUALIFIED", "PROPOSAL", "NEGOTIATION"].includes(d.stage) &&
          (d.probability ?? 0) >= 60 &&
          now - new Date(d.updated_at).getTime() < stuckCutoffMs,
      )
      .sort((a, b) => (b.probability ?? 0) - (a.probability ?? 0))
      .slice(0, 10)
      .map((d) => ({
        id: d.id,
        title: d.title,
        stage: d.stage,
        value_bob: d.value_bob,
        probability: d.probability,
        expected_close_date: d.expected_close_date,
      }));

    // Conversion: how often a deal moves from stage X to a "later" stage vs. dies.
    // Approximation: for each open stage, count deals currently there vs. total
    // ever-entered that stage (we only have current state, so this is rough).
    const stageCounts = Object.fromEntries(STAGES.map((s) => [s, 0]));
    for (const d of deals ?? []) stageCounts[d.stage] += 1;

    const safeRatio = (num, den) => (den === 0 ? null : +(num / den).toFixed(2));
    const cum = (...stages) =>
      stages.reduce((acc, s) => acc + stageCounts[s], 0);

    const conversion = {
      lead_to_qualified: safeRatio(
        cum("QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON"),
        cum("LEAD", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"),
      ),
      qualified_to_proposal: safeRatio(
        cum("PROPOSAL", "NEGOTIATION", "WON"),
        cum("QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON"),
      ),
      proposal_to_won: safeRatio(cum("WON"), cum("PROPOSAL", "NEGOTIATION", "WON")),
      sample_size: deals?.length ?? 0,
    };

    const summary =
      `${stuckAll.length} negocios estancados (>${argv["stuck-days"]} días), ${hot.length} calientes. ` +
      `Conversión propuesta→ganado: ${conversion.proposal_to_won ?? "s/d"}.`;

    return {
      data: { stuck_deals: stuck, hot_leads: hot, conversion },
      summary,
      requestSummary: `Pipeline intelligence (stuck>${argv["stuck-days"]}d${argv.owner ? `, owner=${argv.owner}` : ""}).`,
    };
  },
});
