import { Router } from "express";
import { db, contractsTable, accountsTable, spacesTable, contractProductsTable, bookingsTable, recurringSchedulesTable, bookingServicesTable } from "@workspace/db";
import { eq, ilike, and } from "drizzle-orm";
import { logAction } from "../utils/auditLog";

const router = Router();

async function nextContractRef(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await db.select({ id: contractsTable.id }).from(contractsTable)
    .where(ilike(contractsTable.contract_ref, `MS-C-${year}-%`));
  const count = rows.length + 1;
  return `MS-C-${year}-${String(count).padStart(5, "0")}`;
}

async function enrichContracts(rows: (typeof contractsTable.$inferSelect)[]) {
  if (rows.length === 0) return [];
  const tenantIds = [...new Set(rows.map(r => r.tenant_account_id).filter(Boolean))] as number[];
  const landlordIds = [...new Set(rows.map(r => r.landlord_account_id).filter(Boolean))] as number[];
  const spaceIds = [...new Set(rows.map(r => r.space_id).filter(Boolean))] as number[];
  const productIds = [...new Set(rows.map(r => r.contract_product_id).filter(Boolean))] as number[];
  const bookingIds = [...new Set(rows.map(r => r.booking_id).filter(Boolean))] as number[];

  const accountMap: Record<number, string> = {};
  const spaceMap: Record<number, string> = {};
  const productMap: Record<number, string> = {};
  const bookingMap: Record<number, string> = {};

  for (const id of [...new Set([...tenantIds, ...landlordIds])]) {
    const [a] = await db.select({ id: accountsTable.id, name: accountsTable.name }).from(accountsTable).where(eq(accountsTable.id, id));
    if (a) accountMap[a.id] = a.name;
  }
  for (const id of spaceIds) {
    const [s] = await db.select({ id: spacesTable.id, name: spacesTable.name }).from(spacesTable).where(eq(spacesTable.id, id));
    if (s) spaceMap[s.id] = s.name;
  }
  for (const id of productIds) {
    const [p] = await db.select({ id: contractProductsTable.id, name: contractProductsTable.name }).from(contractProductsTable).where(eq(contractProductsTable.id, id));
    if (p) productMap[p.id] = p.name;
  }
  for (const id of bookingIds) {
    const [b] = await db.select({ id: bookingsTable.id, booking_ref: bookingsTable.booking_ref }).from(bookingsTable).where(eq(bookingsTable.id, id));
    if (b) bookingMap[b.id] = b.booking_ref;
  }

  return rows.map(r => ({
    ...r,
    tenant_name: r.tenant_account_id ? (accountMap[r.tenant_account_id] ?? null) : null,
    landlord_name: r.landlord_account_id ? (accountMap[r.landlord_account_id] ?? null) : null,
    space_name: r.space_id ? (spaceMap[r.space_id] ?? null) : null,
    contract_product_name: r.contract_product_id ? (productMap[r.contract_product_id] ?? null) : null,
    booking_ref: r.booking_id ? (bookingMap[r.booking_id] ?? null) : null,
  }));
}

router.get("/v1/contracts", async (req, res): Promise<void> => {
  const { q, status, tenant_account_id, space_id } = req.query as Record<string, string>;
  const conditions = [];
  if (q) conditions.push(ilike(contractsTable.contract_ref, `%${q}%`));
  if (status) conditions.push(eq(contractsTable.status, status));
  if (tenant_account_id) conditions.push(eq(contractsTable.tenant_account_id, Number(tenant_account_id)));
  if (space_id) conditions.push(eq(contractsTable.space_id, Number(space_id)));
  const rows = await db.select().from(contractsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(contractsTable.id);
  const result = await enrichContracts(rows);
  res.json(result);
});

router.post("/v1/contracts", async (req, res): Promise<void> => {
  const data = req.body;
  const contract_ref = await nextContractRef();
  const [row] = await db.insert(contractsTable).values({
    contract_ref,
    booking_id: data.booking_id ?? null,
    contract_product_id: data.contract_product_id ?? null,
    tenant_account_id: data.tenant_account_id ?? null,
    landlord_account_id: data.landlord_account_id ?? null,
    space_id: data.space_id ?? null,
    start_date: data.start_date ?? null,
    end_date: data.end_date ?? null,
    weekly_rate: data.weekly_rate ?? null,
    total_rent: data.total_rent ?? null,
    bond_amount: data.bond_amount ?? null,
    advance_amount: data.advance_amount ?? null,
    currency: data.currency ?? "AUD",
    status: "Draft",
    document_url: data.document_url ?? null,
    terms_text: data.terms_text ?? null,
    notes: data.notes ?? null,
  }).returning();
  const [result] = await enrichContracts([row]);
  res.status(201).json(result);
});

router.get("/v1/contracts/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(contractsTable).where(eq(contractsTable.id, id));
  if (!row) { res.status(404).json({ error: "NOT_FOUND" }); return; }
  const [result] = await enrichContracts([row]);
  res.json(result);
});

