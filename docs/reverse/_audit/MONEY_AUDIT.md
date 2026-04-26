# MONEY AUDIT — MillionStay

> **Source**: T001 RECON + targeted re-scan of every money-touching file.
> **Scope**: Every column that stores a monetary value, every code site that reads/writes/computes one, every cross-table flow that propagates money, plus a proposed unified model.
> **Discipline**: This document records facts and proposals. **No code change is performed by this document.**
> **Last updated**: 2026-04-26 (T001.5).

---

## §1. Money column inventory (every monetary column in the schema)

### 1.1 Numeric columns ✅ (exact decimal, OK)

| Table | Column | Type | Nullable | Default | Defined at |
|---|---|---|---|---|---|
| `bookings` | `agreed_weekly_rate` | `numeric(12,2)` | yes | — | `bookings.ts:19` |
| `bookings` | `total_rent` | `numeric(12,2)` | yes | — | `bookings.ts:20` |
| `booking_services` | `unit_price` | `numeric(10,2)` | **no** | — | `bookings.ts:55` |
| `booking_services` | `total_price` | `numeric(10,2)` | **no** | — | `bookings.ts:56` |
| `contract_line_items` | `unit_price` | `numeric(10,2)` | **no** | `"0"` | `contract_line_items.ts:11` |
| `contract_line_items` | `total_price` | `numeric(10,2)` | **no** | `"0"` | `contract_line_items.ts:13` |
| `invoices` | `amount` | `numeric(10,2)` | **no** | `"0"` | `invoices.ts:9` |
| `recurring_schedules` | `amount` | `numeric(10,2)` | **no** | — | `recurring_schedules.ts:12` |
| `promotions` | `discount_amount` | `numeric(10,2)` | yes | — | `promotions.ts:10` |
| `leads` | `budget_min` | `numeric(12,2)` | yes | — | `leads.ts:21` |
| `leads` | `budget_max` | `numeric(12,2)` | yes | — | `leads.ts:22` |

**Subtotal**: 11 columns. All exact-decimal. Two distinct precisions in use (`12,2` for amounts that may include large totals; `10,2` for line items / single-period charges).

### 1.2 Real columns ⚠️🔴 (IEEE-754 binary32, lossy)

| Table | Column | Type | Nullable | Default | Defined at | Conceptual pair |
|---|---|---|---|---|---|---|
| `accommodation_catalog` | `price` | `real` | yes | — | `accommodation_catalog.ts:10` | (catalog list price) |
| `accommodation_catalog` | `weekly_rate` | `real` | yes | — | `accommodation_catalog.ts:11` | ↔ `bookings.agreed_weekly_rate` (numeric) |
| `accommodation_catalog` | `bond_amount` | `real` | yes | — | `accommodation_catalog.ts:24` | ↔ `contracts.bond_amount` (real) |
| `accommodation_catalog` | `bond_weeks` | `real` | yes | `4` | `accommodation_catalog.ts:25` | (count, not money — see §note) |
| `accommodation_catalog` | `admin_fee` | `real` | yes | — | `accommodation_catalog.ts:27` | — |
| `accommodation_catalog` | `cleaning_fee` | `real` | yes | — | `accommodation_catalog.ts:28` | — |
| `accommodation_service_catalog` | `custom_price` | `real` | yes | — | `accommodation_service_catalog.ts:8` | — |
| `beneficiaries` | `fixed_amount` | `real` | yes | — | `beneficiaries.ts:13` | — |
| `commissions` | `commission_rate` | `real` | yes | — | `commissions.ts:9` | (% or absolute — code-determined) |
| `commissions` | `commission_amount` | `real` | yes | — | `commissions.ts:10` | — |
| `contracts` | `weekly_rate` | `real` | yes | — | `contracts.ts:16` | ↔ `bookings.agreed_weekly_rate` (numeric) 🔴 |
| `contracts` | `total_rent` | `real` | yes | — | `contracts.ts:17` | ↔ `bookings.total_rent` (numeric) 🔴 |
| `contracts` | `bond_amount` | `real` | yes | — | `contracts.ts:18` | (computed `weeklyRate * 4`) |
| `contracts` | `advance_amount` | `real` | yes | — | `contracts.ts:19` | (computed `weeklyRate * 2`) |
| `product_catalog` | `price` | `real` | yes | — | `product_catalog.ts:10` | dead table — see CF-009 |
| `product_catalog` | `bond_amount` | `real` | yes | — | `product_catalog.ts:19` | dead |
| `product_catalog` | `admin_fee` | `real` | yes | — | `product_catalog.ts:20` | dead |
| `product_catalog` | `cleaning_fee` | `real` | yes | — | `product_catalog.ts:21` | dead |
| `products` | `weekly_rate` | `real` | yes | — | `products.ts:14` | dead |
| `products` | `monthly_rate` | `real` | yes | — | `products.ts:15` | dead |
| `products` | `effective_weekly_rate` | `real` | yes | — | `products.ts:16` | dead, but written by route — see §2.3 |
| `products` | `bond_weeks` | `real` | yes | `4` | `products.ts:19` | (count) |
| `products` | `bond_amount` | `real` | yes | — | `products.ts:20` | dead |
| `products` | `admin_fee` | `real` | yes | — | `products.ts:21` | dead |
| `products` | `cleaning_fee` | `real` | yes | — | `products.ts:22` | dead |
| `service_catalog` | `base_price` | `real` | yes | — | `service_catalog.ts:9` | — |
| `space_service_catalog` | `custom_price` | `real` | yes | — | `space_service_catalog.ts:8` | — |
| `spaces` | `base_weekly_price` | `real` | yes | — | `spaces.ts:13` | — |
| `spaces` | `base_daily_price` | `real` | yes | — | `spaces.ts:14` | — |
| `work_orders` | `cost` | `real` | yes | — | `work_orders.ts:17` | — |

