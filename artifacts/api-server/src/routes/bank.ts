import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { z } from "zod/v4";
import {
  db,
  bankAccountsTable,
  bankTransactionsTable,
  chartOfAccountsTable,
  journalEntriesTable,
  journalLinesTable,
} from "@workspace/db";
import { DEFAULT_CURRENCY } from "../lib/currency";
import { logAction } from "../utils/auditLog";
import { postEntry, type PostingLine } from "../lib/billing/gl";

// 은행 대사 — matching imported statement lines against the ledger.
// See docs/proposals/ACCOUNTING_UNIFIED_SPEC.md §7 step 8.
const router: IRouter = Router();
const ENTITY = "bank_transaction";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Whole days between two YYYY-MM-DD dates. */
function dayDiff(a: string, b: string): number {
  const ms = Math.abs(new Date(a + "T00:00:00Z").getTime() - new Date(b + "T00:00:00Z").getTime());
  return Math.round(ms / 86_400_000);
}

// ── Bank accounts ───────────────────────────────────────────────────────────

router.get("/v1/bank-accounts", async (_req, res): Promise<void> => {
  try {
    const rows = await db
      .select()
      .from(bankAccountsTable)
      .where(isNull(bankAccountsTable.deleted_at))
      .orderBy(bankAccountsTable.id);
    res.json({ success: true, data: rows, meta: { total: rows.length } });
  } catch {
    res.status(500).json({ error: "Failed to list bank accounts" });
  }
});

const AccountBody = z.object({
  name: z.string().min(1),
  gl_account_code: z.string().default("1000"),
  bank_name: z.string().nullish(),
  account_number: z.string().nullish(),
  currency: z.string().default(DEFAULT_CURRENCY),
  statement_balance: z.number().nullish(),
  notes: z.string().nullish(),
});

router.post("/v1/bank-accounts", async (req, res): Promise<void> => {
  const parsed = AccountBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const b = parsed.data;
  try {
    const [row] = await db.insert(bankAccountsTable).values({
      name: b.name,
      gl_account_code: b.gl_account_code,
      bank_name: b.bank_name ?? null,
      account_number: b.account_number ?? null,
      currency: b.currency,
      statement_balance: b.statement_balance != null ? String(b.statement_balance) : null,
      notes: b.notes ?? null,
    }).returning();
    void logAction({ entityType: "bank_account", entityId: row!.id, action: "CREATE", newValue: { name: b.name } });
    res.status(201).json({ success: true, data: row });
  } catch {
    res.status(500).json({ error: "Failed to create bank account" });
  }
});

router.put("/v1/bank-accounts/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = AccountBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const b = parsed.data;
  try {
    const [row] = await db.update(bankAccountsTable).set({
      name: b.name,
      gl_account_code: b.gl_account_code,
      bank_name: b.bank_name ?? null,
      account_number: b.account_number ?? null,
      currency: b.currency,
      statement_balance: b.statement_balance != null ? String(b.statement_balance) : null,
      notes: b.notes ?? null,
      updated_at: new Date(),
    }).where(and(eq(bankAccountsTable.id, id), isNull(bankAccountsTable.deleted_at))).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ success: true, data: row });
  } catch {
    res.status(500).json({ error: "Failed to update bank account" });
  }
});

router.delete("/v1/bank-accounts/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.update(bankAccountsTable)
    .set({ deleted_at: new Date(), status: "Inactive", updated_at: new Date() })
    .where(and(eq(bankAccountsTable.id, id), isNull(bankAccountsTable.deleted_at)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.status(204).send();
});

// ── Statement import ────────────────────────────────────────────────────────

const ImportBody = z.object({
  rows: z.array(z.object({
    txn_date: z.string().min(8),
    description: z.string().default(""),
    amount: z.number(),                 // SIGNED: + money in, − money out
    balance: z.number().nullish(),
    reference: z.string().nullish(),
  })).min(1),
  statement_balance: z.number().nullish(),
});

/**
 * Import statement lines. Idempotent per line via dedupe_key, because operators
 * routinely export overlapping date ranges — silently doubling a month of
 * transactions would be far worse than importing nothing.
 */
router.post("/v1/bank-accounts/:id/import", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = ImportBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [acct] = await db.select().from(bankAccountsTable).where(eq(bankAccountsTable.id, id)).limit(1);
  if (!acct) { res.status(404).json({ error: "Bank account not found" }); return; }

  const batch = `IMP-${Date.now()}`;
  const values = parsed.data.rows.map((r) => {
    const date = r.txn_date.slice(0, 10);
    const key = createHash("sha256")
      .update(`${id}|${date}|${r.amount.toFixed(2)}|${r.description}|${r.reference ?? ""}`)
      .digest("hex")
      .slice(0, 40);
    return {
      bank_account_id: id,
      txn_date: date,
      description: r.description || "—",
      amount: String(round2(r.amount)),
      balance: r.balance != null ? String(round2(r.balance)) : null,
      reference: r.reference ?? null,
      dedupe_key: key,
      import_batch: batch,
    };
  });

  try {
    const inserted = await db
      .insert(bankTransactionsTable)
      .values(values)
      .onConflictDoNothing({ target: bankTransactionsTable.dedupe_key })
      .returning({ id: bankTransactionsTable.id });

    await db.update(bankAccountsTable).set({
      last_imported_at: new Date(),
      statement_balance: parsed.data.statement_balance != null ? String(parsed.data.statement_balance) : acct.statement_balance,
      updated_at: new Date(),
    }).where(eq(bankAccountsTable.id, id));

    // Report the skips explicitly — "imported 40 of 60" is the operator's only
    // signal that the file overlapped a previous import.
    res.json({
      success: true,
      data: { imported: inserted.length, skipped: values.length - inserted.length, total: values.length, batch },
    });
  } catch {
    res.status(500).json({ error: "Failed to import statement" });
  }
});

