# Finance Payment 도메인 — 비즈니스 규칙 + 워크플로우 + 불변식

> **Sub-task**: T003 묶음 2 sub-task 2 (invoice + payment pair, 분할 (β) 채택). [domain-logic-finance-invoice.md](./domain-logic-finance-invoice.md) 와 짝.
> **Scope**: 4 lookup-style finance routes — `payment-info` (guest 결제수단 master-data) / `commissions` (호스트/에이전트 수수료) / `beneficiaries` (수익자 계좌) / `accounts` (CRM 계좌, finance 도메인 안 mount). Stripe webhook 자체는 invoice 본문 [§1.3 BR11-BR13](./domain-logic-finance-invoice.md#13-stripe-webhook-handlers-br11-br13--automatic-측) 참조.
> **Risk**: 🟡 P1. Triggering findings: [CF-001](../_audit/CRITICAL_FINDINGS.md#cf-001) (commissions.amount=real ⚠️ — 정밀 손실 측 / payment_info / beneficiaries 는 amount 컬럼 없음 — finance-internal boundary block) / [CF-008](../_audit/CRITICAL_FINDINGS.md#cf-008) (4 lookup-style routes 전부 logAction 0 — repo 최저 floor 0/22 = 0%; finance-payments.md §0 정량) / [CF-018 Sub-pattern B](../_audit/CRITICAL_FINDINGS.md#cf-018) (vertical-privilege-escalation: 4 routes × 2 = 8 SuperAdmin role-gate 사이트 — 8/55 repo-wide carrier) / [CF-019.b](../_audit/CRITICAL_FINDINGS.md#cf-019) (`payment_info.stripe_payment_method_id` write-orphan 확인 — payment-info.ts read/write 전부 일반 컬럼 취급).
> **Cross-domain effects**: ① upstream — Stripe webhook (`stripe.ts`) 이 `payment_info.stripe_payment_method_id` 쓰기 site 부재 (orphan 확정) — `domain-logic-finance-invoice.md §1.3` 와 cross-ref. ② downstream — booking T3 check-out 시 bond return → 본 도메인의 entity 부재 (F9 cross-ref). ③ side — accounts 는 본 도메인 안 mount 되었지만 도메인적으로 CRM (T003 묶음 3 `domain-logic-crm.md` 와 dual-anchor).

---

## §0 PURPOSE & SCOPE

### §0.1 4 lookup-style routes 의 공통 구조

본 도메인의 4 routes 는 모두 **lookup-style master-data** 패턴 — list / create / get / update / soft-delete / hard-delete 의 6 endpoint 만 가짐 (state-transition 핸들러 없음). 도메인 로직 측면에서 invoice 본체와 다음 차이:

| 측면 | invoice (`invoices.ts`) | payment lookup-style (4 routes) |
|------|-------------------------|--------------------------------|
| state-transition handlers | 3 (`/send`, `/pay`, `/void`) + 3 webhook | **0 — lookup-only** |
| `logAction` call sites | 3 (manual) + 3 (webhook) = 6 | **0 — repo 최저** (CF-008 floor) |
| status 컬럼 사용 | ✓ 5-state lifecycle | commissions ✓ (Archived only); payment_info / beneficiaries / accounts ✗ |
| bulk-delete + permanent SuperAdmin 가드 | ✓ (`invoices.ts:113`,`134`) | ✓ × 4 (8 sites — CF-018 carrier) |
| Stripe stripe_*_id 컬럼 | ✓ (write site 1: `stripe.ts:62` audit only — orphan) | ✓ payment_info.stripe_payment_method_id (write site **0** — orphan ✓) |

**도메인 의미**: 4 lookup-style routes 는 본 코드베이스의 "조용한 storage" — 운영자가 데이터를 입력하지만 system 은 변경 history 를 안 남긴다. 회계 / 분쟁 발생 시 audit trail 부재 (CF-008 floor 1/26 = 3.8% = `stripe.ts:62` 1 사이트만; 4 lookup-style 에서는 0/22 = 0%).

### §0.2 In-scope / Out-of-scope

- **In**: payment-info (90L) + commissions (90L) + beneficiaries (131L) + accounts (129L) = 4 lookup-style routes 의 6 endpoint 패턴 + SuperAdmin role-gate 분포 + status 컬럼 inconsistency + Stripe payment_method_id orphan + bond return entity 부재 (F9 cross-ref).
- **Out**: invoice document lifecycle (→ [domain-logic-finance-invoice.md](./domain-logic-finance-invoice.md)), Stripe webhook handler (→ invoice 본문 §1.3-§2.2), accounts 의 CRM-측 의미 (→ T003 묶음 3 `domain-logic-crm.md` dual-anchor).

---

## §1 비즈니스 규칙 (4 routes × 6 endpoint = 24 endpoint 의 패턴)

### §1.1 endpoint 패턴 — 4 routes 공통

각 lookup-style route 는 동일한 6-endpoint 패턴:

| # | Method + path | handler 위치 (예: payment-info) | guard | logAction |
|---|---------------|------------------------------|-------|-----------|
| L1 | GET `/v1/{name}` (list + filter) | `:15` | requireAuth (mount-time) | ✗ (read) |
| L2 | POST `/v1/{name}` (create) | `:28` | requireAuth | ✗ |
| L3 | GET `/v1/{name}/:id` (read) | `:35` | requireAuth | ✗ (read) |
| L4 | PUT `/v1/{name}/:id` (update) | `:43` | requireAuth | ✗ |
| L5 | POST `/v1/{name}/bulk-delete` | `:56` | role guard `SuperAdmin` ✓ | ✗ |
| L6 | DELETE `/v1/{name}/:id?permanent=true` | `:74` | role guard `SuperAdmin` ✓ (only when permanent) | ✗ |

**file:line carrier (4 routes × 6 = 24 endpoint, 모두 동일 패턴)**:
- payment-info: L1 `:15` / L2 `:28` / L3 `:35` / L4 `:43` / L5 `:56` / L6 `:74`
- commissions: L1 `:14` / L2 `:25` / L3 `:34` / L4 `:42` / L5 `:53` / L6 `:73` (status filter `:20`, bulk-delete soft set status="Archived" `:69`)
- beneficiaries: L1-L6 동일 6-endpoint × `:16/30/38/46/95/117`
- accounts: L1-L6 동일 6-endpoint × `:14/30/40/50/95/117`

### §1.2 Money & default constants

| # | 규칙 | 식 | file:line | CF |
|---|------|----|-----------|-----|
| BR1 | commissions.amount column = **real** (정밀 손실 측) | (schema `:8` real("amount")) | schema 측 | 🔴 [CF-001](../_audit/CRITICAL_FINDINGS.md#cf-001) — 본 도메인의 손실 측 (반대 측 = invoice.amount=numeric ✓) |
| BR2 | payment_info.stripe_payment_method_id = orphan | (schema 컬럼 정의 + 0 write site) | n/a (write 사이트 부재) | 🟡 [CF-019.b](../_audit/CRITICAL_FINDINGS.md#cf-019) — Stripe webhook 이 본 컬럼에 쓰는 핸들러 없음 |
| BR3 | commissions.status default 값 미명시 (Archived 외 enum 부재) | `:69` `set({deleted_at, status: "Archived"})` 만 등장 | `commissions.ts:20,69` | F12 후보 — schema enum 정의 부재 + bulk-delete 만 사용 |
| BR4 | payment_info / beneficiaries / accounts = status column 부재 | (schema) | n/a | 5-state lifecycle 없음 — 정적 master-data |

**도메인 의미**:
- BR1 = booking 1.6× 의 보호 패턴 (numeric) 이 commissions 에는 없어 호스트/에이전트 정산 시 1 cent 누락 가능. `bookings.numeric → contracts.real → contract_line_items.numeric` 과 동일한 정밀 손실 사이트 [domain-logic-contract.md §1.1](./domain-logic-contract.md#11-money--default-constants) 와 sister.
- BR2 = Stripe payment_intent 가 customer 의 saved card (`pm_xxx`) 를 사용해도 본 컬럼 업데이트 코드 부재 → **payment_info row 의 stripe_payment_method_id 는 INSERT 시점 값 그대로 영구**. Phase 2 = `customer.created/updated` webhook 추가 또는 attached `payment_method.attached` event handler.

### §1.3 Soft-delete + permanent DELETE — CF-018 Sub-pattern B carrier

| # | 규칙 | file:line × 4 routes | 효과 |
|---|------|----------------------|------|
| BR5 | bulk-delete soft-or-permanent require SuperAdmin | payment-info `:59` / commissions `:56` (recovered) / beneficiaries `:97` / accounts `:97` | 403 if not SuperAdmin |
| BR6 | DELETE permanent require SuperAdmin | payment-info `:74` (단순 hard-delete only — soft 분기 없음) / commissions `:81` / beneficiaries `:119` / accounts `:119` | 403 |
| BR7 | bulk-delete soft = `set({deleted_at: now, status: "Archived"})` (commissions 만 status; 다른 3 routes 는 `set({deleted_at: now})` only) | commissions `:69` / payment-info / beneficiaries / accounts (각 routes 의 bulk soft branch) | invoice 와 동일 |

**CF-018 Sub-pattern B carrier 합계**: 본 도메인 8 SuperAdmin role-gate 사이트 (4 routes × 2). T002.2.j §6.B repo-wide enumeration 55 사이트 중 8 = 14.5% (단일 도메인 최대 carrier). Phase 2 = `requireSuperAdmin` middleware 단일화 권장 (T002.2.j §6.B).

### §1.4 Cross-domain reference 규칙

| # | 규칙 | 효과 | file:line |
|---|------|------|-----------|
| BR8 | commissions.booking_id / contract_id (FK 컬럼 — `references()` 부재) | 정산 row → booking/contract 출처 추적 | schema (CF-003 implicit FK) |
| BR9 | beneficiaries.account_id (FK 컬럼) | 수익자 → 계좌 결합 | schema |
| BR10 | accounts 는 finance 도메인 mount 되었지만 CRM 측 의미 (도메인 dual-anchor) | finance 도메인 처리 시 CRM 로직 미반영 | `accounts.ts:14-129` |

**도메인 의미 (BR10)**: accounts 는 `routes/index.ts` 또는 `app.ts` 에서 finance prefix 아래 mount (T002.2.b finance-payments.md §0). 그러나 entity 의미는 CRM (영업 prospect) — finance 도메인의 commissions / beneficiaries 와 의미 결합 약함. T003 묶음 3 `domain-logic-crm.md` 가 본 entity 를 다시 다룰 dual-anchor 패턴 — 동일 entity 가 두 도메인 로직 doc 에 등장.

---

## §2 워크플로우 (3 sub-flows)

### §2.1 Lookup CRUD lifecycle (4 routes 공통)

```
[*] ──admin POST /v1/{name}──▶ Created (status 컬럼 있는 commissions 만 Archived 가능)
Created ──PUT /v1/{name}/:id──▶ Updated (status 변경 안 함)
{any} ──DELETE soft──▶ deleted_at=now (+ status="Archived" for commissions)
{any} ──DELETE permanent (SuperAdmin)──▶ row 영구 삭제
{any × N} ──bulk-delete soft (SuperAdmin)──▶ deleted_at=now × N (+ status="Archived" × N for commissions)
{any × N} ──bulk-delete permanent (SuperAdmin)──▶ × N rows 영구 삭제
```

**state machine 부재**: 4 routes 모두 status-transition 핸들러 없음 → invoice 5-state, booking 8-state, contract 7-state 와 달리 **state machine 자체가 없는 도메인**. T002.5 state-machines.md §1 Entity Index 5 entity 에 본 도메인 routes 가 없는 이유.

### §2.2 logAction 부재 패턴 (CF-008 floor)

```
admin POST /v1/{name}        ──▶ DB INSERT only ──▶ NO audit log
admin PUT /v1/{name}/:id     ──▶ DB UPDATE only ──▶ NO audit log
admin DELETE soft            ──▶ DB UPDATE deleted_at ──▶ NO audit log
admin DELETE permanent       ──▶ DB DELETE ──▶ NO audit log [⚠️ 영구 삭제 흔적 0]
SuperAdmin bulk-delete (N=10)──▶ DB UPDATE × 10 ──▶ NO audit log [⚠️ 일괄 변경 흔적 0]
```

**도메인 의미**: 본 도메인은 **재무 critical** 임에도 불구하고 변경 history 가 0 — 운영자가 commission 금액을 수정해도 누가 / 언제 / 왜 변경했는지 알 수 없음. 분쟁 / 회계 감사 시 dispute 불가능. CF-008 본문이 "endpoint vs transition 단위 측정" 차이 (booking 26%/78% 두 측정 모두 valid) 명확화한 후, 본 도메인은 **두 단위 모두 0%** = 측정 단위와 무관한 floor.

### §2.3 bond return 부재 (F9 cross-ref)

[domain-logic-booking.md §5.3 F9 incidental](./domain-logic-booking.md) 에서:
- `bookings.ts:436` PDF 본문에만 "bond returned within 14 days" 텍스트 존재
- 코드 어디에도 14-day timer / refund handler / escrow account / bond_return entity 부재

**finance-side 처리 (본 sub-task 책임)**:
- 본 도메인 4 routes 중 어느 것도 bond return 처리 안 함
- payment_info 는 customer 결제수단 (booking 시 charge 측) 이지 refund 측 entity 없음
- beneficiaries 는 host/agent 정산 측이지 guest 환불 측 아님
- commissions 는 host commission 으로 bond return 과 무관

**Phase 2 prescription**: `bond_return` 별도 entity (booking_id FK + amount + scheduled_at + status (Pending/Released/Forfeited) + refunded_at + refund_method) + scheduled job 또는 admin-trigger handler. T004 `_rules/financial-rules.md` "bond return policy formalisation" 일괄 (F9 + 본 sub-task cross-ref).

---

## §3 불변식 (6 invariants)

| # | Invariant | 강제 site | 위반 시 동작 |
|---|-----------|-----------|------------|
| INV1 | 4 routes 모든 endpoint = NO logAction | (강제 부재) | audit trail 0 — 분쟁 시 추적 불가 |
| INV2 | bulk-delete = SuperAdmin only (BR5) | 4 routes × 1 = 4 사이트 (`payment-info.ts:59` etc) | 403 |
| INV3 | DELETE permanent = SuperAdmin only (BR6, payment-info 제외) | 3 routes × 1 = 3 사이트 (commissions:81 / beneficiaries:119 / accounts:119) | 403 |
| INV4 | payment-info = DELETE = always permanent (no soft-delete branch) | `payment-info.ts:74-89` | row 삭제 시 audit + soft 둘 다 부재 |
| INV5 | commissions.amount = real (정밀 손실, BR1) | (schema 측 강제 부재) | 1 cent 누락 가능 |
| INV6 | payment_info.stripe_payment_method_id 쓰기 사이트 0 (BR2) | (강제 부재) | INSERT 후 영구 동일 값 |

**INV1 의 함의 (CF-008 floor)**: 본 도메인은 "변경 history 가 의도적으로 부재" — 모든 lookup-style master-data routes 가 동일 패턴 → 의식적 정책 가능성도 있음 (T004 결정). Phase 2 = (a) 4 routes 모두 logAction 추가 (CRUD 추적), (b) audit log 미사용을 정책으로 명문화 (admin-only routes 는 audit log 면제).

**INV4 의 함의 (payment-info DELETE 비대칭)**: payment-info 만 단순 hard-delete (soft 분기 없음) → guest 결제수단 데이터는 GDPR 준수상 hard-delete 가 적절할 수 있으나 **audit log 도 없어** 삭제 흔적 0. Phase 2 = (a) GDPR 정책 명문화, (b) audit log 만이라도 추가.

**INV6 의 함의 (CF-019.b orphan)**: stripe_payment_method_id 컬럼이 schema 에 존재하나 코드 어디에서도 쓰지 않음 → schema bloat + Phase 2 마이그레이션 시 의도 불명. CF-019.b carrier 확정.

---

## §4 Cross-domain effects 매핑

| 발신 transition | 수신 도메인 / 컬럼 | 효과 | 시점 | audit log |
|-----------------|-------------------|------|------|-----------|
| (외부) booking T3 check-out | (없음 — bond_return entity 부재) | F9 incidental — 14-day timer 부재 | (해당 시점) | n/a |
| (외부) Stripe webhook payment_intent.succeeded | payment_info.stripe_payment_method_id (예상) | 본 컬럼 쓰기 사이트 0 (CF-019.b) | n/a | (writeable but never written) |
| 본 도메인 4 routes 모든 mutation | (없음 — DB 만 변경) | NO audit / NO cross-domain 효과 | mutator handler | ✗ 부재 (CF-008 floor) |
| commissions create/update | (외부 booking_id / contract_id 참조; 본 도메인은 read-only 측) | 호스트 정산 record | mutator | ✗ |
| beneficiaries create/update | (외부 account_id 참조) | 수익자 등록 | mutator | ✗ |
| accounts (CRM dual) | T003 묶음 3 `domain-logic-crm.md` cross-ref | finance/CRM dual-anchor | mutator | ✗ |
| Stripe webhook chargeback (F11) | (handler 부재 → 무 cross-domain 효과) | invoice → 환불 / refund 미연동 | n/a | ✗ |

**audit coverage matrix (4 routes)**:
- payment-info 6 ep × audit = **0/6 = 0%**
- commissions 6 ep × audit = **0/6 = 0%**
- beneficiaries 6 ep × audit = **0/6 = 0%**
- accounts 6 ep × audit = **0/6 = 0%**
- 합계 24 ep × audit = **0/24 = 0%** (repo-wide absolute floor — 단일 도메인 max-floor)

CF-008 5-entity audit-coverage matrix (T002.5 §7) 에서 invoices 80% > contracts 71% > bookings 67% > work_orders 0% = cs_tickets 0% 와 비교하면 **본 도메인은 = 0% 동률 + 가장 큰 단일 도메인 carrier** (24 endpoint × 0).

---

## §5 Cross-references + Self-check

### §5.1 Cross-references

- Endpoints: [api-endpoints/finance-payments.md](../_schema/api-endpoints/finance-payments.md) (26 endpoints incl. stripe.ts S1+S2; 1108 lines).
- Schema: [db-schema-overview.md §1.4 Finance cluster](../_schema/db-schema-overview.md) — commissions / payment_info / beneficiaries / accounts table 정의.
- ERD: [erd-core.md §6 Finance cluster](../_schema/erd-core.md).
- Money: [MONEY_AUDIT.md](../_audit/MONEY_AUDIT.md) — commissions.amount=real (정밀 손실) row.
- Pair (invoice): [domain-logic-finance-invoice.md](./domain-logic-finance-invoice.md) — Stripe webhook 본체 + invoice 5-state lifecycle.
- Booking F9 (bond return 부재): [domain-logic-booking.md §5.3](./domain-logic-booking.md).
- CRM dual-anchor: T003 묶음 3 `domain-logic-crm.md` — accounts entity 의 CRM-측 의미.
- Phase 2: T004 `_rules/financial-rules.md` (bond return policy + Stripe event handler completeness + audit log policy 일괄).

### §5.2 R-REPO-7 Trade-off (3개 결정)

| # | 결정 | 채택 | 미채택 | 이유 |
|---|------|------|--------|------|
| 1 | accounts dual-anchor 표기 | 본 sub-task §1.4 BR10 + cross-ref T003 묶음 3 (dual-anchor 명시) | (a) finance-only / (b) crm-only | accounts 는 finance prefix mount + CRM 의미 동시 — 한쪽 표기 시 다른 도메인 reader 가 누락 인식. dual-anchor 가 정확. |
| 2 | bond return F9 finance-side 처리 | §2.3 별도 sub-section + Phase 2 prescription 명시 | (a) §4 cross-domain 표 1줄 / (b) 무처리 | F9 가 booking 측에서 "PDF text only" 발견 → finance 측 책임 entity (payment / refund) 검증 필수 → §2.3 별도 sub-section 으로 booking-측 incidental 의 finance-측 mirror 완성. |
| 3 | 4 routes 의 통합 vs 분리 표기 | 통합 §1.1 6-endpoint 패턴 표 + route 별 file:line carrier | (a) 4 sub-section 분리 / (b) 별도 4 sub-doc | 4 routes 모두 동일 6-endpoint 패턴 → 분리 시 중복 80% → 통합이 readability + 유지보수성 우위. invoice 본문과 다른 형식이지만 합리적 (lookup-style 균일성 반영). |

### §5.3 R-REPO-5 Incidental disposition

- **F12 신규 incidental** (memo only, no promotion): commissions.status enum 정의 부재 — `commissions.ts:20,69` 에서 status filter + Archived 만 사용. 다른 status 값 (Paid / Pending / Approved 등) 의 의미 불명. Phase 2 = enum 정의 + lifecycle 명문화. T004 `_rules/financial-rules.md` 일괄.
- **F11 invoice-side incidental cross-ref** (이미 invoice 본문 §5.3 등재): Stripe webhook chargeback / dispute 미처리 — 본 도메인 측에서도 cross-ref. payment-info / beneficiaries 측에 `chargeback` entity 부재 확인 → CF-010 Phase 2 Option B `payment_events` 가 cover.

### §5.4 3-claim spot-check

| # | Claim | 검증 방법 | 결과 |
|---|-------|-----------|------|
| C1 | INV1 4 routes × 6 ep × audit = 0/24 = 0% (CF-008 floor 단일 도메인 max-carrier) | `rg -n 'logAction' artifacts/api-server/src/routes/{commissions,beneficiaries,accounts,payment-info}.ts` | ✅ 결과 부재 (4 routes 모두 logAction import 도 없음). 0/24 = 0% 정확. |
| C2 | BR2 stripe_payment_method_id write site 0 (CF-019.b carrier) | `rg -n 'stripe_payment_method_id' artifacts/api-server/src/routes/` 결과 시 read-only 컬럼 access 만 (write 없음) | ✅ payment-info.ts 에서 read-side enrichment 만; Stripe webhook handler 도 write 안 함 (CF-019.b 본문 일치). |
| C3 | INV4 payment-info DELETE = always permanent (no soft branch) | `read payment-info.ts:74-89` | ✅ `:74-89` `db.delete(paymentInfoTable).where(eq(id, ...))` 만 — soft branch 없음 (commissions/beneficiaries/accounts 와 다른 비대칭). |

3/3 spot-check ✅. 4 routes 의 audit floor + Stripe payment_method_id orphan + payment-info DELETE 비대칭 모두 file:line 정확.

---

## §6 묶음 통합 self-check (R-REPO-10 (f))

### §6.1 Cross-ref bidirectional 검증 (invoice ↔ payment)

| # | 방향 | invoice 측 anchor | payment 측 anchor | 일관성 |
|---|------|-------------------|-------------------|---------|
| 1 | Stripe webhook 본체 | invoice §1.3 BR11-BR13 + §2.2 | payment §0.2 Out + §1.2 BR2 cross-ref | ✅ invoice 가 본체 / payment 는 cross-ref only — 명확 분리 |
| 2 | accounts dual-anchor | invoice §0.2 Out (payment 도메인 안 mount) | payment §1.4 BR10 + §5.1 → T003 묶음 3 | ✅ 의미 불명한 accounts 가 finance mount + CRM 의미 동시 표기 |
| 3 | F9 bond return 부재 | (n/a — invoice 본문 등재 안 함) | payment §2.3 + §5.1 → T004 | ✅ payment 가 finance-side 책임 도메인 — 정확 처리 |
| 4 | CF-019 stripe orphan columns | invoice §1 BR (n/a — invoices.stripe_payment_intent_id 는 audit log payload 만 등장하나 invoice 컬럼 자체에 write 사이트 부재 → invoice §3 INV6 cross-ref) | payment §1.2 BR2 + §3 INV6 (payment_info.stripe_payment_method_id) | ✅ 두 컬럼 모두 carrier — invoice 측 = invoices.stripe_payment_intent_id (CF-019.a) + payment 측 = payment_info.stripe_payment_method_id (CF-019.b) |
| 5 | CF-008 floor 측정 | invoice §4 audit matrix 60% endpoint-grain | payment §4 audit matrix 0/24 = 0% (단일 도메인 max-carrier) | ✅ invoice 60% > payment 0% — finance 도메인 내부 audit gap = 60% |
| 6 | CF-018 Sub-pattern B carrier | invoice §3 INV4 + INV5 (`invoices.ts:113`,`134`) = 2 사이트 | payment §1.3 BR5+BR6 = 8 사이트 (4 routes × 2) | ✅ 합계 10 사이트 (finance 도메인 내부) — repo-wide 55 의 18.2% (단일 도메인 최대 cluster) |

6/6 cross-ref ✅. invoice + payment 분리는 CF-010 lifecycle 분리 (document vs payment events) 를 정확히 반영.

### §6.2 묶음 cross-pack ranking

**5-entity audit coverage matrix update (T002.5 §7 + 본 묶음)**:

| Rank | Entity / Domain | audit coverage | 비고 |
|------|-----------------|----------------|------|
| #1 | bookings | 78% (transition-grain 7/9) / 26% (endpoint-grain 7/27) | T003 묶음 1 |
| #2 | contracts | 71% (transition-grain 5/7) | T003 묶음 1 |
| #3 | invoices | 60% (endpoint-grain 6/10) / 60% (transition-grain 3/5) | **T003 묶음 2** |
| #4 (tie) | work_orders | 0% (T002.5 §7) | n/a |
| #4 (tie) | cs_tickets | 0% (T002.5 §7) | n/a |
| #4 (tie) | payment lookup-style 4 routes | **0% (24/24 floor — 단일 도메인 max-carrier)** | **T003 묶음 2 신규 floor** |

**finance 도메인 양극단**: invoices (60% — repo-wide 3rd) + payment (0% — repo-wide max-carrier floor) → **단일 도메인 안 audit polarisation 60% gap** 발견. 다른 도메인 (booking / contract) 은 같은 도메인 내부 carrier 들이 비슷한 coverage (booking 78% transition / contract 71%) 보이는데, finance 만 극단. CF-008 본문 expansion ("finance 도메인 내부 audit polarisation" sub-pattern) — 본 묶음 추가 사실.

**CF-022 state-transition 가드 cross-pack ranking update**:

| Rank | Entity | gated discipline | 비고 |
|------|--------|------------------|------|
| #1 | bookings | 100% (9/9 ✓) | T003 묶음 1 leader |
| #2 | invoices | 67% (2/3 manual: send/pay ✓; void ✗) — webhook 측은 별도 (bypass) | **T003 묶음 2** |
| #3 | cs_tickets | 50% | T002.5 |
| #4 | work_orders | 40% | T002.5 |
| #5 (tie) | contracts | 0% (0/7 ✗) | T003 묶음 1 floor |
| #5 (tie) | invoice webhook | 0% (1/1 bypass) | **T003 묶음 2 INV6 carrier** |
| #5 (tie) | payment lookup-style | n/a (state machine 부재) | n/a |

**도메인 의미**: invoice 가 manual 측은 67% gated 인데 webhook 측은 0% bypass → 동일 entity 안 정책 split 자체가 anomaly. CF-010 핵심 anchor + CF-022 사상 (정책 단일화 추천) 충돌 confirmation.

### §6.3 R-REPO-1 v2 Atomic carrier impact summary

본 묶음 영향 파일 (5 file ops):
1. `domain-logic-finance-invoice.md` (NEW ~250 lines)
2. `domain-logic-finance-payment.md` (NEW ~280 lines, 본 파일)
3. `_audit/CRITICAL_FINDINGS.md` (~+115 lines T003 묶음 2 marker section: CF-008 booking 26%/78% 명확화 + 6 CF expansion 표 + F10/F11/F12 + CF-010 본문 cross-ref + R-REPO-10 묶음 2 가속 측정 + R-REPO-9 차단 게이트 4회째)
4. `_schema/api-endpoints/INDEX.md` (last updated banner T003 묶음 2)
5. `_audit/_T003_PROGRESS.md` (묶음 2 entry + 누적 메트릭 갱신)
6. `.local/session_plan.md` (T003 묶음 2 entry)

### §6.4 R-REPO-10 가속 효과 측정 (묶음 2 실측)

| Metric | R-REPO-9 단독 (예상) | R-REPO-10 묶음 2 (실측) | Δ vs 묶음 1 |
|--------|---------------------|------------------------|------|
| 응답 횟수 / sub-task | 1회 | 0.5회 | 동률 (-50%) |
| 응답 횟수 / 묶음 | 2회 | 1회 | 동률 |
| Atomic commit / 묶음 | 2회 | 1회 | 동률 |
| 사용자 push / 묶음 | 2회 | 1회 | 동률 |

**가동 confirm 2회째**: T003 묶음 2 = 2 sub-task / 1 응답 / 1 commit / 1 push. 묶음 1 동일 패턴 재현 → R-REPO-10 영구 발효 stable.

---

**T003 묶음 2 (finance × 2: invoice + payment) 본문 + 통합 self-check 완료.**
