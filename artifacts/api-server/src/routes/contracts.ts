import { Router } from "express";
import { db, contractsTable, accountsTable, spacesTable, propertiesTable, contractProductsTable, bookingsTable, recurringSchedulesTable, bookingServicesTable, invoicesTable } from "@workspace/db";
import { eq, ilike, and, like, desc } from "drizzle-orm";
import { logAction } from "../utils/auditLog";

// ─── Invoice ref generator (returns a factory that increments safely) ────────
async function makeInvoiceRefFactory(): Promise<() => string> {
  const year = new Date().getFullYear();
  const rows = await db
    .select({ ref: invoicesTable.invoice_ref })
    .from(invoicesTable)
    .where(like(invoicesTable.invoice_ref, `MS-INV-${year}-%`))
    .orderBy(desc(invoicesTable.id))
    .limit(1);
  let counter = 0;
  if (rows.length > 0) {
    const last = rows[0].ref;
    const num = parseInt(last.split("-").pop() ?? "0", 10);
    counter = isNaN(num) ? 0 : num;
  }
  return () => {
    counter++;
    return `MS-INV-${year}-${String(counter).padStart(5, "0")}`;
  };
}

// ─── Month name helper ────────────────────────────────────────────────────────
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── Add months to a date string (YYYY-MM-DD) ────────────────────────────────
function addMonths(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function formatPeriodLabel(freq: string, dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const mon = MONTH_NAMES[d.getUTCMonth()];
  const yr = d.getUTCFullYear();
  const day = String(d.getUTCDate()).padStart(2, "0");
  if (freq === "Monthly") return `${mon} ${yr}`;
  return `${day} ${mon} ${yr}`;
}

// ─── Core: generate invoices + payment schedules for a contract ───────────────
async function generateContractInvoicesAndSchedules(contractId: number): Promise<{ invoices: number; schedules: number }> {
  const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.id, contractId));
  if (!contract || !contract.start_date || !contract.end_date) return { invoices: 0, schedules: 0 };

  // Determine billing frequency from contract_product or default Monthly
  let billingFreq = "Monthly";
  let locationLabel = "";

  if (contract.contract_product_id) {
    const [cp] = await db.select().from(contractProductsTable).where(eq(contractProductsTable.id, contract.contract_product_id));
    if (cp?.billing_frequency) billingFreq = cp.billing_frequency;
  }

  // Build location label from space + property
  if (contract.space_id) {
    const [space] = await db.select().from(spacesTable).where(eq(spacesTable.id, contract.space_id));
    if (space) {
      locationLabel = space.name ?? "";
      if (space.property_id) {
        const [prop] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, space.property_id));
        if (prop?.address) locationLabel = `${prop.address}${space.name ? `, ${space.name}` : ""}`;
      }
    }
  }

  const weeklyRate = parseFloat(contract.weekly_rate ?? "0");
  const currency = contract.currency ?? "AUD";

  // Calculate per-period amount
  let periodAmount: number;
  if (billingFreq === "Weekly") periodAmount = weeklyRate;
  else if (billingFreq === "Biweekly") periodAmount = weeklyRate * 2;
  else periodAmount = parseFloat((weeklyRate * (52 / 12)).toFixed(2)); // Monthly

  // Delete existing non-paid schedules and non-paid invoices for this contract
  await db.delete(recurringSchedulesTable).where(eq(recurringSchedulesTable.contract_id, contractId));
  const existingInvoices = await db.select({ id: invoicesTable.id, status: invoicesTable.status })
    .from(invoicesTable).where(eq(invoicesTable.contract_id, contractId));
  // Delete unpaid invoices; keep paid ones (do not regenerate them)
  const unpaidIds = existingInvoices.filter(i => i.status !== "Paid").map(i => i.id);
  for (const iid of unpaidIds) {
    await db.delete(invoicesTable).where(eq(invoicesTable.id, iid));
  }

  // Fetch remaining paid invoices' due_dates — we won't create new invoices for those dates
  const paidInvoices = await db.select({ due_date: invoicesTable.due_date })
    .from(invoicesTable)
    .where(eq(invoicesTable.contract_id, contractId));
  const paidDueDates = new Set(paidInvoices.map(i => i.due_date).filter(Boolean) as string[]);

  // Pre-initialise invoice ref factory AFTER deletions so the counter is accurate
  const nextInvoiceRef = await makeInvoiceRefFactory();

  // Generate periods
  const start = contract.start_date;
  const end = contract.end_date;
  const invoicesCreated: number[] = [];
  const schedulesCreated: number[] = [];

  let current = start;
  let periodIndex = 0;

  while (current < end) {
    // Determine next period start
    let nextDate: string;
    if (billingFreq === "Weekly") nextDate = addDays(current, 7);
    else if (billingFreq === "Biweekly") nextDate = addDays(current, 14);
    else nextDate = addMonths(current, 1);

    const periodEnd = nextDate > end ? end : nextDate;
    const label = formatPeriodLabel(billingFreq, current);
    const freqLabel = billingFreq === "Monthly" ? "Monthly Rent" : billingFreq === "Biweekly" ? "Fortnightly Rent" : "Weekly Rent";
    const description = `${freqLabel} — ${label}${locationLabel ? ` | ${locationLabel}` : ""}`;

    // Skip if already paid invoice for this due date
    if (!paidDueDates.has(current)) {
      const invoiceRef = nextInvoiceRef();
      const [inv] = await db.insert(invoicesTable).values({
        invoice_ref: invoiceRef,
        booking_id: contract.booking_id ?? null,
        contract_id: contractId,
        account_id: contract.tenant_account_id ?? null,
        amount: periodAmount,
        currency,
        status: "Sent",
        due_date: current,
        description,
      }).returning({ id: invoicesTable.id });
      invoicesCreated.push(inv.id);
    }

    // Create payment schedule entry for every period
    const [sched] = await db.insert(recurringSchedulesTable).values({
      booking_id: contract.booking_id ?? 0,
      contract_id: contractId,
      account_id: contract.tenant_account_id ?? 0,
      schedule_type: "Rent",
      frequency: billingFreq,
      amount: String(periodAmount),
      currency,
      gst_included: true,
      start_date: current,
      end_date: periodEnd,
      next_due_date: current,
      is_active: !paidDueDates.has(current),
    }).returning({ id: recurringSchedulesTable.id });
    schedulesCreated.push(sched.id);

    current = nextDate;
    if (nextDate >= end) break;
    periodIndex++;
    if (periodIndex > 500) break; // safety limit
  }

  return { invoices: invoicesCreated.length, schedules: schedulesCreated.length };
}

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

  // Auto-generate invoices + payment schedules
  const generated = await generateContractInvoicesAndSchedules(id);

  // Also set linked booking to Active
  if (row.booking_id) {
    await db.update(bookingsTable)
      .set({ booking_status: "Active" })
      .where(eq(bookingsTable.id, row.booking_id));
  }

  await logAction({
    entityType: "contract", entityId: id, action: "STATUS_CHANGE",
    newValue: { status: "Active", invoices_generated: generated.invoices, schedules_generated: generated.schedules },
  });
  const [result] = await enrichContracts([row]);
  res.json({ ...result, _generated: generated });
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

