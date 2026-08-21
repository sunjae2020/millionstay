import { Router } from "express";
import { DEFAULT_CURRENCY } from "../lib/currency";
import { db, invoicesTable, invoiceLineItemsTable, bookingsTable, contractsTable, accountsTable, emailLogsTable, paymentInfoTable } from "@workspace/db";
import { eq, ilike, and, asc, isNull, inArray } from "drizzle-orm";
import { z } from "zod";
import { logAction } from "../utils/auditLog";
import { keywordCondition, accountIdsByName, dateRangeConditions, yearConditions, distinctYears, columnMatches } from "../lib/listSearch";
import { getRateToAud } from "../lib/rateSnapshot";
import { buildInvoiceHtml, type InvoiceDocInput } from "../lib/documents/invoiceDocument";
import { buildReceiptHtml } from "../lib/documents/receiptDocument";
import { htmlToPdf, PdfUnavailableError } from "../lib/documents/pdf";
import { resolveCompanyInfo, resolveIssuerCountry } from "../lib/documents/companyInfo";
import { normalizeLang, t, type DocLang } from "../lib/documents/i18n";
import { resolveTemplateBody } from "../lib/documents/templateEngine";
import { freezeDocument, snapshotDocType } from "../lib/documents/freeze";
import { formatDocMoney } from "../lib/documents/theme";
import { sendDocumentEmail, resolveDocEmailCopy } from "../lib/email";
import { accountRecipients, contractPartyRecipients, parseRecipients, toRecipientsResponse } from "../lib/documents/recipients";
import { resolveDocFileName, setDocFileName } from "../lib/documents/docFileName";
import { formatPostalAddress } from "@workspace/address";
import { getStripe } from "./stripe";
import { postInvoicePaid, postInvoiceIssued } from "../lib/billing/gl";
import { generateSettlementsForInvoice } from "../lib/billing/payout";
import { generateConsolidatedInvoices } from "../lib/billing/consolidatedInvoices";
import { deletedFilter, makeBulkDelete, makeBulkRestore } from "../lib/softDelete";
import {
  CreateInvoiceBody,
  UpdateInvoiceBody,
  PayInvoiceBody,
} from "@workspace/api-zod";

import { insertInvoiceWithRef } from "../lib/billing/invoiceRef";

const router = Router();

/**
 * Optional itemised line items accepted on invoice create/update. When present
 * and non-empty, they drive the stored invoice `amount` and the itemised PDF
 * rendering. Money fields are stored as strings (numeric columns).
 */
const LineItemInput = z.object({
  label: z.string().min(1),
  description: z.string().nullish(),
  quantity: z.number().positive().optional(),
  unit_amount: z.number(),
  // "revenue" (default) posts to GL Revenue; "deposit" posts to the Deposits Held
  // (2100) liability on payment so refundable deposits are never booked as income.
  line_type: z.enum(["revenue", "deposit"]).optional(),
  // 이 줄이 커버하는 기간. 일할계산(프로라타) 줄은 여기에 실제 사용 구간이 들어가고
  // (예: 이월분 2026-07-25 ~ 2026-07-31), 청구서 문서·포털이 기간을 함께 보여준다.
  period_start: z.string().nullish(),
  period_end: z.string().nullish(),
  // 어느 호실·계약분인지. 통합 청구서처럼 여러 계약이 한 장에 실릴 때 필요하다.
  space_id: z.number().int().positive().nullish(),
  contract_id: z.number().int().positive().nullish(),
  charge_kind: z.enum(["rent", "vat", "deposit", "other"]).optional(),
});
type LineItemInput = z.infer<typeof LineItemInput>;
const LineItemsBody = z.object({ line_items: z.array(LineItemInput).optional() });

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * 부가세 입력. `amount`(공급가액)는 그대로 두고 세액만 따로 계산해 담는다 —
 * 매출·정산·커미션이 모두 공급가액 기준이라 세액을 섞으면 전부 부풀려진다.
 */
const TaxBody = z.object({
  tax_mode: z.enum(["none", "exclusive"]).optional(),
  tax_rate: z.number().min(0).max(100).optional(),
});

/** 소수점 없는 통화(KRW·JPY)는 세액도 정수로 끊는다(35만 × 10% = 35,000). */
function roundTax(amount: number, currency: string): number {
  return currency === "KRW" || currency === "JPY" ? Math.round(amount) : round2(amount);
}

/** 공급가액과 과세 설정으로 세액을 계산한다. 면세면 0. */
export function computeTax(supply: number, mode: string, rate: number, currency: string): number {
  if (mode !== "exclusive" || !(rate > 0)) return 0;
  return roundTax(supply * rate / 100, currency);
}

