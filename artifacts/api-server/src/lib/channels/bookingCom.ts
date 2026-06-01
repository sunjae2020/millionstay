/**
 * Booking.com adapter — SKELETON (Stage 4 / item #1).
 *
 * ⚠️ NOT LIVE. Booking.com integration requires a signed Connectivity Partner
 * agreement, certification against their test environment, and per-property
 * credentials. Until that is in place this adapter is intentionally NOT
 * registered in the runtime registry (see adapter.ts), so the system keeps
 * using the mock adapter. This file documents the real protocol and provides
 * the implementation shape a developer fills in after certification.
 *
 * Protocol (Booking.com Connectivity APIs — XML over HTTPS):
 *   • Inbound reservations: OTA_HotelResNotifRQ (push from Booking.com to our
 *     webhook) → ack with OTA_HotelResNotifRS. We expose the webhook at
 *     POST /api/v1/channels/booking_com/reservations.
 *   • Outbound availability: OTA_HotelAvailNotifRQ (per room/date AvailStatus).
 *   • Outbound rates/restrictions: OTA_HotelRateAmountNotifRQ
 *     (BaseByGuestAmt, LengthsOfStay, RestrictionStatus for CTA/CTD).
 *   Endpoints + auth (machine account user/password or OAuth) come from the
 *   channel_accounts.credentials_ref entry.
 *
 * XML parsing/serialization needs a library (e.g. fast-xml-parser). It is left
 * out here to avoid adding an unused dependency before certification.
 *
 * See: docs/proposals/OTA_CHANNEL_API_ADAPTERS.md
 */
import type {
  AvailabilityRange,
  ChannelAdapter,
  NormalizedReservation,
  PushContext,
  PushResult,
  RateRow,
} from "./adapter.js";

const NOT_CONFIGURED =
  "Booking.com adapter is not configured — complete Connectivity certification, " +
  "add credentials to channel_accounts, and finish bookingCom.ts before registering it.";

/**
 * Map an OTA_HotelResNotifRQ reservation (already parsed from XML into a JS
 * object) into our normalized shape. A real deployment runs the raw XML body
 * through an XML parser first; this function documents the field mapping.
 */
function mapHotelResNotif(reservation: any): NormalizedReservation {
  // Paths below reflect OTA_HotelResNotifRQ → HotelReservations → HotelReservation.
  const roomStay = reservation?.RoomStays?.RoomStay ?? {};
  const guest = reservation?.ResGuests?.ResGuest?.Profiles?.ProfileInfo?.Profile?.Customer ?? {};
  const status = String(reservation?.["@_ResStatus"] ?? "Commit").toLowerCase();
  return {
    externalReservationId: String(reservation?.UniqueID?.["@_ID"] ?? ""),
    externalListingId: roomStay?.RoomTypes?.RoomType?.["@_RoomTypeCode"] ?? null,
    status: status === "cancel" ? "cancelled" : status === "modify" ? "modified" : "confirmed",
    guestName: [guest?.PersonName?.GivenName, guest?.PersonName?.Surname].filter(Boolean).join(" ") || null,
    guestEmail: guest?.Email ?? null,
    checkIn: String(roomStay?.TimeSpan?.["@_Start"] ?? ""),
    checkOut: String(roomStay?.TimeSpan?.["@_End"] ?? ""),
    numGuests: roomStay?.GuestCounts?.GuestCount?.["@_Count"] != null ? Number(roomStay.GuestCounts.GuestCount["@_Count"]) : null,
    totalAmount: roomStay?.Total?.["@_AmountAfterTax"] != null ? Number(roomStay.Total["@_AmountAfterTax"]) : null,
    currency: roomStay?.Total?.["@_CurrencyCode"] ?? null,
    channelStatus: reservation?.["@_ResStatus"] ?? null,
    raw: reservation,
  };
}

export const bookingComAdapter: ChannelAdapter = {
  code: "booking_com",

  parseReservations(payload: unknown): NormalizedReservation[] {
    // A real impl: if typeof payload === "string", parse the XML envelope and
    // walk OTA_HotelResNotifRQ.HotelReservations.HotelReservation[]. Here we
    // accept a pre-parsed object so the mapping is exercised/testable, and
    // throw on raw XML to make the missing step explicit.
    if (typeof payload === "string") {
      throw new Error("bookingCom.parseReservations: XML parsing not implemented — wire an XML parser (e.g. fast-xml-parser).");
    }
    const body = payload as any;
    const node = body?.OTA_HotelResNotifRQ?.HotelReservations?.HotelReservation ?? body?.HotelReservation ?? body;
    const list = Array.isArray(node) ? node : [node];
    return list.map(mapHotelResNotif).filter((r) => r.externalReservationId && r.checkIn && r.checkOut);
  },

  async pushAvailability(_ctx: PushContext, _ranges: AvailabilityRange[]): Promise<PushResult> {
    // Real impl: build OTA_HotelAvailNotifRQ (AvailStatusMessages with
    // AvailStatus per RoomType/RatePlan/DateRange, BookingLimit/Status) and
    // POST to the certified Availability endpoint with the account credentials.
    return { ok: false, message: NOT_CONFIGURED };
  },

  async pushRates(_ctx: PushContext, _rates: RateRow[]): Promise<PushResult> {
    // Real impl: build OTA_HotelRateAmountNotifRQ (RateAmountMessages →
    // Rates/Rate with BaseByGuestAmts, LengthsOfStay, RestrictionStatus for
    // CTA/CTD) and POST to the certified Rates endpoint.
    return { ok: false, message: NOT_CONFIGURED };
  },
};

// Airbnb (partner OAuth API) and Expedia (EPS / Expedia Partner API) follow the
// same ChannelAdapter contract with their own JSON payloads. Add
// airbnb.ts / expedia.ts mirroring this skeleton when those partnerships land.