router.put("/v1/contracts/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const data = req.body;
  const [row] = await db.update(contractsTable).set({
    booking_id: data.booking_id ?? null,
    contract_product_id: data.contract_product_id ?? null,
    tenant_account_id: data.tenant_account_id ?? null,
    landlord_account_id: data.landlord_account_id ?? null,
    space_id: data.space_id ?? null,
    start_date: data.start_date ?? null,
    end_date: data.end_date ?? null,
    weekly_rate: data.weekly_rate ?? null,
    total_rent: data.total_rent ?? null,
    bond_amount: data.bond_amount ?? null,
    advance_amount: data.advance_amount ?? null,
    currency: data.currency ?? "AUD",
    document_url: data.document_url ?? null,
    terms_text: data.terms_text ?? null,
    notes: data.notes ?? null,
  }).where(eq(contractsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "NOT_FOUND" }); return; }
  const [result] = await enrichContracts([row]);
  res.json(result);
});

router.delete("/v1/contracts/:id", async (req, res): Promise<void> => {
  await db.delete(contractsTable).where(eq(contractsTable.id, Number(req.params.id)));
  res.status(204).send();
});

router.post("/v1/contracts/:id/send", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [row] = await db.update(contractsTable)
    .set({ status: "Sent", sent_at: new Date() })
    .where(eq(contractsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "NOT_FOUND" }); return; }
  await logAction({ entityType: "contract", entityId: id, action: "STATUS_CHANGE", newValue: { status: "Sent" } });
  const [result] = await enrichContracts([row]);
  res.json(result);
});

router.post("/v1/contracts/:id/sign", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { document_url } = req.body ?? {};
  const [row] = await db.update(contractsTable)
    .set({ status: "Signed", signed_at: new Date(), document_url: document_url ?? null })
    .where(eq(contractsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "NOT_FOUND" }); return; }
  await logAction({ entityType: "contract", entityId: id, action: "STATUS_CHANGE", newValue: { status: "Signed" } });
  const [result] = await enrichContracts([row]);
  res.json(result);
});

router.post("/v1/contracts/:id/activate", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [row] = await db.update(contractsTable)
    .set({ status: "Active", effective_date: new Date().toISOString().slice(0, 10) })
    .where(eq(contractsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "NOT_FOUND" }); return; }
  await logAction({ entityType: "contract", entityId: id, action: "STATUS_CHANGE", newValue: { status: "Active" } });
  const [result] = await enrichContracts([row]);
  res.json(result);
});

router.post("/v1/contracts/:id/terminate", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const { termination_reason } = req.body;
  const [row] = await db.update(contractsTable)
    .set({ status: "Terminated", termination_reason })
    .where(eq(contractsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "NOT_FOUND" }); return; }
  await logAction({ entityType: "contract", entityId: id, action: "STATUS_CHANGE", newValue: { status: "Terminated", termination_reason } });
  const [result] = await enrichContracts([row]);
  res.json(result);
});

router.post("/v1/contracts/:id/expire", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [row] = await db.update(contractsTable)
    .set({ status: "Expired", expiry_date: new Date().toISOString().slice(0, 10) })
    .where(eq(contractsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "NOT_FOUND" }); return; }
  await logAction({ entityType: "contract", entityId: id, action: "STATUS_CHANGE", newValue: { status: "Expired" } });
  const [result] = await enrichContracts([row]);
  res.json(result);
});

// GET /contracts/:id/payment-schedule — recurring schedules for this contract
router.get("/v1/contracts/:id/payment-schedule", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const schedules = await db.select().from(recurringSchedulesTable).where(eq(recurringSchedulesTable.contract_id, id));
  res.json({ data: schedules, meta: { total: schedules.length } });
});

// GET /contracts/:id/services — booking services linked via the booking
router.get("/v1/contracts/:id/services", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [contract] = await db.select({ booking_id: contractsTable.booking_id }).from(contractsTable).where(eq(contractsTable.id, id));
  if (!contract?.booking_id) { res.json({ data: [], meta: { total: 0 } }); return; }
  const rows = await db.select().from(bookingServicesTable)
    .where(and(eq(bookingServicesTable.booking_id, contract.booking_id), eq(bookingServicesTable.status, "Active")));
  res.json({ data: rows, meta: { total: rows.length } });
});

router.get("/v1/lookup/contracts", async (req, res): Promise<void> => {
  const { q } = req.query as Record<string, string>;
  const conditions = q ? [ilike(contractsTable.contract_ref, `%${q}%`)] : [];
  const rows = await db.select({ id: contractsTable.id, contract_ref: contractsTable.contract_ref, status: contractsTable.status })
    .from(contractsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(contractsTable.id)
    .limit(20);
  res.json(rows.map(r => ({ id: r.id, display: `${r.contract_ref} (${r.status})` })));
});

export default router;
