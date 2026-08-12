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
  // 민간임대주택 표준임대차계약서(별지 제24호서식) 법정 기재사항 — 0033.
  // 계약 시점의 고지 내용이 그대로 계약서에 박히므로 물건이 아니라 계약에 스냅숏으로 남긴다.
  // 주민등록번호는 일부러 저장하지 않는다(서식의 해당 칸은 비워 발급 → 수기 기재).
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
  terms_text: text("terms_text"),
  notes: text("notes"),
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
