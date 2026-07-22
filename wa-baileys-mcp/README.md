# wa-baileys-mcp

Persistent WhatsApp service for the Skylos outreach MVP (spec:
`D:\skylos-crm-openclaw\wa-outreach-v1.txt`). Keeps one Baileys session alive and
exposes it two ways on **localhost only**:

- **REST** — for openclaw skill scripts (CLI-in/JSON-out pattern)
- **MCP** (streamable HTTP, `POST /mcp`) — for any MCP-capable client

⚠️ **Use a dedicated phone number.** Never pair this with a personal or main
business WhatsApp. Baileys is unofficial; bans are possible.

## Endpoints (default port 3131, binds 127.0.0.1)

| Method | Path | Body / query | Returns |
|---|---|---|---|
| GET | `/health` | — | `{connected, jid}` |
| POST | `/send` | `{jid, text}` | `{wa_message_id}` — blocks up to ~90s (jitter); `429` on rate limit |
| GET | `/recent-chats` | `?hours=1` | message rows, both directions, oldest first |
| GET | `/chat-history` | `?jid=...&limit=50` | message rows for one JID |
| POST | `/mcp` | MCP streamable HTTP | tools: `send_message`, `list_recent_chats`, `get_chat_history` |

`jid` accepts a full JID (`59171234567@s.whatsapp.net`) or a bare phone number.

Built-in guardrails: max **20 sends/hour** (rejects, runner retries next cycle),
**30–90s random jitter** between sends (calls queue and block). Every send and
receive is logged to `wa-log.sqlite` — debug only; the CRM log is canonical.

## First run / pairing

```bash
npm install
npm run build
node dist/index.js   # QR prints in terminal — scan with the dedicated number
```

Auth persists in `./auth/` (gitignored) — QR is scanned once. If logs say
`Logged out`, delete `./auth/` and pair again.

## VPS deployment

Lives inside the `skylos-pm-agent` monorepo; clone the whole repo and work in
this subfolder.

```bash
# on the VPS
sudo mkdir -p /opt/skylos-pm-agent && sudo chown openclaw /opt/skylos-pm-agent
git clone https://github.com/Skylos-AI/skylos-pm-agent.git /opt/skylos-pm-agent
cd /opt/skylos-pm-agent/wa-baileys-mcp
npm install && npm run build
node dist/index.js            # pair once (scan QR), then Ctrl+C
sudo cp deploy/wa-baileys-mcp.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now wa-baileys-mcp
journalctl -u wa-baileys-mcp -f   # verify "connection open"
```

## Env vars

- `PORT` (default 3131)
- `AUTH_DIR` (default `./auth`)
- `DB_PATH` (default `wa-log.sqlite`)
- `LOG_LEVEL` (default `info`)
