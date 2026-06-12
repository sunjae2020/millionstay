// Homestay host portal API helpers.
//
// The host portal uses a SEPARATE auth token from the guest portal. It is
// stored in localStorage under `homestay_token` (the guest portal uses
// `ms_guest_token`). All host portal requests send it as a Bearer token.
import { getApiBase } from "./api-base";

const BASE = `${getApiBase()}/api/v1`;
export const HOMESTAY_TOKEN_KEY = "homestay_token";

export function getHomestayToken(): string | null {
  try {
    return localStorage.getItem(HOMESTAY_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setHomestayToken(token: string): void {
  try {
    localStorage.setItem(HOMESTAY_TOKEN_KEY, token);
  } catch {}
}

export function clearHomestayToken(): void {
  try {
    localStorage.removeItem(HOMESTAY_TOKEN_KEY);
  } catch {}
}

export class HomestayApiError extends Error {
  readonly status: number;
  readonly payload: unknown;
  constructor(status: number, message: string, payload?: unknown) {
    super(message);
    this.name = "HomestayApiError";
    this.status = status;
    this.payload = payload;
  }
}

async function readJson(res: Response): Promise<any> {
  const text = await res.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HomestayResident {
  name: string;
  age: string;
  gender: string;
  relationship: string;
}

export interface HomestayRoom {
  name: string;
  bed_type: string;
  bath_type: string;
  has_lock: boolean;
  comments: string;
}

export interface HomestayEmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email: string;
}

export interface HomestayReferral {
  heard_about: string;
  referred_by_host: boolean;
  referrer_name: string;
}

export interface HomestayWwccRecord {
  name: string;
  wwcc_number: string;
  expiry_date: string; // YYYY-MM-DD
  verified?: boolean;
}

export interface HomestayApplication {
  id?: number;
  application_ref?: string;
  status?: string;
  landing_active?: boolean;
  requested_docs?: string[] | null;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  gender?: string;
  nationality?: string;
  cultural_background?: string;
  address?: string;
  suburb?: string;
  heard_about?: string;
  residents?: HomestayResident[];
  smoking_in_home?: boolean;
  smoke_outside_allowed?: boolean;
  drink_in_home?: boolean;
  guest_drink_allowed?: boolean;
  has_pets?: boolean;
  pet_types?: string;
  pet_notes?: string;
  building_type?: string;
  home_features?: string[];
  rooms?: HomestayRoom[];
  pref_student_gender?: string;
  pref_student_age?: string;
  host_under_18?: boolean;
  packages_offered?: string[];
  dietary?: string[];
  dietary_notes?: string;
  welcome_message?: string;
  profile_description?: string;
  emergency_contact?: HomestayEmergencyContact;
  host_referral?: HomestayReferral;
  agreement_accepted?: boolean;
  signature_name?: string;
  // Compliance
  wwcc_records?: HomestayWwccRecord[];
  insurance_provider?: string;
  insurance_policy_no?: string;
  insurance_expiry?: string;
  // Bank (visible/editable only after approval)
  bank_name?: string;
  bank_account_name?: string;
  bank_bsb?: string;
  bank_account_number?: string;
  bank_swift?: string;
}

export interface HomestayDocument {
  id: number;
  doc_type?: string | null;
  document_type?: string | null;
  status?: string | null;
  file_url?: string | null;
  original_filename?: string | null;
  uploaded_at?: string | null;
}

export interface HomestayMeResponse {
  success: boolean;
  application: HomestayApplication;
  documents: HomestayDocument[];
}

// ─── Requests ─────────────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const token = getHomestayToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Submit the public host application (no auth). */
export async function submitHostApplication(
  data: Record<string, unknown>
): Promise<{ success: boolean; application_ref: string; token: string; signing_token: string | null; application: HomestayApplication }> {
  const res = await fetch(`${BASE}/public/homestay-host-applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const body = await readJson(res);
  if (!res.ok) {
    throw new HomestayApiError(res.status, body?.error ?? body?.message ?? "Failed to submit application", body);
  }
  return body;
}

/** Host login — shares the partner login endpoint (portal_type === 'homestay'). */
export async function hostLogin(
  email: string,
  password: string
): Promise<{ success: boolean; token: string; user: unknown }> {
  const res = await fetch(`${BASE}/auth/partner/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await readJson(res);
  if (!res.ok) {
    throw new HomestayApiError(res.status, body?.error ?? body?.message ?? "Invalid email or password", body);
  }
  return body;
}

/** Fetch the logged-in host's application + documents. */
export async function fetchHostMe(): Promise<HomestayMeResponse> {
  const res = await fetch(`${BASE}/homestay/me`, { headers: { ...authHeaders() } });
  const body = await readJson(res);
  if (!res.ok) {
    throw new HomestayApiError(res.status, body?.error ?? body?.message ?? "Failed to load application", body);
  }
  return body;
}

/** Update the host's application (allowed only while status is not Approved/Rejected). */
export async function updateHostMe(
  data: Record<string, unknown>
): Promise<{ application: HomestayApplication }> {
  const res = await fetch(`${BASE}/homestay/me`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  const body = await readJson(res);
  if (!res.ok) {
    throw new HomestayApiError(res.status, body?.error ?? body?.message ?? "Failed to save changes", body);
  }
  return body;
}

/** Upload a document (multipart/form-data). */
export async function uploadHostDocument(
  docType: string,
  file: File
): Promise<{ document: HomestayDocument }> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("doc_type", docType);
  const res = await fetch(`${BASE}/homestay/documents`, {
    method: "POST",
    headers: { ...authHeaders() }, // no Content-Type — browser sets multipart boundary
    body: fd,
  });
  const body = await readJson(res);
  if (!res.ok) {
    throw new HomestayApiError(res.status, body?.error ?? body?.message ?? "Upload failed", body);
  }
  return body;
}

/** Save the public host application as a Draft (no auth). Password required, agreement NOT. */
export async function saveDraftApplication(
  data: Record<string, unknown>
): Promise<{ success: boolean; application_ref: string; token: string; application: HomestayApplication }> {
  const res = await fetch(`${BASE}/public/homestay-host-applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, draft: true }),
  });
  const body = await readJson(res);
  if (!res.ok) {
    throw new HomestayApiError(res.status, body?.error ?? body?.message ?? "Failed to save draft", body);
  }
  return body;
}

/** Finalise a Draft application (Draft → Submitted). Requires agreement + signature. */
export async function submitDraft(
  data: { agreement_accepted?: boolean; signature_name?: string }
): Promise<{ application: HomestayApplication }> {
  const res = await fetch(`${BASE}/homestay/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  const body = await readJson(res);
  if (!res.ok) {
    throw new HomestayApiError(res.status, body?.error ?? body?.message ?? "Failed to submit application", body);
  }
  return body;
}

/** Update compliance (WWCC records + insurance). */
export async function updateCompliance(
  data: {
    wwcc_records?: HomestayWwccRecord[];
    insurance_provider?: string;
    insurance_policy_no?: string;
    insurance_expiry?: string;
  }
): Promise<{ application: HomestayApplication }> {
  const res = await fetch(`${BASE}/homestay/compliance`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  const body = await readJson(res);
  if (!res.ok) {
    throw new HomestayApiError(res.status, body?.error ?? body?.message ?? "Failed to save compliance details", body);
  }
  return body;
}

/** Update bank details (only when status === 'Approved'). */
export async function updateBank(
  data: {
    bank_name?: string;
    bank_account_name?: string;
    bank_bsb?: string;
    bank_account_number?: string;
    bank_swift?: string;
  }
): Promise<{ application: HomestayApplication }> {
  const res = await fetch(`${BASE}/homestay/bank`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(data),
  });
  const body = await readJson(res);
  if (!res.ok) {
    throw new HomestayApiError(res.status, body?.error ?? body?.message ?? "Failed to save bank details", body);
  }
  return body;
}

/** Activate / deactivate the public landing page (only when status === 'Approved'). */
export async function setLandingActive(active: boolean): Promise<{ landing_active: boolean }> {
  const res = await fetch(`${BASE}/homestay/landing/activate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ active }),
  });
  const body = await readJson(res);
  if (!res.ok) {
    throw new HomestayApiError(res.status, body?.error ?? body?.message ?? "Failed to update landing page", body);
  }
  return body;
}
