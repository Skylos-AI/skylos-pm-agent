/**
 * Base Unificada CSV → Supabase importer.
 *
 * Expects a CSV at data/base-unificada-sample.csv with at least these columns
 * (snake_case headers, semicolon or comma delimited — auto-detected):
 *
 *   id_unificado, razon_social, nit, sector_normalized,
 *   ciudad, departamento, activo
 *
 * Filters per Phase 1 spec:
 *   - sector_normalized ∈ { construction, real_estate }
 *   - departamento     ∈ { Cochabamba, La Paz, Santa Cruz }
 *   - nit              non-null
 *   - activo           truthy (true / 1 / "si" / "yes")
 *
 * Caps at 200 rows after filtering. Upserts on `nit` so re-runs are safe.
 *
 * Run with:
 *   npm run import:base-unificada
 */

import { parse } from "csv-parse/sync";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "../src/lib/prisma";
import { CompanySource, CompanyStatus } from "@prisma/client";

const CSV_PATH = resolve(__dirname, "..", "data", "base-unificada-sample.csv");
const ALLOWED_SECTORS = new Set(["construction", "real_estate"]);
const ALLOWED_DEPARTMENTS = new Set(["Cochabamba", "La Paz", "Santa Cruz"]);
const MAX_ROWS = 200;

type CsvRow = {
  id_unificado?: string;
  razon_social?: string;
  nit?: string;
  sector_normalized?: string;
  ciudad?: string;
  departamento?: string;
  activo?: string;
};

function isTruthy(value: string | undefined) {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "true" || v === "1" || v === "si" || v === "sí" || v === "yes";
}

async function main() {
  if (!existsSync(CSV_PATH)) {
    console.error(`✗ CSV not found at ${CSV_PATH}`);
    console.error("  Drop the Base Unificada export there and re-run.");
    process.exit(1);
  }

  const raw = readFileSync(CSV_PATH, "utf8");
  const delimiter = raw.split("\n", 1)[0].includes(";") ? ";" : ",";

  const records: CsvRow[] = parse(raw, {
    columns: true,
    delimiter,
    skip_empty_lines: true,
    trim: true,
  });

  const realEstatePersona = await prisma.persona.findFirst({
    where: { segment: "construction_real_estate" },
  });
  if (!realEstatePersona) {
    console.error("✗ persona 'construction_real_estate' missing — run seed first");
    process.exit(1);
  }

  const sales = await prisma.user.findFirst({ where: { role: "SALES" } });

  const filtered = records
    .filter((r) => r.nit && r.razon_social)
    .filter((r) => ALLOWED_SECTORS.has((r.sector_normalized ?? "").toLowerCase()))
    .filter((r) => ALLOWED_DEPARTMENTS.has(r.departamento ?? ""))
    .filter((r) => isTruthy(r.activo))
    .slice(0, MAX_ROWS);

  console.log(`→ importing ${filtered.length} companies from ${records.length} rows`);

  let imported = 0;
  for (const r of filtered) {
    await prisma.company.upsert({
      where: { nit: r.nit! },
      update: {
        name: r.razon_social!,
        sector: r.sector_normalized!,
        city: r.ciudad ?? null,
        department: r.departamento!,
        source: CompanySource.BASE_UNIFICADA,
        primaryPersonaId: realEstatePersona.id,
        externalId: r.id_unificado ?? null,
      },
      create: {
        name: r.razon_social!,
        nit: r.nit!,
        sector: r.sector_normalized!,
        city: r.ciudad ?? null,
        department: r.departamento!,
        source: CompanySource.BASE_UNIFICADA,
        status: CompanyStatus.LEAD,
        primaryPersonaId: realEstatePersona.id,
        assignedToId: sales?.id ?? null,
        externalId: r.id_unificado ?? null,
      },
    });
    imported++;
  }

  console.log(`✓ imported/updated ${imported} companies`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
