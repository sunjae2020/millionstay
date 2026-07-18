import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";

export const workOrdersTable = pgTable("work_orders", {
  id: serial("id").primaryKey(),
  order_ref: text("order_ref").notNull().unique(),
  property_id: integer("property_id"),
  space_id: integer("space_id"),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("Open"),
  priority: text("priority").notNull().default("Normal"),
  category: text("category"),
  assigned_contact_id: integer("assigned_contact_id"),
  reported_at: text("reported_at"),
  scheduled_at: text("scheduled_at"),
  completed_at: timestamp("completed_at", { withTimezone: true }),
  cost: numeric("cost", { precision: 12, scale: 2, mode: "number" }),
  currency: text("currency").notNull().default("AUD"),
  notes: text("notes"),
  deleted_at: timestamp("deleted_at"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
