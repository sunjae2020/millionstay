// Minimal double-entry GENERAL LEDGER posting helpers.
//
// Each balanced transaction (sum debits = sum credits) is written as one
// journal_entries row + N journal_lines rows. Posting is AUTO-triggered from
// financial events (invoice paid, commission accrued/paid) and is idempotent via
// posting_key — a retried webhook or re-run never double-posts.
//
// EVERYTHING here is best-effort: the GL must NEVER break a payment flow, so
// posting helpers catch all errors, log, and return null instead of throwing.
//
// Money columns are numeric → strings; wrap reads in Number(), writes in String().
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db, journalEntriesTable, journalLinesTable, invoiceLineItemsTable } from "@workspace/db";

// ── Fixed chart of accounts ────────────────────────────────────────────────
// Codes are OWNED BY THIS APP. AusBridge runs the same design on its own codes
// (its 2100 is Accounts Payable, ours is Deposits Held) — never copy account
// codes across the two apps, map by ROLE instead.
// See docs/proposals/ACCOUNTING_UNIFIED_SPEC.md §1.
export const ACCOUNTS = {
  CASH: { code: "1000", name: "Cash/Bank" },
  // Raised when an invoice is ISSUED, cleared when it is PAID. Without this the
  // ledger has no notion of money owed to us, so AR aging can't exist.
  ACCOUNTS_RECEIVABLE: { code: "1100", name: "Accounts Receivable" },
  // Rent forwarded to the property owner (집주인 렌트). Kept SEPARATE from
  // contractor expense so property cost and service cost don't blend — mixing
  // them makes per-contract margin analysis impossible.
  //
  // 5300 deliberately matches 임차료 in the standard Korean chart of accounts,
  // which already means "rent paid to a lessor". 5200 was the obvious next
  // number but is 급여 (payroll) there — posting owner rent to it would bury
  // the single largest cost line inside salaries.
  OWNER_RENT_COST: { code: "5300", name: "Owner Rent Cost" },
  REVENUE: { code: "4000", name: "Revenue" },
  COMMISSION_EXPENSE: { code: "5000", name: "Agent Commission Expense" },
  COMMISSION_PAYABLE: { code: "2000", name: "Commission Payable" },
  // Refundable security deposits are a liability, not revenue — held until
  // refunded/forfeited (H-402).
  DEPOSIT_HELD: { code: "2100", name: "Deposits Held" },
  // 부가세예수금 — 과세 청구서에서 받은 세액은 매출이 아니라 국가에 낼 부채다.
  VAT_PAYABLE: { code: "2300", name: "VAT Payable" },
  // Service-host / contractor payouts (외주비): expense on accrual, payable until paid.
  CONTRACTOR_EXPENSE: { code: "5100", name: "Contractor Expense" },
  CONTRACTOR_PAYABLE: { code: "2200", name: "Contractor Payable" },
} as const;

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** YYYY-MM-DD in Australia/Sydney (matches the rest of the homestay billing code). */
function sydneyToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(new Date());
}

export type PostingLine = {
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
};

export type PostEntryInput = {
  postingKey: string;
  entryDate: string; // YYYY-MM-DD
  description: string;
  sourceType: string | null;
  sourceId: number | null;
  currency: string;
  lines: PostingLine[];
};

/**
 * Post a single balanced journal entry (idempotent, best-effort).
 *
 *  - Rounds every debit/credit to cents.
 *  - Skips entirely when the total posted amount is <= 0.
 *  - Refuses to post an unbalanced entry (|Σdebit − Σcredit| ≥ 0.01) — logs + returns null.
 *  - Idempotent: if an entry already exists for `postingKey`, returns it (pre-check
 *    select; also treats a unique-violation on insert as already-posted).
 *  - NEVER throws to callers — catches everything, logs, returns null.
 */
