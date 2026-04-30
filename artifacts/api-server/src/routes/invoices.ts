import { Router } from "express";
import { db, invoicesTable, bookingsTable, contractsTable, accountsTable } from "@workspace/db";
import { eq, ilike, and, isNull, inArray } from "drizzle-orm";
import { logAction } from "../utils/auditLog";
import { getRateToAud } from "../lib/rateSnapshot";
import {
  CreateInvoiceBody,
  UpdateInvoiceBody,
  PayInvoiceBody,
} from "@workspace/api-zod";

const router = Router();

async function nextInvoiceRef(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await db.select({ id: invoicesTable.id }).from(invoicesTable)
    .where(ilike(invoicesTable.invoice_ref, `MS-INV-${year}-%`));
  const count = rows.length + 1;
  return `MS-INV-${year}-${String(count).padStart(5, "0")}`;
}

async function enrichInvoices(rows: (typeof invoicesTable.$inferSelect)[]) {
  if (rows.length === 0) return [];
  const bookingIds = [...new Set(rows.map(r => r.booking_id).filter(Boolean))] as number[];
  const contractIds = [...new Set(rows.map(r => r.contract_id).filter(Boolean))] as number[];
  const accountIds = [...new Set(rows.map(r => r.account_id).filter(Boolean))] as number[];

  const bookingMap: Record<number, string> = {};
  const contractMap: Record<number, string> = {};
  const accountMap: Record<number, string> = {};

  for (const id of bookingIds) {
    const [b] = await db.select({ id: bookingsTable.id, booking_ref: bookingsTable.booking_ref }).from(bookingsTable).where(eq(bookingsTable.id, id));
    if (b) bookingMap[b.id] = b.booking_ref;
  }
  for (const id of contractIds) {
    const [c] = await db.select({ id: contractsTable.id, contract_ref: contractsTable.contract_ref }).from(contractsTable).where(eq(contractsTable.id, id));
    if (c) contractMap[c.id] = c.contract_ref;
  }
  for (const id of accountIds) {
    const [a] = await db.select({ id: accountsTable.id, name: accountsTable.name }).from(accountsTable).where(eq(accountsTable.id, id));
    if (a) accountMap[a.id] = a.name;
  }

  return rows.map(r => ({
    ...r,
    booking_ref: r.booking_id ? (bookingMap[r.booking_id] ?? null) : null,
    contract_ref: r.contract_id ? (contractMap[r.contract_id] ?? null) : null,
    account_name: r.account_id ? (accountMap[r.account_id] ?? null) : null,
  }));
}

router.get("/v1/invoices", async (req, res): Promise<void> => {
  const { q, status, booking_id, contract_id, account_id } = req.query as Record<string, string>;
  const conditions: any[] = [isNull(invoicesTable.deleted_at)];
  if (q) conditions.push(ilike(invoicesTable.invoice_ref, `%${q}%`));
  if (status) conditions.push(eq(invoicesTable.status, status));
  if (booking_id) conditions.push(eq(invoicesTable.booking_id, Number(booking_id)));
  if (contract_id) conditions.push(eq(invoicesTable.contract_id, Number(contract_id)));
  if (account_id) conditions.push(eq(invoicesTable.account_id, Number(account_id)));
  const rows = await db.select().from(invoicesTable)
    .where(and(...conditions))
    .orderBy(invoicesTable.id);
  const result = await enrichInvoices(rows);
  res.json(result);
});

router.post("/v1/invoices", async (req, res): Promise<void> => {
  const parsed = CreateInvoiceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const invoice_ref = await nextInvoiceRef();
  const ccy = parsed.data.currency ?? "AUD";
  const [row] = await db.insert(invoicesTable).values({
    invoice_ref,
    booking_id: parsed.data.booking_id ?? null,
    contract_id: parsed.data.contract_id ?? null,
    account_id: parsed.data.account_id ?? null,
    amount: parsed.data.amount ?? 0,
    currency: ccy,
    exchange_rate_to_aud: await getRateToAud(ccy),
    due_date: parsed.data.due_date ?? null,
    description: parsed.data.description ?? null,
    notes: parsed.data.notes ?? null,
  }).returning();
  const [result] = await enrichInvoices([row]);
  res.status(201).json(result);
});

router.get("/v1/invoices/:id", async (req, res): Promise<void> => {
  const row = await db.select().from(invoicesTable).where(eq(invoicesTable.id, Number(req.params.id))).then(r => r[0]);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const [result] = await enrichInvoices([row]);
  res.json(result);
});

