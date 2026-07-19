import { Router, type IRouter } from "express";
import multer from "multer";
import { eq, desc, and, sql } from "drizzle-orm";
import { db, csTicketsTable, csMessagesTable } from "@workspace/db";
import { requirePartnerAuth, type PartnerAuthPayload } from "../middlewares/requirePartnerAuth";
import { isCloudinaryConfigured, uploadToCloudinary, cldFolder } from "../utils/cloudinary";
import { translateAndStoreMessage } from "../lib/chat/translateMessage";

// Languages the partner portals ship (no Vietnamese, unlike the guest web app).
const SUPPORTED_PARTNER_LANGS = ["en", "ja", "ko", "th", "zh"];
function normalizeLang(raw: unknown): string {
  const code = typeof raw === "string" ? raw.trim().toLowerCase().slice(0, 2) : "";
  return SUPPORTED_PARTNER_LANGS.includes(code) ? code : "en";
}

// Adopt the language the partner actually wrote in (auto-detected from the
// message text) as the ticket's customer_language, so subsequent admin replies
// are translated into it. The UI locale is an unreliable signal, so a Korean
// partner whose ticket was created with customer_language="en" would otherwise
// never receive Korean translations of admin replies. Mirrors guest-cs.ts.
async function adoptCustomerLanguage(ticketId: number, current: string, detected: string): Promise<void> {
  if (detected && detected !== "en" && detected !== current && SUPPORTED_PARTNER_LANGS.includes(detected)) {
    await db.update(csTicketsTable).set({ customer_language: detected }).where(eq(csTicketsTable.id, ticketId));
  }
}

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// SECURITY: every /v1/partner/cs* route requires a valid partner JWT. All reads
// and writes are scoped to the caller's own partner_user_id, so a partner can
// only ever converse with admin — never with another portal user or a guest.
router.use(["/v1/partner/cs-tickets", "/v1/partner/cs"], requirePartnerAuth);

const CS_CATEGORIES = ["General", "Accommodation", "Billing", "Maintenance", "Other"] as const;

async function generateTicketRef(): Promise<string> {
  const year = new Date().getFullYear();
  const result = await db.select({ count: sql<number>`COUNT(*)::int` })
    .from(csTicketsTable)
    .where(sql`EXTRACT(YEAR FROM ${csTicketsTable.created_at}) = ${year}`);
  const seq = ((result[0]?.count ?? 0) + 1).toString().padStart(4, "0");
  return `CS-${year}-${seq}`;
}

/* ─────────────────────────────────────────────
   IMAGE UPLOAD — partner
───────────────────────────────────────────── */
router.post("/v1/partner/cs/upload-image", upload.single("image"), async (req, res): Promise<void> => {
  try {
    if (!req.file) { res.status(400).json({ success: false, error: { code: "NO_FILE", message: "No file provided" } }); return; }
    if (!isCloudinaryConfigured()) { res.status(503).json({ success: false, error: { code: "NOT_CONFIGURED", message: "Image upload not configured" } }); return; }
    const result = await uploadToCloudinary(req.file.buffer, { folder: cldFolder("cs") });
    res.json({ success: true, url: result.secure_url, thumbnail_url: result.thumbnail_url });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "UPLOAD_FAILED", message: err.message } });
  }
});

/* ─────────────────────────────────────────────
   PARTNER: List my tickets
───────────────────────────────────────────── */
router.get("/v1/partner/cs-tickets", async (req, res): Promise<void> => {
  try {
    const partner = (req as any).partner as PartnerAuthPayload;
    const tickets = await db
      .select()
      .from(csTicketsTable)
      .where(eq(csTicketsTable.partner_user_id, partner.id))
      .orderBy(desc(csTicketsTable.created_at));

    const ticketsWithCount = await Promise.all(tickets.map(async (t) => {
      const countResult = await db.select({ count: sql<number>`COUNT(*)::int` })
        .from(csMessagesTable)
        .where(and(eq(csMessagesTable.ticket_id, t.id), eq(csMessagesTable.is_internal, 0)));
      return { ...t, message_count: countResult[0]?.count ?? 0 };
    }));

    res.json({ success: true, data: ticketsWithCount });
  } catch {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: "Failed to list tickets" } });
  }
});

