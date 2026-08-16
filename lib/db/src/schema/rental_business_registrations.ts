import { pgTable, serial, integer, text, numeric, boolean, timestamp, index } from "drizzle-orm/pg-core";
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

  // ── 민간임대주택 법정 기재사항 ─────────────────────────────────────────
  // 표준임대차계약서(별지 제24호서식) 첫 장의 법정 기재사항은 계약마다 새로
  // 적을 값이 아니라 **등록증 한 벌에 딸린 성질**이다 — 같은 등록증에 실린
  // 세대는 종류·의무기간·공급방식·보증가입이 대체로 같이 간다. 그래서 여기에
  // 기본값으로 두고, 계약에서 임대인(갑)과 서식을 고르면 계약의 같은 이름
  // 칸(contracts.mlt_*)으로 복사한다. 복사 뒤 계약 쪽에서 고친 값이 최종이고
  // 등록증으로 되돌아오지 않는다 — 여기는 어디까지나 출발점이다.
  //
  // 임대사업자 등록번호는 여기에 다시 두지 않는다. 위 registration_no 가 곧
  // 그 값이라, 두 벌로 두면 어느 쪽이 맞는지 알 수 없어진다.
  mlt_housing_type: text("mlt_housing_type"), // apartment | row_house | multiplex | multi_family | other
  mlt_rental_type: text("mlt_rental_type"), // public_support | long_term | short_term
  mlt_rental_term_years: integer("mlt_rental_term_years"), // 임대의무기간 10·8·6·4
  mlt_rental_type_other: text("mlt_rental_type_other"), // 그 밖의 유형
  mlt_supply_kind: text("mlt_supply_kind"), // built(건설) | purchased(매입)
  mlt_mandatory_start_date: text("mlt_mandatory_start_date"), // 임대의무기간 개시일 YYYY-MM-DD
  mlt_over_100_units: boolean("mlt_over_100_units"), // 100세대 이상 단지
  mlt_ancillary_facilities: text("mlt_ancillary_facilities"), // 부대시설·복리시설의 종류
  mlt_senior_lien: boolean("mlt_senior_lien"), // 선순위 담보권 등 권리관계
  mlt_senior_lien_kind: text("mlt_senior_lien_kind"),
  mlt_senior_lien_amount: numeric("mlt_senior_lien_amount", { precision: 14, scale: 2 }),
  mlt_senior_lien_date: text("mlt_senior_lien_date"),
  mlt_tax_arrears: boolean("mlt_tax_arrears"), // 국세·지방세 체납사실
  mlt_guarantee_status: text("mlt_guarantee_status"), // joined | partial | not_joined
  mlt_guarantee_amount: numeric("mlt_guarantee_amount", { precision: 14, scale: 2 }),
  mlt_guarantee_none_reason: text("mlt_guarantee_none_reason"), // zero | priority | public_landlord | tenant_guarantee
  mlt_late_fee_rate: numeric("mlt_late_fee_rate", { precision: 5, scale: 2 }), // 연체이율 연 %

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