export async function postEntry(input: PostEntryInput): Promise<typeof journalEntriesTable.$inferSelect | null> {
  try {
    const lines = input.lines.map((l) => ({
      account_code: l.account_code,
      account_name: l.account_name,
      debit: round2(l.debit || 0),
      credit: round2(l.credit || 0),
    }));

    const totalDebit = round2(lines.reduce((s, l) => s + l.debit, 0));
    const totalCredit = round2(lines.reduce((s, l) => s + l.credit, 0));

    // Skip when there is nothing to post.
    if (totalDebit <= 0 && totalCredit <= 0) return null;

    if (Math.abs(totalDebit - totalCredit) >= 0.01) {
      console.error(
        `[gl] refusing to post unbalanced entry ${input.postingKey}: debit=${totalDebit} credit=${totalCredit}`,
      );
      return null;
    }

    // Idempotency pre-check.
    const [existing] = await db
      .select()
      .from(journalEntriesTable)
      .where(eq(journalEntriesTable.posting_key, input.postingKey))
      .limit(1);
    if (existing) return existing;

    let entry: typeof journalEntriesTable.$inferSelect;
    try {
      const [row] = await db
        .insert(journalEntriesTable)
        .values({
          posting_key: input.postingKey,
          entry_date: input.entryDate,
          description: input.description,
          source_type: input.sourceType,
          source_id: input.sourceId,
          currency: input.currency || "AUD",
        })
        .returning();
      if (!row) return null;
      entry = row;
    } catch (e: unknown) {
      const code = (e as { code?: string } | null)?.code;
      const cause = (e as { cause?: { code?: string } } | null)?.cause?.code;
      if (code === "23505" || cause === "23505") {
        // Lost a race — already posted. Return the existing entry.
        const [row] = await db
          .select()
          .from(journalEntriesTable)
          .where(eq(journalEntriesTable.posting_key, input.postingKey))
          .limit(1);
        return row ?? null;
      }
      throw e;
    }

    await db.insert(journalLinesTable).values(
      lines.map((l) => ({
        entry_id: entry.id,
        account_code: l.account_code,
        account_name: l.account_name,
        debit: String(l.debit),
        credit: String(l.credit),
      })),
    );

    return entry;
  } catch (err) {
    console.error(`[gl] postEntry failed for ${input.postingKey}:`, err);
    return null;
  }
}

/**
 * Split an invoice's total into its refundable-deposit portion and the rest.
 * Deposit line items (line_type="deposit") are a liability, never income (H-402).
 * Best-effort: if the line items can't be read, treats the whole amount as revenue.
 */
async function splitDepositPortion(invoiceId: number, amount: number): Promise<{ deposit: number; revenue: number }> {
  let deposit = 0;
  try {
    const lineItems = await db
      .select({ line_type: invoiceLineItemsTable.line_type, total_amount: invoiceLineItemsTable.total_amount })
      .from(invoiceLineItemsTable)
      .where(eq(invoiceLineItemsTable.invoice_id, invoiceId));
    const raw = lineItems
      .filter((l) => l.line_type === "deposit")
      .reduce((s, l) => s + Number(l.total_amount ?? 0), 0);
    deposit = Math.max(0, Math.min(round2(raw), amount));
  } catch (e) {
    console.error(`[gl] could not read line items for invoice #${invoiceId}:`, e);
  }
  return { deposit, revenue: round2(amount - deposit) };
}

/** True when this invoice already raised a receivable (so payment clears AR, not Revenue). */
async function hasIssuedEntry(invoiceId: number): Promise<boolean> {
  try {
    const [row] = await db
      .select({ id: journalEntriesTable.id })
      .from(journalEntriesTable)
      .where(eq(journalEntriesTable.posting_key, `invoice_issued:${invoiceId}`))
      .limit(1);
    return !!row;
  } catch {
    return false;
  }
}

/**
 * Dr Accounts Receivable / Cr Revenue (+ Cr Deposits Held) when an invoice is
 * ISSUED. This is what makes money-owed-to-us exist in the ledger — without it
 * there is no AR balance and no aging report.
 *
 * Pairs with postInvoicePaid, which then clears AR against Cash. Invoices that
 * never went through issue (imported rent ledgers, legacy rows) still settle
 * correctly — postInvoicePaid falls back to crediting Revenue directly.
 */
