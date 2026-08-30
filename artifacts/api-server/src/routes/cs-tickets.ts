import { notifyCsTicketResolved } from "../lib/cs/csNotify";
import { Router, type IRouter } from "express";
import multer from "multer";
import { eq, desc, and, ilike, or, sql, isNull, inArray, gte, lte } from "drizzle-orm";
import { insertWorkOrderWithRef } from "../lib/workOrders/orderRef";
import { db, csTicketsTable, csMessagesTable, guestUsersTable, partnerUsersTable, bookingsTable, workOrdersTable, spacesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { isCloudinaryConfigured, uploadToCloudinary, cldFolder } from "../utils/cloudinary";
import { translateAndStoreMessage } from "../lib/chat/translateMessage";
import { dispatchWorkOrder } from "../lib/dispatch/workOrderDispatch";
import { logAction } from "../utils/auditLog";
import { deletedFilter, makeBulkDelete, makeBulkRestore } from "../lib/softDelete";

import { keywordCondition } from "../lib/listSearch";
const router: IRouter = Router();

// Convert a CS ticket into a dispatched maintenance work order (Phase 3 bridge).
// Admin-mediated ("관리자 경유 수리"): the admin supplies the dispatch category
// (ticket categories are coarse) and the new work order auto-dispatches to a
// matching partner. Idempotent — re-calling returns the already-linked order.
router.post("/v1/cs-tickets/:id/create-work-order", requireAuth, async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const [ticket] = await db.select().from(csTicketsTable).where(eq(csTicketsTable.id, id)).limit(1);
    if (!ticket) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Ticket not found" } }); return; }
    if (ticket.work_order_id) {
      const [existing] = await db.select().from(workOrdersTable).where(eq(workOrdersTable.id, ticket.work_order_id)).limit(1);
      res.json({ success: true, data: existing, alreadyLinked: true });
      return;
    }

    // Derive property/space from the ticket's booking, when present.
    let spaceId: number | null = null;
    let propertyId: number | null = null;
    if (ticket.booking_id) {
      const [bk] = await db.select({ space_id: bookingsTable.space_id }).from(bookingsTable).where(eq(bookingsTable.id, ticket.booking_id)).limit(1);
      spaceId = bk?.space_id ?? null;
      if (spaceId) {
        const [sp] = await db.select({ property_id: spacesTable.property_id }).from(spacesTable).where(eq(spacesTable.id, spaceId)).limit(1);
        propertyId = sp?.property_id ?? null;
      }
    }

    const category = typeof req.body?.category === "string" && req.body.category.trim() ? req.body.category.trim().toLowerCase() : null;
    const wo = await insertWorkOrderWithRef({
      property_id: propertyId,
      space_id: spaceId,
      title: ticket.subject,
      description: ticket.description,
      priority: ticket.priority ?? "Normal",
      category,
    });

    await db.update(csTicketsTable).set({ work_order_id: wo.id }).where(eq(csTicketsTable.id, id));

    let dispatch: any = null;
    if (category) {
      try { dispatch = await dispatchWorkOrder(wo.id); } catch (e) { console.error("[cs-tickets] bridge dispatch failed:", e); }
    }
    void logAction({ entityType: "cs_ticket", entityId: id, action: "CREATE", actorId: (req as any).user?.id ?? null, newValue: { work_order_id: wo.id, order_ref: wo.order_ref, dispatched: dispatch?.ok ?? false } });

    const [fresh] = await db.select().from(workOrdersTable).where(eq(workOrdersTable.id, wo.id)).limit(1);
    res.status(201).json({ success: true, data: fresh, dispatch });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});
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
    const result = await uploadToCloudinary(req.file.buffer, { folder: cldFolder("cs") });
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

    const conditions: any[] = [deletedFilter(csTicketsTable.deleted_at, req)];
    if (status) conditions.push(eq(csTicketsTable.status, status));
    if (category) conditions.push(eq(csTicketsTable.category, category));
    if (requester_type) conditions.push(eq(csTicketsTable.requester_type, requester_type));
    if (q) conditions.push(keywordCondition(q, [
      csTicketsTable.subject, csTicketsTable.ticket_ref, csTicketsTable.description,
    ]));
    // 접수 기간(created_at 은 timestamp — 종료일은 그 날 끝까지 포함시킨다).
    const { date_from, date_to } = req.query as Record<string, string>;
    if (date_from) conditions.push(gte(csTicketsTable.created_at, new Date(`${date_from}T00:00:00`)));
    if (date_to) conditions.push(lte(csTicketsTable.created_at, new Date(`${date_to}T23:59:59.999`)));

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
    const [before] = await db.select({ status: csTicketsTable.status })
      .from(csTicketsTable).where(eq(csTicketsTable.id, id)).limit(1);
    const prevStatus = before?.status;
    const updates: Record<string, any> = { updated_at: new Date() };
    if (status && CS_STATUSES.includes(status)) updates.status = status;
    if (priority && CS_PRIORITIES.includes(priority)) updates.priority = priority;
    if (assigned_admin_id !== undefined) updates.assigned_admin_id = assigned_admin_id || null;
    if (status === "Closed") updates.closed_at = new Date();
    const [updated] = await db.update(csTicketsTable).set(updates).where(eq(csTicketsTable.id, id)).returning();
    if (!updated) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Ticket not found" } }); return; }

    // 처리 완료 통보. Resolved/Closed 로 **바뀐 순간에만** 보낸다 — 이미 그 상태인
    // 티켓을 다시 저장했다고 통보가 또 나가면 안 된다(중복은 csNotify 도 막지만,
    // 애초에 상태 전이가 아닐 때는 부르지 않는 편이 맞다).
    if ((status === "Resolved" || status === "Closed") && status !== prevStatus) {
      void notifyCsTicketResolved(id);
    }

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
    // `lang` is the language the admin composed in (their portal UI language);
    // defaults to English. The customer reads it in the ticket's customer_language.
    const { message, image_urls, is_internal = false, lang } = req.body;

    if (!message?.trim()) {
      res.status(400).json({ success: false, error: { code: "VALIDATION", message: "message is required" } });
      return;
    }

    const [ticket] = await db.select({
      id: csTicketsTable.id,
      customer_language: csTicketsTable.customer_language,
      translation_enabled: csTicketsTable.translation_enabled,
    }).from(csTicketsTable).where(eq(csTicketsTable.id, id));
    if (!ticket) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Ticket not found" } }); return; }

    const originalLang = typeof lang === "string" && lang.trim() ? lang.trim() : "en";

    const [msg] = await db.insert(csMessagesTable).values({
      ticket_id: id,
      sender_type: "admin",
      sender_id: adminId,
      message: message.trim(),
      original_lang: originalLang,
      image_urls: image_urls?.length ? JSON.stringify(image_urls) : null,
      is_internal: is_internal ? 1 : 0,
    }).returning();

    if (!is_internal) {
      await db.update(csTicketsTable).set({ status: "InProgress", updated_at: new Date() })
        .where(and(eq(csTicketsTable.id, id), eq(csTicketsTable.status, "Open")));
    }

    // Internal notes are admin-only — never shown to the customer, so skip
    // translation. Customer-facing replies translate synchronously so the
    // returned message already carries both languages.
    const patch = await translateAndStoreMessage({
      messageId: msg.id,
      text: message.trim(),
      originalLang,
      customerLanguage: ticket.customer_language,
      enabled: ticket.translation_enabled && !is_internal,
    });

    res.status(201).json({ success: true, data: { ...msg, ...patch } });
  } catch {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: "Failed to send message" } });
  }
});

