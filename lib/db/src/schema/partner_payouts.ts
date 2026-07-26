import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// PARTNER (service-host) PAYOUTS — the amount owed to a service host for work
// performed (외주비). Mirrors the agent-commission ledger: one row per payout,
// state Accrued → Approved → Paid, with GL posting on accrual and payment.
//   accrue: Dr Contractor Expense (5100) / Cr Contractor Payable (2200)
//   pay:    Dr Contractor Payable (2200)  / Cr Cash (1000)
// Optionally linked to the work order or booking service it settles.
// Money columns are numeric → strings; wrap reads in Number(), writes in String().
export const partnerPayoutsTable = pgTable("partner_payouts", {
  id: serial("id").primaryKey(),
  payout_ref: text("payout_ref").notNull().unique(), // e.g. "PP-2026-00001"
  service_host_id: integer("service_host_id").notNull(),
  source_type: text("source_type"),   // work_order | booking_service | manual
  source_id: integer("source_id"),
  description: text("description"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("AUD"),
  status: text("status").notNull().default("Accrued"), // Accrued | Approved | Paid | Cancelled

  posting_key: text("posting_key"),   // GL accrual entry idempotency anchor
  accrued_at: timestamp("accrued_at", { withTimezone: true }).notNull().defaultNow(),
  approved_at: timestamp("approved_at", { withTimezone: true }),
  paid_at: timestamp("paid_at", { withTimezone: true }),
  created_by: integer("created_by"),

  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPartnerPayoutSchema = createInsertSchema(partnerPayoutsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertPartnerPayout = z.infer<typeof insertPartnerPayoutSchema>;
export type PartnerPayout = typeof partnerPayoutsTable.$inferSelect;
