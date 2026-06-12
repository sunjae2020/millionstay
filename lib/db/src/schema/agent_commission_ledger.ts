import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Agent COMMISSION LEDGER — per-placement commission accrual + payout tracking
// (see HOMESTAY_WORKFLOW.md §8). The existing system has NO payout tracking,
// so this records each placement's earned commission and its payout state.
//
// Because the commission base is the one-time upfront payment, one ledger row
// is created per placement at confirmation (no monthly accrual).
//   Pending → Approved → Paid
// Money columns are numeric → strings.
export const agentCommissionLedgerTable = pgTable("agent_commission_ledger", {
  id: serial("id").primaryKey(),
  placement_id: integer("placement_id").notNull(),   // homestay_placements.id
  agent_account_id: integer("agent_account_id").notNull(), // accounts.id
  plan_id: integer("plan_id"),                       // homestay_commission_plans.id used

  base_amount: numeric("base_amount", { precision: 10, scale: 2 }).notNull().default("0"), // upfront the % applied to
  fixed_component: numeric("fixed_component", { precision: 10, scale: 2 }).notNull().default("0"),
  percentage_component: numeric("percentage_component", { precision: 10, scale: 2 }).notNull().default("0"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull().default("0"), // total commission
  currency: text("currency").notNull().default("AUD"),

  status: text("status").notNull().default("Pending"), // Pending | Approved | Paid
  approved_at: timestamp("approved_at", { withTimezone: true }),
  paid_at: timestamp("paid_at", { withTimezone: true }),
  notes: text("notes"),

  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAgentCommissionLedgerSchema = createInsertSchema(agentCommissionLedgerTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertAgentCommissionLedger = z.infer<typeof insertAgentCommissionLedgerSchema>;
export type AgentCommissionLedger = typeof agentCommissionLedgerTable.$inferSelect;
