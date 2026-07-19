import { Router, type IRouter } from "express";
import multer from "multer";
import { eq, desc, and, sql, lte } from "drizzle-orm";
import { db, csTicketsTable, csMessagesTable, bookingsTable, announcementsTable, guestDirectMessagesTable } from "@workspace/db";
import { requireGuestAuth } from "../middlewares/requireGuestAuth";
import { isCloudinaryConfigured, uploadToCloudinary, cldFolder } from "../utils/cloudinary";
import { translateAndStoreMessage } from "../lib/chat/translateMessage";

// Languages the guest web app ships — the customer may converse in any of these.
const SUPPORTED_GUEST_LANGS = ["en", "ja", "ko", "th", "vi", "zh"];
function normalizeLang(raw: unknown): string {
  const code = typeof raw === "string" ? raw.trim().toLowerCase().slice(0, 2) : "";
  return SUPPORTED_GUEST_LANGS.includes(code) ? code : "en";
}

/**
 * Adopt the language the guest actually wrote in (auto-detected from the message
 * text) as the ticket's customer_language, so subsequent admin replies are
 * translated into it. The UI locale defaults to English, so a Korean-speaking
 * guest browsing in English would otherwise leave customer_language="en" and
 * translation would never kick in. Only "upgrade" to a non-English language —
 * never downgrade back to English — to avoid flip-flopping on short messages.
 */
async function adoptCustomerLanguage(ticketId: number, current: string, detected: string): Promise<void> {
  if (detected && detected !== "en" && detected !== current && SUPPORTED_GUEST_LANGS.includes(detected)) {
    await db.update(csTicketsTable).set({ customer_language: detected }).where(eq(csTicketsTable.id, ticketId));
  }
}

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// SECURITY: all /v1/guest/* routes require guest auth.
// NOTE: we intentionally do NOT prefix-guard /v1/cs here. This router is mounted
// before the admin cs-tickets router, and a broad "/v1/cs" guard would also
// swallow the admin upload route /v1/cs/admin/upload-image with requireGuestAuth
// (rejecting valid admin tokens). The only guest /v1/cs route below
// (/v1/cs/upload-image) carries its own inline requireGuestAuth instead.
router.use("/v1/guest", requireGuestAuth);

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
   IMAGE UPLOAD — guest
───────────────────────────────────────────── */
router.post("/v1/cs/upload-image", requireGuestAuth, upload.single("image"), async (req, res): Promise<void> => {
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
   GUEST: List my tickets
───────────────────────────────────────────── */
router.get("/v1/guest/cs-tickets", requireGuestAuth, async (req, res): Promise<void> => {
  try {
    const guestId = (req as any).guest.id;
    const tickets = await db
      .select()
      .from(csTicketsTable)
      .where(eq(csTicketsTable.guest_user_id, guestId))
      .orderBy(desc(csTicketsTable.created_at));

    const ticketsWithCount = await Promise.all(tickets.map(async (t) => {
      const countResult = await db.select({ count: sql<number>`COUNT(*)::int` })
        .from(csMessagesTable)
        .where(eq(csMessagesTable.ticket_id, t.id));
      return { ...t, message_count: countResult[0]?.count ?? 0 };
    }));

    res.json({ success: true, data: ticketsWithCount });
  } catch {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: "Failed to list tickets" } });
  }
});

/* ─────────────────────────────────────────────
   GUEST: Create ticket
───────────────────────────────────────────── */
router.post("/v1/guest/cs-tickets", requireGuestAuth, async (req, res): Promise<void> => {
  try {
    const guestId = (req as any).guest.id;
    const { category, subject, description, booking_id, image_urls, customer_language } = req.body;

    if (!subject?.trim() || !description?.trim()) {
      res.status(400).json({ success: false, error: { code: "VALIDATION", message: "subject and description are required" } });
      return;
    }

    const ticket_ref = await generateTicketRef();
    const customerLang = normalizeLang(customer_language);

    const [ticket] = await db.insert(csTicketsTable).values({
      ticket_ref,
      guest_user_id: guestId,
      booking_id: booking_id ? Number(booking_id) : null,
      category: CS_CATEGORIES.includes(category) ? category : "General",
      subject: subject.trim(),
      description: description.trim(),
      status: "Open",
      priority: "Normal",
      customer_language: customerLang,
    }).returning();

    if (description?.trim()) {
      const [msg] = await db.insert(csMessagesTable).values({
        ticket_id: ticket.id,
        sender_type: "guest",
        sender_id: guestId,
        message: description.trim(),
        original_lang: customerLang,
        image_urls: image_urls?.length ? JSON.stringify(image_urls) : null,
        is_internal: 0,
      }).returning();
      // Guest writes in their own language → detect it and translate to English
      // for the admin. Adopt the detected language as the ticket's so admin
      // replies are translated back into it.
      const patch = await translateAndStoreMessage({
        messageId: msg.id,
        text: description.trim(),
        originalLang: customerLang,
        customerLanguage: customerLang,
        enabled: ticket.translation_enabled,
      });
      await adoptCustomerLanguage(ticket.id, ticket.customer_language, patch.original_lang);
    }

    res.status(201).json({ success: true, data: ticket });
  } catch {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: "Failed to create ticket" } });
  }
});