// POST /contracts/:id/payment-schedule — add a new schedule entry
router.post("/v1/contracts/:id/payment-schedule", async (req, res): Promise<void> => {
  const contractId = Number(req.params.id);
  const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.id, contractId));
  if (!contract) { res.status(404).json({ error: "NOT_FOUND" }); return; }
  const { schedule_type, frequency, amount, currency, start_date, end_date, next_due_date, is_active, gst_included } = req.body;
  const [row] = await db.insert(recurringSchedulesTable).values({
    booking_id: contract.booking_id ?? 0,
    contract_id: contractId,
    account_id: contract.tenant_account_id ?? 0,
    schedule_type: schedule_type ?? "Rent",
    frequency: frequency ?? "Biweekly",
    amount: String(amount ?? "0"),
    currency: currency ?? "AUD",
    start_date: start_date,
    end_date: end_date ?? null,
    next_due_date: next_due_date ?? start_date,
    is_active: is_active !== false,
    gst_included: gst_included !== false,
  }).returning();
  await logAction({ entityType: "contract", entityId: contractId, action: "SCHEDULE_ADD", newValue: row });
  res.status(201).json(row);
});

// PATCH /contracts/:id/payment-schedule/:schedId — update a schedule entry
router.patch("/v1/contracts/:id/payment-schedule/:schedId", async (req, res): Promise<void> => {
  const contractId = Number(req.params.id);
  const schedId = Number(req.params.schedId);
  const { schedule_type, frequency, amount, currency, start_date, end_date, next_due_date, is_active, gst_included } = req.body;
  const updates: Record<string, any> = { updated_at: new Date() };
  if (schedule_type !== undefined) updates.schedule_type = schedule_type;
  if (frequency !== undefined) updates.frequency = frequency;
  if (amount !== undefined) updates.amount = String(amount);
  if (currency !== undefined) updates.currency = currency;
  if (start_date !== undefined) updates.start_date = start_date;
  if (end_date !== undefined) updates.end_date = end_date;
  if (next_due_date !== undefined) updates.next_due_date = next_due_date;
  if (is_active !== undefined) updates.is_active = is_active;
  if (gst_included !== undefined) updates.gst_included = gst_included;
  const [row] = await db.update(recurringSchedulesTable).set(updates)
    .where(and(eq(recurringSchedulesTable.id, schedId), eq(recurringSchedulesTable.contract_id, contractId)))
    .returning();
  if (!row) { res.status(404).json({ error: "NOT_FOUND" }); return; }
  await logAction({ entityType: "contract", entityId: contractId, action: "SCHEDULE_UPDATE", newValue: row });
  res.json(row);
});

// DELETE /contracts/:id/payment-schedule/:schedId — remove a schedule entry
router.delete("/v1/contracts/:id/payment-schedule/:schedId", async (req, res): Promise<void> => {
  const contractId = Number(req.params.id);
  const schedId = Number(req.params.schedId);
  const [row] = await db.delete(recurringSchedulesTable)
    .where(and(eq(recurringSchedulesTable.id, schedId), eq(recurringSchedulesTable.contract_id, contractId)))
    .returning();
  if (!row) { res.status(404).json({ error: "NOT_FOUND" }); return; }
  await logAction({ entityType: "contract", entityId: contractId, action: "SCHEDULE_DELETE", newValue: { id: schedId } });
  res.status(204).end();
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
