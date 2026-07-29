/**
 * 국토교통부 「표준임대차계약서」 — 계약 데이터 → 서식 값 매핑.
 *
 * 원본 PDF를 배경으로 값만 얹으므로(→ [pdfFormOverlay.ts](./pdfFormOverlay.ts))
 * 이 모듈은 "무엇을 어느 칸에 쓸 것인가"만 정한다. 좌표는
 * [mltStandardLeaseFields.ts](./mltStandardLeaseFields.ts).
 *
 * 이 서식은 시장ㆍ군수ㆍ구청장에게 등록한 **임대사업자 전용 법정서식**이다
 * (민간임대주택에 관한 특별법 시행규칙 별지 제24호서식, 미사용 시 과태료).
 * 등록임대주택이 아니면 법무부 주택임대차표준계약서(→ housingStandardLeaseForm.ts)
 * 를 쓴다 — 둘을 섞지 않는다.
 */
import {
  MLT_STANDARD_LEASE_FIELDS,
  MLT_STANDARD_LEASE_FORM,
  type MltStandardLeaseValues,
} from "./mltStandardLeaseFields";
import { fillPdfForm } from "./pdfFormOverlay";
import { koreanNumerals } from "../koreanLeaseDocument";

/** 주택 유형 — 서식 3번 표의 5지선다. */
export type MltHousingType = "apartment" | "row_house" | "multiplex" | "multi_family" | "other";
/** 민간임대주택의 종류 — 공공지원 / 장기일반 / 단기. */
export type MltRentalType = "public_support" | "long_term" | "short_term";
/** 공급 방식. */
export type MltSupplyKind = "built" | "purchased";
/** 임대보증금 보증 가입 여부. */
export type MltGuaranteeStatus = "joined" | "partial" | "not_joined";
/**
 * 미가입 법정사유 — 서식이 정해 둔 4가지 외에는 고를 수 없다.
 *  zero            가입대상 금액이 0원 이하(법 제49조제3항)
 *  priority        임대보증금이 우선변제금 이하(법 제49조제7항제1호)
 *  public_landlord 공공주택사업자와 임대차계약 체결(법 제49조제7항제2호)
 *  tenant_guarantee 임차인이 전세보증금반환보증에 가입(법 제49조제7항제3호)
 */
export type MltGuaranteeNoneReason = "zero" | "priority" | "public_landlord" | "tenant_guarantee";

export interface MltLeaseParty {
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  /** 주민등록번호(임차인) 또는 사업자등록번호(임대사업자). 없으면 비워 둔다. */
  id_no?: string | null;
  /** 서명·날인 이미지(data: 또는 https:). */
  seal_image?: string | null;
}

export interface MltStandardLeaseInput {
  /** 계약 체결일. */
  signed_on?: string | Date | null;

  landlord: MltLeaseParty;
  tenant: MltLeaseParty;
  /** 임대사업자 등록번호 — 예 "2026-여수시-임대사업자-11". */
  landlord_rental_biz_no?: string | null;

  /** 2. 공인중개사 — 직거래면 전부 비워 둔다. */
  broker_office_name?: string | null;
  broker_ceo_name?: string | null;
  broker_office_address?: string | null;
  broker_reg_no?: string | null;
  broker_phone?: string | null;
  broker_ceo_seal?: string | null;
  /** 2025. 10. 31. 개정으로 신설된 소속공인중개사 행. */
  broker_assistant_name?: string | null;
  broker_assistant_seal?: string | null;

  /** 3. 민간임대주택의 표시 */
  property_address?: string | null;
  housing_type?: MltHousingType | null;
  /** 면적(㎡) — 주거전용 / 주거공용 / 그 밖의 공용. 합계는 넘기지 않으면 셋을 더한다. */
  area_exclusive_m2?: number | null;
  area_common_residential_m2?: number | null;
  area_common_other_m2?: number | null;
  area_total_m2?: number | null;

  rental_type?: MltRentalType | null;
  /** 임대의무기간(년) — 공공지원/장기일반은 10 또는 8, 단기는 6 또는 4. */
  rental_term_years?: number | null;
  /** 위 셋에 해당하지 않는 유형을 적는 칸. */
  rental_type_other?: string | null;
  supply_kind?: MltSupplyKind | null;
  mandatory_start_date?: string | null;

  /** 100세대 이상 민간임대주택단지 해당 여부 — 임대료 증액 기준이 달라진다. */
  over_100_units?: boolean | null;
  ancillary_facilities?: string | null;

  /** 선순위 담보권 등 권리관계 — 없으면 `false`, 있으면 종류/금액/일자. */
  senior_lien?: boolean | null;
  senior_lien_kind?: string | null;
  senior_lien_amount?: number | null;
  senior_lien_date?: string | null;

  /** 국세ㆍ지방세 체납사실. */
  tax_arrears?: boolean | null;

  /** 임대보증금 보증 가입 여부 */
  guarantee_status?: MltGuaranteeStatus | null;
  /** 가입·일부가입일 때의 보증대상 금액. */
  guarantee_amount?: number | null;
  guarantee_none_reason?: MltGuaranteeNoneReason | null;

