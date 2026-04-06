const API_BASE = "/api";
const TOKEN_KEY = "ms_guest_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers as Record<string, string> | undefined),
    },
    ...options,
  });

  if (res.status === 401) {
    clearToken();
    window.location.href = `${import.meta.env.BASE_URL}login`;
    throw new Error("Unauthorized");
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error ?? `Request failed: ${res.status}`);
  }
  return data as T;
}

// ─── Public APIs ──────────────────────────────────────────────

export interface Space {
  id: number;
  name: string;
  space_type: string | null;
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
  latitude: number | null;
  longitude: number | null;
  primary_image: string | null;
  primary_thumbnail: string | null;
  space_options: string[];
}

export interface SpaceDetail extends Space {
  floor_number: string | null;
  floor_area_sqm: number | null;
  property_postcode: string | null;
  images: SpaceImage[];
  images_from_parent: boolean;
  pricing_tiers: PricingTier[];
}

export interface SpaceImage {
  id: number;
  file_url: string;
  thumbnail_url: string | null;
  is_primary: boolean;
  display_order: number | null;
  caption: string | null;
}

export interface PricingTier {
  id: number;
  name: string;
  price: string | null;
  min_contract_period: number | null;
  min_contract_period_unit: string | null;
}

export interface Property {
  id: number;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  description: string | null;
  active_spaces: number;
}

export interface Availability {
  space_id: number;
  start_date: string;
  end_date: string;
  is_available: boolean;
  blocked_dates: { date: string; reason: string }[];
  booked_periods: { booking_ref: string; check_in: string; check_out: string; status: string }[];
}

export async function listSpaces(params?: {
  city?: string;
  min_price?: number;
  max_price?: number;
  start_date?: string;
  end_date?: string;
}): Promise<{ data: Space[]; meta: { total: number } }> {
  const qs = new URLSearchParams();
  if (params?.city) qs.set("city", params.city);
  if (params?.min_price != null) qs.set("min_price", String(params.min_price));
  if (params?.max_price != null) qs.set("max_price", String(params.max_price));
  if (params?.start_date) qs.set("start_date", params.start_date);
  if (params?.end_date) qs.set("end_date", params.end_date);
  const query = qs.toString() ? `?${qs}` : "";
  return request(`/v1/public/spaces${query}`);
}

export async function getSpace(id: number): Promise<{ data: SpaceDetail }> {
  return request(`/v1/public/spaces/${id}`);
}

export async function getSpaceAvailability(
  id: number,
  start_date: string,
  end_date: string,
): Promise<{ data: Availability }> {
  return request(
    `/v1/public/spaces/${id}/availability?start_date=${start_date}&end_date=${end_date}`,
  );
}

export async function listProperties(): Promise<{ data: Property[]; meta: { total: number } }> {
  return request(`/v1/public/properties`);
}

// ─── Guest Auth ───────────────────────────────────────────────

export interface GuestUser {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  account_id: number | null;
}

export async function guestRegister(body: {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
}): Promise<{ token: string; user: GuestUser }> {
  return request("/v1/auth/guest/register", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function guestLogin(body: {
  email: string;
  password: string;
}): Promise<{ token: string; user: GuestUser }> {
  return request("/v1/auth/guest/login", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getMe(): Promise<{ user: GuestUser }> {
  return request("/v1/auth/guest/me");
}

// ─── Guest Portal ─────────────────────────────────────────────

export interface Booking {
  id: number;
  booking_ref: string;
  booking_status: string;
  check_in_date: string;
  check_out_date: string;
  stay_weeks: number | null;
  agreed_weekly_rate: string | null;
  total_rent: string | null;
  currency: string | null;
  num_guests: number | null;
  customer_notes: string | null;
  created_at: string;
  space_name: string | null;
  space_type: string | null;
  property_name: string | null;
  property_city: string | null;
  property_address: string | null;
}

export interface BookingDetail extends Booking {
  property_state: string | null;
  cancellation_reason: string | null;
}

export interface Invoice {
  id: number;
  invoice_ref: string;
  amount: string | null;
  currency: string | null;
  invoice_status: string;
  due_date: string | null;
  paid_at: string | null;
  description: string | null;
  created_at: string;
}

export interface Profile {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  account_id: number | null;
  created_at: string;
  account: {
    name: string;
    account_email: string | null;
    phone1: string | null;
    address_line1: string | null;
    address_suburb: string | null;
    address_state: string | null;
    address_postcode: string | null;
    address_country: string | null;
  } | null;
}

export async function listMyBookings(): Promise<{ data: Booking[]; meta: { total: number } }> {
  return request("/v1/guest/bookings");
}

export async function getMyBooking(id: number): Promise<{ data: BookingDetail }> {
  return request(`/v1/guest/bookings/${id}`);
}

export async function createBookingInquiry(body: {
  space_id: number;
  check_in_date: string;
  check_out_date: string;
  num_guests?: number;
  customer_notes?: string;
}): Promise<{ data: { id: number; booking_ref: string; booking_status: string } }> {
  return request("/v1/guest/bookings", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function listMyInvoices(): Promise<{ data: Invoice[]; meta: { total: number } }> {
  return request("/v1/guest/invoices");
}

export async function getMyProfile(): Promise<{ data: Profile }> {
  return request("/v1/guest/profile");
}

export async function updateMyProfile(body: {
  first_name?: string;
  last_name?: string;
  phone?: string;
}): Promise<{ data: Partial<GuestUser> }> {
  return request("/v1/guest/profile", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}