export async function postInvoiceIssued(args: {
  id: number;
  amount: number;
  currency: string;
  issuedAt?: string | null;
  /** 부가세액(공급가액과 별도). 매출이 아니라 부가세예수금(2300)으로 간다. */
  tax?: number;
}): Promise<typeof journalEntriesTable.$inferSelect | null> {
  const amount = round2(args.amount || 0);
  if (amount <= 0) return null;
  const tax = round2(args.tax || 0);
  const entryDate = args.issuedAt ? args.issuedAt.slice(0, 10) : sydneyToday();
  const { deposit, revenue } = await splitDepositPortion(args.id, amount);

  const creditLines: PostingLine[] = [];
  if (tax > 0) {
    creditLines.push({ account_code: ACCOUNTS.VAT_PAYABLE.code, account_name: ACCOUNTS.VAT_PAYABLE.name, debit: 0, credit: tax });
  }
  if (deposit > 0) {
    creditLines.push({ account_code: ACCOUNTS.DEPOSIT_HELD.code, account_name: ACCOUNTS.DEPOSIT_HELD.name, debit: 0, credit: deposit });
  }
  if (revenue > 0) {
    creditLines.push({ account_code: ACCOUNTS.REVENUE.code, account_name: ACCOUNTS.REVENUE.name, debit: 0, credit: revenue });
  }

  return postEntry({
    postingKey: `invoice_issued:${args.id}`,
    entryDate,
    description: `Invoice issued #${args.id}`,
    sourceType: "invoice",
    sourceId: args.id,
    currency: args.currency || "AUD",
    lines: [
      { account_code: ACCOUNTS.ACCOUNTS_RECEIVABLE.code, account_name: ACCOUNTS.ACCOUNTS_RECEIVABLE.name, debit: round2(amount + tax), credit: 0 },
      ...creditLines,
    ],
  });
}

/**
 * Dr Cash / Cr Accounts Receivable when a previously-issued invoice is paid.
 *
 * When NO issue entry exists (imported rent ledgers, legacy invoices, invoices
 * paid straight from Draft), falls back to the original posting — Dr Cash /
 * Cr Revenue (+ Cr Deposits Held for the deposit portion) — so those flows keep
 * booking revenue exactly as before and AR never goes negative.
 */
export async function postInvoicePaid(args: {
  id: number;
  amount: number;
  currency: string;
  paidAt?: string | null;
  /** 부가세액(공급가액과 별도). 발행 분개가 없으면 여기서 부채로 잡는다. */
  tax?: number;
}): Promise<typeof journalEntriesTable.$inferSelect | null> {
  const amount = round2(args.amount || 0);
  if (amount <= 0) return null;
  const tax = round2(args.tax || 0);
  const entryDate = args.paidAt ? args.paidAt.slice(0, 10) : sydneyToday();

  const creditLines: PostingLine[] = [];
  if (await hasIssuedEntry(args.id)) {
    // Receivable already recognised at issue — payment just clears it.
    creditLines.push({
      account_code: ACCOUNTS.ACCOUNTS_RECEIVABLE.code,
      account_name: ACCOUNTS.ACCOUNTS_RECEIVABLE.name,
      debit: 0,
      credit: round2(amount + tax),
    });
  } else {
    if (tax > 0) {
      creditLines.push({ account_code: ACCOUNTS.VAT_PAYABLE.code, account_name: ACCOUNTS.VAT_PAYABLE.name, debit: 0, credit: tax });
    }
    const { deposit, revenue } = await splitDepositPortion(args.id, amount);
    if (deposit > 0) {
      creditLines.push({ account_code: ACCOUNTS.DEPOSIT_HELD.code, account_name: ACCOUNTS.DEPOSIT_HELD.name, debit: 0, credit: deposit });
    }
    if (revenue > 0) {
      creditLines.push({ account_code: ACCOUNTS.REVENUE.code, account_name: ACCOUNTS.REVENUE.name, debit: 0, credit: revenue });
    }
  }

  return postEntry({
    postingKey: `invoice_paid:${args.id}`,
    entryDate,
    description: `Invoice payment #${args.id}`,
    sourceType: "invoice",
    sourceId: args.id,
    currency: args.currency || "AUD",
    lines: [
      { account_code: ACCOUNTS.CASH.code, account_name: ACCOUNTS.CASH.name, debit: round2(amount + tax), credit: 0 },
      ...creditLines,
    ],
  });
}

