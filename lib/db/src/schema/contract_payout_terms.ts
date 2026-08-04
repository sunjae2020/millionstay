import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// CONTRACT PAYOUT TERMS (지급 조건) — who gets paid out of a contract's receipts,
// how much, and when. One contract has N rows: typically the property owner, any
// service partners, and the referring agent.
//
// This is the rule; provider_settlements is the resulting money. When a receipt
// lands, lib/billing/payout.ts reads the live terms, computes an amount per term
// and writes one settlement leg each — so the admin only ever presses "pay".
//
// Business rules (docs/proposals/ACCOUNTING_UNIFIED_SPEC.md §2):
//   landlord     default percent_of_rent (수취 월세의 %), may be fixed_monthly
//   agent        default fixed_once on the first receipt, may be percent_of_rent
//   service_host default fixed_once per job, may be percent_of_rent
//
// Money columns are numeric → Drizzle returns strings; wrap reads in Number(),
// writes in String().
export const contractPayoutTermsTable = pgTable("contract_payout_terms", {
  id: serial("id").primaryKey(),
  contract_id: integer("contract_id").notNull(), // contracts.id

  // landlord | service_host | agent — also selects the GL account pair
  // (see lib/billing/gl.ts settlementAccounts()).
  party_type: text("party_type").notNull(),
  payee_account_id: integer("payee_account_id"), // accounts.id
  // Free-text fallback when the payee has no CRM account. REQUIRED when
  // payee_account_id is null — a payout row with no identifiable recipient
  // cannot be audited.
  payee_name: text("payee_name").notNull().default(""),

  // percent_of_rent | fixed_monthly | fixed_once
  basis: text("basis").notNull(),
  // basis=percent_of_rent → applied to the receipt's charge_kind='rent' total ONLY.
  rate: numeric("rate", { precision: 5, scale: 2 }),
  // basis=fixed_monthly | fixed_once
  amount: numeric("amount", { precision: 14, scale: 2 }),
  currency: text("currency").notNull().default("KRW"),

  // on_ar_paid (기본, 고객 입금 시 자동 생성) | manual
  trigger: text("trigger").notNull().default("on_ar_paid"),
  // monthly | once | per_job.
  // 'once' fires on the FIRST qualifying receipt only — enforced by a partial
  // unique index on term_id in provider_settlements, without which an agent
  // referral fee would re-accrue every single month.
  cadence: text("cadence").notNull().default("monthly"),

  effective_from: text("effective_from"), // YYYY-MM-DD; null = contract start
  effective_to: text("effective_to"),     // YYYY-MM-DD; null = open-ended

  status: text("status").notNull().default("Active"), // Active | Inactive
  notes: text("notes"),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertContractPayoutTermSchema = createInsertSchema(contractPayoutTermsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertContractPayoutTerm = z.infer<typeof insertContractPayoutTermSchema>;
export type ContractPayoutTerm = typeof contractPayoutTermsTable.$inferSelect;

export const PAYOUT_PARTY_TYPES = ["landlord", "service_host", "agent"] as const;
export const PAYOUT_BASES = ["percent_of_rent", "fixed_monthly", "fixed_once"] as const;
export const PAYOUT_TRIGGERS = ["on_ar_paid", "manual"] as const;
export const PAYOUT_CADENCES = ["monthly", "once", "per_job"] as const;
