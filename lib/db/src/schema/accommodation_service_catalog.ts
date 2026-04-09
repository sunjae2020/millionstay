import { pgTable, serial, integer, real, boolean, timestamp } from "drizzle-orm/pg-core";

export const accommodationServiceCatalogTable = pgTable("accommodation_service_catalog", {
  id: serial("id").primaryKey(),
  accommodation_id: integer("accommodation_id").notNull(),
  service_id: integer("service_id").notNull(),
  is_mandatory: boolean("is_mandatory").notNull().default(false),
  custom_price: real("custom_price"),
  sort_order: integer("sort_order").notNull().default(0),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type AccommodationServiceCatalog = typeof accommodationServiceCatalogTable.$inferSelect;
export type InsertAccommodationServiceCatalog = typeof accommodationServiceCatalogTable.$inferInsert;
