import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

// Chart of Accounts (계정과목) — the per-tenant cost-centre / GL account master
// behind Settings → Cost Center. Each row is one account in the ledger; the
// auto-posting general ledger (journal_lines.account_code / account_name, see
// journal.ts) references these codes. `account_type` classifies the account
// into the five statement groups; `parent_code` gives an optional hierarchy
// (a sub-account points at its header account's code).
export const chartOfAccountsTable = pgTable("chart_of_accounts", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  // asset | liability | equity | revenue | expense
  account_type: text("account_type").notNull().default("asset"),
  // Parent account code for hierarchy (nullable → top-level header).
  parent_code: text("parent_code"),
  description: text("description"),
  is_active: boolean("is_active").notNull().default(true),
  sort_order: integer("sort_order").notNull().default(0),
  deleted_at: timestamp("deleted_at"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type ChartOfAccount = typeof chartOfAccountsTable.$inferSelect;
export type InsertChartOfAccount = typeof chartOfAccountsTable.$inferInsert;
