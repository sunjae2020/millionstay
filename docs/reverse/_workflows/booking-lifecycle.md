# Booking Lifecycle

> ✅ **T005-REWRITE** 2026-04-27 (T001 시점 146L NEEDS REVISION → 본 122L; T002 11 endpoint domain + T003 _context/domain-logic-booking.md 200L + T004 _rules/{architecture,security,no-magic}-rules.md 통합 + state-machines.md §1 source).
> **상위 source**: `_schema/state-machines.md §1` (8 main + outlier) / `_context/domain-logic-booking.md` (BR1-BR13 + 5 sub-flow) / `_schema/api-endpoints/booking.md` (27 ep / 189-cell self-check).
> **Cross-ref**: payment-workflow.md §3 (S2 invoice 생성 cascade) + checkin-checkout-workflow.md §1 (Active 전이) + agent-commission-workflow.md §1 (lead → booking) + maintenance-workflow.md §4 (cancellation refund partial).

---

## §1 BOOKING STATE MACHINE — 8 main + 1 outlier (CF-022 cross-pack leader 100%)

```
Draft → PendingPayment ──┐                Cancelled (any state, cancellation_reason 필수)
                          ├→ Confirmed → Active → CheckedOut → Archived
Draft → PendingApproval ─┘                ↑                   (S5 archive)
                                           └─ S2 patch /:id/confirm = contract auto-creation cascade
[outlier] guest-portal.ts:160 booking_status="Pending" (8 main 미존재 → 모든 admin transition 거부 dead-end; F7)
[outlier] NoShow (UI badge map only; 0 code path sets it; T001 RECON-VERIFIED)
```

**9 transitions enforce precondition** (`booking.md §4` 9/9 = 100%; CF-022 cross-pack leader vs contracts 0% floor):
- T1 confirm = `["PendingApproval","PendingPayment"]` 가드 → "Confirmed" + S2 cascade
- T2 cancel = any 가드 (cancellation_reason required `bookings.ts:531,560`)
- T3 check-in = `"Confirmed"` 가드 → "Active"
- T4 check-out = `"Active"` 가드 → "CheckedOut"
- T5 extend = `["Confirmed","Active"]` 가드 (checkin-checkout §3)

---

## §2 S2 BOOKING → CONTRACT AUTO-CREATION CASCADE (CF-014 max carrier)

**Trigger**: `PATCH /api/v1/bookings/:id/confirm` (`bookings.ts` T1) when 장기 booking (rent_type="Monthly") + invoice 생성 필요. 아래 ≥6+N+M sequential mutation 발생 + ZERO db.transaction (`db.transaction` = 3 known production runtime sites only: seedSync.ts:214 / dev-migration.ts:38 / SHP:365 — booking S2 미포함):

1. UPDATE bookings SET booking_status="Confirmed"
2. INSERT contracts (booking → contract write; bookings.total_rent=numeric → contracts.total_rent=real **PRECISION-LOSSY CF-001**)
3. INSERT contract_products[] (각 product per booking line)
4. ↓ helper `generateContractInvoicesAndSchedules(contractId)` (contracts.ts:55-237) — payment-workflow §3 7-step
5. logAction (`booking | id | STATUS_CHANGE`) — single audit row, child contract/invoice mutations 미감사 (CF-008)

**Phase 2 prescription** (security-rules §7 cross-ref): single transaction wrapper (Phase 1 .NET TransactionScope; 부분 failure 시 rollback) + helper child mutations 모두 audit row 발급 (CF-008 정책 통일).

---

## §3 CANCELLATION 통합 (사용자 가설 cancellation-refund scope 흡수)

**T2 cancel any-state path** (`bookings.ts:531,560`):
- precondition: `cancellation_reason` body 필수 (없으면 400)
- write: UPDATE bookings SET booking_status="Cancelled" + cancellation_reason
- side-effect: `unblockDatesForBooking(bookingId)` N-sequential-DELETE (idempotency 위해 `db.delete` 별도 사이트; `domain-logic-booking.md INV6`)
- cross-side: 활성 contract 존재 시 `contracts.contract_status` 변경 **부재** — orphan contract 발생 가능 (`domain-logic-contract.md INV6` cross-ref)

**Bond return 14-day** (F9 financial-rules §5.1 cross-ref): `bookings.ts:436` PDF 본문 text-only — 코드에 14-day timer / refund handler / escrow 부재. cancel 시 bond 환불 처리 비코드. Phase 2 `bond_return` 별도 entity + scheduled job.

---

## §4 CROSS-REF + Phase 2

- payment-workflow.md §3 — S2 helper invoice 생성
- checkin-checkout-workflow.md §1-3 — T3/T4/T5 active state 전이
- agent-commission-workflow.md §1 — leads.ts:175 /convert orphan booking_ref (CF-023.a)
- maintenance-workflow.md §4 — cancellation 후 work_orders 정리 패턴

**Phase 2 종합** (security-rules §7 + architecture-rules §3 5-step cross-ref): (1) S2 cascade transaction wrap / (2) cancellation_reason → enum + cancellation_at timestamp / (3) NoShow code path 발급 또는 schema 제거 / (4) F7 "Pending" 8 main 통합 또는 9th label 명시 / (5) bond return entity + schedule.

---

## §5 자가 검증 (3 spot-check ✅)

- C1 `bookings.ts:395-396` bond=4주/advance=2주 SWAP (사용자 가설 정정; T003 묶음 1 R-REPO-6 11회째)
- C2 `booking.md §4` 9/9 transitions = 100% guard (cross-pack leader)
- C3 `unblockDatesForBooking` N-DELETE pattern (booking domain-logic-booking.md INV6)
