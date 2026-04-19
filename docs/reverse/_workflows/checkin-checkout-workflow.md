# Check-in / Check-out / Extension Workflow

## 1. Check-in

**Endpoint:** `PATCH /api/v1/bookings/:id/check-in`

```ts
// Status guard
if (existing.booking_status !== "Confirmed") {
  return res.status(409).json({ error: "Booking must be Confirmed before check-in" });
}
// Update
await db.update(bookings).set({ booking_status: "Active" }).where(...);
await logAction({ entity_type: "booking", entity_id: id, action: "STATUS_CHANGE", ... });
```

**What is NOT validated:**
- Whether the upfront invoice has been paid.
- Whether the contract has been signed (a Confirmed booking can have a Draft contract).
- Whether check-in date has actually arrived (an admin can check in early without warning).
- No record of who handed over keys or what time.

**Recommendation:** add `bookings.checked_in_at`, `bookings.checked_in_by_admin_id`, and (optionally) a one-time check-in code or QR for the guest.

## 2. Check-out

**Endpoint:** `PATCH /api/v1/bookings/:id/check-out`

```ts
if (existing.booking_status !== "Active") return 409;
await db.update(bookings).set({ booking_status: "CheckedOut" }).where(...);
await logAction(...);
```

**Gaps:**

| Gap | Severity | Recommendation |
|---|---|---|
| No cleaning WO auto-created | 🟡 | Insert `work_orders` row with `category="Cleaning"`, `priority="Normal"`, `space_id`, `reported_at=now()`, `status="Open"` |
| No outstanding-invoice check | 🔴 | `SUM(invoices.amount WHERE status IN ('Sent','Overdue')) > 0` → return 409 with breakdown, or allow with a warning + flag the booking for follow-up |
| No bond refund record initiated | 🟡 | Trigger a `bond_refunds` row (when that table exists) in `pending` status |
| No space status flip | 🟡 | If the space was marked `Occupied`, flip it back to `Available`. Currently `spaces.status` is a manual lifecycle only ("Active" / "Inactive"). |
| No final inspection record | 🟡 | A `space_inspections` table is not modeled |
| No checkout email to guest | 🟡 | Send a "Thank you for your stay" email + bond return timeline |

## 3. Stay extension ❌

**Status: not implemented.**

- No `PATCH /v1/bookings/:id/extend` endpoint exists.
- The `bookings.check_out_date` column can be edited via the generic `PUT /v1/bookings/:id`, but only when status is `Draft` or `Confirmed` — extending an `Active` booking is not possible via the standard route.

**Workarounds in production:**
- Cancel the current booking and create a new one (loses bond continuity).
- Manually edit the database (no audit trail).

**Recommended design:**

```
PATCH /v1/bookings/:id/extend  body: { new_check_out_date }
  Guards:
    - booking.status in (Confirmed, Active)
    - new date > current check_out_date
    - no overbooking on the new range (next-tenant check)
  Side effects:
    - extend space_blocked_dates
    - update contract.end_date
    - regenerate any future invoices for the new period
    - audit log
```

## 4. Early termination ❌

**Status: partially implemented.**

- `POST /v1/contracts/:id/terminate` flips contract status to `Terminated` and stores `termination_reason`.
- It does **not**:
  - Move the booking to a different status (still `Active`).
  - Calculate any termination fee.
  - Void future unpaid invoices.
  - Initiate bond refund.
  - Free up future blocked dates (`space_blocked_dates` rows for past the termination date are not removed).

**Recommended cohesive design:**

```
POST /v1/contracts/:id/terminate
  body: { termination_date, reason, fee_amount? }
  Side effects:
    1. contracts.status = 'Terminated'; termination_reason set; effective_date = body.termination_date
    2. bookings.status = 'CheckedOut' if termination_date <= now(), else 'Cancelled'
    3. void all unpaid invoices with due_date > termination_date
    4. issue a final invoice for fee_amount (if any)
    5. delete space_blocked_dates rows where date > termination_date
    6. trigger bond refund flow
    7. audit log entry on every step
```

## 5. State sequence diagram (operational view)

```
   Booking         Contract        Invoices         Blocked Dates
─────────────────────────────────────────────────────────────────
   Draft   ──┐
             │ submit
             ▼
   PendingApproval
             │ confirm  ─►  Draft     (none yet)        + N rows
             │
             │       (admin manually) Sent
             │       (guest signs)    Signed
             │
             │           activate ─►  Active   ┐
             │                                 │ batch
             ▼                                 ▼
   Active ◄──┴─────────────────  many Sent invoices    (unchanged)
             │
             │ check-in (no-op besides status)
             │
             │ check-out ────────────────────►  ⚠ no auto WO
             ▼
   CheckedOut       (contract still Active)             (unchanged)
                    ⚠ should auto-Expire when end_date passes
```
