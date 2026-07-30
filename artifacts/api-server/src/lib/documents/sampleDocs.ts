/**
 * Sample document renderer for Templates Studio.
 *
 * When ops preview a PDF template ("Sample PDF"), show the FULL branded document
 * — populated with representative student / host / financial data — rather than
 * just the editable body fragment, so they see exactly how the published
 * document will look. The edited template body is injected as the terms/notes.
 *
 * Sample data is illustrative only (no real records are read).
 */
import { buildInvoiceHtml, type InvoiceDocInput } from "./invoiceDocument.js";
import { buildReceiptHtml } from "./receiptDocument.js";
import { buildQuoteHtml, type QuoteDocInput } from "./quoteDocument.js";
import { buildContractHtml, splitAnnex, type ContractDocInput, type ContractPremises } from "./contractDocument.js";
import { buildKoreanLeaseHtml, leaseDate, type KoreanLeaseDocInput } from "./koreanLeaseDocument.js";
import { formatDocMoney } from "./theme.js";
import { buildApplicationHtml, placementToDoc } from "./applicationPdf.js";
import { buildMoveOutSettlementHtml, type MoveOutDocInput } from "./moveOutSettlementDocument.js";
import { resolveCompanyInfo } from "./companyInfo.js";
import { DEFAULT_CURRENCY } from "../currency.js";
import { normalizeLang, type DocLang } from "./i18n.js";

const sampleInvoice: InvoiceDocInput = {
  invoice_ref: "MS-INV-2026-00128", status: "Sent",
  amount: 1820, currency: DEFAULT_CURRENCY, due_date: "2026-07-01",
  paid_at: null, payment_method: null, description: "Accommodation & arrival services",
  notes: null, created_at: new Date().toISOString(),
  account_name: "Minjae Kim", account_email: "minjae.kim@example.com",
  account_address: "24 Drummond Street, Carlton VIC 3053",
  booking_ref: "MS-BKG-2026-0042", contract_ref: "MS-C-2026-00017",
  line_items: [
    { label: "Monthly accommodation fee — Jul 2026", quantity: 1, unit_amount: 1450, total_amount: 1450 },
    { label: "Airport pickup", description: "On arrival — flight QF409", quantity: 1, unit_amount: 90, total_amount: 90 },
    { label: "Initial settlement support", quantity: 1, unit_amount: 250, total_amount: 250 },
    { label: "Prepaid SIM", quantity: 1, unit_amount: 30, total_amount: 30 },
  ],
};

const sampleQuote: QuoteDocInput = {
  quote_ref: "MS-Q-2026-00091", status: "Sent",
  currency: DEFAULT_CURRENCY, subtotal: 2120, total: 2120, valid_until: "2026-07-10",
  description: "Homestay accommodation & arrival services", notes: null, created_at: new Date().toISOString(),
  party_name: "Minjae Kim", party_email: "minjae.kim@example.com", space_name: "Carlton homestay — single room",
  line_items: [
    { name: "Monthly accommodation fee", unit_price: 1450, quantity: 1, total_price: 1450 },
    { name: "Placement fee (one-off)", unit_price: 550, quantity: 1, total_price: 550 },
    { name: "Airport pickup", unit_price: 90, quantity: 1, total_price: 90 },
    { name: "Prepaid SIM", unit_price: 30, quantity: 1, total_price: 30 },
  ],
};

