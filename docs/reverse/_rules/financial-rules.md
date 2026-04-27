# Financial Rules

> **T004 REWRITE** 2026-04-27 — T001 (121L NEEDS REVISION) 기반 + T002+T003 자산 통합 + MONEY_AUDIT 502L baseline.
> **T001 시점 한계**: CF-001 (real/numeric schism) / CF-002 (precision-lossy bookings→contracts) / CF-006 Formula B 4-site / CF-007 hard-coded 2/4 주 / CF-010 Stripe lifecycle 분리 미발견.
> **Source**: `_schema/state-machines.md` §4-4.5 (invoice + Stripe) / `_schema/api-endpoints/finance-{invoicing,payments}.md` / `_context/domain-logic-finance-{invoice,payment}.md` / `_audit/MONEY_AUDIT.md`.

---

## §1. Hard-coded business constants (CF-007 + 14 constants 종합)

| 상수 | 값 | 코드 위치 | 의미 |
|------|-----|----------|------|
| **bond** | `weeklyRate * 4` | `bookings.ts:395` | 보증금 = 4주치 임대료 |
| **advance** | `weeklyRate * 2` | `bookings.ts:396` | 선납금 = 2주치 임대료 |
| **Monthly** | `weeklyRate * (52/12)` | `contracts.ts:92-94` + `bookings.ts:485` | Formula B (CF-006 dominant 3/4 sites) |
| **Monthly (alt)** | `weeklyRate * 4` | dashboard 1 site | Formula A (CF-006 minority) |
| **Biweekly** | `weeklyRate * 2` | billing helper | 격주 |
| **nights** | `(checkout - checkin) / 86_400_000` | booking helper | 일수 = ms / 1day |
| **bond return** | `14 days` | `bookings.ts:436` PDF text-only | F9 incidental — 코드 timer/handler/escrow 모두 부재 |
| **GST default** | `true` | `bookings.ts` schema default | 호주 GST 기본 활성 |
| **safety limit** | `500 iter` | `contracts.ts:158-160` | helper invoice generation 무한 루프 가드 |

**규칙**:
1. 모든 비즈니스 상수 → `_constants/business.ts` (또는 EF Core `IBusinessRules` 인터페이스) 단일 source.
2. PDF text-only 비즈니스 규칙 (F9 14-day) → 코드 implementation 의무 (Phase 2 = `bond_return` entity + scheduled job).
3. Formula A vs B (CF-006) → Phase 2 통일 = Formula B (`52/12` accurate; 4 site 중 3 dominant).

---

## §2. Money type policy (CF-001 핵심)

### 2.1 현재 상태 (MONEY_AUDIT.md §1)

| Type | 사이트 | 정확성 |
|------|--------|--------|
| `numeric(12,2)` / `numeric(10,2)` | `bookings.agreed_weekly_rate/total_rent` + `booking_services.unit_price/total_price` + `invoices.amount` + `invoice_line_items.unit_price/total_price` + `contract_line_items.unit_price/total_price` (12 cols) | ✅ exact decimal |
| `real` | `contracts.total_value/weekly_rate/monthly_rate/bond_amount/advance_amount` + `products.weekly_rate/monthly_rate/biweekly_rate/bond_amount/advance_amount` + `spaces.weekly_rate/monthly_rate/biweekly_rate` + `commissions.amount` + `work_orders.amount` (39 cols) | ⚠️ IEEE 754 손실 |

**ratio**: 39 real / 12 numeric. **finance polarisation**: invoices `numeric` ✓ vs commissions `real` ⚠️ (단일 도메인 양극단).

### 2.2 Precision loss path (CF-002)

`bookings.total_rent` (numeric) → `parseFloat()` → `contracts.total_value` (real) at `contracts.ts:55-237` helper.

**규칙**:
1. 모든 money column → `numeric(12,2)` 마이그레이션 (Phase 2).
2. Phase 2 EF Core = `decimal(12,2)` + `[Column(TypeName="numeric(12,2)")]`.
3. `parseFloat()` boundary 모두 제거 (numeric → numeric 직접 cast).

---

## §3. Formula A vs B (CF-006 evidence expansion)

### 4 site cross-ref

| 사이트 | Formula | 결과 |
|--------|---------|------|
| `contracts.ts:92` | B (`52/12 ≈ 4.333`) | 정확 (월 평균 일수) |
| `contracts.ts:94` | B | 정확 |
| `bookings.ts:485` | B | 정확 |
| dashboard 1 site | A (`*4`) | 부정확 ("illustrative" annotation 의도) |

**규칙**: Formula B (`52/12`) 채택. dashboard A site → `// illustrative only` 명시 또는 B 통일.

---

## §4. Stripe payment lifecycle 분리 (CF-010 본문 재작성)

### 4.1 두 lifecycle 명확 분리 (T002.5 핵심 회수)

| Lifecycle | Source of truth | State |
|-----------|----------------|-------|
| **Invoice document** | `invoices.status` 5-state | Draft / Sent / Paid / Voided / Cancelled |
| **Payment events** | `system_logs.new_value` JSON (audit-only) | succeeded / failed / refunded / disputed / chargeback |