/** Map validated line-item inputs to insert rows for a given invoice. */
function buildLineItemRows(invoiceId: number, items: LineItemInput[]) {
  return items.map((it, idx) => {
    const qty = it.quantity ?? 1;
    return {
      invoice_id: invoiceId,
      label: it.label,
      description: it.description ?? null,
      quantity: String(qty),
      unit_amount: String(it.unit_amount),
      total_amount: String(round2(qty * it.unit_amount)),
      line_type: it.line_type ?? "revenue",
      charge_kind: it.charge_kind ?? "rent",
      period_start: it.period_start ?? null,
      period_end: it.period_end ?? null,
      space_id: it.space_id ?? null,
      contract_id: it.contract_id ?? null,
      sort_order: idx,
    };
  });
}

/** Sum of line-item totals, as a string for the numeric `amount` column. */
function sumLineItems(items: LineItemInput[]): string {
  const total = items.reduce((acc, it) => acc + round2((it.quantity ?? 1) * it.unit_amount), 0);
  return String(round2(total));
}

/** Fetch a single invoice's line items, ordered by sort_order. */
async function getLineItems(invoiceId: number) {
  return db.select().from(invoiceLineItemsTable)
    .where(eq(invoiceLineItemsTable.invoice_id, invoiceId))
    .orderBy(asc(invoiceLineItemsTable.sort_order), asc(invoiceLineItemsTable.id));
}

async function enrichInvoices(rows: (typeof invoicesTable.$inferSelect)[]) {
  if (rows.length === 0) return [];
  const bookingIds = [...new Set(rows.map(r => r.booking_id).filter(Boolean))] as number[];
  const contractIds = [...new Set(rows.map(r => r.contract_id).filter(Boolean))] as number[];
  const accountIds = [...new Set(rows.map(r => r.account_id).filter(Boolean))] as number[];
  const payInfoIds = [...new Set(rows.map(r => r.payment_info_id).filter(Boolean))] as number[];

  const bookingMap: Record<number, string> = {};
  const contractMap: Record<number, string> = {};
  const accountMap: Record<number, string> = {};
  const payInfoMap: Record<number, string> = {};

  // Batched lookups — see enrichContracts in contracts.ts: a per-id loop is an
  // N+1 that costs one round trip per invoice.
  const [bookingRows, contractRows, accountRows, payInfoRows] = await Promise.all([
    bookingIds.length
      ? db.select({ id: bookingsTable.id, booking_ref: bookingsTable.booking_ref }).from(bookingsTable).where(inArray(bookingsTable.id, bookingIds))
      : Promise.resolve([]),
    contractIds.length
      ? db.select({ id: contractsTable.id, contract_ref: contractsTable.contract_ref }).from(contractsTable).where(inArray(contractsTable.id, contractIds))
      : Promise.resolve([]),
    accountIds.length
      ? db.select({ id: accountsTable.id, name: accountsTable.name }).from(accountsTable).where(inArray(accountsTable.id, accountIds))
      : Promise.resolve([]),
    payInfoIds.length
      ? db.select().from(paymentInfoTable).where(inArray(paymentInfoTable.id, payInfoIds))
      : Promise.resolve([]),
  ]);
  for (const b of bookingRows) bookingMap[b.id] = b.booking_ref;
  for (const c of contractRows) contractMap[c.id] = c.contract_ref;
  for (const a of accountRows) accountMap[a.id] = a.name;
  for (const p of payInfoRows) payInfoMap[p.id] = paymentInfoDisplay(p);

  return rows.map(r => ({
    ...r,
    booking_ref: r.booking_id ? (bookingMap[r.booking_id] ?? null) : null,
    contract_ref: r.contract_id ? (contractMap[r.contract_id] ?? null) : null,
    account_name: r.account_id ? (accountMap[r.account_id] ?? null) : null,
    payment_info_name: r.payment_info_id ? (payInfoMap[r.payment_info_id] ?? null) : null,
    // 세입자가 실제로 내는 금액 — 공급가액 + 세액. 면세면 amount 와 같다.
    total_amount: round2(Number(r.amount ?? 0) + Number(r.tax_amount ?? 0)),
  }));
}

/**
 * 계좌 한 줄 표기 — "은행명 계좌번호 (예금주)". 관리자 상세의 선택 표시와
 * 청구서 문서의 입금 계좌 안내가 같은 문자열을 쓰도록 한곳에서 만든다.
 * 계좌 정보가 없는 행(현금·Stripe 등)은 등록된 이름만 보여준다.
 */
function paymentInfoDisplay(p: typeof paymentInfoTable.$inferSelect): string {
  const line = [p.bank_name, p.account_number].filter(Boolean).join(" ");
  if (!line) return p.name;
  return `${line}${p.account_name ? ` (${p.account_name})` : ""}`;
}

/**
 * 청구서에 실릴 입금 계좌를 고른다. 지정된 계좌가 있으면 그것을, 없으면 활성
 * 계좌이체 계좌 중 첫 행을 기본값으로 쓴다 — 계좌를 한 번도 고른 적 없는
 * 기존 인보이스도 안내가 비지 않게 하기 위함이다. 활성 계좌가 하나도 없으면
 * 계좌 구획 자체가 문서에서 빠진다.
 */
