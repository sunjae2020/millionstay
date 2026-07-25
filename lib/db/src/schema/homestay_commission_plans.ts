import { pgTable, serial, integer, text, boolean, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Homestay agent COMMISSION PLANS — per-company differentiated commission
// (see HOMESTAY_WORKFLOW.md §8). The existing `commissions` table is single
// account-scoped value with no stacking/payout tracking, so homestay uses its
// own plan model.
//
// Confirmed formula (base = the upfront payment: placement fee + first month):
//   commission = fixed_referral_fee + (base × percentage_rate%)   when `stack`
// If `stack` is false, only the configured component(s) apply.
// Money/rate columns are numeric → strings.
export const homestayCommissionPlansTable = pgTable("homestay_commission_plans", {
  id: serial("id").primaryKey(),
  account_id: integer("account_id").notNull(), // agent accounts.id
  name: text("name"),
  fixed_referral_fee: numeric("fixed_referral_fee", { precision: 10, scale: 2 }).notNull().default("0"),
  percentage_rate: numeric("percentage_rate", { precision: 5, scale: 2 }).notNull().default("0"), // 10.00 = 10%
  stack: boolean("stack").notNull().default(true), // apply fixed + percentage together
  // What the percentage_rate applies to (the commission base):
  //   upfront   = placement_fee + deposit (legacy default; unchanged behaviour)
  //   monthly   = one month's rent (monthly_fee)
  //   converted = deposit + monthly_fee × 100 (Korean 환산보증금 for 월세 brokerage)
  base_type: text("base_type").notNull().default("upfront"),
  status: text("status").notNull().default("Active"), // Active | Archived

  deleted_at: timestamp("deleted_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertHomestayCommissionPlanSchema = createInsertSchema(homestayCommissionPlansTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertHomestayCommissionPlan = z.infer<typeof insertHomestayCommissionPlanSchema>;
export type HomestayCommissionPlan = typeof homestayCommissionPlansTable.$inferSelect;
