#!/usr/bin/env node
const { runTool } = require("../lib/runner");
const { getClient } = require("../lib/supabase");
const { appError } = require("../lib/envelope");
const { findDealByAny } = require("../lib/db-helpers");
const { todayIso } = require("../lib/time");

const STAGES = ["LEAD", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"];

runTool({
  name: "update-pipeline-deal",
  actionType: "write.deal_update",
  yargsBuilder: (y) =>
    y
      .option("id", { type: "string" })
      .option("title", { type: "string" })
      .option("stage", { type: "string", choices: STAGES })
      .option("value", { type: "number" })
      .option("probability", { type: "number" })
      .option("expected-close", { type: "string" })
      .option("lost-reason", { type: "string" }),
  handler: async (argv) => {
    const deal = await findDealByAny({ id: argv.id, title: argv.title });

    if (argv.stage === "LOST" && !argv["lost-reason"]) {
      throw appError(
        "VALIDATION",
        "Para mover a LOST debes enviar --lost-reason.",
      );
    }
    if (
      typeof argv.probability === "number" &&
      (argv.probability < 0 || argv.probability > 100)
    ) {
      throw appError("VALIDATION", "probability debe estar entre 0 y 100.");
    }

    const update = {};
    if (argv.stage) {
      update.stage = argv.stage;
      if (argv.stage === "WON") update.actual_close_date = todayIso();
      if (argv.stage === "LOST") {
        update.actual_close_date = todayIso();
        update.lost_reason = argv["lost-reason"];
      }
    }
    if (typeof argv.value === "number") update.value_bob = argv.value.toFixed(2);
    if (typeof argv.probability === "number")
      update.probability = argv.probability;
    if (argv["expected-close"])
      update.expected_close_date = argv["expected-close"];

    const supa = getClient();
    const { data, error } = await supa
      .from("pipeline_deals")
      .update(update)
      .eq("id", deal.id)
      .select("*")
      .single();
    if (error) throw appError("DB_ERROR", error.message);

    const summary =
      `Negocio "${deal.title}"` +
      (argv.stage ? ` movido de ${deal.stage} a ${argv.stage}` : " actualizado") +
      (typeof argv.value === "number" ? `, valor ${argv.value} BOB` : "") +
      ".";

    return {
      data: { deal: data },
      summary,
      requestSummary: `Actualizar negocio ${deal.id}: ${JSON.stringify(update)}.`,
      entitiesAffected: [{ table: "pipeline_deals", id: deal.id }],
    };
  },
});
