import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const contactsTable = pgTable("contacts", {
  id: serial("id").primaryKey(),
  first_name: text("first_name").notNull(),
  last_name: text("last_name").notNull(),
  title: text("title"),
  other_name: text("other_name"),
  // Nullable since the 2026 Korean lease-list migration: bulk-imported tenants
  // often have no email on record (phone is the contact channel in KR leases).
  email: text("email"),
  mobile_number: text("mobile_number"),
  office_number: text("office_number"),
  date_of_birth: text("date_of_birth"),
  nationality: text("nationality"),
  gender: text("gender"),
  sns_id: text("sns_id"),
  // Business-card fields (populated manually or by the AI business-card OCR).
  // `title` above is the honorific (Mr/Ms) — `job_title` is the role on the card.
  company_name: text("company_name"),
  job_title: text("job_title"),
  department: text("department"),
  website: text("website"),
  passport_number: text("passport_number"),
  passport_expiry: text("passport_expiry"),
  visa_type: text("visa_type"),
  visa_expiry: text("visa_expiry"),
  address_line1: text("address_line1"),
  suburb: text("suburb"),
  state: text("state"),
  postcode: text("postcode"),
  country: text("country"),
  portal_enabled: boolean("portal_enabled").notNull().default(false),
  portal_user_id: text("portal_user_id"),
  profile_photo_url: text("profile_photo_url"),
  description: text("description"),
  manual_input: boolean("manual_input").notNull().default(false),
  status: text("status").notNull().default("Active"),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertContactSchema = createInsertSchema(contactsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contactsTable.$inferSelect;
