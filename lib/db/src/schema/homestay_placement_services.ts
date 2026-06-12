import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Homestay placement SERVICES — airport pickup / initial settlement jobs tied
// to a placement and assigned to a service host (the cooperating partner).
// Mirrors the booking_services pattern, but linked to a placement instead of a
// booking (see HOMESTAY_WORKFLOW.md §6).
//
// IMPORTANT — VISIBILITY: this data must NEVER appear in student or agent
// portal responses (the existing masking policy already hides service_hosts /
// booking_services from guest + agent portals). Only ops (property-admin) and
// the assigned service host see it.
export const homestayPlacementServicesTable = pgTable("homestay_placement_services", {
  id: serial("id").primaryKey(),
  placement_id: integer("placement_id").notNull(), // homestay_placements.id
  service_id: integer("service_id"),               // service_hosts.id — null until assigned
  service_type: text("service_type").notNull(),    // airport_pickup | initial_settlement | ...
  status: text("status").notNull().default("Pending"), // Pending | Assigned | Scheduled | Completed | Cancelled
  scheduled_at: timestamp("scheduled_at", { withTimezone: true }),
  price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("AUD"),
  notes: text("notes"),

  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertHomestayPlacementServiceSchema = createInsertSchema(homestayPlacementServicesTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertHomestayPlacementService = z.infer<typeof insertHomestayPlacementServiceSchema>;
export type HomestayPlacementService = typeof homestayPlacementServicesTable.$inferSelect;