/**
 * Dr Cash / Cr Deposits Held (deposit portion) + Cr Revenue (remainder) when a
 * homestay placement payment is received. Homestay upfront payments bundle
 * placement_fee + deposit + card surcharge and are collected via a separate
 * placement-payment path that (unlike invoices) never posted to the GL — so the
 * refundable deposit was never booked to Deposits Held (2100). This books the
 * whole payment: the deposit portion (upfront only) lands in the liability so
 * move-out settlement can release it (H-402); the rest is revenue. Idempotent
 * via posting_key.
 */
export async function postPlacementPaymentPaid(args: {
  paymentId: number;
  kind: string;        // "upfront" | "monthly"
  amount: number;      // total received (base + surcharge)
  deposit: number;     // refundable deposit portion (0 for monthly)
  currency: string;
  paidAt?: string | null;
}): Promise<typeof journalEntriesTable.$inferSelect | null> {
  const amount = round2(args.amount || 0);
  if (amount <= 0) return null;
  const entryDate = args.paidAt ? args.paidAt.slice(0, 10) : sydneyToday();

  // Only the upfront payment carries a refundable deposit; clamp to the amount
  // so the credit split always balances against Dr Cash.
  const rawDeposit = args.kind === "upfront" ? round2(args.deposit || 0) : 0;
  const depositAmount = Math.max(0, Math.min(rawDeposit, amount));
  const revenueAmount = round2(amount - depositAmount);

  const creditLines: PostingLine[] = [];
  if (depositAmount > 0) {
    creditLines.push({ account_code: ACCOUNTS.DEPOSIT_HELD.code, account_name: ACCOUNTS.DEPOSIT_HELD.name, debit: 0, credit: depositAmount });
  }
  if (revenueAmount > 0) {
    creditLines.push({ account_code: ACCOUNTS.REVENUE.code, account_name: ACCOUNTS.REVENUE.name, debit: 0, credit: revenueAmount });
  }

  return postEntry({
    postingKey: `placement_payment:${args.paymentId}`,
    entryDate,
    description: `Homestay placement payment #${args.paymentId} (${args.kind})`,
    sourceType: "homestay_placement_payment",
    sourceId: args.paymentId,
    currency: args.currency || "AUD",
    lines: [
      { account_code: ACCOUNTS.CASH.code, account_name: ACCOUNTS.CASH.name, debit: amount, credit: 0 },
      ...creditLines,
    ],
  });
}

/** Dr Agent Commission Expense / Cr Commission Payable when a commission is accrued. */
export async function postCommissionAccrued(args: {
  id: number;
  amount: number;
  currency: string;
}): Promise<typeof journalEntriesTable.$inferSelect | null> {
  const amount = round2(args.amount || 0);
  if (amount <= 0) return null;
  return postEntry({
    postingKey: `commission_accrued:${args.id}`,
    entryDate: sydneyToday(),
    description: `Commission accrued #${args.id}`,
    sourceType: "commission",
    sourceId: args.id,
    currency: args.currency || "AUD",
    lines: [
      { account_code: ACCOUNTS.COMMISSION_EXPENSE.code, account_name: ACCOUNTS.COMMISSION_EXPENSE.name, debit: amount, credit: 0 },
      { account_code: ACCOUNTS.COMMISSION_PAYABLE.code, account_name: ACCOUNTS.COMMISSION_PAYABLE.name, debit: 0, credit: amount },
    ],
  });
}

/** Dr Commission Payable / Cr Cash when a commission is paid. */
export async function postCommissionPaid(args: {
  id: number;
  amount: number;
  currency: string;
}): Promise<typeof journalEntriesTable.$inferSelect | null> {
  const amount = round2(args.amount || 0);
  if (amount <= 0) return null;
  return postEntry({
    postingKey: `commission_paid:${args.id}`,
    entryDate: sydneyToday(),
    description: `Commission paid #${args.id}`,
    sourceType: "commission",
    sourceId: args.id,
    currency: args.currency || "AUD",
    lines: [
      { account_code: ACCOUNTS.COMMISSION_PAYABLE.code, account_name: ACCOUNTS.COMMISSION_PAYABLE.name, debit: amount, credit: 0 },
      { account_code: ACCOUNTS.CASH.code, account_name: ACCOUNTS.CASH.name, debit: 0, credit: amount },
    ],
  });
}

