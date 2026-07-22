import Database from "better-sqlite3";

export interface MessageRow {
  id: number;
  direction: "in" | "out";
  jid: string;
  text: string | null;
  wa_message_id: string | null;
  timestamp: number; // unix seconds
}

const db = new Database(process.env.DB_PATH ?? "wa-log.sqlite");
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    direction TEXT NOT NULL CHECK (direction IN ('in','out')),
    jid TEXT NOT NULL,
    text TEXT,
    wa_message_id TEXT,
    timestamp INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages (timestamp);
  CREATE INDEX IF NOT EXISTS idx_messages_jid ON messages (jid, timestamp);
`);

const insertStmt = db.prepare(
  `INSERT INTO messages (direction, jid, text, wa_message_id, timestamp)
   VALUES (@direction, @jid, @text, @wa_message_id, @timestamp)`
);

export function logMessage(row: Omit<MessageRow, "id">): void {
  insertStmt.run(row);
}

export function countOutboundSince(unixSeconds: number): number {
  const r = db
    .prepare(
      `SELECT COUNT(*) AS n FROM messages WHERE direction = 'out' AND timestamp >= ?`
    )
    .get(unixSeconds) as { n: number };
  return r.n;
}

export function recentMessages(hours: number): MessageRow[] {
  const since = Math.floor(Date.now() / 1000) - Math.floor(hours * 3600);
  return db
    .prepare(`SELECT * FROM messages WHERE timestamp >= ? ORDER BY timestamp ASC`)
    .all(since) as MessageRow[];
}

export function chatHistory(jid: string, limit: number): MessageRow[] {
  return (
    db
      .prepare(
        `SELECT * FROM messages WHERE jid = ? ORDER BY timestamp DESC LIMIT ?`
      )
      .all(jid, limit) as MessageRow[]
  ).reverse();
}
