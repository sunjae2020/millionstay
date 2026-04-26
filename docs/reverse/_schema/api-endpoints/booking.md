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

## Remaining endpoints (22) — written in T002.2

The 5 above lock the format. The other 22 endpoints in `bookings.ts` will be written in T002.2:

| Method | Path | Source | Notes for T002.2 |
|---|---|---|---|
| GET | `/v1/bookings` | `:126` | List + filters; no logAction; soft-delete-aware. |
| POST | `/v1/bookings/bulk-delete` | `:321` | Super-admin gate. Hard-delete option; CF-015 anchor. |
| GET | `/v1/bookings/calendar` | `:199` | Calendar view, complex query. |
| GET | `/v1/bookings/today/arrivals` | `:259` | |
| GET | `/v1/bookings/today/departures` | `:271` | |
| PUT | `/v1/bookings/:id` | `:291` | Update; recomputes `stayDetails`. State-guarded. |
| DELETE | `/v1/bookings/:id` | `:339` | Soft + permanent (super-admin). CF-015. |
| PATCH | `/v1/bookings/:id/reject` | `:624` | Has logAction. |
| PATCH | `/v1/bookings/:id/check-in` | `:640` | Has logAction. |
| PATCH | `/v1/bookings/:id/check-out` | `:654` | Has logAction. |
| PATCH | `/v1/bookings/:id/cancel` | `:668` | Has logAction. |
| PATCH | `/v1/bookings/:id/extend` | `:688` | Recomputes money via `calcStayDetails`. |
| GET | `/v1/bookings/:id/services` | `:541` | |
| POST | `/v1/bookings/:id/services` | `:549` | |
| DELETE | `/v1/bookings/:id/services/:svcId` | `:572` | |
| PATCH | `/v1/bookings/:id/services/:svcId` | `:580` | |
| GET | `/v1/bookings/:id/services/:svcId/photos` | `:607` | |
| GET | `/v1/bookings/:id/documents` | `:714` | |
| POST | `/v1/bookings/:id/documents` | `:720` | |
| PATCH | `/v1/bookings/:id/documents/:doc_id/verify` | `:728` | |
| PATCH | `/v1/bookings/:id/documents/:doc_id/reject` | `:735` | |
| GET | `/v1/lookup/bookings` | `:744` | Lookup variant; sibling of `lookup.ts`. |

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

*End of `booking.md` (partial — T002.1 sample, T002.1.5 verified, S2/S5 cross-refs back-filled in T002.2.a). T002.2.a (contract.md, 28 endpoints) complete; awaiting user `proceed` for T002.2.b (finance.md, the next domain). The remaining 22 booking endpoints are deferred to T002.2.j (close-out) per the T002.2 ordering.*
