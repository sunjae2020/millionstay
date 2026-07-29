/**
 * 법무부 「주택임대차표준계약서」 — 필드 좌표 맵
 *
 * 원본: 법무부가 국토교통부·서울시와 함께 만든 주택임대차표준계약서
 *       (주택임대차보호법 제30조, 2023. 10. 6. 개정본 / 법무부 배포 "원본게시용" PDF)
 *       forms/housing-standard-lease-2023-10-06.pdf — A4 595×841pt, 5쪽.
 *
 * 쪽 구성
 *   1쪽 임차주택의 표시 · 계약의 종류 · 미납국세/선순위확정일자 · 제1조~제3조
 *   2쪽 제4조~제13조 · 특약사항
 *   3쪽 ※기타 · 당사자 서명란(임대인/임차인/개업공인중개사)
 *   4쪽 [별지1] 법의 보호를 받기 위한 중요사항 — 기입란 없음(항상 첨부)
 *   5쪽 [별지2] 계약갱신 거절통지서 — 선택 첨부, 별도 기입란
 *
 * 좌표는 원본 PDF의 표 괘선(벡터 경로)과 라벨 텍스트 박스에서 기계적으로 뽑았다.
 * 서식이 개정되면 새 PDF를 forms/ 에 추가하고 이 맵을 새로 뽑을 것
 * (파일명에 개정일을 박아 두는 이유).
 *
 * 렌더링은 [pdfFormOverlay.ts](./pdfFormOverlay.ts) — 원본을 배경으로 값만 얹는다.
 */
import type { FormField, FormSpec, TextField, CheckField, ImageField } from "./pdfFormOverlay";

export const HOUSING_STANDARD_LEASE_FORM: FormSpec = {
  file: "housing-standard-lease-2023-10-06.pdf",
  revision: "2023-10-06",
  legalBasis: "주택임대차보호법 제30조 주택임대차표준계약서(법무부·국토교통부)",
  pageCount: 5,
  pageWidth: 595,
  pageHeight: 841,
};

/** 본문(계약서) 쪽 — 별지2를 뗀 기본 발급 범위. */
export const HOUSING_LEASE_BODY_PAGES = [1, 2, 3, 4];
/** [별지2] 계약갱신 거절통지서 쪽. */
export const HOUSING_LEASE_RENEWAL_REFUSAL_PAGES = [5];

const T = (page: number, x: number, y: number, opts: Partial<Omit<TextField, "kind" | "page" | "x" | "y">> = {}): TextField =>
  ({ kind: "text", page, x, y, size: 9, align: "left", ...opts });
const C = (page: number, x: number, y: number): CheckField => ({ kind: "check", page, x, y, size: 9 });
const I = (page: number, x: number, y: number, width: number, height: number): ImageField =>
  ({ kind: "image", page, x, y, width, height });

/**
 * 서식의 모든 기입란. 키는 우리 도메인 이름, 값은 원본 위치.
 * 값이 없는 필드는 렌더러가 건너뛰므로 빈 서식 출력도 그대로 가능하다.
 */