**Subtotal**: 30 columns. All inexact. Six of them are in the dead `products` / `product_catalog` tables (CF-009).

### 1.3 Integer / cents columns

None at the column level. Cents conversion happens at one site only:

`artifacts/api-server/src/routes/guest-portal.ts:885`:
```ts
const amountCents = Math.round(Number(invoice.amount) * 100);
```

This is the Stripe payment-intent amount — Stripe's API uses integer cents. The conversion happens at the boundary, immediately before calling `stripe.paymentIntents.create({ amount: amountCents, … })`. The DB column itself remains `numeric(10,2)`.

### 1.4 Note on "weeks" columns

`bond_weeks` (in two tables) and any future `advance_weeks` are *counts*, not amounts. Storing them as `real` is questionable but not money-precision-critical. They should be `smallint` or `integer`.

### 1.5 Conceptual-pair inconsistencies (same semantic value, different physical types)

| Concept | numeric site | real site | Risk |
|---|---|---|---|
| Weekly rate | `bookings.agreed_weekly_rate` (`numeric(12,2)`) | `contracts.weekly_rate` (`real`), `accommodation_catalog.weekly_rate` (`real`), `products.weekly_rate` (`real` — dead), `spaces.base_weekly_price` (`real`) | Confirmed cross-table copy at `bookings.ts:458` 🔴 |
| Total rent | `bookings.total_rent` (`numeric(12,2)`) | `contracts.total_rent` (`real`) | Confirmed cross-table copy at `bookings.ts:459` 🔴 |
| Bond amount | (none) | `contracts.bond_amount`, `accommodation_catalog.bond_amount`, `products.bond_amount` (dead) | Computed inline; written to real |
| Service line price | `booking_services.{unit,total}_price` (`numeric(10,2)`), `contract_line_items.{unit,total}_price` (`numeric(10,2)`) | `accommodation_service_catalog.custom_price`, `space_service_catalog.custom_price`, `service_catalog.base_price` (all `real`) | Catalog price (`real`) is read into JS, then written to line item (`numeric`) — direction-dependent precision loss possible |
| Discount amount | `promotions.discount_amount` (`numeric(10,2)`) | (none) | Consistent ✅ |
| Cost | (none) | `work_orders.cost` (`real`) | Single-typed |

---

