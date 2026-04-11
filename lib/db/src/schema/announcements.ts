import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const announcementsTable = pgTable("announcements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  category: text("category").notNull().default("General"),
  priority: text("priority").notNull().default("Normal"),
  is_published: integer("is_published").notNull().default(0),
  published_at: timestamp("published_at", { withTimezone: true }),
  expires_at: timestamp("expires_at", { withTimezone: true }),
  created_by: integer("created_by"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Announcement = typeof announcementsTable.$inferSelect;
export type InsertAnnouncement = typeof announcementsTable.$inferInsert;

export const guestDirectMessagesTable = pgTable("guest_direct_messages", {
  id: serial("id").primaryKey(),
  guest_user_id: integer("guest_user_id").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  sender_name: text("sender_name").notNull().default("MillionStay Team"),
  is_read: integer("is_read").notNull().default(0),
  read_at: timestamp("read_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GuestDirectMessage = typeof guestDirectMessagesTable.$inferSelect;
export type InsertGuestDirectMessage = typeof guestDirectMessagesTable.$inferInsert;
