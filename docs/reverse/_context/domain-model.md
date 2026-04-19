# Domain Model — MillionStay

## 1. Property → Space → Product hierarchy

✅ **Implemented** as a strict three-level hierarchy.

```
properties (1)──< spaces (1)──< contract_products (1)──< bookings
                       │
                       └──< accommodation_catalog (public listing wrapper)
```

| Level | Table | FK to parent | Purpose |
|---|---|---|---|
| Property | `properties` | — | Building / asset |
| Space | `spaces` | `property_id` | Bookable unit (room / studio / whole house) |
| Product | `contract_products` | `space_id` | A priced offering on a space (term, weekly rate, fees, inclusions) |
| Listing | `accommodation_catalog` | `space_id` (+ `promotion_id`) | Public marketing wrapper (overrides for the website search) |

A Space may also have a self-reference (`parent_space_id`) for sub-spaces (e.g., bedrooms within a unit).

## 2. Booking entity chain

The chain when a guest books:

```
1. accounts            (auto, on guest signup)
2. guest_users         (auto, on guest signup, FK account_id)
3. bookings            (auto, on guest application)            booking_status = "PendingApproval"
4. system_log          (auto, action=CREATE entity=booking)
5. (admin confirms)
6. space_blocked_dates (auto, one row per night)               reason = "booked"
7. contracts           (auto, on confirm)                      status = "Draft"
8. contract_line_items (auto, with rent/admin/cleaning/bond)
9. (admin sends → signs → activates contract)
10. invoices           (auto, generated from contract period)  status = "Sent"
11. recurring_schedule (auto, per billing_frequency)
12. bookings.booking_status = "Active"                         (auto, side-effect of activate)
```

Steps 1–4 are fully automatic. Steps 5/9 are admin-triggered. Steps 6–12 are automatic side-effects of admin actions.

## 3. Stay types — short-term vs long-term

❌ **Not modeled as a flag.** Determined by **calculated stay duration**:

- `million-stay-web/src/pages/booking-new.tsx`: `const isLong = stayDays >= 28;`
- This affects: UI step labels (Payment Plans vs Payment), required fields (login required earlier for long-term), and the "Est. Due Today" formula.
- Server side: `bookings.stay_nights` and `stay_weeks` are stored; classification is not persisted.

**Risk:** business rules that should diverge by stay type (cancellation penalty, cooling-off period) cannot easily be enforced at the API layer. **Recommend** adding `bookings.stay_type` enum (`short`, `long`) populated at creation.

## 4. Space type values

```ts
type SpaceType = "Private Room" | "Shared Room" | "Whole Property" | "Other";
// When "Other": custom_type_name holds the free-text label.
```

Source: `property-admin/src/pages/property/SpaceDetail.tsx` form.

## 5. Money fields — where defined

All defined on `contract_products`:

| Field | Type | Purpose |
|---|---|---|
| `weekly_rate` | real | Base weekly rent |
| `monthly_rate` | real | Convenience override (else `weekly × 52/12`) |
| `effective_weekly_rate` | real | After promotion |
| `bond_weeks`, `bond_amount` | int / real | Refundable security deposit |
| `admin_fee` | real | Flat fee on booking |
| `cleaning_fee` | real | Flat fee on booking |
| `advance_weeks` | int | How many weeks of advance rent are due upfront (typically 2) |
| `min_stay_weeks` / `max_stay_weeks` | int | Stay length boundaries |

⚠️ All `real` (single-precision) — see `_rules/financial-rules.md` for the precision risk.

## 6. Booking-time fields (snapshotted)

The product values are copied to the booking at submission time so promotion changes after booking don't retroactively affect:

- `bookings.agreed_weekly_rate`
- `bookings.total_rent`
- `bookings.stay_nights` / `stay_weeks`
- `bookings.currency`

This is intentional snapshotting — good practice for audit trails.

## 7. Account / guest user split

| Concept | Table | Purpose |
|---|---|---|
| Account | `accounts` | The billable entity (a household, a corporate, an agent) |
| Guest user | `guest_users` | The portal login linked to an account (one account can have multiple users — flatmates) |
| Contact | `contacts` | Person-level CRM record (may exist without a portal login) |

This split matters for the data export endpoint (`GET /v1/guest/me/data`):
- A guest user requesting their data only sees bookings/invoices for their account when **they are the sole `guest_users` row for that account**. Otherwise these arrays are returned empty to prevent leaking flatmate data — see `routes/guest-portal.ts`.

## 8. Diagrams

```
Account (Guest)
   │
   └─ guest_users (1..N, portal logins)
   │
   └─ bookings (1..N) ── contracts (0..1) ── invoices (0..N)
                  │
                  └── space_blocked_dates (N)

Account (Agent)
   │
   └─ partner_users (1..N, agent portal logins)
   │
   └─ bookings (0..N, via agent_account_id)  → commissions (per booking, computed)

Account (Owner)
   │
   └─ partner_users (1..N, owner portal logins)
   │
   └─ properties (1..N)
        └─ spaces (1..N)
```
