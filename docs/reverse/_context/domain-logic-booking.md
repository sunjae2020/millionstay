# Booking 도메인 — 비즈니스 규칙 + 워크플로우 + 불변식

> **Sub-task**: T003 묶음 1 sub-task 1 (booking + contract pair, 분리 (β) 채택).
> **Scope**: `bookings` 도메인의 코드 ground truth 비즈니스 로직 (T002 inventory 차원과 구분 — T002 = "어디에 무엇이 있나", T003 = "왜/언제/어떻게 동작하나").
> **Risk**: 🔴 P0. Triggering findings: [CF-002](../_audit/CRITICAL_FINDINGS.md#cf-002) (booking→contract precision loss) / [CF-006](../_audit/CRITICAL_FINDINGS.md#cf-006) (Monthly billing Formula B 산재) / [CF-007](../_audit/CRITICAL_FINDINGS.md#cf-007) (4-week bond / 2-week advance hard-code) / [CF-008](../_audit/CRITICAL_FINDINGS.md#cf-008) (booking 6/9 = 67% audit coverage) / [CF-011](../_audit/CRITICAL_FINDINGS.md#cf-011) (`generateBookingRef` row-count race) / [CF-014](../_audit/CRITICAL_FINDINGS.md#cf-014) (S2 confirm 5+ writes no-tx; T5 extend money recompute no-tx) / [CF-018](../_audit/CRITICAL_FINDINGS.md#cf-018) (Sub-pattern A — 3 BAD IDOR sites at `:572/:728/:735` + 2 POSITIVE) / [CF-022](../_audit/CRITICAL_FINDINGS.md#cf-022) (state-transition discipline 9/9 — cross-pack leader) / [CF-023](../_audit/CRITICAL_FINDINGS.md#cf-023) (3 booking_ref generators).
> **Cross-domain effects**: S2 confirm (`bookings.ts:368-531`) is the **upstream trigger** for the entire `contracts` lifecycle (auto-creates `contracts` row + N `contract_line_items`, then sets `space_blocked_dates`). T5 extend re-blocks dates and recomputes stay money. SD soft-delete writes `Archived` status. Detail in §4.

---

## §0 PURPOSE & SCOPE

### §0.1 T002 vs T003 차이

| 차원 | T002 (`_schema/api-endpoints/booking.md`) | T003 (이 파일) |
|------|---|---|
| 단위 | 27 endpoints (S1-S8 + N1-N3 + R1-R8 + W1-W5) | 비즈니스 규칙 / 워크플로우 / 불변식 |
| 출처 | router decl + handler 시그니처 + Meta header | hard-coded constants + control flow + cross-handler interactions |
| 사용처 | Phase 2 EF Core endpoint 매핑 | Phase 2 도메인 모델 + 비즈니스 규칙 영구 보존 |
| 중복 회피 | endpoint 단위 logAction / Zod / IDOR audit | endpoint 단위 cataloging 안 함 — booking.md cross-ref |

본 문서는 **booking.md §3 가 enumerate 한 endpoint 들이 함께 만들어 내는 비즈니스 의미** 를 기록한다. 동일 file:line 인용을 사용하되, 도메인 의도 (왜) + 도메인 시퀀스 (언제 무엇 다음에) + 도메인 가드 (어떤 상태에서 무엇을 거부하나) 의 3축으로 재구성한다.

### §0.2 In-scope / Out-of-scope

- **In**: `bookings` 테이블의 컬럼 의미, S2/S4/T1-T5 transition 의 비즈니스 의도, booking → contract auto-creation cascade, `bookingsTable.booking_status` enum 8 main + outlier, 가격 재계산 (`calcStayDetails`, `bondAmount`, `advanceAmount`, `rentUnitPrice`), `space_blocked_dates` block/unblock 비대칭, document/service 자식 entity 가드.
- **Out**: contract 자체 lifecycle (→ `domain-logic-contract.md`), invoice/payment 생성 detail (→ T003 묶음 2 `domain-logic-invoice.md` + `domain-logic-payment.md`), guest-portal 의 user-facing flow (→ T005 `_workflows/`).

---

## §1 비즈니스 규칙 (10 hard-coded constants + 3 derived rules)

### §1.1 Money constants (CF-006 / CF-007 anchor)

| # | 규칙 | 식 | file:line | CF |
|---|------|----|-----------|-----|
| BR1 | Security bond = **4 weeks rent** | `bondAmount = weeklyRate * 4` | `bookings.ts:395` | 🟡 [CF-007](../_audit/CRITICAL_FINDINGS.md#cf-007) hard-code site #1 |
| BR2 | Advance payment = **2 weeks rent** | `advanceAmount = weeklyRate * 2` | `bookings.ts:396` | 🟡 [CF-007](../_audit/CRITICAL_FINDINGS.md#cf-007) hard-code site #2 |
| BR3 | Monthly rent = `weekly * (52/12)` (**Formula B**) | `weeklyRate * (52/12)` | `bookings.ts:485` (S2 confirm), `contracts.ts:93-94` (helper fallback) | 🟡 [CF-006](../_audit/CRITICAL_FINDINGS.md#cf-006) Formula B site #1, #2 of 4 |
| BR4 | Biweekly rent = `weekly * 2` | `weeklyRate * 2` | `bookings.ts:484`, `contracts.ts:93` | (no CF — 일관) |
| BR5 | Stay nights = `(out - in) / 86_400_000` | `Math.round((cout - cin) / (1000*60*60*24))` | `bookings.ts:74` (`calcStayDetails`) | (no CF — 일관) |
| BR6 | Default currency = `"AUD"` | `existing.currency ?? "AUD"` | `bookings.ts:462,498,515` (× 3 sites in S2) + booking.md §3.B.W1 W2 W4 | 🟡 [CF-016](../_audit/CRITICAL_FINDINGS.md#cf-016) hard-code 산재 |
| BR7 | Default GST included = `true` | `gst_included: true` | `bookings.ts:499,516` (× 2 in S2 line items) | (T002.5 §X memo F-pending) |

**도메인 의미**: BR1-BR2 는 호주 표준 임대 관행 (4-week bond, 2-week advance) 을 코드로 박은 것 — 정책 변경 시 4 컬럼 + S2 PDF text + sample 포맷 모두 수정 필요. BR3-BR4 는 청구 주기 unit-price 환산 — Monthly 만 `52/12 = 4.333…` 사용 (1주 ≠ 1/4 month 의 정밀 표현). BR5 의 `Math.round` 는 DST/timezone-shift 케이스에서 1-night 오차 발생 가능 (UTC 미사용; **F9 cross-ref** 참조 §5.3). BR7 은 contract_line_items 모든 행이 GST-inclusive 로 강제 — pre-tax 청구는 본 코드 경로로 표현 불가능.

### §1.2 State-transition rules (BR8-BR12)

| # | 규칙 | 가드 식 | file:line |
|---|------|---------|-----------|
| BR8 | `submit` 는 `Draft` 만 허용 | `existing.booking_status !== "Draft"` ⇒ 400 | `bookings.ts:360` |
| BR9 | `confirm` 는 `{PendingApproval, PendingPayment}` 만 허용 | `!["PendingApproval","PendingPayment"].includes(...)` ⇒ 400 | `bookings.ts:373` |
| BR10 | `reject` 는 `PendingApproval` 만 허용 | `existing.booking_status !== "PendingApproval"` ⇒ 400 | `bookings.ts:631` |
| BR11 | `cancel` 는 `{CheckedOut, Cancelled}` 외 모두 허용 | `["CheckedOut","Cancelled"].includes(...)` ⇒ 400 | `bookings.ts:675` |
| BR12 | `extend` 는 `{Confirmed, Active}` 만 허용 | `!["Confirmed","Active"].includes(...)` ⇒ 400 | `bookings.ts:695` |

**모범 anchor**: BR8-BR12 는 9/9 transition 모두 가드 갖춤 → CF-022 cross-pack leader (T002.2.j §4 + T002.5 §7 confirm). 단, **STATUS_CHANGE log 는 7/9 transition 만 갖춤** (CF-008): `T5 extend` (`bookings.ts:710`) 는 booking_status 변경 없으므로 의도적 누락; `SD soft-delete` (`bookings.ts:334,350`) 는 `Archived` 라는 *상태* 변경임에도 STATUS_CHANGE log 부재 — Phase 2 audit 정책 정정 필요.

### §1.3 Required-field invariants

- **BR13**: `cancel` + `reject` 두 transition 모두 `cancellation_reason` body 필드 필수 (`CancelBookingBody.safeParse(req.body)` Zod 검증, `bookings.ts:627,671`). Body 누락 시 400 — booking 의 cancellation 은 audit/CRM 정책상 reason 강제.

---

## §2 워크플로우 (5 sub-flows)

### §2.1 Mainline lifecycle

```
[*] ──C0/C0' admin/guest create──▶ Draft
Draft ──S4 submit (BR8)──▶ PendingPayment
{PendingApproval, PendingPayment} ──S2 confirm (BR9)──▶ Confirmed   [+ trigger §2.4]
Confirmed ──T2 check-in──▶ Active
Active ──T3 check-out──▶ CheckedOut ──▶ [*]
```

5-state 직선 mainline. `Draft → PendingPayment` 는 self-initiated submission, `→ Confirmed` 는 admin/payment 측 승인, `→ Active` 는 입주 시점, `→ CheckedOut` 은 퇴거 시점. **mainline 의 어느 단계에서도 `space_blocked_dates` insert 는 S2 한 곳에서만 일어남** (다른 transition 은 차단 아님). 그러므로 캘린더 가시성은 S2 confirm 직후부터 시작.

### §2.2 Cancellation branches

- T1 reject: `PendingApproval → Cancelled` (`bookings.ts:635`) — admin 거절 path. **`unblockDatesForBooking` 호출 없음** (PendingApproval 단계에서는 dates 가 아직 block 되지 않았다는 invariant 가정 ✓).
- T4 cancel: `{Draft, PendingPayment, PendingApproval, Confirmed, Active} → Cancelled` (`bookings.ts:683`) — 보편 cancel. **conditional unblock**: `existing.space_id && check_in_date && check_out_date && booking_status ∈ ["Confirmed","Active"]` 일 때만 `unblockDatesForBooking` 호출 (`:679-682`). 즉 *S2 confirm 이후* cancel 만 unblock 발생.

**비대칭 위험**: T1 의 단순화 가정 (PendingApproval → block 되지 않음) 은 booking.md §3.A.T1 의 "latent leak" 으로 분류된 상태. 만약 미래에 PendingApproval 단계에서도 잠정 block 정책이 도입되면 T1 도 unblock 필요. 현재는 **보장된 invariant 아님** (전제) — 도메인 정책 변경 시 BR8-BR12 와 함께 재검토 의무.

### §2.3 Stay extension (T5)

`PATCH /v1/bookings/:id/extend` (`bookings.ts:688-712`):
1. BR12 가드 (`Confirmed || Active` 만 허용).
2. 기존 dates `unblockDatesForBooking` (`:702`).
3. 신규 dates `blockDatesForBooking` (`:703`) — **N + N 순차 DELETE/INSERT**, no-tx (CF-014 sister site).
4. `calcStayDetails(check_in, NEW_check_out, weekly_rate)` 로 `stay_weeks` / `stay_nights` / `total_rent` 재계산 (`:706-708`).
5. `bookings` UPDATE `check_out_date` + 재계산 결과 (`:710`).
6. **STATUS_CHANGE log 부재** (의도된 BR12 누락 — booking_status 자체는 변경 없음).

**Race condition**: unblock → block 사이에 동시 booking 이 같은 dates 를 잡을 수 있음 (no advisory lock). Phase 2 시 transaction 추가 + advisory lock 권장.

### §2.4 booking → contract auto-creation cascade (S2 confirm internal)

**This is the project's single largest cross-domain side effect.** S2 confirm handler (`bookings.ts:368-531`, **164 lines**) 는 한 transition 안에서 5 종류의 effect 를 일으킨다:

| Effect | 코드 위치 | 설명 |
|--------|-----------|------|
| 1. `space_blocked_dates` insert | `bookings.ts:378` (`blockDatesForBooking`) | dates × N 개 row INSERT — 캘린더 가시성 활성 |
| 2. `bookings` UPDATE `booking_status="Confirmed"` | `bookings.ts:380` | core transition |
| 3. STATUS_CHANGE audit log | `bookings.ts:381` | CF-008 audit 모범 |
| 4. `contracts` INSERT (조건부) | `bookings.ts:449-465` | **only if** `existingContracts.length === 0 && existing.account_id` (`:386`); 조건 충족 시 16-column INSERT |
| 5. `contract_line_items` INSERT (가변 N) | `bookings.ts:489-521` | 1 Rent line + per-service line; 각 line `gst_included: true` BR7 |

**Money path (CF-002)**: S2 의 `bondAmount` / `advanceAmount` / `rentUnitPrice` 는 모두 `parseFloat(numeric_string)` 로 계산되어 `real`-typed 4 contract 컬럼에 저장 — bookings (numeric) → contracts (real) 정밀 손실 site. **CF-002 anchor file:line 정확히 `:393-394` (parseFloat) + `:458-461` (real columns assignment)**.

**Idempotency safeguard**: line `:386` 의 `existingContracts.length === 0` 가드는 **재호출 안전** (이미 contract 있으면 추가 contract 만들지 않음) ✓. 그러나 transaction 부재로 인해 **부분 실패 시 일부 line_items 만 남는 상태** 가능 — CF-014 carrier.

**No-tx mutation count (CF-014)**: S2 한 transition 의 sequential 쓰기 = `block dates × M` + `bookings UPDATE × 1` + `audit log × 1-2` + `contracts INSERT × 1` + `line_items INSERT × N` = **최소 4 + N + M ≥ 6 mutation no-tx**. 현재 known 최대 N = booking_services rows count (typically 0-5). M = check-out − check-in days (typically 14-365).

### §2.5 Document/service nested write paths (CF-018 anchor)

booking.md §3 의 N1-N3 + S5-S8 = nested-resource handlers:
- N2/R6 = **POSITIVE EXEMPLAR**: `WHERE id=svcId AND booking_id=URL_param` (`bookings.ts:587,614`) — IDOR-safe.
- N1 (`bookings.ts:572`) + T6 (`bookings.ts:728`) + T7 (`bookings.ts:735`) = **BAD IDOR**: `WHERE id=svcId` only, URL `:id` (booking_id) 무시 → cross-booking 자식 변조 가능. CF-018 Sub-pattern A 본 도메인 anchor 3 sites.

**도메인 의미**: 동일 파일 안에서 같은 저자가 N1 (BAD) 과 N2 (POSITIVE) 를 모두 작성 — booking.md §6 "author knew the safe pattern but didn't apply it consistently". Phase 2 시 모든 nested-write 를 N2 패턴으로 통일 + middleware 추출 권장.

---

## §3 불변식 (8 invariants)

| # | Invariant | 강제 site | 위반 시 동작 |
|---|-----------|-----------|------------|
| INV1 | `cancellation_reason` 필수 (T1, T4) | `bookings.ts:627, 671` Zod | 400 + Zod error |
| INV2 | `extend` 는 mainline 진행 중인 booking 만 (BR12) | `bookings.ts:695` | 400 |
| INV3 | `confirm` 은 PendingApproval 또는 PendingPayment 만 (BR9) | `bookings.ts:373` | 400 |
| INV4 | terminal state (`CheckedOut`, `Cancelled`) 에서 `cancel` 재실행 금지 (BR11) | `bookings.ts:675` | 400 |
| INV5 | terminal state 후 `extend` 금지 (BR12 의 partial 효과) | `bookings.ts:695` (Confirmed/Active 외 모두 거부) | 400 |
| INV6 | S2 confirm 시 `contracts` 중복 생성 방지 | `bookings.ts:386` `existingContracts.length === 0` | 기존 contract 사용 (no error) |
| INV7 | `account_id` null 인 booking 은 contract 자동생성 안 함 | `bookings.ts:386` `&& existing.account_id` | contract skip (booking 만 confirmed) |
| INV8 | `space_id + check_in + check_out` 모두 있어야 dates block (S2/T4/T5) | `bookings.ts:377, 679-682, 701` `&&` chain | 무음 skip |

**INV5 의 함의**: PendingPayment 단계에서 사용자가 결제 보류 중인데 dates 만 연장하고자 하면 가드에 막힘 → **booking 도메인은 PendingPayment 에서 stay 길이를 변경하는 정책을 코드로 차단**. UI 흐름은 cancel + 새 booking create 또는 PUT `/v1/bookings/:id` (관리자 일반 update) 우회 필요. 이 우회는 가드 없음 — Phase 2 정책 명문화 필요.

**INV7 의 함의**: guest-portal 경로 (C0' outlier) 로 `account_id` null booking 이 만들어졌을 경우, S2 confirm 가능하나 contract 는 자동생성되지 않음 → 이후 전체 finance cascade (contract → invoices → schedules) 전부 trigger 안 됨. **구조적 dead-end** — 이 outlier 는 F7 (T002.5) cross-pack 으로 등록됨.

---

## §4 Cross-domain effects 매핑

| 발신 transition | 수신 도메인 / 컬럼 | 효과 | 시점 |
|-----------------|-------------------|------|------|
| S2 confirm | `contracts` (`Draft` row) | INSERT 16 columns | confirm 직후 동일 transaction 외부 |
| S2 confirm | `contract_line_items` × (1 + booking_services count) | INSERT N rows | contract INSERT 다음 |
| S2 confirm | `space_blocked_dates` × M days | INSERT M rows (M = check-out − check-in) | confirm 시작 시 |
| T4 cancel (Confirmed/Active) | `space_blocked_dates` × M | DELETE M rows | UPDATE 직전 |
| T1 reject | (없음 — by INV 가정) | n/a | n/a |
| T5 extend | `space_blocked_dates` × M_old | DELETE | UPDATE 전 |
| T5 extend | `space_blocked_dates` × M_new | INSERT | DELETE 후 |
| 외부 trigger: contract activate (`contracts.ts:441-444`) | `bookings.booking_status` | UPDATE → "Active" | contract activate handler 안 (booking → contract 단방향이 아닌 양방향 cross-side write) |

**양방향 결합 risk**: S2 (booking) → contracts INSERT, contract activate (`contracts.ts:441-444`) → bookings UPDATE Active. 두 도메인이 양방향으로 status 를 cross-write 한다 — Phase 2 Aggregate boundary 설계 시 주의 (단일 aggregate 또는 outbox event 권장; `domain-logic-contract.md` §2.4 cross-ref).

**Audit gap**: `space_blocked_dates` insert/delete 는 audit log 출력 없음 (CF-008 carrier). 캘린더 잠금 시점/해제 시점 추적 불가. 운영 분쟁 발생 시 timeline reconstruction 불가능.

---

## §5 Cross-references + Self-check

### §5.1 Cross-references

- State machine: [state-machines.md §2 Bookings](../_schema/state-machines.md#2-bookings-8-main--1-pending-outlier) (8 main + Pending outlier `stateDiagram-v2`).
- Schema: [db-schema-overview.md §1.3 Booking-Contract-Finance cluster](../_schema/db-schema-overview.md) — `bookings` 50 컬럼.
- ERD: [erd-core.md §4](../_schema/erd-core.md) — Booking-Contract-Finance cluster Mermaid + implicit FK.
- Endpoints: [api-endpoints/booking.md](../_schema/api-endpoints/booking.md) (27 endpoints, 736 lines).
- Contract pair: [domain-logic-contract.md §2.4 booking 옆모치 전이](./domain-logic-contract.md) (T003 묶음 1 sub-task 2).
- Invoice/payment cascade: [domain-logic-invoice.md / domain-logic-payment.md] (T003 묶음 2, PENDING).

### §5.2 R-REPO-7 Trade-off (3개 결정)

| # | 결정 | 채택 | 미채택 | 이유 |
|---|------|------|--------|------|
| 1 | 산출물 분할 | (β) booking + contract 분리 2 files | (α) 통합 `domain-logic-bnc.md` / (γ) sequential nested | 두 도메인 수명주기 + 책임 다름; cross-ref 명시로 결합 명확. 사용자 권장. |
| 2 | §2 워크플로우 표기 | text-flow + cross-ref to state-machines.md §2 | Mermaid 재사용 | state-machines.md §2 가 이미 stateDiagram-v2 보유 — 중복 회피. 본 문서는 *비즈니스 의미* 에 집중. |
| 3 | §1 비즈니스 규칙 형식 | hard-coded constants 표 + 도메인 의미 줄글 | 단순 file:line list | constants 만으로는 의도 (왜 4주/2주?) 가 보이지 않음 → "호주 임대 표준 반영" 등 도메인 맥락 명시. |

### §5.3 R-REPO-5 Incidental disposition

- **F9 신규 incidental** (사용자 ack 받음): `bookings.ts:436` 의 PDF 본문 `"The bond will be returned within 14 days after vacating, subject to inspection."` 는 **계약서 텍스트로만 존재**, 코드 어디에도 14-day timer/refund handler 없음. T3 check-out 시 bond return scheduling/escrow 없음. **Phase 2 = bond_return 별도 entity 필요** (CRITICAL_FINDINGS.md F9 entry 참조). `domain-logic-payment.md` (T003 묶음 2) 에서 finance-side cross-ref.
- **F-pending memo** (T004 일괄 처리): `gst_included: true` 강제 (BR7) — pre-tax 청구 표현 불가. `domain-logic-invoice.md` (T003 묶음 2) 에서 동일 패턴 audit 후 일괄.
- **R-REPO-6 11회째 가동 결과**: 사용자 안 "bond 2주 / advance 4주" SWAP 정정 → 코드 ground truth bond=4주/advance=2주 채택 (BR1/BR2). swap 자체가 산출물 영향 없음 (실 코드 추출). T002 group 누적 R-REPO-6 11회 / R-REPO-9 차단 게이트 3회 (T002.4 + T002.5 + T003 묶음 1 Step 1).

### §5.4 3-claim spot-check

| # | Claim | 검증 방법 | 결과 |
|---|-------|-----------|------|
| C1 | BR1-BR2 가 `bookings.ts:395-396` 에 정확히 있고 4 contract 컬럼 (`weekly_rate`, `total_rent`, `bond_amount`, `advance_amount`) 가 모두 `real`-typed | `sed -n 395,396p` + `bookings.ts:458-461` insert site + `db-schema-overview.md §1.3` contracts 컬럼 type | ✅ 모두 일치. CF-002 + CF-007 anchor confirmed. |
| C2 | INV6 (`existingContracts.length === 0` idempotency 가드) 가 S2 confirm handler 안에 정확히 있고 부분 실패 시 line_items 가 잔류할 수 있는 위치 | `bookings.ts:386` 가드 line + `:489-521` line_items insert 가 transaction 안에 없음 (`db.transaction(...)` rg 결과 0 hit) | ✅ 일치. 가드는 contract row 만 보호; line_items 는 보호 없음 — CF-014 carrier 정확. |
| C3 | T1 reject (`bookings.ts:635`) 가 `unblockDatesForBooking` 호출 안 함 / T4 cancel (`bookings.ts:683`) 는 conditional 호출 — 비대칭 패턴 | `:624-638` reject handler 전체 read + `:668-686` cancel handler 전체 read | ✅ 일치. T1 = 무조건 호출 안 함; T4 = `["Confirmed","Active"].includes(booking_status)` 가드 후 호출 — booking.md §3.A.T1 "latent leak" 정확. |

3/3 spot-check ✅. 본 문서 전 비즈니스 클레임의 file:line 인용 정확성 확인.

---

**T003 묶음 1 sub-task 1 (booking) — 본문 + self-check 완료. 다음: contract pre-flight (MMMMM) → 본문 (NNNNN) → 통합 spot-check (OOOOO) → atomic carrier (PPPPP) → 묶음 통합 보고 (QQQQQ).**
