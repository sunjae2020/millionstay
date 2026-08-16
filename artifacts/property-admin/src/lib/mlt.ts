/**
 * 민간임대주택 법정 기재사항 — 표준임대차계약서(별지 제24호서식) 첫 장의 값들.
 *
 * 같은 항목이 두 곳에 나온다: 임대사업자 등록증(계정관리 → 임대인·소유주 →
 * 임대사업자)의 기본값과, 그 값을 물려받는 계약 상세. 선택지가 어긋나면 등록증에
 * 적어 둔 값이 계약에서 사라지므로 목록·라벨 키를 여기 한 벌만 둔다.
 *
 * 서버 쪽 짝은 api-server 의 `mltLeaseFields()`(계약)와 `RegistrationBody`(등록증)다.
 */

export const MLT_HOUSING_TYPES = ["apartment", "row_house", "multiplex", "multi_family", "other"] as const;
export const MLT_RENTAL_TYPES = ["public_support", "long_term", "short_term"] as const;
export const MLT_SUPPLY_KINDS = ["built", "purchased"] as const;
export const MLT_GUARANTEE_STATUSES = ["joined", "partial", "not_joined"] as const;
export const MLT_GUARANTEE_NONE_REASONS = ["zero", "priority", "public_landlord", "tenant_guarantee"] as const;

/** 임대의무기간은 민간임대주택의 종류에 따라 고를 수 있는 햇수가 다르다. */
export const MLT_TERM_YEARS: Record<string, number[]> = {
  public_support: [10, 8],
  long_term: [10, 8],
  short_term: [6, 4],
};

/**
 * 세 값 선택(예·아니오·미지정)을 boolean|null 과 오간다. 폼은 빈 문자열을 "미지정"
 * 으로 쓰고, DB 는 null 로 둔다 — 서식의 그 칸이 빈 채로 발급된다는 뜻이다.
 */
export const toTriState = (v: unknown): string => (v === true ? "yes" : v === false ? "no" : "");
export const fromTriState = (v: string): boolean | null => (v === "yes" ? true : v === "no" ? false : null);

/**
 * 등록증과 계약이 공유하는 법정 기재사항 칸 — 폼에서는 전부 문자열로 다룬다.
 * 임대사업자 등록번호는 여기 없다. 등록증에서는 registration_no 가 그 값이고,
 * 계약에서는 고른 등록증의 번호를 옮겨 담는 별도 칸(mlt_landlord_rental_biz_no)이다.
 */
export const MLT_SHARED_FIELDS = [
  "mlt_housing_type",
  "mlt_rental_type",
  "mlt_rental_term_years",
  "mlt_rental_type_other",
  "mlt_supply_kind",
  "mlt_mandatory_start_date",
  "mlt_over_100_units",
  "mlt_ancillary_facilities",
  "mlt_senior_lien",
  "mlt_senior_lien_kind",
  "mlt_senior_lien_amount",
  "mlt_senior_lien_date",
  "mlt_tax_arrears",
  "mlt_guarantee_status",
  "mlt_guarantee_amount",
  "mlt_guarantee_none_reason",
  "mlt_late_fee_rate",
] as const;

export type MltSharedField = (typeof MLT_SHARED_FIELDS)[number];

/** 서버에서 온 등록증 한 행에서 법정 기재사항만 뽑는다(불리언·숫자는 폼 문자열로). */
export function mltFieldsFromRegistration(source: object): Record<MltSharedField, string> {
  // 호출부는 등록증 행 타입 그대로 넘긴다 — 칸 이름으로 읽기 위해 한 번만 넓힌다.
  const reg = source as Record<string, unknown>;
  const text = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
  return {
    mlt_housing_type: text(reg["mlt_housing_type"]),
    mlt_rental_type: text(reg["mlt_rental_type"]),
    mlt_rental_term_years: text(reg["mlt_rental_term_years"]),
    mlt_rental_type_other: text(reg["mlt_rental_type_other"]),
    mlt_supply_kind: text(reg["mlt_supply_kind"]),
    mlt_mandatory_start_date: text(reg["mlt_mandatory_start_date"]),
    mlt_over_100_units: toTriState(reg["mlt_over_100_units"]),
    mlt_ancillary_facilities: text(reg["mlt_ancillary_facilities"]),
    mlt_senior_lien: toTriState(reg["mlt_senior_lien"]),
    mlt_senior_lien_kind: text(reg["mlt_senior_lien_kind"]),
    mlt_senior_lien_amount: text(reg["mlt_senior_lien_amount"]),
    mlt_senior_lien_date: text(reg["mlt_senior_lien_date"]),
    mlt_tax_arrears: toTriState(reg["mlt_tax_arrears"]),
    mlt_guarantee_status: text(reg["mlt_guarantee_status"]),
    mlt_guarantee_amount: text(reg["mlt_guarantee_amount"]),
    mlt_guarantee_none_reason: text(reg["mlt_guarantee_none_reason"]),
    mlt_late_fee_rate: text(reg["mlt_late_fee_rate"]),
  };
}
