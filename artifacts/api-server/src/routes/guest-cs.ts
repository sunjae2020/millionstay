import { Router, type IRouter } from "express";
import multer from "multer";
import { eq, desc, and, sql } from "drizzle-orm";
import { db, csTicketsTable, csMessagesTable, bookingsTable } from "@workspace/db";
import { requireGuestAuth } from "../middlewares/requireGuestAuth";
import { isCloudinaryConfigured, uploadToCloudinary } from "../utils/cloudinary";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

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
    const result = await uploadToCloudinary(req.file.buffer, { folder: "millionstay/cs" });
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
    const { category, subject, description, booking_id, image_urls } = req.body;

    if (!subject?.trim() || !description?.trim()) {
      res.status(400).json({ success: false, error: { code: "VALIDATION", message: "subject and description are required" } });
      return;
    }

    const ticket_ref = await generateTicketRef();

    const [ticket] = await db.insert(csTicketsTable).values({
      ticket_ref,
      guest_user_id: guestId,
      booking_id: booking_id ? Number(booking_id) : null,
      category: CS_CATEGORIES.includes(category) ? category : "General",
      subject: subject.trim(),
      description: description.trim(),
      status: "Open",
      priority: "Normal",
    }).returning();

    if (description?.trim()) {
      await db.insert(csMessagesTable).values({
        ticket_id: ticket.id,
        sender_type: "guest",
        sender_id: guestId,
        message: description.trim(),
        image_urls: image_urls?.length ? JSON.stringify(image_urls) : null,
        is_internal: 0,
      });
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

    const [ticket] = await db.select({ id: csTicketsTable.id, status: csTicketsTable.status })
      .from(csTicketsTable)
      .where(and(eq(csTicketsTable.id, id), eq(csTicketsTable.guest_user_id, guestId)));

    if (!ticket) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Ticket not found" } }); return; }
    if (ticket.status === "Closed") { res.status(400).json({ success: false, error: { code: "TICKET_CLOSED", message: "Ticket is closed" } }); return; }

    const [msg] = await db.insert(csMessagesTable).values({
      ticket_id: id,
      sender_type: "guest",
      sender_id: guestId,
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
