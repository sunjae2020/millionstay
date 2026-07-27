import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Optional one-off costs tied to a contract (입주청소 / 임대수수료 / 부동산 수수료 등).
// A contract may have 0 rows or several — cost_type is free-text (freely extensible),
// each row records 송금일(remitted_on) / 이름(payee_name) / 송금액(amount) / 비고(note).
export const contractRelatedCostsTable = pgTable("contract_related_costs", {
  id: serial("id").primaryKey(),
  contract_id: integer("contract_id").notNull(),
  cost_type: text("cost_type").notNull(),
  remitted_on: text("remitted_on"),
  payee_name: text("payee_name").notNull().default(""),
  amount: numeric("amount", { precision: 14, scale: 2, mode: "number" }).notNull().default(0),
  currency: text("currency").notNull().default("AUD"),
  note: text("note").notNull().default(""),
  status: text("status").notNull().default("Active"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
});

export const insertContractRelatedCostSchema = createInsertSchema(contractRelatedCostsTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export type InsertContractRelatedCost = z.infer<typeof insertContractRelatedCostSchema>;
export type ContractRelatedCost = typeof contractRelatedCostsTable.$inferSelect;
