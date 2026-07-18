import { pgTable, serial, text, integer, real, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const contractProductsTable = pgTable("contract_products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  product_type: text("product_type").notNull().default("Room"),
  status: text("status").notNull().default("Draft"),
  space_id: integer("space_id"),
  promotion_id: integer("promotion_id"),
  term_type: text("term_type"),
  weekly_rate: numeric("weekly_rate", { precision: 12, scale: 2, mode: "number" }),
  monthly_rate: numeric("monthly_rate", { precision: 12, scale: 2, mode: "number" }),
  effective_weekly_rate: numeric("effective_weekly_rate", { precision: 12, scale: 2, mode: "number" }),
  currency: text("currency").notNull().default("AUD"),
  billing_frequency: text("billing_frequency").default("Biweekly"),
  bond_weeks: real("bond_weeks").default(4),
  bond_amount: numeric("bond_amount", { precision: 12, scale: 2, mode: "number" }),
  admin_fee: numeric("admin_fee", { precision: 12, scale: 2, mode: "number" }),
  cleaning_fee: numeric("cleaning_fee", { precision: 12, scale: 2, mode: "number" }),
  advance_weeks: real("advance_weeks").default(2),
  min_stay_weeks: integer("min_stay_weeks").default(1),
  max_stay_weeks: integer("max_stay_weeks"),
  includes_wifi: boolean("includes_wifi").notNull().default(false),
  includes_parking: boolean("includes_parking").notNull().default(false),
  includes_utilities: boolean("includes_utilities").notNull().default(false),
  includes_meals: boolean("includes_meals").notNull().default(false),
  includes_laundry: boolean("includes_laundry").notNull().default(false),
  includes_cleaning: boolean("includes_cleaning").notNull().default(false),
  extra_inclusions: text("extra_inclusions"),
  notes: text("notes"),
  deleted_at: timestamp("deleted_at"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertContractProductSchema = createInsertSchema(contractProductsTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export type InsertContractProduct = z.infer<typeof insertContractProductSchema>;
export type ContractProduct = typeof contractProductsTable.$inferSelect;
