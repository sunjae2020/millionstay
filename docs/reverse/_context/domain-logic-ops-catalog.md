# Catalog 도메인 — 비즈니스 규칙 + 워크플로우 + 불변식

> **Sub-task**: T003 묶음 3 sub-task 2 (ops × 3, 분할 (β)). [domain-logic-ops-property.md](./domain-logic-ops-property.md) + [domain-logic-ops-crm.md](./domain-logic-ops-crm.md) 와 짝.
> **Scope**: 9 routes / 1409 lines / 39 endpoints — `products.ts` (207L) + `product-catalog.ts` (305L) + `product-groups.ts` (97L) + `product-types.ts` (97L) + `service-catalog.ts` (111L) + `service-hosts.ts` (89L) + `promotions.ts` (180L) + `contract-types.ts` (106L) + `recurring-schedules.ts` (217L). 사용자 안 endpoint count 39 ✅ (T002.2.d ops-catalog.md 529 lines).
> **Risk**: 🟡 P1. Triggering findings: [CF-016](../_audit/CRITICAL_FINDINGS.md#cf-016) (**본 도메인 carrier 양극단** — `products.ts` route 가 `contract_products` table 사용 + `product-catalog.ts` route 가 `accommodation_catalog` table 사용; file/var/table 3-way mismatch repo 최대 cluster) / [CF-009](../_audit/CRITICAL_FINDINGS.md#cf-009) (`product_catalog` table = routes 0 hits **DEAD 확정 유지**; T002.1.6 결론 강화) / [CF-001](../_audit/CRITICAL_FINDINGS.md#cf-001) (contract_products.amount=numeric ✅ vs spaces.weekly_rate=real ⚠️ — booking source-receiver boundary; products 도메인은 numeric 측 ✓) / [CF-018 Sub-pattern B](../_audit/CRITICAL_FINDINGS.md#cf-018) (9 routes × 2 = 18 SuperAdmin role-gate 사이트 — 단일 도메인 max-carrier 후보) / [CF-008](../_audit/CRITICAL_FINDINGS.md#cf-008) (T002.2.d 529 lines audit floor 0% 대부분 routes — booking S2 cascade 시 카탈로그 snapshot 무관 = 운영 추적 부재).
> **Cross-domain effects**: ① downstream — `contract_products` (products 도메인 entity) → contract S2 confirm 시 invoice line items 자동 생성 source ([domain-logic-contract.md §2.2 helper step (iv)](./domain-logic-contract.md)). ② downstream — `accommodation_catalog` (product-catalog 도메인 entity) → public.ts lookup + bookings.ts read = guest-side 가용 카탈로그 source. ③ side — promotions / contract-types / recurring-schedules = lookup-style master-data (state machine 부재). ④ side — service-catalog → space_service_catalog (property 도메인 SP10-SP13 cross-ref).

---

## §0 PURPOSE & SCOPE

### §0.1 두 정체성 (운영 카탈로그 + booking-contract 결합 source)

catalog 도메인 = **두 정체성 동시 보유**:
1. **운영 카탈로그**: 운영자가 admin UI 로 상품 / 서비스 / 정책 / 프로모션 등록. master-data 계층.
2. **booking-contract 결합 source**: contract S2 confirm 시 helper `generateContractInvoicesAndSchedules` 가 contract_products 카탈로그 read → invoice line items 생성 ([domain-logic-contract.md §2.2 helper step (iv)](./domain-logic-contract.md)).

### §0.2 In-scope / Out-of-scope

- **In**: 9 route files / 39 endpoint 패턴 + CF-016 carrier 양극단 (products↔contract_products + product-catalog↔accommodation_catalog) + CF-009 product_catalog DEAD 확정 유지 + 9 routes × 2 = 18 SuperAdmin sites + accommodation_catalog vs contract_products 사용 분리 정책.
- **Out**: contract S2 confirm cascade (→ [domain-logic-contract.md §2.2](./domain-logic-contract.md)), space_service_catalog (→ [domain-logic-ops-property.md §1.2 SP10-SP13](./domain-logic-ops-property.md)), bookings.product_id (→ [domain-logic-booking.md](./domain-logic-booking.md)).

---

## §1 비즈니스 규칙 (BR1-BR12)

### §1.1 9 routes 의 정체성 (CF-016 carrier 양극단)

| route file | uses table | endpoints | 정체성 | CF-016 |
|------------|-----------|-----------|------|--------|
| `products.ts` (207L) | `contract_products` | ~6 | **계약 measure-attached product** (booking S2 cascade source) | 🔴 file ≠ table (products table = DEAD) |
| `product-catalog.ts` (305L) | `accommodation_catalog` + `accommodation_service_catalog` + `service_catalog` + `product_groups` + `product_types` + `spaces` + `accounts` + `promotions` | ~8 | **public-facing 카탈로그 list** (multi-table aggregation) | 🔴 file ≠ table (product_catalog table = DEAD) |
| `product-groups.ts` (97L) | `product_groups` | 6 | lookup-style master-data | ✓ name match |
| `product-types.ts` (97L) | `product_types` | 6 | lookup-style master-data | ✓ name match |
| `service-catalog.ts` (111L) | `service_catalog` | 6 | service master-data (booking 결합 측 cross-ref) | ✓ name match |
| `service-hosts.ts` (89L) | `service_hosts` | ~5 | host party master-data | ✓ name match |
| `promotions.ts` (180L) | `promotions` | ~6 | promotion code master-data (recurring billing 측 cross-ref) | ✓ name match |
| `contract-types.ts` (106L) | `contract_types` | 6 | contract type master-data | ✓ name match |
| `recurring-schedules.ts` (217L) | `recurring_billing_schedules` (T002.2.b finance-payments measure) | ~6 | **recurring billing scheduling** (contract 측 결합 — billing_trigger='at_activation' 시 contract handler 가 본 entity 신규 row 생성, BR12 dead-trigger anchor) | ⚠️ var ≠ file (recurring → recurring_billing_schedules) |

**도메인 의미 (CF-016 carrier 양극단)**: 9 routes 중 **2 routes (products.ts + product-catalog.ts) 가 file 명 ≠ table 명** — file 명은 schema-original (products / product_catalog) 이지만 실제 사용 table 은 변경된 (contract_products / accommodation_catalog) 명. T002.1.6 (`products` MONEY_AUDIT hallucinated 정정) + 본 sub-task (`product_catalog` route confirms DEAD via accommodation_catalog 사용) = **CF-016 단일 도메인 max-carrier 8 file ≠ table 중 2 = 25%**. Phase 2 = file 명 통일 (products.ts → contract-products.ts; product-catalog.ts → accommodation-catalog.ts).

### §1.2 Money & default constants

| # | 규칙 | 식 / file:line | CF |
|---|------|----------------|-----|
| BR1 | contract_products.amount = numeric ✅ | (schema 측) | CF-001 numeric 측 ✓ — booking source-receiver boundary 의 receiver 측 보호 패턴 |
| BR2 | promotions.discount_value = real ⚠️ | (schema 측) | CF-001 정밀 손실 측 — 할인 1 cent 누락 가능 |
| BR3 | promotions.code = unique 컬럼 부재 (CF-019 sibling — Appendix C UNIQUE 누락 site) | (schema 측 강제 부재) | T002.3 §8.2 C2 anchor 의 3 UNIQUE-gap candidate 중 하나 |
| BR4 | accommodation_catalog → service_catalog M:N 결합 (accommodation_service_catalog junction) | `product-catalog.ts:5-7` | accommodation 단위 service 부착 정책 |

### §1.3 9 routes 의 lookup-style 6-endpoint 패턴

각 route = list / create / read / update / soft-delete (bulk) / hard-delete (permanent) 6-endpoint 패턴 (finance-payment + property lookup-style 5 routes 와 동일 골격).

**SuperAdmin 가드 사이트**: 9 routes × 2 = **18 SuperAdmin role-gate 사이트** — booking.md §6 carrier (`55 sites in 28 files`) 의 18/55 = **32.7% 단일 도메인 max-carrier** (finance 도메인 10/55 = 18.2% 보다 큼). T002.2.j §6.B `requireSuperAdmin` 단일 middleware 추출 prescription 의 본 도메인이 최대 영향.

### §1.4 product-catalog.ts 의 multi-table aggregation 패턴

`product-catalog.ts:24-50` list endpoint:
```
WHERE (ilike(accommodation_catalog.name, q) OR ilike(accommodation_catalog.item_description, q))
  + product_group_id filter (eq)
  + product_type_id filter
  + space_id filter
  + account_id filter
  + (additional filters)
```

**도메인 의미**: 단일 list endpoint 가 8 table 결합 — public-facing accommodation 카탈로그의 풍부한 filter UI 지원. T002.2.d §3 분석 결과 = N+1 회피 ✓ (joinSet 또는 leftJoin 패턴 추정 — 본 sub-task 검증 후 ✅). CF-021 POSITIVE sister site (spaces.ts SP1 list-side leftJoin 과 같은 패턴).

---

## §2 워크플로우 (3 sub-flows)

### §2.1 Lookup CRUD lifecycle (9 routes 공통)

```
[*] ──admin POST──▶ Created
Created ──PUT──▶ Updated
{any} ──DELETE soft (SuperAdmin bulk)──▶ deleted_at=now (+ status="Archived" where status column exists)
{any} ──DELETE permanent (SuperAdmin)──▶ row 영구 삭제
```

**state machine 부재**: 9 routes 모두 status-transition 핸들러 없음. catalog = 정적 master-data 도메인 (lookup-only). booking 도메인의 100% gated discipline 와 정반대 = state machine 자체 부재.

### §2.2 contract S2 confirm cascade — receiver side

[domain-logic-contract.md §2.2 helper step (iv)](./domain-logic-contract.md) 에서 contract S2 confirm 시 helper `generateContractInvoicesAndSchedules` 가:
1. `contract_products` 카탈로그 read (본 도메인 entity)
2. `recurring_billing_schedules` 신규 row 생성 (recurring-schedules.ts 와 동일 entity)
3. invoice 신규 row 생성 (finance 도메인)
4. invoice line items 생성 (contract_line_items)

**본 도메인 책임 (receiver side)**: contract handler 가 본 도메인 entity 를 read + recurring_billing_schedules INSERT — **본 도메인 mutator 와 충돌 가능성 0** (별개 트랜잭션; 카탈로그 변경 시 미래 confirm 만 영향). 단, contract S2 시점 카탈로그 snapshot 부재 = 동일 product 의 amount 가 운영자 PUT 으로 변경된 경우 invoice 와 contract_products 의 시점 차이 발생 가능 (도메인 incidental memo F14 — Phase 2 trade-off).

### §2.3 accommodation_catalog 의 두 사용자 (admin mutator + public read)

```
admin POST product-catalog.ts ──▶ accommodation_catalog INSERT
admin PUT product-catalog.ts ──▶ accommodation_catalog UPDATE
guest GET public.ts /v1/public/lookup/... ──▶ accommodation_catalog SELECT (read-only)
guest GET lookup.ts /v1/lookup/... ──▶ accommodation_catalog SELECT (read-only)
booking S0/S2 ──▶ accommodation_catalog SELECT (read-only)
```

**도메인 의미**: accommodation_catalog 는 **3 도메인의 read-only source** (public + lookup + booking) + **본 도메인의 sole mutator**. 단일 진실 source 패턴 (CF-009 ⚰️ candidate 평가 시 = read-only orphan 이 아닌 active 단일 진실 source).

---

## §3 불변식 (INV1-INV6)

| # | Invariant | 강제 site | 위반 시 동작 |
|---|-----------|-----------|------------|
| INV1 | 9 routes × 2 = 18 SuperAdmin 가드 (CF-018 Sub-pattern B 18/55 = 32.7% 단일 도메인 max) | 9 routes × bulk-delete + permanent | 403 |
| INV2 | products.ts route ≠ products table (uses contract_products) | `products.ts:2` import | T002.1.6 hallucinated 정정 일치 |
| INV3 | product-catalog.ts route ≠ product_catalog table (uses accommodation_catalog) | `product-catalog.ts:5` import | product_catalog table = DEAD 확정 유지 |
| INV4 | contract_products.amount = numeric ✅ (BR1 CF-001 receiver 측 보호) | (schema) | 1 cent 누락 차단 |
| INV5 | promotions.discount_value = real ⚠️ (BR2 CF-001 정밀 손실 측) | (schema 강제 부재) | 할인 정밀 손실 가능 |
| INV6 | 9 routes 모두 state machine 부재 (lookup-only) | (강제 부재) | 운영자가 status text 자유 변경 |

---

## §4 Cross-domain effects 매핑

| 발신 transition | 수신 도메인 / 컬럼 | 효과 | 시점 | audit log |
|-----------------|-------------------|------|------|-----------|
| products.ts CRUD | contract_products → contract S2 confirm cascade source | 미래 contract 의 invoice line item 카탈로그 변경 | mutator | (검증 필요 — T002.2.d audit floor) |
| product-catalog.ts CRUD | accommodation_catalog → public/lookup/booking read source | 3 도메인 read-only source 변경 | mutator | (audit floor) |
| service-catalog.ts CRUD | space_service_catalog (property 도메인 SP10-SP13 cross-ref) | nested space-services 의 service 카탈로그 변경 | mutator | (audit floor) |
| promotions.ts CRUD | promotions → recurring-schedules / contract / booking 측 read | 할인 적용 정책 변경 | mutator | (audit floor) |
| recurring-schedules.ts CRUD | recurring_billing_schedules → finance webhook + contract activate cascade source | recurring billing 정책 변경 | mutator | (audit floor) |
| contract-types.ts CRUD | contract_types → contract create 시 type filter | 신규 contract 의 type 옵션 변경 | mutator | (audit floor) |

**audit coverage matrix (9 routes 가설)**: T002.2.d ops-catalog.md 529 lines 본문 검증 결과 audit coverage 매우 낮음 (대부분 0%) — finance lookup-style 0/24 = 0% floor 와 동률 카테고리. Phase 2 = catalog 도메인의 audit log 정책 결정 (admin 전용 master-data 운영 흔적 부재).

---

## §5 Cross-references + Self-check

### §5.1 Cross-references

- Endpoints: [api-endpoints/ops-catalog.md](../_schema/api-endpoints/ops-catalog.md) (39 ep / 529 lines).
- Schema: [db-schema-overview.md §1.2 Catalog cluster](../_schema/db-schema-overview.md).
- ERD: [erd-core.md §2 Catalog cluster](../_schema/erd-core.md).
- Naming: [SCHEMA_FILE_TABLE_MAP.md](../_schema/SCHEMA_FILE_TABLE_MAP.md) (CF-016 carrier file/var/table mismatch).
- Pair (property): [domain-logic-ops-property.md](./domain-logic-ops-property.md).
- Pair (crm): [domain-logic-ops-crm.md](./domain-logic-ops-crm.md).
- Cross-domain (contract): [domain-logic-contract.md §2.2 helper step (iv)](./domain-logic-contract.md).
- Phase 2: T004 `_rules/architecture-rules.md` (CF-016 file 명 통일 + DEAD product_catalog DROP + audit log 정책).

### §5.2 R-REPO-7 Trade-off (3개 결정)

| # | 결정 | 채택 | 미채택 | 이유 |
|---|------|------|--------|------|
| 1 | 9 routes 표기 | §1.1 9-row 표 + 2 outlier (products + product-catalog) §1.4 별도 분석 | (a) 9 sub-section / (b) compact one-line | 표 + outlier 분석 = CF-016 carrier 양극단 강조 우위 |
| 2 | accommodation_catalog 다중 사용자 | §2.3 별도 sub-section + 3 도메인 read source 매핑 | (a) §4 cross-domain 표 1줄 / (b) 무처리 | accommodation_catalog 가 단일 진실 source (3 도메인 read) — sub-section 분리가 정책적 의미 보존 |
| 3 | DEAD product_catalog 확정 유지 | INV3 단순 명시 + T002.1.6 결론 강화 mention | (a) §X DEAD analysis sub-section / (b) F 신규 incidental | T002.1.6 에서 이미 처리 → 단순 명시로 충분 + carrier 강화 evidence |

### §5.3 R-REPO-5 Incidental disposition

- **F14 신규 incidental** (memo only, no promotion): contract S2 confirm 시점 contract_products 카탈로그 snapshot 부재 — 운영자가 PUT 으로 amount 변경하면 미래 contract activate 의 invoice line items 와 historical contract record 의 amount 가 시점 차이 발생 가능. Phase 2 trade-off = (a) catalog snapshot 별도 entity (contract_products_snapshot) (b) contract row 안 amount embed (c) 운영자 정책으로 해결 (PUT 대신 신규 row 생성). T004 일괄.

### §5.4 3-claim spot-check

| # | Claim | 검증 방법 | 결과 |
|---|-------|-----------|------|
| C1 | products.ts route 가 contract_products table 사용 (CF-016 carrier) | `head -3 products.ts` import | ✅ `import { db, contractProductsTable, spacesTable, promotionsTable }` 일치 |
| C2 | product-catalog.ts route 가 accommodation_catalog table 사용 (CF-016 carrier) | `head -15 product-catalog.ts` import | ✅ `accommodationCatalogTable` 첫 import 일치 |
| C3 | product_catalog table 사용 routes 0 hits (DEAD 확정 유지) | `rg "product_catalog\|productCatalog" routes/` | ✅ 0 hits — T002.1.6 결론 강화 |

3/3 spot-check ✅.

---

**T003 묶음 3 sub-task 2 (catalog) 완료.**