## §2. Money calculation code (all sites)

### 2.1 String→number coercion (`parseFloat` / `Number`)

`docs/reverse/_audit/raw/04_money_columns.txt` plus the targeted re-scan at T001.5 produced this list. Every `parseFloat`/`Number` call on a money field:

| File:line | Function context | Coerces from | Used as |
|---|---|---|---|
| `bookings.ts:75-76` | `calcStayDetails` | `weeklyRate` (string param) | computes `weeks`, `total` (returned as string) |
| `bookings.ts:393-394` | confirm-booking handler | `agreed_weekly_rate`, `total_rent` (numeric strings) | feeds contract insert (writes to `real` columns) 🔴 |
| `bookings.ts:485` | `rentAmount` for line item | `weeklyRate * (52/12)` | written as `String(rentAmount)` to `numeric` (round-trip OK) |
| `bookings.ts:554` | line-item insert | `unit_price` from request body | `parseFloat`, then `String(price * qty)` written to numeric ✅ |
| `contracts.ts:62` | `generateContractInvoicesAndSchedules` | `contract.weekly_rate` (real → string in JS via Drizzle) | feeds rentAmount calc, then `String(rentAmount)` to numeric ⚠️ already lost precision in source |
| `contracts.ts:94` | (same) | `weeklyRate * (52/12)` | same |
| `contracts.ts:138` | invoice line aggregation | `line.total_price` (numeric string) | summed in JS, then `String(amount)` to invoice (numeric) ✅ |
| `contracts.ts:497` | invoice insert | `String(amount ?? "0")` | direct string to numeric ✅ |
| `contracts.ts:569-570, 593-594` | line-item create / update | `unit_price` request body | `parseFloat`, `String(price * qty)` to numeric ✅ |
| `products.ts:29` | products listing | `p.weekly_rate` (real) | computes `effective_weekly_rate` written back to `products.effective_weekly_rate` (real) ⚠️ — float in / float out |
| `agent-portal.ts:56, 250` | dashboard reduce | `b.total_rent` (numeric string) | sum in JS for display only ✅ |
| `owner-portal.ts:83` | dashboard "rent under management" | `b.agreed_weekly_rate` (numeric string) × **4** | display only — **CF-006** |
| `owner-portal.ts:228, 236, 243` | contract detail | `li.total_price` / `c.weekly_rate` × **52/12** | display only — **CF-006** for the 4 vs 52/12 split |
| `service-host-portal.ts:97, 637, 646, 681` | earnings summary | `s.total_price` (numeric string) | sum in JS for display ✅ |
| `reports.ts:59` | report generator | `r.total_rent` | display |
| `guest-portal.ts:765` | invoice creation fallback | `booking.total_rent` (numeric string) → `Number()` | written as the invoice amount (numeric) ✅ |
| `guest-portal.ts:885` | Stripe payment intent | `invoice.amount` (numeric string) → `Number()` × 100, `Math.round()` | sent to Stripe as integer cents ✅ |
| `recurring-schedules.ts:147` | schedule processing | `schedule.amount` (numeric string) → `Number()` | reused in calc |
| `dashboard.ts:72` | KPI sum | `i.amount ?? 0` → `Number()` | sum for display |

**Verdict patterns:**
- Reading `numeric` columns and operating on them as JS `number` for **display** is fine — IEEE-754 binary64 has plenty of precision for AUD/cents up to ~$90 trillion.
- Reading `real` columns and operating on them is already lossy at the source; subsequent `parseFloat`/`Number` calls don't help.
- Writing back to `numeric` from a JS `number` via `String(x)` is fine **iff** the JS value is representable exactly. Hard-coded multiplications like `* 2` and `* 4` preserve exactness; `* (52/12)` does not (`52/12 = 4.33333…`).

### 2.2 Hard-coded business-rule constants

