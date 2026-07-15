#!/usr/bin/env node
const { runTool } = require("../lib/runner");
const { getClient } = require("../lib/supabase");
const { appError } = require("../lib/envelope");

const KINDS = [
  "PROPOSAL",
  "DECK",
  "ONE_PAGER",
  "EMAIL_TEMPLATE",
  "BROCHURE",
  "CASE_STUDY",
  "CONTRACT",
  "OTHER",
];

runTool({
  name: "list-assets",
  actionType: "read.assets_list",
  yargsBuilder: (y) =>
    y
      .option("kind", { type: "string", choices: KINDS })
      .option("include-inactive", { type: "boolean", default: false }),
  handler: async (argv) => {
    const supa = getClient();
    let q = supa
      .from("assets")
      .select("id, name, kind, external_url, version, active, language");
    if (argv.kind) q = q.eq("kind", argv.kind);
    if (!argv["include-inactive"]) q = q.eq("active", true);
    q = q.order("kind").order("name");
    const { data, error } = await q;
    if (error) throw appError("DB_ERROR", error.message);

    const summary =
      data.length === 0
        ? "No hay assets registrados con esos filtros."
        : `${data.length} asset${data.length === 1 ? "" : "s"} disponible${data.length === 1 ? "" : "s"}: ${data.map((a) => a.name + (a.version ? ` (${a.version})` : "")).join(", ")}.`;

    return {
      data: { assets: data },
      summary,
      requestSummary: `Listar assets${argv.kind ? ` de tipo ${argv.kind}` : ""}.`,
      entitiesAffected: null,
    };
  },
});
