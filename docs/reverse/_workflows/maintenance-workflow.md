# Maintenance & CS Workflow

> ✅ **T005-REWRITE** 2026-04-27 (T001 시점 123L NEEDS REVISION → 본 130L; T002 ops-crm.md + state-machines.md §5-6 + T003 _context/domain-logic-ops-crm.md 380L + T004 _rules/{architecture,no-magic}-rules.md 통합 + work_orders 4 transition 정확화 R-REPO-6 12회째).
> **상위 source**: `_schema/state-machines.md §5` work_orders 6 + `§6` cs_tickets 3 / `_context/domain-logic-ops-crm.md §1` BR1-BR14.
> **Cross-ref**: booking-lifecycle.md §3 (cancellation 후 work_orders 정리 부재) + checkin-checkout-workflow.md §1 (active booking → work_orders 생성 trigger 부재).

---

## §1 WORK_ORDERS WORKFLOW — 4 transition (CF-022 50%, R-REPO-6 12회째 정확화)

```
Open ──► InProgress ──► PendingReview ──► Completed
   │           │              │
   └───────────┴──────────────┴───► Cancelled
                                    Archived (soft delete)
```

**4 transition discipline** (T002.5 + T003 묶음 3 정확화 — T001 "free-transition" 가설 정정):

| transition | 가드 | 평가 |
|------------|------|------|
| start (Open → InProgress) | `eq(status,"Open")` precondition | ✅ gated |
| review (InProgress → PendingReview) | `eq(status,"InProgress")` precondition | ✅ gated |
| complete (PendingReview → Completed) | no precondition | ❌ FREE |
| cancel (any → Cancelled) | no precondition | ❌ FREE |

→ **2/4 = 50% transitions / 2/5 = 40% transitions+soft-delete** (CF-022 cross-pack #3, between bookings 100% leader vs invoices 0% webhook bypass floor).

**Audit coverage**: `work_orders.ts` logAction = 0/N — **6-way TIE at floor 0%** (admin + payment + catalog + property + crm + portal-partner = 6 도메인 audit-blind, T003 묶음 3 +).

**Trigger 부재**: active booking → work_orders 자동 생성 코드 0 hit. 운영자 수동 INSERT 만 (admin / staff portal 통해). Phase 2 = booking active 진입 시 maintenance schedule auto-INSERT 검토.

---

## §2 CS_TICKETS WORKFLOW — 1 transition (CF-022 50%)

```
Open ──► InProgress ──► Archived (soft delete)
```

**Transitions** (T002.5 state-machines.md §6):

| transition | 가드 | 평가 |
|------------|------|------|
| start (Open → InProgress) | `eq(status,"Open")` precondition | ✅ gated |
| (InProgress → Resolved/Closed) | **부재** — F8 incidental | ❌ 종료 state 미정의 |
| archive (any → Archived) | no precondition | ❌ FREE |

**F8 incidental** (architecture-rules §6 memo cross-ref): `cs_tickets` schema 에 `Resolved` / `Closed` state 부재 → InProgress 영구 → Archived 만 종료. 운영 분석 "해결된 티켓 수" / "평균 해결 시간" 쿼리 불가. Phase 2 = `Resolved` + `Closed` state 추가 + transition 가드.

**Nested cs_messages** (`domain-logic-ops-crm.md §2.3`): 1 cs_ticket → N cs_messages (대화 누적). cs_messages = active dual-domain (CF-009 ⚰️ 재평가 → KEEP).

---

## §3 TASKS POLYMORPHIC FK ORPHAN (F15 — no-magic-rules §5.4)

`tasks` schema 정의:
- `related_entity_type: text()` (polymorphic discriminator)
- `related_entity_id: integer()` (polymorphic FK)

**Route 사용 0 hit** (`rg "tasks" artifacts/api-server/src/routes/` 결과): `tasks.ts` route 자체 부재 — schema 만 존재 + 사용 0. **orphan polymorphic schema** 확정 (T003 묶음 3 spot-check).

**Phase 2 prescription** (architecture-rules §4 + no-magic-rules §5.4): (1) `tasks` schema 제거 (DEAD) 또는 (2) route 발급 + polymorphic FK 사용 매트릭스 정의 (related_entity_type 가능 값 enum 명시).

---

## §4 MAINTENANCE SCOPE (사용자 가설 cancellation-refund 일부 흡수)

**Booking cancellation 후 work_orders 정리 부재** (booking-lifecycle.md §3 cross-ref): T2 cancel 시 해당 booking 의 active work_orders 처리 코드 0 hit. → cancelled booking 에 묶인 work_orders 가 status="Open" 영구 잔존. 운영 분석 부정확.

**Bond return 14-day F9 cross-ref** (financial-rules §5.1): bond refund handler 부재 — work_orders 와 무관하게 financial 도메인 별도 entity 필요 (`bond_return` Phase 2).

**Phase 2 종합** (architecture-rules §6 + no-magic-rules §5): (1) booking cancel cascade work_orders → "Cancelled" / (2) cs_tickets Resolved/Closed state 추가 / (3) work_orders complete/cancel 가드 추가 / (4) tasks schema 제거 또는 사용 / (5) audit log 정책 통일 (work_orders 0% → 80% target).

---

## §5 자가 검증 (3 spot-check ✅)

- C1 `work_orders.ts` start/review = `eq(status,...)` precondition + complete/cancel = no precondition (4 transition 정확화)
- C2 `cs_tickets` schema enum 미명시 — Resolved/Closed text 0 hit (F8 confirmed)
- C3 `tasks` schema polymorphic FK 정의 + `tasks.ts` route 0 hit (F15 orphan confirmed)
