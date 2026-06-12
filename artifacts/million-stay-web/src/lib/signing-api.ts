// Public e-signature API — talks to the unauthenticated signing endpoints.
// Self-contained (no guest-auth coupling) since the signer is an external party
// reaching the page via a token link.
import { getApiBase } from "./api-base";

const BASE = `${getApiBase()}/api/v1/public/contract-signing`;

export interface SigningSigner {
  role: string;
  name: string;
  email: string;
  required: boolean;
}

export interface SigningRequest {
  id: number;
  status: string;
  context_type: string;
  context_id: number;
  signers: SigningSigner[];
  expires_at: string | null;
}

export class SigningError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "SigningError";
    this.status = status;
    this.code = code;
  }
}

async function readJson(res: Response): Promise<any> {
  const text = await res.text().catch(() => "");
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { _raw: text }; }
}

export async function getSigningRequest(token: string): Promise<SigningRequest> {
  const res = await fetch(`${BASE}/${encodeURIComponent(token)}`);
  const body = await readJson(res);
  if (!res.ok) throw new SigningError(res.status, body?.error ?? "error", body?.message ?? "Failed to load signing request.");
  return body as SigningRequest;
}

export interface SubmitSignature {
  role: string;
  name: string;
  signatureImage: string;
  signedAt?: string;
}

export async function submitSignatures(
  token: string,
  signatures: SubmitSignature[],
  consent: boolean,
): Promise<void> {
  const res = await fetch(`${BASE}/${encodeURIComponent(token)}/sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signatures, consent }),
  });
  const body = await readJson(res);
  if (!res.ok) throw new SigningError(res.status, body?.error ?? "error", body?.message ?? "Failed to submit signatures.");
}

/** Token-gated HTML preview of the application (pending before signing, signed after). */
export function previewUrl(token: string): string {
  return `${BASE}/${encodeURIComponent(token)}/preview`;
}

/** Token-gated signed PDF (redirects to a short-lived signed URL, or renders inline). */
export function signedPdfUrl(token: string): string {
  return `${BASE}/${encodeURIComponent(token)}/pdf`;
}

export interface RecipientSelection {
  applicant?: boolean;
  agent?: boolean;
  ops?: boolean;
}

/** Re-send the signed application PDF to the selected recipients. */
export async function sendApplicationPdf(token: string, select: RecipientSelection): Promise<string[]> {
  const res = await fetch(`${BASE}/${encodeURIComponent(token)}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(select),
  });
  const body = await readJson(res);
  if (!res.ok) throw new SigningError(res.status, body?.error ?? "error", body?.message ?? "Failed to send the document.");
  return (body?.sent as string[]) ?? [];
}
