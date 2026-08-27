// 세입자 온보딩 링크 API — 로그인 없이 토큰으로만 열리는 두 화면.
//
// signing-api.ts / inspection-api.ts 와 같은 자급자족 구조: 이 링크를 여는
// 사람은 계정도 게스트 JWT 도 없이 문자·메일로 받은 주소를 누른 세입자다.
import { getApiBase } from "./api-base";

const PAY = `${getApiBase()}/api/v1/public/invoice-pay`;
const DOCS = `${getApiBase()}/api/v1/public/doc-requests`;

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
