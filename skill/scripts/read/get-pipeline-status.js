#!/usr/bin/env node
const { runTool } = require("../lib/runner");
const { getClient } = require("../lib/supabase");
const { appError } = require("../lib/envelope");
const { formatDate } = require("../lib/time");

const STAGES = ["LEAD", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"];

runTool({
  name: "get-pipeline-status",
  actionType: "read.pipeline",
  yargsBuilder: (y) =>
    y
      .option("owner", { type: "string" })
      .option("stage", { type: "string", choices: STAGES })
      .option("days", { type: "number" }),
  handler: async (argv) => {
    const supa = getClient();

    let ownerId = null;
    if (argv.owner) {
      const { data: u, error: e } = await supa
        .from("users")
        .select("id, full_name")
        .eq("email", argv.owner)
        .maybeSingle();
      if (e) throw appError("DB_ERROR", e.message);
      if (!u) throw appError("NOT_FOUND", `Dueño no encontrado: ${argv.owner}`);
      ownerId = u.id;
    }

    let q = supa
      .from("pipeline_deals")
      .select(
        "id, title, stage, value_bob, probability, expected_close_date, updated_at, company:companies(name)",
      );

    if (ownerId) q = q.eq("owner_id", ownerId);
    if (argv.stage) q = q.eq("stage", argv.stage);
    if (argv.days) {
      const since = new Date(Date.now() - argv.days * 86400000).toISOString();
      q = q.gte("updated_at", since);
    }

    const { data, error } = await q;
    if (error) throw appError("DB_ERROR", error.message);

    const by_stage = {};
    for (const s of STAGES) by_stage[s] = { count: 0, value_bob: 0 };
    for (const d of data ?? []) {
      by_stage[d.stage].count += 1;
      by_stage[d.stage].value_bob += Number(d.value_bob ?? 0);
    }
    for (const s of STAGES) {
      by_stage[s].value_bob = by_stage[s].value_bob.toFixed(2);
    }

    const total_value_bob = (data ?? [])
      .reduce((acc, d) => acc + Number(d.value_bob ?? 0), 0)
      .toFixed(2);

    const top = (data ?? [])
      .filter((d) => d.expected_close_date)
      .sort(
        (a, b) =>
          new Date(a.expected_close_date) - new Date(b.expected_close_date),
      )
      .slice(0, 10)
      .map((d) => ({
        id: d.id,
        title: d.title,
        stage: d.stage,
        value_bob: d.value_bob,
        probability: d.probability,
        expected_close_date: d.expected_close_date,
        updated_at: formatDate(d.updated_at),
        company: d.company?.name ?? null,
      }));

    const summary =
      `Pipeline: ${data?.length ?? 0} negocios, valor total ${total_value_bob} BOB. ` +
      `Activos: ${by_stage.LEAD.count + by_stage.QUALIFIED.count + by_stage.PROPOSAL.count + by_stage.NEGOTIATION.count}.`;

    return {
      data: { by_stage, total_value_bob, deals: top },
      summary,
      requestSummary: `Estado de pipeline${argv.owner ? ` de ${argv.owner}` : ""}${argv.stage ? ` en ${argv.stage}` : ""}.`,
    };
  },
});
