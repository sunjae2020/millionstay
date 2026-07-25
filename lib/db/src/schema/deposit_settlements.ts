import { pgTable, serial, integer, text, numeric, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// DEPOSIT SETTLEMENT — move-out reconciliation of the refundable security
// deposit (MetHeim vision stage 5; see docs/proposals/CONDITION_REPORTS_SETTLEMENT.md).
//
// Built on the booking spine + the move-out condition_report (phase='move_out')
// vs the move-in baseline. `deposit_held` is snapshotted from the actually-paid
// deposit line items (invoice_line_items.line_type='deposit'), which equals the
// booking's Deposits Held (2100) liability balance. On finalize a single GL
// entry releases the liability: Dr Deposits Held / Cr Cash (refund) + Cr Revenue
// (forfeited deductions), balancing because held = refund + deducted.
//
// Money columns are numeric → Drizzle returns strings; wrap reads in Number(),
// writes in String().
export const depositSettlementsTable = pgTable("deposit_settlements", {
  id: serial("id").primaryKey(),
  settlement_ref: text("settlement_ref").notNull().unique(), // e.g. "DS-2026-00001"
  booking_id: integer("booking_id").notNull(),
  move_out_report_id: integer("move_out_report_id"), // condition_reports.id (phase='move_out')
  status: text("status").notNull().default("draft"),
  // draft → proposed → tenant_ack → finalized  (+ cancelled)

  deposit_held: numeric("deposit_held", { precision: 10, scale: 2 }).notNull().default("0"),
  total_deducted: numeric("total_deducted", { precision: 10, scale: 2 }).notNull().default("0"),
  refund_amount: numeric("refund_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("AUD"),

  notes: text("notes"),
  created_by: integer("created_by"),
  proposed_at: timestamp("proposed_at", { withTimezone: true }),
  tenant_ack_at: timestamp("tenant_ack_at", { withTimezone: true }),
  finalized_at: timestamp("finalized_at", { withTimezone: true }),

  // GL posting key of the finalize journal entry (idempotency anchor).
  posting_key: text("posting_key"),
  audit_trail: jsonb("audit_trail").notNull().default([]),

  deleted_at: timestamp("deleted_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// One damage/charge line deducted from the deposit, each linked to condition
// evidence (a move-out report item + before/after photos).
export const depositDeductionItemsTable = pgTable("deposit_deduction_items", {
  id: serial("id").primaryKey(),
  deposit_settlement_id: integer("deposit_settlement_id").notNull(),
  condition_item_id: integer("condition_item_id"), // condition_report_items.id — evidence
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull().default("0"),
  photo_ids: jsonb("photo_ids").notNull().default([]), // condition_report_photos.id[]
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDepositSettlementSchema = createInsertSchema(depositSettlementsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertDepositSettlement = z.infer<typeof insertDepositSettlementSchema>;
export type DepositSettlement = typeof depositSettlementsTable.$inferSelect;
export type DepositDeductionItem = typeof depositDeductionItemsTable.$inferSelect;
