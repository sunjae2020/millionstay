import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiBase } from "./api-base";
import i18n from "../i18n";

// Current guest UI language as a bare code ("ko-KR" → "ko"), sent as ?lang so the
// public API returns per-locale content (space/property/amenity copy). Included
// in query keys so switching language refetches translated content.
function currentLang(): string {
  return (i18n.language || "en").split("-")[0].toLowerCase();
}

const BASE = `${getApiBase()}/api/v1`;
const GUEST_TOKEN_KEY = "ms_guest_token";
const GUEST_STORAGE_KEY = "ms-guest-storage";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem(GUEST_TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function clearAuthAndRedirect() {
  localStorage.removeItem(GUEST_TOKEN_KEY);
  try {
    localStorage.removeItem(GUEST_STORAGE_KEY);
  } catch {}
  window.location.href = "/login?reason=session_expired";
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly payload: unknown;
  constructor(status: number, code: string, message: string, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
  // Preserve legacy { status, data } shape consumers depend on.
  get data(): unknown { return this.payload; }
}

function friendlyMessage(status: number, serverError?: unknown): string {
  const serverMsg =
    typeof serverError === "string" && serverError.length > 0 && serverError.length < 500
      ? serverError
      : null;
  if (status === 0) return "Cannot connect to the server. Please check your network or try again later.";
  if (status === 400) return serverMsg ?? "The request was invalid. Please check your input and try again.";
  if (status === 401) return serverMsg ?? "Invalid email or password.";
  if (status === 403) return serverMsg ?? "You don't have permission to perform this action.";
  if (status === 404) return serverMsg ?? "The requested resource was not found.";
  if (status === 408 || status === 504) return "The server is taking too long to respond. Please try again.";
  if (status === 409) return serverMsg ?? "Duplicate or conflicting request.";
  if (status === 413) return "File is too large.";
  if (status === 429) return serverMsg ?? "Too many requests. Please wait a moment and try again.";
  if (status === 502 || status === 503) return "The server is temporarily unavailable. Please try again shortly.";
  if (status >= 500) return "A server error occurred. Please try again later.";
  return serverMsg ?? `Something went wrong (HTTP ${status}). Please try again.`;
}

async function safeReadJson(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => "");
  if (!text) return null;
  try { return JSON.parse(text); } catch { return { _raw: text }; }
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { "Content-Type": "application/json", ...authHeaders(), ...((options?.headers as Record<string, string>) ?? {}) },
      ...options,
    });
  } catch (err) {
    throw new ApiError(0, "NETWORK", friendlyMessage(0), { cause: String(err) });
  }
  const body = await safeReadJson(res);

  if (res.status === 401) {
    // Login itself returns 401 with body — let the caller decide. Otherwise treat as expired session.
    const isLoginAttempt = /\/auth\/(login|guest\/login|partner\/login)/.test(path);
    if (!isLoginAttempt) clearAuthAndRedirect();
    const serverErr = (body as any)?.error ?? (body as any)?.message;
    throw new ApiError(401, "UNAUTHORIZED", friendlyMessage(401, serverErr), body);
  }
  if (!res.ok) {
    const serverErr = (body as any)?.error ?? (body as any)?.message;
    throw new ApiError(res.status, "HTTP_" + res.status, friendlyMessage(res.status, serverErr), body);
  }
  return body as T;
}

// ─── Types ───────────────────────────────────────────────────────────────────

/** Accommodation pricing tier returned by the single-space detail endpoint. */
export interface SpaceProduct {
  id: number;
  name: string;
  price: number | null;
  min_contract_period: number | null;
  min_contract_period_unit: string | null;
  bond_amount: number | null;
  admin_fee: number | null;
  cleaning_fee: number | null;
  /** Not returned by the API yet; reserved for "best_value" style tagging. */
  product_tag?: string | null;
  currency?: string | null;
}

