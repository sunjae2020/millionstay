# Check-in / Check-out / Extension Workflow

> ✅ **T005-REWRITE** 2026-04-27 (T001 시점 127L T001-VERIFIED → 본 118L; T002 booking.md §4 transition + state-machines.md §1 + T003 _context/domain-logic-booking.md INV1-8 + T004 _rules/{security,no-magic}-rules.md 통합).
> **상위 source**: `_schema/state-machines.md §1` (8 main + Pending outlier) / `_context/domain-logic-booking.md §3` INV5 PendingPayment-Active gap.
> **Cross-ref**: booking-lifecycle.md §1 (T3/T4/T5 transition) + payment-workflow.md §1 (Paid invoice 후 active) + maintenance-workflow.md §1 (active booking → work_orders 생성).

---

## §1 CHECK-IN WORKFLOW — T3 (gated)

**Endpoint**: `PATCH /api/v1/bookings/:id/check-in` (`bookings.ts` T3, T001-VERIFIED)

**Precondition**: `booking.booking_status === "Confirmed"` (단일 가드, 명시 enum 미사용 string compare)

**Write**:
1. UPDATE bookings SET booking_status="Active"
2. logAction(`booking | id | STATUS_CHANGE | "Confirmed" → "Active"`)

**INV5 PendingPayment-Active gap** (domain-logic-booking.md): `"PendingPayment"` 상태에서 직접 `/check-in` 가드 거부 → 반드시 `/confirm` (T1) 거쳐 "Confirmed" 후 check-in 가능. 운영 함정: 결제 완료 + 즉시 입실 운영자가 두 번 클릭 (T1 → T3) 필요.

**검증 부재 항목** (T001 시점 명시 + T005 재검증):
- 실제 check-in 시각 vs `bookings.start_date` 차이 — 미검증 (날짜 무관 active 진입 가능)
- contract 존재 여부 — 미검증 (장기 booking S2 cascade 미실행 시에도 active 진입 가능)
- payment 완료 여부 — 미검증 (Sent invoice 미수 상태에서도 active 진입 가능; CF-022 cross-pack discipline)

---

## §2 CHECK-OUT WORKFLOW — T4 (gated)

**Endpoint**: `PATCH /api/v1/bookings/:id/check-out` (`bookings.ts` T4)

**Precondition**: `booking.booking_status === "Active"` (단일 가드)

**Write**:
1. UPDATE bookings SET booking_status="CheckedOut"
2. logAction(`booking | id | STATUS_CHANGE | "Active" → "CheckedOut"`)

**Bond return 14-day** (F9 cross-ref financial-rules §5.1 + booking-lifecycle.md §3):
- `bookings.ts:436` PDF 본문 "We will return your bond within 14 days of check-out" text-only
- 코드에 14-day timer / refund handler / escrow / scheduled job **부재**
- check-out 후 bond 환불 처리는 운영자 수동 (Stripe dashboard 직접 조작; 코드 0 hit)
- 결과: bond return audit trail 부재; 분쟁 시 증거 부족

**Phase 2 prescription** (financial-rules §5.1): `bond_return` 별도 entity (state machine: Pending → Scheduled → Refunded) + scheduled job 14-day countdown + Stripe refund API 통합.

---

## §3 EXTENSION WORKFLOW — T5 (사용자 가설 extension-renewal scope 흡수)

**Endpoint**: `PATCH /api/v1/bookings/:id/extend` (`bookings.ts` T5)

**Precondition**: `booking.booking_status IN ["Confirmed","Active"]` (배열 가드 — 두 상태에서만 허용)

**Write**:
1. UPDATE bookings SET end_date = new_end_date (extend duration body)
2. side-effect: `blockDatesForBooking(bookingId, additionalDates)` N-sequential-INSERT (no transaction; INV6 idempotency)
3. cross-side: 장기 booking 활성 contract 존재 시 contract end_date / payment_schedules 갱신 **부재** — orphan extension (contract 종료일 booking 종료일 불일치) 발생 가능

**Renewal vs Extension 구분**: 코드에 "renewal" 별도 endpoint **부재** — extension 은 동일 booking 의 end_date 만 늘림. 새 contract 발급 / 새 payment_schedules 발급 = 운영자 수동 신규 booking 작성 (booking-lifecycle.md §1 신규 cycle).

---

## §4 F7 PENDING DEAD-END (no-magic-rules §5.1 cross-ref)

`guest-portal.ts:160-162` insert:
- `booking_status: "Pending"` (8 main + 1 NoShow 미존재 → 9th label F7)
- `status: "Active"` (bookings 컬럼 미존재 — `bookings.status` 컬럼 없음; insert silently ignored)

→ guest-portal 통해 들어온 booking = 모든 admin transition 거부 (T1/T2/T3/T4/T5 모두 precondition 거부). dead-end.

**Phase 2 prescription** (no-magic-rules §5.1): (1) 8 main 으로 통합 (`"PendingApproval"`) 또는 (2) 9th label `"Pending"` 명시 enum 등록 + transition 매핑.

---

## §5 자가 검증 (3 spot-check ✅)

- C1 T3 `eq(status,"Confirmed")` 단일 가드 (booking.md §4 9/9 100%)
- C2 F9 `bookings.ts:436` PDF text-only — `rg "14.*day" --type=ts -t ts` 0 timer hit
- C3 F7 `guest-portal.ts:160-162` insert literal "Pending" + "Active" — schema 미정합
