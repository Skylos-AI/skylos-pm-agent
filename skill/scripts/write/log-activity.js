#!/usr/bin/env node
const { runTool } = require("../lib/runner");
const { getClient } = require("../lib/supabase");
const { appError } = require("../lib/envelope");
const {
  findCompanyByAny,
  findProjectByAny,
  resolveContact,
} = require("../lib/db-helpers");

const TYPES = [
  "CALL",
  "MEETING",
  "MESSAGE_SENT",
  "MESSAGE_RECEIVED",
  "EMAIL",
  "NOTE",
  "MILESTONE",
  "PROPOSAL_SENT",
  "CONTRACT_SIGNED",
];
const CHANNELS = [
  "WHATSAPP",
  "PHONE",
  "IN_PERSON",
  "EMAIL",
  "VIDEO_CALL",
  "OTHER",
];
const OUTCOMES = [
  "NO_ANSWER",
  "REACHED",
  "INTERESTED",
  "NOT_INTERESTED",
  "CALLBACK_REQUESTED",
  "MEETING_SCHEDULED",
  "VOICEMAIL_LEFT",
  "NEUTRAL",
];

const isUuid = (s) => /^[0-9a-f-]{36}$/i.test(String(s ?? ""));

async function resolveAsset(supa, hint) {
  if (isUuid(hint)) {
    const { data, error } = await supa
      .from("assets")
      .select("id, name")
      .eq("id", hint)
      .maybeSingle();
    if (error) throw appError("DB_ERROR", error.message);
    if (!data) throw appError("NOT_FOUND", `Asset ${hint} no encontrado.`);
    return data;
  }
  const { data, error } = await supa
    .from("assets")
    .select("id, name")
    .ilike("name", `%${hint}%`)
    .eq("active", true)
    .limit(5);
  if (error) throw appError("DB_ERROR", error.message);
  if (!data || data.length === 0)
    throw appError("NOT_FOUND", `Asset "${hint}" no encontrado.`);
  if (data.length > 1)
    throw appError(
      "VALIDATION",
      `Múltiples assets coinciden con "${hint}". Especifica con id.`,
      { candidates: data.map((a) => ({ id: a.id, name: a.name })) },
    );
  return data[0];
}

runTool({
  name: "log-activity",
  actionType: "write.activity_log",
  yargsBuilder: (y) =>
    y
      .option("company", { type: "string", demandOption: true })
      .option("type", { type: "string", choices: TYPES, demandOption: true })
      .option("description", { type: "string", demandOption: true })
      .option("contact", { type: "string" })
      .option("project", { type: "string" })
      .option("channel", { type: "string", choices: CHANNELS, default: "OTHER" })
      .option("outcome", { type: "string", choices: OUTCOMES })
      .option("asset", { type: "string" })
      .option("next-touch", { type: "string" })
      .option("occurred-at", { type: "string" }),
  handler: async (argv, { user }) => {
    const company = await findCompanyByAny(
      isUuid(argv.company)
        ? { id: argv.company }
        : /^\d+$/.test(argv.company)
          ? { nit: argv.company }
          : { name: argv.company },
    );

    let projectId = null;
    if (argv.project) {
      const p = await findProjectByAny(
        isUuid(argv.project) ? { id: argv.project } : { name: argv.project },
      );
      projectId = p.id;
    }

    let contactId = null;
    if (argv.contact) {
      const c = await resolveContact(
        isUuid(argv.contact)
          ? { id: argv.contact }
          : { name: argv.contact, companyId: company.id },
      );
      contactId = c?.id ?? null;
    }

    const supa = getClient();

    let asset = null;
    if (argv.asset) asset = await resolveAsset(supa, argv.asset);

    const { data, error } = await supa
      .from("activities")
      .insert({
        company_id: company.id,
        contact_id: contactId,
        project_id: projectId,
        asset_id: asset?.id ?? null,
        type: argv.type,
        channel: argv.channel,
        outcome: argv.outcome ?? null,
        description: argv.description,
        occurred_at: argv["occurred-at"] ?? new Date().toISOString(),
        logged_by_id: user.id,
        logged_by_agent: true,
      })
      .select("*")
      .single();
    if (error) throw appError("DB_ERROR", error.message);

    const entities = [
      { table: "activities", id: data.id },
      { table: "companies", id: company.id },
    ];

    if (argv["next-touch"]) {
      const { error: updErr } = await supa
        .from("companies")
        .update({ next_touch_at: argv["next-touch"] })
        .eq("id", company.id);
      if (updErr) throw appError("DB_ERROR", updErr.message);
    }

    const summary =
      `Registrada actividad ${argv.type} con ${company.name} vía ${argv.channel}` +
      (argv.outcome ? `, resultado ${argv.outcome}` : "") +
      (asset ? `, asset "${asset.name}"` : "") +
      (argv["next-touch"] ? `, próximo toque ${argv["next-touch"]}` : "") +
      ".";

    return {
      data: { activity: data },
      summary,
      requestSummary: `Log ${argv.type} con ${company.name} (${argv.channel}).`,
      entitiesAffected: entities,
    };
  },
});