async function resolveInvoiceBankAccount(paymentInfoId: number | null) {
  const row = paymentInfoId
    ? await db.select().from(paymentInfoTable)
        .where(and(eq(paymentInfoTable.id, paymentInfoId), isNull(paymentInfoTable.deleted_at)))
        .then(r => r[0])
    : await db.select().from(paymentInfoTable)
        .where(and(
          eq(paymentInfoTable.status, "Active"),
          eq(paymentInfoTable.payment_type, "BankTransfer"),
          isNull(paymentInfoTable.deleted_at),
        ))
        .orderBy(asc(paymentInfoTable.id))
        .then(r => r[0]);
  if (!row) return null;
  if (!row.bank_name && !row.account_number) return null;
  return {
    label: row.name,
    bank_name: row.bank_name,
    account_number: row.account_number,
    account_name: row.account_name,
    bsb_number: row.bsb_number,
    swift_code: row.swift_code,
  };
}

router.get("/v1/invoices", async (req, res): Promise<void> => {
  const {
    q, status, booking_id, contract_id, account_id,
    date_from, date_to, year, payment_method,
    invoice_kind, parent_invoice_id,
  } = req.query as Record<string, string>;
  const conditions: any[] = [deletedFilter(invoicesTable.deleted_at, req)];
  // 청구번호·설명뿐 아니라 화면에 함께 보이는 청구 대상(계정) 이름으로도 찾는다.
  if (q) {
    conditions.push(keywordCondition(
      q,
      [invoicesTable.invoice_ref, invoicesTable.description],
      [{ column: invoicesTable.account_id, ids: await accountIdsByName(q) }],
    ));
  }
  if (status) conditions.push(eq(invoicesTable.status, status));
  if (payment_method) conditions.push(eq(invoicesTable.payment_method, payment_method));
  conditions.push(...dateRangeConditions(invoicesTable.due_date, date_from, date_to));
  conditions.push(...yearConditions(invoicesTable.due_date, year));
  if (booking_id) conditions.push(eq(invoicesTable.booking_id, Number(booking_id)));
  if (contract_id) conditions.push(eq(invoicesTable.contract_id, Number(contract_id)));
  if (account_id) conditions.push(eq(invoicesTable.account_id, Number(account_id)));
  // 통합 청구 필터: kind=consolidated 로 통합 청구서만, parent_invoice_id 로 한 통합
  // 청구서에 묶인 공간별 인보이스만 조회한다.
  if (invoice_kind) conditions.push(eq(invoicesTable.invoice_kind, invoice_kind));
  if (parent_invoice_id) conditions.push(eq(invoicesTable.parent_invoice_id, Number(parent_invoice_id)));
  const rows = await db.select().from(invoicesTable)
    .where(and(...conditions))
    .orderBy(invoicesTable.id);
  const result = await enrichInvoices(rows);
  res.json(result);
});

/** 연도 선택지. 목록이 필터로 좁혀져도 선택지가 사라지지 않게 전체에서 뽑는다. "/:id" 보다 먼저. */
router.get("/v1/invoices/facets", async (req, res): Promise<void> => {
  const base = deletedFilter(invoicesTable.deleted_at, req);
  res.json({ years: await distinctYears(invoicesTable, invoicesTable.due_date, base) });
});

router.post("/v1/invoices", async (req, res): Promise<void> => {
  const parsed = CreateInvoiceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const itemsParsed = LineItemsBody.safeParse(req.body);
  if (!itemsParsed.success) { res.status(400).json({ error: itemsParsed.error.message }); return; }
  const taxParsed = TaxBody.safeParse(req.body);
  if (!taxParsed.success) { res.status(400).json({ error: taxParsed.error.message }); return; }
  const lineItems = itemsParsed.data.line_items ?? [];
  const hasLineItems = lineItems.length > 0;

  const ccy = parsed.data.currency ?? DEFAULT_CURRENCY;
  const amount = hasLineItems ? sumLineItems(lineItems) : String(parsed.data.amount ?? 0);
  const taxMode = taxParsed.data.tax_mode ?? "none";
  const taxRate = taxParsed.data.tax_rate ?? (taxMode === "exclusive" ? 10 : 0);
  const row = await insertInvoiceWithRef({
    booking_id: parsed.data.booking_id ?? null,
    contract_id: parsed.data.contract_id ?? null,
    account_id: parsed.data.account_id ?? null,
    payment_info_id: parsed.data.payment_info_id ?? null,
    amount,
    tax_mode: taxMode,
    tax_rate: String(taxRate),
    tax_amount: String(computeTax(Number(amount), taxMode, taxRate, ccy)),
    currency: ccy,
    exchange_rate_to_aud: await getRateToAud(ccy),
    due_date: parsed.data.due_date ?? null,
    description: parsed.data.description ?? null,
    notes: parsed.data.notes ?? null,
  });
  if (hasLineItems) {
    await db.insert(invoiceLineItemsTable).values(buildLineItemRows(row.id, lineItems));
  }
  const [result] = await enrichInvoices([row]);
  res.status(201).json({ ...result, line_items: hasLineItems ? await getLineItems(row.id) : [] });
});

