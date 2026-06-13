#!/usr/bin/env node
const { runTool } = require("../lib/runner");
const { getClient } = require("../lib/supabase");
const { findCompanyByAny } = require("../lib/db-helpers");

runTool({
  name: "get-company",
  actionType: "read.company",
  yargsBuilder: (y) =>
    y
      .option("id", { type: "string" })
      .option("nit", { type: "string" })
      .option("name", { type: "string" }),
  handler: async (argv) => {
    const company = await findCompanyByAny({
      id: argv.id,
      nit: argv.nit,
      name: argv.name,
    });
    const supa = getClient();

    const [
      { data: contacts },
      { data: projects },
      { data: deals },
      { data: activities },
      { data: assignedTo },
      { data: persona },
    ] = await Promise.all([
      supa.from("contacts").select("*").eq("company_id", company.id),
      supa
        .from("projects")
        .select("id, name, status, service_type, value_bob, target_end_date")
        .eq("company_id", company.id)
        .in("status", ["PLANNING", "ACTIVE", "ON_HOLD"]),
      supa
        .from("pipeline_deals")
        .select("id, title, stage, value_bob, expected_close_date")
        .eq("company_id", company.id)
        .not("stage", "in", "(WON,LOST)"),
      supa
        .from("activities")
        .select("id, type, channel, description, occurred_at")
        .eq("company_id", company.id)
        .order("occurred_at", { ascending: false })
        .limit(5),
      company.assigned_to_id
        ? supa
            .from("users")
            .select("email, full_name")
            .eq("id", company.assigned_to_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      company.primary_persona_id
        ? supa
            .from("personas")
            .select("name, segment")
            .eq("id", company.primary_persona_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const summary =
      `${company.name} (${company.status}) en ${company.city ?? company.department ?? "ubicación desconocida"}. ` +
      `${contacts?.length ?? 0} contactos, ${projects?.length ?? 0} proyectos activos, ${deals?.length ?? 0} negocios abiertos.`;

    return {
      data: {
        company: {
          ...company,
          assigned_to: assignedTo?.full_name ?? null,
          primary_persona: persona?.name ?? null,
        },
        contacts: contacts ?? [],
        active_projects: projects ?? [],
        open_deals: deals ?? [],
        recent_activities: activities ?? [],
      },
      summary,
      requestSummary: `Snapshot de empresa ${company.name} (${company.id}).`,
      entitiesAffected: [{ table: "companies", id: company.id }],
    };
  },
});
