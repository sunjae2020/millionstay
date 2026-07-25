import { Router, type IRouter } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  db,
  bookingsTable,
  invoicesTable,
  invoiceLineItemsTable,
  contractsTable,
  homestayPlacementsTable,
  homestayPlacementPaymentsTable,
  conditionReportsTable,
  depositSettlementsTable,
  depositDeductionItemsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { requireGuestAuth } from "../middlewares/requireGuestAuth";
import { logAction } from "../utils/auditLog";
import { postEntry, ACCOUNTS } from "../lib/billing/gl";

const ENTITY = "deposit_settlement";

async function generateSettlementRef(): Promise<string> {
  const year = new Date().getFullYear();
  const result = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(depositSettlementsTable)
    .where(sql`EXTRACT(YEAR FROM ${depositSettlementsTable.created_at}) = ${year}`);
  const seq = ((result[0]?.count ?? 0) + 1).toString().padStart(5, "0");
  return `DS-${year}-${seq}`;
}

// Resolve the deposit a booking is holding.
//  - glBacked: sum of PAID deposit line items (line_type='deposit') — the ONLY
//    portion actually posted to the Deposits Held (2100) liability, so the only
//    portion whose release we may auto-post on finalize.
//  - total (deposit_held): the contractual deposit for refund math. Prefers the
//    GL-backed amount; else falls back to the contract bond / placement deposit,
//    because in practice deposits are recorded on contracts.bond_amount /
//    homestay_placements.deposit and are NOT yet invoiced as deposit lines.
async function resolveDeposit(bookingId: number): Promise<{ total: number; glBacked: number }> {
  const lines = await db
    .select({ total: invoiceLineItemsTable.total_amount })
    .from(invoiceLineItemsTable)
    .innerJoin(invoicesTable, eq(invoiceLineItemsTable.invoice_id, invoicesTable.id))
    .where(and(
      eq(invoicesTable.booking_id, bookingId),
      eq(invoicesTable.status, "Paid"),
      eq(invoiceLineItemsTable.line_type, "deposit"),
    ));
  const invoiceDeposit = lines.reduce((s, r) => s + Number(r.total ?? 0), 0);

  // Homestay deposits are booked to Deposits Held (2100) via a PAID upfront
  // placement payment (not an invoice line), so count that as GL-backed too —
  // otherwise the settlement would never release the liability it created.
  let placementBacked = 0;
  const [placement] = await db
    .select({ id: homestayPlacementsTable.id, deposit: homestayPlacementsTable.deposit })
    .from(homestayPlacementsTable)
    .where(eq(homestayPlacementsTable.booking_id, bookingId))
    .orderBy(desc(homestayPlacementsTable.id))
    .limit(1);
  if (placement) {
    const [paidUpfront] = await db
      .select({ id: homestayPlacementPaymentsTable.id })
      .from(homestayPlacementPaymentsTable)
      .where(and(
        eq(homestayPlacementPaymentsTable.placement_id, placement.id),
        eq(homestayPlacementPaymentsTable.kind, "upfront"),
        eq(homestayPlacementPaymentsTable.status, "paid"),
      ))
      .limit(1);
    if (paidUpfront) placementBacked = Number(placement.deposit ?? 0);
  }

  const glBacked = round2(invoiceDeposit + placementBacked);
  if (glBacked > 0) return { total: glBacked, glBacked };

  // Fallback: contract bond (latest non-zero for this booking).
  const contracts = await db
    .select({ bond: contractsTable.bond_amount })
    .from(contractsTable)
    .where(eq(contractsTable.booking_id, bookingId))
    .orderBy(desc(contractsTable.id));
  const bond = contracts.map((c) => Number(c.bond ?? 0)).find((n) => n > 0) ?? 0;
  if (bond > 0) return { total: round2(bond), glBacked: 0 };

  // Fallback: homestay placement deposit.
  const placements = await db
    .select({ deposit: homestayPlacementsTable.deposit })
    .from(homestayPlacementsTable)
    .where(eq(homestayPlacementsTable.booking_id, bookingId))
    .orderBy(desc(homestayPlacementsTable.id));
  const dep = placements.map((p) => Number(p.deposit ?? 0)).find((n) => n > 0) ?? 0;
  return { total: round2(dep), glBacked: 0 };
}

