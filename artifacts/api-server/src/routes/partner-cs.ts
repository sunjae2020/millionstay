import { Router, type IRouter } from "express";
import multer from "multer";
import { eq, desc, and, sql } from "drizzle-orm";
import { db, csTicketsTable, csMessagesTable } from "@workspace/db";
import { requirePartnerAuth, type PartnerAuthPayload } from "../middlewares/requirePartnerAuth";
import { isCloudinaryConfigured, uploadToCloudinary } from "../utils/cloudinary";

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
    const result = await uploadToCloudinary(req.file.buffer, { folder: "millionstay/cs" });
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
    const { category, subject, description, image_urls } = req.body;

    if (!subject?.trim() || !description?.trim()) {
      res.status(400).json({ success: false, error: { code: "VALIDATION", message: "subject and description are required" } });
      return;
    }

    const ticket_ref = await generateTicketRef();

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
    }).returning();

    await db.insert(csMessagesTable).values({
      ticket_id: ticket.id,
      sender_type: partner.portal_type,
      sender_id: partner.id,
      message: description.trim(),
      image_urls: image_urls?.length ? JSON.stringify(image_urls) : null,
      is_internal: 0,
    });

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

    const [ticket] = await db.select({ id: csTicketsTable.id, status: csTicketsTable.status })
      .from(csTicketsTable)
      .where(and(eq(csTicketsTable.id, id), eq(csTicketsTable.partner_user_id, partner.id)));

    if (!ticket) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Ticket not found" } }); return; }
    if (ticket.status === "Closed") { res.status(400).json({ success: false, error: { code: "TICKET_CLOSED", message: "Ticket is closed" } }); return; }

    const [msg] = await db.insert(csMessagesTable).values({
      ticket_id: id,
      sender_type: partner.portal_type,
      sender_id: partner.id,
      message: message.trim(),
      image_urls: image_urls?.length ? JSON.stringify(image_urls) : null,
      is_internal: 0,
    }).returning();

    if (ticket.status === "Resolved") {
      await db.update(csTicketsTable).set({ status: "Open", updated_at: new Date() }).where(eq(csTicketsTable.id, id));
    } else {
      await db.update(csTicketsTable).set({ updated_at: new Date() }).where(eq(csTicketsTable.id, id));
    }

    res.status(201).json({ success: true, data: msg });
  } catch {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: "Failed to send message" } });
  }
});

export default router;
