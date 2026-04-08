import { pgTable, serial, text, integer, real, boolean, timestamp } from "drizzle-orm/pg-core";

export const accommodationCatalogTable = pgTable("accommodation_catalog", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  item_description: text("item_description"),
  product_group_id: integer("product_group_id"),
  product_type_id: integer("product_type_id"),
  space_id: integer("space_id"),
  price: real("price"),
  currency: text("currency").notNull().default("AUD"),
  product_tag: text("product_tag"),
  gst_included: boolean("gst_included").notNull().default(false),
  commission_id: integer("commission_id"),
  product_source_account_id: integer("product_source_account_id"),
  product_provider_account_id: integer("product_provider_account_id"),
  min_contract_period: integer("min_contract_period"),
  min_contract_period_unit: text("min_contract_period_unit"),
  bond_amount: real("bond_amount"),
  admin_fee: real("admin_fee"),
  cleaning_fee: real("cleaning_fee"),
  display_on_booking_page: boolean("display_on_booking_page").notNull().default(true),
  display_on_invoice: boolean("display_on_invoice").notNull().default(true),
  status: text("status").notNull().default("Active"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type AccommodationCatalog = typeof accommodationCatalogTable.$inferSelect;
export type InsertAccommodationCatalog = typeof accommodationCatalogTable.$inferInsert;
