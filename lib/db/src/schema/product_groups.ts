import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const productGroupsTable = pgTable("product_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  display_order: integer("display_order").notNull().default(0),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type ProductGroup = typeof productGroupsTable.$inferSelect;
export type InsertProductGroup = typeof productGroupsTable.$inferInsert;
