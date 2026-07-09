/**
 * Curated outreach-leads CSV → Supabase importer.
 *
 * Expects data/DB.csv with these columns:
 *   Category, Rank, Openness Score, Company, Entity type,
 *   Phone, Email, Main activity, Why this prospect, What to pitch
 *
 * Behavior:
 *   - Maps Category → existing persona segment (logistics / retail /
 *     legal_accounting / healthcare / construction_real_estate / agribusiness)
 *   - Upserts Company on external_id = "DB-<rank>" (idempotent re-runs)
 *   - Source = BASE_UNIFICADA, status = LEAD
 *   - Notes = main activity + why-prospect + what-to-pitch
 *   - Tags = [Category, Entity type, "openness:<score>"]
 *   - Creates one primary Contact per row with the phone + email if present
 *   - Assigns to the seeded SALES user, falling back to the FOUNDER
 *
 * Run with:
 *   npm run import:outreach
 */

import { parse } from "csv-parse/sync";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "../src/lib/prisma";
import { CompanySource, CompanyStatus } from "@prisma/client";

const CSV_PATH = resolve(__dirname, "..", "data", "DB.csv");

const CATEGORY_TO_SEGMENT: Record<string, string> = {
  "Logistics & distributors": "logistics",
  "Legal & accounting firms": "legal_accounting",
  "Legal & accounting": "legal_accounting",
  "Retail chains & franchises": "retail",
  "Private clinics & healthcare": "healthcare",
  "Construction & real estate": "construction_real_estate",
  "Agribusiness & exporters": "agribusiness",
};

type CsvRow = {
  Category: string;
  Rank: string;
  "Openness Score": string;
  Company: string;
  "Entity type": string;
  Phone: string;
  Email: string;
  "Main activity": string;
  "Why this prospect": string;
  "What to pitch": string;
};

function normalizePhone(raw: string | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  // Bolivian numbers: landlines 7 digits (with area), mobiles 8 digits.
  // Prepend +591 country code when missing.
  if (digits.startsWith("591")) return `+${digits}`;
  if (digits.length === 7 || digits.length === 8) return `+591${digits}`;
  return `+${digits}`;
}

function clean(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

async function main() {
  if (!existsSync(CSV_PATH)) {
    console.error(`✗ CSV not found at ${CSV_PATH}`);
    process.exit(1);
  }

  const raw = readFileSync(CSV_PATH, "utf8");
  const records: CsvRow[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
  });

  // Drop the 10 stranded rows from the previous (buggy) run so this becomes
  // the source of truth. Anything else under DB- prefix is also us.
  const cleaned = await prisma.company.deleteMany({
    where: { externalId: { startsWith: "DB-" } },
  });
  if (cleaned.count > 0) {
    console.log(`  cleaned ${cleaned.count} stale outreach rows before reimport`);
  }

  // Resolve assignee (sales > founder)
  const assignee =
    (await prisma.user.findFirst({ where: { role: "SALES" } })) ??
    (await prisma.user.findFirst({ where: { role: "FOUNDER" } }));
  if (!assignee) {
    console.error("✗ no SALES or FOUNDER user — run seed first");
    process.exit(1);
  }

  // Load all personas by segment
  const personas = await prisma.persona.findMany();
  const personaBySegment = new Map(personas.map((p) => [p.segment, p]));

  let imported = 0;
  let skipped = 0;
  const missingSegments = new Set<string>();

  for (let idx = 0; idx < records.length; idx++) {
    const row = records[idx];
    const category = row.Category?.trim() ?? "";

    const name = row.Company?.trim();
    if (!name) {
      skipped++;
      continue;
    }

    const rank = row.Rank?.trim();
    if (!rank) {
      skipped++;
      continue;
    }

    const segment = CATEGORY_TO_SEGMENT[category];
    const persona = segment ? personaBySegment.get(segment) : null;
    if (category && !persona) {
      missingSegments.add(segment ? `segment ${segment}` : category);
    }

    const slug = (category || "uncategorized")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const externalId = `DB-${slug}-${rank}`;
    const notesParts: string[] = [];
    if (row["Main activity"]?.trim())
      notesParts.push(`Actividad: ${row["Main activity"].trim()}`);
    if (row["Why this prospect"]?.trim())
      notesParts.push(`Por qué: ${row["Why this prospect"].trim()}`);
    if (row["What to pitch"]?.trim())
      notesParts.push(`Pitch: ${row["What to pitch"].trim()}`);
    const notes = notesParts.join("\n\n");

    const tags = [
      category,
      clean(row["Entity type"]),
      row["Openness Score"]?.trim()
        ? `openness:${row["Openness Score"].trim()}`
        : null,
    ].filter((x): x is string => x !== null);

    // Upsert company by external_id
    const existing = await prisma.company.findFirst({
      where: { externalId },
    });
    const company = existing
      ? await prisma.company.update({
          where: { id: existing.id },
          data: {
            name,
            sector: category || null,
            source: CompanySource.BASE_UNIFICADA,
            primaryPersonaId: persona ? persona.id : null,
            assignedToId: assignee.id,
            tags,
            notes,
          },
        })
      : await prisma.company.create({
          data: {
            name,
            sector: category || null,
            source: CompanySource.BASE_UNIFICADA,
            status: CompanyStatus.LEAD,
            primaryPersonaId: persona ? persona.id : null,
            assignedToId: assignee.id,
            externalId,
            tags,
            notes,
          },
        });

    // Upsert a primary contact carrying the phone + email
    const phone = normalizePhone(row.Phone);
    const email = clean(row.Email);
    if (phone || email) {
      const existingContact = await prisma.contact.findFirst({
        where: { companyId: company.id, isPrimary: true },
      });
      const contactData = {
        companyId: company.id,
        fullName: "Contacto principal",
        role: "Gerente / Decisor",
        phone,
        whatsapp: phone,
        email,
        isPrimary: true,
      };
      if (existingContact) {
        await prisma.contact.update({
          where: { id: existingContact.id },
          data: contactData,
        });
      } else {
        await prisma.contact.create({ data: contactData });
      }
    }

    imported++;
  }

  console.log(`✓ imported/updated ${imported} companies (${skipped} skipped)`);
  if (missingSegments.size > 0) {
    console.log(
      "  Imported without persona (unmapped categories):",
      [...missingSegments].join(", ")
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
