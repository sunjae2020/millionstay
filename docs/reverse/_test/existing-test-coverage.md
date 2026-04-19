# Existing Test Coverage

## 1. Summary

| Layer | Coverage | Tooling |
|---|---|---|
| Unit | **0%** | none |
| Integration / API | **0%** | none |
| End-to-end | **0%** | none |
| Type checks | partial — `pnpm --filter <pkg> typecheck` | TypeScript |
| Manual UAT | yes — operator-led each release | n/a |

**There is no testing framework configured.** No `vitest.config.ts`, `jest.config.ts`, `playwright.config.ts`. No `tests/` or `__tests__/` folder. Root `package.json` has no `test` script.

## 2. Why this matters before C# migration

A reverse-port without behaviour parity tests is high-risk. Before — or in parallel with — the C# migration, a baseline of integration tests on the current Node/Express API should be created. They double as the **acceptance suite for the C# port**.

## 3. Recommended stack

| Layer | Recommendation |
|---|---|
| Unit (calculators) | **Vitest** (zero-config; uses Vite already in repo) |
| Integration (HTTP + DB) | **Vitest + supertest + a test PostgreSQL schema** (use `pg` to `CREATE SCHEMA test_<id>` per worker) |
| E2E (UI flows) | **Playwright**, runs against a deployed preview |
| Coverage target | 70% statements on services + 100% on financial calculators |

## 4. Minimum bootstrapping

```jsonc
// artifacts/api-server/package.json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "vitest": "^2.1.0",
    "supertest": "^7.0.0",
    "@types/supertest": "^6.0.0"
  }
}
```

```ts
// artifacts/api-server/vitest.config.ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    setupFiles: ["./test/setup.ts"],
    coverage: { provider: "v8", reporter: ["text", "html"] },
  },
});
```

## 5. Highest-priority test files to create first

| File | What | Why |
|---|---|---|
| `test/unit/money.test.ts` | `roundMoney`, `proRataPeriod`, `quoteBooking` | Money correctness is non-negotiable |
| `test/unit/booking-quote.test.ts` | the canonical `quoteBooking()` | Locks in the long/short-term formulas |
| `test/unit/commission.test.ts` | `calculateCommission()` percentage + fixed | Reporting accuracy |
| `test/integration/booking-confirm.test.ts` | confirm endpoint races + dates blocked + contract created | Catches the overbooking race-condition |
| `test/integration/invoice-mutability.test.ts` | PUT on Paid invoice → 409 | After the immutability fix |
| `test/integration/auth-lockout.test.ts` | 5 fails → 429 with Retry-After | Already implemented; lock the contract in |
| `test/integration/guest-data-export.test.ts` | sole-owner vs shared-account guest | APP 12 contract |

## 6. Test data strategy

Use a per-test transaction wrapper so the DB starts clean:

```ts
// test/helpers/withTx.ts
export function withTx(fn: (tx: PgTransaction) => Promise<void>) {
  return async () => {
    await db.transaction(async (tx) => {
      await fn(tx);
      throw new RollbackSignal();    // always roll back
    }).catch((e) => { if (!(e instanceof RollbackSignal)) throw e; });
  };
}
```

Or use `pg-mem` for fully in-memory unit tests where Drizzle's full Postgres feature set isn't required.

## 7. Coverage gaps that matter most

The blank slate means **everything** is uncovered, but in priority order:

1. **Money calculators** — pro-rata, period generation, "Est. Due Today", commission.
2. **Booking state machine guards** — every status transition.
3. **Auth & RBAC** — login lockout, password policy, refresh rotation, portal isolation.
4. **Privacy compliance** — `/me/data` shape stability, marketing consent state machine, retention purge.
5. **Stripe webhook** — signature verification + idempotency.
