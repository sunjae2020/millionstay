import { pgTable, serial, integer, date, text, numeric, timestamp, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * space_term_calendar — per-date "short-term conversion" markers.
 *
 * An owner can flag a date range on a space to operate under a different
 * contract term (currently only "short_term") with a per-night daily rate,
 * independent of the space's default product term. This is a lightweight
 * calendar marker + price: it does NOT (yet) wire into the booking pipeline.
 *
 * One row per (space_id, date), mirroring space_availability so the owner
 * calendar can render both layers cheaply.
 */
export const spaceTermCalendarTable = pgTable("space_term_calendar", {
  id: serial("id").primaryKey(),
  space_id: integer("space_id").notNull(),
  date: date("date").notNull(),
  // Term this date operates under. Closed set today, but text for forward-compat.
  // "short_term" is the only value the owner UI sets.
  term_type: text("term_type").notNull().default("short_term"),
  // Nightly price for the converted period. numeric → Drizzle returns string.
  daily_rate: numeric("daily_rate", { precision: 10, scale: 2 }),
  currency: text("currency").notNull().default("AUD"),
  note: text("note"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique().on(table.space_id, table.date),
  index("idx_space_term_space_date").on(table.space_id, table.date),
]);

export const insertSpaceTermCalendarSchema = createInsertSchema(spaceTermCalendarTable, {
  space_id: z.number().int().positive(),
  date: z.string(),
  term_type: z.string().optional(),
  daily_rate: z.string().optional().nullable(),
  currency: z.string().optional(),
  note: z.string().optional().nullable(),
}).omit({ id: true, created_at: true, updated_at: true });