/* ─────────────────────────────────────────────
   ADMIN: Re-translate a single message (retry failed / fill missing)
───────────────────────────────────────────── */
router.post("/v1/cs-tickets/:id/messages/:mid/retranslate", requireAuth, async (req, res): Promise<void> => {
  try {
    const ticketId = Number(req.params.id);
    const mid = Number(req.params.mid);

    const [ticket] = await db.select({
      customer_language: csTicketsTable.customer_language,
      translation_enabled: csTicketsTable.translation_enabled,
    }).from(csTicketsTable).where(eq(csTicketsTable.id, ticketId));
    if (!ticket) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Ticket not found" } }); return; }

    const [msg] = await db.select().from(csMessagesTable)
      .where(and(eq(csMessagesTable.id, mid), eq(csMessagesTable.ticket_id, ticketId)));
    if (!msg) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Message not found" } }); return; }

    const originalLang = msg.original_lang || (msg.sender_type === "admin" ? "en" : ticket.customer_language);
    const patch = await translateAndStoreMessage({
      messageId: mid,
      text: msg.message,
      originalLang,
      customerLanguage: ticket.customer_language,
      enabled: ticket.translation_enabled && msg.is_internal === 0,
    });

    res.json({ success: true, data: { ...msg, ...patch } });
  } catch {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: "Failed to retranslate message" } });
  }
});

const csTicketsSoftDelete = {
  table: csTicketsTable,
  idColumn: csTicketsTable.id,
};
router.post("/v1/cs-tickets/bulk-delete", requireAuth, makeBulkDelete(csTicketsSoftDelete));
router.post("/v1/cs-tickets/bulk-restore", requireAuth, makeBulkRestore(csTicketsSoftDelete));

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