router.get("/v1/invoices/:id", async (req, res): Promise<void> => {
  const row = await db.select().from(invoicesTable).where(eq(invoicesTable.id, Number(req.params.id))).then(r => r[0]);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const [result] = await enrichInvoices([row]);
  // 통합 청구서는 묶여 있는 공간별 인보이스를 함께 돌려준다(관리자 상세의 내역 표).
  const children = row.invoice_kind === "consolidated"
    ? await enrichInvoices(await db.select().from(invoicesTable).where(and(
        eq(invoicesTable.parent_invoice_id, row.id),
        isNull(invoicesTable.deleted_at),
      )).orderBy(asc(invoicesTable.id)))
    : [];
  res.json({ ...result, line_items: await getLineItems(row.id), children });
});

/**
 * 통합(단체) 청구서 생성/재계산.
 *   POST /v1/invoices/consolidated/run { account_id?, year?, month? }
 * 계정별 토글이 켜진 계정만 처리한다(크론과 같은 코드 경로, 멱등).
 */
router.post("/v1/invoices/consolidated/run", async (req, res): Promise<void> => {
  const body = z.object({
    account_id: z.number().int().positive().optional(),
    year: z.number().int().min(2000).max(2100).optional(),
    month: z.number().int().min(1).max(12).optional(),
  }).safeParse(req.body ?? {});
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const result = await generateConsolidatedInvoices({
    accountId: body.data.account_id,
    year: body.data.year,
    month: body.data.month,
  });
  res.json(result);
});

router.put("/v1/invoices/:id", async (req, res): Promise<void> => {
  const parsed = UpdateInvoiceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const itemsParsed = LineItemsBody.safeParse(req.body);
  if (!itemsParsed.success) { res.status(400).json({ error: itemsParsed.error.message }); return; }
  const taxParsed = TaxBody.safeParse(req.body);
  if (!taxParsed.success) { res.status(400).json({ error: taxParsed.error.message }); return; }
  const lineItems = itemsParsed.data.line_items; // undefined = leave untouched
  const id = Number(req.params.id);

  const updates: Partial<typeof invoicesTable.$inferInsert> = { updated_at: new Date() };
  if (parsed.data.booking_id !== undefined) updates.booking_id = parsed.data.booking_id;
  if (parsed.data.contract_id !== undefined) updates.contract_id = parsed.data.contract_id;
  if (parsed.data.account_id !== undefined) updates.account_id = parsed.data.account_id;
  if (parsed.data.payment_info_id !== undefined) updates.payment_info_id = parsed.data.payment_info_id;
  if (parsed.data.amount != null) updates.amount = String(parsed.data.amount);
  if (parsed.data.currency != null) updates.currency = parsed.data.currency;
  if (parsed.data.due_date !== undefined) updates.due_date = parsed.data.due_date;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.notes !== undefined) updates.notes = parsed.data.notes;
  // When line_items are provided, they own the amount.
  if (lineItems !== undefined) updates.amount = sumLineItems(lineItems);

  // 세액은 저장된 값이 아니라 항상 (공급가액 × 세율)로 다시 계산한다 — 금액이나 과세
  // 구분 중 하나만 바뀌어도 둘이 어긋나면 청구 총액이 틀린다.
  const current = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id)).then(r => r[0]);
  if (!current) { res.status(404).json({ error: "Not found" }); return; }
  const taxMode = taxParsed.data.tax_mode ?? current.tax_mode ?? "none";
  const taxRate = taxParsed.data.tax_rate ?? Number(current.tax_rate ?? 0);
  const supply = Number(updates.amount ?? current.amount ?? 0);
  const ccy = String(updates.currency ?? current.currency ?? DEFAULT_CURRENCY);
  updates.tax_mode = taxMode;
  updates.tax_rate = String(taxMode === "exclusive" && !(taxRate > 0) ? 10 : taxRate);
  updates.tax_amount = String(computeTax(supply, taxMode, Number(updates.tax_rate), ccy));

  const [row] = await db.update(invoicesTable).set(updates).where(eq(invoicesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  if (lineItems !== undefined) {
    await db.delete(invoiceLineItemsTable).where(eq(invoiceLineItemsTable.invoice_id, id));
    if (lineItems.length > 0) {
      await db.insert(invoiceLineItemsTable).values(buildLineItemRows(id, lineItems));
    }
  }
  const [result] = await enrichInvoices([row]);
  res.json({ ...result, line_items: await getLineItems(id) });
});

