import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const guestUsersTable = pgTable("guest_users", {
  id: serial("id").primaryKey(),
  account_id: integer("account_id"),
  email: text("email").notNull().unique(),
  password_hash: text("password_hash").notNull(),
  first_name: text("first_name"),
  last_name: text("last_name"),
  phone: text("phone"),
  is_active: boolean("is_active").notNull().default(true),
  email_verified: boolean("email_verified").notNull().default(false),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertGuestUserSchema = createInsertSchema(guestUsersTable).omit({
  id: true, created_at: true, updated_at: true,
});

export type InsertGuestUser = z.infer<typeof insertGuestUserSchema>;
export type GuestUser = typeof guestUsersTable.$inferSelect;
