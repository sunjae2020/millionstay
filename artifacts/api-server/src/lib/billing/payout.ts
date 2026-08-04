// PAYOUT ENGINE — turns one customer receipt into settlement legs.
//
//   고객이 결제한다 → 우리가 홀딩한다 → 집주인·파트너·에이전트에 분배한다
//                                      → 남은 것(retained)이 실 매출
//
// The rules live in contract_payout_terms; the money lands in provider_settlements.
// Everything here is derived from those terms, so an admin never types an amount:
// they press "pay" on rows the system already computed.
//
// TWO DIFFERENT BASES, on purpose:
//   • what we PAY OUT is computed from the rent lines only (charge_kind='rent'),
//     so a move-in cleaning fee or break fee riding on a rent invoice never
//     inflates what we forward to the owner;
//   • what we RECONCILE against is the full receipt, so every cent that came in
//     is accounted for. The difference lands in the retained leg — correctly,
//     because it is our income, not the owner's.
//
// 관리비 · 수도세 · 전기세 never appear here at all: the tenant pays those
// straight to the management office and utility companies.
//
// Money columns are numeric → strings; wrap reads in Number(), writes in String().
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import {
  db,
  contractPayoutTermsTable,
  providerSettlementsTable,
  invoicesTable,
  invoiceLineItemsTable,
} from "@workspace/db";
import { DEFAULT_CURRENCY } from "../currency";
import { postSettlementApproved, postSettlementPaid } from "./gl";

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** YYYY-MM-DD in Australia/Sydney (matches the rest of the billing code). */
function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(new Date());
}

/**
 * How many settlements exist this year — the starting point for a batch of refs.
 *
 * Deliberately returns the COUNT, not a single ref: one receipt produces several
 * legs in a single insert, so handing out refs one call at a time would give
 * every leg in the batch the same number (they are all generated before any row
 * exists) and the whole insert would fail on the unique index.
 */
async function settlementSeqBase(year: number): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(providerSettlementsTable)
    .where(sql`EXTRACT(YEAR FROM ${providerSettlementsTable.created_at}) = ${year}`);
  return result?.count ?? 0;
}

const settlementRef = (year: number, seq: number) => `PS-${year}-${String(seq).padStart(5, "0")}`;

export type PayoutTerm = typeof contractPayoutTermsTable.$inferSelect;

/**
 * The amount a single term is owed out of this receipt.
 *
 * SINGLE SOURCE for the calculation — the admin UI must call the server rather
 * than recomputing, so the "73.5%" on screen and the 73.5% in the ledger can
 * never drift apart.
 *
 * Returns null when the term does not apply to this receipt.
 */
export function calcPayout(term: PayoutTerm, receipt: { rentBase: number }): { amount: number; base: number } | null {
  switch (term.basis) {
    case "percent_of_rent": {
      const rate = Number(term.rate ?? 0);
      if (rate <= 0 || receipt.rentBase <= 0) return null;
      return { amount: round2((receipt.rentBase * rate) / 100), base: round2(receipt.rentBase) };
    }
    case "fixed_monthly":
    case "fixed_once": {
      const amount = Number(term.amount ?? 0);
      if (amount <= 0) return null;
      return { amount: round2(amount), base: round2(receipt.rentBase) };
    }
    default:
      return null;
  }
}

/** Rent-only subtotal of an invoice — the base for every percent_of_rent term. */
export async function rentBaseForInvoice(invoiceId: number): Promise<number> {
  const lines = await db
    .select({ charge_kind: invoiceLineItemsTable.charge_kind, total_amount: invoiceLineItemsTable.total_amount })
    .from(invoiceLineItemsTable)
    .where(eq(invoiceLineItemsTable.invoice_id, invoiceId));

  // Legacy invoices carry no line items at all (single-amount rows). Those are
  // rent-only by construction, so the caller falls back to the invoice total.
  if (lines.length === 0) return -1;

  return round2(
    lines
      .filter((l) => (l.charge_kind ?? "rent") === "rent")
      .reduce((s, l) => s + Number(l.total_amount ?? 0), 0),
  );
}

/** Terms in force for a contract on a given date. */
async function activeTerms(contractId: number, onDate: string): Promise<PayoutTerm[]> {
  return db
    .select()
    .from(contractPayoutTermsTable)
    .where(
      and(
        eq(contractPayoutTermsTable.contract_id, contractId),
        eq(contractPayoutTermsTable.status, "Active"),
        eq(contractPayoutTermsTable.trigger, "on_ar_paid"),
        isNull(contractPayoutTermsTable.deleted_at),
        or(isNull(contractPayoutTermsTable.effective_from), sql`${contractPayoutTermsTable.effective_from} <= ${onDate}`)!,
        or(isNull(contractPayoutTermsTable.effective_to), sql`${contractPayoutTermsTable.effective_to} >= ${onDate}`)!,
      ),
    );
}

