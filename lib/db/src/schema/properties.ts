import { pgTable, serial, text, real, integer, numeric, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const propertiesTable = pgTable("properties", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  address2: text("address2"),
  city: text("city"),
  state: text("state"),
  postcode: text("postcode"),
  country_code: text("country_code"),
  lat: real("lat"),
  lng: real("lng"),
  approval_status: text("approval_status").notNull().default("Pending"),
  owner_account_id: integer("owner_account_id"),
  suburb_id: integer("suburb_id"),
  description: text("description"),
  // Land/building registry details (등기부 표시), printed on the 부동산의 표식
  // table of a Korean lease agreement's 별지. Constant per building — the
  // per-unit 임대면적 / 대지권비율 come from `spaces` (exclusive_area_m2,
  // land_share_m2). All nullable; unfilled rows are omitted from the document.
  /** 소재지 (지번 주소) — the registered lot address, which often differs from
   *  the street address, e.g. "전라남도 여수시 연등동 845 메트하임 1동". */
  lot_address: text("lot_address"),
  /** 건물 용도, e.g. 공동주택 / 도시형 생활주택. */
  building_use: text("building_use"),
  /** 건물 구조, e.g. 철근콘크리트 구조. */
  building_structure: text("building_structure"),
  /** 토지 지목, e.g. 대(垈). */
  land_category: text("land_category"),
  /** 토지 면적 (㎡) — denominator of the 대지권비율. */
  land_area_m2: numeric("land_area_m2", { precision: 12, scale: 2, mode: "number" }),
  /** 대지권 종류, e.g. 소유권 대지권. */
  land_right_type: text("land_right_type"),
  // Per-locale copy for the guest site: { [lang]: { name, description, _source } }
  // where _source is "machine" (AI, unreviewed) or "human" (admin-reviewed).
  translations: jsonb("translations").default({}),
  deleted_at: timestamp("deleted_at"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPropertySchema = createInsertSchema(propertiesTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof propertiesTable.$inferSelect;
