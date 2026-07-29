/**
 * 법무부 「주택임대차표준계약서」 — 계약 데이터 → 서식 값 매핑.
 *
 * 원본 PDF를 배경으로 값만 얹으므로(→ [pdfFormOverlay.ts](./pdfFormOverlay.ts))
 * 이 모듈은 "무엇을 어느 칸에 쓸 것인가"만 정한다. 좌표는
 * [housingStandardLeaseFields.ts](./housingStandardLeaseFields.ts).
 *
 * 이 서식은 **임대사업자가 아닌 일반 임대인**용 표준서식(주택임대차보호법
 * 제30조, 권장 서식)이다. 등록임대사업자는 민간임대주택법 시행규칙 별지
 * 제24호서식(→ mltStandardLeaseForm.ts)을 써야 하므로 둘을 섞지 않는다.
 */
import {
  HOUSING_LEASE_BODY_PAGES,
  HOUSING_LEASE_RENEWAL_REFUSAL_PAGES,
  HOUSING_STANDARD_LEASE_FIELDS,
  HOUSING_STANDARD_LEASE_FORM,
  type HousingStandardLeaseValues,
} from "./housingStandardLeaseFields";
import { fillPdfForm } from "./pdfFormOverlay";
import { koreanNumerals } from "../koreanLeaseDocument";

/** 계약 유형 — 서식 머리의 3지선다. */
export type HousingLeaseKind = "deposit_monthly" | "jeonse" | "monthly";
/** 계약의 종류 — 신규 / 합의 재계약 / 갱신요구권 행사 갱신. */
export type HousingLeaseContractKind = "new" | "mutual_renewal" | "statutory_renewal";

export interface HousingLeaseParty {
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  /** 주민등록번호 또는 법인등록번호/사업자등록번호. 없으면 비워 둔다. */
  id_no?: string | null;
  /** 서명·날인 이미지(data: 또는 https:). */
  seal_image?: string | null;
  /** 대리인이 체결한 경우. */
  agent_name?: string | null;
  agent_address?: string | null;
  agent_id_no?: string | null;
}

export interface HousingStandardLeaseInput {
  kind: HousingLeaseKind;
  contract_kind: HousingLeaseContractKind;

  /** 임차주택의 표시 */
  property_address?: string | null;
  land_category?: string | null;
  land_area_m2?: number | null;
  building_structure_use?: string | null;
  building_area_m2?: number | null;
  /** 동·층·호 */
  leased_portion?: string | null;
  leased_area_m2?: number | null;

  /** 갱신계약인 경우 갱신 전 계약 정보 */
  prior_start_date?: string | null;
  prior_end_date?: string | null;
  prior_deposit?: number | null;
  prior_rent?: number | null;

  /** 미납 국세·지방세 / 선순위 확정일자 현황 — 임대인이 고지하는 항목. */
  tax_arrears?: boolean | null;
  prior_fixed_date?: boolean | null;
  /** 위 두 칸의 임대인 서명 이미지. */
  landlord_disclosure_seal?: string | null;

  /** 제1조 금액 */
  deposit_amount?: number | null;
  down_payment?: number | null;
  down_payment_receiver?: string | null;
  interim_payment?: number | null;
  interim_payment_date?: string | null;
  balance_amount?: number | null;
  balance_date?: string | null;
  monthly_rent?: number | null;
  rent_due_day?: number | null;
  /** 차임 입금계좌 — "신협 131-022-898360 (예금주 ○○)". */
  rent_account?: string | null;

  /** 관리비 — 정액이면 총액, 아니면 산정방식 문구. */
  management_fee?: number | null;
  management_fee_note?: string | null;

  /** 제2조 기간 */
  handover_date?: string | null;
  start_date?: string | null;
  end_date?: string | null;

  /** 제4조③ 수선·비용부담 합의 */
  repair_landlord_burden?: string | null;
  repair_tenant_burden?: string | null;

  /** 특약사항 법정 문구의 빈칸 */
  fixed_date_deadline?: string | null;
  tax_arrears_threshold?: number | null;
  mediation_agreed?: boolean | null;
  demolition_planned?: boolean | null;
  demolition_start?: string | null;
  demolition_months?: number | null;
  detailed_address_agreed?: boolean | null;

  /** ※기타 — 3줄까지 (3쪽). */
  other_notes?: string[] | null;

  signed_on?: string | Date | null;
  landlord: HousingLeaseParty;
  tenant: HousingLeaseParty;
}

/** "일금 삼백만원정" 대신 서식이 요구하는 한글 금액(금 ___ 원정)의 가운데 토막. */
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

