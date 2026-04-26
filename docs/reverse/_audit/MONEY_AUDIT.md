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
| `product_catalog` | `price` | `real` | yes | — | `product_catalog.ts:10` | 🪦 dead table — see CF-009 (revised) |
| `product_catalog` | `bond_amount` | `real` | yes | — | `product_catalog.ts:19` | 🪦 dead |
| `product_catalog` | `admin_fee` | `real` | yes | — | `product_catalog.ts:20` | 🪦 dead |
| `product_catalog` | `cleaning_fee` | `real` | yes | — | `product_catalog.ts:21` | 🪦 dead |
| `contract_products` | `weekly_rate` | `real` | yes | — | `products.ts:14` | ⚠ active — file misnamed; see CF-009 rev. |
| `contract_products` | `monthly_rate` | `real` | yes | — | `products.ts:15` | ⚠ active |
| `contract_products` | `effective_weekly_rate` | `real` | yes | — | `products.ts:16` | ⚠ active, written by route — see §2.3 |
| `contract_products` | `bond_weeks` | `real` | yes | `4` | `products.ts:19` | (count) — active |
| `contract_products` | `bond_amount` | `real` | yes | — | `products.ts:20` | ⚠ active |
| `contract_products` | `admin_fee` | `real` | yes | — | `products.ts:21` | ⚠ active |
| `contract_products` | `cleaning_fee` | `real` | yes | — | `products.ts:22` | ⚠ active |
| `service_catalog` | `base_price` | `real` | yes | — | `service_catalog.ts:9` | — |
| `space_service_catalog` | `custom_price` | `real` | yes | — | `space_service_catalog.ts:8` | — |
| `spaces` | `base_weekly_price` | `real` | yes | — | `spaces.ts:13` | — |
| `spaces` | `base_daily_price` | `real` | yes | — | `spaces.ts:14` | — |
| `work_orders` | `cost` | `real` | yes | — | `work_orders.ts:17` | — |

**Subtotal**: 30 columns. All inexact. **Four** of them are in the dead `product_catalog` table (CF-009 revised — see [`_schema/SCHEMA_FILE_TABLE_MAP.md`](../_schema/SCHEMA_FILE_TABLE_MAP.md)); the other **seven** previously attributed to a "`products`" table actually belong to the **active** `contract_products` table (file misnamed — see CF-016). Net: 4 dead-table money columns can be ignored for reconciliation; the other 26 are live precision risks.

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
| Weekly rate | `bookings.agreed_weekly_rate` (`numeric(12,2)`) | `contracts.weekly_rate` (`real`), `accommodation_catalog.weekly_rate` (`real`), `contract_products.weekly_rate` (`real` — active; file `products.ts`), `spaces.base_weekly_price` (`real`) | Confirmed cross-table copy at `bookings.ts:458` 🔴 |
| Total rent | `bookings.total_rent` (`numeric(12,2)`) | `contracts.total_rent` (`real`) | Confirmed cross-table copy at `bookings.ts:459` 🔴 |
| Bond amount | (none) | `contracts.bond_amount`, `accommodation_catalog.bond_amount`, `contract_products.bond_amount` (active; file `products.ts`) | Computed inline; written to real |
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
| `accommodation_catalog.ts:25`, `products.ts:19` *(file `products.ts` defines `contract_products`)* | `bond_weeks: real("bond_weeks").default(4)` | configurable but unused at calc sites |

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

