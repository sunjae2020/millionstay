import { pgTable, serial, integer, text, numeric, date, timestamp } from "drizzle-orm/pg-core";

// Minimal double-entry GENERAL LEDGER (net-new). Each journal_entries row is one
// balanced transaction (sum debits = sum credits across its journal_lines).
// Entries are AUTO-POSTED from financial events (invoice paid, commission
// accrued/paid). posting_key makes posting idempotent (unique per event), so a
// retried webhook / re-run never double-posts.
//
// Fixed chart of accounts (codes used by the posting helpers):
//   1000 Cash/Bank (asset) · 4000 Revenue (income)
//   5000 Agent Commission Expense (expense) · 2000 Commission Payable (liability)
//
// Money columns are numeric → strings; wrap reads in Number(), writes in String().
export const journalEntriesTable = pgTable("journal_entries", {
  id: serial("id").primaryKey(),
  // Idempotency guard, e.g. "invoice_paid:123" | "commission_accrued:45" | "commission_paid:45".
  posting_key: text("posting_key").notNull().unique(),
  entry_date: date("entry_date").notNull(),
  description: text("description").notNull(),
  source_type: text("source_type"), // invoice | commission
  source_id: integer("source_id"),
  currency: text("currency").notNull().default("AUD"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const journalLinesTable = pgTable("journal_lines", {
  id: serial("id").primaryKey(),
  entry_id: integer("entry_id").notNull(), // journal_entries.id
  account_code: text("account_code").notNull(),
  account_name: text("account_name").notNull(),
  debit: numeric("debit", { precision: 12, scale: 2 }).notNull().default("0"),
  credit: numeric("credit", { precision: 12, scale: 2 }).notNull().default("0"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type JournalEntry = typeof journalEntriesTable.$inferSelect;
export type JournalLine = typeof journalLinesTable.$inferSelect;