| File:line | Code | Comment / meaning |
|---|---|---|
| `bookings.ts:395` | `const bondAmount = weeklyRate * 4` | "4 weeks rent" — does not consult `accommodation_catalog.bond_weeks` |
| `bookings.ts:396` | `const advanceAmount = weeklyRate * 2` | "2 weeks rent" — no schema column for this |
| `bookings.ts:423` | `Security Bond ... (4 weeks rent)` | string literal in contract terms |
| `bookings.ts:425` | `Advance Payment ... (2 weeks rent)` | string literal in contract terms |
| `bookings.ts:75` | `weeks = parseFloat((nights / 7).toFixed(2))` | rounds weeks to 2 decimals before multiplication |
| `bookings.ts:485` | `(weeklyRate * (52 / 12)).toFixed(2)` | monthly rent = weekly × (52/12) |
| `contracts.ts:94` | `(weeklyRate * (52 / 12)).toFixed(2)` | duplicate of the above |
| `owner-portal.ts:83` | `parseFloat(... ) * 4` | monthly = weekly × **4** (inconsistent with above) — CF-006 |
| `owner-portal.ts:236` | `(c.weekly_rate ?? 0) * 52 / 12` | monthly = weekly × **52/12** |
| `accommodation_catalog.ts:25`, `products.ts:19` | `bond_weeks: real("bond_weeks").default(4)` | configurable but unused at calc sites |

### 2.3 `effective_weekly_rate` derivation (response-side only)

`artifacts/api-server/src/routes/products.ts:26-37`:
```ts
return products.map(p => {
  const promo = p.promotion_id ? promoMap[p.promotion_id] : null;
  const disc = promo?.discount_percentage ?? 0;
  const effective_weekly_rate = p.weekly_rate != null
    ? parseFloat((p.weekly_rate * (1 - disc / 100)).toFixed(2)) : null;
  return { ...p, space_name: ..., promotion_name: ..., effective_weekly_rate };
});
```

This is inside the `enrich()` helper that is invoked when listing `contract_products`. The computed `effective_weekly_rate` is **only added to the API response** — it is **not** written back to any schema column.

Separately, the `POST /v1/contract-products` handler (`products.ts:67`) and `PUT /v1/contract-products/:id` (`products.ts:108`) accept `effective_weekly_rate` from the **request body** and store it as-is in `contract_products.effective_weekly_rate` (`real`). So the column is client-supplied, not server-derived. ⚠️ This is a quiet trust assumption — a misbehaving client could ship a `effective_weekly_rate` that contradicts `weekly_rate × (1 - discount)`.

(Note: the `products` schema table itself also declares `effective_weekly_rate: real`, but that table is dead — see CF-009. The live persistence is on `contract_products`.)

---

## §3. Cross-table money flow

### 3.1 Bookings → Contracts (the big one) 🔴

```
┌─────────────────────────────────────┐         ┌──────────────────────────────────┐
│ bookings (numeric)                  │         │ contracts (real)                 │
├─────────────────────────────────────┤  copy   ├──────────────────────────────────┤
│ agreed_weekly_rate  numeric(12,2)   │ ─────▶  │ weekly_rate     real          ⚠️ │
│ total_rent          numeric(12,2)   │ ─────▶  │ total_rent      real          ⚠️ │
│                                     │ compute │ bond_amount     real (= wr*4) ⚠️ │
│                                     │ compute │ advance_amount  real (= wr*2) ⚠️ │
└─────────────────────────────────────┘         └──────────────────────────────────┘
                                          ▲
                            site: bookings.ts:393-396, 458-461
```

Every `agreed_weekly_rate` and `total_rent` value that survives confirmation passes through this funnel. **Precision is lost on every booking confirmation.**

### 3.2 Contracts → Contract line items (recovery) ⚠️→✅

```
┌──────────────────────────────────┐         ┌────────────────────────────────────────┐
│ contracts (real)                 │         │ contract_line_items (numeric)          │
├──────────────────────────────────┤  derive ├────────────────────────────────────────┤
│ weekly_rate     real             │ ─────▶  │ unit_price   numeric(10,2)  via String │
│                                  │         │ total_price  numeric(10,2)  via String │
└──────────────────────────────────┘         └────────────────────────────────────────┘
              ▲
   site: contracts.ts:94-115 (fallback when no line items exist)
```

