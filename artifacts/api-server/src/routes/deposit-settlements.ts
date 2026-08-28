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
  journalEntriesTable,
  journalLinesTable,
} from "@workspace/db";
import { getRateToAud } from "../lib/rateSnapshot";
import { requireAuth } from "../middlewares/requireAuth";
import { requireGuestAuth } from "../middlewares/requireGuestAuth";
import { logAction } from "../utils/auditLog";
import { postEntry, ACCOUNTS } from "../lib/billing/gl";
import { htmlToPdf, PdfUnavailableError } from "../lib/documents/pdf";
import { resolveDocFileName, setDocFileName } from "../lib/documents/docFileName";
import { resolveCompanyInfo, resolveLeasingContactPhone } from "../lib/documents/companyInfo";
import { formatDocMoney } from "../lib/documents/theme";
import { normalizeLang, t } from "../lib/documents/i18n";
import { resolveTemplateBody } from "../lib/documents/templateEngine";
import { buildMoveOutSettlementHtml, type MoveOutDocInput } from "../lib/documents/moveOutSettlementDocument";
import { createSigningRequest, signingBaseUrl } from "../services/contractSigning";
import { sendTenantLinkEmail } from "../lib/email";
import { contractSigningRequestsTable } from "@workspace/db";
import { inArray } from "drizzle-orm";

const ENTITY = "deposit_settlement";

/* ── 표준 서식 뼈대 ─────────────────────────────────────────────────────────
   종이 "퇴거 세대 정산 확인서" 2번 표는 항목이 정해져 있다. 확인서를 새로 뜨면
   그 여섯 줄을 0원으로 먼저 깔아 두고, 운영자가 금액만 채우거나 해당 없는 줄을
   지운다. 자동 추출 라인(보증금 차감 인보이스 등)은 그 뒤에 붙으므로 서식 순서가
   흐트러지지 않는다. */
const STANDARD_FORM_LINES: Array<{ description: string; kind: "deduct" | "refund"; remark: string }> = [
  { description: "미납 임대료", kind: "deduct", remark: "완납" },
  { description: "미납 관리비", kind: "deduct", remark: "당월 관리비 미납액 차감" },
  { description: "미납 가스비", kind: "deduct", remark: "가스회사 해지 신청 후 별도 납부 예정" },
  { description: "세대 내 하자복구비", kind: "deduct", remark: "퇴거 점검 완료 (하자 없음)" },
  { description: "입주/퇴거 청소비", kind: "deduct", remark: "보증금에서 차감" },
  { description: "장기수선충당금", kind: "refund", remark: "거주기간 적립금 임차인 환급(+)" },
];

async function seedStandardFormLines(settlementId: number): Promise<number> {
  await db.insert(depositDeductionItemsTable).values(
    STANDARD_FORM_LINES.map((l) => ({
      deposit_settlement_id: settlementId,
      description: l.description,
      amount: "0",
      kind: l.kind,
      remark: l.remark,
    })),
  );
  return STANDARD_FORM_LINES.length;
}

/** 라인의 구분 — 금액 부호가 정본이고, 0원일 때만 저장된 kind 가 의도를 말한다. */
function lineKind(row: { amount: string | number | null; kind?: string | null }): "deduct" | "refund" {
  const amount = Number(row.amount ?? 0);
  if (amount < 0) return "refund";
  if (amount > 0) return "deduct";
  return row.kind === "refund" ? "refund" : "deduct";
}

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
  return {
    ...s,
    deductions: deductions.map((d) => ({ ...d, kind: lineKind(d) })),
    net_amount: net,
    shortfall: net < 0 ? Math.abs(net) : 0,
  };
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

