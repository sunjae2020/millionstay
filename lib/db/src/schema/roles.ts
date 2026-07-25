import { pgTable, serial, text, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ROLES — data-driven RBAC. Replaces the scattered hard-coded `if SuperAdmin`
// checks with an editable role → permission matrix. Each role carries a
// `permissions` map of { <resource>: "none" | "read" | "write" }; write implies
// read. Enforcement (artifacts/api-server/src/lib/rbac.ts) is FAIL-OPEN: a
// resource left unset, an unmapped route, or an unknown role is allowed, so the
// matrix can only ever ADD restrictions and never locks admins out by omission.
// SuperAdmin always bypasses. admin_users.role holds the role name (text).
export const rolesTable = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),        // e.g. "SuperAdmin" | "Admin" | "Viewer" | custom
  description: text("description"),
  is_system: boolean("is_system").notNull().default(false), // system roles can't be deleted/renamed
  // { finance: "write", bookings: "read", users: "none", ... }
  permissions: jsonb("permissions").notNull().default({}),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertRoleSchema = createInsertSchema(rolesTable).omit({ id: true, created_at: true, updated_at: true });
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type Role = typeof rolesTable.$inferSelect;
