import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// PROVIDER SETTLEMENTS — the unified payout ledger. One row = one LEG of a
// customer receipt after we split it (docs/proposals/ACCOUNTING_UNIFIED_SPEC.md §3).
//
//   고객 결제 1건  →  집주인 렌트 leg + 파트너 leg + 에이전트 leg + 유보 leg
//
// The invariant that makes this trustworthy:
//
//     수취 총액 === Σ legs        (balanced)
//     실 매출   === retained leg  (split_role='internal_transfer')
//
// So net revenue is not a subtraction performed in a report — it is a row that
// exists, and a receipt whose legs don't add up shows as unbalanced instead of
// silently under-paying someone.
//
// The retained leg carries NO posting_key: net revenue already falls out of the
// ledger (Revenue − cost accounts), and journalling it again would double-count
// the same profit. It exists for reconciliation and for the settlement board.
//
// Money columns are numeric → Drizzle returns strings; wrap reads in Number(),
// writes in String().
export const providerSettlementsTable = pgTable("provider_settlements", {
  id: serial("id").primaryKey(),
  settlement_ref: text("settlement_ref").notNull().unique(), // e.g. "PS-2026-00001"

  // landlord | service_host | agent | retained
  party_type: text("party_type").notNull(),
  payee_account_id: integer("payee_account_id"), // accounts.id
  payee_name: text("payee_name").notNull().default(""),

  // ── Leg linkage: which receipt did this split out of ──
  contract_id: integer("contract_id"),
  source_type: text("source_type"),  // invoice | placement_payment
  source_id: integer("source_id"),
  // external_payment = money leaving us · internal_transfer = the retained margin
  split_role: text("split_role").notNull().default("external_payment"),

  // ── Why this amount (audit trail) ──
  // The rule is snapshotted at calculation time, so editing a rate later never
  // rewrites what was already settled.
  term_id: integer("term_id"),        // contract_payout_terms.id
  basis_snapshot: text("basis_snapshot"),
  rate_snapshot: numeric("rate_snapshot", { precision: 5, scale: 2 }),
  base_amount: numeric("base_amount", { precision: 14, scale: 2 }),

  // gross_amount − deduction_amount = amount (the NET actually paid out).
  gross_amount: numeric("gross_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  deduction_amount: numeric("deduction_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("KRW"),

  // due → approved → paid (+ cancelled). Only 'paid' closes the line.
  // Rows past 'due' are read-only for amount edits — the figure is on a document
  // by then; corrections go through cancel + reissue.
  status: text("status").notNull().default("due"),
  method: text("method"), // bank_transfer | stripe | ...
  approved_at: timestamp("approved_at", { withTimezone: true }),
  paid_at: timestamp("paid_at", { withTimezone: true }),

  notes: text("notes"),
  created_by: integer("created_by"),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProviderSettlementSchema = createInsertSchema(providerSettlementsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertProviderSettlement = z.infer<typeof insertProviderSettlementSchema>;
export type ProviderSettlement = typeof providerSettlementsTable.$inferSelect;

export const SETTLEMENT_STATUSES = ["due", "approved", "paid", "cancelled"] as const;
export const SETTLEMENT_SPLIT_ROLES = ["external_payment", "internal_transfer"] as const;
