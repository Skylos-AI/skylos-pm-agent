/**
 * La Paz "28 verified leads (medium, digital-signal filter)" CSV → Supabase.
 *
 * Source: data/lp_28d_medium_digital.json (converted from
 * 28_leads_LP_medium_digital.csv). All 28 rows are still medium tier
 * (size:medium) — the extra filter here is "shows digital signals",
 * bucketed as ALTA/MEDIA/BAJA in Digital_Tier. That becomes a new
 * digital:<tier> tag alongside the existing size/batch tags.
 *
 * Overlap policy: 16 of these 28 bdIds are already in the CRM from the
 * LP-30M batch. We look each row up by any of
 *   - external_id = LP-28D-<bdId>
 *   - external_id = LP-30M-<bdId>
 *   - tag         = bd_id:<bdId>
 * A hit → merge the new digital/batch tags into that existing row so we
 * never create a duplicate company. A miss → create a fresh LP-28D-<bdId>.
 *
 * Run with:
 *   npm run import:lp-28d
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "../src/lib/prisma";
import { CompanySource, CompanyStatus } from "@prisma/client";

const JSON_PATH = resolve(
  __dirname,
  "..",
  "data",
  "lp_28d_medium_digital.json",
);
const BATCH_TAG = "batch:lp-28d-2026-07";
const SIZE_TAG = "size:medium";

type Row = {
  ID_BD: string;
  Vertical: string;
  Empresa: string;
  Tipo_Soc: string;
  Email: string;
  Telefono_BD: string;
  Google_Places_Name: string;
  Reviews: string;
  Hours_Listed: string;
  Digital_Score: string;
  Digital_Tier: string; // ALTA | MEDIA | BAJA
  Tech_Signal_Notes: string;
  Address_Verified_2026: string;
};

// This CSV uses SHOUTY vertical codes; map to spec-native Spanish names
// (matching the LP-30M batch) so companies.sector stays consistent.
const VERTICAL_TO_SECTOR: Record<string, string> = {
  CONSTRUCCION: "Construcción e Inmobiliario",
  LOGISTICA: "Logística",
  RETAIL: "Retail y Franquicias",
};

const SECTOR_TO_SEGMENT: Record<string, string> = {
  "Construcción e Inmobiliario": "construction_real_estate",
  Logística: "logistics",
  "Retail y Franquicias": "retail",
};

const TIER_TO_TAG: Record<string, string> = {
  ALTA: "digital:alta",
  MEDIA: "digital:media",
  BAJA: "digital:baja",
};

const CITY_KEYWORDS = ["El Alto", "Viacha", "La Paz"];

function clean(v: string | null | undefined): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
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

function mergeTags(current: string[], additions: string[]): string[] {
  // De-dupe and enforce one digital:* — new additions win.
  const seen = new Set<string>();
  const kept: string[] = [];
  const newDigital = additions.find((t) => t.startsWith("digital:"));
  for (const t of [...current, ...additions]) {
    if (seen.has(t)) continue;
    if (newDigital && t.startsWith("digital:") && t !== newDigital) continue;
    seen.add(t);
    kept.push(t);
  }
  return kept;
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
  let mergedIntoExisting = 0;
  const failures: { id: string; reason: string }[] = [];

  for (const row of records) {
    const bdId = clean(row.ID_BD);
    const externalId = `LP-28D-${bdId}`;
    try {
      if (!bdId) throw new Error("missing ID_BD");
      const name = clean(row.Empresa);
      if (!name) throw new Error("missing company name");

      const sector = VERTICAL_TO_SECTOR[row.Vertical] ?? row.Vertical;
      const segment = SECTOR_TO_SEGMENT[sector] ?? null;
      const persona = segment ? personaBySegment.get(segment) : null;

      const city = extractCity(row.Address_Verified_2026);
      const department = city ? "La Paz" : null;

      const digitalTag = TIER_TO_TAG[row.Digital_Tier] ?? null;
      const scoreTag = clean(row.Digital_Score)
        ? `digital_score:${row.Digital_Score}`
        : null;
      const reviewsTag =
        clean(row.Reviews) && Number.isFinite(Number(row.Reviews))
          ? `reviews:${Number(row.Reviews)}`
          : null;

      const newTags = [
        sector,
        clean(row.Tipo_Soc),
        SIZE_TAG,
        BATCH_TAG,
        `bd_id:${bdId}`,
        digitalTag,
        scoreTag,
        reviewsTag,
      ].filter((x): x is string => x !== null);

      // Prefer LP-28D-<id> → LP-30M-<id> → any row already tagged bd_id:<id>
      const existing =
        (await prisma.company.findFirst({
          where: { externalId },
          select: { id: true, tags: true, notes: true, externalId: true },
        })) ??
        (await prisma.company.findFirst({
          where: { externalId: `LP-30M-${bdId}` },
          select: { id: true, tags: true, notes: true, externalId: true },
        })) ??
        (await prisma.company.findFirst({
          where: { tags: { has: `bd_id:${bdId}` } },
          select: { id: true, tags: true, notes: true, externalId: true },
        }));

      const techNoteLine = clean(row.Tech_Signal_Notes)
        ? `Digital ${row.Digital_Tier} (${row.Digital_Score}/10): ${row.Tech_Signal_Notes.trim()}`
        : null;

      if (existing) {
        // Merge tags, append the digital-signal note if not already present.
        const mergedTags = mergeTags(
          (existing.tags ?? []) as string[],
          newTags,
        );
        let mergedNotes = existing.notes ?? null;
        if (techNoteLine && (!mergedNotes || !mergedNotes.includes(techNoteLine))) {
          mergedNotes = mergedNotes
            ? `${mergedNotes}\n\n${techNoteLine}`
            : techNoteLine;
        }
        await prisma.company.update({
          where: { id: existing.id },
          data: { tags: mergedTags, notes: mergedNotes },
        });
        mergedIntoExisting++;
      } else {
        const notesParts: string[] = [];
        if (row.Google_Places_Name)
          notesParts.push(`Presencia Google: ${row.Google_Places_Name.trim()}`);
        if (row.Address_Verified_2026)
          notesParts.push(
            `Dirección verificada: ${row.Address_Verified_2026.trim()}`,
          );
        if (techNoteLine) notesParts.push(techNoteLine);

        const company = await prisma.company.create({
          data: {
            name,
            sector,
            city,
            department,
            source: CompanySource.BASE_UNIFICADA,
            status: CompanyStatus.LEAD,
            primaryPersonaId: persona ? persona.id : null,
            assignedToId: assignee.id,
            externalId,
            tags: newTags,
            notes: notesParts.join("\n\n") || null,
          },
        });

        const phone = normalizePhone(row.Telefono_BD);
        const email = clean(row.Email);
        if (phone || email) {
          await prisma.contact.create({
            data: {
              companyId: company.id,
              fullName: "Contacto principal",
              role: "Gerente / Decisor",
              phone,
              whatsapp: phone,
              email,
              isPrimary: true,
            },
          });
        }
        inserted++;
      }
    } catch (err) {
      failures.push({
        id: externalId,
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.log(
    `✓ ${inserted} inserted new, ${mergedIntoExisting} merged into existing, ${failures.length} failed`,
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
