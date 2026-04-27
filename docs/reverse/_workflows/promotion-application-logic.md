# Promotion Application Logic

> ✅ **T005-REWRITE** 2026-04-27 (T001 시점 64L NEEDS REVISION → 본 82L; T002 ops-catalog.md + db-schema-overview.md UNIQUE-gap 발견 + T003 _context/domain-logic-ops-catalog.md 320L + T004 _rules/{financial,no-magic}-rules.md 통합).
> **상위 source**: `_schema/db-schema-overview.md §3` UNIQUE 16 sites + Appendix C UNIQUE-gap candidates / `_context/domain-logic-ops-catalog.md §1` BR1-BR4.
> **Cross-ref**: payment-workflow.md §3 (effective_weekly_rate cache feeds invoice line items) + booking-lifecycle.md §1 (booking creation snapshots agreed_weekly_rate).

---

## §1 PROMOTION 규칙 + UNIQUE-gap

**2 link 사이트** (`_schema/db-schema-overview.md` confirm):

| linker | column | purpose |
|--------|--------|---------|
| Product | `contract_products.promotion_id` | contract product 가 1 promotion 보유 |
| Public listing | `accommodation_catalog.promotion_id` | public-facing 리스팅 banner |

**Booking-level promotion linkage 부재**: booking 시점 `agreed_weekly_rate` snapshot 이후 promotion 보존 0 — "promotion X 가 할인한 매출" 쿼리 불가. join back 필요 (booking 시점 product 의 promotion_id 가 그 후 변경됐을 가능성 — F14 contract_products snapshot 부재 cross-ref financial-rules §5.3).

**UNIQUE-gap candidate** (`db-schema-overview.md` Appendix C, T002.3 발견): `promotions.code` 컬럼 `.unique()` 제약 부재 → 운영자가 동일 promotion code 중복 INSERT 가능 → 코드 lookup 시 ambiguous match.

**Phase 2 prescription** (no-magic-rules §1 + db-schema-overview §3 UNIQUE 통일): (1) `promotions.code .unique()` 추가 / (2) booking-level promotion_id snapshot 컬럼 추가 (재무 분석 가능) / (3) F14 contract_products line items snapshot.

---

## §2 PROMOTION APPLICATION (catalog + finance cross-ref)

| phase | 동작 |
|-------|------|
| Product save (admin) | `contract_products.effective_weekly_rate` 계산 + cache: percentage = `weekly_rate × (1 − promo.discount_amount/100)` / fixed = `weekly_rate − promo.discount_amount` |
| Booking creation | `bookings.agreed_weekly_rate` ← `contract_products.effective_weekly_rate` (또는 admin-overridden) |
| Contract activate | `contracts.total_rent` ← `bookings.total_rent` (numeric → real **CF-001 PRECISION-LOSSY** financial-rules §2) |
| Invoice 생성 | `generateContractInvoicesAndSchedules` 7-step → invoice line_items 가 `contract_products.effective_weekly_rate` cache 기반 (snapshot 부재 — 미래 product 변경 시 historical contract record 와 불일치 F14) |

**CF-019.b candidate parked** (`_audit/CRITICAL_FINDINGS.md` T002.2.b): `service_catalog.promotion_id` (별도 service-side promotion linkage) — T002.3 결정 = CANDIDATE 유지 (현재 1 sites WHERE filter; route active write 0). Phase 2 결정 = 사용 또는 제거.

**Service-side service_catalog.promotion_id**: `service_catalog.ts` route 에서 read-only filter (없는 promotion_id) — orphan column 후보. 그러나 catalog 도메인 운영자 인지 (`ops-catalog.md`) 가능 → CF-019.a (stripe orphan 확정 0 write) 와 달리 보류.

---

## §3 PHASE 2 종합

(1) `promotions.code .unique()` 추가 (db-schema-overview §3 UNIQUE 통일)
(2) booking-level `promotion_id` snapshot 컬럼 추가 (재무 분석)
(3) `contract_products` line_items snapshot table (F14 financial-rules §5.3)
(4) `service_catalog.promotion_id` CF-019.b 결정 (사용 / 제거)
(5) effective_weekly_rate 계산 helper 통일 (현재 admin save 시점 1회만; promotion 만료 시 재계산 trigger 부재)
(6) audit log 정책 통일 (promotion 변경 시 logAction; 현재 0%)

---

## §4 자가 검증 (3 spot-check ✅)

- C1 `promotions` schema `.unique()` 0 hit (UNIQUE-gap candidate confirmed)
- C2 `contract_products.effective_weekly_rate` cache + `bookings.agreed_weekly_rate` snapshot — 두 snapshot column 존재 + promotion_id snapshot 부재
- C3 `service_catalog.promotion_id` filter read 0 active write site (CF-019.b parked candidate)
