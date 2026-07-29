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
import { buildMoveOutSettlementHtml, type MoveOutDocInput } from "./moveOutSettlementDocument.js";
import { resolveCompanyInfo } from "./companyInfo.js";
import { DEFAULT_CURRENCY } from "../currency.js";
import { normalizeLang } from "./i18n.js";

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
  if (key === "pdf.move_out_confirmation") {
    return buildMoveOutSettlementHtml(sampleMoveOut, company, true, lang, body ?? "");
  }
  return null;
}
