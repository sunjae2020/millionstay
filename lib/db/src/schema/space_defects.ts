import { pgTable, serial, integer, text, boolean, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// 하자 이력 — per-unit defect history (Metheim 여수 하자 관리대장 재현).
// 0..N rows per space. 소유자명 / 호수 / TYPE are NOT stored here: they are
// derived from the parent space (and its landlord account) at read time so the
// ledger can never drift from the unit master.
//
// `defect_category` (구분) is free-text so the category list stays extensible;
// the four booleans are the recurring per-unit defect flags that the original
// spreadsheet marked with an O.
export const spaceDefectsTable = pgTable(
  "space_defects",
  {
    id: serial("id").primaryKey(),
    space_id: integer("space_id").notNull(),
    // 구분 — defect category (시공하자 / 마감불량 / AS 등). Free-text.
    defect_category: text("defect_category").notNull().default(""),
    // Recurring defect flags (O/X columns on the ledger).
    has_furniture_install: boolean("has_furniture_install").notNull().default(false), // 가구설치
    has_registration: boolean("has_registration").notNull().default(false), // 등록
    has_outdoor_unit_socket: boolean("has_outdoor_unit_socket").notNull().default(false), // 실외기소켓
    has_toilet_fixing_issue: boolean("has_toilet_fixing_issue").notNull().default(false), // 변기고정불량
    // 세부항목 — the specific item within the category.
    detail_item: text("detail_item").notNull().default(""),
    // 상세 내용 및 경과 — narrative of the defect and how it progressed.
    description: text("description").notNull().default(""),
    // 진행상태 — 접수 / 진행중 / 완료 / 보류 (free-text, extensible).
    progress_status: text("progress_status").notNull().default("접수"),
    // 담당업체 — the contractor handling the defect.
    vendor_name: text("vendor_name").notNull().default(""),
    // 사진 — Cloudinary URLs, newest last.
    photo_urls: jsonb("photo_urls").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    status: text("status").notNull().default("Active"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (table) => [index("space_defects_space_id_idx").on(table.space_id)],
);

export const insertSpaceDefectSchema = createInsertSchema(spaceDefectsTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export type InsertSpaceDefect = z.infer<typeof insertSpaceDefectSchema>;
export type SpaceDefect = typeof spaceDefectsTable.$inferSelect;