The fallback writes `String(rentAmount)` to a numeric column. Storage is precise — but the value `rentAmount` was already inexact when it came out of `contracts.weekly_rate`. **Storage is exact, source is not.**

### 3.3 Contract line items → Invoices ✅

```
┌────────────────────────────────────────┐         ┌────────────────────────────────────────┐
│ contract_line_items (numeric)          │         │ invoices (numeric)                     │
├────────────────────────────────────────┤  sum    ├────────────────────────────────────────┤
│ total_price  numeric(10,2)             │ ─────▶  │ amount  numeric(10,2)  via String      │
└────────────────────────────────────────┘         └────────────────────────────────────────┘
              ▲
   sites: contracts.ts:138, 167, 182, 208, 224, 497
```

Numeric in → JS number for sum → `String(...)` to numeric. Sum of `numeric(10,2)` values can be represented exactly in `binary64` for any realistic invoice. ✅ Safe.

### 3.4 Catalog → Booking (input direction) ⚠️

```
┌──────────────────────────────────────┐         ┌──────────────────────────────────────┐
│ accommodation_catalog (real)         │         │ bookings (numeric)                   │
├──────────────────────────────────────┤  user-  ├──────────────────────────────────────┤
│ weekly_rate  real             ⚠️     │ visible │ agreed_weekly_rate  numeric(12,2) ✅ │
└──────────────────────────────────────┘         └──────────────────────────────────────┘
              ▲
   sites: bookings.ts when `agreed_weekly_rate` is set from listing context
```

Direction `real → numeric` widens precision but does not recover the lost bits. If the user enters a "round" rate like `425.00`, it round-trips fine. If a discount or computed rate is the source, precision is already gone before it reaches `bookings`.

### 3.5 Invoices → Stripe (boundary conversion) ✅

```
┌──────────────────────────────┐         ┌──────────────────┐
│ invoices.amount numeric(10,2)│ ─────▶  │ Stripe int cents │
└──────────────────────────────┘  Math.  └──────────────────┘
                                  round
   site: guest-portal.ts:885
```

`Math.round(Number(invoice.amount) * 100)` — the only correct place a `Math.round` is needed in the codebase. ✅

### 3.6 Settlement / commission flow

`commissions.commission_rate` and `commissions.commission_amount` are both `real`. No code path was sampled in T001 for commission calculation — must be enumerated in T005. Provisional flag: any commission calc that flows into invoice lines (or settlement reports) suffers the same `real`→`numeric` direction issue as §3.2.

### 3.7 Bond / advance flow

```
weeklyRate (parseFloat numeric → JS number)
     │
     ├─── × 4 ──► bondAmount     ──► contracts.bond_amount (real)
     └─── × 2 ──► advanceAmount  ──► contracts.advance_amount (real)
```

Multiplications by exact integers preserve exactness in JS. Storage in `real` introduces precision loss. The terms-text PDF embeds `bondAmount.toFixed(2)` — display is fine; *retrieval* of the stored value will not match the original.

---

## §4. Recommended consistency models (proposals only, no changes)

### Option A — Unify on `numeric(12,2)` (recommended)

**Migration sketch (per column):**
```sql
ALTER TABLE contracts
  ALTER COLUMN weekly_rate    TYPE numeric(12,2) USING weekly_rate::numeric(12,2),
  ALTER COLUMN total_rent     TYPE numeric(12,2) USING total_rent::numeric(12,2),
  ALTER COLUMN bond_amount    TYPE numeric(12,2) USING bond_amount::numeric(12,2),
  ALTER COLUMN advance_amount TYPE numeric(12,2) USING advance_amount::numeric(12,2);
-- Repeat for every CF-001 row.
```

**Drizzle schema diff (illustrative):**
```ts
// contracts.ts
- weekly_rate: real("weekly_rate"),
+ weekly_rate: numeric("weekly_rate", { precision: 12, scale: 2 }),
```

**Application diff** — none required at write sites that already pass JS `number`: Drizzle accepts both `string` and `number` for `numeric` inserts. Read sites already treat numeric values as strings; they will continue to work.

