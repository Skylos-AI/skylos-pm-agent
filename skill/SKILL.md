---
name: skylos-pm
description: Skylos project management — 21 tools for managing tasks, projects, pipeline, companies, outreach cadence, and daily briefings. Backed by Supabase. Responds in Spanish.
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

Internal PM tools for the Skylos team backed by Supabase. Spanish, voice-friendly responses. Every invocation requires `--as-user <email>`. Errors return `{ok:false, error:{code, message}}` with codes `NOT_FOUND`, `INVALID_ARGS`, `VALIDATION`, `DB_ERROR`, `VAULT_ERROR`, `UNKNOWN`.

## Tools

| # | Tool | Group | One-liner |
|---|---|---|---|
| 1 | `get-my-tasks` | read | Open tasks for the caller with overdue flagging |
| 2 | `get-company` | read | Full company snapshot (contacts, projects, deals, activities, follow-up state, shared assets, cadence suggestions) |
| 3 | `get-pipeline-status` | read | Pipeline summary by stage, in USD |
| 4 | `get-project` | read | Project status with tasks and recent activity |
| 5 | `search-companies` | read | Search by name/NIT/sector/dept/status |
| 6 | `get-activity-feed` | read | Recent interactions, filterable |
| 6b | `list-assets` | read | List registered outreach assets (proposals, decks, one-pagers) with external links |
| 7 | `create-task` | write | New task, optionally tied to a project |
| 8 | `update-task-status` | write | Move task through TODO → IN_PROGRESS → DONE |
| 9 | `log-activity` | write | Record a call/meeting/message; optional `--outcome`, `--asset`, `--next-touch` to close the follow-up loop |
| 10 | `update-pipeline-deal` | write | Move stage, set value, close date |
| 11 | `create-reminder` | write | Schedule a future ping |
| 12 | `create-pipeline-deal` | write | New deal for a company; default stage LEAD, default owner = caller |
| 13 | `query-base-unificada` | skylos | Rank best LEAD candidates from seeded list |
| 14 | `draft-outreach` | skylos | Personalized first-touch message using persona template |
| 15 | `pipeline-intelligence` | skylos | Stuck deals (>14d), hot leads, conversion rates |
| 16 | `client-status-brief` | skylos | Full brief on one active client |
| 17 | `project-follow-up` | skylos | Progress check: pace, blockers, milestones, suggested actions |
| 18 | `daily-standup` | skylos | Morning brief: tasks, overdue, pipeline moves, recent client activity, today's outreach chase queue |
| 19 | `fill-proposal` | skylos | Fill a proposal template from `assets/proposals/` with company + persona + contact + value |
| 20 | `plan-outreach-day` | skylos | Prioritized chase queue for today, grouped by company preferred channel |

Each script accepts `--help` and emits a single JSON envelope to stdout. See `scripts/<group>/<tool>.js` for args and output shape.

Outreach guidance: when sharing material, pick the asset whose `notes` field (via `list-assets`) matches the situation — the notes say when to use each one. Always pass `--next-touch` when logging an outreach activity so the lead stays in the chase queue. For "how is it going with lead X", `get-company` alone answers it (follow-up state + suggestions included).

For dev setup, conventions, assets, install, and deploy info, see [README.md](README.md).
