import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const usersTable = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password_hash: text("password_hash").notNull(),
  role: text("role").notNull().default("Admin"),
  first_name: text("first_name").notNull().default(""),
  last_name: text("last_name").notNull().default(""),
  is_active: boolean("is_active").notNull().default(true),
  status: text("status").notNull().default("active"),
  force_password_change: boolean("force_password_change").notNull().default(false),
  reset_token: text("reset_token"),
  reset_token_expires_at: timestamp("reset_token_expires_at", { withTimezone: true }),
  last_login_at: timestamp("last_login_at", { withTimezone: true }),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type AdminUser = typeof usersTable.$inferSelect;
export type InsertAdminUser = typeof usersTable.$inferInsert;
