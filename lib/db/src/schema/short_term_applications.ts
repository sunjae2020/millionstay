import { pgTable, serial, integer, text, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Short-term accommodation application — public intake for guests applying for a
// short-stay (sub-lease / serviced accommodation) booking. Mirrors the homestay
// STUDENT request flow: a submitted application creates a contract_signing_requests
// row (context_type='short_term_app') for the applicant to e-sign the application
// and T&C at /sign/:token, then flows through an admin-brokered ops queue.
export const shortTermApplicationsTable = pgTable("short_term_applications", {
  id: serial("id").primaryKey(),
  request_ref: text("request_ref").notNull().unique(), // e.g. "STA-2026-00001"
  status: text("status").notNull().default("Submitted"),
  // Draft | Submitted | UnderReview | Confirmed | Placed | Completed | Cancelled | Rejected

  // ── Submission channel ───────────────────────────────────────────────────
  account_id: integer("account_id"),

  // ── Applicant ──────────────────────────────────────────────────────────────
  first_name: text("first_name").notNull(),
  last_name: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  nationality: text("nationality"),

  // ── Stay details ───────────────────────────────────────────────────────────
  check_in: text("check_in"),       // YYYY-MM-DD
  check_out: text("check_out"),     // YYYY-MM-DD
  guests: integer("guests"),
  preferred_area: text("preferred_area"),
  property_type: text("property_type"),

  // ── Preferences ──────────────────────────────────────────────────────────
  // { budget_weekly, move_in_flexible, notes, ... }
  preferences: jsonb("preferences").notNull().default({}),

  // ── Terms & conditions ───────────────────────────────────────────────────
  terms_accepted: boolean("terms_accepted").notNull().default(false),
  terms_accepted_at: timestamp("terms_accepted_at", { withTimezone: true }),

  // ── Review (admin-brokered) ───────────────────────────────────────────────
  reviewed_by: integer("reviewed_by"),
  reviewed_at: timestamp("reviewed_at", { withTimezone: true }),
  notes: text("notes"),
  assigned_staff_user_id: integer("assigned_staff_user_id"),

  deleted_at: timestamp("deleted_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertShortTermApplicationSchema = createInsertSchema(shortTermApplicationsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertShortTermApplication = z.infer<typeof insertShortTermApplicationSchema>;
export type ShortTermApplication = typeof shortTermApplicationsTable.$inferSelect;
