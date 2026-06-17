---
name: skylos-pm
description: Skylos project management — 17 tools for managing tasks, projects, pipeline, companies, and daily briefings. Backed by Supabase. Responds in Spanish.
metadata:
  openclaw:
    emoji: "📊"
    requires:
      env:
        - SUPABASE_URL
        - SUPABASE_SERVICE_ROLE
        - SUPABASE_ANON_KEY
      bins:
        - node
---

# Skylos PM

Internal project management tools for the 3-person Skylos team (founder Jhonny, sales Eduardo, delivery Claudio). Backed by Supabase project `kvtvxawzviqirqbjdsfv` (us-east-2).

## Conventions

- **Responses:** Spanish, voice-friendly. Every tool emits a single JSON envelope to stdout.
- **Identity:** every invocation requires `--as-user <email>` so audit + ownership work.
- **Logging:** every invocation writes a row to `agent_log` with `tool_called`, `request_summary`, `response_summary`, `entities_affected`, `status`, `duration_ms`.
- **Errors:** structured envelope with `error.code` ∈ {`NOT_FOUND`, `INVALID_ARGS`, `VALIDATION`, `DB_ERROR`, `VAULT_ERROR`, `UNKNOWN`}. Exit 1 on error, 0 on success.

## Tools

Group: **read** (6) · **write** (5) · **skylos** (7).

| # | Tool | Group | One-liner |
|---|---|---|---|
| 1 | `get-my-tasks` | read | Open tasks for the caller with overdue flagging |
| 2 | `get-company` | read | Full company snapshot (contacts, projects, deals, activities) |
| 3 | `get-pipeline-status` | read | Pipeline summary by stage, in USD |
| 4 | `get-project` | read | Project status with tasks and recent activity |
| 5 | `search-companies` | read | Search by name/NIT/sector/dept/status |
| 6 | `get-activity-feed` | read | Recent interactions, filterable |
| 7 | `create-task` | write | New task, optionally tied to a project |
| 8 | `update-task-status` | write | Move task through TODO → IN_PROGRESS → DONE |
| 9 | `log-activity` | write | Record a call/meeting/message |
| 10 | `update-pipeline-deal` | write | Move stage, set value, close date |
| 11 | `create-reminder` | write | Schedule a future ping |
| 12 | `query-base-unificada` | skylos | Rank best LEAD candidates from seeded list |
| 13 | `draft-outreach` | skylos | Personalized first-touch message using persona template |
| 14 | `pipeline-intelligence` | skylos | Stuck deals (>14d), hot leads, conversion rates |
| 15 | `client-status-brief` | skylos | Full brief on one active client |
| 16 | `project-follow-up` | skylos | Progress check: pace, blockers, milestones, suggested actions |
| 17 | `daily-standup` | skylos | Morning brief: tasks, overdue, pipeline moves, recent client activity |
| 18 | `fill-proposal` | skylos | Fill a proposal template from `assets/proposals/` with company + persona + contact + value |

## Assets

`assets/` ships with the skill bundle and holds static files Manu reads at
runtime. See `assets/README.md` for the full layout. Today:

- `assets/proposals/*.md` — proposal templates with `{{placeholders}}`
  consumed by `fill-proposal`.
- `assets/brand/` — voice guide, palette JSON, logo SVG.
- `assets/personas/*.md` — enriched persona briefs (longer than what fits
  in the DB row); useful for Manu's context when drafting outreach.

See `scripts/<group>/<tool>.js` for args, output shape, and examples. Each script accepts `--help` for usage.

## Invocation

```bash
node scripts/read/get-my-tasks.js --as-user jhonny@skylos.io --status open --limit 10
```

## Install

From the VPS:

```bash
cd /opt/devclaw
git clone https://github.com/JJJRLP/skylos-pm-agent.git
```

Then from Manu:

```
skill_install(source="/opt/devclaw/skylos-pm-agent/skill")
```
