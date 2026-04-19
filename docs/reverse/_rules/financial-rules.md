# Financial Rules

## 1. Rounding patterns

| Location | Pattern | Risk |
|---|---|---|
| `bookings.ts` | `parseFloat((weeks * parseFloat(weeklyRate)).toFixed(2))` | Float intermediate — risk of `0.1+0.2` style drift |
| `booking-new.tsx` | `Math.round((weeklyRate / 7) * cardDays * 100) / 100` | Float intermediate — same risk |
| `contracts.ts` (monthly) | `parseFloat((weeklyRate * (52 / 12)).toFixed(2))` | Float intermediate; the literal `52/12 = 4.333...` is a tiny precision loss every month |

There is **no centralized rounding utility** and no use of a decimal library (`decimal.js`, `big.js`). Once `invoices.amount` is read back, Drizzle returns it as a string — but downstream calculations parse it back to `parseFloat`, defeating the precision benefit.

**Rule for new code:**

```ts
function roundMoney(v: number): number {
  return Math.round(v * 100) / 100;
}
// Or, ideally, use a Decimal library and store always as `numeric` in DB.
```

## 2. Est. Due Today formula (frontend only)

```ts
// artifacts/million-stay-web/src/pages/booking-new.tsx (lines 127-129)
const cardLongBond = bond > 0 ? bond : weeklyRate * 4;
const shortTotal   = cardProRata + bond + adminFee + cleaningFee + servicesTotal;
const longInitial  = cardLongBond + adminFee + cleaningFee + (weeklyRate * 2) + servicesTotal;
```

- **Long-term (≥28 days):** `Bond + Admin + Cleaning + 2 weeks rent + extra services`. Bond defaults to `weeklyRate × 4` if not explicitly set.
- **Short-term:** `Pro-rata rent + Bond + Admin + Cleaning + extra services` where pro-rata = `(weeklyRate / 7) × stayDays`.

**Risk:** the server (`POST /v1/bookings`) does not recompute. If the frontend formula and product data drift, billing reality (the contract's invoice batch on activate) won't match the guest's quoted amount.

**Rule:** server should expose `GET /v1/bookings/quote?space_id&product_id&check_in&check_out` returning the canonical breakdown so the frontend can match.

## 3. Invoice handling

### Mutability

`PUT /v1/invoices/:id` accepts `amount`, `due_date`, `description`, `notes` with no status guard. Even `Paid` invoices can be edited.

**Rule (recommended):**

```ts
if (existing.status === "Paid" || existing.status === "Void") {
  return res.status(409).json({
    error: { code: "INVOICE_LOCKED", message: "Paid or void invoices cannot be edited. Issue a credit note." },
  });
}
```

### Credit note / void

A `void` action exists, but a paired credit-note generator does not. Currently the void flips status without producing a counter-entry. For migration to a real GL, a credit-note table or a sign-flipped invoice row is required.

### Cancellation impact on future invoices

When a booking is cancelled (`PATCH /v1/bookings/:id/cancel`):

- `space_blocked_dates` rows are deleted.
- The associated contract is **not automatically terminated**.
- Future `Sent` invoices on that contract are **not voided**.

This is a real bug with money implications. **Rule:** cancelling a booking should:
1. Terminate the linked contract (or mark `superseded`).
2. Void all unpaid future invoices for that contract.
3. Log all of the above into `system_log`.

## 4. Promotion / discount rules

- Single FK per product (`contract_products.promotion_id`). **No stacking.**
- Discount is applied at product-record time and cached as `effective_weekly_rate`. The promotion's `start_date` / `end_date` is **not re-validated** at booking creation — an expired promotion's discounted rate persists until an admin manually re-saves the product.

**Rule (recommended):** at booking creation, re-resolve the promotion and recompute `effective_weekly_rate` if the promotion has expired. Store the original price alongside the discounted price.

## 5. Commission rules

```ts
// routes/agent-portal.ts:251
const earned = commission?.commission_type === "Percentage" && commission.commission_rate
  ? rentAmount * (commission.commission_rate / 100)
  : commission?.commission_amount ?? 0;
```

- `rentAmount` = `bookings.total_rent`.
- Computed lazily on the agent's portal request — there is no `commission_payouts` table and no point-in-time freezing of the commission rate.
- **Rule (recommended):** snapshot commission at booking-confirm time into a `commission_earnings` table with `(booking_id, agent_account_id, rate_or_amount, computed_amount, status)`. This is required for any payout reconciliation and for accurate historical reporting if rates change.

## 6. Payment schedule generation

```ts
// routes/contracts.ts:55  generateContractInvoicesAndSchedules(contractId)
// Trigger: POST /v1/contracts/:id/activate (line 430)

// Iterates from start_date to end_date in steps based on billing_frequency:
//  Weekly:    addDays(current, 7)
//  Biweekly:  addDays(current, 14)
//  Monthly:   addMonths(current, 1)
// Last partial period: periodEnd = nextDate > end ? end : nextDate
```

- **First payment**: not specially handled — the first invoice covers the first period from `start_date`.
- **Last partial period**: pro-rated by date math (period length capped at `end_date`); amount is `weeklyRate × (period_days / 7)` rounded.
- **Bond**: NOT a separate invoice line in the generated batch — it's pulled in via the booking application's "Est. Due Today" front-loading.

## 7. ATO / GST notes

- All rates assume **GST-inclusive**. There is no `gst_rate` column on `contract_products`.
- `recurring_schedule.gst_included` exists but is mostly cosmetic.
- For ATO compliance reporting, a per-line GST split is missing — this is a **🔴 blocker for any tax-reporting integration**.

## 8. Currency

- Default `AUD` everywhere via column default.
- No FX conversion code.
- Currency is stored on every money-bearing table (`bookings.currency`, `invoices.currency`, etc.) — defensively redundant but acceptable.
