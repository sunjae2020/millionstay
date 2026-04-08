import { pgTable, serial, text, real, boolean, integer, timestamp } from "drizzle-orm/pg-core";

export const serviceCatalogTable = pgTable("service_catalog", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  service_type: text("service_type").notNull().default("one_time"),
  // one_time | scheduled | physical
  base_price: real("base_price"),
  currency: text("currency").notNull().default("AUD"),
  is_optional: boolean("is_optional").notNull().default(true),
  is_refundable: boolean("is_refundable").notNull().default(false),
  billing_trigger: text("billing_trigger").notNull().default("at_booking"),
  // at_booking | at_checkout | on_request
  gst_included: boolean("gst_included").notNull().default(false),
  // scheduled service fields
  requires_scheduling: boolean("requires_scheduling").notNull().default(false),
  scheduling_notes: text("scheduling_notes"),
  // physical product fields
  stock_tracked: boolean("stock_tracked").notNull().default(false),
  stock_qty: integer("stock_qty"),
  has_variants: boolean("has_variants").notNull().default(false),
  variant_options: text("variant_options"),
  // display
  display_on_booking_page: boolean("display_on_booking_page").notNull().default(true),
  sort_order: integer("sort_order").notNull().default(0),
  status: text("status").notNull().default("Active"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type ServiceCatalog = typeof serviceCatalogTable.$inferSelect;
export type InsertServiceCatalog = typeof serviceCatalogTable.$inferInsert;
