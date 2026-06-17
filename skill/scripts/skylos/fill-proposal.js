#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const { runTool } = require("../lib/runner");
const { getClient } = require("../lib/supabase");
const { appError } = require("../lib/envelope");
const { findCompanyByAny, resolveContact } = require("../lib/db-helpers");

const SERVICES = {
  AI_AUDIT: { slug: "ai-audit", label: "AI Audit" },
  AUTOMATION: { slug: "automation", label: "Automatización" },
  CUSTOM_SOFTWARE: { slug: "automation", label: "Software a medida" },
  BLOCKCHAIN_WEB3: { slug: "automation", label: "Blockchain / Web3" },
  TRAINING: { slug: "ai-audit", label: "Capacitación" },
  RETAINER: { slug: "retainer", label: "Retainer Skylos" },
};

const ASSETS_DIR = path.resolve(__dirname, "..", "..", "assets");

const isUuid = (s) => /^[0-9a-f-]{36}$/i.test(String(s ?? ""));

function todayLabel() {
  return new Date().toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatUsd(value) {
  if (value === null || value === undefined || value === "") return "(por definir)";
  const n = Number(value);
  if (Number.isNaN(n)) return "(por definir)";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function painPointsBullets(persona) {
  const pp = persona?.pain_points;
  if (!Array.isArray(pp) || pp.length === 0) return "";
  return pp.map((p) => `- ${p}`).join("\n");
}

function fill(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = vars[key];
    return v === undefined || v === null ? "" : String(v);
  });
}

runTool({
  name: "fill-proposal",
  actionType: "skylos.fill_proposal",
  yargsBuilder: (y) =>
    y
      .option("company", { type: "string", demandOption: true })
      .option("service", {
        type: "string",
        choices: Object.keys(SERVICES),
        demandOption: true,
      })
      .option("value", { type: "number" })
      .option("contact", { type: "string" })
      .option("template", { type: "string" }),
  handler: async (argv, { user }) => {
    const service = SERVICES[argv.service];
    if (!service) {
      throw appError("VALIDATION", `Servicio inválido: ${argv.service}.`);
    }

    const company = await findCompanyByAny(
      isUuid(argv.company)
        ? { id: argv.company }
        : /^\d+$/.test(argv.company)
          ? { nit: argv.company }
          : { name: argv.company },
    );

    const supa = getClient();

    let persona = null;
    if (company.primary_persona_id) {
      const { data } = await supa
        .from("personas")
        .select("name, pain_points")
        .eq("id", company.primary_persona_id)
        .maybeSingle();
      persona = data;
    }

    let contact = null;
    if (argv.contact) {
      contact = await resolveContact(
        isUuid(argv.contact)
          ? { id: argv.contact }
          : { name: argv.contact, companyId: company.id },
      );
    } else {
      const { data } = await supa
        .from("contacts")
        .select("*")
        .eq("company_id", company.id)
        .eq("is_primary", true)
        .maybeSingle();
      contact = data;
    }

    const templateSlug = argv.template || service.slug;
    const templatePath = path.join(
      ASSETS_DIR,
      "proposals",
      `${templateSlug}.md`,
    );
    if (!fs.existsSync(templatePath)) {
      throw appError(
        "NOT_FOUND",
        `Template no encontrado en ${templatePath}.`,
        { tried: templatePath },
      );
    }
    const template = fs.readFileSync(templatePath, "utf8");

    const contactFullName = contact?.full_name ?? "Gerente General";
    const contactFirstName = contactFullName.split(" ")[0];

    const filled = fill(template, {
      company_name: company.name,
      contact_name: contactFirstName,
      contact_full_name: contactFullName,
      sector: company.sector ?? "",
      persona_name: persona?.name ?? "",
      persona_pain_points: painPointsBullets(persona),
      service_type: service.label,
      value_usd: formatUsd(argv.value),
      author_name: user?.full_name ?? "Skylos",
      today: todayLabel(),
    });

    const summary =
      `Borrador de propuesta ${service.label} para ${company.name} (${templateSlug}.md) listo` +
      (typeof argv.value === "number" ? ` con valor ${formatUsd(argv.value)}` : "") +
      ".";

    return {
      data: {
        company: company.name,
        service: service.label,
        template: templateSlug,
        contact: contactFullName,
        proposal_text: filled,
      },
      summary,
      requestSummary: `Fill proposal ${templateSlug} para ${company.name}.`,
      entitiesAffected: [{ table: "companies", id: company.id }],
    };
  },
});
