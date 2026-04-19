# Business Constraints — What Is Enforced (and What Isn't)

## 1. Booking constraints

### Overbooking prevention ✅ (race condition risk 🔴)

`artifacts/api-server/src/routes/bookings.ts` — `checkOverbooking()`:

```ts
async function checkOverbooking(spaceId: number, checkIn: string, checkOut: string, excludeBookingId?: number) {
  if (!checkIn || !checkOut) return { blocked: false, dates: [] };
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

**Race condition:** there is **no** `BEGIN; ... FOR UPDATE; INSERT; COMMIT;` transaction around (check) → (insert into `space_blocked_dates`). Two concurrent confirms for the same space + dates can both pass the check. **Recommend:** wrap in `db.transaction(async (tx) => ...)` and acquire row-level locks on `space_blocked_dates` for the date range, or use a unique `(space_id, date)` index plus catch unique-violation errors.

> ✅ The `space_blocked_dates` table does have a natural unique key (one row per night per space). If a unique constraint is added on `(space_id, date)`, the second insert will fail with a duplicate-key error — a robust last-line defence.

### Min / max stay ⚠️

- Defined on `contract_products.min_stay_weeks` (default 1) and `max_stay_weeks` (nullable).
- The booking wizard UI calculates `stayWeeks` and disables submit if out of range.
- **Server side: not enforced** in `POST /v1/bookings`. A direct API call could violate either bound.

### Past-date booking ⚠️

- UI date picker prevents past dates.
- **Server side: not enforced.**

## 2. Financial constraints

### Invoice immutability ❌

```ts
PUT /api/v1/invoices/:id  // updates amount, due_date, description, notes
                          // with NO check on current status
```

Invoices already `Sent` or `Paid` can be edited. There is no credit-note / void-and-reissue flow (only `void` which sets status, leaving amount intact).

### Est. Due Today calculation ⚠️ (frontend-only)

`artifacts/million-stay-web/src/pages/booking-new.tsx`:

```ts
const cardLongBond = bond > 0 ? bond : weeklyRate * 4;
const longInitial  = cardLongBond + adminFee + cleaningFee + (weeklyRate * 2) + servicesTotal;
```

The server does not recompute or persist this on booking creation. The Bond, Admin Fee, Cleaning Fee, and 2 weeks' rent are tracked on the contract instead, after admin confirms. If a guest application pricing display ever drifts from server reality, there's no reconciliation.

### Bond as separate accounting ⚠️

Bond is stored on `contract_products.bond_amount` and copied into `contracts.bond_amount`, but the **bond is NOT a separate invoice line item** in the generated invoice batch. It is implicitly bundled into the upfront payment. There is no `bond_held` ledger account.

## 3. Status transition constraints

Validated transitions (in `routes/bookings.ts` and `routes/contracts.ts`):

| Endpoint | Guard | Status |
|---|---|---|
| `PATCH /v1/bookings/:id/submit` | `existing.booking_status === "Draft"` | ✅ |
| `PATCH /v1/bookings/:id/confirm` | `["PendingApproval","PendingPayment"].includes(...)` | ✅ |
| `PATCH /v1/bookings/:id/check-in` | `=== "Confirmed"` | ✅ |
| `PATCH /v1/bookings/:id/check-out` | `=== "Active"` | ✅ |
| `PATCH /v1/bookings/:id/reject` | `=== "PendingApproval"` | ✅ |
| `PATCH /v1/bookings/:id/cancel` | `!== "CheckedOut" && !== "Cancelled"` | ✅ |
| `PUT /v1/bookings/:id` | `["Draft","Confirmed"].includes(...)` | ✅ |
| `POST /v1/contracts/:id/send` | `=== "Draft"` | ✅ |
| `POST /v1/contracts/:id/sign` | `=== "Sent"` | ✅ |
| `POST /v1/contracts/:id/activate` | `=== "Signed"` | ✅ |
| `POST /v1/contracts/:id/terminate` | `=== "Active"` | ✅ |

## 4. Missing constraints (gaps)

| # | Rule | Priority | Where it should be enforced |
|---|---|---|---|
| C-01 | Overbooking race-condition (use unique index + tx) | 🔴 | `bookings.ts` confirm + DB-level unique on `(space_id, date)` |
| C-02 | Server-side past-date block | 🔴 | `bookings.ts` create / update — Zod refinement |
| C-03 | Server-side min/max stay | 🔴 | `bookings.ts` create / update |
| C-04 | Invoice immutability after Sent/Paid | 🔴 | `invoices.ts` PUT guard |
| C-05 | Cleaning Work Order auto-create on checkout | 🟡 | `bookings.ts:check-out` |
| C-06 | Overdue invoice batch (`Sent + due_date<now → Overdue`) | 🟡 | new cron / one-shot script |
| C-07 | Cancellation policy (free / partial / non-refund) | 🟡 | `bookings.ts:cancel` + `contract_products` columns |
| C-08 | Unpaid invoice block on check-out | 🟡 | `bookings.ts:check-out` |
| C-09 | Promotion expiry check at booking creation | 🟡 | `bookings.ts` create — currently the discounted rate is taken from `contract_products.effective_weekly_rate` even if the linked promotion has expired |
| C-10 | Document file-size hard cap (currently relies on multer default) | 🟢 | `guest-documents.ts` |
| C-11 | Disallow contract activation if booking is not in `Confirmed` | 🟢 | `contracts.ts:activate` (currently checks contract status only) |
| C-12 | MFA for admin / SuperAdmin | 🔴 | `auth.ts` — privacy policy already promises this is rolling out |

## 5. Deletion semantics

| Table | Soft delete | Hard delete |
|---|---|---|
| Most | `deleted_at` set; queries filter `WHERE deleted_at IS NULL` | only via `db-sync` admin tool |
| `documents` | retention-based purge via `purge-expired-documents.ts` | hard-delete after `retention_until` |
| `space_blocked_dates` | hard delete on cancel (no soft) | yes — by design |
| `refresh_tokens` | `revoked_at` set; cleanup job recommended | none scheduled |

Most tables filter on `deleted_at IS NULL` consistently in route handlers, but a few queries (e.g., some report aggregates) do not — worth auditing before migration.
