import { pgTable, serial, text, integer, real, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const contractsTable = pgTable("contracts", {
  id: serial("id").primaryKey(),
  contract_ref: text("contract_ref").notNull().unique(),
  booking_id: integer("booking_id"),
  product_id: integer("product_id"),
  contract_product_id: integer("contract_product_id"),
  tenant_account_id: integer("tenant_account_id"),
  landlord_account_id: integer("landlord_account_id"),
  space_id: integer("space_id"),
  start_date: text("start_date"),
  end_date: text("end_date"),
  // 임대 유형 — 'long'(전월세형: 계약금·중도금·잔금·보증금·월세) / 'short'(요금형:
  // 일·주·월 요금 + 총 임대료 + 선급금 + 잔금). 계약 상세는 이 값으로 결제 조건
  // 섹션 하나만 보여준다. 잔금·보증금·기간 컬럼은 두 유형이 공유한다.
  lease_mode: text("lease_mode"),
  // 단기 요금 주기 — 'daily' | 'weekly' | 'monthly'. 값이 열려 있으므로(text)
  // 격주 등은 마이그레이션 없이 추가할 수 있다. weekly_rate 의 후신.
  rate_period: text("rate_period"),
  rate_amount: numeric("rate_amount", { precision: 12, scale: 2, mode: "number" }),
  /** @deprecated rate_amount + rate_period='weekly' 로 대체됨. 읽기 호환용으로 남긴다. */
  weekly_rate: numeric("weekly_rate", { precision: 12, scale: 2, mode: "number" }),
  total_rent: numeric("total_rent", { precision: 12, scale: 2, mode: "number" }),
  bond_amount: numeric("bond_amount", { precision: 12, scale: 2, mode: "number" }),
  // 월세 — promo-adjusted monthly rent auto-filled from the linked 숙박상품 tier.
  monthly_rent: numeric("monthly_rent", { precision: 12, scale: 2, mode: "number" }),
  advance_amount: numeric("advance_amount", { precision: 12, scale: 2, mode: "number" }),
  // Korean-lease payment structure (계약서 구분 / 계약금·잔금·보증금·월세)
  contract_category: text("contract_category"),
  down_payment: numeric("down_payment", { precision: 12, scale: 2, mode: "number" }),
  down_payment_date: text("down_payment_date"),
  interim_payment: numeric("interim_payment", { precision: 12, scale: 2, mode: "number" }),
  interim_payment_date: text("interim_payment_date"),
  balance_amount: numeric("balance_amount", { precision: 12, scale: 2, mode: "number" }),
  balance_date: text("balance_date"),
  rent_due_day: integer("rent_due_day"),
  currency: text("currency").notNull().default("AUD"),
  exchange_rate_to_aud: numeric("exchange_rate_to_aud", { precision: 18, scale: 8 }),
  status: text("status").notNull().default("Draft"),
  deleted_at: timestamp("deleted_at"),
  sent_at: timestamp("sent_at", { withTimezone: true }),
  signed_at: timestamp("signed_at", { withTimezone: true }),
  effective_date: text("effective_date"),
  expiry_date: text("expiry_date"),
  termination_reason: text("termination_reason"),
  document_url: text("document_url"),
  // 발급할 계약서 서식: housing_standard(법무부 주택임대차표준계약서) /
  // mlt_standard(민간임대주택 표준임대차계약서) / general(자사 일반 임대차계약서).
  lease_form: text("lease_form"),
  // 서명 방식 수동 재지정: online(온라인 서명) / wet(출력 후 날인). null 이면
  // 계약기간으로 자동 판정한다(1달 이하 = online). signingPolicy.ts 참고.
  signing_mode: text("signing_mode"),
  signing_mode_reason: text("signing_mode_reason"),
  // 계약서 뒤에 붙일 첨부 문서 키 목록(JSON 배열). leaseAttachments.ts 의 종류와 1:1.
  doc_attachments: text("doc_attachments"),
  // 이 계약서에 실을 임대사업자 등록증(rental_business_registrations) — 0058.
  // 임대인 계정에 등록증이 여러 벌일 수 있고, 등록임대주택이 아닌 물건이면 아예
  // 싣지 않는다. null 이 곧 "선택 안 함"이며 그것이 기본값이다.
  rental_business_registration_id: integer("rental_business_registration_id"),
  // 민간임대주택 표준임대차계약서(별지 제24호서식) 법정 기재사항 — 0033.
  // 계약 시점의 고지 내용이 그대로 계약서에 박히므로 물건이 아니라 계약에 스냅숏으로 남긴다.
  // 주민등록번호는 계약이 아니라 사람에게 붙는 값이라 연락처/계정관리에 둔다(0052).
  mlt_landlord_rental_biz_no: text("mlt_landlord_rental_biz_no"),
  mlt_housing_type: text("mlt_housing_type"),
  mlt_rental_type: text("mlt_rental_type"),
  mlt_rental_term_years: integer("mlt_rental_term_years"),
  mlt_rental_type_other: text("mlt_rental_type_other"),
  mlt_supply_kind: text("mlt_supply_kind"),
  mlt_mandatory_start_date: text("mlt_mandatory_start_date"),
  mlt_over_100_units: boolean("mlt_over_100_units"),
  mlt_ancillary_facilities: text("mlt_ancillary_facilities"),
  mlt_senior_lien: boolean("mlt_senior_lien"),
  mlt_senior_lien_kind: text("mlt_senior_lien_kind"),
  mlt_senior_lien_amount: numeric("mlt_senior_lien_amount", { precision: 14, scale: 2, mode: "number" }),
  mlt_senior_lien_date: text("mlt_senior_lien_date"),
  mlt_tax_arrears: boolean("mlt_tax_arrears"),
  mlt_guarantee_status: text("mlt_guarantee_status"),
  mlt_guarantee_amount: numeric("mlt_guarantee_amount", { precision: 14, scale: 2, mode: "number" }),
  mlt_guarantee_none_reason: text("mlt_guarantee_none_reason"),
  mlt_late_fee_rate: numeric("mlt_late_fee_rate", { precision: 5, scale: 2, mode: "number" }),
  // ── 계약 경로 (acquisition channel) ─────────────────────────────────────────
  // 이 계약이 어떤 경로로 성사됐는지 — brokerage(중개) | self(자체) | renewal(연장) |
  // online(온라인) | other(기타). rental_fee_schedules 의 중개/자체/Working 3열과 맞물려
  // 수수료 기준액이 계산되고, 그 결과가 contract_related_costs 에 origin='channel' 행으로
  // 자동 적재된다.
  //
  // 상대 업체·개인은 계정관리(accounts)에서 고른다. 이름/연락처/이메일은 선택 시점의
  // 스냅숏으로 계약에 남긴다 — 계정 레코드가 나중에 바뀌어도 계약 시점의 사실이
  // 보존돼야 하기 때문. 화면은 연결된 계정의 현재값을 함께 읽어 최신값도 보여준다.
  acquisition_channel: text("acquisition_channel"),
  channel_account_id: integer("channel_account_id"),
  channel_contact_name: text("channel_contact_name"),
  channel_contact_phone: text("channel_contact_phone"),
  channel_contact_email: text("channel_contact_email"),
  // 계약서에 찍히는 입금 계좌. 비워 두면 payment_info 의 이름 키워드로 자동 선택된다
  // (기존 동작). 지정하면 그 계좌가 계약서·표준서식에 그대로 나간다 — 0054.
  rent_payment_info_id: integer("rent_payment_info_id"),
  deposit_payment_info_id: integer("deposit_payment_info_id"),
  // 제11조(특약사항) — 이 계약에만 해당하는 특약. 계약일반조항 다음에 이어 찍힌다.
  // terms_text 와 다르다: terms_text 는 본문 전체를 대체하는 이관 계약용 필드다.
  special_terms: text("special_terms"),
  terms_text: text("terms_text"),
  notes: text("notes"),
  // ── 입주 정보 (세입자가 입주 신청서로 직접 적어 보내는 값) ─────────────────
  // 관리사무소가 실제로 물어보는 것들 — 주차 등록, 반려동물 동의, 실제 거주 인원.
  // 계약 조건이 아니라 "이 세대에 누가 어떻게 사는가"라서 계약에 붙여 둔다.
  vehicle_no: text("vehicle_no"),
  pet_note: text("pet_note"),
  cohabitants: text("cohabitants"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertContractSchema = createInsertSchema(contractsTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export type InsertContract = z.infer<typeof insertContractSchema>;
export type Contract = typeof contractsTable.$inferSelect;
