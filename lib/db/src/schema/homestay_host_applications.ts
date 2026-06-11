import { pgTable, serial, integer, text, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Homestay host-family online application (modelled on the TIME STUDY
// "Homestay Host-Family Application + Agreement" form).
//
// Workflow:
//   Submitted → UnderReview → (DocsRequested) → Approved | Rejected
//
// On submit we also create a partner_users row (portal_type='homestay') so the
// applicant can log in to the host portal IMMEDIATELY — portal login does NOT
// depend on approval. Public LANDING-PAGE EXPOSURE (`landing_active`) however is
// gated: it can only be turned on once status='Approved'.
//
// Sensitive financial data (bank account for fortnightly host payments) is NOT
// collected in the public form; it is gathered later in the portal after
// approval, to minimise PII exposure.
export const homestayHostApplicationsTable = pgTable("homestay_host_applications", {
  id: serial("id").primaryKey(),
  application_ref: text("application_ref").notNull().unique(), // e.g. "HHA-2026-00001"
  status: text("status").notNull().default("Submitted"),
  // Submitted | UnderReview | DocsRequested | Approved | Rejected

  // ── Host-family information ──────────────────────────────────────────────
  first_name: text("first_name").notNull(),
  last_name: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  date_of_birth: text("date_of_birth"),
  gender: text("gender"),
  nationality: text("nationality"),
  cultural_background: text("cultural_background"),
  address: text("address"),
  suburb: text("suburb"),
  heard_about: text("heard_about"),

  // ── Household / home (section blobs) ─────────────────────────────────────
  // residents: [{ name, age, gender, relationship }]  (WWCC applies to 18+)
  residents: jsonb("residents").notNull().default([]),
  smoking_in_home: boolean("smoking_in_home").notNull().default(false),
  smoke_outside_allowed: boolean("smoke_outside_allowed").notNull().default(false),
  drink_in_home: boolean("drink_in_home").notNull().default(false),
  guest_drink_allowed: boolean("guest_drink_allowed").notNull().default(false),
  has_pets: boolean("has_pets").notNull().default(false),
  pet_types: text("pet_types"),
  pet_notes: text("pet_notes"),
  building_type: text("building_type"), // House | Townhouse | Apartment | Other
  // home_features: ["Pool","Gym","Carpet",...]
  home_features: jsonb("home_features").notNull().default([]),
  // rooms: [{ name, bed_type, bath_type, has_lock, comments }]
  rooms: jsonb("rooms").notNull().default([]),

  // ── Student preferences & packages ───────────────────────────────────────
  pref_student_gender: text("pref_student_gender"), // Male | Female | Either
  pref_student_age: text("pref_student_age"),        // adult | minor | either
  host_under_18: boolean("host_under_18").notNull().default(false),
  // packages_offered: meal-plan codes ["full_board","partial_board","dinner_only","no_meals"]
  packages_offered: jsonb("packages_offered").notNull().default([]),
  // dietary: ["Halal","Vegetarian",...]
  dietary: jsonb("dietary").notNull().default([]),
  dietary_notes: text("dietary_notes"),

  // ── Profile ──────────────────────────────────────────────────────────────
  welcome_message: text("welcome_message"),
  profile_description: text("profile_description"),

  // ── Contacts ─────────────────────────────────────────────────────────────
  // emergency_contact: { name, relationship, phone, email }
  emergency_contact: jsonb("emergency_contact"),
  // extra_contact: { email, phone, relationship }
  extra_contact: jsonb("extra_contact"),
  // host_referral: { heard_about, referred_by_host, referrer_name }
  host_referral: jsonb("host_referral"),

  // ── Agreement ────────────────────────────────────────────────────────────
  agreement_accepted: boolean("agreement_accepted").notNull().default(false),
  agreement_accepted_at: timestamp("agreement_accepted_at", { withTimezone: true }),
  signature_name: text("signature_name"),

  // ── Review / approval ────────────────────────────────────────────────────
  // requested_docs: [{ doc_type, note, requested_at, fulfilled }]
  requested_docs: jsonb("requested_docs").notNull().default([]),
  reviewed_by: integer("reviewed_by"),     // admin user id
  reviewed_at: timestamp("reviewed_at", { withTimezone: true }),
  approval_notes: text("approval_notes"),

  // ── Links & exposure ─────────────────────────────────────────────────────
  account_id: integer("account_id"),            // set when approved
  partner_user_id: integer("partner_user_id"),  // host portal login (created on submit)
  // Public landing-page exposure — only allowed to be true once Approved.
  landing_active: boolean("landing_active").notNull().default(false),

  deleted_at: timestamp("deleted_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertHomestayHostApplicationSchema = createInsertSchema(homestayHostApplicationsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertHomestayHostApplication = z.infer<typeof insertHomestayHostApplicationSchema>;
export type HomestayHostApplication = typeof homestayHostApplicationsTable.$inferSelect;
