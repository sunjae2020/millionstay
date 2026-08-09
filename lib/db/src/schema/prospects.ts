import { pgTable, serial, integer, text, jsonb, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Prospects — cold B2B partner-development ledger.
 *
 * Deliberately NOT `leads`: that table models guest accommodation enquiries
 * (preferred_suburb_id / converted_booking_id) and feeding cold outbound data
 * into it would corrupt the enquiry pipeline and its KPIs.
 *
 * A prospect graduates by converting to accounts + contacts, after which the
 * normal CRM pipeline (Quote → Contract → Invoice) takes over.
 *
 * `consent_basis` is the legal ground for contacting this address and is
 * enforced at send time — see the campaign worker. Values:
 *   'express'      — recorded opt-in (marketing_consents carries the evidence)
 *   'inferred_b2b' — published business address, message relevant to that role
 *   'existing'     — existing business relationship
 *   'none'         — no ground; never sent to
 */
export const prospectsTable = pgTable(
  "prospects",
  {
    id: serial("id").primaryKey(),
    company_name: text("company_name").notNull(),
    email: text("email").notNull(),
    contact_name: text("contact_name").notNull().default(""),
    contact_title: text("contact_title").notNull().default(""),
    phone: text("phone").notNull().default(""),
    website: text("website").notNull().default(""),
    // Business segment this prospect belongs to — drives list building and the
    // pitch used. e.g. 'owner' | 'agency' | 'corporate' | 'education' | 'service'
    segment: text("segment").notNull().default(""),
    country: text("country").notNull().default(""),
    city: text("city").notNull().default(""),
    // Where the record came from: 'csv_import' | 'expo' | 'referral' | 'research' | 'manual'
    source: text("source").notNull().default("manual"),
    source_detail: text("source_detail").notNull().default(""),
    // Source-specific metadata that would otherwise need a column per source
    // (여수 관리대장 담당구역, 박람회 부스번호, 협회 소속 …). The segment builder
    // derives its dropdowns from whatever keys actually appear here, so adding a
    // new source needs no schema change and no code change.
    attributes: jsonb("attributes").$type<Record<string, string>>().notNull().default({}),
    // 'new' | 'queued' | 'contacted' | 'opened' | 'clicked' | 'replied'
    // | 'converted' | 'unsubscribed' | 'bounced' | 'disqualified'
    prospect_status: text("prospect_status").notNull().default("new"),
    qualification_score: integer("qualification_score").notNull().default(0),
    owner_user_id: integer("owner_user_id"),
    // Preferred language for campaign content; falls back to the campaign default.
    language_code: text("language_code").notNull().default("ko"),
    consent_basis: text("consent_basis").notNull().default("none"),
    consent_evidence: text("consent_evidence").notNull().default(""),
    consent_recorded_at: timestamp("consent_recorded_at", { withTimezone: true }),
    bounce_count: integer("bounce_count").notNull().default(0),
    last_contacted_at: timestamp("last_contacted_at", { withTimezone: true }),
    next_action_at: timestamp("next_action_at", { withTimezone: true }),
    converted_account_id: integer("converted_account_id"),
    converted_contact_id: integer("converted_contact_id"),
    converted_at: timestamp("converted_at", { withTimezone: true }),
    disqualified_reason: text("disqualified_reason").notNull().default(""),
    notes: text("notes").notNull().default(""),
    status: text("status").notNull().default("Active"),
    deleted_at: timestamp("deleted_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    // One live prospect per address. Soft-deleted rows are excluded so an address
    // can be re-imported after removal (partial index added in the migration).
    uniqueIndex("uq_prospects_email_live").on(sql`lower(${t.email})`).where(sql`${t.deleted_at} IS NULL`),
    index("idx_prospects_status").on(t.prospect_status),
    index("idx_prospects_segment").on(t.segment),
    index("idx_prospects_owner").on(t.owner_user_id),
    index("idx_prospects_source").on(t.source),
  ],
);

export const insertProspectSchema = createInsertSchema(prospectsTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export type InsertProspect = z.infer<typeof insertProspectSchema>;
export type Prospect = typeof prospectsTable.$inferSelect;
