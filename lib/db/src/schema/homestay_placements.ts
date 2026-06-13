import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Homestay PLACEMENT — the entity that links an approved host family to a
// student request once ops brokers a match (see HOMESTAY_WORKFLOW.md §5/§6).
//
// State machine:
//   Proposed → HostAccepted → AwaitingPayment → Active → Ending → Completed
//   (+ Cancelled | Terminated, plus PastDue as a billing-failure sub-state)
//
// The AwaitingPayment → Active transition is gated by successful upfront
// payment. Money columns are numeric → Drizzle returns strings; wrap reads in
// Number() and writes in String().
export const homestayPlacementsTable = pgTable("homestay_placements", {
  id: serial("id").primaryKey(),
  placement_ref: text("placement_ref").notNull().unique(), // e.g. "HSP-2026-00001"
  host_application_id: integer("host_application_id").notNull(), // homestay_host_applications.id
  student_request_id: integer("student_request_id").notNull(),   // homestay_student_requests.id
  agent_account_id: integer("agent_account_id"),                 // accounts.id — attributed agent
  status: text("status").notNull().default("Proposed"),
  // Proposed | HostAccepted | AwaitingPayment | Active | Ending | Completed | Cancelled | Terminated | PastDue

  move_in_date: text("move_in_date"),
  move_out_date: text("move_out_date"),
  // Next monthly-rent billing date (YYYY-MM-DD). Set on activation, advanced by
  // the monthly-billing cron each cycle. Null = no recurring billing.
  next_billing_date: text("next_billing_date"),

  // ── Pricing (numeric → string) ───────────────────────────────────────────
  placement_fee: numeric("placement_fee", { precision: 10, scale: 2 }).notNull().default("0"),
  deposit: numeric("deposit", { precision: 10, scale: 2 }).notNull().default("0"),
  monthly_fee: numeric("monthly_fee", { precision: 10, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("AUD"),

  // ── Stripe ───────────────────────────────────────────────────────────────
  stripe_customer_id: text("stripe_customer_id"),
  stripe_subscription_id: text("stripe_subscription_id"),

  // ── Lifecycle timestamps ─────────────────────────────────────────────────
  proposed_at: timestamp("proposed_at", { withTimezone: true }),
  host_accepted_at: timestamp("host_accepted_at", { withTimezone: true }),
  confirmed_at: timestamp("confirmed_at", { withTimezone: true }),

  deleted_at: timestamp("deleted_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertHomestayPlacementSchema = createInsertSchema(homestayPlacementsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertHomestayPlacement = z.infer<typeof insertHomestayPlacementSchema>;
export type HomestayPlacement = typeof homestayPlacementsTable.$inferSelect;
