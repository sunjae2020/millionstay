import { Router, type IRouter } from "express";
import { DEFAULT_CURRENCY } from "../lib/currency";
import { eq, and, desc, sql, isNull, ilike } from "drizzle-orm";
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
  spacesTable,
  accountsTable,
} from "@workspace/db";
import { getRateToAud } from "../lib/rateSnapshot";
import { requireAuth } from "../middlewares/requireAuth";
import { requireGuestAuth } from "../middlewares/requireGuestAuth";
import { logAction } from "../utils/auditLog";
import { postEntry, ACCOUNTS } from "../lib/billing/gl";
import { htmlToPdf, PdfUnavailableError } from "../lib/documents/pdf";
import { resolveDocFileName, setDocFileName } from "../lib/documents/docFileName";
import { resolveCompanyInfo } from "../lib/documents/companyInfo";
import { formatDocMoney } from "../lib/documents/theme";
import { normalizeLang, t } from "../lib/documents/i18n";
import { resolveTemplateBody } from "../lib/documents/templateEngine";
import { buildMoveOutSettlementHtml, type MoveOutDocInput } from "../lib/documents/moveOutSettlementDocument";

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
export type DepositSource = "invoice" | "placement" | "contract" | "booking" | "manual";

async function resolveDeposit(bookingId: number): Promise<{ total: number; glBacked: number; source: DepositSource }> {
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
  if (glBacked > 0) return { total: glBacked, glBacked, source: invoiceDeposit > 0 ? "invoice" : "placement" };

  // Fallback: contract bond (latest non-zero for this booking).
  const contracts = await db
    .select({ bond: contractsTable.bond_amount })
    .from(contractsTable)
    .where(eq(contractsTable.booking_id, bookingId))
    .orderBy(desc(contractsTable.id));
  const bond = contracts.map((c) => Number(c.bond ?? 0)).find((n) => n > 0) ?? 0;
  if (bond > 0) return { total: round2(bond), glBacked: 0, source: "contract" };

  // Fallback: homestay placement deposit.
  const placements = await db
    .select({ deposit: homestayPlacementsTable.deposit })
    .from(homestayPlacementsTable)
    .where(eq(homestayPlacementsTable.booking_id, bookingId))
    .orderBy(desc(homestayPlacementsTable.id));
  const dep = placements.map((p) => Number(p.deposit ?? 0)).find((n) => n > 0) ?? 0;
  return { total: round2(dep), glBacked: 0, source: "placement" };
}

