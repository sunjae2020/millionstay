# Financial Calculation Template

> ✅ **T007-REWRITE** 2026-04-27 — T002~T006 자산 통합. CF anchor: CF-001 (numeric 통일) + CF-002 (precision-lossy path) + CF-006 (Formula B 4-site) + CF-007 (bond=4주/advance=2주 hard-code) + MONEY_AUDIT TC-M01-05.

## 1. Money helper (Phase 2 baseline — `decimal.js`)

```ts
// artifacts/api-server/src/utils/money.ts
import Decimal from "decimal.js";
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export function money(v: number | string | Decimal): Decimal { return new Decimal(v ?? 0); }
export function roundMoney(v: number | string | Decimal): number { return money(v).toDecimalPlaces(2).toNumber(); }
export function fmtAUD(v: number | string | Decimal): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(money(v).toNumber());
}
```

> 현재 코드는 raw `+` `-` `*` on float dollars 다수 (`bookings.ts:395-396` + `contracts.ts:55-237` + `commissions.ts:69`) → **CF-001/CF-002 root cause**. Phase 2 = 모든 money path 위 헬퍼 강제.

## 2. CF-001 numeric 통일 (Phase 2 prescription #2)

| 컬럼 | 현재 | Phase 2 | 영향 |
|------|------|---------|------|
| `bookings.total_rent` | `numeric` ✓ | 유지 | source ✓ |
| `contracts.total_rent` | `real` ⚠️ | `numeric(10,2)` | **CF-002 lossy path** (booking → contract 시 precision 손실) |
| `contract_products.weekly_rate` | `real` ⚠️ | `numeric(10,2)` | upstream rate ⚠️ |
| `commissions.amount` | `real` ⚠️ | `numeric(10,2)` | **CF-001 finance-internal 양극단** (invoices.amount=numeric ✓ vs commissions=real ⚠️ split) |
| `work_orders.cost` | `real` ⚠️ | `numeric(10,2)` | maintenance |
| `service_catalog.price` | `real` ⚠️ | `numeric(10,2)` | catalog |

→ MONEY_AUDIT 41 cols × `_schema/db-schema-overview.md` §4 cross-ref. **products hallucinated 정정** = T001.6 T001 시점 6 cols / MONEY_AUDIT 추가 컬럼 → T002.1.6 forensic re-audit 시 hallucinated 확인 → 본 표에서 제외.

## 3. CF-006 Formula B 4-site (centralisation-first prescription)

`weekly_rate * 52 / 12` (Formula B) = 12개월 month rate 환산. 4 site 분포:
- `bookings.ts:485` Formula B
- `contracts.ts:92` Formula B
- `contracts.ts:94` Formula B (helper `generateContractInvoicesAndSchedules`)
- `dashboard.ts` Formula A (`weekly * 4`) — **유일 outlier**

→ Phase 2 = `lib/db/src/calculators/period-rate.ts` 단일 helper 추출. Dashboard alignment.

## 4. CF-007 bond/advance hard-coded (R-REPO-6 11회째 SWAP 정정)

```ts
// bookings.ts:395-396 — confirm handler
bond_amount:    weekly_rate * 4,   // 4주 보증금
advance_amount: weekly_rate * 2,   // 2주 선납
```

> ⚠️ **사용자 가설 SWAP 정정 (T003 묶음 1)**: 사용자 안 "bond 2주 / advance 4주" → ground truth `bookings.ts:395` `*4` (bond=4주) / `:396` `*2` (advance=2주) SWAP. R-REPO-6 11회째.

→ Phase 2 = `IBusinessRules` 인터페이스 추출 (no-magic-rules §1 cross-ref; `BondWeeks=4` + `AdvanceWeeks=2` configurable).

## 5. Pro-rata + period invoice generation (Phase 2 baseline)

