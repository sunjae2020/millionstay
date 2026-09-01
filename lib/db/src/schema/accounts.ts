import { pgTable, serial, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const accountsTable = pgTable("accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  account_type: text("account_type").notNull(),
  // 계정 주체가 법인/사업체인지 개인인지 — "Company" | "Individual".
  // account_type(세입자·소유주·에이전트…)이 관계를 말한다면 이 값은 상대의 성격을
  // 말한다. 개인 계정에는 웹사이트·대표자·사업자등록번호 칸이 아예 없고, 전화는
  // 하나, 사업자등록번호 자리에는 주민등록번호가, 로고 자리에는 프로필 사진이 온다.
  // 기존 행은 전부 법인 기준으로 입력돼 있으므로 기본값은 Company.
  entity_kind: text("entity_kind").notNull().default("Company"),
  primary_contact_id: integer("primary_contact_id"),
  secondary_contact_id: integer("secondary_contact_id"),
  account_email: text("account_email"),
  website_url: text("website_url"),
  phone1: text("phone1"),
  phone2: text("phone2"),
  address_line1: text("address_line1"),
  address_suburb: text("address_suburb"),
  address_state: text("address_state"),
  address_postcode: text("address_postcode"),
  address_country: text("address_country"),
  secondary_address_line1: text("secondary_address_line1"),
  secondary_address_suburb: text("secondary_address_suburb"),
  secondary_address_state: text("secondary_address_state"),
  secondary_address_postcode: text("secondary_address_postcode"),
  secondary_address_country: text("secondary_address_country"),
  payment_info_id: integer("payment_info_id"),
  default_commission_id: integer("default_commission_id"),
  default_currency: text("default_currency").default("AUD"),
  parent_account_id: integer("parent_account_id"),
  description: text("description"),
  // Brand/company identity. `logo_url` is a Cloudinary URL — website enrichment
  // re-uploads any logo it finds rather than hot-linking the source site.
  logo_url: text("logo_url"),
  // Korean company registration. `biz_verify_status` is the NTS 사업자등록 상태
  // (Valid | Closed | Suspended | NotFound) recorded at `biz_verified_at`.
  biz_registration_no: text("biz_registration_no"),
  // 법인등록번호 — 사업자등록번호와 별개의 13자리 등기 번호(135811-0244079).
  // 법인 임대인의 계약서 당사자 표에 사업자등록번호와 나란히 찍힌다.
  corp_registration_no: text("corp_registration_no"),
  biz_verify_status: text("biz_verify_status"),
  biz_verified_at: timestamp("biz_verified_at", { withTimezone: true }),
  ceo_name: text("ceo_name"),
  // 개인 계정의 주민등록번호. 사람의 번호이므로 원본은 연락처(contacts.resident_no)에
  // 두고, 여기에는 "연락처에서 채우기" 검토를 거쳐 복사된 값이 들어간다 — 계약서는
  // 이 값을 먼저 보고, 비어 있으면 대표 연락처의 값으로 대체한다. 고유식별정보라
  // 로거 redact 목록(lib/logger.ts)에 올라 있고 화면에서는 뒷자리를 가려 보여준다.
  resident_no: text("resident_no"),
  // 메신저 계정 — 한국·아시아 고객은 이메일·전화보다 카카오톡/LINE 으로 연락한다.
  // 사람의 계정이므로 원본은 연락처(contacts.sns_type/sns_id)에 두고, 여기에는
  // 대표 연락처에서 복사된 값이 들어간다. 계약서 당사자 표(임차인 을)에 노출된다.
  sns_type: text("sns_type"),
  sns_id: text("sns_id"),
  // Provenance per column: { "<column>": "manual" | "contact" | "crawl" }.
  // Written when a field is filled from the linked contact or the website
  // crawler, so an admin can tell which values were auto-collected.
  field_sources: jsonb("field_sources").$type<Record<string, string>>(),
  manual_input: boolean("manual_input").notNull().default(false),
  // ── 통합(단체) 청구 ────────────────────────────────────────────────────────
  // 한 계정이 여러 공간을 임차하는 법인 세입자(예: 재원산업)는 공간별 인보이스를
  // 각각 받는 대신 매월 한 장의 통합 청구서로 받고 한 번에 납부한다.
  // 공간별 인보이스는 계속 발행되며(회계·정산은 계약 단위가 정본) 통합 청구서의
  // 자식으로 묶인다 — invoices.parent_invoice_id 참고.
  consolidated_billing_enabled: boolean("consolidated_billing_enabled").notNull().default(false),
  // 청구 기준일(1~28). 매월 이 날짜를 납기로 통합 청구서를 발행한다.
  consolidated_billing_day: integer("consolidated_billing_day").notNull().default(1),
  // 지난달 중간 입주분(일할계산)을 이번 달 통합 청구서에 이월해 함께 청구할지.
  consolidated_prorate_enabled: boolean("consolidated_prorate_enabled").notNull().default(true),
  // 청구서를 만드는 날(1~28). 세입자마다 "매월 28일에 다음 달분을 받는다"처럼 발행
  // 주기가 정해져 있다(재원산업). NULL 이면 예전처럼 매일 이번 달분을 다시 계산한다.
  consolidated_issue_day: integer("consolidated_issue_day"),
  // 생성일에 만드는 대상이 "다음 달"인지(기본) "이번 달"인지.
  consolidated_issue_next_month: boolean("consolidated_issue_next_month").notNull().default(true),
  status: text("status").notNull().default("Active"),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAccountSchema = createInsertSchema(accountsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accountsTable.$inferSelect;
