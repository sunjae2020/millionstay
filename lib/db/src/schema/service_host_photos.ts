import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";

// Photos attached directly to a service host (partner), as opposed to
// `booking_service_photos` which hang off one job. Admins upload these from the
// service-host detail "사진" tab — certificates, vehicles, team photos, before/after
// evidence that is not tied to a single booking. Both sets are merged on read.
export const serviceHostPhotosTable = pgTable(
  "service_host_photos",
  {
    id: serial("id").primaryKey(),
    service_host_id: integer("service_host_id").notNull(),
    file_url: text("file_url").notNull(),
    thumbnail_url: text("thumbnail_url"),
    cloudinary_id: text("cloudinary_id"),
    caption: text("caption"),
    uploaded_by_type: text("uploaded_by_type").notNull().default("admin"),
    uploaded_by_id: integer("uploaded_by_id"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("service_host_photos_host_id_idx").on(t.service_host_id)],
);

export type ServiceHostPhoto = typeof serviceHostPhotosTable.$inferSelect;
export type InsertServiceHostPhoto = typeof serviceHostPhotosTable.$inferInsert;
