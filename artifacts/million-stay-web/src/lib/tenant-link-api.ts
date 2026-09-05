// 세입자 온보딩 링크 API — 로그인 없이 토큰으로만 열리는 화면들.
//
// signing-api.ts / inspection-api.ts 와 같은 자급자족 구조: 이 링크를 여는
// 사람은 계정도 게스트 JWT 도 없이 문자·메일로 받은 주소를 누른 세입자다.
//
// 네 화면: 임차 신청서(/apply), 청구서(/pay), 서류 제출(/documents),
// 입주 신청서(/intake). 임차 신청서만 계약보다 먼저 서고, 토큰 없이 열리는
// 상시 공개 폼(/apply)도 같은 API 를 쓴다.
import { getApiBase } from "./api-base";

const PAY = `${getApiBase()}/api/v1/public/invoice-pay`;
const DOCS = `${getApiBase()}/api/v1/public/doc-requests`;
const INTAKE = `${getApiBase()}/api/v1/public/intake`;
const APPLY = `${getApiBase()}/api/v1/public/apply`;
const APPLICATIONS = `${getApiBase()}/api/v1/public/tenant-applications`;

export interface InvoiceLine {
  label: string;
  description: string | null;
  quantity: string | number | null;
  unit_amount: string | number | null;
  total_amount: string | number | null;
}

export interface BankAccount {
  label?: string | null;
  bank_name: string | null;
  account_number: string | null;
  account_name: string | null;
  bsb_number?: string | null;
  swift_code?: string | null;
}

export interface InvoicePayView {
  status: string;
  lang: string;
  invoice: {
    invoice_ref: string;
    status: string;
    paid: boolean;
    amount: string | number;
    tax_amount: string | number | null;
    total_amount: string | number;
    currency: string;
    due_date: string | null;
    description: string | null;
    billing_period: string | null;
    account_name: string | null;
    line_items: InvoiceLine[];
  };
  bank_account: BankAccount | null;
  company: { name: string; phone: string | null; email: string | null };
  notices: Array<{ payer_name: string; paid_on: string; amount: string | null; memo: string | null; at: string }>;
}

export interface DocRequestItem {
  key: string;
  doc_type: string;
  label: string;
  required: boolean;
  submitted: boolean;
  files: Array<{ file_name: string; at: string }>;
}

export interface DocRequestView {
  status: string;
  contract_ref: string | null;
  tenant_name: string | null;
  note: string | null;
  items: DocRequestItem[];
}

export class TenantLinkError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "TenantLinkError";
    this.status = status;
    this.code = code;
  }
}

async function request(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(path, init);
  const text = await res.text().catch(() => "");
  const body = text ? (() => { try { return JSON.parse(text); } catch { return null; } })() : null;
  if (!res.ok) {
    throw new TenantLinkError(res.status, body?.error?.code ?? "error", body?.error?.message ?? "Request failed.");
  }
  return body;
}

/* ── 청구서 조회 · 입금 통보 ─────────────────────────────────────────────── */

export async function getInvoicePay(token: string): Promise<InvoicePayView> {
  const body = await request(`${PAY}/${encodeURIComponent(token)}`);
  return body.data as InvoicePayView;
}

export function invoicePdfUrl(token: string, lang?: string): string {
  const q = lang ? `?lang=${encodeURIComponent(lang)}` : "";
  return `${PAY}/${encodeURIComponent(token)}/document.pdf${q}`;
}

export async function reportPayment(
  token: string,
  payload: { payer_name: string; paid_on: string; amount?: string | null; memo?: string | null },
): Promise<{ message: string }> {
  const body = await request(`${PAY}/${encodeURIComponent(token)}/paid-notice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return body;
}

/* ── 서류 제출 ───────────────────────────────────────────────────────────── */

export async function getDocRequest(token: string): Promise<DocRequestView> {
  const body = await request(`${DOCS}/${encodeURIComponent(token)}`);
  return body.data as DocRequestView;
}

export async function uploadDocument(token: string, docKey: string, file: File): Promise<void> {
  const form = new FormData();
  form.append("file", file);
  form.append("doc_key", docKey);
  // Content-Type 은 브라우저가 boundary 와 함께 붙인다 — 직접 지정하면 깨진다.
  await request(`${DOCS}/${encodeURIComponent(token)}/upload`, { method: "POST", body: form });
}

export async function submitDocuments(token: string): Promise<{ message: string }> {
  return request(`${DOCS}/${encodeURIComponent(token)}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
}

/* ── 입주 신청서 ─────────────────────────────────────────────────────────── */

export interface IntakeView {
  status: string;
  contract_ref: string | null;
  tenant_name: string | null;
  note: string | null;
  /** 미리 채워진 값 + 이미 제출한 값(제출본이 위에 덮인다). */
  values: Record<string, string | null>;
  submitted: boolean;
}

export async function getIntake(token: string): Promise<IntakeView> {
  const body = await request(`${INTAKE}/${encodeURIComponent(token)}`);
  return body.data as IntakeView;
}

export async function uploadIntakePhoto(token: string, file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append("image", file);
  const body = await request(`${INTAKE}/${encodeURIComponent(token)}/photo`, { method: "POST", body: form });
  return body.data as { url: string };
}

export async function submitIntake(token: string, answers: Record<string, string>): Promise<{ message: string }> {
  return request(`${INTAKE}/${encodeURIComponent(token)}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(answers),
  });
}

/* ── 임차 신청서 (계약 전) ───────────────────────────────────────────────── */

export interface ApplicationView {
  status: string;
  lead_ref: string | null;
  tenant_name: string | null;
  note: string | null;
  /** 담당자가 미리 채운 값 + 이미 제출한 값(제출본이 위에 덮인다). */
  values: Record<string, string | null>;
  submitted: boolean;
}

export async function getApplication(token: string): Promise<ApplicationView> {
  const body = await request(`${APPLY}/${encodeURIComponent(token)}`);
  return body.data as ApplicationView;
}

/** 담당자가 보낸 링크로 낸다. */
export async function submitApplication(
  token: string,
  answers: Record<string, string>,
): Promise<{ message: string }> {
  return request(`${APPLY}/${encodeURIComponent(token)}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...answers, consent: true }),
  });
}

/** 홈페이지의 상시 공개 폼으로 낸다 — 문의가 아직 없는 사람의 경로. */
export async function submitPublicApplication(
  answers: Record<string, string>,
  lang?: string,
): Promise<{ lead_ref: string }> {
  const body = await request(APPLICATIONS, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...answers, consent: true, lang }),
  });
  return body.data as { lead_ref: string };
}
