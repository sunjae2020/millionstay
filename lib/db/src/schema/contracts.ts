import { pgTable, serial, text, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const contractsTable = pgTable("contracts", {
  id: serial("id").primaryKey(),
  contract_ref: text("contract_ref").notNull().unique(),
  booking_id: integer("booking_id"),
  product_id: integer("product_id"),
  contract_product_id: integer("contract_product_id"),
  tenant_account_id: integer("tenant_account_id"),
  landlord_account_id: integer("landlord_account_id"),
  space_id: integer("space_id"),
  start_date: text("start_date"),
  end_date: text("end_date"),
  weekly_rate: real("weekly_rate"),
  total_rent: real("total_rent"),
  bond_amount: real("bond_amount"),
  advance_amount: real("advance_amount"),
  currency: text("currency").notNull().default("AUD"),
  status: text("status").notNull().default("Draft"),
  deleted_at: timestamp("deleted_at"),
  sent_at: timestamp("sent_at", { withTimezone: true }),
  signed_at: timestamp("signed_at", { withTimezone: true }),
  effective_date: text("effective_date"),
  expiry_date: text("expiry_date"),
  termination_reason: text("termination_reason"),
  document_url: text("document_url"),
  terms_text: text("terms_text"),
  notes: text("notes"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertContractSchema = createInsertSchema(contractsTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export type InsertContract = z.infer<typeof insertContractSchema>;
export type Contract = typeof contractsTable.$inferSelect;
