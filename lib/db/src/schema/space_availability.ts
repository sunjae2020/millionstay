import { pgTable, serial, integer, date, boolean, text, timestamp, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const spaceAvailabilityTable = pgTable("space_availability", {
  id: serial("id").primaryKey(),
  space_id: integer("space_id").notNull(),
  date: date("date").notNull(),
  is_available: boolean("is_available").notNull().default(true),
  block_reason: text("block_reason"),
  booking_id: integer("booking_id"),
  notes: text("notes"),
  // OTA integration: who created this block, so re-syncs stay idempotent.
  // "manual" | "booking" | "ical" | "channel_api"
  source: text("source").notNull().default("manual"),
  channel_listing_id: integer("channel_listing_id"), // source listing for channel-originated blocks
  external_uid: text("external_uid"), // iCal VEVENT UID or external reservation id
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique().on(table.space_id, table.date),
  index("idx_space_avail_space_date").on(table.space_id, table.date),
  index("idx_space_avail_source").on(table.space_id, table.source),
  // Lets channel imports upsert/clear blocks by their external identity.
  unique("space_avail_external_uid_uq").on(table.channel_listing_id, table.external_uid),
]);

export const insertSpaceAvailabilitySchema = createInsertSchema(spaceAvailabilityTable, {
  space_id: z.number().int().positive(),
  date: z.string(),
  block_reason: z.string().optional().nullable(),
  booking_id: z.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
}).omit({ id: true, created_at: true });