  /** 제1조① 임대보증금 / 월임대료 / 계약기간 */
  deposit_amount?: number | null;
  monthly_rent?: number | null;
  start_date?: string | null;
  end_date?: string | null;

  /** 제1조② 계약금 / 중도금 / 잔금 + 납부계좌 */
  down_payment?: number | null;
  interim_payment?: number | null;
  interim_payment_date?: string | null;
  balance_amount?: number | null;
  balance_date?: string | null;
  account_number?: string | null;
  bank_name?: string | null;
  account_holder?: string | null;

  /** 제1조④ 연체이율(연 %). */
  late_fee_rate?: number | null;

  /** 제2조 입주일 — 비워 두면 계약기간과 같게 채운다. */
  move_in_start_date?: string | null;
  move_in_end_date?: string | null;
}

/** 서식이 요구하는 한글 금액(금 ___ 원정)의 가운데 토막. */
function amountWords(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return koreanNumerals(Number(value));
}

function figures(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(Number(value))) return null;
  return Number(value).toLocaleString("ko-KR");
}

function area(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(Number(value)) || Number(value) === 0) return null;
  return Number(value).toLocaleString("ko-KR", { maximumFractionDigits: 3 });
}

/** 날짜를 년/월/일 세 칸으로 쪼갠다. 유효하지 않으면 전부 null. */
function ymd(value: string | Date | null | undefined): { y: string | null; m: string | null; d: string | null } {
  if (value == null || value === "") return { y: null, m: null, d: null };
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return { y: null, m: null, d: null };
  return {
    y: String(dt.getFullYear()),
    m: String(dt.getMonth() + 1).padStart(2, "0"),
    d: String(dt.getDate()).padStart(2, "0"),
  };
}

/** "2024. 3. 15." — 선순위 담보권 설정일자처럼 한 칸에 들어가는 날짜. */
function dotted(value: string | Date | null | undefined): string | null {
  const { y, m, d } = ymd(value);
  return y ? `${y}. ${Number(m)}. ${Number(d)}.` : null;
}

