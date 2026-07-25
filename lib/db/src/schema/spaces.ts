import { pgTable, serial, text, boolean, integer, real, numeric, timestamp, unique, jsonb } from "drizzle-orm/pg-core";
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
  base_weekly_price: numeric("base_weekly_price", { precision: 12, scale: 2, mode: "number" }),
  base_daily_price: numeric("base_daily_price", { precision: 12, scale: 2, mode: "number" }),
  base_currency: text("base_currency"),
  floor_number: integer("floor_number"),
  floor_area_sqm: real("floor_area_sqm"),
  description: text("description"),
  // @deprecated single-feed import; OTA integration uses channel_listings.ical_import_url
  // (one space can be listed on multiple channels). Kept until data is migrated.
  ical_import_url: text("ical_import_url"),
  // Secret token for the outbound .ics feed (same content for every channel),
  // served at /public/spaces/:id/calendar/:token.ics — prevents enumeration.
  ical_export_token: text("ical_export_token"),
  status: text("status").notNull().default("Active"),
  property_id: integer("property_id"),
  parent_space_id: integer("parent_space_id"),
  space_policy_id: integer("space_policy_id"),
  landlord_account_id: integer("landlord_account_id"),
  // Privacy settings
  privacy_hide_unit_no: boolean("privacy_hide_unit_no").notNull().default(true),
  privacy_hide_street_no: boolean("privacy_hide_street_no").notNull().default(true),
  privacy_map_blur: boolean("privacy_map_blur").notNull().default(true),
  // Per-locale copy for the guest site. Source columns (name/description/
  // custom_type_name) hold the authored original; this jsonb holds translations
  // keyed by language: { [lang]: { name, description, custom_type_name, _source } }
  // where _source is "machine" (AI, unreviewed) or "human" (admin-reviewed).
  translations: jsonb("translations").default({}),
  deleted_at: timestamp("deleted_at"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const spaceOptionMapsTable = pgTable("space_option_maps", {
  id: serial("id").primaryKey(),
  space_id: integer("space_id").notNull(),
  space_option_id: integer("space_option_id").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// @deprecated Superseded by space_availability as the single source of truth
// (SSOT) for the calendar. New code (incl. OTA sync) must write to
// space_availability. Retained only until existing usages are migrated off.
export const spaceBlockedDatesTable = pgTable("space_blocked_dates", {
  id: serial("id").primaryKey(),
  space_id: integer("space_id").notNull(),
  date: text("date").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // First-come booking gate: one block row per (space, date). Makes the
  // onConflictDoNothing insert in blockDatesForBooking an atomic claim so two
  // concurrent confirms can't double-book the same space/date (H-301).
  unique("space_blocked_dates_space_id_date_uq").on(table.space_id, table.date),
]);

export const insertSpaceSchema = createInsertSchema(spacesTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export type InsertSpace = z.infer<typeof insertSpaceSchema>;
export type Space = typeof spacesTable.$inferSelect;
