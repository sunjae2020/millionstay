import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Quote line items — Document Hub Phase 3
 *
 * Individual priced rows on a quote. `total_price` is stored (= unit_price ×
 * quantity) so historic quotes stay accurate even if pricing logic changes.
 */
export const quoteLineItemsTable = pgTable("quote_line_items", {
  id: serial("id").primaryKey(),
  quote_id: integer("quote_id").notNull(),
  name: text("name").notNull(),
  unit_price: numeric("unit_price", { precision: 10, scale: 2 }).notNull().default("0"),
  quantity: integer("quantity").notNull().default(1),
  total_price: numeric("total_price", { precision: 10, scale: 2 }).notNull().default("0"),
  sort_order: integer("sort_order").notNull().default(0),
  notes: text("notes"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export type QuoteLineItem = typeof quoteLineItemsTable.$inferSelect;
export type InsertQuoteLineItem = typeof quoteLineItemsTable.$inferInsert;