export type GenerateResult = {
  created: number;
  skipped: number;
  balanced: boolean;
  received: number;
  legsTotal: number;
};

/**
 * Fan a paid invoice out into settlement legs. Idempotent per (source, term):
 * re-running never duplicates, and a `cadence='once'` term (agent referral fee)
 * fires on the FIRST receipt only — without that guard the referral would
 * re-accrue every single month.
 *
 * BEST-EFFORT, like the GL helpers: a failure here must never break a payment.
 * Returns null on error after logging.
 */
export async function generateSettlementsForInvoice(invoiceId: number): Promise<GenerateResult | null> {
  try {
    const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId)).limit(1);
    if (!invoice || !invoice.contract_id) return null;

    const received = round2(Number(invoice.amount ?? 0));
    if (received <= 0) return null;

    const currency = invoice.currency || DEFAULT_CURRENCY;
    const entryDate = invoice.paid_at ? invoice.paid_at.toISOString().slice(0, 10) : todayIso();

    // Already fanned out? Then this is a retry — do nothing rather than double-pay.
    const existing = await db
      .select({ id: providerSettlementsTable.id, term_id: providerSettlementsTable.term_id })
      .from(providerSettlementsTable)
      .where(
        and(
          eq(providerSettlementsTable.source_type, "invoice"),
          eq(providerSettlementsTable.source_id, invoiceId),
          isNull(providerSettlementsTable.deleted_at),
        ),
      );
    if (existing.length > 0) return null;

    const terms = await activeTerms(invoice.contract_id, entryDate);
    if (terms.length === 0) return null;

    // `once` terms that already produced a settlement anywhere on this contract
    // must not fire again.
    const onceTermIds = terms.filter((t) => t.cadence === "once").map((t) => t.id);
    const spentOnce = new Set<number>();
    if (onceTermIds.length > 0) {
      const rows = await db
        .select({ term_id: providerSettlementsTable.term_id })
        .from(providerSettlementsTable)
        .where(
          and(
            inArray(providerSettlementsTable.term_id, onceTermIds),
            isNull(providerSettlementsTable.deleted_at),
          ),
        );
      for (const r of rows) if (r.term_id != null) spentOnce.add(r.term_id);
    }

    const rawRentBase = await rentBaseForInvoice(invoiceId);
    // -1 = the invoice has no itemised lines; a single-amount invoice is rent.
    const rentBase = rawRentBase < 0 ? received : rawRentBase;

    let skipped = 0;
    const legs: (typeof providerSettlementsTable.$inferInsert)[] = [];
    for (const term of terms) {
      if (term.cadence === "once" && spentOnce.has(term.id)) { skipped++; continue; }
      const calc = calcPayout(term, { rentBase });
      if (!calc) { skipped++; continue; }

      legs.push({
        settlement_ref: "", // assigned in one pass below, once the batch is known
        party_type: term.party_type,
        payee_account_id: term.payee_account_id,
        payee_name: term.payee_name,
        contract_id: invoice.contract_id,
        source_type: "invoice",
        source_id: invoiceId,
        split_role: "external_payment",
        term_id: term.id,
        basis_snapshot: term.basis,
        rate_snapshot: term.rate,
        base_amount: String(calc.base),
        gross_amount: String(calc.amount),
        deduction_amount: "0",
        amount: String(calc.amount),
        currency: term.currency || currency,
        status: "due",
      });
    }

    const externalTotal = round2(legs.reduce((s, l) => s + Number(l.amount ?? 0), 0));

    // Never forward more than came in — that would mean a misconfigured term,
    // and paying it out is worse than not generating anything.
    if (externalTotal > received + 0.01) {
      console.error(
        `[payout] refusing to split invoice #${invoiceId}: legs ${externalTotal} exceed receipt ${received}`,
      );
      return { created: 0, skipped: terms.length, balanced: false, received, legsTotal: externalTotal };
    }

    // The remainder is ours. It carries no posting_key: net revenue already
    // falls out of the ledger, so journalling it again would double-count.
    const retained = round2(received - externalTotal);
    if (retained > 0) {
      legs.push({
        settlement_ref: "",
        party_type: "retained",
        payee_name: "Retained (net revenue)",
        contract_id: invoice.contract_id,
        source_type: "invoice",
        source_id: invoiceId,
        split_role: "internal_transfer",
        base_amount: String(rentBase),
        gross_amount: String(retained),
        deduction_amount: "0",
        amount: String(retained),
        currency,
        status: "paid",
        paid_at: new Date(),
      });
    }

    if (legs.length === 0) return null;

    // Number the batch, then insert. If another receipt was split at the same
    // moment the refs collide on the unique index — renumber from a fresh count
    // and retry once rather than dropping the split on the floor.
    const year = new Date().getFullYear();
    const numberAndInsert = async () => {
      const base = await settlementSeqBase(year);
      legs.forEach((l, i) => { l.settlement_ref = settlementRef(year, base + i + 1); });
      await db.insert(providerSettlementsTable).values(legs);
    };
    try {
      await numberAndInsert();
    } catch (e: unknown) {
      const code = (e as { code?: string } | null)?.code ?? (e as { cause?: { code?: string } } | null)?.cause?.code;
      if (code !== "23505") throw e;
      await numberAndInsert();
    }

    const legsTotal = round2(legs.reduce((s, l) => s + Number(l.amount ?? 0), 0));
    const balanced = Math.abs(received - legsTotal) < 0.01;
    if (!balanced) {
      console.error(`[payout] invoice #${invoiceId} split is unbalanced: received=${received} legs=${legsTotal}`);
    }
    return { created: legs.length, skipped, balanced, received, legsTotal };
  } catch (err) {
    console.error(`[payout] generateSettlementsForInvoice failed for #${invoiceId}:`, err);
    return null;
  }
}

