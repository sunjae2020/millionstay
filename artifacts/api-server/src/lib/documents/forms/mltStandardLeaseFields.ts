/**
 * 국토교통부 「표준임대차계약서」 — 필드 좌표 맵
 *
 * 원본: 민간임대주택에 관한 특별법 시행규칙 [별지 제24호서식] <개정 2025. 10. 31.>
 *       forms/mlt-standard-lease-2025-10-31.pdf — 국가법령정보센터 배포본, A4 595×841pt, 6쪽.
 *       (법령 별지서식 = 저작권법 제7조 비보호저작물)
 *
 * 2022. 1. 14. 개정본 대비 달라진 곳 — 실제 체결본이 이 개정판이라 여기에 맞춘다:
 *   · 1쪽 공인중개사 표에 **소속공인중개사** 행 추가
 *   · 2쪽 민간임대주택의 종류에 **단기[ ](□6년, □4년)** 행 추가
 *   · 2쪽 임대보증금 보증 가입 여부 표 전면 개편
 *     (가입/일부가입 각각 보증대상 금액 칸 + 미가입(법정사유) 4종 체크)
 *   · 제1조④ 연체이율과 제2조 입주일이 3쪽으로 이동
 *
 * 이 서식은 **재현하지 않는다**. 원본 PDF 6쪽을 그대로 배경으로 임포트하고
 * 아래 좌표에 값·체크마크·서명만 얹는다 → [pdfFormOverlay.ts](./pdfFormOverlay.ts).
 * 따라서 글꼴·자간·여백·페이지 수가 원본 그 자체다.
 *
 * 좌표는 원본 PDF의 표 괘선(벡터 경로)과 라벨 텍스트 매트릭스에서 기계적으로 뽑았다.
 * 서식이 개정되면 새 PDF를 forms/ 에 추가하고 이 맵을 새로 뽑을 것
 * (파일명에 개정일을 박아 두는 이유).
 */
import type { FormField, FormSpec, TextField, CheckField, ImageField } from "./pdfFormOverlay";

export const MLT_STANDARD_LEASE_FORM: FormSpec = {
  file: "mlt-standard-lease-2025-10-31.pdf",
  revision: "2025-10-31",
  legalBasis: "민간임대주택에 관한 특별법 시행규칙 [별지 제24호서식]",
  pageCount: 6,
  pageWidth: 595,
  pageHeight: 841,
};

const T = (page: number, x: number, y: number, opts: Partial<Omit<TextField, "kind" | "page" | "x" | "y">> = {}): TextField => ({ kind: "text", page, x, y, size: 9.5, align: "left", ...opts });
const C = (page: number, x: number, y: number): CheckField => ({ kind: "check", page, x, y, size: 9 });
const I = (page: number, x: number, y: number, width: number, height: number): ImageField => ({ kind: "image", page, x, y, width, height });

/**
 * 서식의 모든 기입란. 키는 우리 도메인 이름, 값은 원본 위치.
 * 값이 없는 필드는 렌더러가 건너뛰므로 빈 서식 출력도 그대로 가능하다.
 */
