/**
 * Channel API framework (Stage 4) — provider-agnostic adapter abstraction.
 *
 * Each OTA (Booking.com, Airbnb, Expedia) speaks a different certified
 * protocol, so we isolate that behind a `ChannelAdapter`. The rest of the
 * system (reservation ingestion, availability/rate push) works only against
 * this interface. A `mockAdapter` exercises the whole pipeline end-to-end
 * without live OTA credentials; real adapters slot in once partner access and
 * certification are granted.
 */

/** A reservation normalized from an OTA's payload into our internal shape. */
export interface NormalizedReservation {
  externalReservationId: string;
  externalListingId?: string | null; // resolves channel_listing → space
  status: "confirmed" | "cancelled" | "modified";
  guestName?: string | null;
  guestEmail?: string | null;
  checkIn: string; // "YYYY-MM-DD"
  checkOut: string; // "YYYY-MM-DD" (exclusive, hotel checkout semantics)
  numGuests?: number | null;
  totalAmount?: number | null;
  currency?: string | null;
  channelStatus?: string | null;
  raw: unknown;
}

export interface AvailabilityRange {
  start: string; // inclusive "YYYY-MM-DD"
  endExclusive: string; // exclusive "YYYY-MM-DD"
}

export interface RateRow {
  date: string;
  rate?: number | null;
  currency?: string | null;
  minStay?: number | null;
  maxStay?: number | null;
  closedToArrival?: boolean;
  closedToDeparture?: boolean;
}

/** Identifies the listing/account a push targets. */
export interface PushContext {
  channelCode: string;
  externalListingId: string | null;
  credentialsRef: string | null;
}

export interface PushResult {
  ok: boolean;
  message?: string;
}

export interface ChannelAdapter {
  code: string;
  /** Parse a raw webhook / poll payload into normalized reservations. */
  parseReservations(payload: unknown): NormalizedReservation[];
  /** Push blocked/available ranges to the channel. */
  pushAvailability(ctx: PushContext, ranges: AvailabilityRange[]): Promise<PushResult>;
  /** Push per-date rates & restrictions to the channel. */
  pushRates(ctx: PushContext, rates: RateRow[]): Promise<PushResult>;
}

// ---------------------------------------------------------------------------
// Mock adapter — accepts an already-normalized payload and no-ops on push.
// Shape it parses (single object or array):
//   { external_reservation_id, external_listing_id?, status, guest_name?,
//     guest_email?, check_in, check_out, num_guests?, total_amount?, currency? }
// ---------------------------------------------------------------------------
function toNormalized(o: any): NormalizedReservation {
  const rawStatus = String(o.status ?? "confirmed").toLowerCase();
  const status: NormalizedReservation["status"] =
    rawStatus === "cancelled" || rawStatus === "canceled" ? "cancelled" : rawStatus === "modified" ? "modified" : "confirmed";
  return {
    externalReservationId: String(o.external_reservation_id ?? o.id ?? ""),
    externalListingId: o.external_listing_id != null ? String(o.external_listing_id) : null,
    status,
    guestName: o.guest_name ?? null,
    guestEmail: o.guest_email ?? null,
    checkIn: String(o.check_in ?? o.check_in_date ?? ""),
    checkOut: String(o.check_out ?? o.check_out_date ?? ""),
    numGuests: o.num_guests != null ? Number(o.num_guests) : null,
    totalAmount: o.total_amount != null ? Number(o.total_amount) : null,
    currency: o.currency ?? null,
    channelStatus: o.channel_status ?? o.status ?? null,
    raw: o,
  };
}

export const mockAdapter: ChannelAdapter = {
  code: "mock",
  parseReservations(payload: unknown): NormalizedReservation[] {
    const body = payload as any;
    const list = Array.isArray(body) ? body : Array.isArray(body?.reservations) ? body.reservations : [body];
    return list
      .map(toNormalized)
      .filter((r: NormalizedReservation) => r.externalReservationId && r.checkIn && r.checkOut);
  },
  async pushAvailability(_ctx, ranges): Promise<PushResult> {
    return { ok: true, message: `mock: would push ${ranges.length} availability range(s)` };
  },
  async pushRates(_ctx, rates): Promise<PushResult> {
    return { ok: true, message: `mock: would push ${rates.length} rate row(s)` };
  },
};

// ---------------------------------------------------------------------------
// Registry — real OTA codes currently fall back to the mock adapter until a
// certified adapter is implemented (tracked as follow-up work).
// ---------------------------------------------------------------------------
// Real OTA adapters are deliberately NOT registered until each partnership is
// certified and credentialed (see docs/proposals/OTA_CHANNEL_API_ADAPTERS.md).
// A skeleton exists at ./bookingCom.ts. To go live, complete the adapter then
// register it here — e.g.:
//   import { bookingComAdapter } from "./bookingCom.js";
//   const REAL_ADAPTERS = { booking_com: bookingComAdapter };
const REAL_ADAPTERS: Record<string, ChannelAdapter> = {
  // booking_com: bookingComAdapter,  // Connectivity API (XML) — needs partner cert
  // airbnb:      airbnbAdapter,      // partner OAuth API
  // expedia:     expediaAdapter,     // EPS / Expedia Partner API
};

export function getAdapter(channelCode: string): ChannelAdapter {
  return REAL_ADAPTERS[channelCode] ?? mockAdapter;
}

export function isLiveAdapter(channelCode: string): boolean {
  return channelCode in REAL_ADAPTERS;
}
