import { Router, type IRouter } from "express";
import multer from "multer";
import { eq, desc, and, ilike, or, sql } from "drizzle-orm";
import { db, csTicketsTable, csMessagesTable, guestUsersTable, bookingsTable, adminUsersTable } from "@workspace/db";
import { requireGuestAuth } from "../middlewares/requireGuestAuth";
import { requireAuth } from "../middlewares/requireAuth";
import { isCloudinaryConfigured, uploadToCloudinary } from "../utils/cloudinary";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const CS_CATEGORIES = ["General", "Accommodation", "Billing", "Maintenance", "Other"] as const;
const CS_STATUSES = ["Open", "InProgress", "Resolved", "Closed"] as const;
const CS_PRIORITIES = ["Low", "Normal", "High", "Urgent"] as const;

async function generateTicketRef(): Promise<string> {
  const year = new Date().getFullYear();
  const [{ count }] = await db.execute(
    sql`SELECT COUNT(*) as count FROM cs_tickets WHERE EXTRACT(YEAR FROM created_at) = ${year}`
  ) as any;
  const seq = (Number(count) + 1).toString().padStart(4, "0");
  return `CS-${year}-${seq}`;
}

/* ─────────────────────────────────────────────
   IMAGE UPLOAD (shared for guest + admin)
───────────────────────────────────────────── */
router.post("/v1/cs/upload-image", requireGuestAuth, upload.single("image"), async (req, res): Promise<void> => {
  try {
    if (!req.file) { res.status(400).json({ error: "No file provided" }); return; }
    if (!isCloudinaryConfigured()) { res.status(503).json({ error: "Image upload not configured" }); return; }
    const result = await uploadToCloudinary(req.file.buffer, { folder: "millionstay/cs" });
    res.json({ success: true, url: result.secure_url, thumbnail_url: result.thumbnail_url });
  } catch (err: any) {
    res.status(500).json({ error: "Upload failed", message: err.message });
  }
});

router.post("/v1/cs/admin/upload-image", requireAuth, upload.single("image"), async (req, res): Promise<void> => {
  try {
    if (!req.file) { res.status(400).json({ error: "No file provided" }); return; }
    if (!isCloudinaryConfigured()) { res.status(503).json({ error: "Image upload not configured" }); return; }
    const result = await uploadToCloudinary(req.file.buffer, { folder: "millionstay/cs" });
    res.json({ success: true, url: result.secure_url, thumbnail_url: result.thumbnail_url });
  } catch (err: any) {
    res.status(500).json({ error: "Upload failed", message: err.message });
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
      const [{ count }] = await db.execute(
        sql`SELECT COUNT(*) as count FROM cs_messages WHERE ticket_id = ${t.id}`
      ) as any;
      return { ...t, message_count: Number(count) };
    }));

    res.json({ success: true, data: ticketsWithCount });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to list tickets" });
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
      res.status(400).json({ error: "subject and description are required" });
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
        image_urls: image_urls ? JSON.stringify(image_urls) : null,
        is_internal: 0,
      });
    }

    res.status(201).json({ success: true, data: ticket });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to create ticket" });
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

    if (!ticket) { res.status(404).json({ error: "Not found" }); return; }

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
    res.status(500).json({ error: "Failed to get ticket" });
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

    if (!message?.trim()) { res.status(400).json({ error: "message is required" }); return; }

    const [ticket] = await db.select({ id: csTicketsTable.id, status: csTicketsTable.status })
      .from(csTicketsTable)
      .where(and(eq(csTicketsTable.id, id), eq(csTicketsTable.guest_user_id, guestId)));

    if (!ticket) { res.status(404).json({ error: "Not found" }); return; }
    if (ticket.status === "Closed") { res.status(400).json({ error: "Ticket is closed" }); return; }

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
    res.status(500).json({ error: "Failed to send message" });
  }
});

