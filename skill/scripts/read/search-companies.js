#!/usr/bin/env node
const { runTool } = require("../lib/runner");
const { getClient } = require("../lib/supabase");
const { appError } = require("../lib/envelope");

runTool({
  name: "search-companies",
  actionType: "read.search_companies",
  yargsBuilder: (y) =>
    y
      .option("q", { type: "string" })
      .option("sector", { type: "string" })
      .option("department", { type: "string" })
      .option("status", { type: "string" })
      .option("limit", { type: "number", default: 10 }),
  handler: async (argv) => {
    const supa = getClient();
    let q = supa
      .from("companies")
      .select("id, name, nit, sector, city, department, status", { count: "exact" })
      .limit(argv.limit);

    if (argv.q) {
      q = q.or(`name.ilike.%${argv.q}%,nit.ilike.%${argv.q}%,notes.ilike.%${argv.q}%`);
    }
    if (argv.sector) q = q.eq("sector", argv.sector);
    if (argv.department) q = q.eq("department", argv.department);
    if (argv.status) q = q.eq("status", argv.status);

    const { data, error, count } = await q;
    if (error) throw appError("DB_ERROR", error.message);

    const summary =
      (data?.length ?? 0) === 0
        ? "Sin coincidencias."
        : `${count ?? data.length} empresas encontradas; mostrando ${data.length}.`;

    return {
      data: { results: data ?? [], total_matches: count ?? data?.length ?? 0 },
      summary,
      requestSummary: `Buscar empresas: q=${argv.q ?? ""}, sector=${argv.sector ?? ""}, dept=${argv.department ?? ""}, status=${argv.status ?? ""}.`,
    };
  },
});