(Note: corrected 2026-04-26 per T002.1.6 — there is no separate `products` table. The schema file `products.ts` declares **only** `contract_products`, and that is where `effective_weekly_rate` lives. See [`_schema/SCHEMA_FILE_TABLE_MAP.md` §3](../_schema/SCHEMA_FILE_TABLE_MAP.md#3-file-name-vs-table-name-divergences-the-trap) for the full file-name vs table-name divergence list, CF-009 (revised) for the dead-table re-classification, and CF-016 for why this divergence pattern is systematic.)

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

## §5. Reconciliation Test Scenarios

> **Purpose**: Tests defined here verify financial integrity *before* and *after* a money-type migration (Option A or B from §4). They are also valuable as ongoing data-quality checks. Each TC includes (i) a plain-language assertion, (ii) the source of truth for each side of the comparison, (iii) a SQL query sketch that returns the *violation* rows (zero rows = pass), and (iv) the failure-mode each TC catches.
> **Convention**: All queries are PostgreSQL. The sketches use the current schema; after Option A migration, replace `::numeric(12,2)` casts as appropriate.

### TC-M01 — Booking ↔ Contract weekly_rate exact match

**Assertion**: For every contract that has a `booking_id`, the contract's `weekly_rate` must equal the source booking's `agreed_weekly_rate` to the cent.
**Why it matters**: CF-002 (`bookings.ts:393, 458`). Today's `numeric → real` write is precision-lossy.
**SQL** (returns violation rows):
```sql
SELECT
  c.id            AS contract_id,
  c.contract_ref,
  b.id            AS booking_id,
  b.agreed_weekly_rate::numeric(12,2)  AS booking_rate,
  c.weekly_rate::numeric(12,2)         AS contract_rate,
  (b.agreed_weekly_rate::numeric(12,2)
     - c.weekly_rate::numeric(12,2))   AS delta
FROM contracts c
JOIN bookings  b ON b.id = c.booking_id
WHERE c.deleted_at IS NULL
  AND b.deleted_at IS NULL
  AND c.weekly_rate IS NOT NULL
  AND b.agreed_weekly_rate IS NOT NULL
  AND b.agreed_weekly_rate::numeric(12,2) <> c.weekly_rate::numeric(12,2);
-- Expected: 0 rows. Each row is a precision-loss footprint.
```
**Failure mode caught**: Float drift, manual contract edits that diverge from the booking, missing booking propagation after rate change.

### TC-M02 — Contract line items sum equals contract total_rent

**Assertion**: For every active contract, `SUM(contract_line_items.total_price)` for the contract equals `contracts.total_rent`.
**Why it matters**: §3.2 — line items are the durable representation; the contract-level rollup must agree.
**SQL**:
```sql
WITH lines AS (
  SELECT contract_id, SUM(total_price)::numeric(12,2) AS lines_total
  FROM contract_line_items
  GROUP BY contract_id
)
SELECT
  c.id           AS contract_id,
  c.contract_ref,
  c.total_rent::numeric(12,2)   AS contract_total_rent,
  l.lines_total                 AS line_items_sum,
  (c.total_rent::numeric(12,2) - l.lines_total) AS delta
FROM contracts c
LEFT JOIN lines l ON l.contract_id = c.id
WHERE c.status = 'Active'
  AND c.deleted_at IS NULL
  AND c.total_rent IS NOT NULL
  AND COALESCE(l.lines_total, 0) <> c.total_rent::numeric(12,2);
-- Expected: 0 rows.
-- Caveat: contracts where line items represent extras (services), not the rent itself, must be excluded — see contract_line_items.line_type once enumerated in T002.
```
**Failure mode caught**: Hand-edited line items that don't update the contract header; bulk insert paths that skip the rollup.

### TC-M03 — Paid invoices reconcile to contract cumulative settlement

**Assertion**: For every contract, `SUM(invoices.amount WHERE status = 'Paid' AND contract_id = c.id)` equals the contract's expected settled amount up to the current date (computed from the schedule).
**Why it matters**: Owner statements and agent commission settlements join `invoices.status = 'Paid'`. CF-010 (Stripe refund/failure → no invoice update) means the LHS may be over-counted.
**SQL** (looser form: paid invoices vs schedule for due-by-today):
```sql
WITH paid AS (
  SELECT contract_id, SUM(amount)::numeric(12,2) AS paid_total
  FROM invoices
  WHERE status = 'Paid' AND deleted_at IS NULL
  GROUP BY contract_id
),
sched_due AS (
  SELECT contract_id, SUM(amount)::numeric(12,2) AS scheduled_to_date
  FROM recurring_schedules
  WHERE next_due_date <= CURRENT_DATE
    AND deleted_at IS NULL
  GROUP BY contract_id
)
SELECT
  c.id, c.contract_ref,
  COALESCE(p.paid_total, 0)        AS paid_total,
  COALESCE(s.scheduled_to_date, 0) AS scheduled_to_date,
  (COALESCE(p.paid_total, 0) - COALESCE(s.scheduled_to_date, 0)) AS over_under
FROM contracts c
LEFT JOIN paid       p ON p.contract_id = c.id
LEFT JOIN sched_due  s ON s.contract_id = c.id
WHERE c.status IN ('Active','Completed')
  AND c.deleted_at IS NULL
  AND ABS(COALESCE(p.paid_total, 0) - COALESCE(s.scheduled_to_date, 0)) > 0.01;
-- Expected: 0 rows for clean accounts; pre-pays and arrears are flagged.
-- Note: post-CF-010 fix this query should also EXCLUDE refunded amounts via invoices.refunded_amount.
```
**Failure mode caught**: Refunded invoices still showing as Paid (CF-010); duplicate invoice generation from CF-014 retry-without-transaction.

### TC-M04 — Bond invariant: `bond_amount = weekly_rate × 4`

**Assertion**: For every active contract, the recorded `bond_amount` equals `weekly_rate × 4` to the cent (the rule hard-coded at `bookings.ts:395`).
**Why it matters**: CF-007 — the rule is hard-coded but the column is mutable. A manual `UPDATE contracts SET bond_amount = …` would silently break the invariant.
**SQL**:
```sql
SELECT
  c.id, c.contract_ref,
  c.weekly_rate::numeric(12,2)               AS weekly_rate,
  c.bond_amount::numeric(12,2)               AS bond_amount,
  (c.weekly_rate * 4)::numeric(12,2)         AS expected_bond,
  (c.bond_amount - c.weekly_rate * 4)::numeric(12,2) AS delta
FROM contracts c
WHERE c.status = 'Active'
  AND c.deleted_at IS NULL
  AND c.weekly_rate IS NOT NULL
  AND c.bond_amount IS NOT NULL
  AND ABS(c.bond_amount - c.weekly_rate * 4) > 0.005;
-- Expected: 0 rows under the current hard-coded rule.
-- After CF-007 fix (configurable bond_weeks), the multiplier becomes a per-property/per-property override and this TC must read the override instead of "4".
```
**Failure mode caught**: Manual DB edits; CF-001/CF-002 float drift propagated into the bond field; future per-property bond_weeks overrides not respected by booking confirmation.

### TC-M05 — Stripe charge cents matches invoice amount

**Assertion**: For every paid invoice, the Stripe payment intent (or charge) `amount` field (cents) equals `ROUND(invoices.amount × 100)`.
**Why it matters**: §3.5 boundary conversion at `guest-portal.ts:885`. A regression that drops the `Math.round` (or shifts to truncation) causes systematic 1-cent shortfalls.
**Source of truth**: Stripe API (this is the only TC that requires an external fetch).
**Pseudo-SQL + verification step**:
```sql
-- Step 1: from system_logs, recover the (invoice_id, stripe_payment_intent) pairs.
SELECT
  (sl.new_value ->> 'stripe_payment_intent') AS payment_intent_id,
  sl.entity_id                               AS invoice_id,
  i.amount::numeric(10,2)                    AS invoice_amount,
  ROUND(i.amount::numeric * 100)             AS expected_cents
FROM system_logs sl
JOIN invoices i ON i.id = sl.entity_id
WHERE sl.entity_type = 'invoice'
  AND sl.action = 'PAYMENT'
  AND sl.new_value ->> 'stripe_payment_intent' IS NOT NULL
  AND i.deleted_at IS NULL;

-- Step 2: for each row, fetch stripe.PaymentIntent(<id>).amount via Stripe API,
-- assert == expected_cents. Mismatches are the failure set.
```
**Failure mode caught**: Floating-point drift in the JS `Number(invoice.amount) * 100` step; future code that omits `Math.round`; Stripe currency unit mismatches (e.g. JPY where cents conversion is identity, not ×100).

### Summary

| TC | Catches | Phase-2 readiness |
|---|---|---|
| TC-M01 | CF-001, CF-002 | ✅ pure SQL, runnable today |
| TC-M02 | Schema/header drift | ✅ pure SQL |
| TC-M03 | CF-010, CF-014 | ✅ pure SQL (assumes scheduled_to_date model) |
| TC-M04 | CF-007 | ✅ pure SQL |
| TC-M05 | guest-portal:885 boundary | ⚠️ needs Stripe API access |

These five tests, run before any large data movement, catch every P0/P1 finance-class finding from CRITICAL_FINDINGS as a *measured* number rather than a hypothetical risk.

---

## §6. Open items for next tasks

1. T002 (`_schema/erd-finance.md` revision) must call out the `real` vs `numeric` split per finance entity.
2. T004 (`_rules/financial-rules.md` revision) must adopt the rules from §2.2 (no hard-coded weeks; one weekly→monthly formula) as enforced rules.
3. T005 (workflow docs) must trace commission calc sites that are still unverified.
4. Any future T-task that proposes a schema change must reference the migration sketches in §4 instead of inventing new ones.
5. T007 (`_test/`) must adopt §5 TC-M01..05 as named reconciliation cases.

---
*End of MONEY_AUDIT.md*