// 상세 응답 한 벌 — 확인서 1번 표(기본 임대차 정보)를 화면에서도 그대로 보여주려면
// 세대·임차인·계약기간이 필요하다. PDF 가 쓰는 조립기를 재사용해 두 출력이 갈라지지
// 않게 하고, GET 과 PATCH 가 같은 모양을 돌려주도록 여기 모아 둔다.
async function loadSettlementResponse(id: number) {
  const detail = await loadSettlementDetail(id);
  if (!detail) return null;
  const doc = await buildMoveOutDocInput(id);
  const form = doc && {
    unit: doc.unit,
    tenant_name: doc.tenant_name,
    contract_start: doc.contract_start,
    contract_end: doc.contract_end,
    monthly_rent: doc.monthly_rent,
    settlement_type: doc.settlement_type ?? null,
    as_of_date: doc.as_of_date,
  };
  return { ...detail, form: form ?? null };
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
    await seedStandardFormLines(row!.id);
    await recomputeTotals(row!.id);
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

    await seedStandardFormLines(row!.id);

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
    const id = Number(req.params.id);
    const data = await loadSettlementResponse(id);
    if (!data) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Settlement not found" } }); return; }
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// 확인서 헤더 편집 — 기준일자 / 정산구분 / 메모.
// 기준일자는 확인서가 "어느 날짜로 정산을 끊었는가"이지 서류를 만든 날이 아니고,
// 정산구분은 그 날짜와 계약 종료일의 자동 비교로 다 갈리지 않는다(합의해지 등).
// 그래서 둘 다 비워 두면 종전 자동 규칙, 값을 넣으면 그 값이 이긴다.
adminRouter.patch("/v1/deposit-settlements/:id", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const [s] = await db.select().from(depositSettlementsTable).where(eq(depositSettlementsTable.id, id)).limit(1);
    if (!s) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Settlement not found" } }); return; }
    if (s.status === "finalized") { res.status(409).json({ success: false, error: { code: "LOCKED", message: "Settlement is finalized" } }); return; }

    const patch: Record<string, unknown> = {};
    if (req.body?.as_of_date !== undefined) {
      const raw = req.body.as_of_date;
      if (raw === null || raw === "") {
        patch.as_of_date = null; // 자동 규칙으로 되돌린다.
      } else {
        const day = String(raw).slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(new Date(`${day}T00:00:00Z`).getTime())) {
          res.status(400).json({ success: false, error: { code: "BAD_DATE", message: "as_of_date must be YYYY-MM-DD" } }); return;
        }
        patch.as_of_date = day;
      }
    }
    if (req.body?.settlement_type !== undefined) {
      const raw = req.body.settlement_type;
      if (raw === null || raw === "" || raw === "auto") {
        patch.settlement_type = null;
      } else if (raw === "early" || raw === "expiry") {
        patch.settlement_type = raw;
      } else {
        res.status(400).json({ success: false, error: { code: "BAD_TYPE", message: "settlement_type must be early | expiry | null" } }); return;
      }
    }
    if (req.body?.notes !== undefined) {
      patch.notes = typeof req.body.notes === "string" && req.body.notes.trim() ? req.body.notes.trim() : null;
    }
    if (Object.keys(patch).length) {
      await db.update(depositSettlementsTable).set(patch).where(eq(depositSettlementsTable.id, id));
      void logAction({ entityType: ENTITY, entityId: id, action: "UPDATE", actorId: (req as any).user?.id ?? null, newValue: patch });
    }
    res.json({ success: true, data: await loadSettlementResponse(id) });
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
      // 0원 라인은 부호가 없으므로 구분을 따로 남겨야 서식에 차감/환급이 찍힌다.
      kind: kind ?? (amount < 0 ? "refund" : "deduct"),
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

    const [current] = await db.select().from(depositDeductionItemsTable)
      .where(and(eq(depositDeductionItemsTable.id, did), eq(depositDeductionItemsTable.deposit_settlement_id, id)))
      .limit(1);
    if (!current) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Deduction not found" } }); return; }

    const patch: Record<string, unknown> = {};
    if (typeof req.body?.description === "string" && req.body.description.trim()) patch.description = req.body.description.trim();
    if (req.body?.remark !== undefined) patch.remark = typeof req.body.remark === "string" && req.body.remark.trim() ? req.body.remark.trim() : null;
    // 구분과 금액은 한 몸이다: 저장되는 금액의 부호를 구분이 정하고(환급 = 음수),
    // 구분만 바뀌어도 기존 금액의 부호를 뒤집어야 합계 A 가 맞는다.
    if (req.body?.amount !== undefined || req.body?.kind !== undefined) {
      const raw = req.body?.amount !== undefined ? Number(req.body.amount) : Number(current.amount ?? 0);
      if (!Number.isFinite(raw)) { res.status(400).json({ success: false, error: { code: "BAD_AMOUNT", message: "amount must be a number" } }); return; }
      const kind: "deduct" | "refund" =
        req.body?.kind === "refund" ? "refund"
        : req.body?.kind === "deduct" ? "deduct"
        : lineKind(current);
      patch.amount = String(round2(kind === "refund" ? -Math.abs(raw) : Math.abs(raw)));
      patch.kind = kind;
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
    // 재수정(reopen)을 거친 확인서는 새 전표로 다시 전기되어야 한다. 첫 전기의 키는
    // 그대로 두고(기존 전표와의 멱등성 유지), 되돌린 횟수만큼 버전을 붙여 이전 키의
    // 멱등 반환에 걸려 "전기했다고 말하지만 전표는 없는" 상태가 되는 것을 막는다.
    const reopenCount = (Array.isArray(s.audit_trail) ? s.audit_trail : [])
      .filter((e: any) => e?.event === "reopened").length;
    const postingKey = reopenCount === 0 ? `deposit_settlement:${id}` : `deposit_settlement:${id}:v${reopenCount + 1}`;
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

/* ── 확정 취소(재수정) ───────────────────────────────────────────────────────
   확정된 확인서도 고쳐야 할 때가 있다 — 견적이 늦게 오거나 관리비 정산이 뒤에
   확정되는 일이 흔하다. 지우고 다시 만들면 확인서 번호가 바뀌므로, 상태만 draft 로
   되돌려 같은 번호로 이어 쓴다.

   전기된 전표가 있으면 지우지 않고 역분개를 하나 더 쌓는다(회계 원장은 append-only).
   재확정 때는 버전이 붙은 새 키로 다시 전기되므로 원장은 원전표 + 역분개 + 재전기가
   되어 최종 잔액이 맞는다. */
adminRouter.post("/v1/deposit-settlements/:id/reopen", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const [s] = await db.select().from(depositSettlementsTable).where(eq(depositSettlementsTable.id, id)).limit(1);
    if (!s) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Settlement not found" } }); return; }
    if (s.status !== "finalized") { res.status(409).json({ success: false, error: { code: "NOT_FINALIZED", message: "Only a finalized settlement can be reopened" } }); return; }

    let glReversed = false;
    if (s.posting_key) {
      const [entry] = await db.select().from(journalEntriesTable)
        .where(eq(journalEntriesTable.posting_key, s.posting_key)).limit(1);
      if (entry) {
        const lines = await db.select().from(journalLinesTable).where(eq(journalLinesTable.entry_id, entry.id));
        const reversal = await postEntry({
          postingKey: `${s.posting_key}:reversal`,
          entryDate: new Date().toISOString().slice(0, 10),
          description: `Deposit settlement ${s.settlement_ref} reopened (reversal)`,
          sourceType: ENTITY,
          sourceId: id,
          currency: entry.currency,
          // 차·대를 맞바꾼 역분개.
          lines: lines.map((l) => ({
            account_code: l.account_code,
            account_name: l.account_name,
            debit: Number(l.credit ?? 0),
            credit: Number(l.debit ?? 0),
          })),
        });
        glReversed = !!reversal;
      }
    }

    const audit = Array.isArray(s.audit_trail) ? s.audit_trail : [];
    await db.update(depositSettlementsTable).set({
      status: "draft",
      finalized_at: null,
      posting_key: null,
      audit_trail: [...audit, { event: "reopened", at: new Date().toISOString(), actor: (req as any).user?.id ?? null, gl_reversed: glReversed, reversed_key: s.posting_key ?? null }],
    }).where(eq(depositSettlementsTable.id, id));
    void logAction({ entityType: ENTITY, entityId: id, action: "STATUS_CHANGE", actorId: (req as any).user?.id ?? null, oldValue: { status: "finalized" }, newValue: { status: "draft", gl_reversed: glReversed } });
    res.json({ success: true, data: await loadSettlementDetail(id) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

// Assemble the move-out confirmation document input: settlement totals +
// deduction lines + the booking's household details (unit, tenant, contract
// period, rent) resolved from space / account / contract.
export async function buildMoveOutDocInput(id: number): Promise<MoveOutDocInput | null> {
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

  // 기준일자: 운영자가 직접 잡은 as_of_date 가 있으면 그것이 정본이고, 없을 때만
  // finalized_at ?? proposed_at ?? created_at 으로 폴백한다. 확인서를 만든 날과
  // 정산을 끊은 날은 같지 않다.
  const asOfRaw = detail.as_of_date ?? detail.finalized_at ?? detail.proposed_at ?? detail.created_at;
  // as_of_date 는 date 컬럼(문자열), 나머지는 timestamp(Date) — 어느 쪽이 와도
  // 달력 하루(YYYY-MM-DD)로 눌러 두면 이후 비교·출력이 갈라지지 않는다.
  const asOf = asOfRaw
    ? (typeof asOfRaw === "string" ? asOfRaw.slice(0, 10) : new Date(asOfRaw).toISOString().slice(0, 10))
    : null;

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
    const asOfDay = new Date(`${asOf}T00:00:00Z`).getTime();
    if (Number.isFinite(endDay) && Number.isFinite(asOfDay)) {
      settlementType = asOfDay < endDay ? "early" : "expiry";
    }
  }
  // 수동 지정이 자동 판정을 이긴다 — 계약 종료일이 비어 있거나 조기 합의해지처럼
  // 날짜만으로는 갈리지 않는 건이 있다.
  if (detail.settlement_type === "early" || detail.settlement_type === "expiry") {
    settlementType = detail.settlement_type;
  }

  return {
    settlement_ref: detail.settlement_ref,
    status: detail.status,
    as_of_date: asOf ? new Date(`${asOf}T00:00:00Z`).toISOString() : null,
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
    deductions: detail.deductions.map((d) => ({
      description: d.description,
      amount: Number(d.amount ?? 0),
      remark: d.remark ?? null,
      // 0원 라인은 부호가 없으므로 구분을 그대로 넘겨야 서식에 차감/환급이 찍힌다.
      kind: d.kind,
    })),
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
    // 연락처는 임대사무실 담당자(Settings → Organisation) — 회사 대표번호는
    // 그 값이 비었을 때만 쓴다. 통장 사본·열쇠 확인 사진을 받는 것은 사람이지
    // 대표번호가 아니다.
    docInput.contact_phone = docInput.contact_phone || (await resolveLeasingContactPhone());
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

/* ── 임차인 확인 서명 링크 ────────────────────────────────────────────────
   퇴거 정산은 종이 확인서에 도장을 받아 오는 것이 관행이었다. 세입자는 이미 짐을
   빼고 떠난 뒤이므로, 그 도장을 받으러 다시 만나는 일이 정산을 몇 주씩 미룬다.
   계약서·작업 확인서와 같은 전자서명 원장(`contract_signing_requests`)에
   context_type='deposit_settlement' 로 얹어, 링크 하나로 끝내게 한다. */

adminRouter.post("/v1/deposit-settlements/:id/sign-link", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const [row] = await db.select().from(depositSettlementsTable).where(eq(depositSettlementsTable.id, id)).limit(1);
    if (!row) { res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "정산을 찾을 수 없습니다." } }); return; }
    // 초안 상태로는 보내지 않는다 — 세입자가 확인할 금액이 아직 확정되지 않았다.
    if (row.status === "draft") {
      res.status(409).json({ success: false, error: { code: "NOT_PROPOSED", message: "먼저 정산안을 제안(proposed) 상태로 만들어 주세요." } });
      return;
    }

    const existing = await db.select().from(contractSigningRequestsTable)
      .where(and(
        eq(contractSigningRequestsTable.context_type, "deposit_settlement"),
        eq(contractSigningRequestsTable.context_id, id),
      ));
    if (existing.some((r) => r.status === "signed")) {
      res.status(409).json({ success: false, error: { code: "ALREADY_SIGNED", message: "이미 임차인 확인이 완료된 정산입니다." } });
      return;
    }
    const stale = existing.filter((r) => r.status === "pending").map((r) => r.id);
    if (stale.length) {
      await db.update(contractSigningRequestsTable)
        .set({ status: "cancelled", updated_at: new Date() })
        .where(inArray(contractSigningRequestsTable.id, stale));
    }

    const doc = await buildMoveOutDocInput(id);
    const tenant = await settlementTenant(row);
    const name = (typeof req.body?.signer_name === "string" && req.body.signer_name.trim())
      || doc?.tenant_name || tenant?.name || "임차인";
    const to = (typeof req.body?.to === "string" && req.body.to.trim()) || tenant?.email || "";
    const days = Number(req.body?.expiry_days);

    const signing = await createSigningRequest({
      contextType: "deposit_settlement",
      contextId: id,
      signers: [{ role: "tenant", name, email: to, required: true }],
      expiryDays: Number.isFinite(days) && days > 0 ? days : 14,
    });

    void logAction({
      entityType: ENTITY, entityId: id, action: "UPDATE",
      actorId: (req as any).user?.id ?? null,
      newValue: { sign_link_issued: signing.id, signer: name, expires_at: signing.expiresAt },
    });

    const url = `${signingBaseUrl()}/sign/${signing.token}`;
    let email: { ok: boolean; skipped?: boolean; error?: string } | null = null;
    if (req.body?.send_email) {
      email = to
        ? await sendTenantLinkEmail({
            kind: "settlement_sign",
            to, toName: name, url,
            ref: row.settlement_ref,
            unit: doc?.unit ?? null,
            amount: formatDocMoney(row.refund_amount, row.currency),
            expiresAt: signing.expiresAt,
            lang: typeof req.body?.lang === "string" ? req.body.lang : undefined,
          })
        : { ok: false, error: "NO_RECIPIENT" };
    }

    res.status(201).json({
      success: true,
      data: { id: signing.id, token: signing.token, url, signer_name: name, expires_at: signing.expiresAt },
      email,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: "SERVER_ERROR", message: err.message } });
  }
});