/* ─────────────────────────────────────────────
   ADMIN: List all tickets
───────────────────────────────────────────── */
router.get("/v1/cs-tickets", requireAuth, async (req, res): Promise<void> => {
  try {
    const { status, category, q, limit = "50", offset = "0" } = req.query as Record<string, string>;

    const conditions: any[] = [];
    if (status) conditions.push(eq(csTicketsTable.status, status));
    if (category) conditions.push(eq(csTicketsTable.category, category));
    if (q) conditions.push(or(
      ilike(csTicketsTable.subject, `%${q}%`),
      ilike(csTicketsTable.ticket_ref, `%${q}%`),
    ));

    const tickets = await db
      .select({
        ticket: csTicketsTable,
        guest_name: sql<string>`CONCAT(${guestUsersTable.first_name}, ' ', ${guestUsersTable.last_name})`,
        guest_email: guestUsersTable.email,
        booking_ref: bookingsTable.booking_ref,
      })
      .from(csTicketsTable)
      .leftJoin(guestUsersTable, eq(csTicketsTable.guest_user_id, guestUsersTable.id))
      .leftJoin(bookingsTable, eq(csTicketsTable.booking_id, bookingsTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(csTicketsTable.updated_at))
      .limit(Number(limit))
      .offset(Number(offset));

    const [{ total }] = await db.execute(sql`SELECT COUNT(*) as total FROM cs_tickets`) as any;

    res.json({
      success: true,
      data: tickets.map(r => ({ ...r.ticket, guest_name: r.guest_name, guest_email: r.guest_email, booking_ref: r.booking_ref })),
      meta: { total: Number(total) },
    });
  } catch {
    res.status(500).json({ error: "Failed to list tickets" });
  }
});

/* ─────────────────────────────────────────────
   ADMIN: Get ticket detail
───────────────────────────────────────────── */
router.get("/v1/cs-tickets/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const [row] = await db
      .select({
        ticket: csTicketsTable,
        guest_name: sql<string>`CONCAT(${guestUsersTable.first_name}, ' ', ${guestUsersTable.last_name})`,
        guest_email: guestUsersTable.email,
        guest_phone: guestUsersTable.phone,
        booking_ref: bookingsTable.booking_ref,
        booking_status: bookingsTable.booking_status,
        check_in_date: bookingsTable.check_in_date,
        check_out_date: bookingsTable.check_out_date,
      })
      .from(csTicketsTable)
      .leftJoin(guestUsersTable, eq(csTicketsTable.guest_user_id, guestUsersTable.id))
      .leftJoin(bookingsTable, eq(csTicketsTable.booking_id, bookingsTable.id))
      .where(eq(csTicketsTable.id, id));

    if (!row) { res.status(404).json({ error: "Not found" }); return; }

    const messages = await db.select().from(csMessagesTable)
      .where(eq(csMessagesTable.ticket_id, id))
      .orderBy(csMessagesTable.created_at);

    res.json({
      success: true,
      data: {
        ...row.ticket,
        guest_name: row.guest_name,
        guest_email: row.guest_email,
        guest_phone: row.guest_phone,
        booking_ref: row.booking_ref,
        booking_status: row.booking_status,
        check_in_date: row.check_in_date,
        check_out_date: row.check_out_date,
        messages,
      },
    });
  } catch {
    res.status(500).json({ error: "Failed to get ticket" });
  }
});

/* ─────────────────────────────────────────────
   ADMIN: Update ticket (status, priority, assign)
───────────────────────────────────────────── */
router.put("/v1/cs-tickets/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { status, priority, assigned_admin_id } = req.body;
    const updates: Record<string, any> = { updated_at: new Date() };
    if (status && CS_STATUSES.includes(status)) updates.status = status;
    if (priority && CS_PRIORITIES.includes(priority)) updates.priority = priority;
    if (assigned_admin_id !== undefined) updates.assigned_admin_id = assigned_admin_id || null;
    if (status === "Closed") updates.closed_at = new Date();
    const [updated] = await db.update(csTicketsTable).set(updates).where(eq(csTicketsTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ error: "Failed to update ticket" });
  }
});

/* ─────────────────────────────────────────────
   ADMIN: Reply to ticket
───────────────────────────────────────────── */
router.post("/v1/cs-tickets/:id/messages", requireAuth, async (req, res): Promise<void> => {
  try {
    const adminId = (req as any).user.id;
    const id = Number(req.params.id);
    const { message, image_urls, is_internal = false } = req.body;

    if (!message?.trim()) { res.status(400).json({ error: "message is required" }); return; }

    const [ticket] = await db.select({ id: csTicketsTable.id })
      .from(csTicketsTable).where(eq(csTicketsTable.id, id));
    if (!ticket) { res.status(404).json({ error: "Not found" }); return; }

    const [msg] = await db.insert(csMessagesTable).values({
      ticket_id: id,
      sender_type: "admin",
      sender_id: adminId,
      message: message.trim(),
      image_urls: image_urls?.length ? JSON.stringify(image_urls) : null,
      is_internal: is_internal ? 1 : 0,
    }).returning();

    if (!is_internal) {
      await db.update(csTicketsTable).set({ status: "InProgress", updated_at: new Date() })
        .where(and(eq(csTicketsTable.id, id), eq(csTicketsTable.status, "Open")));
    }

    res.status(201).json({ success: true, data: msg });
  } catch {
    res.status(500).json({ error: "Failed to send message" });
  }
});

export default router;
