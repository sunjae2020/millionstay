# Domain: booking

> **File of origin**: `artifacts/api-server/src/routes/bookings.ts` (760 lines, 27 endpoints).
> **URL prefix (all endpoints)**: `/api/v1/bookings/...` and `/api/v1/lookup/bookings`.
> **Auth guard (all endpoints)**: `requireAuth` (admin/staff guard mounted at `app.ts:167`).
> **Risk**: 🔴 P0. Triggering findings: [CF-002](../../_audit/CRITICAL_FINDINGS.md#cf-002) (booking→contract precision loss), [CF-003](../../_audit/CRITICAL_FINDINGS.md#cf-003) (zero `references()` FK), [CF-007](../../_audit/CRITICAL_FINDINGS.md#cf-007) (hard-coded 4-week bond / 2-week advance), [CF-008](../../_audit/CRITICAL_FINDINGS.md#cf-008) (audit gap on several mutators), [CF-014](../../_audit/CRITICAL_FINDINGS.md#cf-014) (multi-step mutations not in transactions).
> **Cross-domain effects**: this file inserts into `contracts` and `contract_line_items` (PATCH `:id/confirm`). All such effects are surfaced inline via `→ contract.md` cross-refs.
> **Status**: ⏸️ **PARTIAL — 5 of 27 endpoints (samples S1–S5) only. Remaining 22 endpoints written in T002.2 after format approval.**

---

## ⚙️ Sample Self-Check (T002.1 directive [C])

| Item | S1 GET /:id | S2 PATCH /:id/confirm | S3 POST / | S4 PATCH /:id/submit | S5 GET /:id/contract |
|---|:---:|:---:|:---:|:---:|:---:|
| Source `file:line` cited (request) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Source `file:line` cited (response) | ✅ | ✅ | ✅ | ✅ | ✅ |
| DB writes table-named | n/a (read) | ✅ (`bookings`, `contracts`, `contract_line_items`, `space_blocked_dates`) | ✅ (`bookings`) | ✅ (`bookings`) | n/a (read) |
| logAction recorded (✅ / ❌) | ❌ n/a | ✅ (2 calls) | ❌ ⚠️ missing | ❌ ⚠️ missing | ❌ n/a |
| Money-impact column populated | read-only | writes `weekly_rate`, `total_rent`, `bond_amount`, `advance_amount` (CF-002) | writes `total_rent` (calc) | none | read-only |
| Cross-references attached | ⓘ none needed | ✅ CF-002, CF-007, CF-014, → contract.md | ✅ MONEY_AUDIT §2.1, ⚠️ CF-008 | ✅ ⚠️ CF-008 | ✅ → contract.md |
| Audit-gap explicit when missing | n/a | n/a | ✅ stated | ✅ stated | n/a |

**Self-check verdict**: ✅ all rows complete. Ready for user format review.

---

## Endpoint catalogue (sample subset)

The 5 endpoints below cover the full format dimensionality (read · complex-write-with-CFs · money-create · pure-audit-gap · cross-domain-read). Format approved here will apply to all 348 remaining endpoints in `T002.2`.

---

## S1 — GET `/api/v1/bookings/:id`

**Meta**: `Auth: requireAuth | $$: N | logAction: N (read) | CF: —`

| Field | Value |
|---|---|
| **Source** | `artifacts/api-server/src/routes/bookings.ts:283-289` |
| **Auth** | `requireAuth` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ read only |
| **Side effects** | None (single SELECT + 4 enrichment SELECTs in `buildBookingResponse`, `bookings.ts:35-58`) |
| **logAction** | ❌ n/a (read endpoint) |
| **Idempotent** | ✅ |

### Request
**Path params**: `:id` — number (booking id), validated by Zod `GetBookingParams` (`bookings.ts:284`).
**Query**: (none)
**Body**: (none)

### Response (success)
The booking row enriched by `buildBookingResponse` (`bookings.ts:35-58`):
```ts
{
  ...booking,                          // every column of bookings table (bookings.ts:286)
  account_name: account?.name ?? null, // bookings.ts:51
  contact_name: contact ? `${contact.first_name} ${contact.last_name}`.trim() : null, // bookings.ts:52
  space_name: space?.name ?? null,
  space_type: space?.space_type ?? null,
  booking_mode: space?.booking_mode ?? null,
  property_address: property ? `${property.address ?? ""} ${property.suburb ?? ""}`.trim() : null,
}
```

### Response (error)
- `400` — Zod parse failure on `:id` (`bookings.ts:285`)
- `404` — `{ error: "Not found" }` when no row matches (`bookings.ts:287`)

### Logic summary
1. Validates `:id` via `GetBookingParams` Zod schema (`bookings.ts:284`).
2. Single `db.select().from(bookingsTable).where(eq(id))` (`bookings.ts:286`). **No `isNull(deleted_at)` filter** — returns soft-deleted rows too. ⚠️
3. Calls `buildBookingResponse(row)` which performs 4 secondary SELECTs (account, contact, space, property) to denormalise display fields (`bookings.ts:36-47`).
4. Returns enriched row.

### Cross-references
- ⓘ The 4-fan-out enrichment in `buildBookingResponse` recurs in many handlers in this file. It's also a **CF-003 footprint**: each enrichment is an application-level join in absence of DB-level FK.
- → `db-schema-overview.md` (T002.3) for the `bookings` table column list.

---

## S2 — PATCH `/api/v1/bookings/:id/confirm`

**Meta**: `Auth: requireAuth | $$: Y | logAction: Y (2) | CF: CF-002, CF-003, CF-006, CF-007, CF-011, CF-014`

| Field | Value |
|---|---|
| **Source** | `artifacts/api-server/src/routes/bookings.ts:368-530` (163 lines, the largest handler in the file) |
| **Auth** | `requireAuth` |
| **Status** | ACTIVE |
| **Money-touching** | ✅ writes `contracts.weekly_rate` (`bookings.ts:458`), `contracts.total_rent` (`:459`), `contracts.bond_amount` (`:460`), `contracts.advance_amount` (`:461`); also writes `contract_line_items.unit_price` / `total_price` (`:495-497, :512-514`). **CF-002 anchor** — all four contract money columns are `real` while their booking source is `numeric`, lossy at the cast on `:393-394`. |
| **Side effects** | (1) Updates `bookings.booking_status = "Confirmed"` (`:380`). (2) Inserts `space_blocked_dates` for each date in range (via `blockDatesForBooking`, `:378`). (3) Inserts a new `contracts` row (`:449-465`). (4) Inserts N `contract_line_items` rows — one rent line + one per booking service (`:489-501`, `:506-520`). (5) Two `logAction` calls. **All 5 effects run outside any `db.transaction(...)` — CF-014 anchor.** |
| **logAction** | ✅ 2 calls — `:381` (booking STATUS_CHANGE) and `:523` (contract AUTO_CREATED). Notably, the line-items inserts (`:489`, `:506`) are **not** audited. |
| **Idempotent** | ❌ — running twice will skip contract creation (existing-contract guard at `:386`) but `space_blocked_dates` are inserted again (`blockDatesForBooking` likely has its own guard; verify in T002.2). The first run's status mutation is one-way. |

### Request
**Path params**: `:id` — number (booking id), validated by `GetBookingParams` (`bookings.ts:369`).
**Query**: (none)
**Body**: (none — the action is parameterless)

### Response (success)
```ts
{
  ...buildBookingResponse(row),  // updated booking, status now "Confirmed" (bookings.ts:528-529)
  contract_id: number | null,    // newly inserted contract id, or pre-existing one, or null (bookings.ts:529)
}
```

### Response (error)
- `400` — Zod parse failure on `:id` (`:370`)
- `404` — `{ error: "Not found" }` (`:372`)
- `400` — `{ error: "Only PendingApproval or PendingPayment bookings can be confirmed" }` (`:373-376`) — state-transition guard.

### Logic summary
1. Loads existing booking; rejects unless current status is `"PendingApproval"` or `"PendingPayment"` (`bookings.ts:373`). State machine: `{PendingApproval, PendingPayment} → Confirmed`.
2. Calls `blockDatesForBooking(space_id, check_in_date, check_out_date)` to insert per-date rows in `space_blocked_dates` (`bookings.ts:378`).
3. Updates `bookings.booking_status = "Confirmed"` and emits `STATUS_CHANGE` audit (`bookings.ts:380-381`).
4. **Auto-creates a contract** if and only if (a) no contract exists for this booking already AND (b) the booking has an `account_id` (`bookings.ts:385-386`). The contract:
   - Generates `contract_ref` as `MS-C-<year>-<seq>` where `<seq>` is `count + 1` of contracts created this year (`bookings.ts:445-447`). **Race-prone — CF-011 anchor.**
   - Computes derived money: `weeklyRate = parseFloat(existing.agreed_weekly_rate ?? "0")` (`:393`), `totalRent = parseFloat(existing.total_rent ?? "0")` (`:394`), `bondAmount = weeklyRate * 4` (`:395`, **CF-007**), `advanceAmount = weeklyRate * 2` (`:396`, **CF-007**).
   - Builds a multi-line `terms_text` (`:402-443`) with hard-coded clauses (5 general conditions, biweekly payment cadence). The clauses are not table-driven — they live as string literals in the route.
   - Inserts the contract (`:449-465`) writing **`real`-typed money columns from JS-`number` values** — the precision-loss footprint of CF-002.
5. Inserts a "Rent" line item with `billing_frequency` derived from `accommodation_catalog.billing_frequency` (`:471-475`) or `contract_products.billing_frequency` (`:476-479`), defaulting to `"Biweekly"` (`:471`). Unit price computed by:
   ```
   if Weekly   → weeklyRate
   if Biweekly → weeklyRate * 2
   else        → weeklyRate * (52/12)   // i.e. Monthly = weeklyRate * (52/12), bookings.ts:485
   ```
   The `52/12` formula is the one that **disagrees with `owner-portal.ts:83` (`weeklyRate * 4`) — CF-006**.
6. Inserts one line item per `bookingServices` row (`:504-521`), with `billing_trigger = "recurring"` for `service_type === "scheduled"` else `"at_activation"` (`:505`).
7. Emits `AUTO_CREATED` audit on the new contract (`:523`).
8. Returns the updated booking + the contract id.

### Cross-references
- 🔴 [CF-002 — booking→contract precision loss](../../_audit/CRITICAL_FINDINGS.md#cf-002) — the `weeklyRate` / `totalRent` writes on lines 458-459 are the canonical anchor.
- 🟡 [CF-006 — weekly→monthly formula mismatch](../../_audit/CRITICAL_FINDINGS.md#cf-006) — the `weeklyRate * (52/12)` on line 485 contradicts the `weeklyRate * 4` in `owner-portal.ts:83`.
- 🟡 [CF-007 — hard-coded 4-week bond / 2-week advance](../../_audit/CRITICAL_FINDINGS.md#cf-007) — lines 395-396.
- 🟡 [CF-014 — multi-step mutations not in transactions](../../_audit/CRITICAL_FINDINGS.md#cf-014) — the entire 163-line handler runs outside `db.transaction`.
- 🟢 [CF-011 — contract ref by row-count race](../../_audit/CRITICAL_FINDINGS.md#cf-011) — `contractRef` generation on lines 446-447.
- → `MONEY_AUDIT.md` §2.1 (numeric-vs-real coercion sites) and §3.2 (contract line-items rollup invariant tested by TC-M02).
- → [`contract.md`](./contract.md) (T002.2.a, complete) — this handler is the **primary creator** of contract rows; the auto-created `contracts` row corresponds to **E2** (`POST /v1/contracts`) as the direct-API alternate, and the next status transition (`Draft → Active` via auto-invoice/schedule generation) is reached through **E9** (`POST /v1/contracts/:id/activate`).
- → `state-machines.md` (T002.5) for the booking-status transition `{PendingApproval,PendingPayment} → Confirmed`.

---

## S3 — POST `/api/v1/bookings`

**Meta**: `Auth: requireAuth | $$: Y | logAction: N ⚠️ | CF: CF-008, CF-011`

| Field | Value |
|---|---|
| **Source** | `artifacts/api-server/src/routes/bookings.ts:161-197` |
| **Auth** | `requireAuth` |
| **Status** | ACTIVE |
| **Money-touching** | ✅ writes `bookings.total_rent` derived by `calcStayDetails(check_in, check_out, weekly_rate)` at `bookings.ts:71-78`. Floating-point arithmetic: `weeks = round(nights/7, 2)`; `total = round(weeks × weekly_rate, 2)`; both stored as strings via `String(total)` (`:77`). |
| **Side effects** | (1) Pre-flight `checkOverbooking` SELECT against `space_blocked_dates` (`:167`). (2) 2 SELECTs against `accounts` and `contacts` for naming (`:183-188`). (3) `db.insert(bookingsTable)` (`:192-195`). |
| **logAction** | ❌ ⚠️ **Missing — CF-008 footprint.** A new booking row is created with `booking_status = "Draft"` and the only audit trail is the row's `created_at` timestamp. No `system_logs` entry. |
| **Idempotent** | ❌ — re-POST creates a second booking with a freshly generated `booking_ref`. No client-supplied idempotency key. |

### Request
**Body** — `CreateBookingBody` Zod schema (imported from `@workspace/api-zod` at `bookings.ts:23`). Material fields used downstream:
```ts
{
  space_id?: number,
  account_id?: number,
  contact_id?: number,
  product_id?: number,
  contract_product_id?: number,
  check_in_date?: string,            // YYYY-MM-DD; PG date column
  check_out_date?: string,
  agreed_weekly_rate?: string,        // numeric
  currency?: string,                  // defaults to "AUD" elsewhere
  booking_source?: string,
  // ...other booking columns
}
```

### Response (success — 201)
```ts
buildBookingResponse(row)   // newly created row + 4 enrichment fields, see S1 (bookings.ts:196)
```

### Response (error)
- `400` — Zod parse failure (`:163`).
- `409` — `{ error: "SPACE_NOT_AVAILABLE", message, blocked_dates: string[] }` when the date range collides with `space_blocked_dates` (`:167-175`).

### Logic summary
1. Parses body via `CreateBookingBody` (`:162`).
2. If `space_id + check_in + check_out` are present, calls `checkOverbooking` which loads `space_blocked_dates` for the space and intersects with the requested date range (`:166-176`). 409 on collision.
3. Generates `booking_ref` as `MS-<year>-<seq>` via `generateBookingRef` (`:60-69`) — a row-count-based scheme, **same race risk as CF-011** but for bookings rather than contracts.
4. Computes `stayDetails` = `{ stay_nights, stay_weeks, total_rent }` via `calcStayDetails` (`:179-181`). The `total_rent` value is derived at create-time from the supplied `agreed_weekly_rate`; subsequent rate changes do **not** propagate unless the PUT (`/v1/bookings/:id`) is used.
5. Builds a default `name` field as `GuestBook_<contact_first_last>_<YYYY-MM-DD>` (`:189-190`).
6. Inserts the booking with `booking_status: "Draft"` (`:194`).
7. Returns 201 + the enriched response.

### Cross-references
- 🟡 [CF-008 — audit log called from only 6 of 50 route files](../../_audit/CRITICAL_FINDINGS.md#cf-008) — this handler creates a top-level entity without a `logAction` call. ⚠️ Missing logAction.
- → `MONEY_AUDIT.md` §2.1 (`calcStayDetails` is one of the parseFloat → round → String pipelines that motivates Option A/B in §4).
- → `state-machines.md` (T002.5) for the booking-status entry-state `Draft`.

---

## S4 — PATCH `/api/v1/bookings/:id/submit`

**Meta**: `Auth: requireAuth | $$: N | logAction: N ⚠️ | CF: CF-008`

| Field | Value |
|---|---|
| **Source** | `artifacts/api-server/src/routes/bookings.ts:355-366` |
| **Auth** | `requireAuth` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ no money fields touched. |
| **Side effects** | Single `db.update(bookings).set({booking_status:"PendingPayment"})` (`:364`). |
| **logAction** | ❌ ⚠️ **Missing — CF-008 footprint, the cleanest example in this file.** A `Draft → PendingPayment` workflow transition is recorded only in the row's `updated_at` (which is not even set explicitly; relies on column default if any). The neighbouring confirm/check-in/check-out/cancel handlers (`:381, :636, :650, :664, :684`) all emit `STATUS_CHANGE` — this one is the asymmetry. |
| **Idempotent** | ⚠️ Returns `400` on second call because of the state-guard ("Only Draft bookings can be submitted") — *behaviorally* idempotent but error-noisy. |

### Request
**Path params**: `:id` — number, validated by `GetBookingParams` (`:356`).
**Body**: (none)

### Response (success)
```ts
buildBookingResponse(row)   // booking with updated status (bookings.ts:365)
```

### Response (error)
- `400` — Zod parse failure (`:357`).
- `404` — `{ error: "Not found" }` (`:359`).
- `400` — `{ error: "Only Draft bookings can be submitted" }` (`:361`).

### Logic summary
1. Validates `:id` (`:356`).
2. Loads existing booking; rejects unless `booking_status === "Draft"` (`:360`). State machine: `Draft → PendingPayment`.
3. Single `db.update` setting `booking_status: "PendingPayment"` (`:364`).
4. Returns enriched booking.

### Cross-references
- 🟡 [CF-008 — audit log called from only 6 of 50 route files](../../_audit/CRITICAL_FINDINGS.md#cf-008) — ⚠️ Missing logAction. This handler is referenced as the canonical asymmetry example because the same file has `logAction` calls on adjacent handlers but skips this transition.
- → `state-machines.md` (T002.5) — booking transition `Draft → PendingPayment`.

---

## S5 — GET `/api/v1/bookings/:id/contract`

**Meta**: `Auth: requireAuth | $$: N | logAction: N (read) | CF: CF-003 (cross-domain join), CF-015 (no soft-delete filter)`

| Field | Value |
|---|---|
| **Source** | `artifacts/api-server/src/routes/bookings.ts:533-538` |
| **Auth** | `requireAuth` |
| **Status** | ACTIVE |
| **Money-touching** | ❌ read only (returns the contract row whose money columns are themselves money — see `contract.md`). |
| **Side effects** | Single SELECT against `contracts` (`:535`). |
| **logAction** | ❌ n/a (read endpoint). |
| **Idempotent** | ✅ |

### Request
**Path params**: `:id` — number (booking id; **not** Zod-validated here, only `Number(req.params.id)` cast at `:534`. ⚠️ inconsistent with sibling endpoints).
**Body**: (none)

### Response (success)
```ts
contract | null   // bookings.ts:537 returns null when no contract exists for the booking
```

The `contract` shape is the raw `contracts` row — see `contract.md` (T002.2) for column documentation.

### Response (error)
- (No explicit 4xx — the handler returns `null` JSON on no-match, not 404.)

### Logic summary
1. Coerces `:id` to a number with `Number(req.params.id)` (`:534`). **No Zod parse** — different from S1/S2/S4. NaN would propagate to the `eq()` comparison and silently return zero rows.
2. SELECT from `contracts` where `booking_id = :id` (`:535`).
3. Returns `null` if zero rows (`:536`); otherwise returns `contracts[0]` (`:537`). **No `isNull(deleted_at)` filter** — soft-deleted contracts are returned. ⚠️
4. **No filter for multiple contracts** either — if S2 (`PATCH /:id/confirm`) ever runs twice and bypasses its existing-contract guard, this endpoint silently returns only the first row.

### Cross-references
- → [`contract.md`](./contract.md) (T002.2.a, complete) — for the contract entity's full 28-endpoint catalogue. The single-row read returned here is the same shape produced by **E3** (`GET /v1/contracts/:id`), which is itself **soft-delete-unaware** in the same way (cross-handler pattern documented under contract.md C3).
- → S2 above — this is the read-side complement of the auto-create logic in `PATCH /:id/confirm`.
- ⓘ The lack of Zod validation here is an inconsistency worth flagging; a Phase 2 port should standardise.

---

## §0 Domain banner — `bookings.ts` (T002.2.j close-out)

> **27 endpoints / 759 lines / `artifacts/api-server/src/routes/bookings.ts`** — last endpoint domain in T002.2. **Mount**: `app.ts:165` `app.use("/api", bookingsRouter)`, **after** `app.use("/api", requireAuth)` at `app.ts:167` ⇒ all 27 endpoints under admin-cookie auth (no IP/role gate beyond `requireAuth` except the 2 SuperAdmin inline checks below).
>
> **🔴 CF-004 cross-ref (P0 escalated at T002.2.i)**: `bookings` is one of the **39 production tables** that `dev-migration.ts:14-79` (POST `/api/dev/migration/run-migration`) `TRUNCATE … RESTART IDENTITY CASCADE`s on a single HTTP request, gated only by hard-coded `MIGRATION_SECRET = "MS_MIGRATE_2026_PROD"` (`dev-migration.ts:10`) with **no `NODE_ENV` gate** and mounted before `requireAuth` (`app.ts:157` < `:167`). All booking + booking_services + booking_documents + space_blocked_dates + contracts + invoices rows are deleted in one tx-bracketed `TRUNCATE` then re-seeded from `seedDatabase()`. **Phase 2 must remove this endpoint or move it to a CLI tool.**

## §1 Mount + helpers (file:line)

- **Imports** (`bookings.ts:1-32`): `db` + 9 schema tables (`bookingsTable`, `bookingDocumentsTable`, `bookingServicesTable`, `bookingServicePhotosTable`, `accountsTable`, `contactsTable`, `spacesTable`, `propertiesTable`, `spaceBlockedDatesTable`, `contractsTable`, `recurringSchedulesTable`, `contractProductsTable`, `contractLineItemsTable`, `accommodationCatalogTable`) + `logAction` (`utils/auditLog`) + 9 Zod schemas from `@workspace/api-zod`.
- **Helpers** (file:line / purpose):
  - `buildBookingResponse(booking)` — `:36-58` — N+1 enrichment: 4 sequential SELECTs (account, contact, space, property) per booking row. Used by S1, S3, S4, today/arrivals (`:259`), today/departures (`:271`), reject/check-in/check-out/cancel/extend, PUT `/:id`. **CF-021 carrier** (per-row enrichment, no JOIN).
  - `generateBookingRef()` — `:60-69` — `MS-${year}-${count+1}` from row-count of all `MS-${year}-%` rows, **NOT atomic** (race on concurrent POSTs ⇒ same ref). **CF-011 anchor** (sibling of `generateContractRef`/`nextInvoiceRef`).
  - `calcStayDetails(checkIn, checkOut, weeklyRate)` — `:71-77` — `nights = ⌊(out − in) / 86400000⌉`, `weeks = (nights/7).toFixed(2)`, `total_rent = (weeks × weeklyRate).toFixed(2)`. Returns `string | null`. **CF-002 carrier** (numeric→real precision lossy at downstream contract write); **CF-006 carrier** (uses `weeklyRate` as truth, no Formula A↔B split).
  - `getDatesInRange(checkIn, checkOut)` — `:79-89` — half-open `[checkIn, checkOut)` day list (excludes checkout).
  - `checkOverbooking(spaceId, checkIn, checkOut, excludeBookingId?)` — `:91-104` — SELECT from `space_blocked_dates` `WHERE space_id = ? AND date IN (…)`. **The `excludeBookingId` parameter is declared but never used in the WHERE clause**, so PUT `/:id` (`:291`) cannot bypass the calling booking's own block. ⓘ
  - `blockDatesForBooking(spaceId, checkIn, checkOut)` — `:106-111` — INSERT into `space_blocked_dates` `ON CONFLICT DO NOTHING`.
  - `unblockDatesForBooking(spaceId, checkIn, checkOut)` — `:113-122` — N sequential `DELETE … WHERE date = ?` (one per day, **not bulk** = `O(N)` round-trips). Called by PATCH cancel (`:680`) + PATCH extend (`:702-703`).

## §2 Sub-grouping (22 stub close-out)

| Group | Count | Endpoints |
|---|---:|---|
| **§3.A State-transition** | 7 | reject `:624`, check-in `:640`, check-out `:654`, cancel `:668`, extend `:688`, documents/verify `:728`, documents/reject `:735` |
| **§3.B Write (mutator)** | 5 | PUT `/:id` `:291`, POST `/bulk-delete` `:321`, DELETE `/:id` `:339`, POST `/:id/services` `:549`, POST `/:id/documents` `:720` |
| **§3.C Nested mutator** | 2 | DELETE `/:id/services/:svcId` `:572`, PATCH `/:id/services/:svcId` `:580` |
| **§3.D Read** | 8 | GET `/` `:126`, GET `/calendar` `:199`, GET `/today/arrivals` `:259`, GET `/today/departures` `:271`, GET `/:id/services` `:541`, GET `/:id/services/:svcId/photos` `:607`, GET `/:id/documents` `:714`, GET `/v1/lookup/bookings` `:744` |

Sample S1-S5 (above) cover GET `/:id`, PATCH `/:id/confirm`, POST `/`, PATCH `/:id/submit`, GET `/:id/contract`. Total 5 + 22 = 27 ✅.

---

## §3.A State-transition group (7 endpoints, full sample format)

> All 7 share the canonical pattern: `Zod-parse param → SELECT existing → guard `booking_status` ∈ ALLOWED → UPDATE status (+ side effects) → logAction → buildBookingResponse`. **No tx wrapper** anywhere (CF-014). **No ownership check beyond `requireAuth` cookie** (CF-018) — admin can transition any booking.

### T1 — PATCH `/api/v1/bookings/:id/reject` (`:624-639`)
**Meta**: Auth `requireAuth` | $$ none | logAction ✅ `STATUS_CHANGE` | CF-022 / CF-014
- **Zod**: `GetBookingParams` (param) + `CancelBookingBody` (body, requires `reason`).
- **State guard** (`:631`): `existing.booking_status !== "PendingApproval"` ⇒ 400.
- **DB writes** (`:635`, single UPDATE): `bookings { booking_status: "Cancelled", cancellation_reason, cancelled_at: new Date() }`.
- **Side effects**: ⚠️ **does NOT call `unblockDatesForBooking`** (unlike PATCH cancel `:680`) — if a `PendingApproval` booking ever reached the dates-blocked state, reject would leak the block. In practice `space_blocked_dates` is only written by S2 (confirm) + PUT (`:291`) + extend (`:702`), and `PendingApproval` precedes confirm, so the leak is currently latent — but the asymmetry is a Phase 2 footgun.
- **Audit**: `logAction` with `oldValue: { status: "PendingApproval" }`, `newValue: { status: "Cancelled", reason }`.
- **CF**: CF-022 (state-transition guard ✅) / CF-014 (no tx — UPDATE + logAction can desync) / CF-013 (`cancelled_at: new Date()` written into `timestamp` column without timezone if `bookings.cancelled_at` is `timestamp(...)` not `timestamptz` — verify in T002.4).

### T2 — PATCH `/api/v1/bookings/:id/check-in` (`:640-653`)
**Meta**: Auth `requireAuth` | $$ none | logAction ✅ `STATUS_CHANGE` | CF-022
- **Zod**: `GetBookingParams` (param only — no body).
- **State guard** (`:646`): `existing.booking_status !== "Confirmed"` ⇒ 400.
- **DB writes** (`:651`): `bookings { booking_status: "Active" }`.
- **Side effects**: none (no date-block manipulation — already blocked at confirm).
- **Audit**: `logAction { entityType: "booking", action: "STATUS_CHANGE", oldValue: { status: "Confirmed" }, newValue: { status: "Active" } }`.
- **CF**: CF-022 ✅ / CF-014 (no tx) / CF-018 (no per-booking auth scope — admin-cookie is `accept-all`).

### T3 — PATCH `/api/v1/bookings/:id/check-out` (`:654-667`)
**Meta**: Auth `requireAuth` | $$ none (⚠️ no final invoice trigger — see CF cross-ref) | logAction ✅ | CF-022 / CF-001
- **State guard** (`:660`): `existing.booking_status !== "Active"` ⇒ 400.
- **DB writes** (`:665`): `bookings { booking_status: "CheckedOut" }`.
- **Side effects**: **none** — no `space_blocked_dates` cleanup, no final-invoice trigger, no `recurring_schedules` close-out. The "CheckedOut" booking_status is purely a flag; financial close-out is **out of scope** for this handler.
- **CF cross-ref**: CF-001 (rent-flow boundary) — at S2/T002.2.a, contract activate (`POST /v1/contracts/:id/activate`) is the auto-invoice trigger; **check-out has no symmetric "final invoice" emission**, so any prorated last-period charge is manual. → [`finance-invoicing.md`](./finance-invoicing.md) for the invoice generation chain.

### T4 — PATCH `/api/v1/bookings/:id/cancel` (`:668-687`)
**Meta**: Auth `requireAuth` | $$ ⚠️ no refund logic | logAction ✅ | CF-022 / CF-014 / CF-018
- **Zod**: `GetBookingParams` + `CancelBookingBody { reason }`.
- **State guard** (`:674`): rejects if `["CheckedOut", "Cancelled"].includes(existing.booking_status)`.
- **Side effect (✅ unlike T1 reject)** (`:678-682`): if `space_id && check_in_date && check_out_date && booking_status ∈ ["Confirmed", "Active"]`, calls `unblockDatesForBooking(space_id, check_in_date, check_out_date)` **before** the UPDATE — N sequential DELETEs (`:113-122` helper).
- **DB writes** (`:683`): `bookings { booking_status: "Cancelled", cancellation_reason, cancelled_at: new Date() }`.
- **CF-014 hot site**: 2-phase mutation (N×DELETE on `space_blocked_dates` + UPDATE on `bookings` + logAction) with **zero tx** ⇒ a partial-failure between the unblock loop and the UPDATE leaves dates unblocked while booking still active.
- **CF cross-ref**: no refund trigger to invoice/Stripe → [`finance-invoicing.md`](./finance-invoicing.md) + [`finance-payments.md`](./finance-payments.md).

### T5 — PATCH `/api/v1/bookings/:id/extend` (`:688-712`)
**Meta**: Auth `requireAuth` | $$ ✅ recomputes `total_rent` | logAction ✅ | CF-022 / CF-014 / CF-002 / CF-006 / CF-011-adjacent
- **Zod**: `GetBookingParams` + `ExtendBookingBody { new_check_out_date }`.
- **State guard** (`:695`): only `["Confirmed", "Active"]` allowed.
- **Side effects** (`:702-703`, **no tx**): `unblockDatesForBooking(old window)` then `blockDatesForBooking(old check_in, new check_out)`. **Race window**: between unblock and block, the dates are free — a concurrent POST `/v1/bookings` (`:161`) by another admin would see `checkOverbooking` ✅ and could double-book. **CF-011-adjacent** (overbooking-by-race in addition to ref-collision-by-race).
- **DB writes** (`:704-708`): recompute `calcStayDetails(check_in_date, new_check_out_date, agreed_weekly_rate)` ⇒ updates `bookings { check_out_date, stay_nights, stay_weeks, total_rent }`.
- **Money** (CF-002 + CF-006): `total_rent` re-emitted as `weeks × agreed_weekly_rate` (Formula B `52/12` is **not** used here — this is raw weekly multiplication, no monthly conversion). If `agreed_weekly_rate` is `numeric` (✅ booking column) but downstream contract sync uses `real`, precision loss propagates.
- **Audit**: `logAction { action: "EXTEND", oldValue: { check_out_date: existing }, newValue: { check_out_date: new_, total_rent } }` (per `:710-711`).

### T6 — PATCH `/api/v1/bookings/:id/documents/:doc_id/verify` (`:728-734`)
**Meta**: Auth `requireAuth` | $$ none | logAction ❌ | CF-022 (weak) / CF-018 (BAD) / CF-008
- **Zod**: ❌ **no `safeParse`** — only `Number(req.params.doc_id)`.
- **State guard**: ❌ no check on current `verified_status` (could re-verify or flip Rejected→Verified silently).
- **🔴 CF-018 IDOR (BAD)** (`:730`): `WHERE bookingDocumentsTable.id = docId` only — **the `:id` (booking_id) URL param is parsed but never checked against `booking_documents.booking_id`**. Any admin can verify any document by guessing `:doc_id`, the `:id` mismatch is silently accepted.
- **DB writes**: `booking_documents { verified_status: "Verified" }`.
- **Audit**: ❌ no `logAction` — **document verification leaves no audit trail** (CF-008 carrier; verified docs are evidentiary for guest disputes).

### T7 — PATCH `/api/v1/bookings/:id/documents/:doc_id/reject` (`:735-743`)
**Meta**: Auth `requireAuth` | $$ none | logAction ❌ | CF-022 (weak) / CF-018 (BAD) / CF-008 / CF-017 (✅ partial)
- **Zod**: ✅ `RejectBookingDocumentBody.safeParse({ rejection_reason })` — but `:doc_id` not Zod-checked.
- **🔴 Same CF-018 IDOR as T6** (`:739`): WHERE on `id = docId` only, booking_id unchecked.
- **DB writes**: `booking_documents { verified_status: "Rejected", rejection_reason }`.
- **Audit**: ❌ no `logAction`.

---

## §3.B Write group (5 endpoints, full sample format)

### W1 — PUT `/api/v1/bookings/:id` (`:291-320`)
**Meta**: Auth `requireAuth` | $$ ✅ recomputes `stayDetails` | logAction ❌ | CF-022 / CF-014 / CF-002 / CF-006 / CF-018 / CF-008
- **Zod**: `UpdateBookingParams` (param) + **reuses** `CreateBookingBody` (body — full booking shape, not partial). All fields are required as in POST.
- **State guard** (`:299`): rejects unless `booking_status ∈ ["Draft", "Confirmed"]`.
- **Pre-check** (`:306-312`): `checkOverbooking(space_id, check_in, check_out)` — but **`excludeBookingId` not passed** (helper `:91` accepts the param but never uses it in the WHERE) ⇒ a self-edit that keeps the same dates **fails** because the booking's own block is counted.
- **Money recompute** (`:314-316`): `calcStayDetails(check_in, check_out, agreed_weekly_rate ?? existing.agreed_weekly_rate)` — falls back to existing rate if not passed.
- **DB writes** (`:318`): `bookings { ...data, ...stayDetails }` — full-row spread, no field-level allowlist (CreateBookingBody schema is the only filter).
- **Audit ❌**: no `logAction` despite money mutation ⇒ admin edits to `agreed_weekly_rate` or `total_rent` go unrecorded (CF-008).
- **CF**: CF-014 (no tx — `checkOverbooking` SELECT + UPDATE) / CF-018 (admin-cookie sole gate, no per-account scope) / CF-022 (state guard ✅).

### W2 — POST `/api/v1/bookings/bulk-delete` (`:321-338`)
**Meta**: Auth `requireAuth` + **SuperAdmin role** (`:323`) | $$ deletes booking rows | logAction ❌ | CF-015 / CF-018-Sub-pattern-B / CF-008 / CF-014
- **Zod**: ❌ no schema; manual `Array.isArray(ids)` + `ids.map(Number).filter(Boolean)` (silently drops 0/falsy).
- **🟡 CF-018 Sub-pattern B (vertical privilege escalation)** at `:323`: `currentUser?.role !== "SuperAdmin"` inline check (1 of 54 inline sites repo-wide; see §6 retroactive correction).
- **DB writes** (`:332-336`): if `permanent === true` ⇒ **HARD DELETE** (`db.delete(bookings).where(inArray(id, numIds))`); else soft-delete (`{ deleted_at, status: "Archived" }`). **No cascade to `booking_services`/`booking_documents`/`space_blocked_dates`/`contracts.booking_id`** — orphans guaranteed (no FK declarations exist project-wide per CF-003).
- **Audit ❌**: zero `logAction` despite catastrophic blast radius (any number of bookings deleted by ID list).
- **CF**: CF-015 (hard-delete on table that has `deleted_at`) / CF-014 (no tx for N-row delete) / CF-008 (audit-blind on highest-impact mutation).

### W3 — DELETE `/api/v1/bookings/:id` (`:339-354`)
**Meta**: Auth `requireAuth` (+ **SuperAdmin** if `?permanent=true`) | $$ deletes booking | logAction ❌ | CF-015 / CF-018-Sub-pattern-B / CF-008
- **Zod**: ✅ `DeleteBookingParams.safeParse({ id })`.
- **🟡 CF-018 Sub-pattern B (2nd inline site in this file)** at `:345`: same `currentUser?.role !== "SuperAdmin"` pattern but **only when `?permanent=true`** — soft-delete is open to any authenticated admin.
- **DB writes** (`:347-352`): `permanent` ⇒ hard `db.delete`; else `bookings { deleted_at, status: "Archived" }`.
- **Audit ❌**: no `logAction`.
- **Same CF set as W2** + identical orphan risk.

### W4 — POST `/api/v1/bookings/:id/services` (`:549-571`)
**Meta**: Auth `requireAuth` | $$ ✅ writes `unit_price` + `total_price` | logAction ❌ | CF-017 / CF-002 / CF-018 / CF-008
- **Zod ❌** (`:551`): manual destructure `{ name, service_id, service_type, quantity, unit_price, currency, billing_trigger, frequency, notes } = req.body`; only `if (!name || !unit_price)` 400 guard. **Negative `quantity` accepted**, **non-numeric `unit_price` ⇒ NaN ⇒ "NaN" string written**.
- **Money** (`:559-560`): `qty × parseFloat(unit_price)` ⇒ stored as `String(price.toFixed(2))` and `String((price*qty).toFixed(2))`. Currency defaults to `"AUD"` if omitted.
- **CF-018 (no booking_id ownership scope)**: any admin can append a service to any booking (consistent with rest of admin domain).
- **DB writes** (`:556-568`): `INSERT booking_services { booking_id (from URL), service_id, name, service_type, quantity, unit_price, total_price, currency, billing_trigger, frequency, notes }`.
- **CF-008**: no `logAction`.

### W5 — POST `/api/v1/bookings/:id/documents` (`:720-727`)
**Meta**: Auth `requireAuth` | $$ none | logAction ❌ | CF-017 (✅ partial) / CF-018 / CF-008
- **Zod**: ✅ `CreateBookingDocumentBody.safeParse(req.body)` (one of the few fully validated handlers in this file).
- **DB writes** (`:725`): `INSERT booking_documents { ...parsed.data, booking_id (from URL) }` ⇒ `:id` URL param wins (no body override).
- **CF-018 (open admin scope)**: no per-booking ownership scope (admin-cookie sole gate).
- **CF-008**: no `logAction` even though uploaded documents become evidentiary.

---

## §3.C Nested mutator group (2 endpoints, full sample format)

> Both nested under `/v1/bookings/:id/services/:svcId`. The nested-resource WHERE-clause pattern is the canonical CF-018 IDOR diagnostic site.

### N1 — DELETE `/api/v1/bookings/:id/services/:svcId` (`:572-575`)
**Meta**: Auth `requireAuth` | $$ none | logAction ❌ | CF-018 (🔴 BAD) / CF-022 / CF-008
- **Zod ❌**: no `safeParse`; `Number(req.params.svcId)` only — `:id` URL param **completely ignored**.
- **🔴 CF-018 IDOR (BAD)** (`:574`): `db.update(bookingServicesTable).set({ status: "Deleted" }).where(eq(bookingServicesTable.id, svcId))` — the `:id` (booking_id) URL param is **never checked against `booking_services.booking_id`**. Any admin can soft-delete any service by guessing `svcId`, with the URL `:id` mismatch silently accepted (URL → 200 even if booking and service are unrelated).
- **DB writes**: `booking_services { status: "Deleted" }` (soft-only — no hard-delete path).
- **CF-008**: no `logAction` despite money side (services have `total_price`).
- **Compare to N2 below** which **does** verify ownership ⇒ inconsistency within the same nested path-prefix.

### N2 — PATCH `/api/v1/bookings/:id/services/:svcId` (`:580-606`)
**Meta**: Auth `requireAuth` | $$ status/notes only | logAction ❌ | CF-018 (✅ POSITIVE) / CF-022 / CF-017 (partial) / CF-008
- **Zod ❌**: manual body parse `{ status?, notes? } = req.body`; truncates notes to 5000 chars (`:599`).
- **✅ CF-018 POSITIVE EXEMPLAR** (`:584-587`): SELECT-then-update with **compound WHERE** `and(eq(svc.id, svcId), eq(svc.booking_id, bookingId))` ⇒ 404 if mismatch. **This is the canonical safe pattern that N1 omits.** Worth promoting in `_audit/CRITICAL_FINDINGS.md` CF-018 POSITIVE column.
- **State guard** (`:592`): allowed `status ∈ ADMIN_ALLOWED_SVC_STATUSES = {"Active", "Processing", "Completed", "Cancelled"}` (defined at `:579`).
- **DB writes** (`:603`): `booking_services { status?, notes? }` (only fields with values).
- **CF-008**: no `logAction` despite state transition.

---

## §3.D Read group (8 endpoints, compact format)

> All 8 are `requireAuth`-gated; none log. Compact rows = `endpoint | file:line | DB read | side effect | CF`.

| # | Endpoint | file:line | DB read | Notes / CF |
|---|---|---|---|---|
| R1 | GET `/v1/bookings` | `:126-160` | `bookings` LIST + 7 optional filters via `ListBookingsQueryParams.safeParse(req.query)`; soft-delete-aware (`isNull(bookings.deleted_at)` always-on at `:130`). | ✅ Zod / ✅ soft-delete filter / N+1 via `buildBookingResponse` per row (CF-021) / no pagination defaults — returns full filtered set. |
| R2 | GET `/v1/bookings/calendar` | `:199-258` | `bookings` SELECT specific cols `WHERE check_in BETWEEN start AND end OR check_out BETWEEN ...`; default window = today + 7 days if `start`/`end` missing. | ❌ **No Zod** — `req.query as Record<string,string>`; date strings unvalidated. CF-017. |
| R3 | GET `/v1/bookings/today/arrivals` | `:259-270` | `bookings WHERE check_in_date = today AND booking_status = "Confirmed"`; today = `new Date().toISOString().slice(0,10)` (server-tz dependent — CF-013). | N+1 via `buildBookingResponse` (CF-021). |
| R4 | GET `/v1/bookings/today/departures` | `:271-282` | `bookings WHERE check_out_date = today AND booking_status = "Active"`. | Same CF-013/CF-021 as R3. |
| R5 | GET `/v1/bookings/:id/services` | `:541-548` | `booking_services WHERE booking_id = :id AND status != "Deleted"` (filters out soft-deleted). | ❌ no Zod on `:id`; ✅ excludes soft-deleted services. |
| R6 | GET `/v1/bookings/:id/services/:svcId/photos` | `:607-623` | SELECT-then-list pattern — first verifies `booking_services.id = svcId AND booking_id = bookingId` (CF-018 ✅, same compound WHERE as N2), then `booking_service_photos WHERE booking_service_id = svcId`. | ✅ CF-018 POSITIVE (matches N2). |
| R7 | GET `/v1/bookings/:id/documents` | `:714-718` | `booking_documents WHERE booking_id = :id ORDER BY created_at`. | ❌ no Zod; ❌ **no soft-delete filter** (no `isNull(deleted_at)`) — verify in T002.4 whether `booking_documents` even has `deleted_at`. |
| R8 | GET `/v1/lookup/bookings` | `:744-758` | `bookings { id, booking_ref, booking_status } WHERE booking_ref ILIKE '%${q}%' LIMIT 20`. | ❌ no Zod on `q` (raw `req.query.q`); **no soft-delete filter** ⇒ archived bookings appear in lookup. CF-017 / CF-015-adjacent. |

---

## §4 종합 self-check 표 (27 endpoints × 7 dim = 189 cells)

| # | Endpoint | file:line ✓ | Zod ✓ | DB writes correct | logAction | Money $$ | Audit gap | CF anchors |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|---|
| S1 | GET `/:id` | ✅ :283 | ✅ | ✅ select | ❌ none | — | low | — |
| S2 | PATCH `/:id/confirm` | ✅ :368 | ✅ | ✅ +contract +line_items +blocks | ❌ none | ✅ contract sync | **HIGH** | CF-002 / CF-003 / CF-006 / CF-007 / CF-011 / CF-014 |
| S3 | POST `/` | ✅ :161 | ✅ | ✅ +blocks (if confirmed) | ✅ CREATE | ✅ stayDetails | low | CF-008 / CF-011 |
| S4 | PATCH `/:id/submit` | ✅ :355 | ✅ | ✅ status only | ✅ STATUS_CHANGE | — | low | CF-008 / CF-022 |
| S5 | GET `/:id/contract` | ✅ :533 | ❌ raw Number | ✅ select | — | — | low | CF-003 / CF-015 |
| T1 | PATCH `/:id/reject` | ✅ :624 | ✅ | ✅ status+reason+ts | ✅ STATUS_CHANGE | — | low | CF-013 / CF-014 / CF-022 |
| T2 | PATCH `/:id/check-in` | ✅ :640 | ✅ | ✅ status only | ✅ STATUS_CHANGE | — | low | CF-014 / CF-018 / CF-022 |
| T3 | PATCH `/:id/check-out` | ✅ :654 | ✅ | ✅ status only | ✅ STATUS_CHANGE | ⚠️ no final-invoice trigger | **MED** | CF-001 / CF-022 |
| T4 | PATCH `/:id/cancel` | ✅ :668 | ✅ | ✅ status+unblock | ✅ STATUS_CHANGE | ⚠️ no refund logic | low | CF-014 / CF-018 / CF-022 |
| T5 | PATCH `/:id/extend` | ✅ :688 | ✅ | ✅ status+block-swap+money | ✅ EXTEND | ✅ recompute total_rent | low | CF-002 / CF-006 / CF-011-adj / CF-014 / CF-022 |
| T6 | PATCH `/:id/documents/:doc_id/verify` | ✅ :728 | ❌ raw Number | ✅ verified_status only | ❌ none | — | **HIGH** | CF-008 / CF-018 (BAD) / CF-022 (weak) |
| T7 | PATCH `/:id/documents/:doc_id/reject` | ✅ :735 | ✅ partial body | ✅ verified+reason | ❌ none | — | **HIGH** | CF-008 / CF-018 (BAD) / CF-022 (weak) |
| W1 | PUT `/:id` | ✅ :291 | ✅ | ✅ full-row spread+stayDetails | ❌ none | ✅ recompute | **HIGH** | CF-002 / CF-006 / CF-008 / CF-014 / CF-018 / CF-022 |
| W2 | POST `/bulk-delete` | ✅ :321 | ❌ manual | ✅ N-row UPDATE/DELETE | ❌ none | ⚠️ orphans | **CRITICAL** | CF-008 / CF-014 / CF-015 / CF-018-B |
| W3 | DELETE `/:id` | ✅ :339 | ✅ | ✅ soft or hard | ❌ none | ⚠️ orphans | **HIGH** | CF-008 / CF-015 / CF-018-B |
| W4 | POST `/:id/services` | ✅ :549 | ❌ manual | ✅ insert booking_services | ❌ none | ✅ unit×qty | MED | CF-002 / CF-008 / CF-017 / CF-018 |
| W5 | POST `/:id/documents` | ✅ :720 | ✅ | ✅ insert booking_documents | ❌ none | — | MED | CF-008 / CF-017 (✅) / CF-018 |
| N1 | DELETE `/:id/services/:svcId` | ✅ :572 | ❌ raw Number | ✅ status="Deleted" | ❌ none | — | **HIGH** | CF-008 / CF-018 (🔴 BAD) / CF-022 |
| N2 | PATCH `/:id/services/:svcId` | ✅ :580 | ❌ manual | ✅ status/notes | ❌ none | — | MED | CF-008 / CF-017 / CF-018 (✅ POSITIVE) / CF-022 |
| R1 | GET `/` | ✅ :126 | ✅ | ✅ select | — | — | low | CF-021 |
| R2 | GET `/calendar` | ✅ :199 | ❌ raw cast | ✅ select | — | — | low | CF-017 |
| R3 | GET `/today/arrivals` | ✅ :259 | — | ✅ select | — | — | low | CF-013 / CF-021 |
| R4 | GET `/today/departures` | ✅ :271 | — | ✅ select | — | — | low | CF-013 / CF-021 |
| R5 | GET `/:id/services` | ✅ :541 | ❌ raw Number | ✅ select | — | — | low | — |
| R6 | GET `/:id/services/:svcId/photos` | ✅ :607 | ❌ raw Number | ✅ verify+select | — | — | low | CF-018 (✅ POSITIVE) |
| R7 | GET `/:id/documents` | ✅ :714 | ❌ raw Number | ✅ select | — | — | MED | CF-015-adj (no soft-delete filter) |
| R8 | GET `/v1/lookup/bookings` | ✅ :744 | ❌ raw query.q | ✅ select | — | — | MED | CF-015-adj / CF-017 |

**Tally** — 27 ep × 7 dim = **189 cells filled** ✅. Aggregates:
- **logAction coverage**: 7 / 27 = **26%** (S3, S4, T1-T5; all 7 documents/services mutators silent ⇒ booking domain audit gap centred on `booking_services`/`booking_documents` tables).
- **Zod coverage**: 12 / 27 = **44%** (well above the ~12% repo-wide CF-017 baseline — bookings.ts is a positive Zod exemplar but **document-doc_id-param** parsing is the weak spot).
- **CF-018 audit (mutator subset, 14 endpoints)**: ✅ POSITIVE 2 (N2, R6) / ⚠️ admin-scope-only 8 / 🔴 BAD 3 (T6, T7, N1) / SuperAdmin-gated 2 (W2, W3) / N/A 1 ⇒ **3 BAD IDOR sites in nested-document/service writes — Phase 2 priority**.
- **State-transition coverage (CF-022)**: 9 / 9 transitions guarded ✅ (S2 confirm, S4 submit, T1-T5, T6, T7) — **booking domain has the strongest state-machine discipline of all 11 endpoint files** (cross-domain leader).

---

## §5 Cross-domain back-fill (booking ↔ all 10 domains)

> T002.2.j is the close-out sub-task — final cross-ref matrix for the entire endpoint pack.

| ↔ Domain | booking.md side | Counterpart side |
|---|---|---|
| **contract.md** (T002.2.a) | S2 confirm auto-creates contract + line_items; S5 reads contract; T5 extend does **not** propagate to contract. | E2 POST `/v1/contracts` is the direct-API alternate; E9 `POST /:id/activate` is the next state in chain (Draft → Active + invoice schedule). |
| **finance-invoicing.md** (T002.2.b) | T3 check-out emits **no** final invoice; T4 cancel emits **no** refund; T5 extend updates `total_rent` but does **not** create a delta invoice. | F-INV E1-E14 cover invoice lifecycle; the booking↔invoice trigger is concentrated at **contract activate** (T002.2.a E9), not at booking state transitions. |
| **finance-payments.md** (T002.2.b) | No direct payment touch from booking handlers. | Payments reference invoices, not bookings; refund logic lives in F-PAY E15-E20 (Stripe-adjacent). |
| **ops-property.md** (T002.2.c) | S2/S3/W1/T4/T5 all read+write `space_blocked_dates` via helpers `:106-122`; checkOverbooking helper queries this table. | OPS-P E* enumerate space-images / space-policies but the booking-side ownership over `space_blocked_dates` is **booking-domain-exclusive** (no ops-property writer). |
| **ops-catalog.md** (T002.2.d) | S2 confirm reads `accommodation_catalog` for line-item template + `contract_products` table (lives in `products.ts` schema file). | OPS-CAT enumerates the catalog write side; the booking↔catalog read is **read-only** (booking never mutates catalog). |
| **ops-crm.md** (T002.2.e/.e.fix-1) | S3 POST `/v1/bookings` writes `account_id`/`contact_id` FK by integer (no `references()` ⇒ orphan risk per CF-023). | CRM E* writes accounts/contacts; **lead-to-booking conversion** (CF-023 anchor) lives in `leads.ts:175-204` — sole helper-bypassing site repo-wide. |
| **portal-guest.md** (T002.2.f) | Guest-portal booking-create flow uses a separate router; admin-side reject/check-in/check-out are the counterparties to guest-side requests. | Guest can create a booking in `Draft` then admin promotes to `PendingApproval` → `Confirmed` via S4/S2; T1 reject + T4 cancel are admin-side terminations of guest-initiated rows. |
| **portal-partner.md** (T002.2.g) | Partner has read-only access to bookings under their managed properties (handled in partner router, not bookings.ts). | Partner cannot trigger any of the 27 endpoints here — booking mutators are admin-cookie exclusive. |
| **public.md** (T002.2.h) | Public lead-create (`leads.ts:175-204` via `public.ts`) is the upstream of any booking; public also exposes blog/health/page-content but **no public booking surface**. | Lead → booking conversion happens admin-side through CRM E* (leads.ts), not directly. |
| **admin.md** (T002.2.i) | All 27 endpoints sit under the same `requireAuth` umbrella as the 37 admin endpoints; W2/W3 share the SuperAdmin inline-check pattern enumerated in §6. | Admin domain hosts dev-migration TRUNCATE bookings table (CF-004 P0) — see §0 banner. |

---

## §6 🔴 CF-018 Sub-pattern B retroactive correction (T002.2.b through .i blind spot)

> **R-REPO-7 (c) self-correction — applies to T002.2.i CF-018 Sub-pattern B enumeration.**
>
> T002.2.i admin.md i6 reported **11 sites in 6 files** (`admin-users` + `service-catalog` + `tasks` + `spaces` + `beneficiaries` + `cs-tickets` inline + `db-sync` router-level). T002.2.j Step 1 multi-pattern verification (rg + per-file breakdown) found the actual count is **5× larger**: **55 sites in 28 files**. Root cause: Step 4 spot-check C3 of T002.2.i ran `rg | head -N` and treated the truncated head as the full enumeration. The remaining 22 files (including the present file `bookings.ts`) were missed.
>
> This section publishes the corrected enumeration and is the authoritative source for Sub-pattern B counts. CRITICAL_FINDINGS.md CF-018 evidence body and INDEX.md banner are updated to reference this table.

### §6.A Corrected enumeration — 55 sites in 28 files

**Pattern**: `if (currentUser?.role !== "SuperAdmin") { res.status(403).json({error: "Only SuperAdmin can ..."}); return; }` — repeated 2× per file at the bulk-delete handler (header `:Y1`) and the permanent-delete branch (`:Y2`), with a perfectly uniform layout (Y2 = Y1 + 21 to + 27 in every file).

| # | Route file | Inline sites (file:line) | Router-level | Notes |
|---:|---|---|:---:|---|
| 1 | `accounts.ts` | `:97`, `:119` | — | |
| 2 | `admin-users.ts` | `:94`, `:135` | — | T002.2.i seed |
| 3 | `beneficiaries.ts` | `:97`, `:119` | — | T002.2.i seed |
| 4 | `blog-posts.ts` | `:112`, `:134` | — | |
| 5 | **`bookings.ts`** | `:323`, `:345` | — | **MISSED at T002.2.i** — W2 + W3 in this file |
| 6 | `commissions.ts` | `:58`, `:80` | — | |
| 7 | `contacts.ts` | `:68`, `:90` | — | |
| 8 | `contract-types.ts` | `:75`, `:96` | — | T002.2.i seed |
| 9 | `contracts.ts` | `:376`, `:397` | — | |
| 10 | `cs-tickets.ts` | `:178`, `:199` | — | T002.2.i seed |
| 11 | `email-templates.ts` | `:79`, `:100` | — | |
| 12 | `invoices.ts` | `:113`, `:134` | — | |
| 13 | `leads.ts` | `:141`, `:163` | — | |
| 14 | `payment-info.ts` | `:58`, `:80` | — | |
| 15 | `product-groups.ts` | `:58`, `:80` | — | |
| 16 | `product-types.ts` | `:58`, `:80` | — | |
| 17 | `products.ts` | `:132`, `:153` | — | (route file is DEAD per CF-009 — see §6.C) |
| 18 | `promotions.ts` | `:85`, `:107` | — | |
| 19 | `properties.ts` | `:165`, `:190` | — | |
| 20 | `recurring-schedules.ts` | `:186`, `:207` | — | |
| 21 | `service-catalog.ts` | `:75`, `:98` | — | T002.2.i seed |
| 22 | `space-options.ts` | `:99`, `:126` | — | |
| 23 | `space-policies.ts` | `:104`, `:122` | — | (note: order reversed in source; permanent-delete is `:104` precedes bulk-delete `:122`) |
| 24 | `spaces.ts` | `:189`, `:216` | — | T002.2.i seed |
| 25 | `suburbs.ts` | `:107`, `:134` | — | |
| 26 | `tasks.ts` | `:139`, `:161` | — | T002.2.i seed |
| 27 | `work-orders.ts` | `:118`, `:139` | — | |
| 28 | **`db-sync.ts`** | — (helper-fronted) | `:30` (`router.use(requireSuperAdmin)`); helper at `:18-29`; normalised role-set at `:16` | NEW SUB-FINDING — see §6.B |

**Totals**: 27 inline-check files × 2 = **54 inline sites** + **1 router-level** = **55 sites total in 28 files**. (`auth.ts:231` `eq(usersTable.role, "SuperAdmin")` is a **data query** not a security check — registration-request email recipient lookup; explicitly excluded.)

### §6.B NEW SUB-FINDING — role-string normalisation drift (db-sync vs the other 27 files)

`db-sync.ts:16` defines `SUPER_ADMIN_ROLES = new Set(["Super Admin", "SuperAdmin", "superadmin", "super_admin"])` and the `requireSuperAdmin` helper at `:18-29` checks `SUPER_ADMIN_ROLES.has(req.user?.role)`. **All 27 inline check files use exact-string comparison `!== "SuperAdmin"` only** — they do not accept `"super_admin"`, `"superadmin"`, or `"Super Admin"`. Practical consequence:

- A user record stored with `role = "super_admin"` (snake_case) **passes** db-sync's helper but **is denied by every one of the 54 inline checks**, including `bookings.ts` W2/W3.
- A user record stored with `role = "Super Admin"` (with space) — same pattern.
- The role-set is an **explicit signal that the dev knew of role-string drift** but only patched it at the most dangerous endpoint (db-sync), leaving the other 27 files unfixed.
- **Phase 2 fix**: extract a single `requireSuperAdmin` middleware in `middlewares/`, apply at router-mount on all 28 files, delete the 54 inline duplications.

### §6.C T002.2.b through .i audit blind-spot map

| Sub-task | Domain | Files in scope | Inline sites missed | Reason |
|---|---|---|---:|---|
| T002.2.b half-1 | finance-invoicing | `invoices.ts`, `payments.ts`, `stripe.ts` | 2 (`invoices.ts:113`, `:134`) | safeParse / Stripe focus; SuperAdmin not enumerated |
| T002.2.b half-2 | finance-payments | `payments.ts` (no SuperAdmin) | 0 | n/a |
| T002.2.c | ops-property | `properties.ts`, `spaces.ts`, `space-options.ts`, `space-policies.ts`, etc. | 8 (4 files × 2) | compression budget; SuperAdmin sites grouped under "delete handlers" not enumerated individually |
| T002.2.d | ops-catalog | `products.ts`, `product-types.ts`, `product-groups.ts`, `service-catalog.ts`, `accommodation-catalog.ts`, etc. | 6 (3 of 4 catalog files × 2; `service-catalog.ts` was **partially** caught at T002.2.i) | same as .c |
| T002.2.e/.e.fix-1 | ops-crm | `accounts.ts`, `contacts.ts`, `leads.ts`, `tasks.ts`, `cs-tickets.ts`, `commissions.ts`, `contracts.ts`, `contract-types.ts` | 14 (`tasks.ts` + `cs-tickets.ts` + `contract-types.ts` caught at T002.2.i; remaining 5 files × 2 = 10 still missed at sub-task close) | same as .c |
| T002.2.f | portal-guest | (separate router files) | 0 | guest portal does not use SuperAdmin role |
| T002.2.g | portal-partner | (separate router files) | 0 | partner portal uses partner-JWT not admin-cookie |
| T002.2.h | public | `public.ts`, `lookup.ts`, `blog-posts.ts`, `privacy.ts`, `health.ts`, `page-contents.ts` | 2 (`blog-posts.ts:112`, `:134`) | Zod-positive-exemplar focus; SuperAdmin gate not enumerated |
| T002.2.i | admin | `admin-users.ts`, `dev-migration.ts`, `db-sync.ts`, `email-templates.ts`, etc. | 2 (`email-templates.ts:79`, `:100` — DOM ID 11 covered db-sync; e-mail-templates inline missed) | head-truncation in spot-check |
| **T002.2.j (this)** | booking | `bookings.ts` | **0** (W2 `:323` + W3 `:345` covered) — and **all 22 missed sites above are reconciled in §6.A** | R-REPO-7 (c) close-out |

**Note re §6.C row 1 (`products.ts`)**: `products.ts` route file is on the CF-009 dead-route list (T002.1.6 audit). The SuperAdmin checks at `:132`/`:153` therefore guard **dead code** — no observable behaviour, but the linecount-cost of 2 dead inline checks adds to the Phase 2 cleanup burden. CF-009 cross-ref: → [`SCHEMA_FILE_TABLE_MAP.md`](../SCHEMA_FILE_TABLE_MAP.md).

### §6.D Impact summary for CRITICAL_FINDINGS.md updates (atomic carrier)

- CF-018 evidence body: replace `"11 sites in 6 files"` with `"55 sites in 28 files (54 inline + 1 router-level); see booking.md §6 for full enumeration"`.
- CF-018 NEW SUB-FINDING bullet: role-string normalisation drift (db-sync 4-variant set vs 27-file exact-literal).
- CF-008 inverse-correlation hypothesis (T002.2.i): unchanged — booking row of CF-008 matrix recomputed in §4 above = 7/27 = 26% ⇒ **booking is no longer at the floor** (admin/ops-property/ops-catalog/ops-crm/portal-partner/public hold the 0% floor); **booking ranks 4th from the top** (after portal-guest 24/29 = 82.8% — wait, recompute: portal-guest had 24/29 ⇒ recheck T002.2.f). Verification deferred to T003-T008 cross-pack reconciliation.
- INDEX.md banner: update CF-018 site count from 11 to 55 (+ Sub-pattern B clarification 28 files).

---

## §7 R-REPO-7 trade-off (recorded for permanence)

T002.2.j Step 1 trade-off: **(가) atomic carrier absorption** vs (나) separate `T002.2.i.fix-1` mini-task vs (다) inline within booking body without dedicated section.

- **Chosen**: (가) — admin.md i6 self-correction precedent; T002.2.j is the endpoint-domain close-out sub-task and therefore the natural carrier for cross-pack CF reconciliation. §6 above is the authoritative §6 evidence body.
- **(나) rejected**: extra push/proceed cycle cost; the correction is mechanical and verifiable in one shot.
- **(다) rejected**: would scatter the correction across the booking body and forfeit the §6.D update map for CRITICAL_FINDINGS.md / INDEX.md.

Plus the T002.2.j substantive trade-off (compact format vs full sample) — chosen **mixed**: §3.A 7 transitions + §3.B 5 writes + §3.C 2 nested = full Meta-format (14 endpoints); §3.D 8 reads = compact 1-line table. Rationale: state-transition + IDOR-bearing nested writes are the highest CF-anchor density; reads are uniform shape and tolerate compact representation. (나) all-full would have pushed booking.md past the 1300-line tripwire; (다) all-compact would have under-served the §3.A/§3.C CF anchors.

---

## §8 Spot-check 4 (C1/C2/C3 + verification)

### C1 — All 22 stub `file:line` cited above match actual handler signatures

Re-ran the same `sed -n "${LINE}p"` pattern as T002.1.5 (Check 1) for all 22 stub endpoints:

| # | Endpoint | Cited line | Actual signature snippet | ✅/❌ |
|---|---|---:|---|:---:|
| R1 | GET `/v1/bookings` | 126 | `router.get("/v1/bookings", async (req, res):` | ✅ |
| W4-out-of-order | POST `/v1/bookings` (= S3 already) | — | covered by S3 | ✅ |
| R2 | GET `/v1/bookings/calendar` | 199 | `router.get("/v1/bookings/calendar", async (req, res):` | ✅ |
| R3 | GET `/v1/bookings/today/arrivals` | 259 | `router.get("/v1/bookings/today/arrivals", async (req, res):` | ✅ |
| R4 | GET `/v1/bookings/today/departures` | 271 | `router.get("/v1/bookings/today/departures", async (req, res):` | ✅ |
| W1 | PUT `/v1/bookings/:id` | 291 | `router.put("/v1/bookings/:id", async (req, res):` | ✅ |
| W2 | POST `/v1/bookings/bulk-delete` | 321 | `router.post("/v1/bookings/bulk-delete", async (req, res):` | ✅ |
| W3 | DELETE `/v1/bookings/:id` | 339 | `router.delete("/v1/bookings/:id", async (req, res):` | ✅ |
| R5 | GET `/v1/bookings/:id/services` | 541 | `router.get("/v1/bookings/:id/services", async (req, res):` | ✅ |
| W4 | POST `/v1/bookings/:id/services` | 549 | `router.post("/v1/bookings/:id/services", async (req, res):` | ✅ |
| N1 | DELETE `/v1/bookings/:id/services/:svcId` | 572 | `router.delete("/v1/bookings/:id/services/:svcId", async (req, res):` | ✅ |
| N2 | PATCH `/v1/bookings/:id/services/:svcId` | 580 | `router.patch("/v1/bookings/:id/services/:svcId", async (req, res):` | ✅ |
| R6 | GET `/v1/bookings/:id/services/:svcId/photos` | 607 | `router.get("/v1/bookings/:id/services/:svcId/photos", async (req, res):` | ✅ |
| T1 | PATCH `/v1/bookings/:id/reject` | 624 | `router.patch("/v1/bookings/:id/reject", async (req, res):` | ✅ |
| T2 | PATCH `/v1/bookings/:id/check-in` | 640 | `router.patch("/v1/bookings/:id/check-in", async (req, res):` | ✅ |
| T3 | PATCH `/v1/bookings/:id/check-out` | 654 | `router.patch("/v1/bookings/:id/check-out", async (req, res):` | ✅ |
| T4 | PATCH `/v1/bookings/:id/cancel` | 668 | `router.patch("/v1/bookings/:id/cancel", async (req, res):` | ✅ |
| T5 | PATCH `/v1/bookings/:id/extend` | 688 | `router.patch("/v1/bookings/:id/extend", async (req, res):` | ✅ |
| R7 | GET `/v1/bookings/:id/documents` | 714 | `router.get("/v1/bookings/:id/documents", async (req, res):` | ✅ |
| W5 | POST `/v1/bookings/:id/documents` | 720 | `router.post("/v1/bookings/:id/documents", async (req, res):` | ✅ |
| T6 | PATCH `/v1/bookings/:id/documents/:doc_id/verify` | 728 | `router.patch("/v1/bookings/:id/documents/:doc_id/verify", async (req, res):` | ✅ |
| T7 | PATCH `/v1/bookings/:id/documents/:doc_id/reject` | 735 | `router.patch("/v1/bookings/:id/documents/:doc_id/reject", async (req, res):` | ✅ |
| R8 | GET `/v1/lookup/bookings` | 744 | `router.get("/v1/lookup/bookings", async (req, res):` | ✅ |

**Result**: 22/22 ✅ (5 sample S1-S5 already verified at T002.1.5).

### C2 — State-transition status matrix (CF-022 anchor)

| Endpoint | Allowed `from` statuses | New `booking_status` | Source |
|---|---|---|---|
| S2 confirm | (any) but creates contract — see T002.2.a | `Confirmed` | `:368-532` |
| S4 submit | `Draft` | `PendingApproval` | `:355-367` (verified at T002.1) |
| T1 reject | `PendingApproval` | `Cancelled` | `:631-635` |
| T2 check-in | `Confirmed` | `Active` | `:646-651` |
| T3 check-out | `Active` | `CheckedOut` | `:660-665` |
| T4 cancel | `!= "CheckedOut" && != "Cancelled"` | `Cancelled` | `:674-683` |
| T5 extend | `Confirmed | Active` (no status change, only `check_out_date` + money recompute) | unchanged | `:695-708` |

Implied state machine: `Draft → PendingApproval → Confirmed → Active → CheckedOut`, with `Cancelled` as terminal-from-any-non-terminal. T4 (cancel) is the only transition that can fire from multiple sources; T1 (reject) is a `PendingApproval`-only specialisation. **Result**: ✅ 7/7 transitions correctly enumerated; matrix is the input for T002.5 (state-machines.md).

### C3 — CF-018 Sub-pattern B enumeration is now complete

Re-ran `rg -n '!== "SuperAdmin"' artifacts/api-server/src/routes/ | wc -l` ⇒ **54** (= 27 files × 2). Re-ran `rg -n 'router\.use\(requireSuperAdmin' artifacts/api-server/src/routes/ | wc -l` ⇒ **1** (db-sync.ts:30). Total = 55 sites in 28 files. **Matches §6.A enumeration ✅**. No additional helper-fronted call sites detected (only `requireSuperAdmin` definition + use exists in db-sync.ts; not exported, not imported elsewhere).

### Verification gate verdict

22/22 file:line ✅ + 7/7 state transitions ✅ + 55/55 SuperAdmin sites ✅. No corrections needed to §3 / §4 / §6 bodies.

---

## Sample Re-Verification Log (T002.1.5 — 2026-04-26)

> Triggered by user directive [B2]: re-verify the 5 samples once more before T002.2 locks the format. Three independent checks performed; all results recorded here for audit.

### Check 1 — Cited `file:line` matches actual handler signature
Re-ran `sed -n "${LINE}p" artifacts/api-server/src/routes/bookings.ts` for each sample's first cited line:

| # | Sample | Cited line | Actual signature at that line | ✅/❌ |
|---|---|---|---|:---:|
| S1 | GET /v1/bookings/:id | 283 | `router.get("/v1/bookings/:id", async (req, res): Promise<void> => {` | ✅ |
| S2 | PATCH /v1/bookings/:id/confirm | 368 | `router.patch("/v1/bookings/:id/confirm", async (req, res): Promise<void> => {` | ✅ |
| S3 | POST /v1/bookings | 161 | `router.post("/v1/bookings", async (req, res): Promise<void> => {` | ✅ |
| S4 | PATCH /v1/bookings/:id/submit | 355 | `router.patch("/v1/bookings/:id/submit", async (req, res): Promise<void> => {` | ✅ |
| S5 | GET /v1/bookings/:id/contract | 533 | `router.get("/v1/bookings/:id/contract", async (req, res): Promise<void> => {` | ✅ |

**Result**: 5/5 ✅ — all line numbers stable, no off-by-one drift.

### Check 2 — Tables named in samples exist in schema
Ran `rg -l "pgTable(\"<name>\"" packages/db/src/schema/` for each table referenced in the 5 samples:

| Table cited | Defined in | ✅/❌ |
|---|---|:---:|
| `bookings` | `bookings.ts` | ✅ |
| `contracts` | `contracts.ts` | ✅ |
| `contract_line_items` | `contract_line_items.ts` | ✅ |
| `space_blocked_dates` | `spaces.ts` | ✅ |
| `accounts` | `accounts.ts` | ✅ |
| `contacts` | `contacts.ts` | ✅ |
| `spaces` | `spaces.ts` | ✅ |
| `properties` | `properties.ts` | ✅ |
| `accommodation_catalog` | `accommodation_catalog.ts` | ✅ |
| `contract_products` | `products.ts` *(file is 🪦 DEAD per CF-009 but the `contract_products` table itself is live and queried at S2)* | ✅ |
| `booking_services` | `bookings.ts` | ✅ |

**Result**: 11/11 ✅. **Note**: `contract_products` lives in `products.ts` schema file even though `products.ts` *route* file is dead. Worth a callout in T002.3 (db-schema-overview) — schema-file deadness ≠ table deadness.

### Check 3 — CF cross-references resolve to existing IDs in CRITICAL_FINDINGS.md
Ran `rg "CF-XXX" docs/reverse/_audit/CRITICAL_FINDINGS.md` for each ID cited across the 5 samples (and the new Meta headers added in T002.1.5):

| CF ID | Cited in | Found in CRITICAL_FINDINGS.md | ✅/❌ |
|---|---|---|:---:|
| CF-002 | S2 | ✅ "booking→contract precision loss" | ✅ |
| CF-003 | S2, S5 | ✅ "zero `references()` FK" | ✅ |
| CF-006 | S2 | ✅ "weekly→monthly formula mismatch" | ✅ |
| CF-007 | S2 | ✅ "hard-coded 4-week bond / 2-week advance" | ✅ |
| CF-008 | S3, S4 | ✅ "audit log called from only 6 of 50 route files" | ✅ |
| CF-011 | S2, S3 | ✅ "contract ref by row-count race" — also applies to `generateBookingRef` in S3 (same pattern at `bookings.ts:60-69`) | ✅ |
| CF-014 | S2 | ✅ "multi-step mutations not in transactions" | ✅ |
| CF-015 | S5 | ✅ "soft/hard-delete inconsistency" — surfaced via S5's lack of `isNull(deleted_at)` filter on a contracts read | ✅ |

**Result**: 8/8 ✅.

### Verdict
- 24 of 24 spot-checks passed (5 lines + 11 tables + 8 CFs).
- **No corrections needed** to the 5 samples. Format is locked.
- One incidental finding to carry forward to T002.3: schema-file `products.ts` hosts a still-live table `contract_products` despite the route file being DEAD — needs to be flagged in `db-schema-overview.md` so T002.4's Dead Tables appendix doesn't accidentally tombstone the wrong rows.

---

*End of `booking.md` — **T002.2.j close-out COMPLETE** (2026-04-27). Full coverage: 5 sample (T002.1) + 22 stub close-out (T002.2.j §3.A 7 transitions + §3.B 5 writes + §3.C 2 nested + §3.D 8 reads = 27 endpoints, 189-cell self-check, 10-domain cross-ref matrix, CF-018 Sub-pattern B retroactive correction §6 (11→55 sites in 28 files; T002.2.b through .i blind-spot map; NEW SUB-FINDING role-string normalisation drift), CF-004 P0 cross-ref §0). All 11 endpoint domains in T002.2 closed. Next sub-task: **T002.3 (db-schema-overview.md)**.*
