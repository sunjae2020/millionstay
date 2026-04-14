import { pgTable, serial, integer, text, real, timestamp } from "drizzle-orm/pg-core";

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoice_ref: text("invoice_ref").notNull().unique(),
  booking_id: integer("booking_id"),
  contract_id: integer("contract_id"),
  account_id: integer("account_id"),
  amount: real("amount").notNull().default(0),
  currency: text("currency").notNull().default("AUD"),
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
