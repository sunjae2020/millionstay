import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Homestay host AVAILABILITY — capacity/occupancy for the matching console
// (see HOMESTAY_WORKFLOW.md §6). The host application carries room details but
// no notion of how many students a host can take or currently hosts; ops needs
// this to filter "available" hosts when brokering a match. One row per host.
export const homestayHostAvailabilityTable = pgTable("homestay_host_availability", {
  id: serial("id").primaryKey(),
  host_application_id: integer("host_application_id").notNull().unique(), // homestay_host_applications.id
  capacity: integer("capacity").notNull().default(1),
  occupied: integer("occupied").notNull().default(0),
  notes: text("notes"),

  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertHomestayHostAvailabilitySchema = createInsertSchema(homestayHostAvailabilityTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertHomestayHostAvailability = z.infer<typeof insertHomestayHostAvailabilitySchema>;
export type HomestayHostAvailability = typeof homestayHostAvailabilityTable.$inferSelect;