/** 이 정산에 달린 확인 서명 요청들 — 상세 화면이 상태·서명 정보를 그대로 그린다. */
adminRouter.get("/v1/deposit-settlements/:id/sign-link", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const rows = await db.select().from(contractSigningRequestsTable)
    .where(and(
      eq(contractSigningRequestsTable.context_type, "deposit_settlement"),
      eq(contractSigningRequestsTable.context_id, id),
    ))
    .orderBy(desc(contractSigningRequestsTable.id));
  const base = signingBaseUrl();
  res.json({
    success: true,
    data: rows.map(({ signed_snapshot, ...r }) => ({ ...r, url: `${base}/sign/${r.token}` })),
  });
});

/** 정산의 임차인 — 계약(장기) 또는 예약(단기) 어느 쪽에 매달렸든 한 명으로 좁힌다. */
async function settlementTenant(row: { contract_id: number | null; booking_id: number | null }): Promise<{ name: string | null; email: string | null } | null> {
  let accountId: number | null = null;
  if (row.contract_id) {
    const [c] = await db.select({ acc: contractsTable.tenant_account_id }).from(contractsTable)
      .where(eq(contractsTable.id, row.contract_id)).limit(1);
    accountId = c?.acc ?? null;
  } else if (row.booking_id) {
    const [b] = await db.select({ acc: bookingsTable.account_id }).from(bookingsTable)
      .where(eq(bookingsTable.id, row.booking_id)).limit(1);
    accountId = b?.acc ?? null;
  }
  if (!accountId) return null;
  const [acc] = await db.select({ name: accountsTable.name, email: accountsTable.account_email })
    .from(accountsTable).where(eq(accountsTable.id, accountId)).limit(1);
  return acc ? { name: acc.name ?? null, email: acc.email ?? null } : null;
}

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
