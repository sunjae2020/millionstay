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
  attributes: Record<string, string>;
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
  attributes: Record<string, string>;
}

export interface ImportPreview {
  headers: string[];
  mapping: Record<string, string>;
  rows: ImportPreviewRow[];
  counts: Partial<Record<ImportPreviewRow["verdict"], number>>;
  total: number;
  /** Unmapped columns kept as source-specific attributes. */
  attribute_keys: string[];
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
  source?: string;
  list_id?: number;
  deleted?: string;
  /** Attribute equality filters, sent as `attr.<key>=<value>`. */
  attrs?: Record<string, string>;
}

export async function listProspects(params: ListProspectsParams = {}): Promise<Prospect[]> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k === "attrs") continue;
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  for (const [key, value] of Object.entries(params.attrs ?? {})) {
    if (value) qs.set(`attr.${key}`, value);
  }
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

/* ── Lists / segments ──────────────────────────────────────────────────── */

export interface MarketingList {
  id: number;
  name: string;
  description: string;
  list_type: "static" | "dynamic";
  filter_criteria: Record<string, unknown> | null;
  member_count: number;
  status: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function listMarketingLists(): Promise<MarketingList[]> {
  const res = await apiJson<Envelope<MarketingList[]>>("/api/v1/marketing/lists");
  return res.data;
}

export async function getMarketingList(id: number): Promise<MarketingList & { members: Prospect[] }> {
  const res = await apiJson<Envelope<MarketingList & { members: Prospect[] }>>(`/api/v1/marketing/lists/${id}`);
  return res.data;
}

export async function createMarketingList(body: Partial<MarketingList>): Promise<MarketingList> {
  const res = await apiJson<Envelope<MarketingList>>("/api/v1/marketing/lists", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  return res.data;
}

export async function updateMarketingList(id: number, body: Partial<MarketingList>): Promise<MarketingList> {
  const res = await apiJson<Envelope<MarketingList>>(`/api/v1/marketing/lists/${id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  return res.data;
}

export async function deleteMarketingList(id: number): Promise<void> {
  await apiJson(`/api/v1/marketing/lists/${id}`, { method: "DELETE" });
}

export async function previewSegment(criteria: Record<string, unknown>): Promise<number> {
  const res = await apiJson<Envelope<{ count: number }>>("/api/v1/marketing/lists/preview", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(criteria),
  });
  return res.data.count;
}

export async function addListMembers(id: number, prospectIds: number[]): Promise<number> {
  const res = await apiJson<Envelope<{ member_count: number }>>(`/api/v1/marketing/lists/${id}/members`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prospect_ids: prospectIds }),
  });
  return res.data.member_count;
}

/* ── Campaigns ─────────────────────────────────────────────────────────── */

export interface CampaignStep {
  id: number;
  campaign_id: number;
  step_no: number;
  name: string;
  template_code: string | null;
  subject: string;
  body_html: string;
  delay_days: number;
  delay_hours: number;
  stop_on: string;
}

export interface Campaign {
  id: number;
  name: string;
  description: string;
  status: string;
  list_id: number | null;
  from_email: string;
  from_name: string;
  reply_to: string;
  language_code: string;
  is_advertising: boolean;
  throttle_per_hour: number;
  send_window_start: string;
  send_window_end: string;
  timezone: string;
  scheduled_at: string | null;
  total_recipients: number;
  sent_count: number;
  delivered_count: number;
  opened_count: number;
  clicked_count: number;
  bounced_count: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignDetail extends Campaign {
  steps: CampaignStep[];
  list: MarketingList | null;
}

export interface BuildResult {
  audience: number;
  recipients: number;
  excluded: Record<string, number>;
  excluded_total: number;
}

export interface CampaignPreview {
  subject: string;
  html: string;
  text: string;
  variables: string[];
  sample_prospect: { id: number; company_name: string; email: string } | null;
}

export interface CampaignStats {
  campaign: { id: number; name: string; status: string };
  total_recipients: number;
  sent: number; delivered: number; opened: number; clicked: number;
  replied: number; bounced: number; unsubscribed: number; converted: number;
  rates: Record<string, number>;
}

export interface CampaignRecipient {
  id: number;
  prospect_id: number;
  company_name: string;
  email: string;
  recipient_status: string;
  current_step: number;
  next_send_at: string | null;
  open_count: number;
  click_count: number;
  skip_reason: string;
  error_message: string;
}

export async function listCampaigns(): Promise<Campaign[]> {
  const res = await apiJson<Envelope<Campaign[]>>("/api/v1/marketing/campaigns");
  return res.data;
}

export async function getCampaign(id: number): Promise<CampaignDetail> {
  const res = await apiJson<Envelope<CampaignDetail>>(`/api/v1/marketing/campaigns/${id}`);
  return res.data;
}

export async function createCampaign(body: Partial<Campaign>): Promise<Campaign> {
  const res = await apiJson<Envelope<Campaign>>("/api/v1/marketing/campaigns", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  return res.data;
}

export async function updateCampaign(id: number, body: Partial<Campaign>): Promise<Campaign> {
  const res = await apiJson<Envelope<Campaign>>(`/api/v1/marketing/campaigns/${id}`, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  return res.data;
}

export async function saveStep(campaignId: number, step: Partial<CampaignStep>): Promise<CampaignStep> {
  const path = step.id
    ? `/api/v1/marketing/campaigns/${campaignId}/steps/${step.id}`
    : `/api/v1/marketing/campaigns/${campaignId}/steps`;
  const res = await apiJson<Envelope<CampaignStep>>(path, {
    method: step.id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(step),
  });
  return res.data;
}

export async function deleteStep(campaignId: number, stepId: number): Promise<void> {
  await apiJson(`/api/v1/marketing/campaigns/${campaignId}/steps/${stepId}`, { method: "DELETE" });
}

export async function buildCampaign(id: number): Promise<BuildResult> {
  const res = await apiJson<Envelope<BuildResult>>(`/api/v1/marketing/campaigns/${id}/build`, { method: "POST" });
  return res.data;
}

export async function previewCampaign(id: number, stepId?: number): Promise<CampaignPreview> {
  const res = await apiJson<Envelope<CampaignPreview>>(`/api/v1/marketing/campaigns/${id}/preview`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ step_id: stepId ?? null }),
  });
  return res.data;
}

export async function testSendCampaign(id: number, to: string, stepId?: number): Promise<void> {
  await apiJson(`/api/v1/marketing/campaigns/${id}/test-send`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, step_id: stepId ?? null }),
  });
}

export async function campaignAction(
  id: number,
  action: "schedule" | "pause" | "resume" | "cancel",
  body?: Record<string, unknown>,
): Promise<Campaign> {
  const res = await apiJson<Envelope<Campaign>>(`/api/v1/marketing/campaigns/${id}/${action}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}),
  });
  return res.data;
}

