#!/usr/bin/env node
const { runTool } = require("../lib/runner");
const { getClient } = require("../lib/supabase");
const { appError } = require("../lib/envelope");
const { findCompanyByAny } = require("../lib/db-helpers");

const STAGES = ["LEAD", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"];
const isUuid = (s) => /^[0-9a-f-]{36}$/i.test(String(s ?? ""));

async function resolveOwner(supa, hint) {
  if (isUuid(hint)) {
    const { data, error } = await supa
      .from("users")
      .select("id, full_name, email")
      .eq("id", hint)
      .maybeSingle();
    if (error) throw appError("DB_ERROR", error.message);
    if (!data) throw appError("NOT_FOUND", `Usuario ${hint} no encontrado.`);
    return data;
  }
  if (hint.includes("@")) {
    const { data, error } = await supa
      .from("users")
      .select("id, full_name, email")
      .eq("email", hint)
      .maybeSingle();
    if (error) throw appError("DB_ERROR", error.message);
    if (!data) throw appError("NOT_FOUND", `Usuario ${hint} no encontrado.`);
    return data;
  }
  const { data, error } = await supa
    .from("users")
    .select("id, full_name, email")
    .ilike("full_name", `%${hint}%`)
    .limit(5);
  if (error) throw appError("DB_ERROR", error.message);
  if (!data || data.length === 0)
    throw appError("NOT_FOUND", `Usuario "${hint}" no encontrado.`);
  if (data.length > 1)
    throw appError(
      "VALIDATION",
      `Múltiples usuarios coinciden con "${hint}". Especifica con email o id.`,
      { candidates: data.map((u) => ({ id: u.id, full_name: u.full_name, email: u.email })) },
    );
  return data[0];
}

runTool({
  name: "create-pipeline-deal",
  actionType: "write.deal_create",
  yargsBuilder: (y) =>
    y
      .option("company", { type: "string", demandOption: true })
      .option("title", { type: "string", demandOption: true })
      .option("stage", { type: "string", choices: STAGES, default: "LEAD" })
      .option("value", { type: "number" })
      .option("probability", { type: "number" })
      .option("expected-close", { type: "string" })
      .option("owner", { type: "string" }),
  handler: async (argv, { user }) => {
    const company = await findCompanyByAny(
      isUuid(argv.company)
        ? { id: argv.company }
        : /^\d+$/.test(argv.company)
          ? { nit: argv.company }
          : { name: argv.company },
    );

    if (
      typeof argv.probability === "number" &&
      (argv.probability < 0 || argv.probability > 100)
    ) {
      throw appError("VALIDATION", "probability debe estar entre 0 y 100.");
    }

    const supa = getClient();

    let ownerId = user.id;
    let ownerLabel = user.full_name;
    if (argv.owner) {
      const owner = await resolveOwner(supa, argv.owner);
      ownerId = owner.id;
      ownerLabel = owner.full_name;
    }

    const insert = {
      company_id: company.id,
      title: argv.title,
      stage: argv.stage,
      owner_id: ownerId,
    };
    if (typeof argv.value === "number") insert.value_bob = argv.value.toFixed(2);
    if (typeof argv.probability === "number") insert.probability = argv.probability;
    if (argv["expected-close"]) insert.expected_close_date = argv["expected-close"];

    const { data, error } = await supa
      .from("pipeline_deals")
      .insert(insert)
      .select("*")
      .single();
    if (error) throw appError("DB_ERROR", error.message);

    const summary =
      `Negocio "${argv.title}" creado para ${company.name}` +
      (argv.stage !== "LEAD" ? ` en etapa ${argv.stage}` : "") +
      (typeof argv.value === "number" ? `, valor ${argv.value} BOB` : "") +
      (ownerId !== user.id ? `, dueño ${ownerLabel}` : "") +
      ".";

    return {
      data: { deal: data },
      summary,
      requestSummary: `Crear negocio "${argv.title}" para ${company.name} en ${argv.stage}.`,
      entitiesAffected: [
        { table: "pipeline_deals", id: data.id },
        { table: "companies", id: company.id },
      ],
    };
  },
});
