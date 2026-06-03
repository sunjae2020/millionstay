import { Router, type IRouter } from "express";
import { db, chatConversationsTable, integrationSettings } from "@workspace/db";
import { eq } from "drizzle-orm";
import { isChatConfigured, ChatConfigError } from "../lib/chat/anthropic";
import { runChatTurn, type ChatEvent } from "../lib/chat/agent";

const router: IRouter = Router();

const MAX_MESSAGE_LEN = 4000;

/** Whether the landing-page widget should render. Admin-controlled, default on. */
async function isWidgetEnabled(): Promise<boolean> {
  try {
    const [row] = await db
      .select({ value: integrationSettings.value })
      .from(integrationSettings)
      .where(eq(integrationSettings.key, "CHAT_WIDGET_ENABLED"));
    // Default to enabled when the setting has never been saved.
    return row ? row.value !== "false" : true;
  } catch {
    return true;
  }
}

/**
 * GET /api/v1/public/chat/config
 * Public — the landing-page widget reads this to decide whether to show itself.
 */
router.get("/v1/public/chat/config", async (_req, res): Promise<void> => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ enabled: await isWidgetEnabled(), configured: isChatConfigured() });
});

/**
 * POST /api/v1/public/chat
 * Public AI customer chat. Streams the assistant reply as Server-Sent Events.
 *
 * Body: { session_id: string, message: string, conversation_id?: string, language?: string }
 * SSE events (each `data:` line is JSON): { type: "meta" | "delta" | "tool" | "ui" | "done" | "error", ... }
 */
router.post("/v1/public/chat", async (req, res): Promise<void> => {
  const body = req.body ?? {};
  const sessionId = String(body.session_id ?? "").trim();
  const message = String(body.message ?? "").trim();
  const language = body.language ? String(body.language).slice(0, 12) : null;
  let conversationId = body.conversation_id ? String(body.conversation_id) : null;

  if (!isChatConfigured()) {
    res.status(503).json({ error: "AI chat is temporarily unavailable." });
    return;
  }
  if (!sessionId) {
    res.status(400).json({ error: "session_id is required" });
    return;
  }
  if (!message) {
    res.status(400).json({ error: "message is required" });
    return;
  }
  if (message.length > MAX_MESSAGE_LEN) {
    res.status(400).json({ error: `message too long (max ${MAX_MESSAGE_LEN} characters)` });
    return;
  }

  try {
    // Load or create the conversation, scoped to this visitor's session.
    if (conversationId) {
      const [existing] = await db
        .select({ id: chatConversationsTable.id, session_id: chatConversationsTable.session_id })
        .from(chatConversationsTable)
        .where(eq(chatConversationsTable.id, conversationId));
      if (!existing || existing.session_id !== sessionId) conversationId = null;
    }
    if (!conversationId) {
      const [created] = await db
        .insert(chatConversationsTable)
        .values({ session_id: sessionId, language, status: "open" })
        .returning({ id: chatConversationsTable.id });
      conversationId = created!.id;
    }
  } catch (err) {
    res.status(500).json({ error: "Could not start the conversation." });
    return;
  }

  // ── Begin SSE stream ──
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable proxy buffering (nginx)
  res.flushHeaders?.();

  const send = (event: ChatEvent | { type: "meta"; conversation_id: string }) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  send({ type: "meta", conversation_id: conversationId });

  let aborted = false;
  req.on("close", () => { aborted = true; });

  try {
    await runChatTurn({
      conversationId,
      sessionId,
      userMessage: message,
      emit: (event) => { if (!aborted) send(event); },
    });
  } catch (err) {
    const msg = err instanceof ChatConfigError
      ? "AI chat is temporarily unavailable."
      : "Sorry — something went wrong. Please try again.";
    // eslint-disable-next-line no-console
    console.error("[chat] turn failed:", err);
    if (!aborted) send({ type: "error", message: msg });
  } finally {
    if (!aborted) res.end();
  }
});

export default router;
