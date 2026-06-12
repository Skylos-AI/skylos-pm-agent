# Skylos PM Agent

Internal project management system for Skylos, a 3-person Bolivian AI agency. Team members talk to the agent in WhatsApp; the agent reads and writes a Supabase Postgres via Prisma.

This repo currently covers **Phase 1: database foundation**. Agent runtime (Phase 2), web UI (Phase 3), and polish (Phase 4) live in separate specs.

## Stack

- **Database + auth + REST:** Supabase (managed Postgres, `us-east-2` / Ohio)
- **Schema management:** Prisma
- **Agent runtime (Phase 2):** OpenClaw on HostGator VPS
- **Agent model (Phase 2):** Claude API (BYOK)
- **User interface (Phase 2):** WhatsApp via OpenClaw's native channel
- **Web UI (Phase 3):** Next.js + Tailwind on Vercel

## Prerequisites

- Node.js 20+
- A Supabase project in `us-east-2` (Ohio) — region locked 2026-06-12
- The Base Unificada CSV placed at `data/base-unificada-sample.csv` (gitignored)

## Setup

```bash
npm install
cp .env.example .env
# fill in Supabase credentials in .env
npx prisma migrate dev --name init
npx prisma generate
```

Apply RLS (run once, after the first migration, via Supabase SQL editor):

```bash
# Paste the contents of prisma/rls.sql into the Supabase SQL editor.
```

Seed:

```bash
npx prisma db seed
npm run import:base-unificada   # if CSV is present
```

Validate:

```bash
npm run validate
# exit code 0 means Phase 1 acceptance criteria pass.
```

## Layout

```
skylos-pm-agent/
├── prisma/
│   ├── schema.prisma     # 10 tables, all enums
│   ├── rls.sql           # v1 RLS policies — authenticated read/write all
│   └── seed.ts           # idempotent seed (users, personas, sample data)
├── scripts/
│   ├── import-base-unificada.ts
│   └── validate-schema.ts
├── src/
│   └── lib/
│       └── prisma.ts     # singleton Prisma client
└── data/
    └── base-unificada-sample.csv   # gitignored
```

## Conventions

- Tables snake_case plural; Prisma models PascalCase singular
- UUID v4 PKs, `created_at` / `updated_at` on every table
- Currency: BOB (Bolivianos), `Decimal(12, 2)`
- Timezone default: `America/La_Paz`
- Language default: `es`
- Phones in E.164 (`+591...`)
- Bolivian NIT unique on `companies`

## RLS model (v1)

Any authenticated user can read and write everything. The agent uses the Supabase `service_role` key and bypasses RLS. Per-row ownership and granular policies arrive after Phase 1.

## Agent skill packs

Two reference skill packs are installed under `.agents/skills/` via `npx skills add supabase/agent-skills`:

- `supabase/` — general Supabase usage patterns
- `supabase-postgres-best-practices/` — Postgres conventions

They're not Claude-Code-native skills (those live at `.claude/skills/`), but the `SKILL.md` files are useful background reading for Supabase-specific decisions.