export interface SpaceSummary {
  id: number;
  name: string;
  space_type: string;
  booking_mode: string | null;
  max_occupancy: number | null;
  base_weekly_price: string | null;
  base_daily_price?: string | null;
  base_currency: string | null;
  min_stay_weeks: number | null;
  description: string | null;
  status: string;
  floor_number?: number | null;
  floor_area_sqm?: string | null;
  property_id: number | null;
  parent_space_id: number | null;
  property_name: string | null;
  property_address: string | null;
  property_city: string | null;
  property_state: string | null;
  property_postcode?: string | null;
  latitude: string | null;
  longitude: string | null;
  privacy_map_blur?: boolean;
  primary_image?: string | null;
  primary_thumbnail?: string | null;
  suburb_name?: string | null;
  suburb_id?: number | null;
  images?: Array<{ id: number; file_url: string; thumbnail_url?: string | null; caption?: string | null; is_primary?: boolean }>;
  images_from_parent?: boolean;
  options?: Array<{ id: number; name: string; category?: string | null }>;
  space_options?: Array<{ name: string | null; display_name?: string | null; option_category?: string | null }>;
  policies?: Array<{ id: number; name: string; value?: string | null }>;
  /** Pricing tiers — only returned by GET /public/spaces/:id (detail view). */
  products?: SpaceProduct[];
}

export interface PublicSpacesParams {
  suburb_id?: number;
  space_type?: "EntireSpace" | "RoomSpace" | "BedSpace" | "Homestay";
  gender_policy?: "FemaleOnly" | "Mixed";
  min_price?: number;
  max_price?: number;
  limit?: number;
  offset?: number;
  city?: string;
  start_date?: string;
  end_date?: string;
}

// ─── Public Spaces ────────────────────────────────────────────────────────────

export function getListPublicSpacesQueryKey(params?: PublicSpacesParams) {
  return ["public", "spaces", params ?? {}] as const;
}

export function useListPublicSpaces(
  params?: PublicSpacesParams,
  options?: { query?: { queryKey?: readonly unknown[]; enabled?: boolean } }
) {
  const query = options?.query ?? {};
  const lang = currentLang();
  return useQuery({
    queryKey: query.queryKey ?? [...getListPublicSpacesQueryKey(params), lang],
    queryFn: async () => {
      const qs = new URLSearchParams();
      qs.set("lang", lang);
      if (params?.suburb_id) qs.set("suburb_id", String(params.suburb_id));
      if (params?.space_type) qs.set("space_type", params.space_type);
      if (params?.gender_policy) qs.set("gender_policy", params.gender_policy);
      if (params?.min_price != null) qs.set("min_price", String(params.min_price));
      if (params?.max_price != null) qs.set("max_price", String(params.max_price));
      if (params?.limit != null) qs.set("limit", String(params.limit));
      if (params?.offset != null) qs.set("offset", String(params.offset));
      if (params?.city) qs.set("city", params.city);
      if (params?.start_date) qs.set("start_date", params.start_date);
      if (params?.end_date) qs.set("end_date", params.end_date);
      const q = qs.toString();
      return apiFetch<{ success: boolean; data: SpaceSummary[]; meta?: { total: number } }>(`/public/spaces${q ? `?${q}` : ""}`);
    },
    enabled: query.enabled ?? true,
  });
}

export function getListFeaturedSpacesQueryKey() {
  return ["public", "spaces", "featured"] as const;
}

export function useListFeaturedSpaces() {
  const lang = currentLang();
  return useQuery({
    queryKey: [...getListFeaturedSpacesQueryKey(), lang],
    queryFn: () =>
      apiFetch<{ success: boolean; data: SpaceSummary[]; meta?: { total: number } }>(`/public/spaces?limit=8&lang=${lang}`),
  });
}

// ─── Single Public Space ──────────────────────────────────────────────────────

export function getGetPublicSpaceQueryKey(id: string | number) {
  return ["public", "spaces", id] as const;
}

export function useGetPublicSpace(
  id: string | number,
  options?: { query?: { enabled?: boolean; queryKey?: readonly unknown[] } }
) {
  const query = options?.query ?? {};
  const lang = currentLang();
  return useQuery({
    queryKey: query.queryKey ?? [...getGetPublicSpaceQueryKey(id), lang],
    queryFn: () => apiFetch<{ success: boolean; data: SpaceSummary }>(`/public/spaces/${id}?lang=${lang}`),
    enabled: query.enabled ?? true,
  });
}

// ─── Guest Auth ───────────────────────────────────────────────────────────────

export interface GuestAuthResponse {
  success?: boolean;
  token: string;
  user: {
    id: number;
    email: string;
    first_name: string | null;
    last_name: string | null;
    phone?: string | null;
    account_id: number | null;
  };
}