**Trade-offs:**
- ✅ Exact decimal arithmetic at the DB level.
- ✅ Maps cleanly to C# `decimal`, Java `BigDecimal`, Python `Decimal`.
- ✅ Minimum code churn — a one-shot migration plus schema text edits.
- ⚠️ Slightly larger storage footprint (`numeric` is variable-width; for AUD amounts under 8 digits the overhead is negligible).
- ⚠️ Existing inexact values in `real` columns will be "frozen" at their lossy form by the cast; no automatic repair. A reconciliation step against `bookings` may be needed (see §4.3).

### Option B — Adopt `integer cents`

**Migration sketch:**
```sql
ALTER TABLE contracts
  ALTER COLUMN weekly_rate    TYPE integer USING (weekly_rate * 100)::integer,
  ALTER COLUMN total_rent     TYPE integer USING (total_rent  * 100)::integer,
  ALTER COLUMN bond_amount    TYPE integer USING (bond_amount * 100)::integer,
  ALTER COLUMN advance_amount TYPE integer USING (advance_amount * 100)::integer;
-- And rename: weekly_rate → weekly_rate_cents, etc.
```

**Drizzle schema diff:**
```ts
- weekly_rate: real("weekly_rate"),
+ weekly_rate_cents: integer("weekly_rate_cents"),
```

**Application impact** — significant:
- Every read site that does `parseFloat(...)` becomes `value / 100`.
- Every write site multiplies by 100.
- Display sites (`toFixed(2)`) become `(cents / 100).toFixed(2)`.
- `guest-portal.ts:885` becomes the natural identity: no `Math.round` needed, value is already in cents.

**Trade-offs:**
- ✅ Smallest, fastest, no rounding ever — used by Stripe internally and by many fintech systems.
- ✅ Dead-simple migration to .NET (`int`) or Java (`long`).
- ⚠️ Every existing read/write site must be edited (~40+ places).
- ⚠️ Variable-currency support (e.g. JPY = 0 fractional digits, BHD = 3) requires per-currency awareness or a separate "minor units" table.

### 4.3 Reconciliation step (applies to either option)

Because the existing `contracts.weekly_rate` may already drift from `bookings.agreed_weekly_rate`, the migration should include:

```sql
UPDATE contracts c
SET weekly_rate = b.agreed_weekly_rate::numeric(12,2),
    total_rent  = b.total_rent::numeric(12,2)
FROM bookings b
WHERE c.booking_id = b.id
  AND b.agreed_weekly_rate IS NOT NULL;
```

(under Option A; under Option B, multiply by 100). This re-grounds contracts in the (correct) booking-side values and erases historical `real` drift. Bond/advance values can then be recomputed by the same hard-coded `* 4` / `* 2` rules — but ideally those rules become parameters at the same time (CF-007).

### 4.4 Recommendation

**Option A** is the lowest-risk choice. It corrects the most serious flaw (CF-001, CF-002) with one DB migration and a handful of schema text edits, while leaving the application code largely untouched. **Option B** is the better long-term choice if a Phase 2 .NET port is committed, because integer cents eliminate an entire class of errors that no amount of `numeric(12,2)` discipline can prevent (e.g. forgetting to use `.toFixed(2)` at a display site).

**Phase 2 (.NET) note**: Whether the API moves to ASP.NET / EF Core or Java / Spring, the mapping `numeric → decimal/BigDecimal` is canonical. `real → float/Single` is also canonical but begs the question of why money is in `float`. Either choice (`numeric` or `cents`) defers the decision cleanly; the current `real` choice forces it on every reader.

---

## §5. Open items for next tasks

1. T002 (`_schema/erd-finance.md` revision) must call out the `real` vs `numeric` split per finance entity.
2. T004 (`_rules/financial-rules.md` revision) must adopt the rules from §2.2 (no hard-coded weeks; one weekly→monthly formula) as enforced rules.
3. T005 (workflow docs) must trace commission calc sites that are still unverified.
4. Any future T-task that proposes a schema change must reference the migration sketches in §4 instead of inventing new ones.

---
*End of MONEY_AUDIT.md*
