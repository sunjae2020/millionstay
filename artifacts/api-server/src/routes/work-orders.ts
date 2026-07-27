import { Router } from "express";
import { DEFAULT_CURRENCY } from "../lib/currency";
import multer from "multer";
import { db, workOrdersTable, workOrderPhotosTable, propertiesTable, spacesTable, contactsTable, serviceHostsTable, invoicesTable, accountsTable } from "@workspace/db";
import { eq, ilike, and, isNull, inArray, desc } from "drizzle-orm";
import { dispatchWorkOrder } from "../lib/dispatch/workOrderDispatch";
import { logAction } from "../utils/auditLog";
import { deletedFilter, makeBulkDelete, makeBulkRestore } from "../lib/softDelete";
import { uploadToCloudinary, isCloudinaryConfigured, cldFolder } from "../utils/cloudinary";
import { getRateToAud } from "../lib/rateSnapshot";
import {
  CreateWorkOrderBody,
  UpdateWorkOrderBody,
  CompleteWorkOrderBody,
  CancelWorkOrderBody,
} from "@workspace/api-zod";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

async function nextInvoiceRef(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await db.select({ id: invoicesTable.id }).from(invoicesTable)
    .where(ilike(invoicesTable.invoice_ref, `MS-INV-${year}-%`));
  return `MS-INV-${year}-${String(rows.length + 1).padStart(5, "0")}`;
}

async function nextOrderRef(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await db.select({ id: workOrdersTable.id }).from(workOrdersTable)
    .where(ilike(workOrdersTable.order_ref, `MS-WO-${year}-%`));
  const count = rows.length + 1;
  return `MS-WO-${year}-${String(count).padStart(5, "0")}`;
}

async function enrichWorkOrders(rows: (typeof workOrdersTable.$inferSelect)[]) {
  if (rows.length === 0) return [];
  const propertyIds = [...new Set(rows.map(r => r.property_id).filter(Boolean))] as number[];
  const spaceIds = [...new Set(rows.map(r => r.space_id).filter(Boolean))] as number[];
  const contactIds = [...new Set(rows.map(r => r.assigned_contact_id).filter(Boolean))] as number[];
  const hostIds = [...new Set(rows.map(r => r.service_host_id).filter(Boolean))] as number[];

  const propertyMap: Record<number, string> = {};
  const spaceMap: Record<number, string> = {};
  const contactMap: Record<number, string> = {};
  const hostMap: Record<number, string> = {};

  for (const id of propertyIds) {
    const [p] = await db.select({ id: propertiesTable.id, name: propertiesTable.name }).from(propertiesTable).where(eq(propertiesTable.id, id));
    if (p) propertyMap[p.id] = p.name;
  }
  for (const id of spaceIds) {
    const [s] = await db.select({ id: spacesTable.id, name: spacesTable.name }).from(spacesTable).where(eq(spacesTable.id, id));
    if (s) spaceMap[s.id] = s.name;
  }
  for (const id of contactIds) {
    const [c] = await db.select({ id: contactsTable.id, first_name: contactsTable.first_name, last_name: contactsTable.last_name }).from(contactsTable).where(eq(contactsTable.id, id));
    if (c) contactMap[c.id] = `${c.first_name} ${c.last_name}`.trim();
  }
  for (const id of hostIds) {
    const [h] = await db.select({ id: serviceHostsTable.id, name: serviceHostsTable.name }).from(serviceHostsTable).where(eq(serviceHostsTable.id, id));
    if (h) hostMap[h.id] = h.name;
  }

  return rows.map(r => ({
    ...r,
    property_name: r.property_id ? (propertyMap[r.property_id] ?? null) : null,
    space_name: r.space_id ? (spaceMap[r.space_id] ?? null) : null,
    assigned_contact_name: r.assigned_contact_id ? (contactMap[r.assigned_contact_id] ?? null) : null,
    service_host_name: r.service_host_id ? (hostMap[r.service_host_id] ?? null) : null,
  }));
}

router.get("/v1/work-orders", async (req, res): Promise<void> => {
  const { q, status, priority, property_id } = req.query as Record<string, string>;
  const conditions: any[] = [deletedFilter(workOrdersTable.deleted_at, req)];
  if (q) conditions.push(ilike(workOrdersTable.title, `%${q}%`));
  if (status) conditions.push(eq(workOrdersTable.status, status));
  if (priority) conditions.push(eq(workOrdersTable.priority, priority));
  if (property_id) conditions.push(eq(workOrdersTable.property_id, Number(property_id)));
  const rows = await db.select().from(workOrdersTable)
    .where(and(...conditions))
    .orderBy(workOrdersTable.id);
  const result = await enrichWorkOrders(rows);
  res.json(result);
});

