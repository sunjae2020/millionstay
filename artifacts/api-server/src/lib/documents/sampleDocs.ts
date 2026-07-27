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
import { buildContractHtml, type ContractDocInput } from "./contractDocument.js";
import { buildApplicationHtml, placementToDoc } from "./applicationPdf.js";
import { resolveCompanyInfo } from "./companyInfo.js";
import { normalizeLang } from "./i18n.js";
import { DEFAULT_CURRENCY } from "../currency.js";

// The Templates Studio preview uses the tenant's default currency so ops see a
// representative document — a Korean (KRW) instance shows ₩ amounts, addresses
// and item names; every other instance keeps the AUD illustration. Amounts are
// scaled to each currency (won-scale vs dollar-scale) so neither looks absurd.
const KRW = DEFAULT_CURRENCY === "KRW";
const CUR = DEFAULT_CURRENCY;
const S = KRW
  ? {
      party: "김민재", email: "minjae.kim@example.com",
      tenantAddr: "전남 여수시 좌수영로 101", acctAddr: "전남 여수시 좌수영로 101",
      space: "메트하임 여수 — 원룸", product: "장기 임대",
      monthly: 700000, placement: 300000, pickup: 50000, settle: 150000, sim: 30000,
      bond: 3000000, advance: 700000, weekly: null as number | null, totalRent: 3500000,
      liMonthly: "월 이용료 — 2026년 7월", liPickup: "공항 픽업", liSettle: "초기 정착 지원", liSim: "선불 SIM",
      liPlacement: "입주 수수료 (1회성)", desc: "숙박 및 정착 서비스", pickupNote: "입국 시 — 항공편 KE123",
    }
  : {
      party: "Minjae Kim", email: "minjae.kim@example.com",
      tenantAddr: "12 Lygon Street, Carlton VIC 3053, Australia", acctAddr: "24 Drummond Street, Carlton VIC 3053",
      space: "Carlton homestay — single room", product: "Long-term accommodation",
      monthly: 1450, placement: 550, pickup: 90, settle: 250, sim: 30,
      bond: 1200, advance: 1450, weekly: 360 as number | null, totalRent: 9360,
      liMonthly: "Monthly accommodation fee — Jul 2026", liPickup: "Airport pickup", liSettle: "Initial settlement support", liSim: "Prepaid SIM",
      liPlacement: "Placement fee (one-off)", desc: "Accommodation & arrival services", pickupNote: "On arrival — flight QF409",
    };

const sampleInvoice: InvoiceDocInput = {
  invoice_ref: "MS-INV-2026-00128", status: "Sent",
  amount: S.monthly + S.pickup + S.settle + S.sim, currency: CUR, due_date: "2026-07-01",
  paid_at: null, payment_method: null, description: S.desc,
  notes: null, created_at: new Date().toISOString(),
  account_name: S.party, account_email: S.email,
  account_address: S.acctAddr,
  booking_ref: "MS-BKG-2026-0042", contract_ref: "MS-C-2026-00017",
  line_items: [
    { label: S.liMonthly, quantity: 1, unit_amount: S.monthly, total_amount: S.monthly },
    { label: S.liPickup, description: S.pickupNote, quantity: 1, unit_amount: S.pickup, total_amount: S.pickup },
    { label: S.liSettle, quantity: 1, unit_amount: S.settle, total_amount: S.settle },
    { label: S.liSim, quantity: 1, unit_amount: S.sim, total_amount: S.sim },
  ],
};

const sampleQuote: QuoteDocInput = {
  quote_ref: "MS-Q-2026-00091", status: "Sent",
  currency: CUR, subtotal: S.monthly + S.placement + S.pickup + S.sim, total: S.monthly + S.placement + S.pickup + S.sim,
  valid_until: "2026-07-10",
  description: S.desc, notes: null, created_at: new Date().toISOString(),
  party_name: S.party, party_email: S.email, space_name: S.space,
  line_items: [
    { name: S.liMonthly.split(" — ")[0], unit_price: S.monthly, quantity: 1, total_price: S.monthly },
    { name: S.liPlacement, unit_price: S.placement, quantity: 1, total_price: S.placement },
    { name: S.liPickup, unit_price: S.pickup, quantity: 1, total_price: S.pickup },
    { name: S.liSim, unit_price: S.sim, quantity: 1, total_price: S.sim },
  ],
};

const sampleContract: ContractDocInput = {
  contract_ref: "MS-C-2026-00017", status: "Sent",
  tenant_name: S.party, tenant_email: S.email,
  tenant_address: S.tenantAddr,
  landlord_name: null, landlord_email: null,
  landlord_address: null,
  space_name: S.space, product_name: S.product,
  booking_ref: "MS-BKG-2026-0042",
  start_date: "2026-07-15", end_date: "2026-12-15",
  effective_date: "2026-07-15", expiry_date: "2026-12-15", billing_frequency: "Monthly",
  weekly_rate: S.weekly, total_rent: S.totalRent, bond_amount: S.bond, advance_amount: S.advance,
  currency: CUR,
  additional_services: [
    { name: S.liPickup, quantity: 1, unit_amount: S.pickup, total_amount: S.pickup, recurring: false, frequency: null, notes: S.pickupNote },
    { name: S.liSettle, quantity: 1, unit_amount: S.settle, total_amount: S.settle, recurring: false, frequency: null, notes: null },
    { name: S.liSim, quantity: 1, unit_amount: S.sim, total_amount: S.sim, recurring: false, frequency: null, notes: null },
  ],
  terms_text: null, notes: null,
  signed_at: null, created_at: new Date().toISOString(),
};

const samplePlacement = {
  placement_ref: "MS-HSP-2026-00042", status: "AwaitingPayment",
  currency: "AUD", move_in_date: "2026-07-15", move_out_date: "2026-12-15",
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

/**
 * Render a full sample document for a `pdf.*` template, injecting the edited body
 * as the document's terms/notes. Returns null for keys without a known full-doc
 * layout (the caller then wraps the body in the generic branded shell).
 */
export async function renderSampleDocumentHtml(key: string, bodyHtml: string, localeRaw: string): Promise<string | null> {
  const lang = normalizeLang(localeRaw);
  const company = await resolveCompanyInfo();
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
  return null;
}
