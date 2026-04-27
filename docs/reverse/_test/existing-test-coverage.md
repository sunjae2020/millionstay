# Existing Test Coverage

> ✅ **T007-REWRITE** 2026-04-27 — T002~T006 자산 통합. CF anchor: CF-018 (57 sites IDOR test 부재) + CF-014 (transaction test 부재 — `contracts.ts:55-237` ≥27 mutation max carrier) + CF-022 (state transition test 부재) + 25 CFs × 11 endpoint domain coverage matrix.

## 1. Summary (T001-VERIFIED 0% baseline 강화)

| Layer | Coverage | Tooling |
|---|---|---|
| Unit | **0%** | none |
| Integration / API | **0%** | none |
| End-to-end | **0%** | none |
| Type checks | partial — `pnpm --filter <pkg> typecheck` | TypeScript |
| Manual UAT | yes — operator-led each release | n/a |

**There is no testing framework configured.** No `vitest.config.ts`, `jest.config.ts`, `playwright.config.ts`. No `tests/` or `__tests__/` folder. Root `package.json` has no `test` script.

→ T001 RECON 0% baseline + T007 REWRITE 시점 = 25 CFs 어느 것도 test coverage 0% (위치별 fail-mode 검증 부재).

## 2. 25 CFs × 11 endpoint domain coverage matrix (test 부재 분포)

| CF | severity | 핵심 carrier | 11 도메인 affected | test 우선순위 |
|----|----------|-------------|-------------------|--------------|
| CF-001 | P1 | money type split numeric vs real | finance × 2 + property + catalog + booking + contract | **HIGH** (TC-M01-05) |
| CF-002 | P1 | bookings → contracts lossy path | booking + contract | **HIGH** (TC-M01) |
| CF-003 | P1 | 0 `.references()` FK | 11/11 도메인 | MEDIUM (DB-level RI add 후) |
| **CF-004** | **🔴 P0** | dev-migration.ts:14-79 catastrophic | admin | **CRITICAL** (mount-order assertion + secret rotation) |
| CF-005 | P1 | portal_type service_host TS 누락 | portal-partner | MEDIUM |
| CF-006 | P1 | Formula B 4-site centralisation | booking + contract + dashboard | HIGH (parity test) |
| CF-007 | P1 | bond=4주 / advance=2주 hard-code | booking | HIGH (TC-M05) |
| CF-008 | P1 | audit log absence 6-way TIE 0% floor | admin + payment + catalog + property + crm + portal-partner + public | HIGH (audit assertion) |
| CF-009 | P2 | DEAD product_catalog | catalog | LOW |
| CF-010 | P1 | Stripe webhook bypass + chargeback 부재 | finance-payment | **HIGH** (F-2/F-3 + chargeback handler) |
| CF-011 | P1 | booking_ref race | booking | HIGH (BO-04 race) |
| CF-013 | P1 | 21 no-tz timestamp + PII text DOB/passport | 11/11 | MEDIUM |
| **CF-014** | P1 | helper ≥27 mutation 0 db.transaction = max carrier | contract activate (max) + booking confirm + work_orders | **CRITICAL** (rollback assertion) |
| CF-015 | P1 | hard-delete 16+ sites | accounts + commissions + payment_info + admin | MEDIUM |
| CF-016 | P2 | role-string drift db-sync.ts:16 4-variant Set | admin | LOW |
| CF-017 | P1 | Zod 5.4% admin floor vs 83% blog ceiling | 11/11 (양극단) | HIGH |
| **CF-018** | P1 | IDOR 57 sites (Sub-pattern A 5 + B 56 + 1 router) | 9/11 도메인 (booking + finance + property + catalog + crm + admin) | **CRITICAL** (BAD/POSITIVE pair test) |
| CF-019.a/.b | P1 | stripe orphan columns | finance | MEDIUM |
| CF-020 | P1 | soft-delete leak | 9/11 | MEDIUM |
| CF-021 | P1 | N+1 enrichment | property (buildSpaceResponse) | MEDIUM |
| **CF-022** | P1 | state transition guard discipline 양극단 | booking 9/9 leader vs contract 0/7 floor + invoice manual 67% / webhook 0% split | **CRITICAL** (BS-01-14 + payment split) |
| CF-023.a | P1 | leads.ts:175-204 /convert orphan booking_ref | crm | MEDIUM |
| CF-024 | P1 | rate limiting absence project-wide | 11/11 (특히 OPEN POST 12 ep public) | HIGH (auth lockout + Stripe burst) |

→ **CRITICAL test 우선순위 4 CF (CF-004 + CF-014 + CF-018 + CF-022)** = Phase 5 test foundation 1순위.

## 3. Why this matters before C# migration

A reverse-port without behaviour parity tests is high-risk. 25 CFs × 11 도메인 = ~150 unique fail-modes 가능. Phase 5 = baseline integration tests on Node/Express + double as **acceptance suite for C# port** (xUnit/NUnit `booking-test-cases.md` 동일 시나리오 재실행 = behaviour parity check).

