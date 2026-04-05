import { pgTable, serial, integer, varchar, boolean, timestamp } from "drizzle-orm/pg-core";

export const spaceImagesTable = pgTable("space_images", {
  id: serial("id").primaryKey(),
  space_id: integer("space_id").notNull(),
  file_url: varchar("file_url", { length: 500 }).notNull(),
  thumbnail_url: varchar("thumbnail_url", { length: 500 }),
  cloudinary_id: varchar("cloudinary_id", { length: 200 }),
  caption: varchar("caption", { length: 300 }),
  is_primary: boolean("is_primary").notNull().default(false),
  display_order: integer("display_order").notNull().default(0),
  file_size_bytes: integer("file_size_bytes"),
  mime_type: varchar("mime_type", { length: 100 }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SpaceImage = typeof spaceImagesTable.$inferSelect;