export function useGuestLogin() {
  return useMutation({
    mutationFn: (payload: { data: { email: string; password: string } }) =>
      apiFetch<GuestAuthResponse>("/auth/guest/login", {
        method: "POST",
        body: JSON.stringify(payload.data),
      }),
  });
}

interface RegisterPayload {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  /** Sent by the booking wizard; currently ignored server-side. */
  nationality?: string;
  marketing_consent?: boolean;
}

interface RegisterResponse {
  token: string;
  user: {
    id: number;
    email: string;
    first_name: string | null;
    last_name: string | null;
    account_id: number | null;
  };
}

export function useGuestRegister() {
  return useMutation({
    mutationFn: (payload: { data: RegisterPayload }) =>
      apiFetch<RegisterResponse>("/auth/guest/register", {
        method: "POST",
        body: JSON.stringify(payload.data),
      }),
  });
}

// ─── Guest Bookings ───────────────────────────────────────────────────────────

interface CreateGuestBookingPayload {
  space_id: number;
  check_in_date: string;
  check_out_date: string;
  num_guests?: number;
  special_requests?: string;
  /** Sent by the booking flow to indicate the chosen pricing tier; currently ignored server-side. */
  product_id?: number;
}

interface BookingResponse {
  id: number;
  booking_ref: string;
  booking_status: string;
  check_in_date: string;
  check_out_date: string;
  created_at?: string | null;
}

export function useCreateGuestBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { data: CreateGuestBookingPayload }) =>
      apiFetch<{ success: boolean; data: BookingResponse }>("/guest/bookings", {
        method: "POST",
        body: JSON.stringify(payload.data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guest", "bookings"] });
    },
  });
}

// ─── Guest Portal: My Bookings ────────────────────────────────────────────────

export interface MyBooking {
  id: number;
  booking_reference?: string | null;
  booking_status: string;
  space_id?: number | null;
  space_name?: string | null;
  property_name?: string | null;
  property_address?: string | null;
  check_in_date: string;
  check_out_date: string;
  num_guests?: number | null;
  total_amount?: string | null;
  currency?: string | null;
  special_requests?: string | null;
  invoices?: Array<{ id: number; invoice_number?: string; status?: string; amount?: string }>;
}

export function getListMyBookingsQueryKey() {
  return ["guest", "bookings"] as const;
}

export function useListMyBookings(
  options?: { query?: { enabled?: boolean; queryKey?: readonly unknown[] } }
) {
  return useQuery({
    queryKey: options?.query?.queryKey ?? getListMyBookingsQueryKey(),
    queryFn: () => apiFetch<{ success: boolean; data: MyBooking[] }>("/guest/bookings"),
    enabled: options?.query?.enabled ?? true,
  });
}

// ─── Guest Portal: My Invoices ────────────────────────────────────────────────

export interface MyInvoice {
  id: number;
  invoice_ref?: string | null;
  amount?: number | null;
  currency?: string | null;
  status?: string | null;
  due_date?: string | null;
  paid_at?: string | null;
  payment_method?: string | null;
  description?: string | null;
  notes?: string | null;
  created_at?: string | null;
  booking_id?: number | null;
  booking_ref?: string | null;
  space_name?: string | null;
  property_address?: string | null;
  contract_id?: number | null;
  // 통합(단체) 청구 — 여러 공간을 한 장으로 묶은 월 청구서와 그 안의 공간별 인보이스.
  // "consolidated" = 납부 대상 통합 청구서, parent_invoice_id 있음 = 거기에 묶인 공간별 인보이스.
  invoice_kind?: string | null;
  parent_invoice_id?: number | null;
  billing_period?: string | null;
  line_items?: Array<{
    label: string;
    description?: string | null;
    total_amount?: string | number | null;
    period_start?: string | null;
    period_end?: string | null;
  }>;
  check_in_date?: string | null;
  check_out_date?: string | null;
  property_city?: string | null;
  property_state?: string | null;
  guest?: { first_name: string | null; last_name: string | null; email: string } | null;
}

export function getListMyInvoicesQueryKey() {
  return ["guest", "invoices"] as const;
}

export function useListMyInvoices(
  options?: { query?: { enabled?: boolean; queryKey?: readonly unknown[] } }
) {
  return useQuery({
    queryKey: options?.query?.queryKey ?? getListMyInvoicesQueryKey(),
    queryFn: () => apiFetch<{ success: boolean; data: MyInvoice[] }>("/guest/invoices"),
    enabled: options?.query?.enabled ?? true,
  });
}