const sampleContract: ContractDocInput = {
  contract_ref: "MS-C-2026-00017", status: "Sent",
  tenant_name: "Minjae Kim", tenant_email: "minjae.kim@example.com",
  tenant_address: "12 Lygon Street, Carlton VIC 3053, Australia",
  landlord_name: "MillionStay Pty Ltd", landlord_email: "leasing@millionstay.com",
  landlord_address: "Melbourne VIC 3000, Australia",
  space_name: "Carlton homestay — single room", product_name: "Long-term accommodation",
  booking_ref: "MS-BKG-2026-0042",
  start_date: "2026-07-15", end_date: "2026-12-15",
  effective_date: "2026-07-15", expiry_date: "2026-12-15", billing_frequency: "Monthly",
  weekly_rate: 360, total_rent: 9360, bond_amount: 1200, advance_amount: 1450,
  currency: DEFAULT_CURRENCY,
  additional_services: [
    { name: "Airport pickup", quantity: 1, unit_amount: 90, total_amount: 90, recurring: false, frequency: null, notes: "On arrival — flight QF409" },
    { name: "Initial settlement support", quantity: 1, unit_amount: 250, total_amount: 250, recurring: false, frequency: null, notes: null },
    { name: "Prepaid SIM", quantity: 1, unit_amount: 30, total_amount: 30, recurring: false, frequency: null, notes: null },
  ],
  terms_text: null, notes: null,
  signed_at: null, created_at: new Date().toISOString(),
};

const samplePlacement = {
  placement_ref: "MS-HSP-2026-00042", status: "AwaitingPayment",
  currency: DEFAULT_CURRENCY, move_in_date: "2026-07-15", move_out_date: "2026-12-15",
  billing_cycle_weeks: 4, billing_method: "card",
  placement_fee: 550, deposit: 1200, monthly_fee: 1450, created_at: new Date().toISOString(),
};
const sampleHost = {
  first_name: "Sarah", last_name: "Thompson", email: "sarah.thompson@example.com",
  phone: "+61 400 123 456", suburb: "Carlton", address: "24 Drummond Street, Carlton VIC 3053",
  building_type: "House", cultural_background: "Australian",
  residents: [{ relationship: "Spouse" }, { relationship: "Child" }],
  has_pets: true, pet_types: "1 dog (friendly)",
  smoking_in_home: false, drink_in_home: false,
  packages_offered: ["Full board (3 meals/day)", "Half board (breakfast + dinner)"],
  dietary: ["Halal", "Vegetarian"], dietary_notes: "No pork in shared meals",
  home_features: ["Wi-Fi", "Private bathroom", "Study desk", "Heating & cooling"],
};
const sampleStudent = {
  student_first_name: "Minjae", student_last_name: "Kim",
  student_email: "minjae.kim@example.com", student_phone: "+82 10 1234 5678",
  date_of_birth: "2009-03-12", gender: "Male", nationality: "South Korean",
  is_minor: true, guardian_name: "Soyeon Kim", guardian_relationship: "Mother",
  guardian_email: "soyeon.kim@example.com", guardian_phone: "+82 10 8765 4321",
};

// Representative move-out confirmation (deposit settlement) for the Studio preview.
const sampleMoveOut: MoveOutDocInput = {
  settlement_ref: "MS-DS-2026-00042", status: "finalized",
  as_of_date: "2026-07-21", currency: DEFAULT_CURRENCY,
  unit: "Unit 402", tenant_name: "Minjae Kim",
  contract_start: "2024-07-22", contract_end: "2026-07-21",
  monthly_rent: 1450, deposit_held: 1200, total_deducted: 250, refund_amount: 950,
  deductions: [
    { description: "Outstanding rent", amount: 150, remark: "Part of final month" },
    { description: "End-of-lease cleaning", amount: 100, remark: "" },
  ],
};

// ── 임대차 계약서 (pdf.lease_agreement) ─────────────────────────────────────
// 이 템플릿의 본문은 HTML 이 아니라 순수 텍스트다 — 제1조~ 조항과 `[별지]` 구분자,
// 그리고 {{변수}} 뿐이라 범용 셸에 그대로 넣으면 줄바꿈 없는 한 덩어리가 되고
// 변수도 `[tenant_name]` / `100.00` 자리표시자로 찍혀 깨져 보인다. 그래서 샘플도
// 실제 발행 계약서와 같은 레이아웃(부동산 표기 / 계약내용 / 당사자 표 /
// 계약일반조항 / 별지)으로, 대표 세대 한 채의 값을 채워 렌더링한다.
const LEASE_KRW = DEFAULT_CURRENCY === "KRW";
const LEASE = LEASE_KRW
  ? {
      party: "김민재", email: "minjae.kim@example.com", phone: "010-1234-5678",
      tenantAddr: "전남 여수시 좌수영로 101",
      deposit: 3_000_000, down: 300_000, balance: 2_700_000,
      listRent: 700_000, promoRent: 550_000, totalRent: 8_400_000,
      bank: "국민은행", account: "123456-01-234567",
    }
  : {
      party: "Minjae Kim", email: "minjae.kim@example.com", phone: "+61 400 123 456",
      tenantAddr: "12 Lygon Street, Carlton VIC 3053, Australia",
      deposit: 1200, down: 200, balance: 1000,
      listRent: 1450, promoRent: 1230, totalRent: 17_400,
      bank: "Commonwealth Bank", account: "063-000 1234 5678",
    };

