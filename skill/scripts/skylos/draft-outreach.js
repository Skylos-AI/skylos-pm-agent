#!/usr/bin/env node
const { runTool } = require("../lib/runner");
const { getClient } = require("../lib/supabase");
const { appError } = require("../lib/envelope");
const { findCompanyByAny, resolveContact } = require("../lib/db-helpers");

const isUuid = (s) => /^[0-9a-f-]{36}$/i.test(String(s ?? ""));

runTool({
  name: "draft-outreach",
  actionType: "skylos.draft_outreach",
  yargsBuilder: (y) =>
    y
      .option("company", { type: "string", demandOption: true })
      .option("contact", { type: "string" })
      .option("channel", {
        type: "string",
        choices: ["whatsapp", "email"],
        default: "whatsapp",
      }),
  handler: async (argv) => {
    const company = await findCompanyByAny(
      isUuid(argv.company)
        ? { id: argv.company }
        : /^\d+$/.test(argv.company)
          ? { nit: argv.company }
          : { name: argv.company },
    );

    const supa = getClient();
    const missing = [];

    let persona = null;
    if (company.primary_persona_id) {
      const { data, error } = await supa
        .from("personas")
        .select("name, outreach_template, language")
        .eq("id", company.primary_persona_id)
        .maybeSingle();
      if (error) throw appError("DB_ERROR", error.message);
      persona = data;
    } else {
      missing.push("primary_persona");
    }

    if (!persona || !persona.outreach_template) {
      throw appError(
        "VALIDATION",
        `Empresa ${company.name} no tiene persona/plantilla configurada.`,
        { company_id: company.id },
      );
    }

    let contact = null;
    if (argv.contact) {
      contact = await resolveContact(
        isUuid(argv.contact)
          ? { id: argv.contact }
          : { name: argv.contact, companyId: company.id },
      );
    } else {
      const { data, error } = await supa
        .from("contacts")
        .select("*")
        .eq("company_id", company.id)
        .eq("is_primary", true)
        .maybeSingle();
      if (error) throw appError("DB_ERROR", error.message);
      contact = data;
    }

    const contactName = contact?.full_name?.split(" ")[0] ?? "Gerente General";
    if (!contact) missing.push("contact");

    const message = persona.outreach_template
      .replace(/\{\{contact_name\}\}/g, contactName)
      .replace(/\{\{company_name\}\}/g, company.name);

    const summary =
      `Borrador de outreach para ${company.name} (${persona.name}) listo` +
      (missing.length ? `; falta resolver: ${missing.join(", ")}` : "") +
      ".";

    return {
      data: {
        company: company.name,
        contact: contact?.full_name ?? null,
        persona: persona.name,
        message_text: message,
        channel: argv.channel,
        missing_fields: missing,
      },
      summary,
      requestSummary: `Draft outreach para ${company.name} vía ${argv.channel}.`,
      entitiesAffected: [{ table: "companies", id: company.id }],
    };
  },
});
