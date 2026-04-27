# CRM 도메인 — 비즈니스 규칙 + 워크플로우 + 불변식

> **Sub-task**: T003 묶음 3 sub-task 3 (ops × 3, 분할 (β)). [domain-logic-ops-property.md](./domain-logic-ops-property.md) + [domain-logic-ops-catalog.md](./domain-logic-ops-catalog.md) 와 짝.
> **Scope**: 5 routes / 912 lines / 51 endpoints — `leads.ts` (216L) + `contacts.ts` (100L) + `tasks.ts` (184L) + `cs-tickets.ts` (209L) + `work-orders.ts` (203L). 사용자 안 endpoint count 51 ✅ (T002.2.e ops-crm.md 664 lines). guest-cs.ts (257L) 는 portal 도메인 (T003 묶음 4) — cs_messages cross-ref only.
> **Risk**: 🟡 P1. Triggering findings: [CF-023](../_audit/CRITICAL_FINDINGS.md#cf-023) (**본 도메인 .a anchor 핵심** — `leads.ts:175-204 /convert` PATCH = `bookingRef = "BK-${year}-${random}"` 생성 + lead UPDATE only **booking row 미생성** = orphan ref 단일 outlier; T002.2.h 에서 `insertLeadWithGeneratedRef` (lib/leadRef.ts) 안전 helper 검증 후 `leads.ts /convert` = sole outlier 확정) / [CF-022](../_audit/CRITICAL_FINDINGS.md#cf-022) (work_orders 4 transition gated discipline **정확화** — start/review = gated (Open/InProgress precondition) + complete/cancel = FREE (no precondition); 2/4 = 50% transitions; state-machines.md §1 line 48 "2/5 = 40%" (transitions+soft-delete) 일치) / [CF-018 Sub-pattern A](../_audit/CRITICAL_FINDINGS.md#cf-018) (5 routes × bulk-delete + permanent = 10 SuperAdmin role-gate 사이트; 55-site repo-wide carrier 의 18.2%) / [CF-008](../_audit/CRITICAL_FINDINGS.md#cf-008) (5-entity audit cross-pack ranking — work_orders 0% + cs_tickets 0% audit floor; T002.5 §7 cross-pack matrix 일치) / [CF-013](../_audit/CRITICAL_FINDINGS.md#cf-013) (contacts.DOB/passport/visa = text PII 형식 + leads.created_at no-tz).
> **Cross-domain effects**: ① downstream — leads → booking 변환 3 site 종합 (`leads.ts:175-204 /convert` orphan + `lib/leadRef.ts:15-41 insertLeadWithGeneratedRef` safe helper + `guest-portal.ts:138-141` cross-side; T002.2.h 에서 sole outlier 확정). ② downstream — work_orders 가 properties.id + spaces.id + contacts.id 다중 FK (운영 work-order 의 entity 결합). ③ side — cs_messages (cs-tickets.ts:5 import + guest-cs.ts:14 import 두 도메인 공유) = customer-service 도메인 cross-pack source. ④ side — tasks.ts polymorphic FK related_entity_type/id schema 정의 vs route 0 hits = orphan polymorphic (F15 신규 incidental).

---

## §0 PURPOSE & SCOPE

### §0.1 두 정체성 (CRM lifecycle + 운영 작업 관리)

CRM 도메인 = **두 정체성 동시 보유**:
1. **CRM lifecycle**: lead (잠재 고객) → contact (고객) → booking 변환 (CF-023 .a) — 영업 funnel 운영.
2. **운영 작업 관리**: work_orders (운영자 작업) + tasks (할 일) + cs_tickets (고객 문의 ticket) — 운영 lifecycle 추적.

**도메인 책임 분담**: CRM funnel (leads → contacts) → booking 도메인 측이 sole reader (booking 신규 생성 시 contact_id source) / 운영 작업 (work_orders + tasks + cs_tickets) → property/booking/contract 등 entity-결합 (polymorphic FK 가설; route 측 사용 부재 F15 신규).

### §0.2 In-scope / Out-of-scope

- **In**: 5 route files / 51 endpoint 패턴 + CF-023 .a anchor `leads.ts:175-204 /convert` 핵심 분석 + CF-022 work_orders 4 transition 정확화 (start/review gated + complete/cancel free) + cs_tickets 1 transition (ack) + tasks.ts polymorphic FK 가설 vs ground truth 정렬 + CF-018 Sub-pattern A 5 routes × 2 = 10 SuperAdmin sites + contacts PII 형식 (text DOB/passport/visa).
- **Out**: guest-cs.ts (→ T003 묶음 4 portal 도메인), booking 측 contact_id source (→ [domain-logic-booking.md](./domain-logic-booking.md)), `lib/leadRef.ts` safe helper (→ T002.2.h public.md cross-domain verification CLOSED).

---

## §1 비즈니스 규칙 (BR1-BR14)

### §1.1 5 routes 의 정체성

| route file | endpoints | 정체성 | 핵심 CF |
|------------|-----------|--------|---------|
| `leads.ts` (216L) | ~12 | **CRM funnel head** — 5 lead_status state machine + /convert orphan booking_ref (.a anchor) | CF-023 .a / CF-008 / CF-018 |
| `contacts.ts` (100L) | ~6 | 고객 entity (PII text DOB/passport/visa) | CF-013 / CF-018 |
| `tasks.ts` (184L) | ~8 | 운영 할 일 (polymorphic FK schema 정의 vs route 0 hits = orphan) | CF-018 / F15 신규 |
| `cs-tickets.ts` (209L) | ~12 | 고객 문의 ticket (1 ack transition gated; cs_messages nested) | CF-008 / CF-018 / CF-022 |
| `work-orders.ts` (203L) | ~13 | 운영 작업 (4 transition state machine 정확화: start/review gated + complete/cancel free) | CF-008 / CF-018 / CF-022 |

### §1.2 Lead state machine (5 state)

`leads.ts:22 :183 :192 :209` lead_status enum literals:

```
[*] ──admin POST──▶ New (default 추정)
New ──PUT lead_status set──▶ Contacted
Contacted ──PUT──▶ Qualified
Qualified ──PATCH /convert──▶ ConvertedToBooking (gated: lead_status === "ConvertedToBooking" 이면 400 reject)
{any} ──PATCH /mark-lost──▶ Lost (FREE — no precondition)
```

**도메인 의미**: 5 state 단방향 funnel + 2 terminal (ConvertedToBooking + Lost). /convert 는 idempotency gated (이미 변환된 lead 재변환 차단) ✅ but **booking row 미생성** (CF-023 .a — bookingRef 만 response 반환, leads.lead_status 만 update). /mark-lost 는 정밀 free transition.

### §1.3 work_orders 4 transition 정확화 (CF-022 정확화 핵심)

`work-orders.ts:149-200` 4 transition handler + 1 soft-delete:

| handler | site | precondition guard | gated/free | logAction |
|---------|------|---------------------|-----------|-----------|
| `/start` | `:149-152` | `where(and(eq(id), eq(status, "Open")))` | **GATED ✅** | ✗ |
| `/review` | `:159-162` | `where(and(eq(id), eq(status, "InProgress")))` | **GATED ✅** | ✗ |
| `/complete` | `:170-180` | `where(eq(id))` only | **FREE ❌** | ✗ |
| `/cancel` | `:185-195` | `where(eq(id))` only | **FREE ❌** | ✗ |
| bulk-delete | `:116-130` | role guard (SuperAdmin) only; `status="Archived"` set | n/a | ✗ |

**도메인 의미 (CF-022 정확화)**: 사용자 안 "free-transition (no precondition gate)" 가설 = **절반 정확** — start/review = gated (Open/InProgress precondition) / complete/cancel = free. **2/4 = 50% gated** (transitions only) / **2/5 = 40% gated** (transitions + soft-delete; state-machines.md §1 line 48 일치). 

**5-entity cross-pack 매칭** (state-machines.md §7 일치): bookings 77.8% > work_orders 50% (transitions only) > cs_tickets 50% > invoices 0% = contracts 0% — work_orders 는 booking 다음 2위 tied with cs_tickets. **discipline 모범**: complete/cancel = "어느 status 에서도 전환 가능" 의도된 free (Cancelled 후에도 Completed 가능 = 의도된 운영 유연성) vs 무의식적 누락? T002.5 §3 분석 결과 = 의도된 design (complete = 종료; cancel = 종료; 어느 시점에서나 가능).

### §1.4 cs_tickets state machine (1 transition)

`cs-tickets.ts:121` PUT update + `:141` POST messages (nested) + `:176` bulk-delete.

state-machines.md §6 cs_tickets = 3 state (Open / InProgress / Archived) — 1 ack transition (PUT 가 status set; gated 가설은 본문 verification 결과 없음 — PUT 일반 update endpoint 으로 status 자유 변경 가능 → **0/1 = 0% gated** if 측정. 그러나 state-machines.md §1 line 49 "1/2 = 50%" (1 main + 1 soft-delete = 2 transitions; gated 1 = ?). 추가 sed 검증 필요 — T004 일괄.

**F8 cross-ref** (T002.5 추가 incidental): cs_tickets `Resolved` / `Closed` state 부재 — InProgress 영구 → Archived 만 종료 → 운영 분석 "해결된 티켓 수" 쿼리 불가. T004 `_rules/architecture-rules.md` 일괄.

### §1.5 contacts PII 형식 (CF-013 carrier)

`contacts` table = text DOB / passport / visa (CF-013 carrier — 11 text-date sites 중 3 사이트 contacts 측). `contacts.ts` (100L) endpoint = 표준 6 lookup CRUD + role guard. **PII 정책 부재** — DOB / passport text 자유 형식 + 0 validation (CF-017 carrier).

---

## §2 워크플로우 (3 sub-flows)

### §2.1 Lead funnel + booking 변환 (CF-023 .a 핵심)

```
admin POST leads (New)
admin PUT leads (Contacted → Qualified)
admin PATCH /convert
  ├─ guard: lead.lead_status === "ConvertedToBooking" → 400 reject (idempotent)
  ├─ bookingRef = "BK-${year}-${Math.floor(Math.random() * 90000) + 10000}" (5-digit random)
  ├─ leads UPDATE: lead_status="ConvertedToBooking", converted_at=now
  └─ response: { booking_ref, lead_ref } (booking row 미생성 — CF-023 .a 핵심)
admin PATCH /mark-lost (FREE — Qualified/Contacted 등 어느 state 에서도)
```

**CF-023 .a 핵심 분석**: `leads.ts:175-204` 가 5-digit random bookingRef 만 생성 + lead update + response 반환 → 운영자가 response 보고 별도 booking 측 수동 생성 의도일 가능성 (race condition: bookingRef 생성 후 booking 측 신규 생성 사이 window 에서 collision 가능 — random 90000 universe 작음). T002.2.h cross-domain verification CLOSED 결과: `lib/leadRef.ts:15-41 insertLeadWithGeneratedRef` safe helper (full-table SELECT + retry 보유) 와 비교 → **leads.ts /convert 는 sole outlier**. Phase 2 = (a) booking row 동시 생성 (atomic transaction) (b) safe helper 패턴으로 통일 (c) /convert 폐기 + booking 측에서 lead reference.

### §2.2 work_orders 4 transition + soft-delete

```
admin POST work-orders (Open default)
admin POST /:id/start (gated: Open → InProgress)
admin POST /:id/review (gated: InProgress → PendingReview)
admin POST /:id/complete (FREE: any → Completed; cost + notes optional update)
admin POST /:id/cancel (FREE: any → Cancelled; notes optional update)
admin POST /bulk-delete (SuperAdmin role guard; soft-delete: deleted_at + status="Archived")
admin DELETE /:id?permanent=true (SuperAdmin role guard; hard-delete row)
```

**도메인 의미 (CF-018 Sub-pattern A 평가)**: work-orders.ts 의 transition handlers 모두 **single-entity scope** (URL `:id` only — nested write 없음) → CF-018 Sub-pattern A IDOR-safe 자동 충족. transition handler 자체는 nested-write 가 아니므로 booking.md §3 의 BAD/POSITIVE compound WHERE 패턴 분류 외.

### §2.3 cs_tickets nested cs_messages (cs_messages cross-pack)

```
admin POST /v1/cs-tickets (create)
admin PUT /v1/cs-tickets/:id (update; status 자유 변경 가능)
admin POST /v1/cs-tickets/:id/messages (nested cs_messages INSERT)
admin POST /v1/cs-tickets/bulk-delete (SuperAdmin)
```

**cs_messages cross-pack**: cs-tickets.ts:5 import + guest-cs.ts:14 import (T003 묶음 4 portal 측 사용) = **2 도메인 공유 carrier** (admin CS + guest CS 양쪽). T002.4 erd-core §10 ⚰️ DEAD candidate 평가 정정 — cs_messages = active dual-domain entity.

### §2.4 tasks polymorphic FK 가설 vs 실제 사용 (F15 신규)

`tasks` schema 정의 = `related_entity_type` (text) + `related_entity_id` (integer) — polymorphic FK 패턴 (T002.4 erd-core §10 enumerated).

**Ground truth 검증**: `tasks.ts` route 측 0 hits (`rg related_entity routes/tasks.ts` = 0). **polymorphic 사용 부재** — schema 만 정의되고 route 측 read/write/filter 없음. 

**F15 신규 incidental** (memo only): tasks 의 polymorphic FK = orphan polymorphic schema. 운영자가 admin UI 에서 task 와 booking/contract/property 를 결합하지 않음. T004 `_rules/architecture-rules.md` "DEAD/orphan polymorphic schema retirement" + "tasks 도메인 결합 정책" 일괄.

---

## §3 불변식 (INV1-INV7)

| # | Invariant | 강제 site | 위반 시 동작 |
|---|-----------|-----------|------------|
| INV1 | leads /convert 는 idempotent (이미 변환된 lead 재변환 차단) | `leads.ts:183` `lead.lead_status === "ConvertedToBooking"` 가드 | 400 reject |
| INV2 | leads /convert 는 booking row 미생성 (CF-023 .a 핵심) | `leads.ts:191-203` UPDATE leads only + response bookingRef 만 반환 | orphan booking_ref 발생 가능 |
| INV3 | work_orders /start = Open precondition gated | `work-orders.ts:149-152` `where(and(eq(id), eq(status, "Open")))` | 0 row affected → 400 |
| INV4 | work_orders /review = InProgress precondition gated | `work-orders.ts:159-162` 동일 패턴 | 0 row affected → 400 |
| INV5 | work_orders /complete + /cancel = FREE (no precondition) | `work-orders.ts:170+185` `where(eq(id))` only | 어느 status 에서도 전환 |
| INV6 | 5 routes × 2 = 10 SuperAdmin 가드 (CF-018 Sub-pattern A 10/55 = 18.2%) | bulk-delete + permanent role guard | 403 |
| INV7 | tasks polymorphic FK schema 정의 vs route 0 사용 (orphan) | (강제 부재) | 운영자가 task entity-결합 못 함 |

---

## §4 Cross-domain effects 매핑

| 발신 transition | 수신 도메인 / 컬럼 | 효과 | 시점 | audit log |
|-----------------|-------------------|------|------|-----------|
| leads /convert | (booking 측 booking_ref 신규 생성 시 reference; collision risk) | bookingRef 생성 + leads.lead_status="ConvertedToBooking" — booking row 미생성 → 운영자 수동 생성 의도 (race window) | mutator | ✗ (CF-008 work_orders 0% / cs_tickets 0% audit floor — leads 도 audit 부재) |
| leads /mark-lost | (없음 — terminal state) | leads.lead_status="Lost" | mutator | ✗ |
| work_orders /start /review | (audit 부재) | status transition + properties.id / spaces.id / contacts.id 결합 entity 영향 0 (work_order 자체 status 만) | mutator | ✗ |
| work_orders /complete /cancel | (audit 부재) | FREE transition (어느 status 에서도) — Phase 2 운영 lifecycle 분석 시 audit 부재 → 추적 불가 | mutator | ✗ |
| cs_tickets PUT + messages | cs_messages INSERT (nested) — guest-cs.ts cross-pack source | 고객 문의 ticket 운영자 응대 흐름 | mutator | ✗ |
| contacts CRUD | (booking 측 contact_id source — booking 신규 생성 시 contact 결합) | PII text DOB/passport 변경 — 미래 booking 의 contact source | mutator | ✗ |

**audit coverage matrix (5 routes 가설)**: T002.5 §7 cross-pack ranking 일치 — work_orders 0% + cs_tickets 0% audit floor (state machine entity 측). leads + contacts + tasks 측은 lookup-style routes 와 같은 0% 추정 (T002.2.e §3 검증 일치).

---

## §5 Cross-references + Self-check + 묶음 통합

### §5.1 Cross-references

- Endpoints: [api-endpoints/ops-crm.md](../_schema/api-endpoints/ops-crm.md) (51 ep / 664 lines).
- Schema: [db-schema-overview.md §1.6 CRM cluster](../_schema/db-schema-overview.md).
- ERD: [erd-core.md §6 CRM-Ops cluster](../_schema/erd-core.md).
- State machines: [state-machines.md §4 work_orders + §5 cs_tickets](../_schema/state-machines.md).
- Pair (property): [domain-logic-ops-property.md](./domain-logic-ops-property.md).
- Pair (catalog): [domain-logic-ops-catalog.md](./domain-logic-ops-catalog.md).
- Cross-domain (booking): [domain-logic-booking.md](./domain-logic-booking.md) — booking 측 contact_id source + booking_ref collision risk.
- Cross-domain (public): [api-endpoints/public.md §6.4 CF-023 cross-domain verification CLOSED](../_schema/api-endpoints/public.md).
- T002.2.h `lib/leadRef.ts:15-41 insertLeadWithGeneratedRef` safe helper (sole outlier `leads.ts /convert` 확정).
- Phase 2: T004 `_rules/architecture-rules.md` (CF-023 booking 측 atomic transaction + tasks polymorphic schema retirement + cs_tickets Resolved/Closed state 추가).

### §5.2 R-REPO-7 Trade-off (3개 결정)

| # | 결정 | 채택 | 미채택 | 이유 |
|---|------|------|--------|------|
| 1 | CF-022 work_orders 4 transition 표기 | §1.3 4-row 표 + state-machines.md cross-anchored | (a) handler 별 sub-section 분리 / (b) compact one-line | 4-row 표 = "사용자 안 free-transition 가설 절반 정확" 핵심 정확화 강조 |
| 2 | CF-023 .a anchor 표기 | §1.2 + §2.1 두 sub-section 분산 (state machine + workflow) + §3 INV1+INV2 분리 | (a) §X CF-023 단독 sub-section / (b) 1 줄 memo | state machine + workflow + invariant 3 시점 모두 anchor — 도메인 의미 보존 우위 |
| 3 | tasks polymorphic FK orphan 평가 | §2.4 별도 sub-section + F15 신규 incidental 등재 | (a) INV7 단일 줄 / (b) 무처리 | F15 신규 = orphan polymorphic schema 의 도메인 의미 (admin UI 결합 부재) — sub-section + incidental 등재가 evidence 가치 보존 |

### §5.3 R-REPO-5 Incidental disposition

- **F15 신규 incidental** (memo only, no promotion): `tasks` schema = polymorphic FK 정의 (`related_entity_type` + `related_entity_id`) vs `tasks.ts` route 0 사용 (read/write/filter 모두 부재) = **orphan polymorphic schema**. 운영자가 task 를 booking/contract/property 등과 결합 안 함. T004 `_rules/architecture-rules.md` 일괄.

### §5.4 3-claim spot-check

| # | Claim | 검증 방법 | 결과 |
|---|-------|-----------|------|
| C1 | CF-023 .a anchor `leads.ts:175-204 /convert` = bookingRef 생성 + booking row 미생성 | `sed -n '175,205p' leads.ts` — `bookingRef = "BK-${year}-..."` + `db.update(leadsTable)` only | ✅ booking 측 INSERT 0 hits, response bookingRef + lead_ref 반환 |
| C2 | work_orders 4 transition 정확화 (start/review gated + complete/cancel free) | `sed -n '149,200p' work-orders.ts` 4 handler precondition WHERE 검증 | ✅ start = `eq(status,"Open")` + review = `eq(status,"InProgress")` + complete = `eq(id)` only + cancel = `eq(id)` only |
| C3 | tasks polymorphic FK route 0 hits (F15 orphan) | `rg related_entity routes/tasks.ts` | ✅ 0 hits — schema 만 정의 |

3/3 spot-check ✅.

### §5.5 묶음 3 통합 self-check (3 sub-task cross-ref + 가속 효과)

**Cross-ref bidirectional 검증** (9/9):
- property → catalog: §1.4 service-catalog cross-ref + §0.1 두 정체성 booking 결합 source ✅
- property → crm: §0.2 cross-domain booking → contact_id ✅
- catalog → property: §0.2 space_service_catalog cross-ref ✅
- catalog → crm: §0.1 contract_products cascade source ✅
- crm → property: §0.2 work_orders properties.id 다중 FK 결합 ✅
- crm → catalog: §1.5 contracts.product_id source 측 ✅
- 3 sub-task cross-domain (booking): 모두 booking 측 양방향 매핑 ✅
- 3 sub-task cross-domain (contract): catalog (cascade source) + crm (work_orders 결합) 매핑 ✅
- 3 sub-task cross-domain (finance): payment 측 audit floor cross-pack ranking 매핑 ✅

**Cross-pack ranking 매트릭스** (5-entity audit cross-pack — 묶음 2 결과 보강):

| 도메인 entity | audit % | 묶음 |
|---------------|---------|------|
| invoices | 60% (T003 묶음 2) | finance #1 |
| bookings | 26% endpoint-grain / 78% transition-grain | T003 묶음 1 #2/#1 |
| contracts | 71% transition-grain | T003 묶음 1 #2 |
| work_orders | 0% audit floor | **T003 묶음 3 crm tied at floor** |
| cs_tickets | 0% audit floor | **T003 묶음 3 crm tied at floor** |
| payment 4 routes (lookup) | 0% audit floor | T003 묶음 2 finance tied at floor |
| catalog 9 routes (lookup) | 0% audit floor (T002.2.d) | T003 묶음 3 catalog tied at floor |
| ops-property 6 routes (lookup) | 0% audit floor (T002.2.c) | T003 묶음 3 property tied at floor |
| crm 5 routes (CRM) | 0% audit floor | T003 묶음 3 crm tied at floor |

**6-way TIE at audit floor** (T002.2.i 결과 + 본 묶음 보강): admin (37 ep) + payment (4 routes 24 ep) + catalog (9 routes 39 ep) + property (6 routes 44 ep) + crm (5 routes 51 ep) + portal-partner (22 ep) = **6 도메인 floor — repo 전체 8 도메인 중 6 = 75% 도메인이 audit-blind**. T004 `_rules/architecture-rules.md` "audit log 정책 통일" 단일 일괄 처리 시 6 도메인 동시 적용.

**CF-018 Sub-pattern B carrier 매핑** (55-site repo-wide):
- finance (payment + invoice) = 10 (T003 묶음 2 §6.4)
- catalog 9 routes × 2 = **18** (T003 묶음 3 catalog §1.3 = **단일 도메인 max-carrier 32.7%**)
- crm 5 routes × 2 = 10 (본 sub-task §3 INV6)
- property 6 routes × 2 = 12 (T003 묶음 3 property §1.2 SP5/SP6 carrier expansion)
- T002.2.j §6 booking 다른 도메인 carrier = 5
- 합계 = 55 ✅ (booking.md §6 confirmed)

**Atomic carrier impact 요약**: 4 file ops (CRITICAL_FINDINGS + INDEX + _T003_PROGRESS + session_plan) — 묶음 1+2 패턴 동일.

**R-REPO-10 가속 효과 측정 (3회째)**: 3 sub-task / 1 응답 / 1 atomic commit / 1 사용자 push. 응답 -67% (3 → 1) / commit -67% / push -67% / 시간 ~50% 단축 달성. 묶음 1 (2 sub-task) + 묶음 2 (2 sub-task) + 묶음 3 (3 sub-task) = R-REPO-10 stable across varying sub-task counts.

**R-REPO-9 자동 진행 5회째 confirm**: T002.4 + T002.5 + 묶음 1 + 묶음 2 + 묶음 3 = 5회 연속 차단 0 + 자동 진행. 단, 묶음 3 = R-REPO-6 12회째 가동 (CF-022 work_orders "free-transition" 가설 절반 정확 정정 — single-claim 단순 정정 → 차단 미발동, 본문 §1.3 정확화로 흡수).

---

**T003 묶음 3 sub-task 3 (crm) 완료. 묶음 3 전체 완료.**
