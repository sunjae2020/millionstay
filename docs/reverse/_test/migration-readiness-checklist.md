# C# Migration Readiness Checklist

> ✅ **T001-RECON-VERIFIED** 2026-04-26 — corroborated by `docs/reverse/_audit/T001_RECON_REPORT.md` §g.
> ✅ **T007-LIGHT-TOUCH** 2026-04-27 — 본문 보존, T002~T006 자산 cross-ref. **25 CFs P0/P1/P2 priority 매핑** + Phase 2 종합 7-step prescription cross-ref:
>
> **Phase 2 종합 prescription 7-step 우선순위** (`_rules/architecture-rules.md` §6 + `_rules/security-rules.md` §11):
> 1. **🔴 CF-004 P0** — dev-migration.ts:14-79 catastrophic = mount-order + secret + NODE_ENV gate (Phase 4 Security 최우선; 본 체크리스트 Phase 0 진입 전 hotfix 필수)
> 2. **CF-001** numeric 통일 (Phase 0 DB hygiene 첫 행 `real → numeric(10,2)` 8 컬럼 그룹 — 본 체크리스트 Phase 0 직접 매핑)
> 3. **CF-016** role-string 단일 enum (Phase 4 Security; db-sync.ts:16 4-variant Set vs 29-file `"SuperAdmin"` literal)
> 4. **CF-018** requireSuperAdmin middleware (Phase 4 Security; 57 sites = 1 router + 56 inline 28 files; Sub-pattern A 5 booking-side; Phase 2 단일 middleware 추출 + sole-owner E20 canonical)
> 5. **CF-024** rate limiting (Phase 4 Security; 11/11 도메인 absence; auth lockout 만 8.3% positive)
> 6. **CF-017** Zod baseline (Phase 1 API standardization "Convert manual auth-route validation to Zod with `.strict()`" 행 = 본 체크리스트 직접 매핑; 5.4% → ~83% target)
> 7. **CF-008** audit log 정책 통일 (Phase 4 Security "Audit log backfill" 행 = 본 체크리스트 직접 매핑; 6-way TIE 0% floor 6 도메인 mass backfill)
>
> **추가 CF 우선순위 매핑** (Phase 별):
> - Phase 0: CF-001 (real→numeric 컬럼 그룹) + CF-013 (timestamp→timestamptz + text→varchar) + CF-002 (booking→contract 변환 경로 검증)
> - Phase 1: CF-017 Zod (현재 5.4% admin → 83% blog 양극단; baseline 통일) + CF-019 stripe orphan columns 정리
> - Phase 2: CF-014 db.transaction wrap (max carrier `contracts.ts:55-237` 우선; 모든 ≥2 mutation site)
> - Phase 3: CF-006 Formula B 단일 helper + CF-007 BondWeeks=4/AdvanceWeeks=2 IBusinessRules + CF-022 state guard 양극단 통일 + F9 bond return scheduled job + F12 commissions.status enum + F14 contract_products snapshot
> - Phase 4: CF-004/CF-016/CF-018/CF-024/CF-008 (위 7-step) + CF-015 hard-delete 16+ sites soft-delete 전환
> - Phase 5: 25 CFs × 11 도메인 = ~150 unique fail-mode test (CRITICAL 4: CF-004/CF-014/CF-018/CF-022)
> - Phase 6: CF-003 (.references() 0 → EF Core scaffold 시 73 권장 FK + 10 polymorphic = 83 RI rows; `_schema/erd-core.md` §11 baseline)


Ranked from highest impact / lowest cost.

## Phase 0 — DB hygiene

- [ ] Convert every money column from `real` to `numeric(10,2)`:
  - [ ] `contract_products`: `weekly_rate`, `monthly_rate`, `effective_weekly_rate`, `bond_amount`, `admin_fee`, `cleaning_fee`
  - [ ] `bookings`: `agreed_weekly_rate`, `total_rent`, `stay_weeks`
  - [ ] `contracts`: `weekly_rate`, `total_rent`, `bond_amount`, `advance_amount`
  - [ ] `recurring_schedule.amount`
  - [ ] `commissions.commission_amount`, `commissions.commission_rate`
  - [ ] `work_orders.cost`
  - [ ] `service_catalog.price`
  - [ ] `payment_methods` price-bearing fields if any
