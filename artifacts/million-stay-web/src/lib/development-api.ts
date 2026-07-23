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

// ── Yield simulator (client-side estimate) ────────────────────────────────────
// A transparent, purely front-end projection for the Management page. Inputs are
// the buyer's numbers; assumptions (management fee %, default occupancy) are
// overridable by the caller so the MetHeim team can retune them. Nothing here
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
