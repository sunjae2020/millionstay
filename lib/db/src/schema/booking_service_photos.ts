import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const bookingServicePhotosTable = pgTable("booking_service_photos", {
  id: serial("id").primaryKey(),
  booking_service_id: integer("booking_service_id").notNull(),
  file_url: text("file_url").notNull(),
  thumbnail_url: text("thumbnail_url"),
  cloudinary_id: text("cloudinary_id"),
  caption: text("caption"),
  uploaded_by_type: text("uploaded_by_type").notNull().default("partner"),
  uploaded_by_id: integer("uploaded_by_id"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BookingServicePhoto = typeof bookingServicePhotosTable.$inferSelect;
export type InsertBookingServicePhoto = typeof bookingServicePhotosTable.$inferInsert;
