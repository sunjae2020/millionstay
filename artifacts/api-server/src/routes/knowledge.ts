import { Router, type IRouter } from "express";
import multer from "multer";
import { db, knowledgeDocumentsTable, chatConversationsTable, chatMessagesTable } from "@workspace/db";
import { eq, desc, asc } from "drizzle-orm";
import { decodeUploadFilename } from "../lib/uploadFilename";

// NOTE: paths live under /api/v1 (protected by the app-level requireAuth) but
// deliberately NOT under /api/v1/admin — in development that prefix is shadowed
// by the dev-migration guard router, which 404s everything when disabled.

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const STATUSES = ["active", "archived"] as const;

/** Extract plain text from an uploaded knowledge file (PDF / text). */
async function extractText(file: Express.Multer.File): Promise<{ text: string; sourceType: string }> {
  const mime = file.mimetype || "";
  const name = (file.originalname || "").toLowerCase();
  if (mime === "application/pdf" || name.endsWith(".pdf")) {
    // pdf-parse v2 (external in the bundle) — imported lazily so a broken
    // optional dep never blocks server start.
    const mod: any = await import("pdf-parse");
    const PDFParse = mod.PDFParse ?? mod.default?.PDFParse;
    const parser = new PDFParse({ data: file.buffer });
    try {
      const result = await parser.getText();
      return { text: String(result?.text ?? "").trim(), sourceType: "pdf" };
    } finally {
      await parser.destroy?.().catch(() => {});
    }
  }
  // Treat everything else as UTF-8 text (txt / md / csv …).
  return { text: file.buffer.toString("utf8").trim(), sourceType: "file" };
}

/* ── GET /api/v1/knowledge — list knowledge documents ── */
router.get("/v1/knowledge", async (req, res): Promise<void> => {
  try {
    const status = String((req.query as any).status ?? "").trim();
    const where = status && STATUSES.includes(status as any)
      ? eq(knowledgeDocumentsTable.status, status)
      : undefined;
    const rows = await db
      .select({
        id: knowledgeDocumentsTable.id,
        title: knowledgeDocumentsTable.title,
        source_type: knowledgeDocumentsTable.source_type,
        language: knowledgeDocumentsTable.language,
        status: knowledgeDocumentsTable.status,
        created_at: knowledgeDocumentsTable.created_at,
        updated_at: knowledgeDocumentsTable.updated_at,
      })
      .from(knowledgeDocumentsTable)
      .where(where as any)
      .orderBy(desc(knowledgeDocumentsTable.updated_at));
    res.json({ success: true, data: rows });
  } catch {
    res.status(500).json({ error: "Failed to list knowledge documents" });
  }
});

/* ── GET /api/v1/knowledge/:id — single document with content ── */
router.get("/v1/knowledge/:id", async (req, res): Promise<void> => {
  try {
    const [row] = await db.select().from(knowledgeDocumentsTable).where(eq(knowledgeDocumentsTable.id, req.params.id));
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ success: true, data: row });
  } catch {
    res.status(500).json({ error: "Failed to fetch document" });
  }
});

/* ── POST /api/v1/knowledge — create (raw text or file upload) ── */
router.post("/v1/knowledge", upload.single("file"), async (req, res): Promise<void> => {
  try {
    const userId = (req as any).user?.id ?? null;
    const body = req.body ?? {};
    let title = String(body.title ?? "").trim();
    const language = body.language ? String(body.language).trim().slice(0, 12) : null;
    let contentText = String(body.content_text ?? "").trim();
    let sourceType = "text";

    const file = (req as any).file as Express.Multer.File | undefined;
    if (file) {
      const extracted = await extractText(file);
      if (!contentText) contentText = extracted.text;
      sourceType = extracted.sourceType;
      if (!title) title = decodeUploadFilename(file.originalname) || "Untitled document";
    }

    if (!title) { res.status(400).json({ error: "title is required" }); return; }
    if (!contentText) { res.status(400).json({ error: "content_text (or a readable file) is required" }); return; }

    const [row] = await db
      .insert(knowledgeDocumentsTable)
      .values({ title, content_text: contentText, language, source_type: sourceType, status: "active", created_by: userId })
      .returning({ id: knowledgeDocumentsTable.id });
    res.status(201).json({ success: true, id: row!.id });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[knowledge] create failed:", err);
    res.status(500).json({ error: "Failed to create knowledge document" });
  }
});

/* ── PATCH /api/v1/knowledge/:id — update fields ── */
router.patch("/v1/knowledge/:id", async (req, res): Promise<void> => {
  try {
    const body = req.body ?? {};
    const update: Record<string, unknown> = {};
    if (body.title !== undefined) update.title = String(body.title).trim();
    if (body.content_text !== undefined) update.content_text = String(body.content_text);
    if (body.language !== undefined) update.language = body.language ? String(body.language).slice(0, 12) : null;
    if (body.status !== undefined && STATUSES.includes(String(body.status) as any)) update.status = String(body.status);
    if (Object.keys(update).length === 0) { res.status(400).json({ error: "No valid fields to update" }); return; }

    const [row] = await db
      .update(knowledgeDocumentsTable)
      .set(update)
      .where(eq(knowledgeDocumentsTable.id, req.params.id))
      .returning({ id: knowledgeDocumentsTable.id });
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ success: true, id: row.id });
  } catch {
    res.status(500).json({ error: "Failed to update knowledge document" });
  }
});

/* ── DELETE /api/v1/knowledge/:id — remove ── */
router.delete("/v1/knowledge/:id", async (req, res): Promise<void> => {
  try {
    await db.delete(knowledgeDocumentsTable).where(eq(knowledgeDocumentsTable.id, req.params.id));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete knowledge document" });
  }
});

/* ── GET /api/v1/chat/conversations — recent saved conversations ── */
router.get("/v1/chat/conversations", async (req, res): Promise<void> => {
  try {
    const limit = Math.min(Number((req.query as any).limit) || 50, 200);
    const rows = await db
      .select()
      .from(chatConversationsTable)
      .orderBy(desc(chatConversationsTable.last_message_at), desc(chatConversationsTable.created_at))
      .limit(limit);
    res.json({ success: true, data: rows });
  } catch {
    res.status(500).json({ error: "Failed to list conversations" });
  }
});

/* ── GET /api/v1/chat/conversations/:id/messages — transcript ── */
router.get("/v1/chat/conversations/:id/messages", async (req, res): Promise<void> => {
  try {
    const [conv] = await db.select().from(chatConversationsTable).where(eq(chatConversationsTable.id, req.params.id));
    if (!conv) { res.status(404).json({ error: "Not found" }); return; }
    const messages = await db
      .select()
      .from(chatMessagesTable)
      .where(eq(chatMessagesTable.conversation_id, req.params.id))
      .orderBy(asc(chatMessagesTable.created_at));
    res.json({ success: true, data: { conversation: conv, messages } });
  } catch {
    res.status(500).json({ error: "Failed to fetch transcript" });
  }
});

export default router;
