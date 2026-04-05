import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const productTypesTable = pgTable("product_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type ProductType = typeof productTypesTable.$inferSelect;
export type InsertProductType = typeof productTypesTable.$inferInsert;