### 4.2 Webhook bypass 정책 split (CF-022 anomaly)

- **Manual `/pay`** = `eq(status, "Sent")` 가드 ✓ (`invoices.ts:155-167`)
- **Webhook auto-pay** = no source state guard (`stripe.ts:55-57`) → Draft/Voided invoice 도 Paid 가능

**규칙**:
1. Webhook → Paid 전이 시 source state 검증 의무 (`["Sent"]` only).
2. Phase 2 Option B 추천: `payment_events` 별도 entity (`event_type`, `stripe_event_id`, `invoice_id`, `amount`, `created_at`) + `invoices` ↔ `payment_events` 1:N.

### 4.3 Chargeback / dispute 처리 (F11)

`stripe.ts:99-100` default = `console.log` only → `charge.dispute.*` + `charge.failed` 핸들 부재.

**규칙**: Phase 2 webhook = 5 case minimum (`payment_intent.succeeded` + `payment_intent.payment_failed` + `charge.refunded` + `charge.dispute.created` + `charge.dispute.closed`).

---

## §5. 재무 sub-domain 규칙

### 5.1 Bond return (F9)

- 현재: `bookings.ts:436` PDF text "14 days after check-out" only.
- 코드: timer / handler / escrow / refund queue 모두 부재.

**Phase 2**: `bond_returns` entity (`booking_id`, `due_date`, `returned_amount`, `status`, `processed_at`) + scheduled job (T+14 trigger).

### 5.2 Commissions enum (F12)

`commissions.status` enum 정의 부재. status filter + Archived 만 등장. 다른 status 의미 불명.

**Phase 2**: enum 명시 (`Pending` / `Earned` / `Paid` / `Archived`) + `commissions.amount` real → numeric.

### 5.3 Contract products snapshot (F14)

S2 contract confirm 시점 `contract_products` 카탈로그 snapshot 부재 → 운영자 PUT 으로 amount 변경 시 미래 invoice line items 와 historical contract 의 amount 시점 차이.

**Phase 2**: `contract_products.snapshot_at` + `snapshot_unit_price` + read-only flag.

### 5.4 Contract reference numbering (CF-011)

`contracts.ts` row count 기반 ref 생성 → race condition.

**Phase 2**: PostgreSQL `SERIAL` sequence 또는 `gen_random_uuid()` 채택.

---

## §6. Incidentals routing

| ID | 발견 | 본 문서 sub-section |
|----|------|---------------------|
| F9 | bond return 14-day text-only | §5.1 |
| F10 | helper "Pending" 5-state 외 | (no-magic cross-ref) |
| F11 | Stripe chargeback/dispute 미처리 | §4.3 |
| F12 | commissions.status enum 부재 | §5.2 |
| F14 | contract_products snapshot 부재 | §5.3 |

---

## §7. Cross-ref

- `_schema/state-machines.md` §4 (invoice 5-state) + §4.5 (Stripe sub-section)
- `_schema/api-endpoints/finance-invoicing.md` (681L) + `finance-payments.md` (1108L)
- `_context/domain-logic-finance-invoice.md` + `finance-payment.md`
- `_audit/MONEY_AUDIT.md` §1-5 (TC-M01-05 reconciliation tests)
- `_audit/CRITICAL_FINDINGS.md` CF-001 / CF-002 / CF-006 / CF-007 / CF-010 / CF-011 / CF-019
- `architecture-rules.md` §3 (mount-order CF-004 affecting webhook)
- `security-rules.md` §1 (Stripe webhook auth)
- `no-magic-rules.md` §1 (14 hard-coded constants)

---

## §8. MONEY_AUDIT TC-M01-05 cross-ref

5 reconciliation test scenarios in `_audit/MONEY_AUDIT.md` §5:
- TC-M01: bookings.total_rent → contracts.total_value precision loss
- TC-M02: invoice line items sum vs invoice amount
- TC-M03: contract_payment_schedules sum vs contract.total_value
- TC-M04: Stripe webhook → invoice.status 동기화
- TC-M05: commissions.amount real precision

**products table hallucinated 정정** (T002.1.6 + T003 묶음 3 발견): MONEY_AUDIT §1 원본 6 columns 환각 → T002.1.6 50-table forensic re-audit 에서 catch + `_schema/SCHEMA_FILE_TABLE_MAP.md` 으로 promote.

---

## §9. 자가 검증 (3 spot-check ✅)

- **C1** bond=4주 / advance=2주 = `bookings.ts:395-396` ✅
- **C2** Formula B 3/4 sites = `contracts.ts:92,94` + `bookings.ts:485` ✅; A 1 site = dashboard ✅
- **C3** Webhook bypass = `stripe.ts:55-57` no source state guard, manual = `invoices.ts:155-167` `eq(status,"Sent")` ✅

---

*Last updated: 2026-04-27 (T004 REWRITE — T001 121L NEEDS REVISION → 본 문서 ~250L; CF-001/002/006/007/010/011/019 anchored).*
