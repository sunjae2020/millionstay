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
export const ACCOUNTS = {
  CASH: { code: "1000", name: "Cash/Bank" },
  REVENUE: { code: "4000", name: "Revenue" },
  COMMISSION_EXPENSE: { code: "5000", name: "Agent Commission Expense" },
  COMMISSION_PAYABLE: { code: "2000", name: "Commission Payable" },
  // Refundable security deposits are a liability, not revenue — held until
  // refunded/forfeited (H-402).
  DEPOSIT_HELD: { code: "2100", name: "Deposits Held" },
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
 * Dr Cash / Cr Revenue (+ Cr Deposits Held for the deposit portion) when an
 * invoice is paid. Refundable security-deposit line items (line_type="deposit")
 * are credited to the Deposits Held liability account instead of Revenue so they
 * are never booked as income (H-402).
 */
export async function postInvoicePaid(args: {
  id: number;
  amount: number;
  currency: string;
  paidAt?: string | null;
}): Promise<typeof journalEntriesTable.$inferSelect | null> {
  const amount = round2(args.amount || 0);
  if (amount <= 0) return null;
  const entryDate = args.paidAt ? args.paidAt.slice(0, 10) : sydneyToday();

  // Sum the refundable-deposit line items for this invoice (clamped to the paid
  // amount) so the credit split always balances against Dr Cash.
  let depositAmount = 0;
  try {
    const lineItems = await db
      .select({ line_type: invoiceLineItemsTable.line_type, total_amount: invoiceLineItemsTable.total_amount })
      .from(invoiceLineItemsTable)
      .where(eq(invoiceLineItemsTable.invoice_id, args.id));
    const rawDeposit = lineItems
      .filter((l) => l.line_type === "deposit")
      .reduce((s, l) => s + Number(l.total_amount ?? 0), 0);
    depositAmount = Math.min(round2(rawDeposit), amount);
    if (depositAmount < 0) depositAmount = 0;
  } catch (e) {
    // Best-effort: if line items can't be read, fall back to all-revenue posting.
    console.error(`[gl] postInvoicePaid: could not read line items for invoice #${args.id}:`, e);
  }
  const revenueAmount = round2(amount - depositAmount);

  const creditLines: PostingLine[] = [];
  if (depositAmount > 0) {
    creditLines.push({ account_code: ACCOUNTS.DEPOSIT_HELD.code, account_name: ACCOUNTS.DEPOSIT_HELD.name, debit: 0, credit: depositAmount });
  }
  if (revenueAmount > 0) {
    creditLines.push({ account_code: ACCOUNTS.REVENUE.code, account_name: ACCOUNTS.REVENUE.name, debit: 0, credit: revenueAmount });
  }

  return postEntry({
    postingKey: `invoice_paid:${args.id}`,
    entryDate,
    description: `Invoice payment #${args.id}`,
    sourceType: "invoice",
    sourceId: args.id,
    currency: args.currency || "AUD",
    lines: [
      { account_code: ACCOUNTS.CASH.code, account_name: ACCOUNTS.CASH.name, debit: amount, credit: 0 },
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

// ── Read helpers (used by the read-only dashboard endpoints) ────────────────

export type GlEntry = {
  id: number;
  posting_key: string;
  entry_date: string;
  description: string;
  source_type: string | null;
  source_id: number | null;
  currency: string;
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