/** 계약 데이터를 서식의 기입란 값으로 옮긴다. */
export function toHousingStandardLeaseValues(d: HousingStandardLeaseInput): HousingStandardLeaseValues {
  const handover = ymd(d.handover_date ?? d.start_date);
  const end = ymd(d.end_date);
  const interim = ymd(d.interim_payment_date);
  const balance = ymd(d.balance_date);
  const signed = ymd(d.signed_on);
  const priorStart = ymd(d.prior_start_date);
  const priorEnd = ymd(d.prior_end_date);
  const fixedDate = ymd(d.fixed_date_deadline);
  const notes = d.other_notes ?? [];

  return {
    // 머리 — 계약 유형
    kind_deposit_monthly: d.kind === "deposit_monthly",
    kind_jeonse: d.kind === "jeonse",
    kind_monthly: d.kind === "monthly",
    landlord_inline_name: d.landlord.name ?? null,
    tenant_inline_name: d.tenant.name ?? null,

    // 임차주택의 표시
    property_address: d.property_address ?? null,
    land_category: d.land_category ?? null,
    land_area: area(d.land_area_m2),
    building_structure_use: d.building_structure_use ?? null,
    building_area: area(d.building_area_m2),
    leased_portion: d.leased_portion ?? null,
    leased_area: area(d.leased_area_m2),

    // 계약의 종류
    contract_kind_new: d.contract_kind === "new",
    contract_kind_mutual_renewal: d.contract_kind === "mutual_renewal",
    contract_kind_statutory_renewal: d.contract_kind === "statutory_renewal",
    prior_start_year: priorStart.y,
    prior_start_month: priorStart.m,
    prior_start_day: priorStart.d,
    prior_end_year: priorEnd.y,
    prior_end_month: priorEnd.m,
    prior_end_day: priorEnd.d,
    prior_deposit: figures(d.prior_deposit),
    prior_rent: figures(d.prior_rent),

    // 미납 국세·지방세 / 선순위 확정일자 현황
    tax_arrears_none: d.tax_arrears === false,
    tax_arrears_exists: d.tax_arrears === true,
    tax_arrears_landlord_seal: d.landlord_disclosure_seal ?? null,
    prior_fixed_date_none: d.prior_fixed_date === false,
    prior_fixed_date_exists: d.prior_fixed_date === true,
    prior_fixed_date_landlord_seal: d.landlord_disclosure_seal ?? null,

    // 제1조 — 보증금과 차임 및 관리비
    deposit_words: amountWords(d.deposit_amount),
    deposit_figures: figures(d.deposit_amount),
    down_payment_words: amountWords(d.down_payment),
    down_payment_figures: figures(d.down_payment),
    down_payment_receiver: d.down_payment_receiver ?? null,
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
    rent_words: amountWords(d.monthly_rent),
    rent_due_day: d.rent_due_day ?? null,
    rent_account: d.rent_account ?? null,
    mgmt_total_words: amountWords(d.management_fee),
    mgmt_total_figures: figures(d.management_fee),
    mgmt_variable_note: d.management_fee != null ? null : d.management_fee_note ?? null,

    // 제2조 — 기간
    handover_year: handover.y,
    handover_month: handover.m,
    handover_day: handover.d,
    term_end_year: end.y,
    term_end_month: end.m,
    term_end_day: end.d,

    // 제4조③ — 수선·비용부담
    repair_landlord_burden: d.repair_landlord_burden ?? null,
    repair_tenant_burden: d.repair_tenant_burden ?? null,

    // 특약사항 법정 문구
    fixed_date_year: fixedDate.y,
    fixed_date_month: fixedDate.m,
    fixed_date_day: fixedDate.d,
    tax_arrears_threshold: figures(d.tax_arrears_threshold),
    mediation_agree: d.mediation_agreed === true,
    mediation_disagree: d.mediation_agreed === false,
    demolition_none: d.demolition_planned === false,
    demolition_exists: d.demolition_planned === true,
    demolition_start: d.demolition_start ?? null,
    demolition_months: d.demolition_months ?? null,
    detailed_address_agree: d.detailed_address_agreed === true,
    detailed_address_disagree: d.detailed_address_agreed === false,

    // 3쪽 — ※기타 및 서명란
    other_note_1: notes[0] ?? null,
    other_note_2: notes[1] ?? null,
    other_note_3: notes[2] ?? null,
    signed_year: signed.y,
    signed_month: signed.m,
    signed_day: signed.d,
    landlord_address: d.landlord.address ?? null,
    landlord_id_no: d.landlord.id_no ?? null,
    landlord_phone: d.landlord.phone ?? null,
    landlord_name: d.landlord.name ?? null,
    landlord_seal: d.landlord.seal_image ?? null,
    landlord_agent_name: d.landlord.agent_name ?? null,
    landlord_agent_address: d.landlord.agent_address ?? null,
    landlord_agent_id_no: d.landlord.agent_id_no ?? null,
    tenant_address: d.tenant.address ?? null,
    tenant_id_no: d.tenant.id_no ?? null,
    tenant_phone: d.tenant.phone ?? null,
    tenant_name: d.tenant.name ?? null,
    tenant_seal: d.tenant.seal_image ?? null,
    tenant_agent_name: d.tenant.agent_name ?? null,
    tenant_agent_address: d.tenant.agent_address ?? null,
    tenant_agent_id_no: d.tenant.agent_id_no ?? null,
  };
}

