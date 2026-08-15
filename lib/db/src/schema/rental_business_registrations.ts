import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * 임대사업자 등록증(민간임대주택에 관한 특별법 시행규칙 별지 제3호서식)의 머릿말 —
 * 등록번호·최초등록일·임대사업자 성명(법인명)·주민등록번호(법인등록번호)·주소·전화.
 *
 * 처음에는 "우리 회사 등록증 한 벌"이라 보고 integration_settings KV 에 담았지만,
 * 등록증은 회사가 아니라 **임대인**에게 붙는 문서다. 한 인스턴스가 여러 임대인·
 * 소유주의 물건을 관리하고, 한 임대인이 등록증을 여러 벌 가질 수도 있어(관청·
 * 시기별 재발급) 계정에 매달린 정식 테이블로 옮겼다.
 *
 * `account_id` 는 계정관리의 임대인·소유주(accounts.account_type = SpaceOwner)다.
 * 관청 문서가 우리 원장보다 앞설 수 있고, KV 시절 자료는 주인을 단정할 수 없으므로
 * nullable — 주인이 없는 등록증은 계정 탭의 "미지정 등록증"에서 가져다 붙인다.
 */
export const rentalBusinessRegistrationsTable = pgTable("rental_business_registrations", {
  id: serial("id").primaryKey(),
  account_id: integer("account_id"),
  registration_no: text("registration_no").notNull().default(""), // 2026-여수시-임대사업자-11
  first_registered_on: text("first_registered_on"), // 최초등록일 YYYY-MM-DD
  operator_name: text("operator_name").notNull().default(""), // 임대사업자 성명(법인명)
  operator_reg_no: text("operator_reg_no"), // 주민등록번호(법인등록번호)
  foreigner_reg_no: text("foreigner_reg_no"),
  nationality: text("nationality"),
  visa_status: text("visa_status"),
  visa_period: text("visa_period"),
  address: text("address"),
  phone: text("phone"),
  mobile: text("mobile"),
  issuing_authority: text("issuing_authority"), // 발급 관청 (예: 여수시장)
  // 등록증 아래쪽 "위와 같이 등록되었음을 증명합니다 — 2025년 07월 23일"의 증명일.
  // 최초등록일과 다르다(최초등록일은 사업자가 처음 등록한 날, 이 날짜는 이 등록증
  // 한 벌을 관청이 떼어 준 날이라 재발급마다 바뀐다).
  issued_on: text("issued_on"), // 증명일(발급일) YYYY-MM-DD
  note: text("note").notNull().default(""),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("rental_business_registrations_account_id_idx").on(table.account_id),
]);

export const insertRentalBusinessRegistrationSchema = createInsertSchema(rentalBusinessRegistrationsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertRentalBusinessRegistration = z.infer<typeof insertRentalBusinessRegistrationSchema>;
export type RentalBusinessRegistration = typeof rentalBusinessRegistrationsTable.$inferSelect;
