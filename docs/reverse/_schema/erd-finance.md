# Finance Schema — Invoice / RecurringSchedule / PaymentMethod / Promotion

> ⚠️ **NEEDS REVISION** — see `docs/reverse/_audit/T001_RECON_REPORT.md` §g for specific corrections required. Will be rewritten in T002–T007 when its domain folder is processed.


> Source: `lib/db/src/schema/{invoices,recurring_schedules,promotions}.ts`

## invoices

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| invoice_ref | text UNIQUE | human-readable ID, e.g. `INV-2026-00045` |
| booking_id | int → bookings.id | |
| contract_id | int → contracts.id | |
| account_id | int → accounts.id | who is billed |
| amount | **numeric(10,2)** | ⚠️ Drizzle returns this as **string** — always wrap with `Number()` |
| currency | text default `AUD` | |
| status | text default `Draft` | `Draft` \| `Sent` \| `Paid` \| `Overdue` \| `Void` |
| due_date | date | |
| paid_at | timestamp | nullable |
| payment_method | text | `Stripe`, `BankTransfer`, `Cash`, `Manual` |
| stripe_payment_intent_id | text | nullable |
| stripe_checkout_url | text | nullable |
| description | text | |
| notes | text | |
| created_at, updated_at, deleted_at | timestamp | |

**Triggered by:** `generateContractInvoicesAndSchedules()` in `routes/contracts.ts:55` — runs on `POST /v1/contracts/:id/activate`. Manually via `POST /v1/invoices`.

**Status transitions:**
- `Draft → Sent` via `POST /v1/invoices/:id/send`
- `Sent → Paid` via `POST /v1/invoices/:id/pay` or Stripe webhook
- `Sent → Overdue` (no automated cron — currently relies on manual review or query `due_date < now() AND status = 'Sent'`)
- `Sent → Void` via `POST /v1/invoices/:id/void`

**⚠️ Mutability gap:** `PUT /v1/invoices/:id` allows updating `amount`, `due_date`, `description`, `notes` even after `Sent`/`Paid`. There is no immutability guard. Documented in `_rules/financial-rules.md`.

## recurring_schedule

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| booking_id | int → bookings.id | |
| contract_id | int → contracts.id | |
| account_id | int → accounts.id | |
| schedule_type | text default `Rent` | `Rent`, `Service`, `Bond` |
| frequency | text default `Biweekly` | `Weekly` \| `Biweekly` \| `Monthly` |
| amount | real | per-period amount |
| currency | text | |
| gst_included | boolean | |
| start_date | date | |
| end_date | date | |
| next_due_date | date | drives the batch generator |
| last_generated_at | timestamp | |
| is_active | boolean | |
| created_at, updated_at, deleted_at | timestamp | |

**Index:** `idx_recurring_next_due` on `next_due_date` (for nightly generation).

## promotions

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| name | text | |
| discount_type | text | `Percentage` \| `Fixed` |
| discount_amount | **numeric(10,2)** | string out of Drizzle |
| start_date, end_date | date | validity window |
| is_active | boolean | |
| applies_to | text | currently `weekly_rate` (other types are not yet supported) |
| created_at, updated_at, deleted_at | timestamp | |

**Linked from:** `contract_products.promotion_id` and `accommodation_catalog.promotion_id`. The promotion applies to the **product weekly rate** at booking time and the resulting discounted weekly rate is cached as `contract_products.effective_weekly_rate`.

**Stacking:** Only **one** promotion per product is supported (single FK column). No stacking logic exists.

## payment_methods (referenced but not heavily populated yet)

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| account_id | int → accounts.id | |
| method_type | text | `Card`, `BankTransfer`, `BPAY` |
| last_four | text | masked (BSB stored elsewhere on `guest_users`) |
| stripe_payment_method_id | text | for saved cards |
| is_default | boolean | |
| created_at, updated_at | timestamp | |

> Bank account details for guests are stored directly on `guest_users.bank_*` (BSB, account number) rather than `payment_methods` — this is legacy and should be migrated.

## C# migration risks

| Item | Severity | Why |
|---|---|---|
| `invoices.amount`, `promotions.discount_amount` already `numeric` | 🟢 Low | Maps cleanly to C# `decimal` |
| `recurring_schedule.amount` is `real` | 🔴 High | Floating point — must be migrated to `numeric(10,2)` |
| `contract_products.weekly_rate / bond_amount / admin_fee / cleaning_fee` are `real` | 🔴 High | Same — floating point precision risk |
| Stripe webhook signature verification | 🟢 Low | Stripe SDK exists for .NET |
| No PostgreSQL-specific JSONB on finance tables | 🟢 Low | SQL Server compatible |

## Computed / virtual fields used on the frontend

- **Est. Due Today** — computed in `million-stay-web/src/pages/booking-new.tsx`, **not** persisted.
- **Total contract value** — `weekly_rate × stay_weeks`, computed at activate-time and stored on `contracts.total_rent`.
- **Outstanding balance per booking** — computed via `SUM(invoices.amount WHERE status != 'Paid')`, not stored.
