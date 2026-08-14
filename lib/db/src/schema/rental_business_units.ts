import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * 임대사업자 등록증(민간임대주택에 관한 특별법 시행규칙 별지 제3호서식)에 적힌
 * "민간임대주택의 소재지" 표 — 등록증에 열거된 세대 한 줄이 이 테이블 한 행이다.
 *
 * 등록증의 머릿말(최초등록일·등록번호·임대사업자 성명/법인등록번호·주소·전화)은
 * 회사 한 건짜리 정보라 integration_settings KV(key `rental_business_registration`)에
 * 두고, 여러 줄인 세대 목록만 이 테이블로 뺐다.
 *
 * `space_id` 는 등록증의 호수를 우리 spaces 원장의 실제 세대와 이어 붙인 고리다.
 * 등록증은 관청 문서라 우리 원장에 없는 호수가 있을 수 있으므로 nullable —
 * 연결이 없다고 행이 무효인 것은 아니고, "미연결"로 표시될 뿐이다.
 *
 * 면적은 등록증이 "40㎡이하" 같은 구간으로만 적어 두므로 숫자가 아닌 라벨 그대로
 * 보관한다(정확한 전용면적은 spaces.exclusive_area_m2 가 가지고 있다).
 */
export const rentalBusinessUnitsTable = pgTable("rental_business_units", {
  id: serial("id").primaryKey(),
  // 호·실 번호 또는 층 — 등록증 표의 키이자 spaces.name 자동 매칭에 쓰는 값.
  unit_no: text("unit_no").notNull(),
  building_address: text("building_address").notNull().default(""),
  acquisition_type: text("acquisition_type"), // 주택구분: 매입 | 건설
  housing_kind: text("housing_kind"), // 주택종류: 장기일반민간임대주택(10년) …
  housing_type: text("housing_type"), // 주택유형: 아파트(도시형생활주택) …
  exclusive_area_label: text("exclusive_area_label"), // 전용면적: "40㎡이하"
  registered_on: text("registered_on"), // 주택등록일 YYYY-MM-DD
  lease_started_on: text("lease_started_on"), // 임대개시일 YYYY-MM-DD
  registration_history: text("registration_history"), // 등록이력: 최초 | 변경 …
  space_id: integer("space_id"),
  note: text("note").notNull().default(""),
  sort_order: integer("sort_order").notNull().default(0),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("rental_business_units_space_id_idx").on(table.space_id),
]);

export const insertRentalBusinessUnitSchema = createInsertSchema(rentalBusinessUnitsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertRentalBusinessUnit = z.infer<typeof insertRentalBusinessUnitSchema>;
export type RentalBusinessUnit = typeof rentalBusinessUnitsTable.$inferSelect;