/* ─────────────────────────────────────────────
   GUEST: Get ticket detail
───────────────────────────────────────────── */
router.get("/v1/guest/cs-tickets/:id", requireGuestAuth, async (req, res): Promise<void> => {
  try {
    const guestId = (req as any).guest.id;
    const id = Number(req.params.id);

    const [ticket] = await db.select().from(csTicketsTable)
      .where(and(eq(csTicketsTable.id, id), eq(csTicketsTable.guest_user_id, guestId)));

    if (!ticket) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Ticket not found" } }); return; }

    const messages = await db.select().from(csMessagesTable)
      .where(and(eq(csMessagesTable.ticket_id, id), eq(csMessagesTable.is_internal, 0)))
      .orderBy(csMessagesTable.created_at);

    let bookingInfo = null;
    if (ticket.booking_id) {
      const [b] = await db.select({
        id: bookingsTable.id,
        booking_ref: bookingsTable.booking_ref,
        booking_status: bookingsTable.booking_status,
        check_in_date: bookingsTable.check_in_date,
        check_out_date: bookingsTable.check_out_date,
      }).from(bookingsTable).where(eq(bookingsTable.id, ticket.booking_id));
      bookingInfo = b ?? null;
    }

    res.json({ success: true, data: { ...ticket, messages, booking: bookingInfo } });
  } catch {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: "Failed to get ticket" } });
  }
});

/* ─────────────────────────────────────────────
   GUEST: Reply to ticket
───────────────────────────────────────────── */
router.post("/v1/guest/cs-tickets/:id/messages", requireGuestAuth, async (req, res): Promise<void> => {
  try {
    const guestId = (req as any).guest.id;
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
      .where(and(eq(csTicketsTable.id, id), eq(csTicketsTable.guest_user_id, guestId)));

    if (!ticket) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Ticket not found" } }); return; }
    if (ticket.status === "Closed") { res.status(400).json({ success: false, error: { code: "TICKET_CLOSED", message: "Ticket is closed" } }); return; }

    const [msg] = await db.insert(csMessagesTable).values({
      ticket_id: id,
      sender_type: "guest",
      sender_id: guestId,
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
    await adoptCustomerLanguage(ticket.id, ticket.customer_language, patch.original_lang);

    res.status(201).json({ success: true, data: { ...msg, ...patch } });
  } catch {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: "Failed to send message" } });
  }
});

/* ─────────────────────────────────────────────
   ANNOUNCEMENTS: List published (guest)
───────────────────────────────────────────── */
router.get("/v1/guest/announcements", requireGuestAuth, async (req, res): Promise<void> => {
  try {
    const now = new Date();
    const rows = await db
      .select()
      .from(announcementsTable)
      .where(
        and(
          eq(announcementsTable.is_published, 1),
          lte(announcementsTable.published_at, now),
        )
      )
      .orderBy(desc(announcementsTable.published_at));

    // Filter out expired announcements
    const active = rows.filter(
      (r) => !r.expires_at || new Date(r.expires_at) > now
    );

    res.json({ success: true, data: active });
  } catch {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: "Failed to list announcements" } });
  }
});

/* ─────────────────────────────────────────────
   DIRECT MESSAGES: List for guest
───────────────────────────────────────────── */
router.get("/v1/guest/direct-messages", requireGuestAuth, async (req, res): Promise<void> => {
  try {
    const guestId = (req as any).guest.id;
    const rows = await db
      .select()
      .from(guestDirectMessagesTable)
      .where(eq(guestDirectMessagesTable.guest_user_id, guestId))
      .orderBy(desc(guestDirectMessagesTable.created_at));

    const unreadCount = rows.filter((r) => r.is_read === 0).length;
    res.json({ success: true, data: rows, meta: { unread_count: unreadCount } });
  } catch {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: "Failed to list messages" } });
  }
});

/* ─────────────────────────────────────────────
   DIRECT MESSAGES: Mark as read
───────────────────────────────────────────── */
router.patch("/v1/guest/direct-messages/:id/read", requireGuestAuth, async (req, res): Promise<void> => {
  try {
    const guestId = (req as any).guest.id;
    const id = Number(req.params.id);

    const [updated] = await db
      .update(guestDirectMessagesTable)
      .set({ is_read: 1, read_at: new Date() })
      .where(
        and(
          eq(guestDirectMessagesTable.id, id),
          eq(guestDirectMessagesTable.guest_user_id, guestId),
        )
      )
      .returning();

    if (!updated) {
      res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Message not found" } });
      return;
    }
    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: "Failed to mark message as read" } });
  }
});

export default router;
