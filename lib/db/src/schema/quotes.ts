import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Quotes — Document Hub Phase 3
 *
 * A pre-sale quotation issued to a prospect (lead) or account. Mirrors the
 * invoice/contract conventions: text reference (MS-QT-YYYY-NNNNN), numeric money
 * columns (returned as strings by Drizzle — wrap with Number() before maths),
 * soft delete via deleted_at, and a simple status lifecycle.
 *
 * Lifecycle: Draft → Sent → Accepted | Declined | Expired
 */
export const quotesTable = pgTable("quotes", {
  id: serial("id").primaryKey(),
  quote_ref: text("quote_ref").notNull().unique(),
  account_id: integer("account_id"),
  lead_id: integer("lead_id"),
  space_id: integer("space_id"),
  status: text("status").notNull().default("Draft"),
  currency: text("currency").notNull().default("AUD"),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),
  valid_until: text("valid_until"),
  description: text("description"),
  notes: text("notes"),
  sent_at: timestamp("sent_at", { withTimezone: true }),
  accepted_at: timestamp("accepted_at", { withTimezone: true }),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export type Quote = typeof quotesTable.$inferSelect;
export type InsertQuote = typeof quotesTable.$inferInsert;
