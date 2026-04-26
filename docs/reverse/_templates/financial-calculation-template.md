# Financial Calculation Template

> ⚠️ **NEEDS REVISION** — see `docs/reverse/_audit/T001_RECON_REPORT.md` §g for specific corrections required. Will be rewritten in T002–T007 when its domain folder is processed.


## 1. Money helper

```ts
// artifacts/api-server/src/utils/money.ts
import Decimal from "decimal.js";
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export function money(v: number | string | Decimal): Decimal {
  return new Decimal(v ?? 0);
}

export function roundMoney(v: number | string | Decimal): number {
  return money(v).toDecimalPlaces(2).toNumber();
}

export function fmtAUD(v: number | string | Decimal): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" })
    .format(money(v).toNumber());
}
```

> Use `decimal.js` (a single dependency) anywhere money is added, multiplied, or compared. Never use raw `+`, `-`, `*` on float dollars.

## 2. Pro-rata weekly → daily

```ts
// daily rate when only weekly is known
export function dailyFromWeekly(weeklyRate: number | string): number {
  return roundMoney(money(weeklyRate).div(7));
}

export function proRataPeriod(weeklyRate: number | string, days: number): number {
  return roundMoney(money(weeklyRate).div(7).mul(days));
}
```

## 3. Period-based invoice generation (replaces the inline code in contracts.ts)

```ts
// services/contract-activation.ts
import { addDays, addMonths, differenceInDays, parseISO, formatISO } from "date-fns";
import { money, roundMoney } from "../utils/money";

export function buildInvoicePeriods(input: {
  startDate: string;
  endDate: string;
  weeklyRate: number;
  billingFrequency: "Weekly" | "Biweekly" | "Monthly";
}) {
  const periods: Array<{ start: string; end: string; days: number; amount: number }> = [];
  let cur = parseISO(input.startDate);
  const end = parseISO(input.endDate);

  while (cur < end) {
    const next =
      input.billingFrequency === "Weekly"   ? addDays(cur, 7)
    : input.billingFrequency === "Biweekly" ? addDays(cur, 14)
    : /* Monthly */                           addMonths(cur, 1);

    const periodEnd = next > end ? end : next;
    const days = differenceInDays(periodEnd, cur);
    const amount = roundMoney(money(input.weeklyRate).div(7).mul(days));

    periods.push({ start: formatISO(cur, { representation: "date" }), end: formatISO(periodEnd, { representation: "date" }), days, amount });
    cur = next;
  }
  return periods;
}
```

## 4. "Est. Due Today" canonical implementation

Both the API and the booking wizard must agree. Place this in `lib/db/src/calculators/booking-quote.ts` (shared between server and client):

```ts
export interface BookingQuoteInput {
  weeklyRate: number;
  bondAmount?: number;        // if omitted, defaults to weeklyRate * 4 for long stays
  adminFee?: number;
  cleaningFee?: number;
  extraServicesTotal?: number;
  checkInDate: string;
  checkOutDate: string;
}

export interface BookingQuote {
  stayDays: number;
  isLong: boolean;
  bond: number;
  adminFee: number;
  cleaningFee: number;
  proRataRent: number;
  twoWeeksRent: number;
  extraServices: number;
  dueToday: number;
  breakdown: Array<{ label: string; amount: number }>;
}

export function quoteBooking(i: BookingQuoteInput): BookingQuote {
  const stayDays = (new Date(i.checkOutDate).getTime() - new Date(i.checkInDate).getTime()) / 86400000;
  const isLong   = stayDays >= 28;
  const bond     = i.bondAmount && i.bondAmount > 0 ? i.bondAmount : roundMoney(i.weeklyRate * 4);
  const admin    = i.adminFee ?? 0;
  const cleaning = i.cleaningFee ?? 0;
  const extras   = i.extraServicesTotal ?? 0;

  const proRataRent  = roundMoney((i.weeklyRate / 7) * stayDays);
  const twoWeeksRent = roundMoney(i.weeklyRate * 2);

  const dueToday = isLong
    ? roundMoney(bond + admin + cleaning + twoWeeksRent + extras)
    : roundMoney(proRataRent + bond + admin + cleaning + extras);

  const breakdown = isLong
    ? [
        { label: "Bond",            amount: bond },
        { label: "Admin Fee",       amount: admin },
        { label: "Cleaning Fee",    amount: cleaning },
        { label: "2 weeks rent",    amount: twoWeeksRent },
        { label: "Extra services",  amount: extras },
      ]
    : [
        { label: `Pro-rata rent (${stayDays} nights)`, amount: proRataRent },
        { label: "Bond",           amount: bond },
        { label: "Admin Fee",      amount: admin },
        { label: "Cleaning Fee",   amount: cleaning },
        { label: "Extra services", amount: extras },
      ];

  return { stayDays, isLong, bond, adminFee: admin, cleaningFee: cleaning, proRataRent, twoWeeksRent, extraServices: extras, dueToday, breakdown };
}
```

Expose at `GET /api/v1/bookings/quote` so the booking wizard and admin dashboard both read the same numbers.

## 5. Commission template

```ts
// services/commission-service.ts
export interface CommissionRule {
  type: "Percentage" | "Fixed";
  rate?: number;       // percent
  amount?: number;     // flat
}

export function calculateCommission(rule: CommissionRule, rentAmount: number): number {
  if (rule.type === "Percentage" && rule.rate) {
    return roundMoney(money(rentAmount).mul(rule.rate).div(100));
  }
  return roundMoney(rule.amount ?? 0);
}
```

Always **snapshot** the result into `commission_earnings` at confirm-time so future rate changes do not retroactively shift history.

## 6. Required when changing money behaviour

- [ ] Use `decimal.js` for every step
- [ ] Single rounding step at the end (`roundMoney`)
- [ ] Cover with a Vitest unit test
- [ ] Add a `system_log` entry if the change is via an admin endpoint