/** [별지2] 계약갱신 거절통지서 — 본문 계약서와 같은 원본 PDF의 5쪽. */
export interface RenewalRefusalInput {
  landlord: { name?: string | null; address?: string | null; phone?: string | null; seal_image?: string | null };
  tenant: { name?: string | null; address?: string | null; phone?: string | null };
  premises_address?: string | null;
  lease_term?: string | null;
  /** 임차인이 갱신을 요구한 날. */
  requested_on?: string | null;
  /** 주택임대차보호법 제6조의3 제1항 각 호 — "1" ~ "9", "7-1" ~ "7-3". */
  reasons?: string[] | null;
  reason_3_compensation?: string | null;
  reason_8_resident_name?: string | null;
  reason_8_relation?: "self" | "ascendant" | "descendant" | null;
  detail?: string[] | null;
  written_on?: string | Date | null;
}

export function toRenewalRefusalValues(d: RenewalRefusalInput): HousingStandardLeaseValues {
  const req = ymd(d.requested_on);
  const written = ymd(d.written_on);
  const has = (code: string) => d.reasons?.includes(code) === true;
  const detail = d.detail ?? [];
  return {
    refusal_landlord_name: d.landlord.name ?? null,
    refusal_landlord_address: d.landlord.address ?? null,
    refusal_landlord_phone: d.landlord.phone ?? null,
    refusal_tenant_name: d.tenant.name ?? null,
    refusal_tenant_address: d.tenant.address ?? null,
    refusal_tenant_phone: d.tenant.phone ?? null,
    refusal_premises_address: d.premises_address ?? null,
    refusal_lease_term: d.lease_term ?? null,
    refusal_body_landlord: d.landlord.name ?? null,
    refusal_body_tenant: d.tenant.name ?? null,
    refusal_request_year: req.y,
    refusal_request_month: req.m,
    refusal_request_day: req.d,
    refusal_reason_1: has("1"),
    refusal_reason_2: has("2"),
    refusal_reason_3: has("3"),
    refusal_reason_3_text: d.reason_3_compensation ?? null,
    refusal_reason_4: has("4"),
    refusal_reason_5: has("5"),
    refusal_reason_6: has("6"),
    refusal_reason_7_1: has("7-1"),
    refusal_reason_7_2: has("7-2"),
    refusal_reason_7_3: has("7-3"),
    refusal_reason_8: has("8"),
    refusal_reason_8_name: d.reason_8_resident_name ?? null,
    refusal_reason_8_self: d.reason_8_relation === "self",
    refusal_reason_8_ascendant: d.reason_8_relation === "ascendant",
    refusal_reason_8_descendant: d.reason_8_relation === "descendant",
    refusal_reason_9: has("9"),
    refusal_detail_1: detail[0] ?? null,
    refusal_detail_2: detail[1] ?? null,
    refusal_written_year: written.y,
    refusal_written_month: written.m,
    refusal_written_day: written.d,
    refusal_signer_name: d.landlord.name ?? null,
    refusal_signer_seal: d.landlord.seal_image ?? null,
  };
}

/**
 * 주택임대차표준계약서 PDF 바이트를 만든다.
 * 기본은 계약서 본문 4쪽(별지1 중요확인사항 포함), `renewalRefusal` 을 넘기면
 * [별지2] 계약갱신 거절통지서까지 한 파일로 붙는다.
 */
export async function buildHousingStandardLeasePdf(
  input: HousingStandardLeaseInput,
  opts: {
    /** 값이 채워진 거절통지서를 함께 붙일 때. */
    renewalRefusal?: RenewalRefusalInput | null;
    /** 빈 [별지2] 양식만 함께 붙일 때(계약 시 미리 교부하는 관행). */
    includeRenewalRefusal?: boolean;
  } = {},
): Promise<Uint8Array> {
  const values = {
    ...toHousingStandardLeaseValues(input),
    ...(opts.renewalRefusal ? toRenewalRefusalValues(opts.renewalRefusal) : {}),
  };
  const withAnnex2 = Boolean(opts.renewalRefusal) || opts.includeRenewalRefusal === true;
  return fillPdfForm(HOUSING_STANDARD_LEASE_FORM, HOUSING_STANDARD_LEASE_FIELDS, values, {
    pages: withAnnex2
      ? [...HOUSING_LEASE_BODY_PAGES, ...HOUSING_LEASE_RENEWAL_REFUSAL_PAGES]
      : HOUSING_LEASE_BODY_PAGES,
  });
}

/** [별지2] 계약갱신 거절통지서만 단독 발급. */
export async function buildRenewalRefusalPdf(d: RenewalRefusalInput): Promise<Uint8Array> {
  return fillPdfForm(HOUSING_STANDARD_LEASE_FORM, HOUSING_STANDARD_LEASE_FIELDS, toRenewalRefusalValues(d), {
    pages: HOUSING_LEASE_RENEWAL_REFUSAL_PAGES,
  });
}