/** Dr Contractor Expense / Cr Contractor Payable when a partner payout is accrued. */
export async function postPartnerPayoutAccrued(args: {
  id: number;
  amount: number;
  currency: string;
}): Promise<typeof journalEntriesTable.$inferSelect | null> {
  const amount = round2(args.amount || 0);
  if (amount <= 0) return null;
  return postEntry({
    postingKey: `partner_payout_accrued:${args.id}`,
    entryDate: sydneyToday(),
    description: `Partner payout accrued #${args.id}`,
    sourceType: "partner_payout",
    sourceId: args.id,
    currency: args.currency || "AUD",
    lines: [
      { account_code: ACCOUNTS.CONTRACTOR_EXPENSE.code, account_name: ACCOUNTS.CONTRACTOR_EXPENSE.name, debit: amount, credit: 0 },
      { account_code: ACCOUNTS.CONTRACTOR_PAYABLE.code, account_name: ACCOUNTS.CONTRACTOR_PAYABLE.name, debit: 0, credit: amount },
    ],
  });
}

/** Dr Contractor Payable / Cr Cash when a partner payout is paid. */
export async function postPartnerPayoutPaid(args: {
  id: number;
  amount: number;
  currency: string;
}): Promise<typeof journalEntriesTable.$inferSelect | null> {
  const amount = round2(args.amount || 0);
  if (amount <= 0) return null;
  return postEntry({
    postingKey: `partner_payout_paid:${args.id}`,
    entryDate: sydneyToday(),
    description: `Partner payout paid #${args.id}`,
    sourceType: "partner_payout",
    sourceId: args.id,
    currency: args.currency || "AUD",
    lines: [
      { account_code: ACCOUNTS.CONTRACTOR_PAYABLE.code, account_name: ACCOUNTS.CONTRACTOR_PAYABLE.name, debit: amount, credit: 0 },
      { account_code: ACCOUNTS.CASH.code, account_name: ACCOUNTS.CASH.name, debit: 0, credit: amount },
    ],
  });
}

// ── Provider settlement postings (집주인 · 파트너 · 에이전트 분배) ──────────
//
// One receipt fans out into settlement legs (see lib/billing/payout.ts). Each
// leg posts twice: cost/payable on approval, payable/cash on payment. Which
// account pair applies is decided by WHO is being paid.

export type SettlementPartyType = "landlord" | "service_host" | "agent";

/** Cost + payable account pair for a settlement leg's payee. */
export function settlementAccounts(partyType: string): { cost: { code: string; name: string }; payable: { code: string; name: string } } {
  switch (partyType) {
    case "landlord":
      return { cost: ACCOUNTS.OWNER_RENT_COST, payable: ACCOUNTS.CONTRACTOR_PAYABLE };
    case "agent":
      return { cost: ACCOUNTS.COMMISSION_EXPENSE, payable: ACCOUNTS.COMMISSION_PAYABLE };
    case "service_host":
    default:
      return { cost: ACCOUNTS.CONTRACTOR_EXPENSE, payable: ACCOUNTS.CONTRACTOR_PAYABLE };
  }
}

/** Dr <cost> / Cr <payable> when a settlement leg is approved. */
export async function postSettlementApproved(args: {
  id: number;
  partyType: string;
  amount: number;
  currency: string;
  approvedAt?: string | null;
}): Promise<typeof journalEntriesTable.$inferSelect | null> {
  const amount = round2(args.amount || 0);
  if (amount <= 0) return null;
  const { cost, payable } = settlementAccounts(args.partyType);
  return postEntry({
    postingKey: `settlement_approved:${args.id}`,
    entryDate: args.approvedAt ? args.approvedAt.slice(0, 10) : sydneyToday(),
    description: `Settlement approved #${args.id} (${args.partyType})`,
    sourceType: "provider_settlement",
    sourceId: args.id,
    currency: args.currency || "AUD",
    lines: [
      { account_code: cost.code, account_name: cost.name, debit: amount, credit: 0 },
      { account_code: payable.code, account_name: payable.name, debit: 0, credit: amount },
    ],
  });
}

