// Public intake for the single-building "development" site (Buy / long-term
// Rent / Management). All three funnels land as leads (server packs the
// structured fields into the lead message/description and tags inquiry_type), so
// they flow into the admin Leads pipeline — no separate table. No auth: intake
// is open, follow-up is admin-brokered.
import { getApiBase } from "./api-base";

const BASE = getApiBase();

interface LeadResult {
  success: boolean;
  lead_ref: string;
  id: number;
}

async function postInquiry(path: string, input: unknown): Promise<LeadResult> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string })?.error ?? "Failed to submit inquiry.");
  return body as LeadResult;
}

// ── 1. BUY / Sales — unit purchase / 분양·매매 inquiry ─────────────────────────
export interface SalesInquiryInput {
  first_name: string;
  last_name?: string;
  email: string;
  phone?: string;
  unit_type?: string;     // e.g. floor plan / 평형 of interest
  budget?: string;
  purpose?: string;       // own-use / investment
  message?: string;
}
export function submitSalesInquiry(input: SalesInquiryInput): Promise<LeadResult> {
  return postInquiry("/api/v1/public/sales-inquiries", input);
}

// ── 2. RENT / long-term lease consultation — 장기 임대 상담 ────────────────────
export interface LongTermInquiryInput {
  first_name: string;
  last_name?: string;
  email: string;
  phone?: string;
  unit_type?: string;
  move_in?: string;       // preferred move-in (date or free text)
  duration_months?: string;
  message?: string;
}
export function submitLongTermInquiry(input: LongTermInquiryInput): Promise<LeadResult> {
  return postInquiry("/api/v1/public/long-term-inquiries", input);
}

// ── 3. MANAGEMENT — owner entrusted-management application — 위탁관리 신청 ──────
export interface ManagementInquiryInput {
  first_name: string;
  last_name?: string;
  email: string;
  phone?: string;
  unit_type?: string;
  ownership?: string;     // owns unit / considering purchase
  message?: string;
}
export function submitManagementInquiry(input: ManagementInquiryInput): Promise<LeadResult> {
  return postInquiry("/api/v1/public/management-inquiries", input);
}

// ── 4. GENERAL / contact — 일반 문의 (Directions / contact page) ───────────────
// A catch-all inquiry that isn't Buy/Rent/Management. Lands as a lead tagged
// inquiry_type "ContactUs" (lead_source "Website"). message is required server-
// side, so the form is rendered with requireMessage.
export interface ContactInquiryInput {
  first_name: string;
  last_name?: string;
  email: string;
  phone?: string;
  subject?: string;       // optional — packed into the lead description
  message: string;
}
export function submitContactInquiry(input: ContactInquiryInput): Promise<LeadResult> {
  return postInquiry("/api/v1/public/contact-inquiries", input);
}

// ── BUY board — 분양/판매 listings (admin-managed) ────────────────────────────
// Public read of the sale-listings board. The server resolves per-locale copy
// (title/subtitle/location/price_label/description) for `lang` with a
// lang → ko → en fallback and returns flat fields.
export interface SaleListing {
  id: number;
  category: "presale" | "sale";
  status: "available" | "reserved" | "sold" | string;
  cover_image: string | null;
  gallery: string[];
  area_m2: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  price_amount: number | null;
  title: string;
  subtitle: string;
  location: string;
  price_label: string;
  description: string;
}

export async function fetchSaleListings(lang: string, category?: string): Promise<SaleListing[]> {
  const qs = new URLSearchParams({ lang });
  if (category) qs.set("category", category);
  const res = await fetch(`${BASE}/api/v1/public/sale-listings?${qs.toString()}`);
  if (!res.ok) return [];
  const body = await res.json().catch(() => ({}));
  return (body?.data ?? []) as SaleListing[];
}

export async function fetchSaleListing(id: number, lang: string): Promise<SaleListing | null> {
  const res = await fetch(`${BASE}/api/v1/public/sale-listings/${id}?lang=${encodeURIComponent(lang)}`);
  if (!res.ok) return null;
  const body = await res.json().catch(() => ({}));
  return (body?.data ?? null) as SaleListing | null;
}

// Inquiry about a specific listing → lands as a SalesInquiry lead tagged with
// the listing title/id (packed into the lead description server-side).
export interface ListingInquiryInput {
  first_name: string;
  last_name?: string;
  email: string;
  phone?: string;
  listing_id?: string;
  listing_title?: string;
  message?: string;
}
// A listing inquiry now lands in the privacy-gated sale_inquiries queue (the
// enquirer's identity is withheld from the admin list until revealed). Falls
// back to the legacy lead endpoint if no listing id is present.
export async function submitListingInquiry(input: ListingInquiryInput): Promise<LeadResult> {
  if (input.listing_id) {
    const name = [input.first_name, input.last_name].filter(Boolean).join(" ").trim();
    const res = await fetch(`${BASE}/api/v1/public/sale-listings/${input.listing_id}/inquiry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email: input.email, phone: input.phone, message: input.message }),
    });
    if (!res.ok) throw new Error("Failed to submit inquiry");
    return { lead_ref: "" } as LeadResult;
  }
  return postInquiry("/api/v1/public/listing-inquiries", input);
}

// ── Yield simulator (client-side estimate) ────────────────────────────────────
// A transparent, purely front-end projection for the Management page. Inputs are
// the buyer's numbers; assumptions (management fee %, default occupancy) are
// overridable by the caller so the Metheim team can retune them. Nothing here
// touches live data — it is an indicative estimate, not a quote.
export interface YieldInputs {
  purchasePrice: number;      // 매입가
  monthlyRent: number;        // 예상 월 임대료 (100% 가동 기준)
  occupancyPct: number;       // 예상 가동률 (0–100)
  mgmtFeePct: number;         // 위탁관리 수수료 (임대수입 대비 %)
  monthlyCosts?: number;      // 관리비·기타 고정비 (월)
}
export interface YieldResult {
  grossAnnualRent: number;
  mgmtFee: number;
  fixedCosts: number;
  netAnnualIncome: number;
  netYieldPct: number;        // 순수익률 = 순수입 / 매입가
  monthlyNetIncome: number;
}
export function computeYield(i: YieldInputs): YieldResult {
  const occ = Math.max(0, Math.min(100, i.occupancyPct)) / 100;
  const grossAnnualRent = i.monthlyRent * 12 * occ;
  const mgmtFee = grossAnnualRent * (Math.max(0, i.mgmtFeePct) / 100);
  const fixedCosts = (i.monthlyCosts ?? 0) * 12;
  const netAnnualIncome = grossAnnualRent - mgmtFee - fixedCosts;
  const netYieldPct = i.purchasePrice > 0 ? (netAnnualIncome / i.purchasePrice) * 100 : 0;
  return {
    grossAnnualRent,
    mgmtFee,
    fixedCosts,
    netAnnualIncome,
    netYieldPct,
    monthlyNetIncome: netAnnualIncome / 12,
  };
}