const invoicesSoftDelete = {
  table: invoicesTable,
  idColumn: invoicesTable.id,
};

router.post("/v1/invoices/bulk-delete", makeBulkDelete(invoicesSoftDelete));
router.post("/v1/invoices/bulk-restore", makeBulkRestore(invoicesSoftDelete));

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
  // Raise the receivable (Dr AR / Cr Revenue). Without this the ledger has no
  // record of money owed to us, so nothing can age. Best-effort — never blocks.
  // 통합 청구서는 자식 인보이스가 이미 채권을 들고 있으므로 전기하지 않는다.
  if (row.invoice_kind !== "consolidated") {
    void postInvoiceIssued({ id: row.id, amount: Number(row.amount), currency: row.currency, tax: Number(row.tax_amount ?? 0), issuedAt: new Date().toISOString() });
  }
  const [result] = await enrichInvoices([row]);
  res.json(result);
});

router.post("/v1/invoices/:id/pay", async (req, res): Promise<void> => {
  const parsed = PayInvoiceBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const paidAt = parsed.data.paid_at ? new Date(parsed.data.paid_at) : new Date();
  const [row] = await db.update(invoicesTable)
    .set({ status: "Paid", payment_method: parsed.data.payment_method, paid_at: paidAt, updated_at: new Date() })
    // Payable from any open state — imported rent ledgers land as Overdue/Draft
    // and are still settled the same way as a Sent invoice.
    .where(and(eq(invoicesTable.id, Number(req.params.id)), inArray(invoicesTable.status, ["Sent", "Draft", "Overdue", "Unpaid"])))
    .returning();
  if (!row) { res.status(400).json({ error: "Invoice is not in a payable status" }); return; }
  await logAction({ entityType: "invoice", entityId: row.id, action: "PAYMENT", oldValue: { status: "open" }, newValue: { status: "Paid", payment_method: parsed.data.payment_method } });

  if (row.invoice_kind === "consolidated") {
    // 통합 청구서는 납부용 표지일 뿐 회계의 정본이 아니다. 수납은 묶여 있는 공간별
    // 인보이스로 내려보내고(계약 단위로 GL·정산이 걸린다) 부모 자신은 전기하지
    // 않는다 — 부모까지 전기하면 매출이 두 번 잡힌다.
    const children = await db.select().from(invoicesTable).where(and(
      eq(invoicesTable.parent_invoice_id, row.id),
      isNull(invoicesTable.deleted_at),
      inArray(invoicesTable.status, ["Sent", "Draft", "Overdue", "Unpaid"]),
    ));
    for (const child of children) {
      await db.update(invoicesTable)
        .set({ status: "Paid", payment_method: parsed.data.payment_method, paid_at: paidAt, updated_at: new Date() })
        .where(eq(invoicesTable.id, child.id));
      void postInvoicePaid({ id: child.id, amount: Number(child.amount), currency: child.currency, tax: Number(child.tax_amount ?? 0), paidAt: paidAt.toISOString() });
      void generateSettlementsForInvoice(child.id);
    }
  } else {
    // Auto-post the GL entry (best-effort; never blocks or alters the response).
    void postInvoicePaid({ id: row.id, amount: Number(row.amount), currency: row.currency, tax: Number(row.tax_amount ?? 0), paidAt: paidAt.toISOString() });
    // Fan the receipt out into payout legs (집주인 / 파트너 / 에이전트 + 유보).
    // Also best-effort: a settlement failure must never fail a payment.
    void generateSettlementsForInvoice(row.id);
  }
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

/**
 * Build the enriched document input for a single invoice, including the
 * billing account's email + formatted address (needed for the Bill-To block).
 */
async function buildInvoiceDocInput(invoiceId: number, lang: DocLang): Promise<InvoiceDocInput | null> {
  const row = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId)).then(r => r[0]);
  if (!row) return null;
  const [enriched] = await enrichInvoices([row]);

  let account_email: string | null = null;
  let account_address: string | null = null;
  if (row.account_id) {
    const [acc] = await db.select().from(accountsTable).where(eq(accountsTable.id, row.account_id));
    if (acc) {
      account_email = acc.account_email ?? null;
      account_address = formatPostalAddress({
        line1: acc.address_line1,
        suburb: acc.address_suburb,
        state: acc.address_state,
        postcode: acc.address_postcode,
        country: acc.address_country,
      }, lang, { orderFallbackCountry: await resolveIssuerCountry() }) || null;
    }
  }

  return {
    invoice_ref: enriched.invoice_ref,
    status: enriched.status,
    amount: enriched.amount,
    currency: enriched.currency,
    due_date: enriched.due_date,
    paid_at: enriched.paid_at,
    payment_method: enriched.payment_method,
    description: enriched.description,
    notes: enriched.notes,
    created_at: enriched.created_at,
    invoice_kind: enriched.invoice_kind,
    billing_period: enriched.billing_period,
    account_id: row.account_id ?? null,
    account_name: (enriched as any).account_name ?? null,
    account_email,
    account_address,
    booking_ref: (enriched as any).booking_ref ?? null,
    contract_ref: (enriched as any).contract_ref ?? null,
    tax_mode: row.tax_mode,
    tax_rate: row.tax_rate,
    tax_amount: row.tax_amount,
    total_amount: (enriched as any).total_amount,
    bank_account: await resolveInvoiceBankAccount(row.payment_info_id),
    line_items: (await getLineItems(invoiceId)).map(li => ({
      label: li.label,
      description: li.description,
      quantity: li.quantity,
      unit_amount: li.unit_amount,
      total_amount: li.total_amount,
    })),
  };
}

