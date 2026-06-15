import { pgTable, serial, integer, text, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Homestay STUDENT placement request — the customer-side intake (see
// docs/proposals/HOMESTAY_WORKFLOW.md §6). Terminology is Student-only:
// the guardian is captured as ATTRIBUTES on this record (guardian_*),
// populated only when `is_minor` (the 만-18 age branch).
//
// Matching is admin-brokered, so a submitted request flows into the ops queue:
//   Draft → Submitted → UnderReview → Matching → Proposed → Confirmed → Placed → Completed
//   (+ Cancelled | Rejected)
//
// A request may be self-submitted by the student/guardian (guest account) OR
// submitted on their behalf by an Agent — `submitted_by` + `agent_account_id`
// record which.
export const homestayStudentRequestsTable = pgTable("homestay_student_requests", {
  id: serial("id").primaryKey(),
  request_ref: text("request_ref").notNull().unique(), // e.g. "HSR-2026-00001"
  status: text("status").notNull().default("Submitted"),
  // Draft | Submitted | UnderReview | Matching | Proposed | Confirmed | Placed | Completed | Cancelled | Rejected

  // ── Submission channel ───────────────────────────────────────────────────
  account_id: integer("account_id"),        // guest account (Student/Guardian login)
  agent_account_id: integer("agent_account_id"), // accounts.id — set when an agent submits on behalf
  submitted_by: text("submitted_by").notNull().default("student"), // student | agent

  // ── Student (the resident) ───────────────────────────────────────────────
  student_first_name: text("student_first_name").notNull(),
  student_last_name: text("student_last_name").notNull(),
  student_email: text("student_email"),
  student_phone: text("student_phone"),
  date_of_birth: text("date_of_birth"),
  is_minor: boolean("is_minor").notNull().default(false),
  gender: text("gender"),
  nationality: text("nationality"),

  // ── Guardian (attributes — only when is_minor) ───────────────────────────
  guardian_name: text("guardian_name"),
  guardian_email: text("guardian_email"),
  guardian_phone: text("guardian_phone"),
  guardian_relationship: text("guardian_relationship"),
  guardian_consent_at: timestamp("guardian_consent_at", { withTimezone: true }),

  // ── Preferences ──────────────────────────────────────────────────────────
  // { suburb, school, meal_package, dietary:[], move_in_date, duration_weeks,
  //   budget_weekly, gender_pref, notes }
  preferences: jsonb("preferences").notNull().default({}),

  // ── Terms & conditions ───────────────────────────────────────────────────
  terms_accepted: boolean("terms_accepted").notNull().default(false),
  terms_accepted_at: timestamp("terms_accepted_at", { withTimezone: true }),

  // ── Review (admin-brokered matching) ─────────────────────────────────────
  reviewed_by: integer("reviewed_by"),     // admin user id
  reviewed_at: timestamp("reviewed_at", { withTimezone: true }),
  notes: text("notes"),                    // ops notes
  // Ops owner of this request (담당직원). → admin_users.id. Carried onto the
  // booking when a placement is created.
  assigned_staff_user_id: integer("assigned_staff_user_id"),

  deleted_at: timestamp("deleted_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertHomestayStudentRequestSchema = createInsertSchema(homestayStudentRequestsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertHomestayStudentRequest = z.infer<typeof insertHomestayStudentRequestSchema>;
export type HomestayStudentRequest = typeof homestayStudentRequestsTable.$inferSelect;
