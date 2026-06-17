# Skill assets

Static files Manu can read at runtime. Bundled with the skill so they ship
with the deploy — no Supabase Storage / external lookup needed for the
common case.

Layout:

```
assets/
├── proposals/      Markdown templates with {{placeholders}}
├── brand/          Guidelines, palette, logo
└── personas/       Enriched briefs (more than what fits in the DB row)
```

Code under `scripts/` loads these via `path.join(__dirname, "../../assets/...")`.

When to put something here vs. somewhere else:
- **Here** — templates / guidelines / persona briefs / palette. Stable,
  versioned in git, same for every client.
- **Supabase Storage** — anything client-specific or generated (signed
  contracts, sent proposals, scope docs from a client). Add a
  `client-assets` bucket and download via the supabase-js client.
- **External link** — anything already living in Google Drive / Notion;
  just paste the URL into the company `notes` or task `resources` field.

## Available placeholders in templates

Proposal templates support these substitutions:

| Placeholder | Source |
|---|---|
| `{{company_name}}` | `companies.name` |
| `{{contact_name}}` | primary contact's first name, or "Gerente General" |
| `{{contact_full_name}}` | primary contact's full name |
| `{{sector}}` | `companies.sector` |
| `{{persona_name}}` | persona display name |
| `{{persona_pain_points}}` | bulleted list from persona |
| `{{service_type}}` | service label (AI Audit / Automation / etc.) |
| `{{value_usd}}` | proposed value in USD |
| `{{author_name}}` | the user running the skill |
| `{{today}}` | today's date in `dd MMM yyyy` |