const samplePremises: ContractPremises = {
  location: "전남 여수시 좌수영로 101",
  building: "메트하임 여수",
  unit_no: "802호",
  floor: "8",
  unit_type: "C타입",
  structure_use: "철근콘크리트구조 / 도시형생활주택(원룸형)",
  exclusive_area_m2: 24.16,
  residential_common_area_m2: 6.09,
  supply_area_m2: 30.25,
  other_common_area_m2: 12.4,
  contract_area_m2: 42.65,
  land_share_m2: 8.762,
};

const sampleLeaseDates = {
  start_date: "2026-08-01", end_date: "2027-07-31",
  down_payment_date: "2026-07-05", balance_date: "2026-07-31",
  signed_on: "2026-07-05", rent_due_day: 25,
};

/**
 * 위 표본 세대에 맞춘 임대차 계약서 템플릿의 {{변수}} 값.
 * routes/contracts.ts 의 `contractTemplateVars()` 와 같은 형식을 따른다 —
 * 금액은 `formatDocMoney`, 면적은 숫자만, 날짜는 계약서 표기.
 */
function sampleLeaseVars(lang: DocLang): Record<string, string> {
  const m = (v: number | null) => (v == null ? "" : formatDocMoney(v, DEFAULT_CURRENCY));
  const d = (v: string) => leaseDate(v, lang);
  const a = (v: number | null | undefined) =>
    v == null ? "" : Number(v).toLocaleString(undefined, { maximumFractionDigits: 3 });
  return {
    contract_ref: "MS-C-2026-00017",
    tenant_name: LEASE.party,
    landlord_name: "",
    start_date: d(sampleLeaseDates.start_date),
    end_date: d(sampleLeaseDates.end_date),
    location: samplePremises.location ?? "",
    building: samplePremises.building ?? "",
    unit_no: samplePremises.unit_no ?? "",
    floor: samplePremises.floor ?? "",
    unit_type: samplePremises.unit_type ?? "",
    structure_use: samplePremises.structure_use ?? "",
    area_exclusive: a(samplePremises.exclusive_area_m2),
    area_residential_common: a(samplePremises.residential_common_area_m2),
    area_supply: a(samplePremises.supply_area_m2),
    area_other_common: a(samplePremises.other_common_area_m2),
    area_contract: a(samplePremises.contract_area_m2),
    area_land_share: a(samplePremises.land_share_m2),
    contract_category: "신규 계약",
    deposit_amount: m(LEASE.deposit),
    monthly_rent: m(LEASE.listRent),
    promo_monthly_rent: m(LEASE.promoRent),
    rent_due_day: String(sampleLeaseDates.rent_due_day),
    down_payment: m(LEASE.down),
    down_payment_date: d(sampleLeaseDates.down_payment_date),
    balance_amount: m(LEASE.balance),
    balance_date: d(sampleLeaseDates.balance_date),
    total_rent: m(LEASE.totalRent),
    currency: DEFAULT_CURRENCY,
  };
}

/**
 * 스키마 자리표시자(`[name]` / `100.00`)로는 문서가 깨져 보이는 템플릿을 위한
 * 표본 {{변수}} 값. 자리표시자로 충분한 템플릿은 null 을 돌려준다.
 */
