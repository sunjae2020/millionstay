import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiBase } from "./api-base";

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

export interface SpaceSummary {
  id: number;
  name: string;
  space_type: string;
  booking_mode: string | null;
  max_occupancy: number | null;
  base_weekly_price: string | null;
  base_currency: string | null;
  min_stay_weeks: number | null;
  description: string | null;
  status: string;
  property_id: number | null;
  parent_space_id: number | null;
  property_name: string | null;
  property_address: string | null;
  property_city: string | null;
  property_state: string | null;
  latitude: string | null;
  longitude: string | null;
  primary_image?: string | null;
  primary_thumbnail?: string | null;
  suburb_name?: string | null;
  suburb_id?: number | null;
  images?: Array<{ id: number; file_url: string; thumbnail_url?: string | null; caption?: string | null; is_primary?: boolean }>;
  options?: Array<{ id: number; name: string; category?: string | null }>;
  policies?: Array<{ id: number; name: string; value?: string | null }>;
}

export interface PublicSpacesParams {
  suburb_id?: number;
  space_type?: "EntireSpace" | "RoomSpace" | "BedSpace";
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
  return useQuery({
    queryKey: query.queryKey ?? getListPublicSpacesQueryKey(params),
    queryFn: async () => {
      const qs = new URLSearchParams();
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
  return useQuery({
    queryKey: getListFeaturedSpacesQueryKey(),
    queryFn: () =>
      apiFetch<{ success: boolean; data: SpaceSummary[]; meta?: { total: number } }>(`/public/spaces?limit=8`),
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
  return useQuery({
    queryKey: query.queryKey ?? getGetPublicSpaceQueryKey(id),
    queryFn: () => apiFetch<{ success: boolean; data: SpaceSummary }>(`/public/spaces/${id}`),
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
}

interface BookingResponse {
  id: number;
  booking_reference?: string;
  booking_status: string;
  space_id: number;
  check_in_date: string;
  check_out_date: string;
  num_guests?: number | null;
  total_amount?: string | null;
  currency?: string | null;
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
  options?: { query?: { enabled?: boolean } }
) {
  return useQuery({
    queryKey: getListMyBookingsQueryKey(),
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
  options?: { query?: { enabled?: boolean } }
) {
  return useQuery({
    queryKey: getListMyInvoicesQueryKey(),
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
  options?: { query?: { enabled?: boolean } }
) {
  return useQuery({
    queryKey: getListMyDocumentsQueryKey(),
    queryFn: () => apiFetch<{ success: boolean; data: MyDocument[] }>("/guest/documents"),
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