export const HOUSING_STANDARD_LEASE_FIELDS = {
  // ── 1쪽 머리: 계약 유형 선택 ──────────────────────────────────────────────
  /** □보증금 있는 월세 */
  kind_deposit_monthly: C(1, 468.5, 773.3),
  /** □전세 */
  kind_jeonse: C(1, 468.5, 760.1),
  /** □월세 */
  kind_monthly: C(1, 521.5, 760.1),

  /** 임대인(이름 또는 법인명 기재) — 안내문을 덮고 실명을 쓴다. */
  landlord_inline_name: T(1, 146, 738.5, {
    align: "center", maxWidth: 92,
    clear: { x: 98, y: 735, width: 96, height: 11 },
  }),
  tenant_inline_name: T(1, 297.5, 738.5, {
    align: "center", maxWidth: 92,
    clear: { x: 249, y: 735, width: 97, height: 11 },
  }),

  // ── 1쪽 [임차주택의 표시] ─────────────────────────────────────────────────
  /** 소재지 — 라벨 "(도로명주소)" 뒤에 이어 쓴다. */
  property_address: T(1, 165, 691.4, { maxWidth: 405 }),

  /** 토지: 지목 / 면적(㎡) */
  land_category: T(1, 241.7, 674.7, { align: "center", maxWidth: 160 }),
  land_area: T(1, 558, 674.7, { align: "right", maxWidth: 170 }),

  /** 건물: 구조‧용도 / 면적(㎡) */
  building_structure_use: T(1, 241.7, 658.2, { align: "center", maxWidth: 160 }),
  building_area: T(1, 558, 658.2, { align: "right", maxWidth: 170 }),

  /** 임차할부분 — 원본 안내문("상세주소가 있는 경우…")을 덮고 동·층·호를 쓴다. */
  leased_portion: T(1, 213, 641.5, {
    align: "center", maxWidth: 210,
    clear: { x: 103, y: 638, width: 220, height: 11 },
  }),
  leased_area: T(1, 558, 641.5, { align: "right", maxWidth: 170 }),

  // ── 1쪽 계약의 종류 ───────────────────────────────────────────────────────
  contract_kind_new: C(1, 111.5, 624.4),
  contract_kind_mutual_renewal: C(1, 336.5, 624.4),
  /** ｢주택임대차보호법｣ 제6조의3 계약갱신요구권 행사에 의한 갱신계약 */
  contract_kind_statutory_renewal: C(1, 111.5, 609.2),

  /** 갱신 전 임대차계약 기간 및 금액 — 칸이 좁아 7.5pt로 쓴다. */
  prior_start_year: T(1, 173, 581.4, { align: "right", size: 7.5, maxWidth: 16 }),
  prior_start_month: T(1, 193, 581.4, { align: "right", size: 7.5, maxWidth: 15 }),
  prior_start_day: T(1, 213, 581.4, { align: "right", size: 7.5, maxWidth: 15 }),
  prior_end_year: T(1, 249, 581.4, { align: "right", size: 7.5, maxWidth: 16 }),
  prior_end_month: T(1, 270, 581.4, { align: "right", size: 7.5, maxWidth: 15 }),
  prior_end_day: T(1, 290, 581.4, { align: "right", size: 7.5, maxWidth: 15 }),
  prior_deposit: T(1, 398, 581.4, { align: "right", maxWidth: 62 }),
  prior_rent: T(1, 517, 581.4, { align: "right", maxWidth: 52 }),

  // ── 1쪽 미납 국세·지방세 / 선순위 확정일자 현황 ───────────────────────────
  tax_arrears_none: C(1, 44.5, 553.5),
  tax_arrears_exists: C(1, 44.5, 522.6),
  tax_arrears_landlord_seal: I(1, 126, 534, 58, 15),

  prior_fixed_date_none: C(1, 234.5, 553.5),
  prior_fixed_date_exists: C(1, 234.5, 522.6),
  prior_fixed_date_landlord_seal: I(1, 324, 534, 58, 15),

  // ── 1쪽 [계약내용] 제1조(보증금과 차임 및 관리비) ─────────────────────────
  /** 보증금 — 금 ____ 원정(₩ ____) */
  deposit_words: T(1, 204, 432.1, { align: "center", maxWidth: 168 }),
  deposit_figures: T(1, 452, 432.1, { align: "right", maxWidth: 126 }),

  /** 계약금 — …은 계약시에 지불하고 영수함. 영수자 ( ___ 인) */
  down_payment_words: T(1, 159, 412.6, { align: "center", maxWidth: 80 }),
  down_payment_figures: T(1, 300, 412.6, { align: "right", maxWidth: 64 }),
  down_payment_receiver: T(1, 503, 412.6, { align: "center", maxWidth: 40 }),

  /** 중도금 — …은 ___년 ___월 ___일에 지불하며 */
  interim_payment_words: T(1, 159, 393.1, { align: "center", maxWidth: 80 }),
  interim_payment_figures: T(1, 300, 393.1, { align: "right", maxWidth: 64 }),
  interim_payment_year: T(1, 366, 393.1, { align: "right", maxWidth: 40 }),
  interim_payment_month: T(1, 423, 393.1, { align: "right", maxWidth: 30 }),
  interim_payment_day: T(1, 471, 393.1, { align: "right", maxWidth: 30 }),

  /** 잔금 — …은 ___년 ___월 ___일에 지불한다 */
  balance_words: T(1, 159, 373.6, { align: "center", maxWidth: 80 }),
  balance_figures: T(1, 300, 373.6, { align: "right", maxWidth: 64 }),
  balance_year: T(1, 366, 373.6, { align: "right", maxWidth: 40 }),
  balance_month: T(1, 423, 373.6, { align: "right", maxWidth: 30 }),
  balance_day: T(1, 471, 373.6, { align: "right", maxWidth: 30 }),

  /** 차임(월세) — 금 ___ 원정은 매월 ___일에 지불한다(입금계좌: ___ ) */
  rent_words: T(1, 158.5, 354.1, { align: "center", maxWidth: 78 }),
  rent_due_day: T(1, 270, 354.1, { align: "center", maxWidth: 18 }),
  rent_account: T(1, 390, 354.1, { maxWidth: 155 }),

  /** 관리비 — (정액인 경우) 총액 */
  mgmt_total_words: T(1, 262, 333.9, { align: "center", maxWidth: 90 }),
  mgmt_total_figures: T(1, 480, 333.9, { align: "right", maxWidth: 132 }),

  /** 관리비 세부항목 (월 10만원 이상인 경우) — 좌: 1·3·5·7, 우: 2·4·6·8 */
  mgmt_general_words: T(1, 227, 296.1, { align: "center", maxWidth: 55 }),
  mgmt_general_figures: T(1, 326, 296.1, { align: "right", maxWidth: 33 }),
  mgmt_electricity_words: T(1, 470, 296.1, { align: "center", maxWidth: 50 }),
  mgmt_electricity_figures: T(1, 567, 296.1, { align: "right", maxWidth: 33 }),
  mgmt_water_words: T(1, 227, 279.7, { align: "center", maxWidth: 55 }),
  mgmt_water_figures: T(1, 326, 279.7, { align: "right", maxWidth: 33 }),
  mgmt_gas_words: T(1, 470, 279.7, { align: "center", maxWidth: 50 }),
  mgmt_gas_figures: T(1, 567, 279.7, { align: "right", maxWidth: 33 }),
  mgmt_heating_words: T(1, 227, 263.1, { align: "center", maxWidth: 55 }),
  mgmt_heating_figures: T(1, 326, 263.1, { align: "right", maxWidth: 33 }),
  mgmt_internet_words: T(1, 470, 263.1, { align: "center", maxWidth: 50 }),
  mgmt_internet_figures: T(1, 567, 263.1, { align: "right", maxWidth: 33 }),
  mgmt_tv_words: T(1, 227, 246.6, { align: "center", maxWidth: 55 }),
  mgmt_tv_figures: T(1, 326, 246.6, { align: "right", maxWidth: 33 }),
  mgmt_other_words: T(1, 470, 246.6, { align: "center", maxWidth: 50 }),
  mgmt_other_figures: T(1, 567, 246.6, { align: "right", maxWidth: 33 }),

  /** (정액이 아닌 경우) 관리비의 항목 및 산정방식 — 원본 예시문을 덮는다. */
  mgmt_variable_note: T(1, 106, 208.3, {
    maxWidth: 462,
    clear: { x: 104, y: 204.5, width: 466, height: 12.5 },
  }),

  // ── 1쪽 제2조(임대차기간) ─────────────────────────────────────────────────
  handover_year: T(1, 460, 184.4, { align: "right", maxWidth: 40 }),
  handover_month: T(1, 498, 184.4, { align: "right", maxWidth: 30 }),
  handover_day: T(1, 536, 184.4, { align: "right", maxWidth: 30 }),
  term_end_year: T(1, 311, 172.5, { align: "right", maxWidth: 40 }),
  term_end_month: T(1, 372, 172.5, { align: "right", maxWidth: 30 }),
  term_end_day: T(1, 429, 172.5, { align: "right", maxWidth: 30 }),

  // ── 1쪽 제3조(입주 전 수리) ───────────────────────────────────────────────
  repair_needed_none: C(1, 150.5, 120.8),
  repair_needed_exists: C(1, 190.5, 120.8),
  repair_contents: T(1, 292, 120.8, { maxWidth: 238 }),
  repair_due_on_balance: C(1, 150.5, 100.9),
  repair_due_year: T(1, 283, 100.9, { align: "right", maxWidth: 40 }),
  repair_due_month: T(1, 325, 100.9, { align: "right", maxWidth: 30 }),
  repair_due_day: T(1, 367, 100.9, { align: "right", maxWidth: 30 }),
  repair_due_other: C(1, 416.5, 100.9),
  repair_due_other_text: T(1, 460, 100.9, { maxWidth: 78 }),
  /** 미수리 시: □ 보증금·차임에서 공제 / □ 기타 */
  unrepaired_deduct: C(1, 150.5, 82.3),
  unrepaired_other: C(1, 150.5, 69.7),
  unrepaired_other_text: T(1, 190, 69.7, { maxWidth: 345 }),

  // ── 2쪽 제4조③ 수선 및 비용부담 합의 ─────────────────────────────────────
  /** 임대인부담 — 원본의 회색 예시문("예컨대, 난방…")을 덮고 합의 내용을 쓴다. */
  repair_landlord_burden: T(2, 118, 723.0, {
    maxWidth: 452,
    clear: { x: 112, y: 712.5, width: 462, height: 24 },
  }),
  /** 임차인부담 */
  repair_tenant_burden: T(2, 118, 698.5, {
    maxWidth: 452,
    clear: { x: 112, y: 688.0, width: 462, height: 24 },
  }),

  // ── 2쪽 제12조(중개보수 등) ───────────────────────────────────────────────
  brokerage_rate: T(2, 273, 326.5, { align: "right", maxWidth: 34 }),
  brokerage_amount: T(2, 378, 326.5, { align: "right", maxWidth: 78 }),
  brokerage_vat_included: C(2, 400.5, 326.5),
  brokerage_vat_excluded: C(2, 503, 326.5),

  // ── 2쪽 제13조(중개대상물확인·설명서 교부) ────────────────────────────────
  disclosure_year: T(2, 235, 274.4, { align: "right", maxWidth: 40 }),
  disclosure_month: T(2, 293, 274.4, { align: "right", maxWidth: 30 }),
  disclosure_day: T(2, 350, 274.4, { align: "right", maxWidth: 30 }),

  // ── 2쪽 [특약사항] 법정 문구의 빈칸 ───────────────────────────────────────
  /** 주민등록(전입신고)·확정일자 약정일 */
  fixed_date_year: T(2, 205, 229.5, { align: "right", maxWidth: 32 }),
  fixed_date_month: T(2, 240, 229.5, { align: "right", maxWidth: 17 }),
  fixed_date_day: T(2, 276, 229.5, { align: "right", maxWidth: 17 }),
  /** 해제 사유가 되는 미납·체납 국세·지방세 기준액 */
  tax_arrears_threshold: T(2, 468, 159.5, { align: "right", maxWidth: 30 }),
  /** 분쟁조정위원회 조정 신청 (□ 동의 □ 미동의) */
  mediation_agree: C(2, 248.5, 105.3),
  mediation_disagree: C(2, 302.5, 105.3),
  /** 철거 또는 재건축 계획 (□ 없음 □ 있음 ※공사시기 ※소요기간) */
  demolition_none: C(2, 257.5, 72.3),
  demolition_exists: C(2, 298, 72.3),
  demolition_start: T(2, 392, 72.3, { maxWidth: 58 }),
  demolition_months: T(2, 534, 72.3, { align: "right", maxWidth: 22 }),
  /** 상세주소부여 신청에 대한 소유자 동의 여부 */
  detailed_address_agree: C(2, 415.5, 56.3),
  detailed_address_disagree: C(2, 469.5, 56.3),

  // ── 3쪽 ※기타(추가 특약 3줄) ─────────────────────────────────────────────
  other_note_1: T(3, 90, 802.0, { maxWidth: 472 }),
  other_note_2: T(3, 48, 789.2, { maxWidth: 514 }),
  other_note_3: T(3, 48, 774.0, { maxWidth: 514 }),

  // ── 3쪽 계약 체결일 ───────────────────────────────────────────────────────
  signed_year: T(3, 438, 716.6, { align: "right", maxWidth: 44 }),
  signed_month: T(3, 499, 716.6, { align: "right", maxWidth: 32 }),
  signed_day: T(3, 553, 716.6, { align: "right", maxWidth: 32 }),

  // ── 3쪽 임대인 ────────────────────────────────────────────────────────────
  landlord_address: T(3, 130, 687.8, { maxWidth: 375 }),
  landlord_id_no: T(3, 196, 663.2, { align: "center", maxWidth: 140 }),
  landlord_phone: T(3, 371.5, 663.2, { align: "center", maxWidth: 75 }),
  landlord_name: T(3, 479, 663.2, { align: "center", maxWidth: 62 }),
  landlord_seal: I(3, 515, 656, 48, 18),
  landlord_agent_address: T(3, 214, 638.6, { align: "center", maxWidth: 108 }),
  landlord_agent_id_no: T(3, 371.5, 638.6, { align: "center", maxWidth: 75 }),
  landlord_agent_name: T(3, 479, 638.6, { align: "center", maxWidth: 62 }),

  // ── 3쪽 임차인 ────────────────────────────────────────────────────────────
  tenant_address: T(3, 130, 614.0, { maxWidth: 375 }),
  tenant_id_no: T(3, 196, 589.4, { align: "center", maxWidth: 140 }),
  tenant_phone: T(3, 371.5, 589.4, { align: "center", maxWidth: 75 }),
  tenant_name: T(3, 479, 589.4, { align: "center", maxWidth: 62 }),
  tenant_seal: I(3, 515, 582, 48, 18),
  tenant_agent_address: T(3, 214, 564.7, { align: "center", maxWidth: 108 }),
  tenant_agent_id_no: T(3, 371.5, 564.7, { align: "center", maxWidth: 75 }),
  tenant_agent_name: T(3, 479, 564.7, { align: "center", maxWidth: 62 }),

  // ── 3쪽 개업공인중개사(직거래면 비워 둔다) ────────────────────────────────
  broker_office_address: T(3, 196, 540.5, { align: "center", maxWidth: 142 }),
  broker_office_name: T(3, 196, 516.8, { align: "center", maxWidth: 142 }),
  broker_ceo_name: T(3, 227, 493.0, { align: "center", maxWidth: 70 }),
  broker_reg_no: T(3, 156, 469.3, { align: "center", maxWidth: 62 }),
  broker_phone: T(3, 245, 469.3, { align: "center", maxWidth: 46 }),

  // ── 5쪽 [별지2] 계약갱신 거절통지서 ───────────────────────────────────────
  refusal_landlord_name: T(5, 214, 747.7, { align: "center", maxWidth: 170 }),
  refusal_landlord_address: T(5, 214, 727.5, { align: "center", maxWidth: 170 }),
  refusal_landlord_phone: T(5, 214, 707.3, { align: "center", maxWidth: 170 }),
  refusal_tenant_name: T(5, 488, 747.7, { align: "center", maxWidth: 162 }),
  refusal_tenant_address: T(5, 488, 727.5, { align: "center", maxWidth: 162 }),
  refusal_tenant_phone: T(5, 488, 707.3, { align: "center", maxWidth: 162 }),
  refusal_premises_address: T(5, 132, 687.5, { maxWidth: 435 }),
  refusal_lease_term: T(5, 132, 667.7, { maxWidth: 435 }),

  /** 임대인(____)은 임차인(____)로부터 ____년 ____월 ____일 갱신을 요구받았으나 */
  refusal_body_landlord: T(5, 107, 629.1, { align: "center", maxWidth: 60 }),
  refusal_body_tenant: T(5, 220, 629.1, { align: "center", maxWidth: 58 }),
  refusal_request_year: T(5, 301, 629.1, { align: "center", maxWidth: 22 }),
  refusal_request_month: T(5, 341, 629.1, { align: "center", maxWidth: 22 }),
  refusal_request_day: T(5, 381, 629.1, { align: "center", maxWidth: 22 }),

  /** 계약갱신거절 사유 (주택임대차보호법 제6조의3 제1항 각 호) */
  refusal_reason_1: C(5, 447, 516.9),
  refusal_reason_2: C(5, 318, 499.3),
  refusal_reason_3: C(5, 348, 481.6),
  refusal_reason_3_text: T(5, 155, 464.1, { maxWidth: 236 }),
  refusal_reason_4: C(5, 419, 446.5),
  refusal_reason_5: C(5, 412, 428.8),
  refusal_reason_6: C(5, 422, 411.3),
  refusal_reason_7_1: C(5, 211, 358.5),
  refusal_reason_7_2: C(5, 404, 340.9),
  refusal_reason_7_3: C(5, 325, 323.2),
  refusal_reason_8: C(5, 382, 305.7),
  refusal_reason_8_name: T(5, 126, 288.1, { maxWidth: 54 }),
  refusal_reason_8_self: C(5, 283, 288.1),
  refusal_reason_8_ascendant: C(5, 321, 288.1),
  refusal_reason_8_descendant: C(5, 384.5, 288.1),
  refusal_reason_9: C(5, 558, 270.4),

  /** 보충설명 — 원본의 괘선 2줄(y 205.5 / 185.2) 위에 얹는다. */
  refusal_detail_1: T(5, 34, 209.0, { maxWidth: 528 }),
  refusal_detail_2: T(5, 34, 188.8, { maxWidth: 528 }),

  refusal_written_year: T(5, 127, 116.3, { align: "right", maxWidth: 44 }),
  refusal_written_month: T(5, 179, 116.3, { align: "right", maxWidth: 32 }),
  refusal_written_day: T(5, 226, 116.3, { align: "right", maxWidth: 32 }),
  refusal_signer_name: T(5, 365, 116.3, { maxWidth: 100 }),
  refusal_signer_seal: I(5, 400, 110, 60, 18),
} as const satisfies Record<string, FormField>;

export type HousingStandardLeaseFieldKey = keyof typeof HOUSING_STANDARD_LEASE_FIELDS;

/** 렌더러 입력: 텍스트는 문자열, 체크박스는 boolean, 서명은 data/https URL. */
export type HousingStandardLeaseValues = Partial<
  Record<HousingStandardLeaseFieldKey, string | number | boolean | null | undefined>
>;