router.post("/v1/work-orders", async (req, res): Promise<void> => {
  const parsed = CreateWorkOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const order_ref = await nextOrderRef();
  const [row] = await db.insert(workOrdersTable).values({
    order_ref,
    property_id: parsed.data.property_id ?? null,
    space_id: parsed.data.space_id ?? null,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    priority: parsed.data.priority ?? "Normal",
    category: parsed.data.category ?? null,
    assigned_contact_id: parsed.data.assigned_contact_id ?? null,
    reported_at: parsed.data.reported_at ?? null,
    scheduled_at: parsed.data.scheduled_at ?? null,
    cost: parsed.data.cost ?? null,
    notes: parsed.data.notes ?? null,
  }).returning();

  // Auto-dispatch to a matching partner when a category is set (unless the caller
  // opted out with auto_dispatch:false). Best-effort — a no-match leaves it
  // unassigned for manual handling.
  if (row.category && req.body?.auto_dispatch !== false) {
    try { await dispatchWorkOrder(row.id); } catch (e) { console.error("[work-orders] auto-dispatch failed:", e); }
  }

  const fresh = await db.select().from(workOrdersTable).where(eq(workOrdersTable.id, row.id)).then((r) => r[0]);
  const [result] = await enrichWorkOrders([fresh ?? row]);
  res.status(201).json(result);
});

// Manually (re)dispatch a work order to a matching partner.
router.post("/v1/work-orders/:id/dispatch", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const result = await dispatchWorkOrder(id, { force: req.body?.force === true });
  if (!result.ok) {
    const code = result.reason === "not_found" ? 404 : 409;
    res.status(code).json({ success: false, error: { code: result.reason.toUpperCase(), message: `Dispatch failed: ${result.reason}` } });
    return;
  }
  void logAction({ entityType: "work_order", entityId: id, action: "UPDATE", actorId: (req as any).user?.id ?? null, newValue: { dispatched_to: result.service_host_id, sla_ack_due_at: result.sla_ack_due_at } });
  const fresh = await db.select().from(workOrdersTable).where(eq(workOrdersTable.id, id)).then((r) => r[0]);
  const [enriched] = await enrichWorkOrders(fresh ? [fresh] : []);
  res.json({ success: true, data: enriched, dispatch: result });
});

router.get("/v1/work-orders/:id", async (req, res): Promise<void> => {
  const row = await db.select().from(workOrdersTable).where(eq(workOrdersTable.id, Number(req.params.id))).then(r => r[0]);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const [result] = await enrichWorkOrders([row]);
  res.json(result);
});

router.put("/v1/work-orders/:id", async (req, res): Promise<void> => {
  const parsed = UpdateWorkOrderBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const updates: Partial<typeof workOrdersTable.$inferInsert> = { updated_at: new Date() };
  if (parsed.data.property_id !== undefined) updates.property_id = parsed.data.property_id;
  if (parsed.data.space_id !== undefined) updates.space_id = parsed.data.space_id;
  if (parsed.data.title != null) updates.title = parsed.data.title;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.priority != null) updates.priority = parsed.data.priority;
  if (parsed.data.category !== undefined) updates.category = parsed.data.category;
  if (parsed.data.assigned_contact_id !== undefined) updates.assigned_contact_id = parsed.data.assigned_contact_id;
  if (parsed.data.reported_at !== undefined) updates.reported_at = parsed.data.reported_at;
  if (parsed.data.scheduled_at !== undefined) updates.scheduled_at = parsed.data.scheduled_at;
  if (parsed.data.cost !== undefined) updates.cost = parsed.data.cost;
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;
  const [row] = await db.update(workOrdersTable).set(updates).where(eq(workOrdersTable.id, Number(req.params.id))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const [result] = await enrichWorkOrders([row]);
  res.json(result);
});

const workOrdersSoftDelete = {
  table: workOrdersTable,
  idColumn: workOrdersTable.id,
  statusKey: "status",
  archivedStatus: "Archived",
  restoredStatus: "Active",
};

router.post("/v1/work-orders/bulk-delete", makeBulkDelete(workOrdersSoftDelete));
router.post("/v1/work-orders/bulk-restore", makeBulkRestore(workOrdersSoftDelete));

