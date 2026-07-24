/**
 * La Paz "30 verified leads (medium)" JSON → Supabase importer.
 *
 * Source: data/lp_30m_medium.json (converted from
 * 30_leads_LP_medium_verified.xlsx, sheet "30 Leads LP"). All 30 rows come
 * out of the Medium / Medium-Large tier of Base Unificada + Google Places
 * validation, so they all get tagged size:medium.
 *
 * Idempotency: external_id = "LP-30M-<bdId>". Re-runs update in place and
 * never duplicate. Note: bdId here is the Base Unificada row id from this
 * batch's extraction; it lives in its own namespace (bd_id:*) to avoid
 * confusion with the earlier LP-verified batch's source_id:* tags, whose
 * numbering does NOT match.
 *
 * Run with:
 *   npm run import:lp-30m
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "../src/lib/prisma";
import { CompanySource, CompanyStatus } from "@prisma/client";

const JSON_PATH = resolve(__dirname, "..", "data", "lp_30m_medium.json");
const BATCH_TAG = "batch:lp-30m-2026-07";
const SIZE_TAG = "size:medium";

type Row = {
  num: number;
  vertical: string;
  name: string;
  entityType: string; // "SRL" | "SA"
  email: string | null;
  phone: string | number | null;
  activity: string | null;
  googlePresence: string | null;
  reviews: number | null;
  verifiedAddress: string | null;
  bdId: number;
};

const VERTICAL_TO_SEGMENT: Record<string, string> = {
  "Construcción e Inmobiliario": "construction_real_estate",
  "Clínicas y Salud": "healthcare",
  "Legal y Contable": "legal_accounting",
  Logística: "logistics",
  "Retail y Franquicias": "retail",
  Agroindustria: "agribusiness",
};

const CITY_KEYWORDS = ["El Alto", "Viacha", "La Paz"];

function clean(v: string | null | undefined): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function normalizePhone(raw: string | number | null | undefined): string | null {
  if (raw == null) return null;
  const digits = String(raw).replace(/[^\d]/g, "");
  if (!digits) return null;
  if (digits.startsWith("591")) return `+${digits}`;
  if (digits.length === 7 || digits.length === 8) return `+591${digits}`;
  return `+${digits}`;
}

function extractCity(address: string | null): string | null {
  if (!address) return null;
  for (const c of CITY_KEYWORDS) if (address.includes(c)) return c;
  return null;
}

async function main() {
  const raw = readFileSync(JSON_PATH, "utf8");
  const records: Row[] = JSON.parse(raw);

  const assignee =
    (await prisma.user.findFirst({ where: { role: "SALES" } })) ??
    (await prisma.user.findFirst({ where: { role: "FOUNDER" } }));
  if (!assignee) {
    console.error("✗ no SALES or FOUNDER user — run seed first");
    process.exit(1);
  }

  const personas = await prisma.persona.findMany();
  const personaBySegment = new Map(personas.map((p) => [p.segment, p]));

  let inserted = 0;
  let updated = 0;
  const failures: { id: string; reason: string }[] = [];
  const missingSegments = new Set<string>();

  for (const row of records) {
    const externalId = `LP-30M-${row.bdId}`;
    try {
      const name = clean(row.name);
      if (!name) throw new Error("missing company name");

      const vertical = clean(row.vertical);
      const segment = vertical ? VERTICAL_TO_SEGMENT[vertical] : null;
      const persona = segment ? personaBySegment.get(segment) : null;
      if (vertical && !persona)
        missingSegments.add(segment ?? vertical);

      const city = extractCity(row.verifiedAddress);
      const department = city ? "La Paz" : null;

      const tags = [
        vertical,
        clean(row.entityType),
        SIZE_TAG,
        BATCH_TAG,
        `bd_id:${row.bdId}`,
        row.reviews != null ? `reviews:${row.reviews}` : null,
      ].filter((x): x is string => x !== null);

      const notesParts: string[] = [];
      if (row.activity) notesParts.push(`Actividad: ${row.activity.trim()}`);
      if (row.googlePresence)
        notesParts.push(`Presencia Google: ${row.googlePresence.trim()}`);
      if (row.verifiedAddress)
        notesParts.push(`Dirección verificada: ${row.verifiedAddress.trim()}`);
      if (row.reviews != null)
        notesParts.push(`Reviews Google: ${row.reviews}`);
      const notes = notesParts.join("\n\n") || null;

      const existing = await prisma.company.findFirst({
        where: { externalId },
        select: { id: true },
      });

      const data = {
        name,
        sector: vertical,
        city,
        department,
        source: CompanySource.BASE_UNIFICADA,
        status: CompanyStatus.LEAD,
        primaryPersonaId: persona ? persona.id : null,
        assignedToId: assignee.id,
        externalId,
        tags,
        notes,
      };

      const company = existing
        ? await prisma.company.update({ where: { id: existing.id }, data })
        : await prisma.company.create({ data });

      const phone = normalizePhone(row.phone);
      const email = clean(row.email);
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

      if (existing) updated++;
      else inserted++;
    } catch (err) {
      failures.push({
        id: externalId,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.log(
    `✓ ${inserted} inserted, ${updated} updated, ${failures.length} failed`
  );
  if (missingSegments.size > 0)
    console.log(
      "  Imported without persona (unmapped segments):",
      [...missingSegments].join(", ")
    );
  for (const f of failures) console.log(`  ✗ ${f.id}: ${f.reason}`);
  if (failures.length > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
