import { pgTable, serial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// CONDITION REPORTS — move-in / interim / move-out property-condition evidence
// and tenant consensus (MetHeim vision stages 2 & 5; see
// docs/proposals/CONDITION_REPORTS_SETTLEMENT.md).
//
// Generic via bookings.id (the operational spine that homestay placements,
// short-term and long-term bookings all share) + a `phase` discriminator, so
// one system covers every product per the cross-product policy.
//
// Tamper-evidence is ported from contract_signing_requests (H-201): at publish
// the item set is frozen into published_snapshot and hashed into content_hash,
// so the state the tenant agreed to can never be silently re-rendered. Photos
// carry their own sha256 (content_hash) — closing the gap the audit flagged on
// booking_service_photos (which store only a timestamp).
export const conditionReportsTable = pgTable("condition_reports", {
  id: serial("id").primaryKey(),
  report_ref: text("report_ref").notNull().unique(), // e.g. "CR-2026-00001"
  booking_id: integer("booking_id").notNull(),
  phase: text("phase").notNull().default("move_in"), // move_in | interim | move_out
  status: text("status").notNull().default("draft"),
  // draft → published → tenant_agreed | disputed → finalized

  title: text("title"),
  summary: text("summary"), // admin 특이사항 요약

  created_by: integer("created_by"), // admin users.id
  published_at: timestamp("published_at", { withTimezone: true }),
  tenant_responded_at: timestamp("tenant_responded_at", { withTimezone: true }),
  finalized_at: timestamp("finalized_at", { withTimezone: true }),

  // Tamper-evidence (H-201 pattern): frozen at publish.
  content_hash: text("content_hash"),                 // sha256 of published_snapshot
  published_snapshot: jsonb("published_snapshot"),    // { items, capturedAt }
  audit_trail: jsonb("audit_trail").notNull().default([]), // append-only [{event, at, actor, ip}]

  deleted_at: timestamp("deleted_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Per-facility/area line item (door / floor / living / kitchen / bathroom / balcony / other).
export const conditionReportItemsTable = pgTable("condition_report_items", {
  id: serial("id").primaryKey(),
  condition_report_id: integer("condition_report_id").notNull(),
  area_key: text("area_key"), // door | floor | living | kitchen | bathroom | balcony | other
  label: text("label").notNull(),
  description: text("description"), // admin 특이사항
  condition_rating: text("condition_rating"), // good | fair | damaged
  sort_order: integer("sort_order").notNull().default(0),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Evidence photos — every image carries its own sha256 (anti-tamper).
export const conditionReportPhotosTable = pgTable("condition_report_photos", {
  id: serial("id").primaryKey(),
  condition_report_id: integer("condition_report_id").notNull(),
  item_id: integer("item_id"), // nullable — report-level photos allowed
  file_url: text("file_url").notNull(),
  thumbnail_url: text("thumbnail_url"),
  cloudinary_id: text("cloudinary_id"),
  caption: text("caption"),
  content_hash: text("content_hash"), // sha256 of image bytes — anti-tamper
  taken_at: timestamp("taken_at", { withTimezone: true }),
  uploaded_by_type: text("uploaded_by_type").notNull().default("admin"), // admin | tenant
  uploaded_by_id: integer("uploaded_by_id"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Tenant per-item agree/dispute. A dispute flips the parent report to `disputed`.
export const conditionReportResponsesTable = pgTable("condition_report_responses", {
  id: serial("id").primaryKey(),
  item_id: integer("item_id").notNull(),
  decision: text("decision").notNull(), // agreed | disputed
  comment: text("comment"),
  responded_at: timestamp("responded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertConditionReportSchema = createInsertSchema(conditionReportsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertConditionReport = z.infer<typeof insertConditionReportSchema>;
export type ConditionReport = typeof conditionReportsTable.$inferSelect;
export type ConditionReportItem = typeof conditionReportItemsTable.$inferSelect;
export type ConditionReportPhoto = typeof conditionReportPhotosTable.$inferSelect;
export type ConditionReportResponse = typeof conditionReportResponsesTable.$inferSelect;