router.delete("/v1/work-orders/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const currentUser = (req as any).user;
  const permanent = req.query.permanent === "true";
  if (permanent) {
    if (currentUser?.role !== "SuperAdmin") {
      res.status(403).json({ error: "Only SuperAdmin can permanently delete records" }); return;
    }
    await db.delete(workOrdersTable).where(eq(workOrdersTable.id, id));
  } else {
    await db.update(workOrdersTable).set({ deleted_at: new Date(), status: "Archived" }).where(eq(workOrdersTable.id, id));
  }
  res.status(204).send();
});

router.post("/v1/work-orders/:id/start", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [cur] = await db.select().from(workOrdersTable).where(eq(workOrdersTable.id, id));
  if (!cur) { res.status(404).json({ error: "Not found" }); return; }
  if (cur.status !== "Open") { res.status(400).json({ error: "Work order not in Open status" }); return; }
  const now = new Date();
  // Starting work implies the dispatched partner acknowledged the job. Resolve the
  // ack-SLA: a missed deadline stays 'breached' for the audit trail; otherwise it
  // moves to 'acknowledged'. Un-dispatched orders keep their (null) sla_status.
  const sla_status = cur.sla_status === "breached"
    ? "breached"
    : cur.sla_status === "pending_ack" ? "acknowledged" : cur.sla_status;
  const [row] = await db.update(workOrdersTable)
    .set({ status: "InProgress", acknowledged_at: cur.acknowledged_at ?? (cur.service_host_id ? now : null), sla_status, updated_at: now })
    .where(and(eq(workOrdersTable.id, id), eq(workOrdersTable.status, "Open")))
    .returning();
  if (!row) { res.status(400).json({ error: "Work order not in Open status" }); return; }
  const [result] = await enrichWorkOrders([row]);
  res.json(result);
});

router.post("/v1/work-orders/:id/review", async (req, res): Promise<void> => {
  const [row] = await db.update(workOrdersTable)
    .set({ status: "PendingReview", updated_at: new Date() })
    .where(and(eq(workOrdersTable.id, Number(req.params.id)), eq(workOrdersTable.status, "InProgress")))
    .returning();
  if (!row) { res.status(400).json({ error: "Work order not in InProgress status" }); return; }
  const [result] = await enrichWorkOrders([row]);
  res.json(result);
});

