import { pgTable, serial, integer, text, jsonb, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// CONDITION REPORTS — move-in / interim / move-out property-condition evidence
// and tenant consensus (Metheim vision stages 2 & 5; see
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
  // Exactly one anchor is set: booking_id (booking-phase evidence) or
  // contract_id (a lease's 세대점검표 attachment). Both are nullable so the same
  // tables serve either — see `template_key`.
  booking_id: integer("booking_id"),
  contract_id: integer("contract_id"),
  // null = free-form report (the original booking flow); "metheim_unit" = the
  // Metheim 세대점검표 form, which carries both 입주 and 퇴거 columns on ONE sheet.
  template_key: text("template_key"),
  phase: text("phase").notNull().default("move_in"), // move_in | interim | move_out | full
  status: text("status").notNull().default("draft"),
  // draft → published → tenant_agreed | disputed → finalized

  title: text("title"),
  summary: text("summary"), // admin 특이사항 요약

  // Header + meter + 특약 payload for template-driven forms:
  // { unit_type, unit_no, tenant_name, tenant_phone, move_in_date, move_out_date,
  //   meters: { in: {electric,water,gas}, out: {…} },
  //   inspector_in, inspector_out, confirmed_in, confirmed_out, remarks, special_terms }
  meta: jsonb("meta").notNull().default({}),

  // Token-addressed tenant signing link (no login) — one live token at a time,
  // scoped to the phase being signed.
  sign_token: text("sign_token").unique(),
  sign_token_phase: text("sign_token_phase"), // move_in | move_out
  sign_token_expires_at: timestamp("sign_token_expires_at", { withTimezone: true }),

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

  // Template-driven (세대점검표) columns. The paper form records a defect note per
  // item for BOTH 입주 and 퇴거 on the same row, so each phase gets its own pair.
  group_key: text("group_key"),   // provided | entrance | bathroom | kitchen | living | bedroom | boiler
  item_code: text("item_code"),   // stable template id, e.g. "entrance.fire_door"
  move_in_status: text("move_in_status"),   // ok | defect | na
  move_in_note: text("move_in_note"),       // 입주하자 내용
  move_out_status: text("move_out_status"), // ok | defect | na
  move_out_note: text("move_out_note"),     // 퇴거하자 내용
  // Rows a unit does not have (월패드 없는 건물, A타입의 이동식 식탁 …) are hidden
  // rather than deleted, so the template stays comparable across units and the
  // row can be brought back. Hidden rows leave the tenant view and the PDF too.
  hidden: boolean("hidden").notNull().default(false),

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
  phase: text("phase").notNull().default("move_in"), // which column the photo evidences
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

// Drawn signatures — 점검자(inspector) and 임차인(tenant), captured per phase.
// Legal metadata (server-side timestamp, ip, user agent) is authoritative; the
// signed item set is hashed into content_hash so a signature can be tied to the
// exact checklist state it approved.
export const conditionReportSignaturesTable = pgTable("condition_report_signatures", {
  id: serial("id").primaryKey(),
  condition_report_id: integer("condition_report_id").notNull(),
  phase: text("phase").notNull(),         // move_in | move_out
  role: text("role").notNull(),           // inspector | tenant
  signer_name: text("signer_name"),
  signature_image: text("signature_image").notNull(), // data:image/png;base64,…
  content_hash: text("content_hash"),     // sha256 of the checklist state signed
  signed_at: timestamp("signed_at", { withTimezone: true }).notNull().defaultNow(),
  ip: text("ip"),
  user_agent: text("user_agent"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertConditionReportSchema = createInsertSchema(conditionReportsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertConditionReport = z.infer<typeof insertConditionReportSchema>;
export type ConditionReport = typeof conditionReportsTable.$inferSelect;
export type ConditionReportItem = typeof conditionReportItemsTable.$inferSelect;
export type ConditionReportPhoto = typeof conditionReportPhotosTable.$inferSelect;
export type ConditionReportResponse = typeof conditionReportResponsesTable.$inferSelect;
export type ConditionReportSignature = typeof conditionReportSignaturesTable.$inferSelect;