// Resolve the deposit a LEASE (contract spine) is holding. Same rule as the
// booking side: an actually-paid deposit beats the contractual figure, so a
// settlement never refunds money that was never received and finalize only
// releases what is really sitting in Deposits Held (2100).
async function resolveContractDeposit(contractId: number): Promise<{ total: number; glBacked: number; source: DepositSource }> {
  const lines = await db
    .select({ total: invoiceLineItemsTable.total_amount })
    .from(invoiceLineItemsTable)
    .innerJoin(invoicesTable, eq(invoiceLineItemsTable.invoice_id, invoicesTable.id))
    .where(and(
      eq(invoicesTable.contract_id, contractId),
      eq(invoicesTable.status, "Paid"),
      isNull(invoicesTable.deleted_at),
      eq(invoiceLineItemsTable.line_type, "deposit"),
    ));
  const paid = round2(lines.reduce((sum, r) => sum + Number(r.total ?? 0), 0));
  if (paid > 0) return { total: paid, glBacked: paid, source: "invoice" };

  const [contract] = await db
    .select({ bond: contractsTable.bond_amount })
    .from(contractsTable)
    .where(eq(contractsTable.id, contractId))
    .limit(1);
  return { total: round2(Number(contract?.bond ?? 0)), glBacked: 0, source: "contract" };
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
  // C(최종 반환 차액) = B − A, 부호 있는 값. `refund_amount` 는 clamp 된 현금
  // 환급액(음수가 되면 GL 상계가 뒤집히므로)이고, 확인서가 찍는 값은 net_amount,
  // 차감이 보증금을 넘은 부족분은 shortfall — 인보이스로 회수할 금액이다.
  const net = round2(Number(s.deposit_held ?? 0) - Number(s.total_deducted ?? 0));
  return { ...s, deductions, net_amount: net, shortfall: net < 0 ? Math.abs(net) : 0 };
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

    const { total: depositHeld, source: depositSource } = await resolveDeposit(bookingId);
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
        currency: (booking as any).currency ?? DEFAULT_CURRENCY,
        deposit_source: depositSource,
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

/* ── Contract-based settlements (Korean monthly lease, no booking spine) ──────
   The lease's 보증금 is contracts.bond_amount, and any month settled out of the
   deposit is an invoice carrying payment_method='보증금 차감'. Drafting a settlement
   snapshots the deposit and turns each of those months into a deduction line, so
   the move-out 정산서 reflects what the rent ledger already recorded. Draft only —
   GL release on finalize stays booking-backed (a lease deposit is not yet posted
   to Deposits Held 2100). */
adminRouter.get("/v1/contracts/:contractId/deposit-settlements", async (req, res): Promise<void> => {
  try {
    const contractId = Number(req.params.contractId);
    const rows = await db.select().from(depositSettlementsTable)
      .where(eq(depositSettlementsTable.contract_id, contractId))
      .orderBy(desc(depositSettlementsTable.created_at));
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

adminRouter.post("/v1/contracts/:contractId/deposit-settlements", async (req, res): Promise<void> => {
  try {
    const contractId = Number(req.params.contractId);
    const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.id, contractId)).limit(1);
    if (!contract) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Contract not found" } }); return; }

    const { total: depositHeld, source: depositSource } = await resolveContractDeposit(contractId);
    // Pair the statement with the lease's 퇴거 점검표 (one per contract): the two
    // are issued as a set, and the checklist carries the handover details the
    // form quotes (현관 비밀번호 etc.).
    const [inspection] = await db
      .select({ id: conditionReportsTable.id })
      .from(conditionReportsTable)
      .where(eq(conditionReportsTable.contract_id, contractId))
      .orderBy(desc(conditionReportsTable.created_at))
      .limit(1);
    const settlement_ref = await generateSettlementRef();
    const [row] = await db.insert(depositSettlementsTable).values({
      settlement_ref,
      booking_id: contract.booking_id ?? null,
      contract_id: contractId,
      move_out_report_id: inspection?.id ?? null,
      status: "draft",
      deposit_held: String(round2(depositHeld)),
      refund_amount: String(round2(depositHeld)),
      currency: contract.currency ?? DEFAULT_CURRENCY,
      deposit_source: depositSource,
      notes: typeof req.body?.notes === "string" ? req.body.notes : null,
      created_by: (req as any).user?.id ?? null,
      audit_trail: [{ event: "created", at: new Date().toISOString(), actor: (req as any).user?.id ?? null, deposit_held: depositHeld, deposit_source: depositSource, source: "contract" }],
    }).returning();

    // Rent months already settled out of the deposit become deduction lines.
    const deducted = await db.select({
      id: invoicesTable.id,
      invoice_ref: invoicesTable.invoice_ref,
      amount: invoicesTable.amount,
      description: invoicesTable.description,
      due_date: invoicesTable.due_date,
    })
      .from(invoicesTable)
      .where(and(
        eq(invoicesTable.contract_id, contractId),
        isNull(invoicesTable.deleted_at),
        eq(invoicesTable.payment_method, "보증금 차감"),
      ));
    for (const inv of deducted) {
      await db.insert(depositDeductionItemsTable).values({
        deposit_settlement_id: row!.id,
        description: `${inv.description ?? inv.invoice_ref}${inv.due_date ? ` (${inv.due_date})` : ""}`,
        amount: String(round2(Number(inv.amount ?? 0))),
        remark: inv.invoice_ref,
      });
    }
    const totals = await recomputeTotals(row!.id);

    void logAction({ entityType: ENTITY, entityId: row!.id, action: "CREATE", actorId: (req as any).user?.id ?? null, newValue: { settlement_ref, contract_id: contractId, deposit_held: depositHeld, deductions: deducted.length } });
    res.status(201).json({ success: true, data: { ...row, ...totals, deductions: deducted.length } });
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
    // A line is signed: positive deducts from the deposit (차감(−)), negative
    // refunds the tenant (환급(+), e.g. 장기수선충당금). `kind` is the friendly
    // form the admin UI posts; a raw signed `amount` works too.
    const rawAmount = Number(req.body?.amount);
    if (!Number.isFinite(rawAmount)) { res.status(400).json({ success: false, error: { code: "BAD_AMOUNT", message: "amount must be a number" } }); return; }
    const kind = req.body?.kind === "refund" ? "refund" : req.body?.kind === "deduct" ? "deduct" : null;
    const amount = kind ? (kind === "refund" ? -Math.abs(rawAmount) : Math.abs(rawAmount)) : rawAmount;
    await db.insert(depositDeductionItemsTable).values({
      deposit_settlement_id: id,
      condition_item_id: Number.isFinite(Number(req.body?.condition_item_id)) && req.body?.condition_item_id ? Number(req.body.condition_item_id) : null,
      description: typeof req.body?.description === "string" && req.body.description.trim() ? req.body.description.trim() : "Deduction",
      amount: String(round2(amount)),
      remark: typeof req.body?.remark === "string" && req.body.remark.trim() ? req.body.remark.trim() : null,
      photo_ids: Array.isArray(req.body?.photo_ids) ? req.body.photo_ids : [],
    });
    await recomputeTotals(id);
    res.status(201).json({ success: true, data: await loadSettlementDetail(id) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// Edit a settlement line (draft/proposed only) — description, signed amount or
// the 비고 text, without dropping the condition-evidence link the row carries.
adminRouter.patch("/v1/deposit-settlements/:id/deductions/:did", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const did = Number(req.params.did);
    const [s] = await db.select().from(depositSettlementsTable).where(eq(depositSettlementsTable.id, id)).limit(1);
    if (!s) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Settlement not found" } }); return; }
    if (!["draft", "proposed"].includes(s.status)) { res.status(409).json({ success: false, error: { code: "LOCKED", message: "Settlement is finalized" } }); return; }

    const patch: Record<string, unknown> = {};
    if (typeof req.body?.description === "string" && req.body.description.trim()) patch.description = req.body.description.trim();
    if (req.body?.remark !== undefined) patch.remark = typeof req.body.remark === "string" && req.body.remark.trim() ? req.body.remark.trim() : null;
    if (req.body?.amount !== undefined) {
      const raw = Number(req.body.amount);
      if (!Number.isFinite(raw)) { res.status(400).json({ success: false, error: { code: "BAD_AMOUNT", message: "amount must be a number" } }); return; }
      const kind = req.body?.kind === "refund" ? "refund" : req.body?.kind === "deduct" ? "deduct" : null;
      patch.amount = String(round2(kind ? (kind === "refund" ? -Math.abs(raw) : Math.abs(raw)) : raw));
    }
    if (!Object.keys(patch).length) { res.status(400).json({ success: false, error: { code: "NO_FIELDS", message: "Nothing to update" } }); return; }

    await db.update(depositDeductionItemsTable).set(patch)
      .where(and(eq(depositDeductionItemsTable.id, did), eq(depositDeductionItemsTable.deposit_settlement_id, id)));
    await recomputeTotals(id);
    res.json({ success: true, data: await loadSettlementDetail(id) });
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
    // A lease settlement is GL-backed only when the deposit was actually invoiced
    // and paid as a line_type='deposit' line; a bare contracts.bond_amount never
    // reached 2100, so there is nothing to release.
    const { glBacked } = s.booking_id
      ? await resolveDeposit(s.booking_id)
      : s.contract_id
        ? await resolveContractDeposit(s.contract_id)
        : { glBacked: 0 };
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
          // 차감이 보증금을 넘으면 초과분은 보증금에서 나올 수 없다 — 초과분은 회수
          // 인보이스(Dr AR / Cr Revenue)가 잡으므로 여기서는 보유액을 넘지 않는
          // 몰취분만 수익으로 돌린다. 그래야 차·대변이 맞는다.
          { account_code: ACCOUNTS.REVENUE.code, account_name: ACCOUNTS.REVENUE.name, debit: 0, credit: round2(totals.deposit_held - totals.refund_amount) },
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

// Assemble the move-out confirmation document input: settlement totals +
// deduction lines + the booking's household details (unit, tenant, contract
// period, rent) resolved from space / account / contract.
async function buildMoveOutDocInput(id: number): Promise<MoveOutDocInput | null> {
  const detail = await loadSettlementDetail(id);
  if (!detail) return null;

  const [booking] = detail.booking_id
    ? await db.select().from(bookingsTable).where(eq(bookingsTable.id, detail.booking_id)).limit(1)
    : [undefined as any];

  let unit: string | null = null;
  let spaceRent: number | null = null;
  if (booking?.space_id) {
    const [space] = await db
      .select({ name: spacesTable.name, monthly_rent: spacesTable.monthly_rent })
      .from(spacesTable)
      .where(eq(spacesTable.id, booking.space_id))
      .limit(1);
    unit = space?.name ?? null;
    spaceRent = space?.monthly_rent ?? null;
  }

  let tenantName: string | null = booking?.name ?? null;
  if (booking?.account_id) {
    const [account] = await db
      .select({ name: accountsTable.name })
      .from(accountsTable)
      .where(eq(accountsTable.id, booking.account_id))
      .limit(1);
    if (account?.name) tenantName = account.name;
  }

  // Contract period: the settlement's own lease when contract-backed, else the
  // latest contract on the booking.
  const contractCols = {
    start: contractsTable.start_date, end: contractsTable.end_date,
    monthly_rent: contractsTable.monthly_rent,
    space_id: contractsTable.space_id, tenant_account_id: contractsTable.tenant_account_id,
  };
  const [contract] = detail.contract_id
    ? await db.select(contractCols).from(contractsTable).where(eq(contractsTable.id, detail.contract_id)).limit(1)
    : detail.booking_id
      ? await db.select(contractCols).from(contractsTable)
          .where(eq(contractsTable.booking_id, detail.booking_id))
          .orderBy(desc(contractsTable.id)).limit(1)
      : [undefined as any];

  // A lease settlement has no booking, so unit/tenant come off the contract.
  if (!unit && contract?.space_id) {
    const [space] = await db
      .select({ name: spacesTable.name, monthly_rent: spacesTable.monthly_rent })
      .from(spacesTable).where(eq(spacesTable.id, contract.space_id)).limit(1);
    unit = space?.name ?? null;
    spaceRent = spaceRent ?? space?.monthly_rent ?? null;
  }
  if (!tenantName && contract?.tenant_account_id) {
    const [account] = await db
      .select({ name: accountsTable.name })
      .from(accountsTable).where(eq(accountsTable.id, contract.tenant_account_id)).limit(1);
    tenantName = account?.name ?? null;
  }

  const asOf = detail.finalized_at ?? detail.proposed_at ?? detail.created_at;

  // 현관 비밀번호: recorded on the linked 퇴거 점검표 (condition_reports.meta.
  // door_password) — the checklist is where the handover details are captured,
  // so the settlement form quotes it instead of duplicating the field.
  let doorPassword: string | null = null;
  if (detail.move_out_report_id) {
    const [rep] = await db
      .select({ meta: conditionReportsTable.meta })
      .from(conditionReportsTable)
      .where(eq(conditionReportsTable.id, detail.move_out_report_id))
      .limit(1);
    const pin = (rep?.meta as Record<string, unknown> | null)?.door_password;
    if (typeof pin === "string" && pin.trim()) doorPassword = pin.trim();
  }

  // 정산구분: settled before the lease end date = 중도퇴거(early), otherwise 만기퇴거.
  // Unknown end date leaves both boxes unmarked on the form.
  const contractEnd = contract?.end ?? booking?.check_out_date ?? null;
  let settlementType: "early" | "expiry" | null = null;
  if (contractEnd && asOf) {
    const endDay = new Date(`${String(contractEnd).slice(0, 10)}T00:00:00Z`).getTime();
    const asOfDay = new Date(`${new Date(asOf).toISOString().slice(0, 10)}T00:00:00Z`).getTime();
    if (Number.isFinite(endDay) && Number.isFinite(asOfDay)) {
      settlementType = asOfDay < endDay ? "early" : "expiry";
    }
  }

  return {
    settlement_ref: detail.settlement_ref,
    status: detail.status,
    as_of_date: asOf ? new Date(asOf).toISOString() : null,
    currency: detail.currency,
    unit,
    tenant_name: tenantName,
    contract_start: contract?.start ?? booking?.check_in_date ?? null,
    contract_end: contract?.end ?? booking?.check_out_date ?? null,
    // 임대료(월)는 계약서가 정본 — 세대(spaces)의 기준 임대료는 계약에 값이
    // 없을 때만 쓴다.
    monthly_rent: contract?.monthly_rent ?? spaceRent ?? null,
    deposit_held: Number(detail.deposit_held ?? 0),
    total_deducted: Number(detail.total_deducted ?? 0),
    // C = B + A, 부호 있는 값. 차감이 보증금을 넘으면 마이너스로 찍혀 임차인이 더
    // 내야 할 금액이 확인서에 그대로 드러난다(회수는 인보이스로).
    refund_amount: Number(detail.net_amount ?? detail.refund_amount ?? 0),
    settlement_type: settlementType,
    door_password: doorPassword,
    // A negative amount is a refund line (환급(+)); positive is a deduction (차감(−)).
    deductions: detail.deductions.map((d) => ({ description: d.description, amount: Number(d.amount ?? 0), remark: d.remark ?? null })),
  };
}

/* ── C < 0 → 회수 인보이스 ───────────────────────────────────────────────────
   확인서는 청구서가 아니다: 보증금은 매출이 아니라 부채(2100)이고, 확인서 한 장에
   차감(−)과 환급(+)이 섞인다. 그래서 실제로 돈을 받아야 하는 순간 — 차감이 보증금을
   넘어 임차인에게 청구할 잔액이 생길 때 — 만 인보이스를 뽑는다. 인보이스는 일반 청구
   흐름(Draft → Paid → Dr Cash / Cr Revenue)을 그대로 타고, finalize 의 수익 인식은
   보유 보증금 한도로 잘려 있으므로 이중계상은 없다. */
async function nextRecoveryInvoiceRef(): Promise<string> {
  const year = new Date().getFullYear();
  const rows = await db.select({ id: invoicesTable.id }).from(invoicesTable)
    .where(ilike(invoicesTable.invoice_ref, `MS-INV-${year}-%`));
  return `MS-INV-${year}-${String(rows.length + 1).padStart(5, "0")}`;
}

adminRouter.post("/v1/deposit-settlements/:id/invoice", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const detail = await loadSettlementDetail(id);
    if (!detail) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Settlement not found" } }); return; }
    if (detail.invoice_id) {
      res.status(409).json({ success: false, error: { code: "ALREADY_INVOICED", message: "This settlement already has a recovery invoice" } });
      return;
    }
    const shortfall = round2(Number(detail.shortfall ?? 0));
    if (shortfall <= 0) {
      res.status(400).json({ success: false, error: { code: "NO_SHORTFALL", message: "The deposit covers the deductions — nothing to invoice" } });
      return;
    }

    let accountId: number | null = null;
    if (detail.contract_id) {
      const [c] = await db.select({ account_id: contractsTable.tenant_account_id })
        .from(contractsTable).where(eq(contractsTable.id, detail.contract_id)).limit(1);
      accountId = c?.account_id ?? null;
    }
    if (!accountId && detail.booking_id) {
      const [b] = await db.select({ account_id: bookingsTable.account_id })
        .from(bookingsTable).where(eq(bookingsTable.id, detail.booking_id)).limit(1);
      accountId = b?.account_id ?? null;
    }

    const invoice_ref = await nextRecoveryInvoiceRef();
    const dueDate = typeof req.body?.due_date === "string" && req.body.due_date.trim()
      ? req.body.due_date.trim()
      : new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10);
    const [invoice] = await db.insert(invoicesTable).values({
      invoice_ref,
      booking_id: detail.booking_id ?? null,
      contract_id: detail.contract_id ?? null,
      account_id: accountId,
      amount: String(shortfall),
      currency: detail.currency,
      exchange_rate_to_aud: await getRateToAud(detail.currency),
      status: "Draft",
      due_date: dueDate,
      description: `퇴거 정산 차액 (${detail.settlement_ref})`,
      notes: `보증금 ${detail.deposit_held} − 차감 ${detail.total_deducted} = 부족분 ${shortfall}`,
    }).returning();

    // 확인서의 차감 라인을 청구 내역으로 옮기되, 보증금으로 이미 상계된 만큼은 한 줄로
    // 빼서 합계가 부족분과 정확히 맞게 한다.
    const positives = detail.deductions.filter((d) => Number(d.amount ?? 0) > 0);
    const lineRows = positives.map((d, idx) => ({
      invoice_id: invoice!.id,
      label: d.description,
      description: d.remark ?? null,
      quantity: "1",
      unit_amount: String(round2(Number(d.amount ?? 0))),
      total_amount: String(round2(Number(d.amount ?? 0))),
      line_type: "revenue",
      sort_order: idx,
    }));
    const offset = round2(positives.reduce((sum, d) => sum + Number(d.amount ?? 0), 0) - shortfall);
    if (offset > 0) {
      lineRows.push({
        invoice_id: invoice!.id,
        label: `보증금 상계 (${detail.settlement_ref})`,
        description: null,
        quantity: "1",
        unit_amount: String(-offset),
        total_amount: String(-offset),
        line_type: "revenue",
        sort_order: lineRows.length,
      });
    }
    if (lineRows.length) await db.insert(invoiceLineItemsTable).values(lineRows);

    const audit = Array.isArray(detail.audit_trail) ? detail.audit_trail : [];
    await db.update(depositSettlementsTable).set({
      invoice_id: invoice!.id,
      audit_trail: [...audit, { event: "invoiced", at: new Date().toISOString(), actor: (req as any).user?.id ?? null, invoice_id: invoice!.id, invoice_ref, amount: shortfall }],
    }).where(eq(depositSettlementsTable.id, id));

    void logAction({ entityType: ENTITY, entityId: id, action: "CREATE", actorId: (req as any).user?.id ?? null, newValue: { invoice_id: invoice!.id, invoice_ref, amount: shortfall } });
    res.status(201).json({ success: true, data: { settlement: await loadSettlementDetail(id), invoice } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// Render the move-out confirmation ("퇴거 세대 확인서") as a branded document.
//   GET /v1/deposit-settlements/:id/document.pdf               → application/pdf
//   GET /v1/deposit-settlements/:id/document.pdf?format=html   → HTML preview
adminRouter.get("/v1/deposit-settlements/:id/document.pdf", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
    const docInput = await buildMoveOutDocInput(id);
    if (!docInput) { res.status(404).json({ error: "Settlement not found" }); return; }

    const asHtml = req.query.format === "html";
    const lang = normalizeLang(req.query.lang as string);
    // The section-3 guidance is editable standard copy (Settings → 문서 템플릿).
    // Its variables are filled from this settlement so the template stays generic:
    // 차액 C, the office contact and the door PIN captured on the 퇴거 점검표.
    const company = await resolveCompanyInfo(lang);
    const note = await resolveTemplateBody("pdf", "pdf.move_out_confirmation", lang, {
      ref: docInput.settlement_ref,
      refund_amount: formatDocMoney(docInput.refund_amount, docInput.currency),
      deposit_amount: formatDocMoney(docInput.deposit_held, docInput.currency),
      contact_phone: (docInput.contact_phone || company.phone || "").trim(),
      door_password: (docInput.door_password || "").trim() || "____",
      unit: docInput.unit ?? "",
      tenant_name: docInput.tenant_name ?? "",
    });
    const html = buildMoveOutSettlementHtml(docInput, company, !asHtml, lang, note);

    if (asHtml) { res.type("html").send(html); return; }
    const pdf = await htmlToPdf(html);
    res.setHeader("Content-Type", "application/pdf");
    setDocFileName(res, await resolveDocFileName({
      kind: "settlement",
      entityType: "deposit_settlement",
      entityId: id,
      party: [docInput.tenant_name, docInput.unit],
      org: [docInput.tenant_name],
      issueDate: docInput.as_of_date,
    }));
    res.setHeader("Content-Length", String(pdf.length));
    res.send(pdf);
  } catch (err: any) {
    if (err instanceof PdfUnavailableError) { res.status(503).json({ error: err.message }); return; }
    console.error("[deposit-settlements] PDF generation failed:", err);
    res.status(500).json({ error: "Failed to generate PDF" });
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
    if (!s || s.booking_id == null || !(await guestOwnsBooking(guest?.account_id ?? null, s.booking_id))) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Settlement not found" } }); return; }
    if (s.status !== "proposed") { res.status(409).json({ success: false, error: { code: "NOT_OPEN", message: "Settlement is not awaiting acknowledgement" } }); return; }
    const audit = Array.isArray(s.audit_trail) ? s.audit_trail : [];
    await db.update(depositSettlementsTable).set({ status: "tenant_ack", tenant_ack_at: new Date(), audit_trail: [...audit, { event: "tenant_ack", at: new Date().toISOString() }] }).where(eq(depositSettlementsTable.id, id));
    res.json({ success: true, data: await loadSettlementDetail(id) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

export { adminRouter as depositSettlementsAdminRouter, guestRouter as depositSettlementsGuestRouter };
