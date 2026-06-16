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
import { buildQuoteHtml, type QuoteDocInput } from "./quoteDocument.js";
import { buildContractHtml, type ContractDocInput } from "./contractDocument.js";
import { buildApplicationHtml, placementToDoc } from "./applicationPdf.js";
import { resolveCompanyInfo } from "./companyInfo.js";
import { normalizeLang } from "./i18n.js";

const sampleInvoice: InvoiceDocInput = {
  invoice_ref: "MS-INV-2026-00128", status: "Sent",
  amount: 1450, currency: "AUD", due_date: "2026-07-01",
  paid_at: null, payment_method: null, description: "Accommodation services",
  notes: null, created_at: new Date().toISOString(),
  account_name: "Minjae Kim", account_email: "minjae.kim@example.com",
  account_address: "24 Drummond Street, Carlton VIC 3053",
  booking_ref: "MS-BKG-2026-0042", contract_ref: "MS-C-2026-00017",
  line_items: [
    { label: "Monthly accommodation fee — Jul 2026", quantity: 1, unit_amount: 1450, total_amount: 1450 },
  ],
};

const sampleQuote: QuoteDocInput = {
  quote_ref: "MS-Q-2026-00091", status: "Sent",
  currency: "AUD", subtotal: 1450, total: 1450, valid_until: "2026-07-10",
  description: "Homestay accommodation", notes: null, created_at: new Date().toISOString(),
  party_name: "Minjae Kim", party_email: "minjae.kim@example.com", space_name: "Carlton homestay — single room",
  line_items: [
    { name: "Monthly accommodation fee", unit_price: 1450, quantity: 1, total_price: 1450 },
    { name: "Placement fee (one-off)", unit_price: 550, quantity: 1, total_price: 550 },
  ],
};

const sampleContract: ContractDocInput = {
  contract_ref: "MS-C-2026-00017", status: "Sent",
  tenant_name: "Minjae Kim", landlord_name: "MillionStay Pty Ltd",
  space_name: "Carlton homestay — single room", product_name: "Long-term accommodation",
  booking_ref: "MS-BKG-2026-0042",
  start_date: "2026-07-15", end_date: "2026-12-15",
  weekly_rate: 360, total_rent: 9360, bond_amount: 1200, advance_amount: 1450,
  currency: "AUD", terms_text: null, notes: null,
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
  if (key === "pdf.quote") {
    return buildQuoteHtml(sampleQuote, company, true, lang, body ?? "");
  }
  if (key === "pdf.tenancy_agreement") {
    return buildContractHtml({ ...sampleContract, terms_text: body || sampleContract.terms_text }, company, true, lang);
  }
  if (key === "pdf.homestay_placement_agreement") {
    const doc = placementToDoc(
      samplePlacement as never, sampleHost as never, sampleStudent as never,
      { status: "pending" } as never, { termsText: body || undefined, signed: false },
    );
    return buildApplicationHtml(doc, true, company);
  }
  return null;
}