/* ─────────────────────────────────────────────
   PARTNER: Create ticket
───────────────────────────────────────────── */
router.post("/v1/partner/cs-tickets", async (req, res): Promise<void> => {
  try {
    const partner = (req as any).partner as PartnerAuthPayload;
    const { category, subject, description, image_urls, customer_language } = req.body;

    if (!subject?.trim() || !description?.trim()) {
      res.status(400).json({ success: false, error: { code: "VALIDATION", message: "subject and description are required" } });
      return;
    }

    const ticket_ref = await generateTicketRef();
    const customerLang = normalizeLang(customer_language);

    const [ticket] = await db.insert(csTicketsTable).values({
      ticket_ref,
      requester_type: partner.portal_type,
      partner_user_id: partner.id,
      guest_user_id: null,
      booking_id: null,
      category: CS_CATEGORIES.includes(category) ? category : "General",
      subject: subject.trim(),
      description: description.trim(),
      status: "Open",
      priority: "Normal",
      customer_language: customerLang,
    }).returning();

    const [msg] = await db.insert(csMessagesTable).values({
      ticket_id: ticket.id,
      sender_type: partner.portal_type,
      sender_id: partner.id,
      message: description.trim(),
      original_lang: customerLang,
      image_urls: image_urls?.length ? JSON.stringify(image_urls) : null,
      is_internal: 0,
    }).returning();

    const patch = await translateAndStoreMessage({
      messageId: msg.id,
      text: description.trim(),
      originalLang: customerLang,
      customerLanguage: customerLang,
      enabled: ticket.translation_enabled,
    });
    await adoptCustomerLanguage(ticket.id, ticket.customer_language, patch.original_lang);

    res.status(201).json({ success: true, data: ticket });
  } catch {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: "Failed to create ticket" } });
  }
});

/* ─────────────────────────────────────────────
   PARTNER: Get ticket detail (own ticket only)
───────────────────────────────────────────── */
router.get("/v1/partner/cs-tickets/:id", async (req, res): Promise<void> => {
  try {
    const partner = (req as any).partner as PartnerAuthPayload;
    const id = Number(req.params.id);

    const [ticket] = await db.select().from(csTicketsTable)
      .where(and(eq(csTicketsTable.id, id), eq(csTicketsTable.partner_user_id, partner.id)));

    if (!ticket) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Ticket not found" } }); return; }

    const messages = await db.select().from(csMessagesTable)
      .where(and(eq(csMessagesTable.ticket_id, id), eq(csMessagesTable.is_internal, 0)))
      .orderBy(csMessagesTable.created_at);

    res.json({ success: true, data: { ...ticket, messages } });
  } catch {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: "Failed to get ticket" } });
  }
});

/* ─────────────────────────────────────────────
   PARTNER: Reply to ticket (own ticket only)
───────────────────────────────────────────── */
router.post("/v1/partner/cs-tickets/:id/messages", async (req, res): Promise<void> => {
  try {
    const partner = (req as any).partner as PartnerAuthPayload;
    const id = Number(req.params.id);
    const { message, image_urls } = req.body;

    if (!message?.trim()) {
      res.status(400).json({ success: false, error: { code: "VALIDATION", message: "message is required" } });
      return;
    }

    const [ticket] = await db.select({
      id: csTicketsTable.id,
      status: csTicketsTable.status,
      customer_language: csTicketsTable.customer_language,
      translation_enabled: csTicketsTable.translation_enabled,
    }).from(csTicketsTable)
      .where(and(eq(csTicketsTable.id, id), eq(csTicketsTable.partner_user_id, partner.id)));

    if (!ticket) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Ticket not found" } }); return; }
    if (ticket.status === "Closed") { res.status(400).json({ success: false, error: { code: "TICKET_CLOSED", message: "Ticket is closed" } }); return; }

    const [msg] = await db.insert(csMessagesTable).values({
      ticket_id: id,
      sender_type: partner.portal_type,
      sender_id: partner.id,
      message: message.trim(),
      original_lang: ticket.customer_language,
      image_urls: image_urls?.length ? JSON.stringify(image_urls) : null,
      is_internal: 0,
    }).returning();

    if (ticket.status === "Resolved") {
      await db.update(csTicketsTable).set({ status: "Open", updated_at: new Date() }).where(eq(csTicketsTable.id, id));
    } else {
      await db.update(csTicketsTable).set({ updated_at: new Date() }).where(eq(csTicketsTable.id, id));
    }

    const patch = await translateAndStoreMessage({
      messageId: msg.id,
      text: message.trim(),
      originalLang: ticket.customer_language,
      customerLanguage: ticket.customer_language,
      enabled: ticket.translation_enabled,
    });
    await adoptCustomerLanguage(id, ticket.customer_language, patch.original_lang);

    res.status(201).json({ success: true, data: { ...msg, ...patch } });
  } catch {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: "Failed to send message" } });
  }
});

export default router;