function round2(n: number): number { return Math.round((n + Number.EPSILON) * 100) / 100; }

async function loadSettlementDetail(id: number) {
  const [s] = await db.select().from(depositSettlementsTable).where(eq(depositSettlementsTable.id, id)).limit(1);
  if (!s) return null;
  const deductions = await db
    .select()
    .from(depositDeductionItemsTable)
    .where(eq(depositDeductionItemsTable.deposit_settlement_id, id))
    .orderBy(depositDeductionItemsTable.id);
  return { ...s, deductions };
}

// Recompute total_deducted / refund_amount from the current deduction rows.
async function recomputeTotals(id: number): Promise<{ deposit_held: number; total_deducted: number; refund_amount: number }> {
  const [s] = await db.select().from(depositSettlementsTable).where(eq(depositSettlementsTable.id, id)).limit(1);
  const deductions = await db.select().from(depositDeductionItemsTable).where(eq(depositDeductionItemsTable.deposit_settlement_id, id));
  const depositHeld = Number(s?.deposit_held ?? 0);
  const totalDeducted = round2(deductions.reduce((sum, d) => sum + Number(d.amount ?? 0), 0));
  const refund = round2(Math.max(0, depositHeld - totalDeducted));
  await db
    .update(depositSettlementsTable)
    .set({ total_deducted: String(totalDeducted), refund_amount: String(refund) })
    .where(eq(depositSettlementsTable.id, id));
  return { deposit_held: depositHeld, total_deducted: totalDeducted, refund_amount: refund };
}

/* ═══════════════════════════════════════════════════════════
   ADMIN ROUTER
═══════════════════════════════════════════════════════════ */
const adminRouter: IRouter = Router();
adminRouter.use("/v1", requireAuth);