/**
 * Render an invoice as a branded document.
 *   GET /v1/invoices/:id/pdf               → application/pdf download
 *   GET /v1/invoices/:id/pdf?format=html   → HTML preview (for in-app preview)
 */
router.get("/v1/invoices/:id/pdf", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const asHtml = req.query.format === "html";
  const lang = normalizeLang(req.query.lang as string);
  const docInput = await buildInvoiceDocInput(id, lang);
  if (!docInput) { res.status(404).json({ error: "Not found" }); return; }
  const terms = await resolveTemplateBody("pdf", "pdf.invoice", lang, {
    ref: docInput.invoice_ref, due_date: docInput.due_date ?? "",
  });
  const html = buildInvoiceHtml(docInput, await resolveCompanyInfo(lang), !asHtml, lang, terms);

  if (asHtml) {
    res.type("html").send(html);
    return;
  }

  await sendPdf(res, html, await invoiceFilename(id, docInput, "invoice"));
});

/**
 * Render the payment receipt for a (paid) invoice.
 *   GET /v1/invoices/:id/receipt/pdf  [?format=html]
 */
router.get("/v1/invoices/:id/receipt/pdf", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const asHtml = req.query.format === "html";
  const lang = normalizeLang(req.query.lang as string);
  const docInput = await buildInvoiceDocInput(id, lang);
  if (!docInput) { res.status(404).json({ error: "Not found" }); return; }
  const terms = await resolveTemplateBody("pdf", "pdf.receipt", lang, { ref: docInput.invoice_ref });
  const html = buildReceiptHtml(docInput, await resolveCompanyInfo(lang), !asHtml, lang, terms);

  if (asHtml) { res.type("html").send(html); return; }
  await sendPdf(res, html, await invoiceFilename(id, docInput, "receipt"));
});

/**
 * 파일명 규칙(INV-이름_YYYYMMDDA)을 인보이스와 영수증에 적용한다. 청구 대상은
 * 계정명, 발행일은 인보이스 발행일 / 수납일.
 */
async function invoiceFilename(
  id: number,
  docInput: InvoiceDocInput,
  kind: "invoice" | "receipt",
): Promise<string> {
  return resolveDocFileName({
    kind,
    entityType: "invoice",
    entityId: id,
    variant: kind === "receipt" ? "receipt" : "",
    accountId: docInput.account_id ?? null,
    party: [docInput.account_name],
    org: [docInput.account_name],
    issueDate: kind === "receipt" ? (docInput.paid_at ?? docInput.created_at) : docInput.created_at,
  });
}