/** 임대의무기간 개시일 등은 서식 여백이 넉넉해 네 자리 연도를 쓴다. */
export function toMltStandardLeaseValues(d: MltStandardLeaseInput): MltStandardLeaseValues {
  const signed = ymd(d.signed_on);
  const mandatory = ymd(d.mandatory_start_date);
  const term0 = ymd(d.start_date);
  const term1 = ymd(d.end_date);
  const interim = ymd(d.interim_payment_date);
  const balance = ymd(d.balance_date);
  // 제2조 입주일은 기본적으로 계약기간과 같다.
  const moveIn0 = ymd(d.move_in_start_date ?? d.start_date);
  const moveIn1 = ymd(d.move_in_end_date ?? d.end_date);

  const totalArea = d.area_total_m2 ?? (
    [d.area_exclusive_m2, d.area_common_residential_m2, d.area_common_other_m2]
      .some((v) => v != null && Number.isFinite(Number(v)))
      ? Number(d.area_exclusive_m2 ?? 0) + Number(d.area_common_residential_m2 ?? 0) + Number(d.area_common_other_m2 ?? 0)
      : null
  );

  const years = d.rental_term_years ?? null;
  const guarantee = d.guarantee_status ?? null;

  return {
    contract_date_year: signed.y,
    contract_date_month: signed.m,
    contract_date_day: signed.d,

    landlord_name: d.landlord.name ?? null,
    landlord_address: d.landlord.address ?? null,
    landlord_id_no: d.landlord.id_no ?? null,
    landlord_phone: d.landlord.phone ?? null,
    landlord_seal: d.landlord.seal_image ?? null,
    landlord_rental_biz_no: d.landlord_rental_biz_no ?? null,

    tenant_name: d.tenant.name ?? null,
    tenant_address: d.tenant.address ?? null,
    tenant_id_no: d.tenant.id_no ?? null,
    tenant_phone: d.tenant.phone ?? null,
    tenant_seal: d.tenant.seal_image ?? null,

    broker_office_name: d.broker_office_name ?? null,
    broker_ceo_name: d.broker_ceo_name ?? null,
    broker_seal: d.broker_ceo_seal ?? null,
    broker_office_address: d.broker_office_address ?? null,
    broker_reg_no: d.broker_reg_no ?? null,
    broker_phone: d.broker_phone ?? null,
    broker_assistant_name: d.broker_assistant_name ?? null,
    broker_assistant_seal: d.broker_assistant_seal ?? null,

    property_address: d.property_address ?? null,
    housing_type_apartment: d.housing_type === "apartment",
    housing_type_row_house: d.housing_type === "row_house",
    housing_type_multiplex: d.housing_type === "multiplex",
    housing_type_multi_family: d.housing_type === "multi_family",
    housing_type_other: d.housing_type === "other",

    area_exclusive: area(d.area_exclusive_m2),
    area_common_residential: area(d.area_common_residential_m2),
    area_common_other: area(d.area_common_other_m2),
    area_total: area(totalArea),

    type_public_support: d.rental_type === "public_support",
    type_public_support_10y: d.rental_type === "public_support" && years === 10,
    type_public_support_8y: d.rental_type === "public_support" && years === 8,
    type_long_term: d.rental_type === "long_term",
    type_long_term_10y: d.rental_type === "long_term" && years === 10,
    type_long_term_8y: d.rental_type === "long_term" && years === 8,
    type_short_term: d.rental_type === "short_term",
    type_short_term_6y: d.rental_type === "short_term" && years === 6,
    type_short_term_4y: d.rental_type === "short_term" && years === 4,
    type_other_text: d.rental_type_other ?? null,
    supply_built: d.supply_kind === "built",
    supply_purchased: d.supply_kind === "purchased",

    mandatory_start_year: mandatory.y,
    mandatory_start_month: mandatory.m,
    mandatory_start_day: mandatory.d,

    // 미지정(null)이면 어느 칸도 찍지 않는다 — 모르는 것을 "아니오"로 단정하지 않기 위해.
    over_100_units_yes: d.over_100_units === true,
    over_100_units_no: d.over_100_units === false,
    ancillary_facilities: d.ancillary_facilities ?? null,

    senior_lien_none: d.senior_lien === false,
    senior_lien_exists: d.senior_lien === true,
    senior_lien_kind: d.senior_lien ? d.senior_lien_kind ?? null : null,
    senior_lien_amount: d.senior_lien ? (figures(d.senior_lien_amount) ? `${figures(d.senior_lien_amount)}원` : null) : null,
    senior_lien_date: d.senior_lien ? dotted(d.senior_lien_date) : null,

    tax_arrears_none: d.tax_arrears === false,
    tax_arrears_exists: d.tax_arrears === true,

    guarantee_joined: guarantee === "joined",
    guarantee_joined_amount: guarantee === "joined" && figures(d.guarantee_amount) ? `${figures(d.guarantee_amount)}원` : null,
    guarantee_partial: guarantee === "partial",
    guarantee_partial_amount: guarantee === "partial" && figures(d.guarantee_amount) ? `${figures(d.guarantee_amount)}원` : null,
    guarantee_not_joined: guarantee === "not_joined",
    guarantee_reason_zero: guarantee === "not_joined" && d.guarantee_none_reason === "zero",
    guarantee_reason_priority: guarantee === "not_joined" && d.guarantee_none_reason === "priority",
    guarantee_reason_public: guarantee === "not_joined" && d.guarantee_none_reason === "public_landlord",
    guarantee_reason_tenant_guarantee: guarantee === "not_joined" && d.guarantee_none_reason === "tenant_guarantee",

    deposit_amount_words: amountWords(d.deposit_amount),
    deposit_amount_figures: figures(d.deposit_amount),
    rent_amount_words: amountWords(d.monthly_rent),
    rent_amount_figures: figures(d.monthly_rent),

    term_start_year: term0.y,
    term_start_month: term0.m,
    term_start_day: term0.d,
    term_end_year: term1.y,
    term_end_month: term1.m,
    term_end_day: term1.d,

    down_payment_words: amountWords(d.down_payment),
    down_payment_figures: figures(d.down_payment),
    interim_payment_words: amountWords(d.interim_payment),
    interim_payment_figures: figures(d.interim_payment),
    interim_payment_year: interim.y,
    interim_payment_month: interim.m,
    interim_payment_day: interim.d,
    balance_words: amountWords(d.balance_amount),
    balance_figures: figures(d.balance_amount),
    balance_year: balance.y,
    balance_month: balance.m,
    balance_day: balance.d,

    account_number: d.account_number ?? null,
    bank_name: d.bank_name ?? null,
    account_holder: d.account_holder ?? null,

    late_fee_rate: d.late_fee_rate == null ? null : String(d.late_fee_rate),

    move_in_start_year: moveIn0.y,
    move_in_start_month: moveIn0.m,
    move_in_start_day: moveIn0.d,
    // 종료 연도 칸은 원본 조판상 7.5pt뿐이라 네 자리가 들어가지 않는다 → 두 자리.
    move_in_end_year: moveIn1.y ? moveIn1.y.slice(2) : null,
    move_in_end_month: moveIn1.m,
    move_in_end_day: moveIn1.d,

    // 5·6쪽의 임차인 확인 서명 — 계약 당사자와 같은 사람이다.
    explain_tenant_name: d.tenant.name ?? null,
    explain_tenant_seal: d.tenant.seal_image ?? null,
    consent_tenant_name: d.tenant.name ?? null,
    consent_tenant_seal: d.tenant.seal_image ?? null,
  };
}

/** 표준임대차계약서(별지 제24호서식) 6쪽 PDF 바이트를 만든다. */
export async function buildMltStandardLeasePdf(input: MltStandardLeaseInput): Promise<Uint8Array> {
  return fillPdfForm(MLT_STANDARD_LEASE_FORM, MLT_STANDARD_LEASE_FIELDS, toMltStandardLeaseValues(input));
}
