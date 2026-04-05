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
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  unique().on(table.space_id, table.date),
  index("idx_space_avail_space_date").on(table.space_id, table.date),
]);

export const insertSpaceAvailabilitySchema = createInsertSchema(spaceAvailabilityTable, {
  space_id: z.number().int().positive(),
  date: z.string(),
  block_reason: z.string().optional().nullable(),
  booking_id: z.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
}).omit({ id: true, created_at: true });
