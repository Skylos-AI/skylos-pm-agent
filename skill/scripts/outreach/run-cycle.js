#!/usr/bin/env node
const path = require("path");
const { execFileSync } = require("child_process");
const { runTool } = require("../lib/runner");
const { getClient } = require("../lib/supabase");
const { appError } = require("../lib/envelope");

// The 15-minute outreach cycle (openclaw cron). Stateless glue: every state
// change goes through the sibling outreach tools (spawned as CLIs so each one
// writes its own agent_log entry), sends go through wa-baileys-mcp's REST API.
//
// Phase order is inbound FIRST: a reply that arrived since the last cycle must
// cancel the sequence before we consider sending a bump.
//   C. pull inbound from baileys → record-inbound each
//   B. approved first-touches → send → record-send → mark sent
//   A. due sequence actions → render, window-check → send or park for approval
//
// A rate-limit rejection from baileys stops all further sends in the cycle.
// MAX_SENDS_PER_CYCLE bounds cycle length (each send blocks 30-90s on jitter).

const BAILEYS_URL = process.env.WA_BAILEYS_URL || "http://127.0.0.1:3131";
const MAX_SENDS_PER_CYCLE = 5;
const LA_PAZ_UTC_OFFSET_H = -4; // no DST in Bolivia

function tool(name, args) {
  const script = path.join(__dirname, `${name}.js`);
  let stdout;
  try {
    stdout = execFileSync(process.execPath, [script, ...args], {
      encoding: "utf8",
      timeout: 60_000,
    });
  } catch (e) {
    stdout = e.stdout; // tools exit 1 but still emit an envelope
    if (!stdout) throw appError("UNKNOWN", `${name} sin salida: ${e.message}`);
  }
  const envelope = JSON.parse(stdout.trim().split("\n").pop());
  if (!envelope.ok)
    throw appError(
      envelope.error?.code || "UNKNOWN",
      `${name}: ${envelope.error?.message || "error"}`,
    );
  return envelope.data;
}