## 4. Recommended stack

| Layer | Recommendation |
|---|---|
| Unit (calculators) | **Vitest** (zero-config; uses Vite already in repo) |
| Integration (HTTP + DB) | **Vitest + supertest + test PostgreSQL schema per worker** (`CREATE SCHEMA test_<id>`) |
| E2E (UI flows) | **Playwright** against deployed preview (admin-layout.md + guest-portal-layout.md cross-ref) |
| Coverage target | 70% statements on services + **100% on financial calculators** + **100% on 4 CRITICAL CFs** |

## 5. Minimum bootstrapping

```jsonc
// artifacts/api-server/package.json
{
  "scripts": { "test": "vitest run", "test:watch": "vitest" },
  "devDependencies": { "vitest": "^2.1.0", "supertest": "^7.0.0", "@types/supertest": "^6.0.0" }
}
```

```ts
// artifacts/api-server/vitest.config.ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { setupFiles: ["./test/setup.ts"], coverage: { provider: "v8", reporter: ["text", "html"] } },
});
```

## 6. Highest-priority test files (CRITICAL CF mapping)

| File | What | CF anchor |
|---|---|---|
| `test/unit/money.test.ts` | `roundMoney`, `proRataPeriod`, `quoteBooking` | CF-001/CF-002/CF-006/CF-007 (TC-M01-05) |
| `test/unit/booking-quote.test.ts` | canonical `quoteBooking()` | CF-006 Formula B parity (4-site centralisation) |
| `test/unit/commission.test.ts` | `calculateCommission()` % + fixed | CF-001 (commissions=real precision) + F12 (status enum) |
| `test/integration/booking-confirm.test.ts` | confirm + dates blocked + contract created + race | **CF-011 race** (BO-04) + **CF-014 transaction rollback** + **CF-022 9/9 transitions** |
| `test/integration/contract-activate.test.ts` | helper `generateContractInvoicesAndSchedules` | **CF-014 max carrier** (≥27 mutation rollback assertion) + CF-006 Formula B + 500-iter safety |
| `test/integration/invoice-mutability.test.ts` | PUT on Paid invoice → 409 | CF-022 manual 67% vs webhook 0% split |
| `test/integration/stripe-webhook.test.ts` | signature + idempotency + chargeback default | CF-010 (F-2/F-3) + F11 (chargeback) |
| `test/integration/auth-lockout.test.ts` | 5 fails → 429 + Retry-After | CF-024 (rate limiting absence repo-wide; auth route 만 lockout 존재) |
| `test/integration/idor-sub-pattern-a.test.ts` | sole-owner E20 + 3 BAD + 2 POSITIVE booking-side | **CF-018 Sub-pattern A** (security-rules §2 cross-ref) |
| `test/integration/idor-sub-pattern-b.test.ts` | SuperAdmin role gate 57 sites | **CF-018 Sub-pattern B** + CF-016 role drift db-sync.ts:16 |
| `test/integration/dev-migration-positive.test.ts` | dev-migration mount-order + secret + NODE_ENV | **🔴 CF-004 P0** (admin sidebar UI 0 hits positive + Phase 2 5-step assertion) |
| `test/integration/guest-data-export.test.ts` | sole-owner vs shared-account guest | APP12 contract (sole-owner E20 canonical exemplar) |

## 7. Test data strategy

```ts
// test/helpers/withTx.ts — per-test rollback
export function withTx(fn: (tx: PgTransaction) => Promise<void>) {
  return async () => {
    await db.transaction(async (tx) => {
      await fn(tx); throw new RollbackSignal();
    }).catch((e) => { if (!(e instanceof RollbackSignal)) throw e; });
  };
}
```

`pg-mem` for fully in-memory unit tests where Drizzle's full Postgres feature set isn't required.

## 8. Coverage gaps prioritized (25 CF lens)

1. **CF-014 transaction rollback** — `contracts.ts:55-237` helper ≥27 mutation 0 tx (max carrier; 부분 실패 시 ghost invoice + ghost schedule + ghost block)
2. **CF-018 IDOR 57 sites** — Sub-pattern A 5 booking + Sub-pattern B 56 inline 28 files + 1 router (Phase 2 `requireSuperAdmin` middleware extraction parity test)
3. **CF-022 state transition discipline** — booking 9/9 leader vs contract 0/7 floor + invoice manual 67% / webhook 0% split (booking-test-cases.md BS-01-14 cross-ref)
4. **CF-001/002 money precision** — TC-M01-05 (financial-calculation-template §9 cross-ref)
5. **CF-004 P0 dev-migration** — mount-order + secret + NODE_ENV gate assertion
6. **CF-024 rate limiting** — auth lockout positive + 11/11 도메인 absence assertion
7. **CF-008 audit log 6-way TIE 0% floor** — backfill 후 audit assertion (175 ep mass-application)

→ `_test/migration-readiness-checklist.md` Phase 5 entry + `_rules/security-rules.md` §11 cross-ref.
