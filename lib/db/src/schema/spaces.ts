import { pgTable, serial, text, boolean, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const spacesTable = pgTable("spaces", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  manual_input: boolean("manual_input").notNull().default(false),
  space_type: text("space_type"),
  custom_type_name: text("custom_type_name"),
  max_occupancy: integer("max_occupancy"),
  booking_mode: text("booking_mode"),
  base_weekly_price: real("base_weekly_price"),
  base_daily_price: real("base_daily_price"),
  base_currency: text("base_currency"),
  floor_number: integer("floor_number"),
  floor_area_sqm: real("floor_area_sqm"),
  description: text("description"),
  ical_import_url: text("ical_import_url"),
  status: text("status").notNull().default("Active"),
  property_id: integer("property_id"),
  parent_space_id: integer("parent_space_id"),
  space_policy_id: integer("space_policy_id"),
  landlord_account_id: integer("landlord_account_id"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const spaceOptionMapsTable = pgTable("space_option_maps", {
  id: serial("id").primaryKey(),
  space_id: integer("space_id").notNull(),
  space_option_id: integer("space_option_id").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const spaceBlockedDatesTable = pgTable("space_blocked_dates", {
  id: serial("id").primaryKey(),
  space_id: integer("space_id").notNull(),
  date: text("date").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSpaceSchema = createInsertSchema(spacesTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export type InsertSpace = z.infer<typeof insertSpaceSchema>;
export type Space = typeof spacesTable.$inferSelect;
