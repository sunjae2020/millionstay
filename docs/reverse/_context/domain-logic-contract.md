# Contract 도메인 — 비즈니스 규칙 + 워크플로우 + 불변식

> **Sub-task**: T003 묶음 1 sub-task 2 (booking + contract pair, 분할 (β) 채택). [domain-logic-booking.md](./domain-logic-booking.md) 와 짝.
> **Scope**: `contracts` 도메인의 코드 ground truth 비즈니스 로직 + 핵심 helper `generateContractInvoicesAndSchedules` (`contracts.ts:55-237`) 7-step 분해 + line_items source-of-truth 메커니즘.
> **Risk**: 🔴 P0. Triggering findings: [CF-002](../_audit/CRITICAL_FINDINGS.md#cf-002) (booking→contract precision loss 수신 측) / [CF-006](../_audit/CRITICAL_FINDINGS.md#cf-006) (Monthly Formula B 산재 — helper fallback 2 site `contracts.ts:93-94`) / [CF-008](../_audit/CRITICAL_FINDINGS.md#cf-008) (contract 5/7 = 71% audit coverage; cross-pack #2) / [CF-010](../_audit/CRITICAL_FINDINGS.md#cf-010) (contract activate 시 invoice 5-state 재생성 — Stripe payment lifecycle 와 분리) / [CF-011](../_audit/CRITICAL_FINDINGS.md#cf-011) (`nextContractRef` row-count race) / [CF-014](../_audit/CRITICAL_FINDINGS.md#cf-014) (helper 7-step ≥27 mutation no-tx — repo 최대 carrier) / [CF-019.b](../_audit/CRITICAL_FINDINGS.md#cf-019) (contract.expiry_date / signed_at / sent_at timezone 부재) / [CF-022](../_audit/CRITICAL_FINDINGS.md#cf-022) (contract 0/7 state-transition gated = 0% — cross-pack 최저 동률).
> **Cross-domain effects**: ① upstream — booking S2 confirm (`bookings.ts:368-531`) 가 contract Draft row + N line_items 자동 생성 ([domain-logic-booking.md §2.4](./domain-logic-booking.md#24-booking--contract-auto-creation-cascade-s2-confirm-internal)). ② downstream — contract activate (`contracts.ts:430-453`) 가 bookings.booking_status = "Active" cross-side write + helper 호출로 invoices N + recurring_schedules N cascade. ③ side — line_items soft-delete (`contracts.ts:612` `status="Deleted"`) 가 helper re-run 시 input 에서 자동 배제.

---

## §0 PURPOSE & SCOPE

### §0.1 contract 도메인의 두 정체성

`contracts` 는 본 코드베이스에서 **2 가지 정체성** 을 동시에 갖는다:

1. **법적 문서 (legal document)** — `contract_ref` (`MS-CON-NNNN`) + `terms_text` + `document_url` (signed PDF) + `signed_at` / `sent_at` / `expiry_date` timestamp + 7-state 수명주기 (Draft → Sent → Signed → Active → Terminated/Expired → Archived).
2. **billing 엔진의 input source** — `contract_line_items` (Active 만) + `contracts.start_date` / `end_date` / `billing_frequency` / `billing_day` 가 `generateContractInvoicesAndSchedules` helper 의 입력이 되어 invoice N + recurring_schedule N 을 생성. **contract activate 가 trigger**.

이 두 정체성이 한 테이블에 혼재 — Phase 2 EF Core 설계 시 분할 권장 (Aggregate boundary: `Contract` 법적 문서 + `BillingPlan` 청구 계획). 본 문서는 두 정체성을 §1 (법적 문서 transition) + §2 (billing 엔진 helper) 로 분리 기술.

### §0.2 In-scope / Out-of-scope

- **In**: `contracts` 7-state lifecycle, helper `generateContractInvoicesAndSchedules` 7-step 분해, `contract_line_items` 2-state (Active / Deleted) + 3 종 billing_trigger (`recurring` / `at_activation` / `at_booking` / `on_signing`), `recurring_schedules` wipe-and-recreate idempotency, `paidKeys` 보존 메커니즘, contract → booking + invoices + schedules 3-way cascade, payment-schedule 자식 CRUD 4 endpoint.
- **Out**: invoice 자체 lifecycle + Stripe webhook (→ T003 묶음 2 `domain-logic-invoice.md` + `domain-logic-payment.md`), recurring_schedules cron-driven 발행 흐름 (코드 부재 → CF-010 archive), super-admin 만 가능한 contract DELETE (→ T002.2.a contract.md).

---

## §1 비즈니스 규칙 (4 hard-coded constants + 5 transition + helper 7-step + 3 line_item triggers)

### §1.1 Money & default constants

| # | 규칙 | 식 | file:line | CF |
|---|------|----|-----------|-----|
| BR1 | line item 생성 시 unit_price `parseFloat` (string→float) | `parseFloat(unit_price ?? 0)` | `contracts.ts:569,593` | 🔴 [CF-002](../_audit/CRITICAL_FINDINGS.md#cf-002) precision loss site |
| BR2 | line item Monthly fallback = `weekly * (52/12)` (**Formula B**) | `weeklyRate * (52/12)` | `contracts.ts:93-94` (helper L81-114 fallback Rent line creation) | 🟡 [CF-006](../_audit/CRITICAL_FINDINGS.md#cf-006) Formula B site #3, #4 of 4 |
| BR3 | line item Biweekly fallback = `weekly * 2` | `weeklyRate * 2` | `contracts.ts:93` | (no CF — 일관) |
| BR4 | line item default `gst_included = true` (POST), default `currency = "AUD"` | `gst_included: gst_included ?? true`, `currency: currency ?? "AUD"` | `contracts.ts:580-581` | 🟡 BR4↔booking BR6/BR7 동일 패턴 |

**도메인 의미**: helper L55-237 의 fallback line item 생성 (booking 직후 contract 가 line_items 없이 create 된 경우) 도 Formula B 사용 — booking S2 의 fallback 과 정확히 일치 → **두 곳에서 같은 식이 hard-code 되어 표류 위험** (CF-006 carrier 4 sites 중 helper 가 2 sites). 수정 시 4 site 모두 동기화 필요.

### §1.2 State-transition rules (BR5-BR9)

| # | Transition | source state | target state | 가드 식 | file:line |
|---|------------|--------------|--------------|---------|-----------|
| BR5 | C1 send | Draft | Sent | (없음 — `db.update(...).where(eq(id, id))` 만) | `contracts.ts:407-416` |
| BR6 | C2 sign | Sent (전제) | Signed | (없음) | `contracts.ts:418-428` |
| BR7 | C3 activate | Signed (전제) | Active + bookings.booking_status="Active" + helper trigger | (없음) | `contracts.ts:430-453` |
| BR8 | C4 terminate | Active (전제) | Terminated | (없음 — `terminated_at`/`reason` 만 set) | `contracts.ts:455-465` |
| BR9 | C5 expire | Active (전제) | Expired | (없음) | `contracts.ts:467-476` |

**🔴 핵심 invariant 부재**: BR5-BR9 5 transition **전부** state-precondition 가드 없음. 즉 `Draft` 상태 contract 도 `POST /v1/contracts/:id/activate` 즉시 호출 가능 → helper 가 trigger 되어 `invoices` + `schedules` 생성. **CF-022 cross-pack 최저 동률** (state-machines.md §7 contract row 0/7 = 0% gated). booking 과의 양극단:

| 도메인 | gated | gate 율 | cross-pack rank |
|--------|-------|---------|-----------------|
| bookings | 9/9 | 100% | 🥇 leader |
| contracts | 0/7 | 0% | 🥉 floor (cs_tickets 와 동률) |

**도메인 의미**: contract activate 의 state-guard 부재는 결정적 결과 차이를 낳음 — Draft 또는 Terminated contract 도 activate 호출 시 helper 가 다시 trigger → invoices 중복 생성 가능 (단 `paidKeys` 보존 § §2.2 참조; non-paid 만 wipe 되므로 최악 시나리오는 prevent 됨; 그러나 `Terminated` 후 재활성 의도와 운영 정책이 충돌). Phase 2 시 5 transition 모두 source-state 가드 추가 + Terminated → Archive 만 허용 등 정책 명문화 필요.

### §1.3 contract_line_items 3 종 billing_trigger (BR10-BR12)

helper 가 line_items 의 `billing_trigger` 컬럼 값에 따라 분기 처리:

| # | billing_trigger 값 | 처리 경로 | file:line |
|---|-------------------|----------|-----------|
| BR10 | `"recurring"` (또는 fallback Rent line) | helper §2.2 step (v) — `billing_frequency` 따라 invoice + recurring_schedule N 생성 | `contracts.ts:137-194` |
| BR11 | `"at_activation"` (default for POST line-items) | helper §2.2 step (vi) — 1회 invoice 즉시 생성 (recurring_schedule 없음) | `contracts.ts:196-233` |
| BR12 | `"at_booking"` / `"on_signing"` | (helper 무시 — 현재 코드 dispatch 없음) | (음극 path) |

**도메인 의미**: BR12 는 **schema 만 존재 + 코드 dispatch 부재** 의 dead-trigger — `contract_line_items` 컬럼은 자유 텍스트이므로 미래에 `at_booking` 값을 갖는 line item 이 만들어져도 helper 는 처리하지 못함 → invoice 누락. T002.2.b finance-invoicing.md 의 CF-019.a sister evidence; T004 `_rules/financial-rules.md` 일괄 처리.

---

## §2 워크플로우 (3 sub-flows)

### §2.1 Mainline lifecycle

```
[*] ──booking S2 confirm trigger──▶ Draft
Draft ──C1 send (BR5)──▶ Sent
Sent ──C2 sign (BR6)──▶ Signed
Signed ──C3 activate (BR7)──▶ Active   [+ trigger §2.2 helper + cross-side §2.3]
Active ──C4 terminate (BR8)──▶ Terminated ──▶ [*]
Active ──C5 expire (BR9)──▶ Expired ──▶ [*]
{Terminated, Expired} ──soft-delete──▶ Archived ──▶ [*]
```

7-state lifecycle (Draft / Sent / Signed / Active / Terminated / Expired / Archived). [state-machines.md §3 Contracts](../_schema/state-machines.md#3-contracts-7-state) 의 `stateDiagram-v2` 와 일치.

**Lifecycle 의 비대칭**: Mainline 4-state 진행 (Draft→Sent→Signed→Active) 은 인간 승인 흐름; Active 이후 2 종료 path (Terminated 능동 / Expired 자동) + 1 archive sink. **C3 activate 만 side-effect 가짐** — 다른 4 transition 은 단순 state field UPDATE + audit log.

### §2.2 helper `generateContractInvoicesAndSchedules` 7-step 분해 (`contracts.ts:55-237`)

C3 activate 의 핵심 cascade. 단일 contract 1회 activate 시 sequential ≥27 mutation no-tx — **repo 최대 CF-014 carrier** (T002.2.b finance-invoicing.md ↔ contracts.ts ↔ stripe.ts 3 site 중 contract 가 단연 최대).

#### Step (i) Contract fetch (`:56-72`)
```ts
const [contract] = await db.select(...).from(contractsTable).where(eq(id, contractId));
if (!contract) return { invoices: 0, schedules: 0 };
```
- 단순 조회. early-return 으로 graceful no-op.

#### Step (ii) Active line_items fetch (`:78-79`)
```ts
const lineItems = await db.select().from(contractLineItemsTable)
  .where(and(eq(contract_id, contractId), eq(status, "Active")));
```
- **핵심 invariant: `status="Active"` 만 입력** — `Deleted` line items (soft-delete via `contracts.ts:612`) 는 자동 배제 → helper re-run 안전.

#### Step (iii) Fallback line creation (`:81-114`)
- `lineItems.length === 0 && contract.weekly_rate` 조건 시 booking metadata 로부터 Rent 1 line + booking_services N lines 자동 생성 (BR2/BR3 Formula B 적용).
- **idempotency 위험**: fallback 생성 후 다음 helper 재호출 시 line_items 가 이미 있으므로 fallback 미발생 ✓; 그러나 첫 fallback 실행 시 `db.insert(contractLineItemsTable)` 가 실패하면 부분 line_items 잔류 가능 (CF-014 sub-symptom).

#### Step (iv) Wipe non-paid invoices + schedules (`:117-133`)
```ts
const existingPaid = await db.select(...).where(and(contract_id, status="Paid"));
const paidKeys = new Set(existingPaid.map(p => `${p.line_item_id}|${p.due_date}`));
await db.delete(invoicesTable).where(and(contract_id, ne(status, "Paid")));
await db.delete(recurringSchedulesTable).where(eq(contract_id, contractId));
```
- **`paidKeys` Set 메커니즘 (INV5)**: re-activate 시 이미 결제된 invoice 보존 + 미결제 invoice 만 wipe + 모든 schedule wipe-and-recreate. `line_item_id|due_date` 조합 키.
- **위험**: `db.delete(recurringSchedulesTable)` 는 무조건 전체 삭제 → cron job 이 schedule 의 `next_due_date` 를 참조 중인데 동시 실행되면 race. Phase 2 시 advisory lock 필요.

#### Step (v) Per-line recurring loop (`:137-194`)
- `lineItems.filter(li => li.billing_trigger === "recurring")` 또는 default Rent line 에 대해:
  1. `billing_frequency` (weekly / biweekly / monthly) → period 계산
  2. `start_date` ~ `end_date` 사이 N period 반복 (`while (currentDate < endDate)` `:158`)
  3. **safety limit `:158-160`**: `if (++iterCount > 500) { break; }` — 무한 루프 방지 (예: end_date null 시).
  4. 각 period 마다:
     - `paidKeys.has(...)` skip ✓
     - `db.insert(invoicesTable).values(...)` (✓ status="Pending", `nextInvoiceRef` factory)
     - `db.insert(recurringSchedulesTable).values(...)` (단 해당 line 의 첫 invoice 시점에만 1회)

#### Step (vi) Per-line one-time charge loop (`:196-233`)
- `lineItems.filter(li => li.billing_trigger === "at_activation")` (BR11) 에 대해:
  1. `paidKeys.has(...)` skip
  2. 단일 invoice 즉시 생성 (status="Pending", due_date=오늘 + N days)
  3. recurring_schedule **없음** (1회성).

#### Step (vii) Return counts (`:235-237`)
```ts
return { invoices: invoicesGenerated, schedules: schedulesGenerated };
```
- caller (activate handler) 의 audit log payload 에 사용 (`contracts.ts:449`).

**총 mutation count (per 12-month monthly contract)**:
- Step (iii) fallback: 1 + N service lines (typical 0-5) ≤ 6
- Step (iv) wipe: 2 deletes
- Step (v) recurring: 12 monthly invoices + 1 schedule = 13
- Step (vi) one-time: 0-N (typical 0)
- Step (vii) return: 0
- **총 ≥21 sequential mutation** (typical case) ~ **≥27** (worst case with services + one-time charges) **모두 no-tx** — partial failure 시 contract 는 Active 인데 invoices 일부만 생성된 상태 가능. **CF-014 repo 최대 carrier 명확**.

### §2.3 Cross-side write — bookings.booking_status = "Active" (`contracts.ts:441-444`)

```ts
if (existing.booking_id) {
  await db.update(bookingsTable)
    .set({ booking_status: "Active" })
    .where(eq(bookingsTable.id, existing.booking_id));
}
```

**도메인 의미**: contract activate 시 연결된 booking 의 status 가 자동으로 "Active" 로 cross-side write. 즉 bookings 의 [BR8-BR12](./domain-logic-booking.md#12-state-transition-rules-br8-br12) state guard 가 contract 측 transition 에 의해 우회됨 — booking 의 [T2 check-in handler](../_schema/api-endpoints/booking.md) (`bookings.ts:640-652`) 와 별개로 booking 이 "Active" 진입 가능.

**시나리오 분석**:
- 정상 path: booking PendingPayment → S2 confirm → booking Confirmed + contract Draft 자동생성 → contract sign → contract activate → **booking Active 자동** (T2 check-in 호출 없이) + invoices 생성.
- **race condition**: booking 측 T2 check-in 과 contract 측 C3 activate 가 동시 실행 시 booking_status UPDATE 두 번 발생 (idempotent — 둘 다 "Active") ✓; 단 audit log 는 2회 기록되어 timeline reconstruction 시 중복 entry.
- **분쟁 path**: contract 가 Active 상태이고 booking 도 Active 인데, T4 cancel 호출하면 booking → Cancelled + dates unblock; 그러나 contract 는 Active 그대로 → invoices 계속 생성됨 (cron 가정 시). **데이터 불일치 risk** — Phase 2 시 booking cancel 이 contract 도 Terminated 처리하는 cascade 정책 필요.

---

## §3 불변식 (8 invariants)

| # | Invariant | 강제 site | 위반 시 동작 |
|---|-----------|-----------|------------|
| INV1 | C1-C5 5 transition 모두 state-precondition 가드 **없음** (BR5-9) | n/a | 임의 상태에서 transition 호출 가능 → audit log 만 남음 |
| INV2 | helper input 은 `contract_line_items.status="Active"` 만 | `contracts.ts:79` `eq(status, "Active")` | Deleted line item 은 자동 배제 ✓ |
| INV3 | helper recurring loop safety limit 500 iterations | `contracts.ts:158-160` `if (++iterCount > 500) break` | end_date null 또는 long-range contract 시 break + 부분 invoice |
| INV4 | helper wipe 시 `status="Paid"` invoices 보존 | `contracts.ts:122` `where(and(contract_id, ne(status, "Paid")))` | re-activate 안전 ✓ |
| INV5 | `paidKeys` Set 으로 re-activate 시 paid period 중복 invoice 차단 | `contracts.ts:120-121` Set + `:166,210` skip | 결제 완료 invoice 보존 ✓ |
| INV6 | helper schedule wipe 는 contract 단위 무조건 전체 삭제 | `contracts.ts:123` `where(eq(contract_id, contractId))` | re-activate 시 cron job race 가능 ⚠️ |
| INV7 | line item soft-delete (`status="Deleted"`) — hard-delete 없음 | `contracts.ts:612` `set({ status: "Deleted" })` | helper input 자동 배제 + audit 추적 가능 ✓ |
| INV8 | activate 시 `effective_date = 오늘` 자동 set (override 불가) | `contracts.ts:433` `effective_date: new Date().toISOString().slice(0, 10)` | 사용자 입력 무시 — 백데이팅 불가능 |

**INV1 의 도메인 함의**: 5 transition 가드 부재는 의도적 (운영자가 어느 상태에서든 강제 전환 필요) 또는 burn-out 한 코드 (booking 과 비교해 의식 부재) 의 양쪽 가능성. **state-machines.md §7 ranking 에서 contract 가 cross-pack 최저 동률** = 의도가 아닌 책임 분산 부재 시그널 강함. Phase 2 시 정책 명문화 필요.

**INV3 의 함의**: 500 iteration cap = 약 9.6년 weekly contract 또는 41년 monthly contract 까지 처리 가능 → 실용 운영 cap. 단 무한 루프 방지가 본 의도. Phase 2 EF Core 시 명시적 max-period 컬럼으로 표현 권장.

**INV6 의 함의**: schedule 전체 wipe 는 cron job 실행 중 race risk — 만약 cron 이 schedule 을 읽은 직후 activate 가 wipe-recreate 하면 cron 은 stale schedule 로 invoice 추가 발행 가능. 현재 코드에 cron 자체가 없으므로 (`recurring_schedules` 는 read-only) 즉시 위험 아님. **Phase 2 cron 도입 시 advisory lock 필수** — T004 `_rules/architecture-rules.md` 일괄 처리 후보 (F-pending memo).

---

## §4 Cross-domain effects 매핑

| 발신 transition | 수신 도메인 / 컬럼 | 효과 | 시점 | 가드 |
|-----------------|-------------------|------|------|------|
| (외부) booking S2 confirm | `contracts` row INSERT 16-col + `contract_line_items` × N | INSERT (booking 측 트리거) | S2 confirm 시 | `existingContracts.length === 0 && account_id` ([booking INV6/INV7](./domain-logic-booking.md#3-불변식-8-invariants)) |
| C1 send | `contracts` UPDATE `status="Sent" + sent_at=now()` | UPDATE | send handler | (없음 — INV1) |
| C2 sign | `contracts` UPDATE `status="Signed" + signed_at=now() + document_url=옵션` | UPDATE | sign handler | (없음) |
| C3 activate | `contracts` UPDATE `status="Active" + effective_date=오늘` | UPDATE | activate handler | (없음) |
| C3 activate | `bookings.booking_status` | UPDATE → "Active" (cross-side write) | activate handler 안 (`:441-444`) | `existing.booking_id` IS NOT NULL |
| C3 activate | `invoices` INSERT × N | helper §2.2 step (v) + (vi) | activate handler 호출 helper | `paidKeys` skip 외 (없음) |
| C3 activate | `recurring_schedules` INSERT × M (M = recurring line 수) | helper §2.2 step (v) | activate handler 호출 helper | (없음) |
| C3 activate (re-run) | `invoices` DELETE non-paid + `recurring_schedules` DELETE all | helper §2.2 step (iv) | activate handler 호출 helper | `paidKeys` 보존 |
| C4 terminate | `contracts` UPDATE `status="Terminated" + terminated_at=now() + reason` | UPDATE | terminate handler | (없음) |
| C5 expire | `contracts` UPDATE `status="Expired"` | UPDATE | expire handler | (없음) |
| line_items DELETE (`/v1/contracts/:id/line-items/:lineId`) | `contract_line_items` UPDATE `status="Deleted"` (soft) | UPDATE | DELETE handler `:610-614` | (없음) |
| payment-schedule POST/PATCH/DELETE (`/v1/contracts/:id/payment-schedule[/:schedId]`) | `recurring_schedules` CRUD | INSERT / UPDATE / DELETE | sched CRUD handlers `:478-542` | scoped: `WHERE id=schedId AND contract_id=URL_id` ✓ |

**양극단 비교 (booking ↔ contract)**:
- booking = state-guard 100% / cross-side write 1 (contract auto-create at S2)
- contract = state-guard 0% / cross-side write 1 (bookings.booking_status at C3) + cascade 2 (invoices, schedules) + helper 7-step ≥27 mutation no-tx
- **둘이 양방향으로 status 를 cross-write** — Aggregate boundary 설계 시 단일 aggregate 또는 outbox event 필수 ([booking §4 cross-domain effects](./domain-logic-booking.md#4-cross-domain-effects-매핑) 와 동일 결론).

**Audit completeness**:
- booking = 7/9 transition logAction
- contract = 5/7 transition logAction (`:413,425,449,463,475` send/sign/activate/terminate/expire 모두 ✓; soft-delete contract DELETE 는 다른 handler) — **CF-008 cross-pack #2** (state-machines.md §7).
- helper §2.2 step (iv) wipe + step (v)(vi) insert = audit log 부재 → invoice 생성/재생성 시점 추적 불가. payload `{ invoices_generated: N, schedules_generated: M }` 만 contract 측 audit 에 남음 (`:449`).

---

## §5 Cross-references + Self-check

### §5.1 Cross-references

- State machine: [state-machines.md §3 Contracts](../_schema/state-machines.md#3-contracts-7-state) (7-state stateDiagram-v2 + transition table) + [§7 cross-pack ranking](../_schema/state-machines.md#7-cross-pack-rankings) (CF-008 71% / CF-022 0%).
- Schema: [db-schema-overview.md §1.3 Booking-Contract-Finance cluster](../_schema/db-schema-overview.md) — `contracts` 16-col + `contract_line_items` 14-col + `recurring_schedules` 11-col.
- ERD: [erd-core.md §4 Booking-Contract-Finance cluster](../_schema/erd-core.md) Mermaid + implicit FK + Phase 2 권장 FK 부록.
- Endpoints: [api-endpoints/contract.md](../_schema/api-endpoints/contract.md) (21 endpoints, 904 lines, 28-target re-classified to 21 active + 7 helper).
- Booking pair: [domain-logic-booking.md §2.4 booking → contract auto-creation cascade](./domain-logic-booking.md#24-booking--contract-auto-creation-cascade-s2-confirm-internal) + [§4 cross-domain effects](./domain-logic-booking.md#4-cross-domain-effects-매핑).
- Invoice/payment cascade downstream: [domain-logic-invoice.md / domain-logic-payment.md] (T003 묶음 2, PENDING).
- Architecture rule (DEAD trigger BR12 + helper Tx + cron race): [_rules/architecture-rules.md] (T004, PENDING).

### §5.2 R-REPO-7 Trade-off (3개 결정)

| # | 결정 | 채택 | 미채택 | 이유 |
|---|------|------|--------|------|
| 1 | helper 7-step 분해 형식 | bullet list per step + 코드 snippet + per-step file:line | (i) 표 형식 한 줄 / (ii) prose 단일 단락 | 7 step 각각 mutation 종류 + idempotency mechanism 다름 → step-wise 분해가 audit-readable. CF-014 evidence 명시성 우선. |
| 2 | `paidKeys` 보존 표기 | INV4+INV5 두 invariant 분리 + step (iv)/(v)/(vi) 본문 cross-ref | 단일 INV4 묶음 | "wipe 정책" 과 "skip 정책" 은 각기 다른 보호 — 분리해야 Phase 2 EF Core 매핑 시 두 정책 별도 표현 |
| 3 | `bookings.booking_status="Active"` cross-side write 표기 | §2.3 별도 sub-section + §4 cross-domain effects 표 entry + INV 미포함 | INV 만 / cross-domain 표만 | 두 도메인의 양방향 결합은 Phase 2 Aggregate boundary 결정에 critical → §2.3 본문 + 시나리오 분석 강조 |

### §5.3 R-REPO-5 Incidental disposition (T003 묶음 1 마무리)

본 sub-task 작성 중 신규 incidental 0건 — 모두 기존 finding cross-ref 로 처리됨:
- BR12 dead-trigger (`at_booking` / `on_signing`) → CF-019.a sister evidence + T004 `_rules/financial-rules.md` 일괄.
- INV6 cron race risk → T004 `_rules/architecture-rules.md` 일괄.
- helper audit log 부재 (step (iv)(v)(vi) 무 audit) → CF-008 carrier (이미 §4 enumerate).
- `effective_date` 자동 set (INV8) override 불가 → T002.5 §X.fix 에 이미 cross-ref 가능 (특별 시나리오 미발견 → 단순 메모).

T003 묶음 1 누적 incidental: F9 (booking PDF bond return text-only) **only 1 신규** — `domain-logic-booking.md §5.3` 에 등재 완료.

### §5.4 3-claim spot-check

| # | Claim | 검증 방법 | 결과 |
|---|-------|-----------|------|
| C1 | helper safety limit `if (++iterCount > 500) break` 가 `contracts.ts:158-160` 에 정확히 있고 무한 루프 방지 의도 | `sed -n 155,165p contracts.ts` | ✅ `:158` `if (++iterCount > 500) {` + `:159` `break;` + `:160` `}` 정확. INV3 anchor 확정. |
| C2 | C3 activate `:441-444` 가 booking_id 존재 시 `bookings.booking_status="Active"` UPDATE 발생 | `sed -n 440,446p contracts.ts` | ✅ `if (existing.booking_id) { await db.update(bookingsTable).set({ booking_status: "Active" }).where(eq(bookingsTable.id, existing.booking_id)); }` 정확. §2.3 cross-side write anchor 확정. |
| C3 | line_items soft-delete (`:612`) 가 `status="Deleted"` set 만 하고 hard-delete 없음 + helper `:79` 가 `eq(status, "Active")` 로 자동 배제 | `:610-614` DELETE handler + `:79` helper Active filter | ✅ `:612` `db.update(...).set({ status: "Deleted", updated_at })` (UPDATE, no DELETE FROM) + `:79` `eq(contractLineItemsTable.status, "Active")` 정확. INV2+INV7 anchor 확정. |

3/3 spot-check ✅. helper 의 핵심 invariant + cross-side write + line_items source-of-truth 메커니즘 모두 file:line 정확.

---

## §6 묶음 통합 self-check (T003 묶음 1 booking + contract)

### §6.1 Cross-ref bidirectional check

| Direction | Anchor | Target | 일관성 |
|-----------|--------|--------|--------|
| booking →→ contract | [booking §2.4](./domain-logic-booking.md#24-booking--contract-auto-creation-cascade-s2-confirm-internal) | contract §4 (외부) booking S2 confirm row | ✅ 양방향 file:line + 가드 식 (`existingContracts.length === 0 && account_id`) 모두 일치 |
| contract →→ booking | contract §2.3 + §4 C3 activate row | [booking §4](./domain-logic-booking.md#4-cross-domain-effects-매핑) "외부 trigger: contract activate" row | ✅ 양방향 `:441-444` + `bookings.booking_status="Active"` 모두 일치 |
| booking BR3 (Formula B `bookings.ts:485`) | contract BR2 (Formula B `contracts.ts:93-94`) | CF-006 4-site 일치 | ✅ 4 site 모두 cross-ref |
| booking CF-002 (precision loss source) | contract BR1 (precision loss receiver `parseFloat`) | money path 양방향 | ✅ source `:393-394` parseFloat → receiver `:458-461` real-typed 4 cols + line_items `:569,593` parseFloat 모두 일치 |

### §6.2 Cross-pack ranking 일관성

| Metric | bookings | contracts | source |
|--------|----------|-----------|--------|
| State-guard discipline (CF-022) | 9/9 = 100% (leader) | 0/7 = 0% (floor) | state-machines.md §7 |
| Audit coverage (CF-008) | 7/9 = 78% (cross-pack #1 by transition / 67% by endpoint) | 5/7 = 71% (cross-pack #2) | T002.5 §7 |
| No-tx mutation locus (CF-014) | S2 ≥6 + N + M, T5 ≥3 | helper ≥27 (repo 최대) | finance-invoicing.md cross-ref |
| IDOR-safe (CF-018) | 3 BAD + 2 POSITIVE 동일 파일 | scoped CRUD 4 endpoint ✓ (`:525,537`) | booking.md §3 / contract.md §6 |

**도메인 의미**: booking 과 contract 는 **서로 정반대 패턴** 으로 동일 cluster 안에 존재 — bookings = guard-discipline 모범, contracts = guard-discipline 부재. 한 cluster 안의 양극단은 구조적 일관성 부재 시그널 (CF-024 sister 후보; T004 architecture-rules 일괄). Phase 2 시 cluster-내 일관성 정책 정립 필요.

### §6.3 묶음 atomic carrier impact summary

본 묶음 (T003 묶음 1) atomic commit 영향 파일:

1. **NEW** `docs/reverse/_context/domain-logic-booking.md` (581 lines, sub-task 1)
2. **NEW** `docs/reverse/_context/domain-logic-contract.md` (이 파일, ~530 lines, sub-task 2)
3. **EXPAND** `docs/reverse/_audit/CRITICAL_FINDINGS.md` (~+95 lines: T003 묶음 1 marker section + F9 신규 incidental + CF-006/007/014/018/022 booking+contract domain-logic anchor expansion + R-REPO-6 11회째 mirror + R-REPO-9 차단 게이트 3회째 mirror + R-REPO-10 묶음 위임 첫 가동 mirror)
4. **UPDATE** `docs/reverse/_schema/api-endpoints/INDEX.md` (T003 묶음 1 banner row 추가)
5. **NEW** `docs/reverse/_audit/_T003_PROGRESS.md` (T003 ledger 시작; 묶음 1 entry + commit hash 컬럼)
6. **UPDATE** `.local/session_plan.md` (T003 묶음 1 entry)

**6 file ops atomic commit** (R-REPO-1 v2 + R-REPO-10 (e) — 묶음 1 = 단일 atomic commit).

### §6.4 R-REPO-10 첫 가동 효과 측정

| Metric | R-REPO-9 단독 (T002 후반부 6 sub-task 평균) | R-REPO-10 묶음 (T003 묶음 1 측정) | 효과 |
|--------|------|------|------|
| 응답 횟수 / sub-task | 1회 | 0.5회 (2 sub-task / 1 응답) | -50% |
| 응답 횟수 / 묶음 | 2-3회 (각 sub-task 1회) | 1회 | -67% |
| Atomic commit 횟수 / 묶음 | 2-3회 | 1회 | -67% |
| 사용자 push 횟수 / 묶음 | 2-3회 | 1회 | -67% |

**가동 confirm**: T003 묶음 1 = 2 sub-task (booking + contract) 1 응답 1 commit 1 push → R-REPO-10 (g) 가속 효과 50%+ 절감 측정 일치.

---

**T003 묶음 1 (booking + contract domain logic) — 두 sub-task 본문 + 묶음 통합 self-check 완료.**

**다음 묶음 자동 시작 절대 금지** (R-REPO-10 finale rule). 사용자 push + proceed 명시 후 T003 묶음 2 (finance × 2: invoice + payment) 진입.
