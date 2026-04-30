import { pgTable, serial, text, integer, boolean, timestamp, date, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bookingsTable = pgTable("bookings", {
  id: serial("id").primaryKey(),
  booking_ref: text("booking_ref").notNull().unique(),
  name: text("name"),
  account_id: integer("account_id"),
  contact_id: integer("contact_id"),
  booking_status: text("booking_status").notNull().default("Draft"),
  booking_source: text("booking_source"),
  customer_notes: text("customer_notes"),
  space_id: integer("space_id"),
  check_in_date: date("check_in_date"),
  check_out_date: date("check_out_date"),
  stay_nights: integer("stay_nights"),
  stay_weeks: numeric("stay_weeks", { precision: 6, scale: 2 }),
  agreed_weekly_rate: numeric("agreed_weekly_rate", { precision: 12, scale: 2 }),
  total_rent: numeric("total_rent", { precision: 12, scale: 2 }),
  currency: text("currency").default("AUD"),
  exchange_rate_to_aud: numeric("exchange_rate_to_aud", { precision: 18, scale: 8 }),
  num_guests: integer("num_guests").default(1),
  product_id: integer("product_id"),
  contract_product_id: integer("contract_product_id"),
  agent_account_id: integer("agent_account_id"),
  cancellation_reason: text("cancellation_reason"),
  cancelled_at: timestamp("cancelled_at", { withTimezone: true }),
  status: text("status").notNull().default("Active"),
  deleted_at: timestamp("deleted_at"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const bookingDocumentsTable = pgTable("booking_documents", {
  id: serial("id").primaryKey(),
  booking_id: integer("booking_id").notNull(),
  doc_type: text("doc_type"),
  file_name: text("file_name"),
  file_url: text("file_url"),
  verified_status: text("verified_status").notNull().default("Pending"),
  rejection_reason: text("rejection_reason"),
  expiry_date: date("expiry_date"),
  status: text("status").notNull().default("Active"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const bookingServicesTable = pgTable("booking_services", {
  id: serial("id").primaryKey(),
  booking_id: integer("booking_id").notNull(),
  service_id: integer("service_id"),
  name: text("name").notNull(),
  service_type: text("service_type").default("one_time"),
  quantity: integer("quantity").notNull().default(1),
  unit_price: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  total_price: numeric("total_price", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("AUD"),
  exchange_rate_to_aud: numeric("exchange_rate_to_aud", { precision: 18, scale: 8 }),
  billing_trigger: text("billing_trigger").default("at_booking"),
  frequency: text("frequency"),
  notes: text("notes"),
  status: text("status").notNull().default("Active"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBookingSchema = createInsertSchema(bookingsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookingsTable.$inferSelect;

export const insertBookingDocumentSchema = createInsertSchema(bookingDocumentsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertBookingDocument = z.infer<typeof insertBookingDocumentSchema>;
export type BookingDocument = typeof bookingDocumentsTable.$inferSelect;

export const insertBookingServiceSchema = createInsertSchema(bookingServicesTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertBookingService = z.infer<typeof insertBookingServiceSchema>;
export type BookingService = typeof bookingServicesTable.$inferSelect;