- [ ] Add `deleted_at`, `created_at`, `updated_at` where missing (`guest_users`, `partner_users`, `refresh_tokens`, `marketing_consents`, `space_blocked_dates`).
- [ ] Add unique index `(space_id, date)` on `space_blocked_dates`.
- [ ] Convert any `timestamp` (no TZ) to `timestamptz`.
- [ ] Tighten `text` to `varchar(N)` on short bounded fields (email 320, ref strings 50, country_code 2).

## Phase 1 — API standardization

- [ ] Single error response shape: `{ success:false, error:{code,message,details?} }`
- [ ] Single success envelope: `{ data, pagination? }`
- [ ] Mount global Express error middleware
- [ ] Convert manual auth-route validation to Zod with `.strict()`
- [ ] Make `OpenAPI` (in `lib/api-spec`) the source of truth — refresh from current routes

## Phase 2 — Architecture refactor

- [ ] Extract `services/` for booking, contract, invoice, commission, work-order
- [ ] Extract `repositories/` (Drizzle calls only)
- [ ] Wrap every multi-row mutation in `db.transaction()`
- [ ] Add `AppError` class + map to HTTP in error middleware

## Phase 3 — Business rule fixes

- [ ] Server-side past-date validation on booking
- [ ] Server-side min/max stay validation
- [ ] Invoice immutability after `Sent`/`Paid`
- [ ] Cancel booking → terminate contract + void future unpaid invoices
- [ ] Auto cleaning WO on check-out
- [ ] Auto contract `Expired` when `end_date` passes (nightly job)
- [ ] Auto invoice `Overdue` when `due_date` passes (nightly job)
- [ ] Promotion expiry re-validation at booking time
- [ ] Snapshot commission to `commission_earnings` at confirm-time

## Phase 4 — Security

- [ ] MFA for admin / SuperAdmin
- [ ] Refresh token cleanup job
- [ ] Password policy rotation enforcement
- [ ] Audit log backfill for `work_orders`, `cs_tickets`, `accounts`, `contacts`, `promotions`, `marketing_consents`, `admin_users`
- [ ] PII redaction helper used in audit log payloads

## Phase 5 — Test foundation

- [ ] Vitest set up in `artifacts/api-server`
- [ ] Money calculator unit tests
- [ ] Booking state machine tests (BC-* / BS-* / BO-* in `booking-test-cases.md`)
- [ ] Auth + RBAC integration tests
- [ ] Privacy compliance tests (APP 12 export, marketing consent, retention)
- [ ] CI script wires `pnpm -r test` into `package.json`

## Phase 6 — C# port

Once the above are done, the port is mechanical:
- [ ] EF Core scaffolding from existing schema (`dotnet ef dbcontext scaffold` against the cleaned-up DB)
- [ ] Map each `services/` file 1:1 to a C# `IXxxService` + implementation
- [ ] Map each `repositories/` file 1:1 to a C# `IXxxRepository`
- [ ] Re-implement validation with `FluentValidation` referencing the same OpenAPI source of truth
- [ ] Re-implement audit middleware
- [ ] Re-implement Stripe webhook with `Stripe.EventUtility.ConstructEvent`
- [ ] Run the same `booking-test-cases.md` suite against the C# implementation as a behaviour-parity check

## Effort estimate (refresher)

| Phase | Effort |
|---|---|
| 0 — DB hygiene | 8–12 h |
| 1 — API standardization | 8–12 h |
| 2 — Architecture refactor | 24–32 h |
| 3 — Business rule fixes | 16–24 h |
| 4 — Security | 24–40 h (MFA dominates) |
| 5 — Test foundation | 12–20 h |
| 6 — C# port | 200+ h (separate project plan) |
| **Pre-port total** | **~90–140 h** |
