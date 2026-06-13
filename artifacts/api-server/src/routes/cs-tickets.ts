import { Router, type IRouter } from "express";
import multer from "multer";
import { eq, desc, and, ilike, or, sql, isNull, inArray } from "drizzle-orm";
import { db, csTicketsTable, csMessagesTable, guestUsersTable, partnerUsersTable, bookingsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { isCloudinaryConfigured, uploadToCloudinary } from "../utils/cloudinary";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const CS_STATUSES = ["Open", "InProgress", "Resolved", "Closed"] as const;
const CS_PRIORITIES = ["Low", "Normal", "High", "Urgent"] as const;

/* ─────────────────────────────────────────────
   IMAGE UPLOAD — admin
───────────────────────────────────────────── */
router.post("/v1/cs/admin/upload-image", requireAuth, upload.single("image"), async (req, res): Promise<void> => {
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
   ADMIN: List all tickets
───────────────────────────────────────────── */
router.get("/v1/cs-tickets", requireAuth, async (req, res): Promise<void> => {
  try {
    const { status, category, requester_type, q, limit = "50", offset = "0" } = req.query as Record<string, string>;

    const conditions: any[] = [isNull(csTicketsTable.deleted_at)];
    if (status) conditions.push(eq(csTicketsTable.status, status));
    if (category) conditions.push(eq(csTicketsTable.category, category));
    if (requester_type) conditions.push(eq(csTicketsTable.requester_type, requester_type));
    if (q) conditions.push(or(
      ilike(csTicketsTable.subject, `%${q}%`),
      ilike(csTicketsTable.ticket_ref, `%${q}%`),
    ));

    // Requester is either a guest (guest_user_id) or a partner-portal user
    // (partner_user_id). Resolve a single display name/email via COALESCE.
    const requesterName = sql<string>`COALESCE(
      NULLIF(TRIM(CONCAT(${guestUsersTable.first_name}, ' ', ${guestUsersTable.last_name})), ''),
      NULLIF(TRIM(CONCAT(${partnerUsersTable.first_name}, ' ', ${partnerUsersTable.last_name})), '')
    )`;
    const requesterEmail = sql<string>`COALESCE(${guestUsersTable.email}, ${partnerUsersTable.email})`;

    const tickets = await db
      .select({
        ticket: csTicketsTable,
        requester_name: requesterName,
        requester_email: requesterEmail,
        booking_ref: bookingsTable.booking_ref,
      })
      .from(csTicketsTable)
      .leftJoin(guestUsersTable, eq(csTicketsTable.guest_user_id, guestUsersTable.id))
      .leftJoin(partnerUsersTable, eq(csTicketsTable.partner_user_id, partnerUsersTable.id))
      .leftJoin(bookingsTable, eq(csTicketsTable.booking_id, bookingsTable.id))
      .where(and(...conditions))
      .orderBy(desc(csTicketsTable.updated_at))
      .limit(Number(limit))
      .offset(Number(offset));

    const totalResult = await db.select({ total: sql<number>`COUNT(*)::int` }).from(csTicketsTable)
      .where(and(...conditions));

    res.json({
      success: true,
      data: tickets.map(r => ({
        ...r.ticket,
        // Keep guest_* keys for backward compatibility with existing UI.
        guest_name: r.requester_name,
        guest_email: r.requester_email,
        requester_name: r.requester_name,
        requester_email: r.requester_email,
        booking_ref: r.booking_ref,
      })),
      meta: { total: totalResult[0]?.total ?? 0 },
    });
  } catch {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: "Failed to list tickets" } });
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
        requester_name: sql<string>`COALESCE(
          NULLIF(TRIM(CONCAT(${guestUsersTable.first_name}, ' ', ${guestUsersTable.last_name})), ''),
          NULLIF(TRIM(CONCAT(${partnerUsersTable.first_name}, ' ', ${partnerUsersTable.last_name})), '')
        )`,
        requester_email: sql<string>`COALESCE(${guestUsersTable.email}, ${partnerUsersTable.email})`,
        requester_phone: sql<string>`COALESCE(${guestUsersTable.phone}, ${partnerUsersTable.phone})`,
        booking_ref: bookingsTable.booking_ref,
        booking_status: bookingsTable.booking_status,
        check_in_date: bookingsTable.check_in_date,
        check_out_date: bookingsTable.check_out_date,
      })
      .from(csTicketsTable)
      .leftJoin(guestUsersTable, eq(csTicketsTable.guest_user_id, guestUsersTable.id))
      .leftJoin(partnerUsersTable, eq(csTicketsTable.partner_user_id, partnerUsersTable.id))
      .leftJoin(bookingsTable, eq(csTicketsTable.booking_id, bookingsTable.id))
      .where(eq(csTicketsTable.id, id));

    if (!row) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Ticket not found" } }); return; }

    const messages = await db.select().from(csMessagesTable)
      .where(eq(csMessagesTable.ticket_id, id))
      .orderBy(csMessagesTable.created_at);

    res.json({
      success: true,
      data: {
        ...row.ticket,
        // Keep guest_* keys for backward compatibility with existing UI.
        guest_name: row.requester_name,
        guest_email: row.requester_email,
        guest_phone: row.requester_phone,
        requester_name: row.requester_name,
        requester_email: row.requester_email,
        requester_phone: row.requester_phone,
        booking_ref: row.booking_ref,
        booking_status: row.booking_status,
        check_in_date: row.check_in_date,
        check_out_date: row.check_out_date,
        messages,
      },
    });
  } catch {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: "Failed to get ticket" } });
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
    if (!updated) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Ticket not found" } }); return; }
    res.json({ success: true, data: updated });
  } catch {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: "Failed to update ticket" } });
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

    if (!message?.trim()) {
      res.status(400).json({ success: false, error: { code: "VALIDATION", message: "message is required" } });
      return;
    }

    const [ticket] = await db.select({ id: csTicketsTable.id })
      .from(csTicketsTable).where(eq(csTicketsTable.id, id));
    if (!ticket) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Ticket not found" } }); return; }

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
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: "Failed to send message" } });
  }
});

router.post("/v1/cs-tickets/bulk-delete", requireAuth, async (req, res): Promise<void> => {
  const currentUser = (req as any).user;
  if (currentUser?.role !== "SuperAdmin") {
    res.status(403).json({ error: "Only SuperAdmin can perform bulk delete" }); return;
  }
  const { ids, permanent } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "ids must be a non-empty array" }); return;
  }
  const numIds = ids.map(Number).filter(Boolean);
  if (permanent) {
    await db.delete(csTicketsTable).where(inArray(csTicketsTable.id, numIds));
  } else {
    await db.update(csTicketsTable).set({ deleted_at: new Date(), status: "Archived" }).where(inArray(csTicketsTable.id, numIds));
  }
  res.json({ success: true, affected: numIds.length });
});

router.delete("/v1/cs-tickets/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const currentUser = (req as any).user;
  const permanent = req.query.permanent === "true";
  if (permanent) {
    if (currentUser?.role !== "SuperAdmin") {
      res.status(403).json({ error: "Only SuperAdmin can permanently delete records" }); return;
    }
    await db.delete(csTicketsTable).where(eq(csTicketsTable.id, id));
  } else {
    await db.update(csTicketsTable).set({ deleted_at: new Date(), status: "Archived" }).where(eq(csTicketsTable.id, id));
  }
  res.status(204).end();
});

export default router;
