import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  type WASocket,
  type proto,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import qrcode from "qrcode-terminal";
import { logMessage, countOutboundSince } from "./db.js";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

const MAX_SENDS_PER_HOUR = 20;
const JITTER_MIN_MS = 30_000;
const JITTER_MAX_MS = 90_000;

let sock: WASocket | null = null;
let connected = false;
let selfJid: string | null = null;

export function status() {
  return { connected, jid: selfJid };
}

export function normalizeJid(input: string): string {
  if (input.includes("@")) return input;
  return `${input.replace(/[^0-9]/g, "")}@s.whatsapp.net`;
}

function extractText(msg: proto.IWebMessageInfo): string | null {
  const m = msg.message;
  if (!m) return null;
  return (
    m.conversation ??
    m.extendedTextMessage?.text ??
    m.imageMessage?.caption ??
    m.videoMessage?.caption ??
    null
  );
}

export async function startWhatsApp(): Promise<void> {
  const { state, saveCreds } = await useMultiFileAuthState(
    process.env.AUTH_DIR ?? "./auth"
  );
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger: logger.child({ module: "baileys" }),
    // We never mark messages read automatically; a human does that on the phone.
    markOnlineOnConnect: false,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      logger.info("Scan this QR with the DEDICATED outreach number:");
      qrcode.generate(qr, { small: true });
    }
    if (connection === "open") {
      connected = true;
      selfJid = sock?.user?.id ?? null;
      logger.info({ jid: selfJid }, "WhatsApp connection open");
    }
    if (connection === "close") {
      connected = false;
      const code = (lastDisconnect?.error as Boom | undefined)?.output
        ?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        logger.error(
          "Logged out. Delete the ./auth directory and restart to pair again."
        );
      } else {
        logger.warn({ code }, "Connection closed, reconnecting in 5s");
        setTimeout(() => void startWhatsApp(), 5_000);
      }
    }
  });

  sock.ev.on("messages.upsert", ({ messages, type }) => {
    if (type !== "notify" && type !== "append") return;
    for (const msg of messages) {
      const jid = msg.key.remoteJid;
      if (!jid || jid === "status@broadcast") continue;
      const text = extractText(msg);
      if (text === null) continue;
      logMessage({
        direction: msg.key.fromMe ? "out" : "in",
        jid,
        text,
        wa_message_id: msg.key.id ?? null,
        timestamp: Number(msg.messageTimestamp) || Math.floor(Date.now() / 1000),
      });
    }
  });
}

// Sends are serialized through a promise chain so the jitter gap between any
// two automated sends is always respected, even under concurrent API calls.
let sendChain: Promise<unknown> = Promise.resolve();
let lastSendAt = 0;

export function sendText(jidInput: string, text: string): Promise<string> {
  const result = sendChain.then(() => doSend(jidInput, text));
  sendChain = result.catch(() => {});
  return result;
}

async function doSend(jidInput: string, text: string): Promise<string> {
  if (!sock || !connected) {
    throw new Error("not_connected: WhatsApp session is not open");
  }
  const hourAgo = Math.floor(Date.now() / 1000) - 3600;
  if (countOutboundSince(hourAgo) >= MAX_SENDS_PER_HOUR) {
    throw new Error(
      `rate_limited: ${MAX_SENDS_PER_HOUR} messages/hour cap reached, retry next cycle`
    );
  }
  const jitter =
    JITTER_MIN_MS + Math.random() * (JITTER_MAX_MS - JITTER_MIN_MS);
  const waitMs = lastSendAt + jitter - Date.now();
  if (waitMs > 0) {
    await new Promise((r) => setTimeout(r, waitMs));
  }
  const jid = normalizeJid(jidInput);
  const sent = await sock.sendMessage(jid, { text });
  lastSendAt = Date.now();
  const waMessageId = sent?.key?.id ?? null;
  logMessage({
    direction: "out",
    jid,
    text,
    wa_message_id: waMessageId,
    timestamp: Math.floor(Date.now() / 1000),
  });
  logger.info({ jid, waMessageId }, "message sent");
  if (!waMessageId) throw new Error("send_failed: no message id returned");
  return waMessageId;
}
