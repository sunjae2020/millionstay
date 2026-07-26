import { Router } from "express";
import { db, workOrdersTable, propertiesTable, spacesTable, contactsTable, serviceHostsTable } from "@workspace/db";
import { eq, ilike, and, isNull, inArray } from "drizzle-orm";
import { dispatchWorkOrder } from "../lib/dispatch/workOrderDispatch";
import { logAction } from "../utils/auditLog";
import { deletedFilter, makeBulkDelete, makeBulkRestore } from "../lib/softDelete";
import {
  CreateWorkOrderBody,
  UpdateWorkOrderBody,
  CompleteWorkOrderBody,
  CancelWorkOrderBody,
} from "@workspace/api-zod";

const router = Router();

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
  const [row] = await db.update(workOrdersTable)
    .set({ status: "InProgress", updated_at: new Date() })
    .where(and(eq(workOrdersTable.id, Number(req.params.id)), eq(workOrdersTable.status, "Open")))
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
  const updates: Partial<typeof workOrdersTable.$inferInsert> = {
    status: "Completed",
    completed_at: new Date(),
    updated_at: new Date(),
  };
  if (parsed.data.cost != null) updates.cost = parsed.data.cost;
  if (parsed.data.notes != null) updates.notes = parsed.data.notes;
  const [row] = await db.update(workOrdersTable).set(updates)
    .where(eq(workOrdersTable.id, Number(req.params.id)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const [result] = await enrichWorkOrders([row]);
  res.json(result);
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
