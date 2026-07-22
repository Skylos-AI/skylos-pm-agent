import express, { type Request, type Response } from "express";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { sendText, status } from "./wa.js";
import { recentMessages, chatHistory } from "./db.js";

function buildMcpServer(): McpServer {
  const server = new McpServer({ name: "wa-baileys-mcp", version: "0.1.0" });

  server.registerTool(
    "send_message",
    {
      description:
        "Send a WhatsApp text message. Rate-limited to 20/hour with 30-90s jitter between sends; may take up to ~90s to resolve. Returns the WhatsApp message id.",
      inputSchema: {
        jid: z
          .string()
          .describe("Recipient JID (e.g. 59171234567@s.whatsapp.net) or bare phone number"),
        text: z.string().min(1).describe("Message body, already rendered"),
      },
    },
    async ({ jid, text }) => {
      const waMessageId = await sendText(jid, text);
      return {
        content: [{ type: "text", text: JSON.stringify({ wa_message_id: waMessageId }) }],
      };
    }
  );

  server.registerTool(
    "list_recent_chats",
    {
      description:
        "List all messages (inbound and outbound) from the last N hours, oldest first. Filter on direction='in' for replies.",
      inputSchema: {
        hours: z.number().positive().max(168).default(1),
      },
    },
    async ({ hours }) => ({
      content: [{ type: "text", text: JSON.stringify(recentMessages(hours)) }],
    })
  );

  server.registerTool(
    "get_chat_history",
    {
      description: "Last N logged messages for one JID, oldest first.",
      inputSchema: {
        jid: z.string(),
        limit: z.number().int().positive().max(500).default(50),
      },
    },
    async ({ jid, limit }) => ({
      content: [{ type: "text", text: JSON.stringify(chatHistory(jid, limit)) }],
    })
  );

  return server;
}

export function startApi(port: number): void {
  const app = express();
  app.use(express.json());

  // --- Plain REST, for openclaw skill scripts (CLI-in/JSON-out pattern) ---

  app.get("/health", (_req: Request, res: Response) => {
    res.json(status());
  });

  app.post("/send", async (req: Request, res: Response) => {
    const parsed = z
      .object({ jid: z.string(), text: z.string().min(1) })
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    try {
      const waMessageId = await sendText(parsed.data.jid, parsed.data.text);
      res.json({ wa_message_id: waMessageId });
    } catch (err) {
      res.status(429).json({ error: (err as Error).message });
    }
  });

  app.get("/recent-chats", (req: Request, res: Response) => {
    const hours = Math.min(Number(req.query.hours) || 1, 168);
    res.json(recentMessages(hours));
  });

  app.get("/chat-history", (req: Request, res: Response) => {
    const jid = String(req.query.jid ?? "");
    if (!jid) {
      res.status(400).json({ error: "jid query param required" });
      return;
    }
    const limit = Math.min(Number(req.query.limit) || 50, 500);
    res.json(chatHistory(jid, limit));
  });

  // --- MCP (streamable HTTP, stateless) at POST /mcp ---

  app.post("/mcp", async (req: Request, res: Response) => {
    const server = buildMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  // Bind to loopback only — this service must never be reachable off-box.
  app.listen(port, "127.0.0.1", () => {
    console.log(`wa-baileys-mcp listening on 127.0.0.1:${port} (REST + POST /mcp)`);
  });
}
