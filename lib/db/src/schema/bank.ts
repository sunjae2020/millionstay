import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// BANK RECONCILIATION — the last link in the chain: proving the ledger matches
// the actual bank statement (docs/proposals/ACCOUNTING_UNIFIED_SPEC.md §7 step 8).
//
// Without this, the GL can be internally consistent and still wrong: a payout
// marked "paid" in the system but never actually transferred looks identical to
// one that went out. Matching statement lines against journal entries is what
// turns "we recorded it" into "the money moved".

/** A real bank account whose statement lines are imported and reconciled. */
export const bankAccountsTable = pgTable("bank_accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // e.g. "국민은행 운영계좌"
  // chart_of_accounts.code this account's cash sits in — normally 1000.
  gl_account_code: text("gl_account_code").notNull().default("1000"),
  bank_name: text("bank_name"),
  account_number: text("account_number"), // store masked / last-4 in practice
  currency: text("currency").notNull().default("KRW"),
  /** Latest imported closing balance, compared against the GL cash balance. */
  statement_balance: numeric("statement_balance", { precision: 14, scale: 2 }),
  last_imported_at: timestamp("last_imported_at", { withTimezone: true }),
  status: text("status").notNull().default("Active"),
  notes: text("notes"),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

/**
 * One imported bank-statement line.
 *
 * `amount` is SIGNED: positive = money in, negative = money out. That single
 * convention is what lets a line be compared directly against a journal entry's
 * net movement on the cash account.
 *
 * `dedupe_key` makes re-importing an overlapping statement a no-op — operators
 * export overlapping date ranges constantly, and silently doubling a month of
 * transactions would be far worse than rejecting the file.
 */
export const bankTransactionsTable = pgTable("bank_transactions", {
  id: serial("id").primaryKey(),
  bank_account_id: integer("bank_account_id").notNull(),
  txn_date: text("txn_date").notNull(), // YYYY-MM-DD
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  balance: numeric("balance", { precision: 14, scale: 2 }),
  reference: text("reference"),
  dedupe_key: text("dedupe_key").notNull().unique(),

  // unmatched | reconciled | ignored
  status: text("status").notNull().default("unmatched"),
  matched_entry_id: integer("matched_entry_id"), // journal_entries.id
  matched_at: timestamp("matched_at", { withTimezone: true }),
  import_batch: text("import_batch"),

  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBankAccountSchema = createInsertSchema(bankAccountsTable).omit({ id: true, created_at: true, updated_at: true });
export const insertBankTransactionSchema = createInsertSchema(bankTransactionsTable).omit({ id: true, created_at: true, updated_at: true });
export type InsertBankAccount = z.infer<typeof insertBankAccountSchema>;
export type InsertBankTransaction = z.infer<typeof insertBankTransactionSchema>;
export type BankAccount = typeof bankAccountsTable.$inferSelect;
export type BankTransaction = typeof bankTransactionsTable.$inferSelect;

export const BANK_TXN_STATUSES = ["unmatched", "reconciled", "ignored"] as const;
