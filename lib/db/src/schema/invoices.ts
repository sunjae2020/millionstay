import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoice_ref: text("invoice_ref").notNull().unique(),
  booking_id: integer("booking_id"),
  contract_id: integer("contract_id"),
  quote_id: integer("quote_id"),
  account_id: integer("account_id"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("AUD"),
  exchange_rate_to_aud: numeric("exchange_rate_to_aud", { precision: 18, scale: 8 }),
  status: text("status").notNull().default("Draft"),
  due_date: text("due_date"),
  paid_at: timestamp("paid_at", { withTimezone: true }),
  payment_method: text("payment_method"),
  stripe_payment_intent_id: text("stripe_payment_intent_id"),
  stripe_checkout_url: text("stripe_checkout_url"),
  description: text("description"),
  notes: text("notes"),
  deleted_at: timestamp("deleted_at"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Itemised invoice lines. An invoice may have zero rows (legacy single-amount
// invoices keep using invoices.amount + description) or N rows whose total_amount
// sums to invoices.amount. Money columns are numeric → strings.
export const invoiceLineItemsTable = pgTable("invoice_line_items", {
  id: serial("id").primaryKey(),
  invoice_id: integer("invoice_id").notNull(), // invoices.id
  label: text("label").notNull(),              // e.g. "Homestay placement fee"
  description: text("description"),
  // "revenue" (default) posts to GL Revenue; "deposit" posts to the Deposits Held
  // liability account so refundable security deposits are never booked as revenue (H-402).
  line_type: text("line_type").notNull().default("revenue"),
  quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
  unit_amount: numeric("unit_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  total_amount: numeric("total_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  sort_order: integer("sort_order").notNull().default(0),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