/** Render HTML to PDF and stream it, mapping renderer failures to HTTP codes. */
async function sendPdf(
  res: import("express").Response,
  html: string,
  filename: string,
): Promise<void> {
  try {
    const pdf = await htmlToPdf(html);
    res.setHeader("Content-Type", "application/pdf");
    setDocFileName(res, filename);
    res.setHeader("Content-Length", String(pdf.length));
    res.send(pdf);
  } catch (err) {
    if (err instanceof PdfUnavailableError) { res.status(503).json({ error: err.message }); return; }
    console.error("[invoices] PDF generation failed:", err);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
}

function moneyLabel(amount: string | number | null, currency: string | null): string {
  return formatDocMoney(amount, currency);
}

/**
 * Email an invoice (or its receipt) to the billing account as a branded PDF.
 *   POST /v1/invoices/:id/email          body: { to?, kind?: "invoice"|"receipt" }
 *   POST /v1/invoices/:id/receipt/email  (kind=receipt)
 */
async function emailInvoiceDocument(req: import("express").Request, res: import("express").Response, kind: "invoice" | "receipt"): Promise<void> {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const lang = normalizeLang(req.body?.lang as string);
  const docInput = await buildInvoiceDocInput(id, lang);
  if (!docInput) { res.status(404).json({ error: "Not found" }); return; }

  // The send dialog posts the (editable, possibly multiple) recipients; with no
  // body we fall back to the account's billing address as before.
  const parsed = parseRecipients(req.body?.to ?? docInput.account_email);
  if (parsed.invalid.length) { res.status(400).json({ error: `Invalid email address: ${parsed.invalid.join(", ")}` }); return; }
  const to = parsed.to;
  if (!to.length) { res.status(400).json({ error: "No recipient email — set one on the linked account or pass { to }." }); return; }
  const company = await resolveCompanyInfo(lang);
  const terms = kind === "invoice"
    ? await resolveTemplateBody("pdf", "pdf.invoice", lang, { ref: docInput.invoice_ref, due_date: docInput.due_date ?? "" })
    : await resolveTemplateBody("pdf", "pdf.receipt", lang, { ref: docInput.invoice_ref });
  const html = kind === "receipt"
    ? buildReceiptHtml(docInput, company, true, lang, terms)
    : buildInvoiceHtml(docInput, company, true, lang, terms);
  let pdf: Buffer;
  try {
    pdf = await htmlToPdf(html);
  } catch (err) {
    if (err instanceof PdfUnavailableError) { res.status(503).json({ error: err.message }); return; }
    res.status(500).json({ error: "Failed to generate PDF" }); return;
  }

  const docTypeLabel = t(lang, kind === "receipt" ? "doctype.receipt" : "doctype.invoice");
  const amountLabel = moneyLabel(docInput.amount, docInput.currency);
  // Editable email copy (Templates Studio); falls back to the hardcoded note.
  const fallbackNote = kind === "invoice" && docInput.due_date ? t(lang, "email.note.due", { date: docInput.due_date }) : null;
  const copy = await resolveDocEmailCopy(kind === "receipt" ? "email.receipt" : "email.invoice", lang, {
    ref: docInput.invoice_ref, name: docInput.account_name ?? "", amount: amountLabel, due_date: docInput.due_date ?? "",
  });
  const result = await sendDocumentEmail({
    to, toName: docInput.account_name, lang, docTypeLabel, ref: docInput.invoice_ref,
    amountLabel,
    note: copy.note ?? fallbackNote,
    subject: copy.subject,
    pdf,
    filename: await invoiceFilename(id, docInput, kind),
  });

  await db.insert(emailLogsTable).values({
    template_code: `document.${kind}`, to_email: to.join(", "), to_name: docInput.account_name ?? null,
    subject: result.subject, resend_message_id: result.id ?? null, status: result.ok ? "Sent" : "Failed",
    entity_type: "invoice", entity_id: id, error_message: result.error ?? null,
  }).catch(() => {});

  if (!result.ok) { res.status(result.skipped ? 503 : 502).json({ error: result.error ?? "Send failed" }); return; }

  // Freeze an immutable snapshot of exactly what was emailed (best-effort).
  await freezeDocument({
    entityType: "invoice", entityId: id,
    docType: snapshotDocType("invoice", kind === "receipt" ? "receipt" : undefined),
    ref: docInput.invoice_ref, baseName: await invoiceFilename(id, docInput, kind), pdf,
  }).catch(() => null);

  // Sending an invoice advances Draft → Sent.
  if (kind === "invoice") {
    await db.update(invoicesTable).set({ status: "Sent", updated_at: new Date() })
      .where(and(eq(invoicesTable.id, id), eq(invoicesTable.status, "Draft")));
  }
  res.json({ ok: true, id: result.id, to });
}

/**
 * Addresses the send dialog offers for an invoice/receipt: the billing
 * account's own email plus its primary/secondary contacts, and — when the
 * invoice belongs to a contract — that contract's 임차인·부동산·임대인.
 *   GET /v1/invoices/:id/email-recipients        → { default, candidates }
 *   GET /v1/invoices/:id/receipt/email-recipients
 */
async function invoiceEmailRecipients(req: import("express").Request, res: import("express").Response): Promise<void> {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  // 계약이 걸린 청구서는 그 계약의 임차인·부동산·임대인도 함께 제안한다.
  res.json(toRecipientsResponse([
    ...await accountRecipients(row.account_id),
    ...await contractPartyRecipients(row.contract_id),
  ]));
}

router.get("/v1/invoices/:id/email-recipients", invoiceEmailRecipients);
router.get("/v1/invoices/:id/receipt/email-recipients", invoiceEmailRecipients);

router.post("/v1/invoices/:id/email", (req, res) => emailInvoiceDocument(req, res, "invoice"));
router.post("/v1/invoices/:id/receipt/email", (req, res) => emailInvoiceDocument(req, res, "receipt"));

/** Manually freeze the current invoice (or receipt) PDF as an immutable snapshot. */
async function freezeInvoiceDocument(req: import("express").Request, res: import("express").Response, kind: "invoice" | "receipt"): Promise<void> {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const lang = normalizeLang(req.body?.lang as string);
  const docInput = await buildInvoiceDocInput(id, lang);
  if (!docInput) { res.status(404).json({ error: "Not found" }); return; }
  const company = await resolveCompanyInfo(lang);
  const terms = kind === "invoice"
    ? await resolveTemplateBody("pdf", "pdf.invoice", lang, { ref: docInput.invoice_ref, due_date: docInput.due_date ?? "" })
    : await resolveTemplateBody("pdf", "pdf.receipt", lang, { ref: docInput.invoice_ref });
  const html = kind === "receipt" ? buildReceiptHtml(docInput, company, true, lang, terms) : buildInvoiceHtml(docInput, company, true, lang, terms);
  let pdf: Buffer;
  try {
    pdf = await htmlToPdf(html);
  } catch (err) {
    if (err instanceof PdfUnavailableError) { res.status(503).json({ error: err.message }); return; }
    res.status(500).json({ error: "Failed to generate PDF" }); return;
  }
  const snap = await freezeDocument({
    entityType: "invoice", entityId: id,
    docType: snapshotDocType("invoice", kind === "receipt" ? "receipt" : undefined),
    ref: docInput.invoice_ref, baseName: await invoiceFilename(id, docInput, kind), pdf,
  });
  if (!snap) { res.status(503).json({ error: "Document storage not configured" }); return; }
  res.json({ ok: true, ...snap });
}

router.post("/v1/invoices/:id/freeze", (req, res) => freezeInvoiceDocument(req, res, "invoice"));
router.post("/v1/invoices/:id/receipt/freeze", (req, res) => freezeInvoiceDocument(req, res, "receipt"));

/**
 * Create a Stripe Checkout session to collect payment for an invoice and return
 * the hosted payment URL. metadata.invoice_id lets the Stripe webhook mark the
 * invoice Paid on completion (see routes/stripe.ts). Issuing a link advances a
 * Draft invoice to Sent. Mirrors the homestay placement checkout flow.
 */
router.post("/v1/invoices/:id/checkout", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  if (row.status === "Paid") { res.status(400).json({ error: "Invoice is already paid." }); return; }
  if (row.status === "Void" || row.status === "Archived") { res.status(400).json({ error: "Invoice is not collectable." }); return; }

  // 결제는 세입자가 실제로 내는 금액(공급가액 + 세액)으로 건다.
  const amount = round2(Number(row.amount) + Number(row.tax_amount ?? 0));
  if (!(amount > 0)) { res.status(400).json({ error: "Invoice amount must be greater than zero." }); return; }

  const surchargePct = Number((req.body?.surcharge_pct ?? 0));
  const hasSurcharge = Number.isFinite(surchargePct) && surchargePct > 0;
  const surcharge = hasSurcharge ? round2(amount * surchargePct / 100) : 0;
  const chargeable = round2(amount + surcharge);

  const stripe = getStripe();
  if (!stripe) { res.status(503).json({ error: "Stripe is not configured" }); return; }

  let email: string | null = null;
  if (row.account_id) {
    const [acc] = await db.select().from(accountsTable).where(eq(accountsTable.id, row.account_id));
    email = acc?.account_email ?? null;
  }

  const webBase = (process.env.PUBLIC_WEB_URL ?? "https://www.millionstay.com").replace(/\/+$/, "");
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{
      price_data: {
        currency: (row.currency || DEFAULT_CURRENCY).toLowerCase(),
        product_data: { name: `Invoice ${row.invoice_ref}${row.description ? ` — ${row.description}` : ""}${hasSurcharge ? ` (incl. ${surchargePct}% card surcharge)` : ""}`.slice(0, 250) },
        unit_amount: Math.round(chargeable * 100),
      },
      quantity: 1,
    }],
    metadata: {
      invoice_id: String(id),
      invoice_ref: row.invoice_ref,
      ...(hasSurcharge ? { surcharge_pct: String(surchargePct) } : {}),
    },
    customer_email: email || undefined,
    success_url: `${webBase}/payment-result?status=success&ref=${encodeURIComponent(row.invoice_ref)}`,
    cancel_url: `${webBase}/payment-result?status=cancelled&ref=${encodeURIComponent(row.invoice_ref)}`,
  });

  if (row.status === "Draft") {
    await db.update(invoicesTable).set({ status: "Sent", updated_at: new Date() })
      .where(and(eq(invoicesTable.id, id), eq(invoicesTable.status, "Draft")));
  }
  await logAction({ entityType: "invoice", entityId: id, action: "STATUS_CHANGE", newValue: { checkout_session: session.id } }).catch(() => {});
  res.json({ success: true, url: session.url });
});

router.get("/v1/lookup/invoices", async (req, res): Promise<void> => {
  const { q } = req.query as Record<string, string>;
  const conditions = q ? [columnMatches(invoicesTable.invoice_ref, q)] : [];
  const rows = await db.select({ id: invoicesTable.id, invoice_ref: invoicesTable.invoice_ref, status: invoicesTable.status })
    .from(invoicesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(invoicesTable.id)
    .limit(20);
  res.json(rows.map(r => ({ id: r.id, display: `${r.invoice_ref} (${r.status})` })));
});

export default router;
