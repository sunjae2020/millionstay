import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const guestEmergencyContactsTable = pgTable("guest_emergency_contacts", {
  id: serial("id").primaryKey(),
  guest_user_id: integer("guest_user_id").notNull(),
  name: text("name").notNull(),
  relationship: text("relationship"),
  phone: text("phone"),
  email: text("email"),
  is_primary: boolean("is_primary").notNull().default(false),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type GuestEmergencyContact = typeof guestEmergencyContactsTable.$inferSelect;
export type InsertGuestEmergencyContact = typeof guestEmergencyContactsTable.$inferInsert;
