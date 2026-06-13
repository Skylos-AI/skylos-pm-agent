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

const isUuid = (s) => /^[0-9a-f-]{36}$/i.test(String(s ?? ""));

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
    const { data, error } = await supa
      .from("activities")
      .insert({
        company_id: company.id,
        contact_id: contactId,
        project_id: projectId,
        type: argv.type,
        channel: argv.channel,
        description: argv.description,
        occurred_at: argv["occurred-at"] ?? new Date().toISOString(),
        logged_by_id: user.id,
        logged_by_agent: true,
      })
      .select("*")
      .single();
    if (error) throw appError("DB_ERROR", error.message);

    const summary = `Registrada actividad ${argv.type} con ${company.name} vía ${argv.channel}.`;

    return {
      data: { activity: data },
      summary,
      requestSummary: `Log ${argv.type} con ${company.name} (${argv.channel}).`,
      entitiesAffected: [
        { table: "activities", id: data.id },
        { table: "companies", id: company.id },
      ],
    };
  },
});