async function baileys(method, pathname, body) {
  const res = await fetch(`${BAILEYS_URL}${pathname}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(json.error || `${pathname} HTTP ${res.status}`);
    e.rateLimited = res.status === 429;
    throw e;
  }
  return json;
}

// --- send window (America/La_Paz) ---

function laPazNow() {
  const utcMs = Date.now();
  const lp = new Date(utcMs + LA_PAZ_UTC_OFFSET_H * 3600 * 1000);
  return {
    day: lp.getUTCDay() === 0 ? 7 : lp.getUTCDay(), // 1=Mon .. 7=Sun
    minutes: lp.getUTCHours() * 60 + lp.getUTCMinutes(),
    date: lp,
  };
}

function parseHHMM(s) {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

function insideWindow(win) {
  if (!win) return true;
  const { day, minutes } = laPazNow();
  if (Array.isArray(win.days) && !win.days.includes(day)) return false;
  return minutes >= parseHHMM(win.start) && minutes <= parseHHMM(win.end);
}

// Next window start as a UTC ISO string (checks today first, then up to a week).
function nextWindowStartIso(win) {
  const { day, minutes, date } = laPazNow();
  const startMin = parseHHMM(win.start);
  for (let offset = 0; offset <= 7; offset++) {
    const d = ((day - 1 + offset) % 7) + 1;
    if (Array.isArray(win.days) && !win.days.includes(d)) continue;
    if (offset === 0 && minutes >= startMin) continue; // today's window already open/past
    const lp = new Date(date);
    lp.setUTCDate(lp.getUTCDate() + offset);
    lp.setUTCHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
    return new Date(lp.getTime() - LA_PAZ_UTC_OFFSET_H * 3600 * 1000).toISOString();
  }
  return new Date(Date.now() + 24 * 3600 * 1000).toISOString(); // defensive fallback
}

// --- template rendering ---

function buildVars(company) {
  const primary =
    (company.contacts || []).find((c) => c.is_primary) ||
    (company.contacts || [])[0];
  return {
    empresa: company.name,
    sector: company.sector,
    ciudad: company.city,
    contacto: primary?.full_name,
    nombre: primary?.full_name?.split(/\s+/)[0],
  };
}

function render(template, company) {
  const vars = buildVars(company);
  const missing = (template.variables_required || []).filter(
    (v) => !vars[v] || String(vars[v]).trim() === "",
  );
  if (missing.length) return { missing };
  const body = template.body.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
  if (/\{\{\w+\}\}/.test(body)) return { missing: ["<unrendered>"] };
  return { body };
}

runTool({
  name: "run-outreach-cycle",
  actionType: "outreach.cycle_run",
  source: "CRON",
  requireUser: false,
  yargsBuilder: (y) =>
    y.option("dry-run", {
      type: "boolean",
      default: false,
      describe: "Report what would happen; no sends, no state changes.",
    }),
  handler: async (argv) => {
    const dry = argv["dry-run"];
    const report = {
      inbound: { pulled: 0, recorded: 0, error: null },
      approved_sent: 0,
      due: { sent: 0, parked_for_approval: 0, rescheduled_window: 0, errors: [] },
      skipped: [],
      dry_run: dry,
    };
    let sendsLeft = MAX_SENDS_PER_CYCLE;
    let rateLimited = false;

    // Phase C first — inbound replies cancel sequences before any send.
    try {
      const chats = await baileys("GET", "/recent-chats?hours=1");
      const inbound = chats.filter((m) => m.direction === "in");
      report.inbound.pulled = inbound.length;
      for (const msg of inbound) {
        if (dry) continue;
        tool("record-inbound", [
          "--jid", msg.jid,
          "--text", msg.text ?? "",
          "--timestamp", String(msg.timestamp),
          "--wa-message-id", msg.wa_message_id ?? `unknown_${msg.id}`,
        ]);
        report.inbound.recorded++;
      }
    } catch (e) {
      // Baileys down must not block recording state elsewhere; report and go on.
      report.inbound.error = e.message;
    }

    const doSend = async (jid, text) => {
      const r = await baileys("POST", "/send", { jid, text });
      sendsLeft--;
      return r.wa_message_id;
    };

    // Phase B — approved first-touches.
    const { approvals } = tool("list-pending-approvals", ["--status", "APPROVED"]);
    for (const ap of approvals) {
      if (rateLimited || sendsLeft <= 0) break;
      const jid = ap.companies?.wa_jid;
      if (!jid) {
        report.due.errors.push({ approval: ap.id, error: "sin wa_jid" });
        continue;
      }
      if (dry) { report.approved_sent++; continue; }
      try {
        const waMessageId = await doSend(jid, ap.rendered_body);
        tool("record-send", [
          "--company", ap.company_id,
          "--template", ap.template_id,
          "--wa-message-id", waMessageId,
        ]);
        tool("mark-approval", ["--id", ap.id, "--status", "sent"]);
        report.approved_sent++;
      } catch (e) {
        if (e.rateLimited) { rateLimited = true; break; }
        report.due.errors.push({ approval: ap.id, error: e.message });
      }
    }

    // Phase A — due sequence actions.
    const { enabled, due } = tool("list-due-actions", []);
    if (!enabled) {
      report.skipped.push("kill_switch_off");
    } else {
      for (const company of due) {
        if (rateLimited || sendsLeft <= 0) {
          report.skipped.push(`${company.name}: sin cupo de envío este ciclo`);
          continue;
        }
        try {
          const { template } = tool("get-template", ["--id", company.next_action]);

          const rendered = render(template, company);
          if (rendered.missing) {
            if (!dry)
              tool("set-next-action", [
                "--company", company.id,
                "--action", "error_missing_vars",
              ]);
            report.due.errors.push({
              company: company.name,
              error: `variables faltantes: ${rendered.missing.join(", ")}`,
            });
            continue;
          }

          if (!insideWindow(template.send_window)) {
            if (!dry)
              tool("set-next-action", [
                "--company", company.id,
                "--action", template.id,
                "--at", nextWindowStartIso(template.send_window),
              ]);
            report.due.rescheduled_window++;
            continue;
          }

          if (company.sequence_position === 0) {
            if (!dry)
              tool("create-pending-approval", [
                "--company", company.id,
                "--template", template.id,
                "--body", rendered.body,
              ]);
            report.due.parked_for_approval++;
            continue;
          }

          if (!company.wa_jid) {
            if (!dry)
              tool("set-next-action", [
                "--company", company.id,
                "--action", "error_missing_jid",
              ]);
            report.due.errors.push({ company: company.name, error: "sin wa_jid" });
            continue;
          }

          if (dry) { report.due.sent++; continue; }
          const waMessageId = await doSend(company.wa_jid, rendered.body);
          tool("record-send", [
            "--company", company.id,
            "--template", template.id,
            "--wa-message-id", waMessageId,
          ]);
          report.due.sent++;
        } catch (e) {
          if (e.rateLimited) { rateLimited = true; continue; }
          report.due.errors.push({ company: company.name, error: e.message });
        }
      }
    }

    if (rateLimited) report.skipped.push("rate_limited_by_baileys");

    const summary =
      `Ciclo${dry ? " (dry-run)" : ""}: ${report.due.sent} enviados, ` +
      `${report.approved_sent} aprobados enviados, ` +
      `${report.due.parked_for_approval} en aprobación, ` +
      `${report.inbound.recorded} respuestas registradas, ` +
      `${report.due.errors.length} errores.`;

    return {
      data: report,
      summary,
      requestSummary: `Ciclo de outreach${dry ? " (dry-run)" : ""}.`,
    };
  },
});