router.put("/v1/invoices/:id", async (req, res): Promise<void> => {
  const parsed = UpdateInvoiceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const updates: Partial<typeof invoicesTable.$inferInsert> = { updated_at: new Date() };
  if (parsed.data.booking_id !== undefined) updates.booking_id = parsed.data.booking_id;
  if (parsed.data.contract_id !== undefined) updates.contract_id = parsed.data.contract_id;
  if (parsed.data.account_id !== undefined) updates.account_id = parsed.data.account_id;
  if (parsed.data.amount != null) updates.amount = parsed.data.amount;
  if (parsed.data.currency != null) updates.currency = parsed.data.currency;
  if (parsed.data.due_date !== undefined) updates.due_date = parsed.data.due_date;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;
  const [row] = await db.update(invoicesTable).set(updates).where(eq(invoicesTable.id, Number(req.params.id))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const [result] = await enrichInvoices([row]);
  res.json(result);
});

router.post("/v1/invoices/bulk-delete", async (req, res): Promise<void> => {
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
    await db.delete(invoicesTable).where(inArray(invoicesTable.id, numIds));
  } else {
    await db.update(invoicesTable).set({ deleted_at: new Date(), status: "Archived" }).where(inArray(invoicesTable.id, numIds));
  }
  res.json({ success: true, affected: numIds.length });
});

router.delete("/v1/invoices/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const currentUser = (req as any).user;
  const permanent = req.query.permanent === "true";
  if (permanent) {
    if (currentUser?.role !== "SuperAdmin") {
      res.status(403).json({ error: "Only SuperAdmin can permanently delete records" }); return;
    }
    await db.delete(invoicesTable).where(eq(invoicesTable.id, id));
  } else {
    await db.update(invoicesTable).set({ deleted_at: new Date(), status: "Archived" }).where(eq(invoicesTable.id, id));
  }
  res.status(204).send();
});

router.post("/v1/invoices/:id/send", async (req, res): Promise<void> => {
  const [row] = await db.update(invoicesTable)
    .set({ status: "Sent", updated_at: new Date() })
    .where(and(eq(invoicesTable.id, Number(req.params.id)), eq(invoicesTable.status, "Draft")))
    .returning();
  if (!row) { res.status(400).json({ error: "Invoice not in Draft status" }); return; }
  await logAction({ entityType: "invoice", entityId: row.id, action: "STATUS_CHANGE", oldValue: { status: "Draft" }, newValue: { status: "Sent" } });
  const [result] = await enrichInvoices([row]);
  res.json(result);
});

router.post("/v1/invoices/:id/pay", async (req, res): Promise<void> => {
  const parsed = PayInvoiceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const paidAt = parsed.data.paid_at ? new Date(parsed.data.paid_at) : new Date();
  const [row] = await db.update(invoicesTable)
    .set({ status: "Paid", payment_method: parsed.data.payment_method, paid_at: paidAt, updated_at: new Date() })
    .where(and(eq(invoicesTable.id, Number(req.params.id)), eq(invoicesTable.status, "Sent")))
    .returning();
  if (!row) { res.status(400).json({ error: "Invoice not in Sent status" }); return; }
  await logAction({ entityType: "invoice", entityId: row.id, action: "PAYMENT", oldValue: { status: "Sent" }, newValue: { status: "Paid", payment_method: parsed.data.payment_method } });
  const [result] = await enrichInvoices([row]);
  res.json(result);
});

router.post("/v1/invoices/:id/void", async (req, res): Promise<void> => {
  const existing = await db.select({ status: invoicesTable.status }).from(invoicesTable).where(eq(invoicesTable.id, Number(req.params.id))).then(r => r[0]);
  const [row] = await db.update(invoicesTable)
    .set({ status: "Void", updated_at: new Date() })
    .where(eq(invoicesTable.id, Number(req.params.id)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  await logAction({ entityType: "invoice", entityId: row.id, action: "STATUS_CHANGE", oldValue: { status: existing?.status }, newValue: { status: "Void" } });
  const [result] = await enrichInvoices([row]);
  res.json(result);
});

router.get("/v1/lookup/invoices", async (req, res): Promise<void> => {
  const { q } = req.query as Record<string, string>;
  const conditions = q ? [ilike(invoicesTable.invoice_ref, `%${q}%`)] : [];
  const rows = await db.select({ id: invoicesTable.id, invoice_ref: invoicesTable.invoice_ref, status: invoicesTable.status })
    .from(invoicesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(invoicesTable.id)
    .limit(20);
  res.json(rows.map(r => ({ id: r.id, display: `${r.invoice_ref} (${r.status})` })));
});

export default router;
