import { pgTable, serial, text, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const beneficiariesTable = pgTable("beneficiaries", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contract_product_id: integer("contract_product_id"),
  account_id: integer("account_id").notNull(),
  commission_id: integer("commission_id"),
  commission_type: text("commission_type").notNull().default("Percentage"),
  split_percentage: real("split_percentage"),
  fixed_amount: real("fixed_amount"),
  priority: integer("priority").default(1),
  notes: text("notes"),
  status: text("status").notNull().default("Active"),
  deleted_at: timestamp("deleted_at"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBeneficiarySchema = createInsertSchema(beneficiariesTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertBeneficiary = z.infer<typeof insertBeneficiarySchema>;
export type Beneficiary = typeof beneficiariesTable.$inferSelect;