// ── Transactions ────────────────────────────────────────────────────────────

router.get("/v1/bank-transactions", async (req, res): Promise<void> => {
  try {
    const { bank_account_id, status } = req.query as Record<string, string>;
    const rows = await db.select().from(bankTransactionsTable)
      .where(and(
        bank_account_id ? eq(bankTransactionsTable.bank_account_id, Number(bank_account_id)) : undefined,
        status ? eq(bankTransactionsTable.status, status) : undefined,
      ))
      .orderBy(desc(bankTransactionsTable.txn_date), desc(bankTransactionsTable.id));
    res.json({ success: true, data: rows, meta: { total: rows.length } });
  } catch {
    res.status(500).json({ error: "Failed to list bank transactions" });
  }
});

/**
 * Journal entries whose net movement on the cash account equals this line's
 * signed amount, within ±7 days, excluding entries already matched elsewhere.
 *
 * Nearest date first — when several entries are the same amount (a rent roll of
 * identical monthly payments), date proximity is the only signal available.
 */
router.get("/v1/bank-transactions/:id/match-suggestions", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [txn] = await db.select().from(bankTransactionsTable).where(eq(bankTransactionsTable.id, id)).limit(1);
    if (!txn) { res.status(404).json({ error: "Not found" }); return; }
    const [acct] = await db.select().from(bankAccountsTable).where(eq(bankAccountsTable.id, txn.bank_account_id)).limit(1);
    const code = acct?.gl_account_code ?? "1000";
    const amount = round2(Number(txn.amount));

    const lines = await db.select({
      entry_id: journalEntriesTable.id,
      entry_date: journalEntriesTable.entry_date,
      description: journalEntriesTable.description,
      debit: journalLinesTable.debit,
      credit: journalLinesTable.credit,
    })
      .from(journalLinesTable)
      .innerJoin(journalEntriesTable, eq(journalLinesTable.entry_id, journalEntriesTable.id))
      .where(eq(journalLinesTable.account_code, code));

    const taken = new Set(
      (await db.select({ jid: bankTransactionsTable.matched_entry_id })
        .from(bankTransactionsTable)
        .where(eq(bankTransactionsTable.status, "reconciled")))
        .map((r) => r.jid)
        .filter((v): v is number => v != null),
    );

    const suggestions = lines
      .map((l) => ({
        entry_id: l.entry_id,
        entry_date: l.entry_date,
        description: l.description,
        cash_delta: round2(Number(l.debit ?? 0) - Number(l.credit ?? 0)),
      }))
      .filter((l) => !taken.has(l.entry_id) && Math.abs(l.cash_delta - amount) < 0.01 && dayDiff(l.entry_date, txn.txn_date) <= 7)
      .sort((a, b) => dayDiff(a.entry_date, txn.txn_date) - dayDiff(b.entry_date, txn.txn_date))
      .slice(0, 10);

    res.json({ success: true, data: { bank_transaction_id: id, amount, account_code: code, suggestions } });
  } catch {
    res.status(500).json({ error: "Failed to build match suggestions" });
  }
});

