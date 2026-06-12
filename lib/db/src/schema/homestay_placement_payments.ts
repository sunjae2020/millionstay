import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Homestay placement PAYMENTS — per-charge record for the all-online payment
// model (see HOMESTAY_WORKFLOW.md §6). Two kinds:
//   - "upfront"  : placement fee + deposit + first month (Stripe Checkout)
//   - "monthly"  : recurring homestay fee (Stripe Subscription invoices)
// Money columns are numeric → strings.
export const homestayPlacementPaymentsTable = pgTable("homestay_placement_payments", {
  id: serial("id").primaryKey(),
  placement_id: integer("placement_id").notNull(), // homestay_placements.id
  kind: text("kind").notNull(),                    // upfront | monthly
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("AUD"),
  status: text("status").notNull().default("pending"), // pending | paid | failed | refunded

  invoice_id: integer("invoice_id"),               // optional link to invoices.id
  stripe_payment_intent_id: text("stripe_payment_intent_id"),
  stripe_invoice_id: text("stripe_invoice_id"),    // for subscription cycles

  // Billing period (monthly charges)
  period_start: text("period_start"),
  period_end: text("period_end"),
  paid_at: timestamp("paid_at", { withTimezone: true }),

  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertHomestayPlacementPaymentSchema = createInsertSchema(homestayPlacementPaymentsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertHomestayPlacementPayment = z.infer<typeof insertHomestayPlacementPaymentSchema>;
export type HomestayPlacementPayment = typeof homestayPlacementPaymentsTable.$inferSelect;