// ─── Guest Portal: My Documents ───────────────────────────────────────────────

export interface MyDocument {
  id: number;
  document_type?: string | null;
  status?: string | null;
  file_url?: string | null;
  original_filename?: string | null;
  uploaded_at?: string | null;
  reviewed_at?: string | null;
  notes?: string | null;
}

export function getListMyDocumentsQueryKey() {
  return ["guest", "documents"] as const;
}

export function useListMyDocuments(
  options?: { query?: { enabled?: boolean; queryKey?: readonly unknown[] } }
) {
  return useQuery({
    queryKey: options?.query?.queryKey ?? getListMyDocumentsQueryKey(),
    queryFn: () => apiFetch<{ success: boolean; data: MyDocument[] }>("/guest/documents"),
    enabled: options?.query?.enabled ?? true,
  });
}

// ─── Guest Portal: 해야 할 일 (온보딩 링크) ──────────────────────────────────
//
// 청구서 결제·서류 제출·서명 링크는 메일과 문자로 먼저 나간다. 그 메일을 지웠거나
// 못 찾는 사람이 반드시 있어서, 포털에 들어온 세입자에게 같은 링크를 다시 보여
// 준다. 포털이 그 화면들을 복제하지는 않는다 — 토큰 주소로 그대로 보낸다.

export interface OnboardingTask {
  kind: "invoice_pay" | "doc_request" | "contract_sign" | "settlement_sign";
  url: string;
  ref: string | null;
  due_date: string | null;
  expires_at: string | null;
}

export function getMyOnboardingQueryKey() {
  return ["guest", "onboarding"] as const;
}

export function useMyOnboarding(options?: { query?: { enabled?: boolean } }) {
  return useQuery({
    queryKey: getMyOnboardingQueryKey(),
    queryFn: () => apiFetch<{ success: boolean; data: { tasks: OnboardingTask[] } }>("/guest/onboarding"),
    enabled: options?.query?.enabled ?? true,
  });
}

// ─── Guest Portal: Profile ────────────────────────────────────────────────────

export interface GuestProfile {
  id: number;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
}

export function getGetMyProfileQueryKey() {
  return ["guest", "profile"] as const;
}

export function useGetMyProfile(
  options?: { query?: { enabled?: boolean } }
) {
  return useQuery({
    queryKey: getGetMyProfileQueryKey(),
    queryFn: () => apiFetch<{ success: boolean; data: GuestProfile }>("/guest/profile"),
    enabled: options?.query?.enabled ?? true,
  });
}

export function useUpdateMyProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { data: Partial<Pick<GuestProfile, "first_name" | "last_name" | "phone">> }) =>
      apiFetch<{ success: boolean; data: GuestProfile }>("/guest/profile", {
        method: "PUT",
        body: JSON.stringify(payload.data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guest", "profile"] });
    },
  });
}

/** Public-safe company / operator info (single source = Settings → Organisation).
 *  Footer/legal fields come back empty when unset so callers can fall back to
 *  their localized i18n defaults. */
export interface PublicCompanyContact {
  email: string;
  tradingName: string;
  companyName: string;
  ceo: string;
  bizNo: string;
  address: string;
  phone: string;
  website: string;
  privacyOfficer: string;
}

const EMPTY_COMPANY_CONTACT: PublicCompanyContact = {
  email: "", tradingName: "", companyName: "", ceo: "", bizNo: "",
  address: "", phone: "", website: "", privacyOfficer: "",
};

/** Fetch the full public company block. Returns empty strings while loading /
 *  for any unset field, so consumers overlay it above their i18n fallbacks. */
export function useCompanyContact(): PublicCompanyContact {
  const { data } = useQuery({
    queryKey: ["public-company-contact"],
    queryFn: () => apiFetch<{ success: boolean; data: Partial<PublicCompanyContact> }>("/public/company-contact"),
    staleTime: 1000 * 60 * 60,
  });
  return { ...EMPTY_COMPANY_CONTACT, ...(data?.data ?? {}) };
}

/** Public-safe company contact email. Falls back to the representative address
 *  so pages always render. */
export const SUPPORT_EMAIL_FALLBACK = "millionstay.com@gmail.com";
export function useSupportEmail(): string {
  return useCompanyContact().email || SUPPORT_EMAIL_FALLBACK;
}