router.post("/v1/bank-transactions/:id/match", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const entryId = Number(req.body?.entry_id);
  if (!Number.isFinite(id) || !Number.isFinite(entryId)) { res.status(400).json({ error: "Invalid id or entry_id" }); return; }
  const [row] = await db.update(bankTransactionsTable)
    .set({ status: "reconciled", matched_entry_id: entryId, matched_at: new Date(), updated_at: new Date() })
    .where(eq(bankTransactionsTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  void logAction({ entityType: ENTITY, entityId: id, action: "STATUS_CHANGE", newValue: { status: "reconciled", entry_id: entryId } });
  res.json({ success: true, data: row });
});

const CreateEntryBody = z.object({
  counter_account_code: z.string().min(1),
  description: z.string().nullish(),
});

/**
 * Book a statement line that has no counterpart in the ledger (bank fee,
 * interest, a transfer nobody recorded) and reconcile it in one step.
 *
 *   money in  → Dr cash    / Cr counter
 *   money out → Dr counter / Cr cash
 */
router.post("/v1/bank-transactions/:id/create-entry", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = CreateEntryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const [txn] = await db.select().from(bankTransactionsTable).where(eq(bankTransactionsTable.id, id)).limit(1);
    if (!txn) { res.status(404).json({ error: "Not found" }); return; }
    if (txn.status === "reconciled") { res.status(409).json({ error: "Already reconciled" }); return; }

    const [acct] = await db.select().from(bankAccountsTable).where(eq(bankAccountsTable.id, txn.bank_account_id)).limit(1);
    const cashCode = acct?.gl_account_code ?? "1000";
    const counter = parsed.data.counter_account_code;

    const accounts = await db.select().from(chartOfAccountsTable).where(isNull(chartOfAccountsTable.deleted_at));
    const byCode = new Map(accounts.map((a) => [a.code, a]));
    // Refuse rather than invent an account — a typo'd code would create a
    // balanced entry against a line nobody can find later.
    if (!byCode.has(counter)) { res.status(400).json({ error: `Unknown counter account: ${counter}` }); return; }

    const amt = round2(Math.abs(Number(txn.amount)));
    if (amt <= 0) { res.status(400).json({ error: "Zero amount" }); return; }

    const cashName = byCode.get(cashCode)?.name ?? "Cash/Bank";
    const counterName = byCode.get(counter)!.name;
    const moneyIn = Number(txn.amount) > 0;
    const lines: PostingLine[] = moneyIn
      ? [{ account_code: cashCode, account_name: cashName, debit: amt, credit: 0 },
         { account_code: counter, account_name: counterName, debit: 0, credit: amt }]
      : [{ account_code: counter, account_name: counterName, debit: amt, credit: 0 },
         { account_code: cashCode, account_name: cashName, debit: 0, credit: amt }];

    const entry = await postEntry({
      postingKey: `bank_txn:${id}`,
      entryDate: txn.txn_date,
      description: parsed.data.description || `Bank: ${txn.description}`,
      sourceType: "bank_txn",
      sourceId: id,
      currency: acct?.currency || DEFAULT_CURRENCY,
      lines,
    });
    if (!entry) { res.status(500).json({ error: "Failed to post GL entry" }); return; }

    const [row] = await db.update(bankTransactionsTable)
      .set({ status: "reconciled", matched_entry_id: entry.id, matched_at: new Date(), updated_at: new Date() })
      .where(eq(bankTransactionsTable.id, id))
      .returning();
    void logAction({ entityType: ENTITY, entityId: id, action: "CREATE", newValue: { entry_id: entry.id, counter } });
    res.status(201).json({ success: true, data: { ...row, entry_id: entry.id } });
  } catch {
    res.status(500).json({ error: "Failed to create entry from bank line" });
  }
});

router.post("/v1/bank-transactions/:id/unmatch", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.update(bankTransactionsTable)
    .set({ status: "unmatched", matched_entry_id: null, matched_at: null, updated_at: new Date() })
    .where(eq(bankTransactionsTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ success: true, data: row });
});

router.post("/v1/bank-transactions/:id/ignore", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.update(bankTransactionsTable)
    .set({ status: "ignored", updated_at: new Date() })
    .where(eq(bankTransactionsTable.id, id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ success: true, data: row });
});

/** Statement balance vs GL cash balance, plus what is still unmatched. */
router.get("/v1/bank-accounts/:id/reconciliation", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    const [acct] = await db.select().from(bankAccountsTable).where(eq(bankAccountsTable.id, id)).limit(1);
    if (!acct) { res.status(404).json({ error: "Not found" }); return; }

    const glLines = await db.select({ debit: journalLinesTable.debit, credit: journalLinesTable.credit })
      .from(journalLinesTable)
      .where(eq(journalLinesTable.account_code, acct.gl_account_code));
    const glBalance = round2(glLines.reduce((s, l) => s + Number(l.debit ?? 0) - Number(l.credit ?? 0), 0));

    const txns = await db.select({ status: bankTransactionsTable.status })
      .from(bankTransactionsTable)
      .where(eq(bankTransactionsTable.bank_account_id, id));
    const unmatched = txns.filter((t) => t.status === "unmatched").length;
    const reconciled = txns.filter((t) => t.status === "reconciled").length;
    const statementBalance = acct.statement_balance != null ? round2(Number(acct.statement_balance)) : null;
    const difference = statementBalance != null ? round2(statementBalance - glBalance) : null;

    res.json({
      success: true,
      data: {
        bank_account_id: id,
        gl_account_code: acct.gl_account_code,
        currency: acct.currency,
        statement_balance: statementBalance,
        gl_balance: glBalance,
        difference,
        unmatched_count: unmatched,
        reconciled_count: reconciled,
        // Both conditions matter: zero unmatched lines with a balance gap still
        // means something is wrong.
        fully_reconciled: unmatched === 0 && difference != null && Math.abs(difference) < 0.01,
      },
    });
  } catch {
    res.status(500).json({ error: "Failed to build reconciliation" });
  }
});

export default router;
