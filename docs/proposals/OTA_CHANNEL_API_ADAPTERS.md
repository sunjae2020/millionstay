# OTA Channel API Adapters — Integration Guide (Stage 4 / item #1)

> How to take the Channel API framework live with real OTAs.
> Status: **framework complete + mock adapter live**; real adapters require
> partner approval/certification and are not yet wired.

---

## 1. Where this fits

Stages 1–3 deliver an **iCal-based** integration (availability only, no partner
approval needed). Stage 4 adds a **provider-agnostic Channel API framework**:

```
ChannelAdapter (interface)            artifacts/api-server/src/lib/channels/adapter.ts
  ├─ mockAdapter         (live)       — exercises the whole pipeline, no creds
  └─ bookingComAdapter   (skeleton)   ./bookingCom.ts — fill in after cert
Reservation ingestion                 ./reservations.ts  (webhook → bookings)
Outbound push                         ./push.ts          (availability + rates)
```

The framework is **done and verified** end-to-end with the mock adapter
(webhook auth, reservation→booking mapping, idempotency, cancellation, rate
calendar, push, sync logs). Going live = implementing one `ChannelAdapter` per
OTA and registering it.

## 2. Why real adapters aren't wired yet

Each OTA gates API access behind a partnership and uses a different certified
protocol. None can be implemented/tested without credentials:

| OTA | API | Protocol | Access requirement |
|-----|-----|----------|--------------------|
| **Booking.com** | Connectivity APIs | XML over HTTPS (OTA_* messages) | Connectivity Partner agreement + certification in their test env + per-property machine account |
| **Airbnb** | Partner API | JSON / OAuth 2.0 | Approved API partner; OAuth app + host authorization |
| **Expedia / Hotels.com** | EPS / Expedia Partner Central API | JSON (Rapid) / XML (legacy) | EPS partner contract + API key/secret |

Approval typically takes weeks to months. Start the applications in parallel
with iCal (Stages 1–3) already protecting against double bookings.

## 3. The adapter contract

A real adapter implements three methods ([adapter.ts](../../artifacts/api-server/src/lib/channels/adapter.ts)):

```ts
interface ChannelAdapter {
  code: string;
  parseReservations(payload): NormalizedReservation[];        // inbound
  pushAvailability(ctx, ranges: AvailabilityRange[]): PushResult; // outbound
  pushRates(ctx, rates: RateRow[]): PushResult;                // outbound
}
```

- `parseReservations` turns the OTA's webhook/poll payload into our normalized
  reservation shape. The ingestion pipeline ([reservations.ts](../../artifacts/api-server/src/lib/channels/reservations.ts))
  then upserts `channel_reservations` and maps confirmed ones to `bookings`
  (cancellations flip the booking to Cancelled). Idempotent by
  `(channel_id, external_reservation_id)` and a deterministic `booking_ref`.
- `pushAvailability` / `pushRates` receive data already assembled from the DB
  by [push.ts](../../artifacts/api-server/src/lib/channels/push.ts) (availability from the Stage 1
  calendar aggregator; rates from `space_rate_calendar`). The adapter only
  formats + sends the certified request.

`PushContext` carries `channelCode`, `externalListingId`, and `credentialsRef`
(the `channel_accounts.credentials_ref` — a secret-manager key or encrypted
payload; never plaintext).

## 4. Booking.com specifics (skeleton provided)

See [bookingCom.ts](../../artifacts/api-server/src/lib/channels/bookingCom.ts). Messages:

- **Inbound**: `OTA_HotelResNotifRQ` is pushed to our webhook
  `POST /api/v1/channels/booking_com/reservations`; respond with
  `OTA_HotelResNotifRS`. The skeleton's `mapHotelResNotif` documents the field
  mapping; raw XML needs an XML parser (e.g. `fast-xml-parser`) — intentionally
  not added as a dependency before certification.
- **Outbound availability**: `OTA_HotelAvailNotifRQ` (AvailStatus per
  room/rate/date range).
- **Outbound rates/restrictions**: `OTA_HotelRateAmountNotifRQ`
  (BaseByGuestAmts, LengthsOfStay, RestrictionStatus → CTA/CTD).

## 5. Steps to go live with an OTA

1. Obtain partner access + credentials; store them via
   `POST /api/v1/channel-accounts` (`credentials_ref`).
2. Implement the adapter (copy `bookingCom.ts`), including request
   build/sign/send and response handling.
3. Register it in [adapter.ts](../../artifacts/api-server/src/lib/channels/adapter.ts) `REAL_ADAPTERS`.
   `getAdapter(code)` then returns it instead of the mock automatically.
4. Add the OTA's webhook signature verification on top of the shared-secret
   check in the public webhook route.
5. Map listings: set `channel_listings.external_listing_id` to the OTA's
   listing/room id (already supported in the admin UI).
6. Certify against the OTA's test environment, then enable for production.

## 6. Webhook security

The public webhook currently authenticates with a per-channel shared secret
(`X-Webhook-Secret` matched against `channel_accounts.credentials_ref`). Real
adapters MUST additionally verify the OTA's own signature/HMAC per their spec —
add that inside `parseReservations` or a per-channel verifier before trusting
the payload.

## 7. Related operational note (data-safety fix)

`importSeed` (boot-time auto-migration) TRUNCATEs `bookings`, `invoices`,
`contracts`, `channel_*` and other tables, then restores the seed snapshot.
Previously this ran automatically in production whenever the seed file's hash
changed — which would **wipe real customer and OTA-ingested bookings on a
deploy that merely updated the seed file**.

This is now **opt-in**: boot-time destructive reseed only runs when
`FORCE_SEED_MIGRATE=true` is explicitly set. Otherwise the server logs a warning
and skips, leaving live data untouched. See
[index.ts](../../artifacts/api-server/src/index.ts) (`autoMigrateIfEmpty`).

- **Provision a fresh DB:** deploy once with `FORCE_SEED_MIGRATE=true`, then
  unset it.
- **Surgical sync:** use the reviewed `POST /api/v1/admin/db-sync/import`
  endpoint (already production-gated) instead of boot-time reseed.

Keep this opt-in gate in place so OTA reservations are never wiped on deploy.
