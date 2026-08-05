/**
 * Marketing module API client.
 *
 * Hand-written rather than generated: these endpoints are not in the OpenAPI
 * spec yet, and the generated client would have to be regenerated in lockstep.
 * Keep the shapes here in sync with artifacts/api-server/src/routes/marketing-*.
 */
import { apiJson, apiFetch } from "@/lib/apiFetch";

export type ConsentBasis = "express" | "inferred_b2b" | "existing" | "none";

export interface Prospect {
  id: number;
  company_name: string;
  email: string;
  contact_name: string;
  contact_title: string;
  phone: string;
  website: string;
  segment: string;
  country: string;
  city: string;
  source: string;
  source_detail: string;
  prospect_status: string;
  qualification_score: number;
  owner_user_id: number | null;
  language_code: string;
  consent_basis: ConsentBasis;
  consent_evidence: string;
  consent_recorded_at: string | null;
  bounce_count: number;
  last_contacted_at: string | null;
  next_action_at: string | null;
  converted_account_id: number | null;
  converted_contact_id: number | null;
  converted_at: string | null;
  disqualified_reason: string;
  notes: string;
  status: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProspectTimelineEvent {
  id: number;
  event_type: string;
  detail: string;
  occurred_at: string;
  campaign_id: number | null;
  campaign_name: string | null;
}

export interface ProspectDetail extends Prospect {
  timeline: ProspectTimelineEvent[];
}

export interface ImportPreviewRow {
  row_no: number;
  company_name: string;
  email: string;
  contact_name: string;
  contact_title: string;
  phone: string;
  website: string;
  segment: string;
  country: string;
  city: string;
  notes: string;
  verdict: "new" | "duplicate" | "existing_account" | "suppressed" | "error";
  message: string;
}

export interface ImportPreview {
  headers: string[];
  mapping: Record<string, string>;
  rows: ImportPreviewRow[];
  counts: Partial<Record<ImportPreviewRow["verdict"], number>>;
  total: number;
}

export interface ImportResult {
  inserted: number;
  merged: number;
  skipped: number;
  errors: number;
  total: number;
}

interface Envelope<T> { success: boolean; data: T; meta?: { total: number } }

export interface ListProspectsParams {
  search?: string;
  segment?: string;
  prospect_status?: string;
  country?: string;
  list_id?: number;
  deleted?: string;
}

export async function listProspects(params: ListProspectsParams = {}): Promise<Prospect[]> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
  const q = qs.toString();
  const res = await apiJson<Envelope<Prospect[]>>(`/api/v1/marketing/prospects${q ? `?${q}` : ""}`);
  return res.data;
}

export async function getProspect(id: number): Promise<ProspectDetail> {
  const res = await apiJson<Envelope<ProspectDetail>>(`/api/v1/marketing/prospects/${id}`);
  return res.data;
}

export async function createProspect(body: Partial<Prospect>): Promise<Prospect> {
  const res = await apiJson<Envelope<Prospect>>("/api/v1/marketing/prospects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function updateProspect(id: number, body: Partial<Prospect>): Promise<Prospect> {
  const res = await apiJson<Envelope<Prospect>>(`/api/v1/marketing/prospects/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function deleteProspect(id: number): Promise<void> {
  await apiJson(`/api/v1/marketing/prospects/${id}`, { method: "DELETE" });
}

export async function disqualifyProspect(id: number, reason: string): Promise<Prospect> {
  const res = await apiJson<Envelope<Prospect>>(`/api/v1/marketing/prospects/${id}/disqualify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  return res.data;
}

export async function convertProspect(
  id: number,
  body: { account_type: string; account_name?: string; create_task?: boolean },
): Promise<{ account: { id: number; name: string }; contact: { id: number } }> {
  const res = await apiJson<Envelope<{ account: { id: number; name: string }; contact: { id: number } }>>(
    `/api/v1/marketing/prospects/${id}/convert`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
  );
  return res.data;
}

/** Multipart, so it goes through apiFetch rather than apiJson's JSON body path. */
export async function previewImport(file: File, mapping?: Record<string, string>): Promise<ImportPreview> {
  const fd = new FormData();
  fd.append("file", file);
  if (mapping) fd.append("mapping", JSON.stringify(mapping));
  const res = await apiFetch("/api/v1/marketing/prospects/import/preview", { method: "POST", body: fd });
  const json = (await res.json()) as Envelope<ImportPreview> & { error?: string };
  if (!res.ok) throw new Error(json.error ?? "Preview failed");
  return json.data;
}

export interface CommitImportOptions {
  mapping?: Record<string, string>;
  source?: string;
  source_detail?: string;
  segment?: string;
  language_code?: string;
  consent_basis: ConsentBasis;
  consent_evidence: string;
  list_id?: number;
  duplicate_strategy?: "skip" | "merge";
}

export async function commitImport(file: File, opts: CommitImportOptions): Promise<ImportResult> {
  const fd = new FormData();
  fd.append("file", file);
  for (const [k, v] of Object.entries(opts)) {
    if (v === undefined || v === "") continue;
    fd.append(k, k === "mapping" ? JSON.stringify(v) : String(v));
  }
  const res = await apiFetch("/api/v1/marketing/prospects/import/commit", { method: "POST", body: fd });
  const json = (await res.json()) as Envelope<ImportResult> & { error?: string };
  if (!res.ok) throw new Error(json.error ?? "Import failed");
  return json.data;
}
