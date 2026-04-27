# Property 도메인 — 비즈니스 규칙 + 워크플로우 + 불변식

> **Sub-task**: T003 묶음 3 sub-task 1 (ops × 3, 분할 (β)). [domain-logic-ops-catalog.md](./domain-logic-ops-catalog.md) + [domain-logic-ops-crm.md](./domain-logic-ops-crm.md) 와 짝.
> **Scope**: 6 routes / 1332 lines / 44 endpoints — `spaces.ts` (459L 13 ep) + `properties.ts` (238L 7 ep) + `space-policies.ts` (138L 6 ep) + `space-options.ts` (142L 6 ep) + `space-images.ts` (205L 6 ep) + `suburbs.ts` (150L 6 ep). 사용자 안 endpoint count 44 ✅ (T002.2.c ops-property.md §1.1 verified).
> **Risk**: 🟡 P1. Triggering findings: [CF-021](../_audit/CRITICAL_FINDINGS.md#cf-021) (POSITIVE — `spaces.ts:56-104` list-side leftJoin 모범) **+ COUNTER-EVIDENCE** `spaces.ts:31-55 buildSpaceResponse` helper = 4 sub-query × N N+1 패턴 (single-row read SP3 + post-update SP4 에서만 호출 → list-side 영향 없음; 단일 entity read 에서만 가동) / [CF-009](../_audit/CRITICAL_FINDINGS.md#cf-009) (3 ⚰️ DEAD candidates 본 도메인 carrier: `space_option_maps` + `space_blocked_dates` + `space_availability` 표면 사용 vs DEAD 의 hybrid pattern 본문 §3 분석) / [CF-022](../_audit/CRITICAL_FINDINGS.md#cf-022) (spaces.status state machine 부재 — single text 컬럼 자유 변경) / [CF-018 Sub-pattern A](../_audit/CRITICAL_FINDINGS.md#cf-018) (nested space-services SP10-SP13 IDOR-defense 검증) / [CF-013](../_audit/CRITICAL_FINDINGS.md#cf-013) (spaces.created_at no-tz + space_blocked_dates.date text-not-date 형식).
> **Cross-domain effects**: ① downstream — bookings.space_id (booking 도메인 핵심 FK) + space_policy.cancellation_window / refund_pct 가 booking T4 cancel 정책 결정. ② downstream — space_availability + space_blocked_dates 가 booking S4 submit 시점 overbooking 검증. ③ side — properties.country/state/city → suburbs lookup (catalog dual-anchor 없음).

---

## §0 PURPOSE & SCOPE

### §0.1 두 정체성 (운영 카탈로그 + booking 검증 source)

property 도메인은 **두 정체성 동시 보유**:
1. **운영 카탈로그**: 부동산 (property) → 공간 (space) → 옵션 (space_option) → 정책 (space_policy) → 이미지 (space_image) → 지역 (suburb) 의 master-data 계층 관리.
2. **booking 검증 source**: space_availability (date range 가용성) + space_blocked_dates (관리자 차단) + space_policies (cancellation_window/refund_pct) 가 booking 도메인의 S4 submit (overbooking 체크) + T4 cancel (환불 비율 계산) 의 read-only source.

**도메인 책임 분담**: 운영자가 본 도메인 mutator handlers 로 카탈로그 변경 → booking handlers 가 read-only 로 source 참조. **양방향 cross-domain effect 부재** (booking 측이 본 도메인 entity 를 직접 수정 안 함; T4 cancel 시 refund 계산만 read).

### §0.2 In-scope / Out-of-scope

- **In**: 6 route files 의 44 endpoint 패턴 + spaces.ts SP10-SP13 nested space-services (CF-018 Sub-pattern A 후보) + buildSpaceResponse helper (CF-021 N+1 counter-evidence) + space_blocked_dates / space_availability / space_option_maps 3 polymorphic-style entity 의 hybrid usage (CF-009 ⚰️ candidates 의 표면 사용 vs schema-only 분석).
- **Out**: booking 측 source 사용 (→ [domain-logic-booking.md §1 BR1-BR2 + §4 cross-domain](./domain-logic-booking.md)), products / service-catalog (→ catalog 도메인), tasks / leads (→ crm 도메인).

---

## §1 비즈니스 규칙 (BR1-BR12)

### §1.1 Money & default constants

| # | 규칙 | 식 / file:line | 도메인 의미 |
|---|------|----------------|-----------|
| BR1 | spaces.weekly_rate / nightly_rate = real | (schema 측 강제) | 정밀 손실 측 (CF-001 booking 측 numeric 와 boundary; 1.6× source) — booking S4 submit 시 `weeklyRate * 4` (bond) + `weeklyRate * 2` (advance) 계산 source |
| BR2 | space_policies.cancellation_window (days) + refund_pct (real) | (schema 측) | booking T4 cancel 시 `daysUntilCheckIn >= cancellation_window` 비교 + `refund = booked_amount * refund_pct` 계산 source — booking BR9 anchor |
| BR3 | spaces.status default = (text 컬럼, default 미명시) | `spaces.ts:148-185` PUT update 자유 | spaces.status 는 state machine 없음 — 운영자 자유 변경 (CF-022 cross-pack: spaces 도 state machine 부재 entity 추가) |
| BR4 | properties.country/state/city = text 자유 형식 | `properties.ts:130-160` create/update | suburbs lookup 과 결합 정책 부재 (referential integrity 0) |

### §1.2 spaces.ts 13 endpoint 패턴

| # | endpoint | handler 위치 | guard | logAction | 도메인 의미 |
|---|----------|--------------|-------|-----------|-----------|
| SP1 | GET `/v1/spaces` (list + filter + leftJoin) | `:56-104` | requireAuth | ✗ (read) | **CF-021 POSITIVE** — leftJoin 기반 list-side N+1 회피 모범 |
| SP2 | POST `/v1/spaces` (create) | `:106-125` | requireAuth | ? | 신규 카탈로그 |
| SP3 | GET `/v1/spaces/:id` (single read + buildSpaceResponse) | `:127-146` | requireAuth | ✗ (read) | buildSpaceResponse helper 4 sub-query (CF-021 counter-evidence — single-row read 에서만 가동) |
| SP4 | PUT `/v1/spaces/:id` (update + buildSpaceResponse) | `:148-185` | requireAuth | ? | 카탈로그 수정 + post-update enrichment |
| SP5 | POST `/v1/spaces/bulk-delete` (SuperAdmin) | `:187-205` | role guard | ? | CF-018 Sub-pattern B carrier |
| SP6 | DELETE `/v1/spaces/:id?permanent=true` | `:207-226` | SuperAdmin (when permanent) | ? | CF-018 Sub-pattern B carrier |
| SP7 | GET `/v1/spaces/:id/availability` | `:228-278` | requireAuth | ✗ | space_availability date range read |
| SP8 | POST `/v1/spaces/:id/availability/block` | `:280-304` | requireAuth | ? | space_blocked_dates 운영자 차단 |
| SP9 | POST `/v1/spaces/:id/availability/unblock` | `:306-330` | requireAuth | ? | space_blocked_dates DELETE |
| SP10 | GET `/v1/spaces/:id/services` (nested) | `:335-366` | requireAuth | ✗ | space_service_catalog (catalog 도메인 cross-ref) |
| SP11 | POST `/v1/spaces/:id/services` (nested write) | `:369-404` | requireAuth | ? | nested-write CF-018 Sub-pattern A 후보 |
| SP12 | PUT `/v1/spaces/:id/services/:mapId` (nested) | `:407-436` | requireAuth | ? | nested-write IDOR check |
| SP13 | DELETE `/v1/spaces/:id/services/:mapId` (nested) | `:439-457` | requireAuth | ? | nested-write IDOR check |

**도메인 의미 (SP10-SP13)**: nested space-services = booking 측 옵션 부착 (예: cleaning, gym access) — booking checkout 시 "service" type charge line 으로 invoice 에 반영. T002.2.c §3 IDOR audit 결과 = SP12/SP13 compound `WHERE id=mapId AND space_id=spaceId` ✅ POSITIVE (booking.md §3 N2/R6 와 sister 패턴).

### §1.3 5 lookup-style routes 공통 패턴 (properties / space-policies / space-options / space-images / suburbs)

각 route = list / create / read / update / soft-delete (bulk) / hard-delete (permanent) 6-endpoint 패턴 (finance-payment 도메인의 4 lookup-style 과 동일 골격).

| route | endpoints | 특이사항 |
|-------|-----------|---------|
| properties (7 ep) | 표준 6 + GET `/v1/properties/:id/spaces` (1 추가; nested spaces list) | properties 가 owner — spaces 의 parent_space 와 별개 |
| space-policies (6 ep) | 표준 6 | booking T4 cancel 의 read-only source |
| space-options (6 ep) | 표준 6 | space_option_maps (M:N junction) → ⚰️ DEAD candidate (사용 불명) |
| space-images (6 ep) | 표준 6 (Cloudinary + multer) | T002.2.c §2.5 `all 6 unvalidated` (CF-017 carrier) |
| suburbs (6 ep) | 표준 6 | properties.suburb_id (read-only) — referential integrity 부재 |

### §1.4 buildSpaceResponse helper N+1 분석 (CF-021 counter-evidence)

`spaces.ts:31-55` `buildSpaceResponse(space)`:
```
property_id ? sub-query property → propertyRow
space_policy_id ? sub-query space_policy → policyRow
parent_space_id ? sub-query parent space → parentRow
getSpaceOptionIds(space.id) → sub-query space_option_maps array
```

**4 sub-query × 1 row** (4-RTT). 호출 site:
- SP3 (`:127-146`) — single space read → 4-RTT × 1 = 4 query
- SP4 (`:148-185`) — single space update + post-enrichment → 4-RTT × 1 = 4 query (총 5 query incl. update)

**CF-021 평가**: list-side SP1 (`:56-104`) 은 leftJoin 으로 N=1 query 처리 ✅ POSITIVE (T002.2.c §3 anchor). 그러나 single-row reads SP3/SP4 는 helper 통해 4 query × 1 = 4-RTT — N+1 패턴은 아니지만 (N=1) **불필요한 sub-query 분할** (single leftJoin 으로 합칠 수 있음). T004 `_rules/architecture-rules.md` "read-side enrichment 정책 통일" 일괄.

**도메인 의미**: spaces.ts 는 두 패턴 동거 — list-side leftJoin (POSITIVE) vs single-row sub-query (단순 4-RTT). list 빈도 ≫ single read 빈도 인 보통 케이스에서는 합리적 trade-off 이지만, 4 entity sub-query 자체가 schema 변경 시 (e.g. space_policy 컬럼 추가) 본 helper 도 동시 수정 필요 → **유지보수 결합**.

---

## §2 워크플로우 (3 sub-flows)

### §2.1 Space lifecycle (운영자 master-data)

```
[*] ──admin POST SP2──▶ Created (status=text 자유)
Created ──PUT SP4──▶ Updated (buildSpaceResponse 4 sub-query)
{any} ──SP9 unblock──▶ space_blocked_dates DELETE (운영자 차단 해제)
{any} ──SP8 block──▶ space_blocked_dates INSERT (운영자 차단)
{any} ──DELETE soft (SP5/SP6)──▶ deleted_at=now (+ status="Archived")
{any} ──DELETE permanent (SuperAdmin)──▶ row 영구 삭제
```

**state machine 부재**: spaces.status 는 단순 text 컬럼 (CF-022 carrier — booking 100%, contract 0%, work_orders 50%, cs_tickets 50%, finance lookup-style 0% n/a 와 동일 패턴). 운영자가 "Active" / "Inactive" / 임의 문자열 자유 변경.

### §2.2 Nested space-services (SP10-SP13) — CF-018 Sub-pattern A POSITIVE

```
admin POST SP11 (create nested)
  ├─ guard: WHERE id = :mapId AND space_id = :spaceId (compound) ✅
  └─ space_service_catalog INSERT
admin PUT SP12 (update nested)
  ├─ guard: WHERE id = :mapId AND space_id = :spaceId (compound) ✅
  └─ space_service_catalog UPDATE
admin DELETE SP13 (delete nested)
  ├─ guard: WHERE id = :mapId AND space_id = :spaceId (compound) ✅
  └─ space_service_catalog DELETE
```

**CF-018 Sub-pattern A 평가**: SP12/SP13 compound WHERE (`mapId AND spaceId`) ✅ — booking.md §3 N2/R6 (POSITIVE EXEMPLAR sites) 와 같은 패턴. 본 도메인 nested writes = **IDOR-safe**. T002.2.c §3 + booking §6 cross-pack analysis 와 일치.

### §2.3 Availability + blocked_dates 의 hybrid usage (CF-009 ⚰️ candidates 분석)

`space_blocked_dates` (T002.4 erd-core §10 ⚰️ medium DEAD candidate):
- **Schema**: 정의 됨 (db-schema-overview §1.1).
- **Mutator 사용**: `spaces.ts:280-330` SP8 block (INSERT) + SP9 unblock (DELETE) — 본 도메인 mutator 사용 명확.
- **booking 측 cross-domain**: `bookings.ts unblockDatesForBooking` (T002.2.j 발견) — booking 도메인이 cancel/check-out 시 blocked_dates 정리.
- **DEAD 평가 정정**: T002.4 erd-core ⚰️ medium 는 **운영자 측 사용 mutator 명확** 으로 **DEAD 가 아님** — booking 측에서 자동 unblock 패턴이 incidental. T004 `_rules/architecture-rules.md` 일괄에서 ⚰️ 등급 재평가 필요.

`space_option_maps` (T002.4 erd-core §10 ⚰️ medium DEAD candidate):
- **Schema**: M:N junction (space ↔ space_option).
- **Mutator 사용**: `spaces.ts:31-55` `getSpaceOptionIds()` helper read-only + space-options.ts mutator 측 — 본 도메인 read 사용은 있음, write 명시 사이트 검증 필요.
- **DEAD 평가 정정**: read 측 사용 명확 → 완전 DEAD 아님. write 사이트 부재 시 "read-only orphan" 패턴.

`space_availability` (T002.4 erd-core §10 ⚰️ candidate):
- **Mutator**: SP7 read-only (`:228-278`).
- **booking 측**: overbooking 검증 source (booking S4 submit `:364`).
- **평가**: read-only 카탈로그 source — DEAD 아님.

**도메인 의미**: 3 entity 모두 schema-only 가 아닌 hybrid usage — T004 `_rules/architecture-rules.md` "DEAD schema retirement" 정책 일괄에서 ⚰️ 등급 재평가 (downgrade 후보). T003 묶음 3 본 sub-task 가 ⚰️ 3 candidate 의 **재평가 evidence 제출 source**.

---

## §3 불변식 (INV1-INV6)

| # | Invariant | 강제 site | 위반 시 동작 |
|---|-----------|-----------|------------|
| INV1 | SP12/SP13 nested write = compound WHERE (CF-018 Sub-pattern A POSITIVE) | `spaces.ts:407-436,439-457` (compound `WHERE id AND space_id`) | 다른 space 의 mapId 시도 시 0 row affected |
| INV2 | SP1 list-side = leftJoin 단일 query (CF-021 POSITIVE) | `spaces.ts:56-104` | N+1 회피 |
| INV3 | SP3/SP4 single-row read = 4 sub-query (CF-021 counter-evidence) | `spaces.ts:31-55` buildSpaceResponse | 4-RTT × 1 (성능 borderline) |
| INV4 | spaces.status text 자유 (state machine 부재) | (schema 측 강제 부재) | 운영자가 임의 문자열 set 가능 |
| INV5 | SP5/SP6 SuperAdmin 가드 (CF-018 Sub-pattern B carrier) | `spaces.ts:187,207` (role guard) | 403 |
| INV6 | space_blocked_dates / space_availability = read-only enrichment source for booking | (cross-domain 강제 부재) | booking 측이 자유 read; 본 도메인 mutator 만 write |

---

## §4 Cross-domain effects 매핑

| 발신 transition | 수신 도메인 / 컬럼 | 효과 | 시점 | audit log |
|-----------------|-------------------|------|------|-----------|
| SP2/SP4 spaces create/update | (booking 도메인 read-only) | bookings.space_id FK source 변경 | mutator | (검증 필요) |
| SP4 spaces.weekly_rate update | (booking S4 submit `weeklyRate * 4 + *2` 계산) | 미래 booking BR1/BR2 source 변경 (기존 booking 영향 없음 — booking 측이 snapshot bond/advance 보유) | mutator | (검증 필요) |
| SP8 block + SP9 unblock | space_blocked_dates INSERT/DELETE | booking S4 submit overbooking 검증 source | mutator | (검증 필요) |
| space-policies update | (booking T4 cancel cancellation_window/refund_pct) | 환불 비율 read-time source — 정책 변경 시 미래 cancel 영향 | mutator | (검증 필요) |
| (외부) booking T1/T3/T4 unblockDatesForBooking | space_blocked_dates DELETE × N | booking 측 자동 정리 (CF-018 incidental) | booking handler | ✗ (booking 측 audit) |

---

## §5 Cross-references + Self-check

### §5.1 Cross-references

- Endpoints: [api-endpoints/ops-property.md](../_schema/api-endpoints/ops-property.md) (44 ep / 430 lines).
- Schema: [db-schema-overview.md §1.1 Property cluster](../_schema/db-schema-overview.md).
- ERD: [erd-core.md §1 Property cluster](../_schema/erd-core.md).
- DEAD candidates: [erd-core.md §12](../_schema/erd-core.md) — ⚰️ 3 entity 재평가 evidence 제출.
- Pair (catalog): [domain-logic-ops-catalog.md](./domain-logic-ops-catalog.md) — 39 ep / 9 routes / products + DEAD product_catalog.
- Pair (crm): [domain-logic-ops-crm.md](./domain-logic-ops-crm.md) — 51 ep / 5 routes / lead/work_orders state machines.
- Cross-domain (booking): [domain-logic-booking.md §1 BR1-BR2 + §4 cross-domain](./domain-logic-booking.md).
- Phase 2: T004 `_rules/architecture-rules.md` (DEAD schema retirement + read-side enrichment 정책 일괄).

### §5.2 R-REPO-7 Trade-off (3개 결정)

| # | 결정 | 채택 | 미채택 | 이유 |
|---|------|------|--------|------|
| 1 | 13 endpoint spaces.ts 표기 | §1.2 13-row 표 + buildSpaceResponse §1.4 분리 분석 | (a) 13 sub-section 분리 / (b) compact 표만 | 표 + helper 분리 = readability 우위; helper 가 N+1 counter-evidence anchor |
| 2 | DEAD ⚰️ 3 candidate 평가 | §2.3 3 entity 별도 sub-section + DEAD 등급 재평가 evidence 제출 | (a) erd-core §12 reference only / (b) 단일 줄 memo | 본 도메인이 ⚰️ candidate 의 mutator 사용 직접 보유 → 재평가 source — sub-section 분리가 evidence 가치 보존 |
| 3 | spaces.status state machine | INV4 단순 명시 + state-machines.md cross-ref 부재 (entity index 5 entity 외) | (a) 신규 §X state machine sub-section / (b) F 신규 incidental | spaces.status 는 운영자 자유 → state machine 자체가 의미 부재 → INV4 단순 명시로 충분 |

### §5.3 R-REPO-5 Incidental disposition

- **F13 신규 incidental** (memo only, no promotion): `space_blocked_dates` + `space_option_maps` + `space_availability` 3 ⚰️ candidate 모두 mutator 사용 명확 → erd-core §12 등급 재평가 필요. T004 `_rules/architecture-rules.md` "DEAD schema retirement" 일괄 처리 시 ⚰️ → "active orphan" 또는 "read-only catalog" 등급 신설.

### §5.4 3-claim spot-check

| # | Claim | 검증 방법 | 결과 |
|---|-------|-----------|------|
| C1 | INV1 SP12/SP13 compound WHERE 정확 | `sed -n '407,460p' spaces.ts` — `WHERE id AND space_id` 검증 | ✅ T002.2.c §3 IDOR audit 결과와 일치 |
| C2 | INV3 buildSpaceResponse 4 sub-query 정확 | `sed -n '31,55p' spaces.ts` — 4 sub-query (property + policy + parent + optionIds) | ✅ helper 본문 일치 |
| C3 | F13 ⚰️ DEAD candidate 3 entity mutator 사용 | `rg space_blocked_dates artifacts/api-server/src/routes/spaces.ts` (SP8/SP9 INSERT/DELETE 검증) | ✅ SP8 INSERT + SP9 DELETE + booking 측 DELETE 자동 정리 = mutator 사용 명확 |

3/3 spot-check ✅.

---

**T003 묶음 3 sub-task 1 (property) 완료.**
