#!/usr/bin/env node
const { runTool } = require("../lib/runner");
const { getClient } = require("../lib/supabase");
const { findCompanyByAny } = require("../lib/db-helpers");
const { formatDate, cap, truncate, todayIso, daysBetween } = require("../lib/time");

const CHANNEL_LABEL = {
  IN_PERSON: "presencial",
  EMAIL: "email",
  PHONE: "teléfono",
  WHATSAPP: "WhatsApp",
  MIXED: "mixto",
};
const NO_CONTACT = ["NO_ANSWER", "VOICEMAIL_LEFT"];

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
      { data: sharedAssets },
      { data: assignedTo },
      { data: persona },
    ] = await Promise.all([
      supa
        .from("contacts")
        .select("id, full_name, role, phone, email, is_primary")
        .eq("company_id", company.id),
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
        .select("id, type, channel, outcome, description, occurred_at")
        .eq("company_id", company.id)
        .order("occurred_at", { ascending: false })
        .limit(5),
      supa
        .from("activities")
        .select("occurred_at, asset:assets(name, kind)")
        .eq("company_id", company.id)
        .not("asset_id", "is", null)
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

    const today = todayIso();
    const nextTouch = formatDate(company.next_touch_at);
    const channelLabel = CHANNEL_LABEL[company.preferred_channel] ?? null;

    const followUp = nextTouch
      ? `Próximo toque ${nextTouch}${channelLabel ? ` (${channelLabel})` : ""}.`
      : "Sin próximo toque programado.";

    // Cadence nudges (mirror the /guide rules; suggestions only, no enforcement)
    const nextActions = [];
    const chasing = ["LEAD", "PROSPECT"].includes(company.status);
    if (nextTouch && daysBetween(nextTouch, today) > 0) {
      nextActions.push(
        `Seguimiento vencido hace ${daysBetween(nextTouch, today)} día(s) — chasear hoy.`,
      );
    } else if (!nextTouch && chasing) {
      nextActions.push("Agendar próximo seguimiento (--next-touch al loguear).");
    }
    const outcomes = (activities ?? [])
      .map((a) => a.outcome)
      .filter(Boolean)
      .slice(0, 3);
    if (outcomes.length === 3 && outcomes.every((o) => NO_CONTACT.includes(o))) {
      nextActions.push(
        "3 intentos sin contacto — cambiar de canal o espaciar 2 semanas.",
      );
    }

    const summary =
      `${company.name} (${company.status}) en ${company.city ?? company.department ?? "ubicación desconocida"}. ` +
      `${contacts?.length ?? 0} contactos, ${projects?.length ?? 0} proyectos activos, ${deals?.length ?? 0} negocios abiertos. ` +
      followUp +
      (nextActions.length > 0 ? ` Sugerencias: ${nextActions.join(" ")}` : "");

    return {
      data: {
        company: {
          ...company,
          next_touch_at: nextTouch,
          assigned_to: assignedTo?.full_name ?? null,
          primary_persona: persona?.name ?? null,
        },
        contacts: cap(contacts ?? [], 10),
        active_projects: projects ?? [],
        open_deals: deals ?? [],
        recent_activities: (activities ?? []).map((a) => ({
          id: a.id,
          type: a.type,
          channel: a.channel,
          outcome: a.outcome,
          description: truncate(a.description),
          occurred_at: formatDate(a.occurred_at),
        })),
        assets_shared: (sharedAssets ?? []).map((s) => ({
          name: s.asset?.name ?? null,
          kind: s.asset?.kind ?? null,
          occurred_at: formatDate(s.occurred_at),
        })),
        next_actions: nextActions,
      },
      summary,
      requestSummary: `Snapshot de empresa ${company.name} (${company.id}).`,
      entitiesAffected: [{ table: "companies", id: company.id }],
    };
  },
});
