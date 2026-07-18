import { pgTable, serial, integer, numeric, boolean, timestamp } from "drizzle-orm/pg-core";

export const spaceServiceCatalogTable = pgTable("space_service_catalog", {
  id: serial("id").primaryKey(),
  space_id: integer("space_id").notNull(),
  service_id: integer("service_id").notNull(),
  is_mandatory: boolean("is_mandatory").notNull().default(false),
  custom_price: numeric("custom_price", { precision: 12, scale: 2, mode: "number" }),
  sort_order: integer("sort_order").notNull().default(0),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type SpaceServiceCatalog = typeof spaceServiceCatalogTable.$inferSelect;
export type InsertSpaceServiceCatalog = typeof spaceServiceCatalogTable.$inferInsert;
