# C# Migration Readiness Checklist

> ✅ **T001-RECON-VERIFIED** 2026-04-26 — corroborated by `docs/reverse/_audit/T001_RECON_REPORT.md` §g.


Ranked from highest impact / lowest cost.

## Phase 0 — DB hygiene

- [ ] Convert every money column from `real` to `numeric(10,2)`:
  - [ ] `contract_products`: `weekly_rate`, `monthly_rate`, `effective_weekly_rate`, `bond_amount`, `admin_fee`, `cleaning_fee`
  - [ ] `bookings`: `agreed_weekly_rate`, `total_rent`, `stay_weeks`
  - [ ] `contracts`: `weekly_rate`, `total_rent`, `bond_amount`, `advance_amount`
  - [ ] `recurring_schedule.amount`
  - [ ] `commissions.commission_amount`, `commissions.commission_rate`
  - [ ] `work_orders.cost`
  - [ ] `service_catalog.price`
  - [ ] `payment_methods` price-bearing fields if any
- [ ] Add `deleted_at`, `created_at`, `updated_at` where missing (`guest_users`, `partner_users`, `refresh_tokens`, `marketing_consents`, `space_blocked_dates`).
- [ ] Add unique index `(space_id, date)` on `space_blocked_dates`.
- [ ] Convert any `timestamp` (no TZ) to `timestamptz`.
- [ ] Tighten `text` to `varchar(N)` on short bounded fields (email 320, ref strings 50, country_code 2).

## Phase 1 — API standardization

- [ ] Single error response shape: `{ success:false, error:{code,message,details?} }`
- [ ] Single success envelope: `{ data, pagination? }`
- [ ] Mount global Express error middleware
- [ ] Convert manual auth-route validation to Zod with `.strict()`
- [ ] Make `OpenAPI` (in `lib/api-spec`) the source of truth — refresh from current routes

## Phase 2 — Architecture refactor

- [ ] Extract `services/` for booking, contract, invoice, commission, work-order
- [ ] Extract `repositories/` (Drizzle calls only)
- [ ] Wrap every multi-row mutation in `db.transaction()`
- [ ] Add `AppError` class + map to HTTP in error middleware

## Phase 3 — Business rule fixes

- [ ] Server-side past-date validation on booking
- [ ] Server-side min/max stay validation
- [ ] Invoice immutability after `Sent`/`Paid`
- [ ] Cancel booking → terminate contract + void future unpaid invoices
- [ ] Auto cleaning WO on check-out
- [ ] Auto contract `Expired` when `end_date` passes (nightly job)
- [ ] Auto invoice `Overdue` when `due_date` passes (nightly job)
- [ ] Promotion expiry re-validation at booking time
- [ ] Snapshot commission to `commission_earnings` at confirm-time

## Phase 4 — Security

- [ ] MFA for admin / SuperAdmin
- [ ] Refresh token cleanup job
- [ ] Password policy rotation enforcement
- [ ] Audit log backfill for `work_orders`, `cs_tickets`, `accounts`, `contacts`, `promotions`, `marketing_consents`, `admin_users`
- [ ] PII redaction helper used in audit log payloads

## Phase 5 — Test foundation

- [ ] Vitest set up in `artifacts/api-server`
- [ ] Money calculator unit tests
- [ ] Booking state machine tests (BC-* / BS-* / BO-* in `booking-test-cases.md`)
- [ ] Auth + RBAC integration tests
- [ ] Privacy compliance tests (APP 12 export, marketing consent, retention)
- [ ] CI script wires `pnpm -r test` into `package.json`

## Phase 6 — C# port

Once the above are done, the port is mechanical:
- [ ] EF Core scaffolding from existing schema (`dotnet ef dbcontext scaffold` against the cleaned-up DB)
- [ ] Map each `services/` file 1:1 to a C# `IXxxService` + implementation
- [ ] Map each `repositories/` file 1:1 to a C# `IXxxRepository`
- [ ] Re-implement validation with `FluentValidation` referencing the same OpenAPI source of truth
- [ ] Re-implement audit middleware
- [ ] Re-implement Stripe webhook with `Stripe.EventUtility.ConstructEvent`
- [ ] Run the same `booking-test-cases.md` suite against the C# implementation as a behaviour-parity check

## Effort estimate (refresher)

| Phase | Effort |
|---|---|
| 0 — DB hygiene | 8–12 h |
| 1 — API standardization | 8–12 h |
| 2 — Architecture refactor | 24–32 h |
| 3 — Business rule fixes | 16–24 h |
| 4 — Security | 24–40 h (MFA dominates) |
| 5 — Test foundation | 12–20 h |
| 6 — C# port | 200+ h (separate project plan) |
| **Pre-port total** | **~90–140 h** |