export async function getCampaignStats(id: number): Promise<CampaignStats> {
  const res = await apiJson<Envelope<CampaignStats>>(`/api/v1/marketing/campaigns/${id}/stats`);
  return res.data;
}

export async function getCampaignRecipients(id: number): Promise<CampaignRecipient[]> {
  const res = await apiJson<Envelope<CampaignRecipient[]>>(`/api/v1/marketing/campaigns/${id}/recipients`);
  return res.data;
}

export async function markReplied(campaignId: number, recipientId: number): Promise<void> {
  await apiJson(`/api/v1/marketing/campaigns/${campaignId}/recipients/${recipientId}/mark-replied`, { method: "POST" });
}

/* ── Dashboard ─────────────────────────────────────────────────────────── */

export interface MarketingDashboard {
  prospects: number;
  prospects_by_status: Array<{ status: string; count: number }>;
  prospects_by_segment: Array<{ segment: string; count: number }>;
  live_campaigns: number;
  recent_campaigns: Campaign[];
  event_totals: Array<{ event_type: string; count: number }>;
}

export async function getMarketingDashboard(): Promise<MarketingDashboard> {
  const res = await apiJson<Envelope<MarketingDashboard>>("/api/v1/marketing/dashboard");
  return res.data;
}

/* ── Dynamic facets ────────────────────────────────────────────────────── */

export interface ProspectSource {
  source: string;
  count: number;
}

export interface ProspectFacet {
  key: string;
  values: string[];
  value_count: number;
}

/** Source labels derived from the data, never a hard-coded enum. */
export async function listProspectSources(): Promise<ProspectSource[]> {
  const res = await apiJson<Envelope<ProspectSource[]>>("/api/v1/marketing/prospects/sources");
  return res.data;
}

/**
 * Attribute keys worth showing as a dropdown for this source, with their values.
 * High-cardinality keys (numbers, addresses, free text) are filtered out server
 * side, so whatever comes back is safe to render as a `<Select>`.
 */
export async function listProspectFacets(source?: string): Promise<ProspectFacet[]> {
  const q = source ? `?source=${encodeURIComponent(source)}` : "";
  const res = await apiJson<Envelope<ProspectFacet[]>>(`/api/v1/marketing/prospects/facets${q}`);
  return res.data;
}

/** `school_sector` → `School sector`, `취급물건` → `취급물건`. */
export function prettyFacetKey(key: string): string {
  const spaced = key.replace(/[_.]+/g, " ").trim();
  if (!/[a-z]/i.test(spaced)) return spaced;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
