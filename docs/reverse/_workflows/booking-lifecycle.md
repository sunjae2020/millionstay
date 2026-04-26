# Booking Lifecycle

> ⚠️ **NEEDS REVISION** — see `docs/reverse/_audit/T001_RECON_REPORT.md` §g for specific corrections required. Will be rewritten in T002–T007 when its domain folder is processed.


## 1. Status values

```ts
type BookingStatus =
  | "Draft"           // initial — admin or guest in-progress
  | "PendingPayment"  // submitted, awaiting initial payment (long-term flow)
  | "PendingApproval" // submitted, awaiting admin review
  | "Confirmed"       // admin accepted — dates blocked, contract created
  | "Active"          // checked in (or contract activated)
  | "CheckedOut"      // stay completed
  | "Cancelled"       // any cancellation path
  | "NoShow";         // referenced in UI badge map; no code path sets it today
```

Stored as `bookings.booking_status` (text, default `"Draft"`). No enum table — it's a string convention enforced by validation in the route handlers.

## 2. State transitions

| Endpoint | From → To | Guard | Side effects | Audit log |
|---|---|---|---|---|
| `PATCH /v1/bookings/:id/submit` | `Draft → PendingPayment` | must be `Draft` | none | ✅ |
| `POST /v1/guest/bookings` | `(create) → PendingApproval` | guest auth required | sends booking confirmation email; **does not** create blocked dates | ✅ |
| `PATCH /v1/bookings/:id/confirm` | `(PendingApproval \| PendingPayment) → Confirmed` | must be in those statuses | (1) inserts one row per night into `space_blocked_dates`, (2) auto-creates `contracts` row with status `Draft`, (3) auto-populates contract line items + rent calculation | ✅ |
| `PATCH /v1/bookings/:id/reject` | `PendingApproval → Cancelled` | must be `PendingApproval` | sets `cancellation_reason`, `cancelled_at` | ✅ |
| `PATCH /v1/bookings/:id/cancel` | `* → Cancelled` (except `CheckedOut` / already `Cancelled`) | excluded statuses block | unblocks dates if previously `Confirmed`/`Active`; does **not** terminate linked contract or void invoices ⚠️ | ✅ |
| `POST /v1/contracts/:id/activate` | (linked booking) `Confirmed → Active` | contract must be `Signed` | generates invoices + recurring schedules; sets booking to `Active` | ✅ |
| `PATCH /v1/bookings/:id/check-in` | `Confirmed → Active` | must be `Confirmed` | none (no key-handover record) | ✅ |
| `PATCH /v1/bookings/:id/check-out` | `Active → CheckedOut` | must be `Active` | none (no auto cleaning WO, no unpaid-invoice block) ⚠️ | ✅ |

> "(linked booking)" means the booking moves to `Active` as a side effect of contract activation, even though the API endpoint is on the contract resource.

## 3. Contract creation

Triggered automatically inside `PATCH /v1/bookings/:id/confirm` (lines ~383-465 of `routes/bookings.ts`):

```ts
// Inside the confirm handler:
if (existing.account_id && !existingContract) {
  await db.insert(contractsTable).values({
    contract_ref: nextRef("CT"),
    booking_id: id,
    tenant_account_id: existing.account_id,
    landlord_account_id: spaceRow.landlord_account_id,
    space_id: existing.space_id,
    start_date: existing.check_in_date,
    end_date: existing.check_out_date,
    weekly_rate: existing.agreed_weekly_rate,
    total_rent: existing.total_rent,
    bond_amount: weeklyRate * 4,        // 4 weeks default
    advance_amount: weeklyRate * 2,     // 2 weeks default
    currency: existing.currency,
    status: "Draft",
    terms_text: buildTermsText(...),
  });
}
```

Initial status is **`Draft`**. The contract then moves through `Sent → Signed → Active` via separate admin actions on `routes/contracts.ts`.

## 4. Overbooking prevention (and its race condition)

```ts
// routes/bookings.ts
async function checkOverbooking(spaceId, checkIn, checkOut, excludeBookingId?) {
  const dates = getDatesInRange(checkIn, checkOut);
  const rows = await db
    .select()
    .from(spaceBlockedDatesTable)
    .where(
      and(
        eq(spaceBlockedDatesTable.space_id, spaceId),
        or(...dates.map((d) => eq(spaceBlockedDatesTable.date, d))),
      ),
    );
  return { blocked: rows.length > 0, dates: rows.map((r) => r.date) };
}
```

**Race condition:** This SELECT and the subsequent INSERT into `space_blocked_dates` are **not** wrapped in a transaction, and there is **no DB-level unique constraint** on `(space_id, date)`. Two simultaneous confirms for the same space + dates will both:
1. SELECT → no overlap found → pass.
2. INSERT 7 rows each → both succeed → double-booking.

**Mitigation:**
1. Add `CREATE UNIQUE INDEX ux_space_blocked_dates_space_date ON space_blocked_dates(space_id, date);`
2. Wrap confirm in `db.transaction(async (tx) => { ... })`.
3. Catch unique-violation errors and return 409.

## 5. State machine diagram

```
                         ┌──────────────────┐
                         │      Draft       │
                         └────────┬─────────┘
                                  │ PATCH /submit
                                  ▼
                         ┌──────────────────┐
                         │ PendingPayment   │
                         └────────┬─────────┘
                                  │
   POST /guest/bookings           │
   (initial create)               │
            │                     │
            ▼                     │
   ┌────────────────────┐         │
   │ PendingApproval    │ ◄───────┘
   └────┬───────┬───────┘
        │       │
 reject │       │ confirm
        ▼       ▼
  ┌─────────┐  ┌──────────────────┐    side effects on confirm:
  │Cancelled│  │    Confirmed     │    1. blocks dates
  └─────────┘  └────┬─────┬──────┘     2. creates Contract (Draft)
                    │     │            3. logs audit entry
                    │     │ check-in
            cancel  │     ▼
                    │   ┌──────────────────┐    contract activate
                    │   │     Active       │ ◄── (side effect)
                    │   └────┬──────┬─────┘
                    │        │      │ check-out
                    │        │      ▼
                    │        │ ┌──────────────────┐
                    │ cancel │ │   CheckedOut     │
                    │        │ └──────────────────┘
                    ▼        ▼
              ┌─────────┐
              │Cancelled│ ◄── any non-checked-out, non-cancelled
              └─────────┘     also unblocks dates
```

> `NoShow` exists as a UI badge color but no API code path sets it. Add a `PATCH /v1/bookings/:id/no-show` action if the operations team needs it.

## 6. Gaps

| # | Gap | Recommendation |
|---|---|---|
| BL-01 | Race condition on confirm | unique index + transaction |
| BL-02 | Cancel does not terminate contract or void invoices | extend cancel handler |
| BL-03 | Check-out does not enforce paid invoices | add `SELECT outstanding > 0 → 409` guard, or proceed but flag |
| BL-04 | Check-out does not auto-create cleaning WO | insert into `work_orders` |
| BL-05 | No `NoShow` transition endpoint | add `PATCH /no-show` |
| BL-06 | `bookings.status` (legacy) and `booking_status` are both maintained | pick one, deprecate the other |