```ts
export function dailyFromWeekly(weeklyRate: number | string): number {
  return roundMoney(money(weeklyRate).div(7));
}

export function buildInvoicePeriods(input: {
  startDate: string; endDate: string; weeklyRate: number;
  billingFrequency: "Weekly" | "Biweekly" | "Monthly";
}) {
  const periods: Array<{ start: string; end: string; days: number; amount: number }> = [];
  let cur = parseISO(input.startDate); const end = parseISO(input.endDate);
  while (cur < end) {
    const next = input.billingFrequency === "Weekly" ? addDays(cur, 7)
               : input.billingFrequency === "Biweekly" ? addDays(cur, 14)
               : addMonths(cur, 1);
    const periodEnd = next > end ? end : next;
    const days = differenceInDays(periodEnd, cur);
    const amount = roundMoney(money(input.weeklyRate).div(7).mul(days));
    periods.push({ start: formatISO(cur, { representation: "date" }), end: formatISO(periodEnd, { representation: "date" }), days, amount });
    cur = next;
  }
  return periods;
}
```

→ **현재 inline 구현** = `contracts.ts:55-237` helper `generateContractInvoicesAndSchedules` (≥27 mutation 0 db.transaction = **CF-014 max carrier**). Phase 2 = 위 helper 추출 + `db.transaction` 래핑 + 500-iter safety + paidKeys 보존 (idempotency `db.delete` 호출 후 재생성 패턴).

## 6. Bond return (F9 incidental — 14-day text-only)

`bookings.ts:436` PDF 본문 "Bond will be returned within 14 days" — 코드 어디에도 14-day timer / refund handler / escrow 없음. T3 check-out 시 bond 보유 상태로 영구 잔류.

→ Phase 2 = `bond_return` 별도 entity (`scheduled_for: timestamptz` + `processed_at: timestamptz` + `amount: numeric`) + scheduled job. `_rules/financial-rules.md` §5.1 cross-ref.

## 7. Commissions snapshot (F12 incidental — `status` enum 부재)

```ts
export interface CommissionRule { type: "Percentage" | "Fixed"; rate?: number; amount?: number; }
export function calculateCommission(rule: CommissionRule, rentAmount: number): number {
  if (rule.type === "Percentage" && rule.rate) {
    return roundMoney(money(rentAmount).mul(rule.rate).div(100));
  }
  return roundMoney(rule.amount ?? 0);
}
```

→ **Snapshot at confirm-time** into `commission_earnings` so future rate changes do not retroactively shift history. `commissions.amount=real` (CF-001) — Phase 2 numeric 변환 필수. **F12** = `commissions.status` enum 정의 부재 (Archived 만 등장 — 다른 status 의미 불명) → Phase 2 = `enum CommissionStatus { Pending, Paid, Archived }` 명시화. `_rules/financial-rules.md` §5.2 cross-ref.

## 8. Promotion application (F14 incidental — snapshot 부재)

`contract_products` PUT 으로 amount 변경 시 미래 contract activate 의 invoice line items 와 historical contract record 의 amount 가 시점 차이 발생 가능.

→ Phase 2 = contract activate 시점 `contract_products` 컬럼 snapshot (effective_at_activation). `_workflows/promotion-application-logic.md` §1 + `_rules/financial-rules.md` §5.3 cross-ref.

## 9. MONEY_AUDIT TC-M01-05 (Phase 0 reconciliation tests)

| TC | Scenario | 검증 |
|----|----------|------|
| TC-M01 | bookings.total_rent → contracts.total_rent precision parity | 3 decimal source numeric → real conversion 후 `=` 비교 (CF-002 lossy 검출) |
| TC-M02 | contract.weekly_rate × periods sum = invoices total | invoice 누적 합계 = contract.total_rent ± rounding (`_test/booking-test-cases.md` CT-04 cross-ref) |
| TC-M03 | commission rate × rent = commissions.amount snapshot | live recompute = stored snapshot (AC-01 fix) |
| TC-M04 | Stripe webhook total = invoices.amount | webhook payload `amount_received` = `invoices.amount` (CF-010) |
| TC-M05 | bond + advance = `(weekly*4) + (weekly*2)` confirm-time | 6주 합계 invariant (CF-007) |

→ `_test/existing-test-coverage.md` §3 + MONEY_AUDIT.md §5 cross-ref.

## 10. Required when changing money behaviour

- [ ] Use `decimal.js` for every step (raw `+` `-` `*` 금지)
- [ ] Single rounding step at the end (`roundMoney`)
- [ ] Cover with Vitest unit test (TC-M01-05 + Formula B + bond/advance)
- [ ] Add `system_log` entry (audit-log-template §3 PAYMENT action) — CF-008 6-way TIE backfill
- [ ] Wrap multi-step writes in `db.transaction` — CF-014 max carrier 회피