export const MLT_STANDARD_LEASE_FIELDS = {
  // ── 1쪽: 계약일 / 1. 계약 당사자 / 2. 공인중개사 ────────────────────────────
  contract_date_year: T(1, 428, 637.0, { align: "center", size: 9 }),
  contract_date_month: T(1, 464.5, 637.0, { align: "center", size: 9 }),
  contract_date_day: T(1, 500.5, 637.0, { align: "center", size: 9 }),

  landlord_name: T(1, 236, 601.4, { maxWidth: 230 }),
  landlord_seal: I(1, 468, 594, 55, 20),
  landlord_address: T(1, 236, 575.0, { maxWidth: 296 }),
  landlord_id_no: T(1, 236, 545.0, { maxWidth: 130 }),
  landlord_phone: T(1, 440.6, 545.0, { maxWidth: 94 }),
  landlord_rental_biz_no: T(1, 236, 514.5, { maxWidth: 296 }),

  tenant_name: T(1, 236, 488.7, { maxWidth: 230 }),
  tenant_seal: I(1, 468, 481, 55, 20),
  tenant_address: T(1, 236, 467.3, { maxWidth: 296 }),
  tenant_id_no: T(1, 236, 446.1, { maxWidth: 130 }),
  tenant_phone: T(1, 440.6, 446.1, { maxWidth: 94 }),

  broker_office_name: T(1, 236, 399.0, { maxWidth: 296 }),
  broker_ceo_name: T(1, 236, 376.6, { maxWidth: 230 }),
  broker_seal: I(1, 474, 369, 52, 20),
  broker_office_address: T(1, 236, 354.2, { maxWidth: 296 }),
  broker_reg_no: T(1, 236, 331.7, { maxWidth: 130 }),
  broker_phone: T(1, 440.6, 331.7, { maxWidth: 94 }),
  /** 2025 개정으로 신설된 소속공인중개사 행. */
  broker_assistant_name: T(1, 236, 309.3, { maxWidth: 230 }),
  broker_assistant_seal: I(1, 474, 302, 52, 20),

  // ── 2쪽: 3. 민간임대주택의 표시 ────────────────────────────────────────────
  property_address: T(2, 157.7, 748.0, { maxWidth: 376 }),

  /** 주택 유형 — 아파트 / 연립주택 / 다세대주택 / 다가구주택 / 그 밖의 주택 */
  housing_type_apartment: C(2, 191.0, 731.7),
  housing_type_row_house: C(2, 258.7, 731.7),
  housing_type_multiplex: C(2, 336.2, 731.7),
  housing_type_multi_family: C(2, 413.6, 731.7),
  housing_type_other: C(2, 500.7, 731.7),

  /** 면적(㎡) — 주거전용 / 주거공용 / 그 밖의 공용 / 합계 */
  area_exclusive: T(2, 197.8, 672.9, { align: "center" }),
  area_common_residential: T(2, 292.7, 672.9, { align: "center" }),
  area_common_other: T(2, 390.4, 672.9, { align: "center" }),
  area_total: T(2, 488.6, 672.9, { align: "center" }),

  /** 민간임대주택의 종류 — 공공지원 / 장기일반 / 단기(2025 신설) */
  type_public_support: C(2, 198.8, 656.4),
  type_public_support_10y: C(2, 224.3, 656.4),
  type_public_support_8y: C(2, 261.4, 656.4),
  type_long_term: C(2, 198.8, 644.4),
  type_long_term_10y: C(2, 224.3, 644.4),
  type_long_term_8y: C(2, 261.4, 644.4),
  type_short_term: C(2, 198.8, 632.4),
  type_short_term_6y: C(2, 224.3, 632.4),
  type_short_term_4y: C(2, 261.4, 632.4),
  type_other_text: T(2, 221, 620.4, { size: 9, maxWidth: 62 }),
  supply_built: C(2, 345.9, 644.4),
  supply_purchased: C(2, 345.9, 632.4),

  /** 임대의무기간 개시일 */
  mandatory_start_year: T(2, 461.7, 638.7, { align: "right", size: 9 }),
  mandatory_start_month: T(2, 493.0, 638.7, { align: "right", size: 9 }),
  mandatory_start_day: T(2, 524.4, 638.7, { align: "right", size: 9 }),

  /** 100세대 이상 민간임대주택단지 해당 여부 */
  over_100_units_yes: C(2, 182.1, 604.7),
  over_100_units_no: C(2, 347.1, 604.7),

  ancillary_facilities: T(2, 157.7, 548.0, { maxWidth: 376 }),

  /** 선순위 담보권 등 권리관계 설정 여부 */
  senior_lien_none: C(2, 182.1, 512.8),
  senior_lien_exists: C(2, 326.8, 518.3),
  senior_lien_kind: T(2, 481, 507.4, { size: 9, maxWidth: 52 }),
  senior_lien_amount: T(2, 361, 496.4, { size: 9, maxWidth: 172 }),
  senior_lien_date: T(2, 361, 485.3, { size: 9, maxWidth: 172 }),

  /** 국세ㆍ지방세 체납사실 */
  tax_arrears_none: C(2, 187.1, 462.6),
  tax_arrears_exists: C(2, 331.7, 462.6),

  /**
   * 임대보증금 보증 가입 여부 (2025 개편)
   * 가입 / 일부가입 각각 보증대상 금액 칸을 따로 가지고, 미가입은 법정사유 4종에서 고른다.
   */
  guarantee_joined: C(2, 207.2, 424.1),
  guarantee_joined_amount: T(2, 311, 424.1, { size: 9, maxWidth: 220 }),
  guarantee_partial: C(2, 207.2, 408.5),
  guarantee_partial_amount: T(2, 311, 408.5, { size: 9, maxWidth: 220 }),
  guarantee_not_joined: C(2, 191.5, 341.2),
  /** 법 제49조제3항 — 가입대상 금액이 0원 이하 */
  guarantee_reason_zero: C(2, 243.6, 380.8),
  /** 법 제49조제7항제1호 — 임대보증금이 우선변제금 이하 */
  guarantee_reason_priority: C(2, 243.6, 368.8),
  /** 법 제49조제7항제2호 — 공공주택사업자와 임대차계약 체결 */
  guarantee_reason_public: C(2, 243.6, 356.8),
  /** 법 제49조제7항제3호 — 임차인이 전세보증금반환보증에 가입 */
  guarantee_reason_tenant_guarantee: C(2, 243.6, 344.8),

  // ── 2쪽: 4. 계약조건 제1조 ────────────────────────────────────────────────
  /** 제1조① 임대보증금 / 월임대료 — 한글 금액 + 숫자 금액 */
  deposit_amount_words: T(2, 179, 148.0, { align: "center", maxWidth: 84 }),
  deposit_amount_figures: T(2, 319.8, 148.0, { align: "right", maxWidth: 72 }),
  rent_amount_words: T(2, 384, 148.0, { align: "center", maxWidth: 84 }),
  rent_amount_figures: T(2, 525, 148.0, { align: "right", maxWidth: 72 }),

  /** 임대차 계약기간 */
  term_start_year: T(2, 176.6, 125.1, { align: "right", size: 9 }),
  term_start_month: T(2, 226.6, 125.1, { align: "right", size: 9 }),
  term_start_day: T(2, 276.5, 125.1, { align: "right", size: 9 }),
  term_end_year: T(2, 361.6, 125.1, { align: "right", size: 9 }),
  term_end_month: T(2, 411.5, 125.1, { align: "right", size: 9 }),
  term_end_day: T(2, 461.6, 125.1, { align: "right", size: 9 }),

  /** 제1조② 계약금 / 중도금 / 잔금 */
  down_payment_words: T(2, 172, 84.6, { align: "center", maxWidth: 84 }),
  down_payment_figures: T(2, 315.6, 84.6, { align: "right", maxWidth: 72 }),
  interim_payment_words: T(2, 172, 68.0, { align: "center", maxWidth: 84 }),
  interim_payment_figures: T(2, 315.6, 68.0, { align: "right", maxWidth: 72 }),
  interim_payment_year: T(2, 370.4, 68.0, { align: "right", size: 9 }),
  interim_payment_month: T(2, 420.4, 68.0, { align: "right", size: 9 }),
  interim_payment_day: T(2, 470.3, 68.0, { align: "right", size: 9 }),
  balance_words: T(2, 172, 51.3, { align: "center", maxWidth: 84 }),
  balance_figures: T(2, 315.6, 51.3, { align: "right", maxWidth: 72 }),
  balance_year: T(2, 370.4, 51.3, { align: "right", size: 9 }),
  balance_month: T(2, 420.4, 51.3, { align: "right", size: 9 }),
  balance_day: T(2, 470.3, 51.3, { align: "right", size: 9 }),

  account_number: T(2, 128.8, 34.7, { maxWidth: 152 }),
  bank_name: T(2, 336.9, 34.7, { maxWidth: 66 }),
  account_holder: T(2, 459.5, 34.7, { maxWidth: 74 }),

  // ── 3쪽: 제1조④ 연체이율 / 제2조 입주일 ──────────────────────────────────
  late_fee_rate: T(3, 468, 743.0, { align: "center", size: 9, maxWidth: 15 }),

  //
  // ⚠ 입주일 줄만은 서식 자체의 빈칸이 좁다(원본 조판). 앞 글자에 물리지 않도록
  //   아래 maxWidth 안에서 자동 축소되며, 특히 종료 연도 칸은 7.5pt 밖에 없어
  //   두 자리 연도("27")를 넣는다 — 매핑 단계에서 두 자리로 넘길 것.
  move_in_start_year: T(3, 312, 655.8, { align: "right", size: 8, maxWidth: 15 }),
  move_in_start_month: T(3, 335.5, 655.8, { align: "right", size: 8, maxWidth: 12 }),
  move_in_start_day: T(3, 359, 655.8, { align: "right", size: 8, maxWidth: 12 }),
  move_in_end_year: T(3, 396.5, 655.8, { align: "right", size: 8, maxWidth: 7 }),
  move_in_end_month: T(3, 419.5, 655.8, { align: "right", size: 8, maxWidth: 12 }),
  move_in_end_day: T(3, 443, 655.8, { align: "right", size: 8, maxWidth: 12 }),

  // ── 5쪽: 제14조② 임대사업자 설명 확인 서명 ────────────────────────────────
  explain_tenant_name: T(5, 395, 68.9, { maxWidth: 68 }),
  explain_tenant_seal: I(5, 458, 61, 55, 20),

  // ── 6쪽: 5. 개인정보의 제3자 제공 동의 서명 ───────────────────────────────
  consent_tenant_name: T(6, 389.5, 326.1, { maxWidth: 68 }),
  consent_tenant_seal: I(6, 452, 319, 55, 20),
} as const satisfies Record<string, FormField>;

export type MltStandardLeaseFieldKey = keyof typeof MLT_STANDARD_LEASE_FIELDS;

/** 렌더러 입력: 텍스트는 문자열, 체크박스는 boolean, 서명은 data/https URL. */
export type MltStandardLeaseValues = Partial<Record<MltStandardLeaseFieldKey, string | number | boolean | null | undefined>>;
