// Public 세대점검표 API — the token-addressed tenant signing flow.
// Self-contained like signing-api.ts: the signer is a tenant reaching the page
// from an SMS/email link, with no account and no guest JWT.
import { getApiBase } from "./api-base";

const BASE = `${getApiBase()}/api/v1/public/unit-inspections`;

export type InspectionPhase = "move_in" | "move_out";

export interface InspectionPhoto {
  id: number;
  url: string;
  full: string;
}

export interface InspectionItemView {
  id: number;
  group_key: string | null;
  label: string;
  status: "ok" | "defect" | "na" | null;
  note: string | null;
  photos: InspectionPhoto[];
  response: { decision: "agreed" | "disputed"; comment: string | null } | null;
}

export interface InspectionView {
  report_ref: string;
  phase: InspectionPhase;
  title: string | null;
  status: string;
  template: { key: string; heading: string; specialTerms: string[] };
  meta: Record<string, any>;
  groups: Array<{ key: string; label: string }>;
  signed: boolean;
  items: InspectionItemView[];
}

export class InspectionError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "InspectionError";
    this.status = status;
    this.code = code;
  }
}

async function readJson(res: Response): Promise<any> {
  const text = await res.text().catch(() => "");
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { _raw: text }; }
}

async function request(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(path, init);
  const body = await readJson(res);
  if (!res.ok) throw new InspectionError(res.status, body?.error ?? "error", body?.message ?? "Request failed.");
  return body;
}

export async function getInspection(token: string): Promise<InspectionView> {
  const body = await request(`${BASE}/${encodeURIComponent(token)}`);
  return body.data as InspectionView;
}

export async function respondToItem(
  token: string,
  itemId: number,
  decision: "agreed" | "disputed",
  comment?: string,
): Promise<void> {
  await request(`${BASE}/${encodeURIComponent(token)}/respond`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item_id: itemId, decision, comment }),
  });
}

export async function uploadInspectionPhoto(token: string, itemId: number, file: File): Promise<InspectionPhoto> {
  const form = new FormData();
  form.append("image", file);
  form.append("item_id", String(itemId));
  const body = await request(`${BASE}/${encodeURIComponent(token)}/photos`, { method: "POST", body: form });
  return body.data as InspectionPhoto;
}

export async function signInspection(token: string, signerName: string, signatureImage: string): Promise<void> {
  await request(`${BASE}/${encodeURIComponent(token)}/sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signer_name: signerName, signature_image: signatureImage, consent: true }),
  });
}

/** Token-gated PDF of the checklist as shown. */
export function inspectionPdfUrl(token: string): string {
  return `${BASE}/${encodeURIComponent(token)}/document.pdf`;
}