router.post("/v1/work-orders/:id/complete", async (req, res): Promise<void> => {
  const parsed = CompleteWorkOrderBody.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const id = Number(req.params.id);
  const [cur] = await db.select().from(workOrdersTable).where(eq(workOrdersTable.id, id));
  if (!cur) { res.status(404).json({ error: "Not found" }); return; }
  const now = new Date();
  const updates: Partial<typeof workOrdersTable.$inferInsert> = {
    status: "Completed",
    completed_at: now,
    updated_at: now,
  };
  // A completed job was necessarily acknowledged. Finalise the ack-SLA: keep a
  // recorded 'breached' for the audit trail, otherwise mark it 'met'. Backfill
  // acknowledged_at for dispatched orders that were completed without an explicit
  // start/acknowledge step.
  if (cur.service_host_id) {
    updates.sla_status = cur.sla_status === "breached" ? "breached" : "met";
    if (!cur.acknowledged_at) updates.acknowledged_at = now;
  }
  if (parsed.data.cost != null) updates.cost = parsed.data.cost;
  if (parsed.data.notes != null) updates.notes = parsed.data.notes;
  const [row] = await db.update(workOrdersTable).set(updates)
    .where(eq(workOrdersTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const [result] = await enrichWorkOrders([row]);
  res.json(result);
});

// ── Owner charge-back (#5) ───────────────────────────────────────────────────
// Recover a completed repair's cost from the property owner by raising a Draft
// invoice to them, linked back to the work order. Idempotent per work order.
// Body: { amount?, markup_pct?, account_id?, currency?, due_date? }. Defaults to
// the work order's own cost, and the space's landlord (spaces.landlord_account_id).
router.post("/v1/work-orders/:id/charge-owner", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [wo] = await db.select().from(workOrdersTable).where(eq(workOrdersTable.id, id));
  if (!wo) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Work order not found" } }); return; }

  // Idempotent: one charge-back invoice per work order.
  const [already] = await db.select().from(invoicesTable).where(eq(invoicesTable.work_order_id, id)).limit(1);
  if (already) { res.json({ success: true, data: already, alreadyCharged: true }); return; }

  if (wo.status !== "Completed") {
    res.status(409).json({ success: false, error: { code: "NOT_COMPLETED", message: "Only a completed work order can be charged to the owner." } }); return;
  }

  const base = req.body?.amount != null ? Number(req.body.amount) : Number(wo.cost ?? 0);
  if (!(base > 0)) {
    res.status(400).json({ success: false, error: { code: "NO_COST", message: "No cost to charge — set the work order cost or pass an amount." } }); return;
  }
  const markupPct = Number(req.body?.markup_pct ?? 0);
  const amount = Math.round(base * (1 + markupPct / 100) * 100) / 100;

  // Resolve the owner: explicit override, else the space's landlord.
  let ownerAccountId: number | null = req.body?.account_id != null ? Number(req.body.account_id) : null;
  if (!ownerAccountId && wo.space_id) {
    const [sp] = await db.select({ landlord: spacesTable.landlord_account_id }).from(spacesTable).where(eq(spacesTable.id, wo.space_id));
    ownerAccountId = sp?.landlord ?? null;
  }
  if (!ownerAccountId) {
    res.status(400).json({ success: false, error: { code: "NO_OWNER", message: "Could not resolve the property owner; pass account_id." } }); return;
  }

  const ccy = req.body?.currency ?? wo.currency ?? DEFAULT_CURRENCY;
  const [inv] = await db.insert(invoicesTable).values({
    invoice_ref: await nextInvoiceRef(),
    account_id: ownerAccountId,
    work_order_id: id,
    amount: String(amount),
    currency: ccy,
    exchange_rate_to_aud: await getRateToAud(ccy),
    status: "Draft",
    due_date: req.body?.due_date ?? null,
    description: `Repair charge — ${wo.order_ref}${wo.title ? `: ${wo.title}` : ""}${markupPct ? ` (+${markupPct}% admin)` : ""}`,
  }).returning();
  void logAction({ entityType: "work_order", entityId: id, action: "UPDATE", actorId: (req as any).user?.id ?? null, newValue: { charged_owner_invoice_id: inv.id, account_id: ownerAccountId, amount } });
  res.status(201).json({ success: true, data: inv });
});

// ── Work-order photos (#7) — before/after (request/confirmation) evidence ─────
router.get("/v1/work-orders/:id/photos", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const rows = await db.select().from(workOrderPhotosTable)
    .where(eq(workOrderPhotosTable.work_order_id, id)).orderBy(desc(workOrderPhotosTable.id));
  res.json({ success: true, data: rows });
});

// Accepts either a multipart `image` file (uploaded to Cloudinary) or a JSON body
// with an existing `url`. Fields: kind (before|after), caption, uploaded_by_type.
router.post("/v1/work-orders/:id/photos", upload.single("image"), async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const [wo] = await db.select({ id: workOrdersTable.id }).from(workOrdersTable).where(eq(workOrdersTable.id, id));
    if (!wo) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Work order not found" } }); return; }

    let url: string | null = typeof req.body?.url === "string" ? req.body.url : null;
    if (!url && req.file) {
      if (!isCloudinaryConfigured()) { res.status(503).json({ success: false, error: { code: "NOT_CONFIGURED", message: "Image upload not configured" } }); return; }
      const result = await uploadToCloudinary(req.file.buffer, { folder: cldFolder("work-orders") });
      url = result.secure_url;
    }
    if (!url) { res.status(400).json({ success: false, error: { code: "NO_IMAGE", message: "Provide an image file or a url." } }); return; }

    const kind = req.body?.kind === "before" ? "before" : "after";
    const uploaded_by_type = req.body?.uploaded_by_type === "partner" ? "partner" : "admin";
    const [row] = await db.insert(workOrderPhotosTable).values({
      work_order_id: id, url, kind, uploaded_by_type, caption: req.body?.caption ?? null,
    }).returning();
    res.status(201).json({ success: true, data: row });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "UPLOAD_FAILED", message: err.message } });
  }
});

router.post("/v1/work-orders/:id/cancel", async (req, res): Promise<void> => {
  const parsed = CancelWorkOrderBody.safeParse(req.body ?? {});
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const updates: Partial<typeof workOrdersTable.$inferInsert> = {
    status: "Cancelled",
    updated_at: new Date(),
  };
  if (parsed.data.notes != null) updates.notes = parsed.data.notes;
  const [row] = await db.update(workOrdersTable).set(updates)
    .where(eq(workOrdersTable.id, Number(req.params.id)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const [result] = await enrichWorkOrders([row]);
  res.json(result);
});

export default router;
