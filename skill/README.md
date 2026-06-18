# skylos-pm — OpenClaw skill

17 Node scripts that give Manu Skylos-specific PM tools over the Supabase schema built in Phase 1. See [SKILL.md](SKILL.md) for the tool index, and [v2.txt](../../v2.txt) for the full spec.

## Conventions

- **Responses:** Spanish, voice-friendly. Every tool emits a single JSON envelope `{ok, data, summary}` to stdout.
- **Identity:** every invocation requires `--as-user <email>` so audit + ownership work.
- **Logging:** every invocation writes a row to `agent_log` with `tool_called`, `request_summary`, `response_summary`, `entities_affected`, `status`, `duration_ms`.
- **Errors:** structured envelope with `error.code` ∈ {`NOT_FOUND`, `INVALID_ARGS`, `VALIDATION`, `DB_ERROR`, `VAULT_ERROR`, `UNKNOWN`}. Exit 1 on error, 0 on success.
- **Schema conventions** (from Phase 1): tables snake_case plural, UUID v4 PKs, BOB currency (Decimal 12,2), `America/La_Paz` TZ, phones in E.164, NIT unique on companies.
- **Supabase:** project ref `kvtvxawzviqirqbjdsfv` in us-east-2. Agent scripts use `@supabase/supabase-js` with `service_role` from vault.

## Assets

`assets/` ships with the skill bundle and holds static files Manu reads at runtime:

- `assets/proposals/*.md` — proposal templates with `{{placeholders}}` consumed by `fill-proposal`.
- `assets/brand/` — voice guide, palette JSON, logo SVG.
- `assets/personas/*.md` — enriched persona briefs (longer than what fits in the DB row); useful for Manu's context when drafting outreach.

See `assets/README.md` for the full layout.

## Local development

```bash
cd skill
npm install
# Reads from the parent .env or from process env:
export SUPABASE_URL=https://kvtvxawzviqirqbjdsfv.supabase.co
export SUPABASE_SERVICE_ROLE=eyJ...
node scripts/read/get-my-tasks.js --as-user jhonny@skylos.io --status open
```

## Invocation

```bash
node scripts/read/get-my-tasks.js --as-user jhonny@skylos.io --status open --limit 10
```

## Deploy

This skill is a subfolder of the [skylos-pm-agent](https://github.com/JJJRLP/skylos-pm-agent) repo. Deploy by cloning the repo on the VPS and pointing `skill_install` at the subfolder:

```bash
cd /opt/devclaw
git clone https://github.com/JJJRLP/skylos-pm-agent.git
# from Manu:
skill_install(source="/opt/devclaw/skylos-pm-agent/skill")
```

## Updates

```bash
cd /opt/devclaw/skylos-pm-agent && git pull
# from Manu:
skill_install(source="/opt/devclaw/skylos-pm-agent/skill")  # re-runs with new code
```