adminRouter.get("/v1/bookings/:bookingId/deposit-settlements", async (req, res): Promise<void> => {
  try {
    const bookingId = Number(req.params.bookingId);
    const rows = await db
      .select()
      .from(depositSettlementsTable)
      .where(eq(depositSettlementsTable.booking_id, bookingId))
      .orderBy(desc(depositSettlementsTable.created_at));
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// Create a draft settlement. Snapshots deposit_held and auto-links the booking's
// move-out condition report if one exists.
adminRouter.post("/v1/bookings/:bookingId/deposit-settlements", async (req, res): Promise<void> => {
  try {
    const bookingId = Number(req.params.bookingId);
    const [booking] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, bookingId)).limit(1);
    if (!booking) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Booking not found" } }); return; }

    const { total: depositHeld } = await resolveDeposit(bookingId);
    const [moveOut] = await db
      .select({ id: conditionReportsTable.id })
      .from(conditionReportsTable)
      .where(and(eq(conditionReportsTable.booking_id, bookingId), eq(conditionReportsTable.phase, "move_out")))
      .orderBy(desc(conditionReportsTable.created_at))
      .limit(1);

    const settlement_ref = await generateSettlementRef();
    const [row] = await db
      .insert(depositSettlementsTable)
      .values({
        settlement_ref,
        booking_id: bookingId,
        move_out_report_id: moveOut?.id ?? null,
        status: "draft",
        deposit_held: String(round2(depositHeld)),
        refund_amount: String(round2(depositHeld)),
        currency: (booking as any).currency ?? "AUD",
        notes: typeof req.body?.notes === "string" ? req.body.notes : null,
        created_by: (req as any).user?.id ?? null,
        audit_trail: [{ event: "created", at: new Date().toISOString(), actor: (req as any).user?.id ?? null, deposit_held: depositHeld }],
      })
      .returning();
    void logAction({ entityType: ENTITY, entityId: row!.id, action: "CREATE", actorId: (req as any).user?.id ?? null, newValue: { settlement_ref, deposit_held: depositHeld } });
    res.status(201).json({ success: true, data: await loadSettlementDetail(row!.id) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

adminRouter.get("/v1/deposit-settlements/:id", async (req, res): Promise<void> => {
  try {
    const detail = await loadSettlementDetail(Number(req.params.id));
    if (!detail) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Settlement not found" } }); return; }
    res.json({ success: true, data: detail });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// Add a deduction line (draft only).
adminRouter.post("/v1/deposit-settlements/:id/deductions", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const [s] = await db.select().from(depositSettlementsTable).where(eq(depositSettlementsTable.id, id)).limit(1);
    if (!s) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Settlement not found" } }); return; }
    if (!["draft", "proposed"].includes(s.status)) { res.status(409).json({ success: false, error: { code: "LOCKED", message: "Settlement is finalized" } }); return; }
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount < 0) { res.status(400).json({ success: false, error: { code: "BAD_AMOUNT", message: "amount must be a non-negative number" } }); return; }
    await db.insert(depositDeductionItemsTable).values({
      deposit_settlement_id: id,
      condition_item_id: Number.isFinite(Number(req.body?.condition_item_id)) && req.body?.condition_item_id ? Number(req.body.condition_item_id) : null,
      description: typeof req.body?.description === "string" && req.body.description.trim() ? req.body.description.trim() : "Deduction",
      amount: String(round2(amount)),
      photo_ids: Array.isArray(req.body?.photo_ids) ? req.body.photo_ids : [],
    });
    await recomputeTotals(id);
    res.status(201).json({ success: true, data: await loadSettlementDetail(id) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

adminRouter.delete("/v1/deposit-settlements/:id/deductions/:did", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const [s] = await db.select().from(depositSettlementsTable).where(eq(depositSettlementsTable.id, id)).limit(1);
    if (!s) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Settlement not found" } }); return; }
    if (!["draft", "proposed"].includes(s.status)) { res.status(409).json({ success: false, error: { code: "LOCKED", message: "Settlement is finalized" } }); return; }
    await db.delete(depositDeductionItemsTable).where(and(eq(depositDeductionItemsTable.id, Number(req.params.did)), eq(depositDeductionItemsTable.deposit_settlement_id, id)));
    await recomputeTotals(id);
    res.json({ success: true, data: await loadSettlementDetail(id) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// Propose to the tenant (recompute + status → proposed).
adminRouter.post("/v1/deposit-settlements/:id/propose", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const [s] = await db.select().from(depositSettlementsTable).where(eq(depositSettlementsTable.id, id)).limit(1);
    if (!s) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Settlement not found" } }); return; }
    if (s.status === "finalized") { res.status(409).json({ success: false, error: { code: "LOCKED", message: "Already finalized" } }); return; }
    await recomputeTotals(id);
    const audit = Array.isArray(s.audit_trail) ? s.audit_trail : [];
    await db.update(depositSettlementsTable).set({ status: "proposed", proposed_at: new Date(), audit_trail: [...audit, { event: "proposed", at: new Date().toISOString(), actor: (req as any).user?.id ?? null }] }).where(eq(depositSettlementsTable.id, id));
    void logAction({ entityType: ENTITY, entityId: id, action: "STATUS_CHANGE", actorId: (req as any).user?.id ?? null, newValue: { status: "proposed" } });
    res.json({ success: true, data: await loadSettlementDetail(id) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// Finalize — recompute, post the GL entry releasing Deposits Held, lock.
adminRouter.post("/v1/deposit-settlements/:id/finalize", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const [s] = await db.select().from(depositSettlementsTable).where(eq(depositSettlementsTable.id, id)).limit(1);
    if (!s) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Settlement not found" } }); return; }
    if (s.status === "finalized") { res.status(409).json({ success: false, error: { code: "LOCKED", message: "Already finalized" } }); return; }

    const totals = await recomputeTotals(id);
    const postingKey = `deposit_settlement:${id}`;
    // Only the GL-backed portion is actually sitting in Deposits Held (2100), so
    // only that release may be posted — otherwise we'd create a phantom negative
    // liability. In this system deposits are usually recorded on contracts.bond_amount
    // and never posted to 2100, so glBacked is 0 and we SKIP the GL entry (the
    // refund is handled operationally). When a deposit WAS invoiced (line_type=
    // 'deposit'), deposit_held == glBacked and the release balances:
    // Dr Deposits Held = Cr Cash (refund) + Cr Revenue (forfeited).
    const { glBacked } = await resolveDeposit(s.booking_id);
    let glPosted = false;
    if (glBacked > 0) {
      const entry = await postEntry({
        postingKey,
        entryDate: new Date().toISOString().slice(0, 10),
        description: `Deposit settlement ${s.settlement_ref}`,
        sourceType: ENTITY,
        sourceId: id,
        currency: s.currency,
        lines: [
          { account_code: ACCOUNTS.DEPOSIT_HELD.code, account_name: ACCOUNTS.DEPOSIT_HELD.name, debit: totals.deposit_held, credit: 0 },
          { account_code: ACCOUNTS.CASH.code, account_name: ACCOUNTS.CASH.name, debit: 0, credit: totals.refund_amount },
          { account_code: ACCOUNTS.REVENUE.code, account_name: ACCOUNTS.REVENUE.name, debit: 0, credit: totals.total_deducted },
        ],
      });
      glPosted = !!entry;
    }
    const audit = Array.isArray(s.audit_trail) ? s.audit_trail : [];
    await db.update(depositSettlementsTable).set({
      status: "finalized",
      finalized_at: new Date(),
      posting_key: glPosted ? postingKey : null,
      audit_trail: [...audit, { event: "finalized", at: new Date().toISOString(), actor: (req as any).user?.id ?? null, refund: totals.refund_amount, deducted: totals.total_deducted, gl_posted: glPosted, gl_backed: glBacked }],
    }).where(eq(depositSettlementsTable.id, id));
    void logAction({ entityType: ENTITY, entityId: id, action: "PAYMENT", actorId: (req as any).user?.id ?? null, newValue: { status: "finalized", refund: totals.refund_amount, deducted: totals.total_deducted, gl_posted: glPosted } });
    res.json({ success: true, data: await loadSettlementDetail(id) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

/* ═══════════════════════════════════════════════════════════
   GUEST ROUTER
═══════════════════════════════════════════════════════════ */
const guestRouter: IRouter = Router();
guestRouter.use("/v1/guest", requireGuestAuth);

async function guestOwnsBooking(guestAccountId: number | null, bookingId: number): Promise<boolean> {
  if (!guestAccountId) return false;
  const [row] = await db
    .select({ id: bookingsTable.id })
    .from(bookingsTable)
    .where(and(eq(bookingsTable.id, bookingId), eq(bookingsTable.account_id, guestAccountId)))
    .limit(1);
  return !!row;
}

guestRouter.get("/v1/guest/bookings/:bookingId/deposit-settlements", async (req, res): Promise<void> => {
  try {
    const guest = (req as any).guest;
    const bookingId = Number(req.params.bookingId);
    if (!(await guestOwnsBooking(guest?.account_id ?? null, bookingId))) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Booking not found" } }); return; }
    const rows = await db
      .select()
      .from(depositSettlementsTable)
      .where(eq(depositSettlementsTable.booking_id, bookingId))
      .orderBy(desc(depositSettlementsTable.created_at));
    // Hide drafts from tenants.
    const visible = rows.filter((r) => r.status !== "draft");
    const withDeductions = await Promise.all(visible.map((r) => loadSettlementDetail(r.id)));
    res.json({ success: true, data: withDeductions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// Tenant acknowledges the proposed settlement.
guestRouter.post("/v1/guest/deposit-settlements/:id/acknowledge", async (req, res): Promise<void> => {
  try {
    const guest = (req as any).guest;
    const id = Number(req.params.id);
    const [s] = await db.select().from(depositSettlementsTable).where(eq(depositSettlementsTable.id, id)).limit(1);
    if (!s || !(await guestOwnsBooking(guest?.account_id ?? null, s.booking_id))) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Settlement not found" } }); return; }
    if (s.status !== "proposed") { res.status(409).json({ success: false, error: { code: "NOT_OPEN", message: "Settlement is not awaiting acknowledgement" } }); return; }
    const audit = Array.isArray(s.audit_trail) ? s.audit_trail : [];
    await db.update(depositSettlementsTable).set({ status: "tenant_ack", tenant_ack_at: new Date(), audit_trail: [...audit, { event: "tenant_ack", at: new Date().toISOString() }] }).where(eq(depositSettlementsTable.id, id));
    res.json({ success: true, data: await loadSettlementDetail(id) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

export { adminRouter as depositSettlementsAdminRouter, guestRouter as depositSettlementsGuestRouter };