/** Dr <payable> / Cr Cash when a settlement leg is actually paid out. */
export async function postSettlementPaid(args: {
  id: number;
  partyType: string;
  amount: number;
  currency: string;
  paidAt?: string | null;
}): Promise<typeof journalEntriesTable.$inferSelect | null> {
  const amount = round2(args.amount || 0);
  if (amount <= 0) return null;
  const { payable } = settlementAccounts(args.partyType);
  return postEntry({
    postingKey: `settlement_paid:${args.id}`,
    entryDate: args.paidAt ? args.paidAt.slice(0, 10) : sydneyToday(),
    description: `Settlement paid #${args.id} (${args.partyType})`,
    sourceType: "provider_settlement",
    sourceId: args.id,
    currency: args.currency || "AUD",
    lines: [
      { account_code: payable.code, account_name: payable.name, debit: amount, credit: 0 },
      { account_code: ACCOUNTS.CASH.code, account_name: ACCOUNTS.CASH.name, debit: 0, credit: amount },
    ],
  });
}

// ── Read helpers (used by the read-only dashboard endpoints) ────────────────

export type GlEntry = {
  id: number;
  posting_key: string;
  entry_date: string;
  description: string;
  source_type: string | null;
  source_id: number | null;
  currency: string;
  /** 원장 전기 시각 — 리스트의 생성일 컬럼. 전표는 불변이라 수정일은 없다. */
  created_at: Date | string | null;
  lines: { account_code: string; account_name: string; debit: number; credit: number }[];
};

/** List journal entries (with their lines) filtered by entry_date, newest first. */
export async function listEntries(opts: { from?: string; to?: string } = {}): Promise<GlEntry[]> {
  const conditions = [];
  if (opts.from) conditions.push(gte(journalEntriesTable.entry_date, opts.from));
  if (opts.to) conditions.push(lte(journalEntriesTable.entry_date, opts.to));

  const entries = await db
    .select()
    .from(journalEntriesTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(journalEntriesTable.entry_date), desc(journalEntriesTable.id));

  if (entries.length === 0) return [];

  const ids = entries.map((e) => e.id);
  const allLines = await db.select().from(journalLinesTable);
  const linesByEntry = new Map<number, GlEntry["lines"]>();
  for (const l of allLines) {
    if (!ids.includes(l.entry_id)) continue;
    const arr = linesByEntry.get(l.entry_id) ?? [];
    arr.push({
      account_code: l.account_code,
      account_name: l.account_name,
      debit: Number(l.debit ?? 0),
      credit: Number(l.credit ?? 0),
    });
    linesByEntry.set(l.entry_id, arr);
  }

  return entries.map((e) => ({
    id: e.id,
    posting_key: e.posting_key,
    entry_date: e.entry_date,
    description: e.description,
    source_type: e.source_type,
    source_id: e.source_id,
    currency: e.currency,
    created_at: e.created_at,
    lines: linesByEntry.get(e.id) ?? [],
  }));
}

export type TrialBalanceRow = {
  account_code: string;
  account_name: string;
  debit_total: number;
  credit_total: number;
  balance: number;
};

/** Trial balance grouped by account_code over the (optional) entry_date window. */
export async function trialBalance(
  opts: { from?: string; to?: string } = {},
): Promise<{ data: TrialBalanceRow[]; totals: { debit: number; credit: number } }> {
  const entries = await listEntries(opts);
  const round = (n: number) => Math.round(n * 100) / 100;

  const byAccount = new Map<string, TrialBalanceRow>();
  for (const e of entries) {
    for (const l of e.lines) {
      const row = byAccount.get(l.account_code) ?? {
        account_code: l.account_code,
        account_name: l.account_name,
        debit_total: 0,
        credit_total: 0,
        balance: 0,
      };
      row.debit_total += Number(l.debit ?? 0);
      row.credit_total += Number(l.credit ?? 0);
      byAccount.set(l.account_code, row);
    }
  }

  const data = Array.from(byAccount.values())
    .map((r) => ({
      account_code: r.account_code,
      account_name: r.account_name,
      debit_total: round(r.debit_total),
      credit_total: round(r.credit_total),
      balance: round(r.debit_total - r.credit_total),
    }))
    .sort((a, b) => a.account_code.localeCompare(b.account_code));

  const totals = {
    debit: round(data.reduce((s, r) => s + r.debit_total, 0)),
    credit: round(data.reduce((s, r) => s + r.credit_total, 0)),
  };

  return { data, totals };
}
