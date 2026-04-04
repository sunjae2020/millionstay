import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const accountsTable = pgTable("accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  account_type: text("account_type").notNull(),
  primary_contact_id: integer("primary_contact_id"),
  secondary_contact_id: integer("secondary_contact_id"),
  account_email: text("account_email"),
  website_url: text("website_url"),
  phone1: text("phone1"),
  phone2: text("phone2"),
  address_line1: text("address_line1"),
  address_suburb: text("address_suburb"),
  address_state: text("address_state"),
  address_postcode: text("address_postcode"),
  address_country: text("address_country"),
  secondary_address_line1: text("secondary_address_line1"),
  secondary_address_suburb: text("secondary_address_suburb"),
  secondary_address_state: text("secondary_address_state"),
  secondary_address_postcode: text("secondary_address_postcode"),
  secondary_address_country: text("secondary_address_country"),
  payment_info_id: integer("payment_info_id"),
  default_commission_id: integer("default_commission_id"),
  default_currency: text("default_currency").default("AUD"),
  parent_account_id: integer("parent_account_id"),
  description: text("description"),
  manual_input: boolean("manual_input").notNull().default(false),
  status: text("status").notNull().default("Active"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAccountSchema = createInsertSchema(accountsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accountsTable.$inferSelect;