export function sampleTemplateVars(key: string, localeRaw = "ko"): Record<string, string> | null {
  return key === "pdf.lease_agreement" ? sampleLeaseVars(normalizeLang(localeRaw)) : null;
}

/**
 * Render a full sample document for a `pdf.*` template, injecting the edited body
 * as the document's terms/notes. Returns null for keys without a known full-doc
 * layout (the caller then wraps the body in the generic branded shell).
 */
export async function renderSampleDocumentHtml(key: string, bodyHtml: string, localeRaw: string): Promise<string | null> {
  const lang = normalizeLang(localeRaw);
  const company = await resolveCompanyInfo(lang);
  const body = bodyHtml?.trim();

  if (key === "pdf.invoice") {
    return buildInvoiceHtml(sampleInvoice, company, true, lang, body ?? "");
  }
  if (key === "pdf.receipt") {
    const paid: InvoiceDocInput = { ...sampleInvoice, status: "Paid", paid_at: "2026-07-01", payment_method: "Card" };
    return buildReceiptHtml(paid, company, true, lang, body ?? "");
  }
  if (key === "pdf.quote") {
    return buildQuoteHtml(sampleQuote, company, true, lang, body ?? "");
  }
  if (key === "pdf.tenancy_agreement") {
    return buildContractHtml({ ...sampleContract, terms_text: body || sampleContract.terms_text }, company, true, lang);
  }
  if (key === "pdf.homestay_placement_agreement") {
    const doc = placementToDoc(
      samplePlacement as never, sampleHost as never, sampleStudent as never,
      { status: "pending" } as never,
      {
        termsText: body || undefined, signed: false, cardSurchargePct: 2, defaultMethod: "card",
        services: [
          { service_type: "airport_pickup", price: 90 },
          { service_type: "initial_settlement", price: 250 },
          { service_type: "prepaid_phone", price: 30 },
        ],
      },
    );
    return buildApplicationHtml(doc, true, company);
  }
  if (key === "pdf.lease_agreement") {
    const split = splitAnnex(body ?? "");
    const lease: KoreanLeaseDocInput = {
      contract_ref: "MS-C-2026-00017",
      title: `${samplePremises.building} 임대차 계약서`,
      premises: samplePremises,
      registry: {
        lot_address: "전남 여수시 좌수영로 101",
        building_use: "도시형생활주택(원룸형)",
        building_structure: "철근콘크리트구조",
        land_category: "대",
        land_area_m2: 3519,
        land_right_type: "소유권대지권",
        leased_portion: "전유부분 전체",
      },
      landlord: {
        name: company.legalName || company.tradingName,
        address: company.address,
        phone: company.phone,
        email: company.email,
        business_no: company.abn,
        corporate_no: null,
      },
      tenant: {
        name: LEASE.party, address: LEASE.tenantAddr,
        phone: LEASE.phone, email: LEASE.email, resident_no: null,
      },
      currency: DEFAULT_CURRENCY,
      deposit_amount: LEASE.deposit,
      down_payment: LEASE.down,
      down_payment_date: sampleLeaseDates.down_payment_date,
      balance_amount: LEASE.balance,
      balance_date: sampleLeaseDates.balance_date,
      monthly_rent: LEASE.listRent,
      rent_due_day: sampleLeaseDates.rent_due_day,
      start_date: sampleLeaseDates.start_date,
      end_date: sampleLeaseDates.end_date,
      signed_on: sampleLeaseDates.signed_on,
      accounts: [
        { label: "임대료 납부계좌", bank_name: LEASE.bank, account_number: LEASE.account, account_name: company.legalName || company.tradingName },
        { label: "보증금 납부계좌", bank_name: LEASE.bank, account_number: LEASE.account, account_name: company.legalName || company.tradingName },
      ],
      clauses_text: split.terms,
      annex_text: split.annex,
    };
    return buildKoreanLeaseHtml(lease, company, true, lang);
  }
  if (key === "pdf.move_out_confirmation") {
    return buildMoveOutSettlementHtml(sampleMoveOut, company, true, lang, body ?? "");
  }
  return null;
}