/**
 * NET REVENUE (실 매출) over a window — the retained legs, i.e. what is left of
 * customer receipts after owner rent, partner cost and agent referral.
 *
 * This is the number "revenue" should mean on a dashboard. Summing paid invoices
 * gives money that PASSED THROUGH us, most of which belongs to somebody else.
 *
 * Returns 0 (not null) when nothing has been split yet, so callers can display
 * it alongside gross without special-casing an empty ledger.
 */
export async function netRevenueBetween(fromIso: Date, toIso: Date): Promise<number> {
  try {
    const [row] = await db
      .select({ total: sql<string>`COALESCE(SUM(${providerSettlementsTable.amount}), 0)` })
      .from(providerSettlementsTable)
      .where(
        and(
          isNull(providerSettlementsTable.deleted_at),
          eq(providerSettlementsTable.split_role, "internal_transfer"),
          sql`${providerSettlementsTable.created_at} >= ${fromIso.toISOString()}`,
          sql`${providerSettlementsTable.created_at} < ${toIso.toISOString()}`,
        ),
      );
    return round2(Number(row?.total ?? 0));
  } catch (err) {
    console.error("[payout] netRevenueBetween failed:", err);
    return 0;
  }
}

/** Net revenue across all time. */
export async function netRevenueTotal(): Promise<number> {
  try {
    const [row] = await db
      .select({ total: sql<string>`COALESCE(SUM(${providerSettlementsTable.amount}), 0)` })
      .from(providerSettlementsTable)
      .where(
        and(
          isNull(providerSettlementsTable.deleted_at),
          eq(providerSettlementsTable.split_role, "internal_transfer"),
        ),
      );
    return round2(Number(row?.total ?? 0));
  } catch (err) {
    console.error("[payout] netRevenueTotal failed:", err);
    return 0;
  }
}

/** Approve a due leg: posts Dr <cost> / Cr <payable>. */
export async function approveSettlement(id: number): Promise<typeof providerSettlementsTable.$inferSelect | null> {
  const [row] = await db
    .update(providerSettlementsTable)
    .set({ status: "approved", approved_at: new Date(), updated_at: new Date() })
    .where(and(eq(providerSettlementsTable.id, id), eq(providerSettlementsTable.status, "due")))
    .returning();
  if (!row) return null;
  void postSettlementApproved({
    id: row.id,
    partyType: row.party_type,
    amount: Number(row.amount),
    currency: row.currency,
    approvedAt: row.approved_at?.toISOString() ?? null,
  });
  return row;
}

/** Mark an approved leg paid: posts Dr <payable> / Cr Cash. */
export async function paySettlement(id: number, method?: string | null): Promise<typeof providerSettlementsTable.$inferSelect | null> {
  const paidAt = new Date();
  const [row] = await db
    .update(providerSettlementsTable)
    .set({ status: "paid", method: method ?? null, paid_at: paidAt, updated_at: new Date() })
    .where(and(eq(providerSettlementsTable.id, id), eq(providerSettlementsTable.status, "approved")))
    .returning();
  if (!row) return null;
  void postSettlementPaid({
    id: row.id,
    partyType: row.party_type,
    amount: Number(row.amount),
    currency: row.currency,
    paidAt: paidAt.toISOString(),
  });
  return row;
}
