import { pgTable, serial, integer, text, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const contractLineItemsTable = pgTable("contract_line_items", {
  id: serial("id").primaryKey(),
  contract_id: integer("contract_id").notNull(),
  item_type: text("item_type").notNull().default("Rent"),
  name: text("name").notNull(),
  billing_trigger: text("billing_trigger").notNull().default("recurring"),
  billing_frequency: text("billing_frequency"),
  unit_price: numeric("unit_price", { precision: 10, scale: 2 }).notNull().default("0"),
  quantity: integer("quantity").notNull().default(1),
  total_price: numeric("total_price", { precision: 10, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("AUD"),
  gst_included: boolean("gst_included").notNull().default(true),
  service_id: integer("service_id"),
  notes: text("notes"),
  status: text("status").notNull().default("Active"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
});
