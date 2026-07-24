/**
 * La Paz verified-prospects CSV → Supabase importer.
 *
 * Expects data/prospects_lp_verified.csv (29 columns, ids like
 * prsp_lp_2026_NNN). "prospects" in the source CSV = the companies table
 * (see wa-outreach-v1.txt glossary); companies.id is a UUID, so the CSV id
 * lands in external_id and idempotency is skip-if-external_id-exists —
 * re-runs never duplicate nor overwrite (ON CONFLICT DO NOTHING semantics).
 *
 * Mapping:
 *   - id → external_id, company → name, vertical → sector, city → city
 *   - source base_unificada_* → BASE_UNIFICADA; stage prospecting → LEAD
 *   - preferred_channel: presencial → IN_PERSON, email → EMAIL,
 *     whatsapp → WHATSAPP (only enum-backed CSV column; values verified)
 *   - next_action / next_action_at / sequence_position / created_at /
 *     updated_at copied as-is (ISO UTC parsed to timestamptz)
 *   - tier, score, legal_entity_type, verification_*, source_id → tags
 *   - notes, activity_summary, google_* → notes
 *   - persona via vertical → segment; assigned to SALES, falling back
 *     to FOUNDER; one primary Contact per row with phone + email
 *
 * Run with:
 *   npm run import:lp
 */

import { parse } from "csv-parse/sync";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { prisma } from "../src/lib/prisma";
import {
  CompanySource,
  CompanyStatus,
  PreferredChannel,
} from "@prisma/client";

const CSV_PATH = resolve(
  __dirname,
  "..",
  "data",
  "prospects_lp_60_by_channel.csv"
);

const VERTICAL_TO_SEGMENT: Record<string, string> = {
  Agroindustria: "agribusiness",
  "Clínicas Privadas": "healthcare",
  "Legal/Contable": "legal_accounting",
  Logística: "logistics",
  "Construcción/Inmobiliaria": "construction_real_estate",
  "Retail/Franquicias": "retail",
  // "OTROS" intentionally unmapped — imports with no persona.
};

const CHANNEL_MAP: Record<string, PreferredChannel> = {
  presencial: PreferredChannel.IN_PERSON,
  email: PreferredChannel.EMAIL,
  whatsapp: PreferredChannel.WHATSAPP,
  phone: PreferredChannel.PHONE,
  "email+phone": PreferredChannel.MIXED,
};

type CsvRow = Record<string, string>;

function clean(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizePhone(raw: string | undefined): string | null {
  if (!raw) return null;
  // CSV writes phones as floats ("2850615.0"); strip trailing .0 before
  // digit extraction so we don't glue an extra "0" onto the number.
  const cleaned = raw.trim().replace(/\.0+$/, "");
  const digits = cleaned.replace(/[^\d]/g, "");
  if (!digits) return null;
  // Bolivian numbers: landlines 7-8 digits (with area), mobiles 8 digits.
  // Prepend +591 country code when missing.
  if (digits.startsWith("591")) return `+${digits}`;
  if (digits.length === 7 || digits.length === 8) return `+591${digits}`;
  return `+${digits}`;
}

function parseUtc(raw: string | undefined, rowId: string, field: string): Date {
  const value = clean(raw);
  if (!value) throw new Error(`${rowId}: empty ${field}`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    throw new Error(`${rowId}: unparseable ${field} "${value}"`);
  return date;
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
  let skipped = 0;
  const failures: { id: string; reason: string }[] = [];

  for (const row of records) {
    const externalId = clean(row.id) ?? "";
    try {
      if (!externalId) throw new Error("missing id");
      const name = clean(row.company);
      if (!name) throw new Error("missing company name");

      // Idempotency: never touch a row that is already in the CRM.
      const existing = await prisma.company.findFirst({
        where: { externalId },
        select: { id: true },
      });
      if (existing) {
        skipped++;
        continue;
      }

      // Sanity-check the fixed-vocabulary columns so bad rows fail loudly
      // instead of importing with silently dropped semantics.
      const stage = clean(row.stage);
      if (stage && stage !== "prospecting")
        throw new Error(`unexpected stage "${stage}"`);
      const csvStatus = clean(row.status);
      const isPaused = csvStatus === "paused";
      if (csvStatus && csvStatus !== "active" && !isPaused)
        throw new Error(`unexpected status "${csvStatus}"`);

      const channelRaw = clean(row.preferred_channel);
      const preferredChannel = channelRaw ? CHANNEL_MAP[channelRaw] : null;
      if (channelRaw && !preferredChannel)
        throw new Error(`unexpected preferred_channel "${channelRaw}"`);

      const vertical = clean(row.vertical);
      const segment = vertical ? VERTICAL_TO_SEGMENT[vertical] : null;
      const persona = segment ? personaBySegment.get(segment) : null;

      const tags = [
        vertical,
        clean(row.legal_entity_type),
        clean(row.tier) ? `tier:${row.tier.trim()}` : null,
        clean(row.score) ? `score:${row.score.trim()}` : null,
        clean(row.verification_status)
          ? `verification:${row.verification_status.trim().toLowerCase()}`
          : null,
        clean(row.source) ? `source:${row.source.trim()}` : null,
        clean(row.source_id) ? `source_id:${row.source_id.trim()}` : null,
        isPaused ? "status:paused" : null,
      ].filter((x): x is string => x !== null);

      const notesParts: string[] = [];
      if (clean(row.notes)) notesParts.push(row.notes.trim());
      if (clean(row.activity_summary))
        notesParts.push(`Actividad: ${row.activity_summary.trim()}`);
      if (clean(row.google_address))
        notesParts.push(`Dirección (Google): ${row.google_address.trim()}`);
      if (clean(row.google_phone))
        notesParts.push(`Tel (Google): ${row.google_phone.trim()}`);
      if (clean(row.google_place_id))
        notesParts.push(`Google Place ID: ${row.google_place_id.trim()}`);
      if (clean(row.verification_source))
        notesParts.push(
          `Verificado: ${row.verification_source.trim()} (${clean(row.verification_date) ?? "s/f"})`
        );

      const company = await prisma.company.create({
        data: {
          name,
          sector: vertical,
          city: clean(row.city),
          source: CompanySource.BASE_UNIFICADA,
          status: CompanyStatus.LEAD,
          preferredChannel,
          // Paused rows keep their next_action label for context but leave
          // next_action_at null so the outreach cron never picks them up.
          nextAction: clean(row.next_action),
          nextActionAt: isPaused
            ? null
            : parseUtc(row.next_action_at, externalId, "next_action_at"),
          sequencePosition: Number.parseInt(row.sequence_position ?? "0", 10) || 0,
          primaryPersonaId: persona ? persona.id : null,
          assignedToId: assignee.id,
          externalId,
          tags,
          notes: notesParts.join("\n\n") || null,
          createdAt: parseUtc(row.created_at, externalId, "created_at"),
          updatedAt: parseUtc(row.updated_at, externalId, "updated_at"),
        },
      });

      const phone = normalizePhone(clean(row.phone) ?? undefined);
      const email = clean(row.email);
      if (phone || email) {
        await prisma.contact.create({
          data: {
            companyId: company.id,
            fullName: clean(row.contact_name) ?? "Contacto principal",
            role: "Gerente / Decisor",
            phone,
            whatsapp: phone,
            email,
            isPrimary: true,
          },
        });
      }

      inserted++;
    } catch (err) {
      failures.push({
        id: externalId || "(sin id)",
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.log(
    `✓ inserted ${inserted} companies, skipped ${skipped} already present, ${failures.length} failed`
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
