import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const partnerUsersTable = pgTable("partner_users", {
  id: serial("id").primaryKey(),
  account_id: integer("account_id").notNull(),
  portal_type: text("portal_type").notNull(), // 'agent' | 'owner'
  email: text("email").notNull().unique(),
  password_hash: text("password_hash").notNull(),
  first_name: text("first_name"),
  last_name: text("last_name"),
  phone: text("phone"),
  avatar_url: text("avatar_url"),
  is_active: boolean("is_active").notNull().default(true),
  last_login_at: timestamp("last_login_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPartnerUserSchema = createInsertSchema(partnerUsersTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertPartnerUser = z.infer<typeof insertPartnerUserSchema>;
export type PartnerUser = typeof partnerUsersTable.$inferSelect;
