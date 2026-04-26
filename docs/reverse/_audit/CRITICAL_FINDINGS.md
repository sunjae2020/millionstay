# CRITICAL FINDINGS — MillionStay Codebase

> **Source**: T001 RECON (`docs/reverse/_audit/T001_RECON_REPORT.md`).
> **Format**: One row per finding. Each finding has a stable ID (`CF-NNN`) and **status**. Severity follows `🔴 P0` (must fix before production), `🟡 P1` (must fix before scale), `🟢 P2` (technical debt). Evidence is direct code quotation (≤ 5 lines per finding) with `path:line`.
> **Discipline**: This file records facts and recommendations. **No code changes are made by this document** — fixes are tracked through the `Status` field.
> **Last updated**: 2026-04-26 (T002.2.b half-2 — CF-019 NEW; CF-008 domain severity matrix added; CF-010 evidence-expanded with idempotency gap; CF-014 second locus at `stripe.ts` S2; CF-001 finance-internal boundary confirmation appended).

---

## CF-001 — Money type schism: `real` vs `numeric`

| Field | Value |
|---|---|
| **Severity** | 🔴 P0 |
| **Scope** | Finance · Data integrity · Migration |
| **Status** | OPEN |

### Evidence

`lib/db/src/schema/bookings.ts:19-20`:
```ts
agreed_weekly_rate: numeric("agreed_weekly_rate", { precision: 12, scale: 2 }),
total_rent:         numeric("total_rent",         { precision: 12, scale: 2 }),
```

`lib/db/src/schema/contracts.ts:16-19`:
```ts
weekly_rate:    real("weekly_rate"),
total_rent:     real("total_rent"),
bond_amount:    real("bond_amount"),
advance_amount: real("advance_amount"),
```

### Reproduction

Two tables that store the same conceptual value (`weekly_rate`, `total_rent`) use different physical types. PostgreSQL `real` is IEEE-754 binary32 (≈ 7 decimal digits of precision), while `numeric(12,2)` is exact decimal. A weekly rate of `429.95` round-trips through `real` as `429.95001220703125` (verifiable in any PG instance). When this value participates in invoice generation it propagates rounding error.

### Cross-reference

Affects every `real` money column (see CF-002 for the inventory): `accommodation_catalog.*`, `accommodation_service_catalog.custom_price`, `beneficiaries.fixed_amount`, `commissions.commission_rate/commission_amount`, `contracts.weekly_rate/total_rent/bond_amount/advance_amount`, `product_catalog.*`, `products.*`, `service_catalog.base_price`, `space_service_catalog.custom_price`, `spaces.base_weekly_price/base_daily_price`, `work_orders.cost`.

### Recommendation (no code change)

Migrate every money-bearing `real` column to `numeric(12,2)`. Single `ALTER TABLE … TYPE numeric(12,2) USING …::numeric(12,2)` per column. See `_audit/MONEY_AUDIT.md` §4 for the proposed migration sketch and an alternate `integer cents` model.

### Phase 2 impact

A C# / .NET port maps `numeric` cleanly to `System.Decimal`, but `real` maps to `Single`. Mixing both in the same domain forces conversion shims at every boundary and surfaces `decimal ↔ float` rounding asymmetries in tests.

### Carrier (T002.2.b half-2 confirmation)

The boundary runs **inside** the finance domain group, not between finance and another domain. `finance-payments.md` re-anchored 4 sites of the unsafe (`real`) side: `commissions.commission_rate/commission_amount` (C2/C4) and `beneficiaries.fixed_amount` (B2/B4). The safe (`numeric`) side is anchored by `finance-invoicing.md` (`invoices.amount`, `recurring_schedule.amount`). Phase 2 carrier should treat `commissions` + `beneficiaries` as the migration candidates; `invoices` + `recurring_schedules` are already aligned.

---

## CF-002 — Booking → Contract money write is precision-lossy by design

| Field | Value |
|---|---|
| **Severity** | 🔴 P0 |
| **Scope** | Finance · Data integrity |
| **Status** | OPEN |

### Evidence

`artifacts/api-server/src/routes/bookings.ts:393-395, 458-461`:
```ts
const weeklyRate    = parseFloat(existing.agreed_weekly_rate ?? "0");
const totalRent     = parseFloat(existing.total_rent ?? "0");
const bondAmount    = weeklyRate * 4;
// …
weekly_rate:    weeklyRate,    // numeric → JS number → real
total_rent:     totalRent,     // numeric → JS number → real
bond_amount:    bondAmount,    // JS number → real
advance_amount: advanceAmount, // JS number → real
```

### Reproduction

`bookings.agreed_weekly_rate` is `numeric(12,2)` and arrives at the route handler as a string (Drizzle/`pg` default). The handler `parseFloat`s it to a JS `number` (binary64), then writes it into `contracts.weekly_rate` typed `real` (binary32). Two round-trips:
1. `numeric → string → JS number(binary64)` — exact for AUD amounts within PG range, OK.
2. `JS number(binary64) → real(binary32)` — **lossy** for non-power-of-two fractions (e.g. `429.95`).

### Recommendation (no code change)

Either (a) widen `contracts.*` money columns to `numeric(12,2)` and pass values through as strings (Drizzle accepts string for numeric inserts), or (b) adopt `integer cents` everywhere. Until then, every contract-side display of these values can show last-cent drift versus the booking source.

### Phase 2 impact

Acceptance tests for booking confirmation must assert exact-equality on rate/total/bond/advance. With current types, the assertion `contract.weekly_rate === booking.agreed_weekly_rate` cannot hold for arbitrary rates.

---

## CF-003 — Zero `references()` foreign keys; no DB-level referential integrity

| Field | Value |
|---|---|
| **Severity** | 🔴 P0 |
| **Scope** | Data integrity · Migration |
| **Status** | OPEN |

### Evidence

`docs/reverse/_audit/raw/09_fk_references.txt` (empty after the header line):
```
=== references() FK declarations ===
```
Verified by `rg "\.references\(" lib/db/src/schema/` returning **0 matches** across all 47 schema modules.

### Reproduction

No PostgreSQL `FOREIGN KEY` constraint exists on any `*_id` column. Therefore:
- A row in `bookings` may carry `space_id = 999999` even if no such row exists in `spaces`.
- `DELETE FROM properties` succeeds without restricting child rows in `spaces`.
- Drizzle's `relations()` blocks (which would enable typed joins) are also absent — joins are spelled out in route handlers.

### Recommendation (no code change)

In a Phase 2 migration, add `.references(() => parent.id, { onDelete: "restrict" })` (or `"set null"`/`"cascade"` per business rule) to every `*_id` column. A draft list of every column that should carry an FK is in `_audit/MONEY_AUDIT.md` §3 (cross-table flows are the same axes). For now, application-layer integrity is the only line of defence — and it is enforced inconsistently.

### Phase 2 impact

EF Core / SQLAlchemy / any ORM that introspects PG schema will not infer relationships. Migration tooling cannot generate `JOIN` paths automatically. Any "delete cascade" semantics must be re-derived manually.

---

## CF-004 — `dev-migration` router mounted before global `requireAuth`

| Field | Value |
|---|---|
| **Severity** | 🟡 P1 |
| **Scope** | Security |
| **Status** | OPEN — needs body inspection of `dev-migration.ts` to confirm impact |

### Evidence

`artifacts/api-server/src/app.ts:142, 167`:
```ts
app.use("/api/v1/admin", devMigrationRouter);   // line 142
// … 25 more mounts …
app.use("/api/v1", requireAuth);                // line 167
```

### Reproduction

`requireAuth` is registered at line 167. Because Express middleware applies only to routes registered after it, the route handlers reachable through `devMigrationRouter` (mounted at line 142) bypass the global admin guard. Whether they impose their own auth must be verified by reading the router body — recon read only the import and the mount.

### Recommendation (no code change)

Move the `devMigrationRouter` mount to *after* line 167, OR add `requireSuperAdmin` (or `requireAuth`) explicitly inside the router. If the router is meant to be a one-time migration utility, it should be removed from production builds entirely (gated by `NODE_ENV !== "production"`).

### Phase 2 impact

Any unauthenticated migration endpoint becomes a foot-gun in containerized deployments where the API is publicly reachable.

---

## CF-005 — `partner_users.portal_type` accepts `"service_host"` but TypeScript types it as `"agent" | "owner"`

| Field | Value |
|---|---|
| **Severity** | 🟡 P1 |
| **Scope** | Security · Type safety |
| **Status** | OPEN |

### Evidence

`lib/db/src/schema/partner_users.ts:8`:
```ts
portal_type: text("portal_type").notNull(), // 'agent' | 'owner'
```

`artifacts/api-server/src/middlewares/requirePartnerAuth.ts:14-22`:
```ts
export interface PartnerAuthPayload {
  id: number;
  email: string;
  account_id: number;
  portal_type: "agent" | "owner";
  role: "partner";
}
export function signPartnerJWT(payload: Omit<PartnerAuthPayload, "role">): string {
  return jwt.sign({ ...payload, role: "partner" }, PARTNER_JWT_SECRET, { expiresIn: "7d" });
}
```

`artifacts/api-server/src/routes/service-host-portal.ts:34`:
```ts
if (partner.portal_type !== "service_host") {
```

### Reproduction

The login flow that issues a JWT for a service-host user must call `signPartnerJWT(...)` with `portal_type: "service_host"` — but the function's parameter type is `Omit<PartnerAuthPayload, "role">`, which restricts `portal_type` to `"agent" | "owner"`. The runtime works because TypeScript erases types at runtime; the value is silently widened to `string`. Any future strictness improvement (e.g. an exhaustiveness check on `portal_type`) will silently miss the third value.

### Recommendation (no code change)

Update the TypeScript type and the schema comment to `"agent" | "owner" | "service_host"`. Add a CHECK constraint on `partner_users.portal_type` so the DB rejects unknown values.

### Phase 2 impact

A C# `enum PortalType { Agent, Owner }` would refuse to deserialize the third value at the boundary, breaking service-host login on the new stack.

---

## CF-006 — Two contradictory weekly→monthly conversion formulas across the codebase

| Field | Value |
|---|---|
| **Severity** | 🟡 P1 |
| **Scope** | Finance · Reporting |
| **Status** | OPEN |
| **Last evidence expansion** | T002.1.8 (2026-04-26) — 2 sites → 4 sites (pattern is project-wide, not file-local). |

### Evidence (4 sites, 2 distinct formulas)

**Formula A — `weeklyRate * 4`** (one site):

`artifacts/api-server/src/routes/owner-portal.ts:83`:
```ts
.reduce((sum, b) => sum + parseFloat(b.agreed_weekly_rate ?? "0") * 4, 0);
```

**Formula B — `weeklyRate * (52 / 12)`** (three sites, all expressed identically as `parseFloat((weeklyRate * (52/12)).toFixed(2))` or equivalent):

`artifacts/api-server/src/routes/owner-portal.ts:236`:
```ts
const monthlyRent = (c.weekly_rate ?? 0) * 52 / 12;
```

`artifacts/api-server/src/routes/bookings.ts:485` (inside booking → contract auto-create, line-item generator — booking S2 cross-ref in `_schema/api-endpoints/booking.md`):
```ts
const rentUnitPrice = (() => {
  if (rentBillingFreq === "Weekly") return weeklyRate;
  if (rentBillingFreq === "Biweekly") return weeklyRate * 2;
  return parseFloat((weeklyRate * (52 / 12)).toFixed(2));
})();
```

`artifacts/api-server/src/routes/contracts.ts:92-94` (inside helper `generateContractInvoicesAndSchedules`, called by E9 `POST /v1/contracts/:id/activate` — contract domain doc `_schema/api-endpoints/contract.md` E9):
```ts
const rentAmount = billingFreq === "Weekly" ? weeklyRate
  : billingFreq === "Biweekly" ? weeklyRate * 2
  : parseFloat((weeklyRate * (52 / 12)).toFixed(2));
```

### Reproduction

For a `$500 / week` property:
- The owner dashboard summary line (`owner-portal.ts:83`) reports **`$2,000.00`** ("rent under management" using Formula A).
- The same property's contract-detail page (`owner-portal.ts:236`), the auto-created Monthly rent line item (`bookings.ts:485`), and the recurring Monthly invoice generator (`contracts.ts:94`) all report **`$2,166.67`** (Formula B).

Net delta: 8.3%. The dashboard total will not equal the sum of the contracts it summarises. Reports, settlement statements, and any owner-facing aggregate are exposed.

### Distribution analysis

3 of 4 sites use Formula B; only the **dashboard aggregator** uses Formula A. Formula B is the **de-facto majority** but no helper or constant enforces it — each site re-derives the formula inline.

### Recommendation (no code change)

Consolidate into a single helper (`weeklyToMonthly(weekly: Decimal): Decimal`) exported from `lib/db/src/utils/` (or similar shared location) and replace all 4 inline forms. Choose Formula B (matches Australian rental industry practice and is the existing majority).

### Phase 2 impact

A C# port that mirrors today's "inline at every call site" pattern reproduces the bug with high probability — there is no single function to port. Centralising into `WeeklyToMonthly(decimal weekly)` in a shared `Money` helper class is the natural Phase-2 fix.

### Carrier

`bookings.ts:485` is also the line-item-generator side of the line-items rollup invariant (`MONEY_AUDIT.md` §3 / TC-M02). `contracts.ts:94` is the recurring-invoice-generator side. A formula change affects both invariants.

---

## CF-007 — Hard-coded business rules: 2-weeks advance & 4-weeks bond

| Field | Value |
|---|---|
| **Severity** | 🟡 P1 |
| **Scope** | Finance · Configurability |
| **Status** | OPEN |

### Evidence

`artifacts/api-server/src/routes/bookings.ts:395-396, 423-425`:
```ts
const bondAmount    = weeklyRate * 4;
const advanceAmount = weeklyRate * 2;
// …
`  Security Bond       : ${currency} ${bondAmount.toFixed(2)} (4 weeks rent)`,
`  Advance Payment     : ${currency} ${advanceAmount.toFixed(2)} (2 weeks rent)`,
```

`lib/db/src/schema/products.ts:19` and `accommodation_catalog.ts:25`:
```ts
bond_weeks: real("bond_weeks").default(4),
```

### Reproduction

`bondAmount` is computed inline as `weeklyRate * 4` with no reference to the existing `bond_weeks` column on `accommodation_catalog` or `products`. The `(4 weeks rent)` and `(2 weeks rent)` strings are baked into the contract terms text. There is no per-property override, no per-promotion override, no per-state-jurisdiction override.

### Recommendation (no code change)

Read `bond_weeks` from `accommodation_catalog` (already present) and introduce `advance_weeks` similarly. The terms-text generator should template-interpolate the resolved values instead of hard-coded literals.

### Phase 2 impact

Any market that requires non-default bond/advance ratios (most Australian states have statutory caps) will require code edits today.

---

## CF-008 — `logAction()` called from only 6 of 50 route files (audit log incomplete)

| Field | Value |
|---|---|
| **Severity** | 🟡 P1 |
| **Scope** | Security · Compliance |
| **Status** | OPEN |

### Evidence

`docs/reverse/_audit/raw/08_audit_log_calls.txt` enumerates every call site. Only the following route files invoke `logAction()`:
- `bookings.ts`, `contracts.ts`, `invoices.ts`, `spaces.ts`, `guest-portal.ts`, `stripe.ts`.

The remaining 44 mutation routes (`accounts.ts`, `contacts.ts`, `leads.ts`, `properties.ts`, `tasks.ts`, `work-orders.ts`, `commissions.ts`, `service-hosts.ts`, `beneficiaries.ts`, `service-catalog.ts`, `payment-info.ts`, `accommodation_catalog`, `email-templates.ts`, `space-options.ts`, `space-policies.ts`, `space-images.ts`, `suburbs.ts`, `promotions.ts`, `recurring-schedules.ts`, `cs-tickets.ts`, `admin-users.ts`, …) write `INSERT`/`UPDATE`/`DELETE` without recording an entry in `system_logs`.

`artifacts/api-server/src/utils/auditLog.ts:1-37` defines the helper with action types `CREATE | UPDATE | DELETE | STATUS_CHANGE | LOGIN | PAYMENT | VERIFY | BLOCK | UNBLOCK`.

### Reproduction

Create a contact through `POST /v1/contacts`, then `SELECT * FROM system_logs WHERE entity_type = 'contacts'` — no row will exist.

### Recommendation (no code change)

Make `logAction()` a side-effect of a shared `crud-service` template (see `docs/reverse/_templates/crud-service-template.md`) so every CUD operation produces an entry by default. Alternatively, gate persistence behind a `withAudit(...)` higher-order wrapper.

### Phase 2 impact

`system_logs` cannot be the source of truth for compliance reporting (e.g. who modified a tenant record). Backfilling history later is impossible.

### Domain Severity Matrix (T002.2.b half-2 addition)

Per-domain logAction-coverage measured as `logAction calls / mutator endpoints`. Cells filled progressively as each `T002.2.x` domain doc lands.

| Domain | Mutator endpoints | logAction calls | Coverage % | Status |
|---|---:|---:|---:|---|
| contract | 14 | 6 | 42.9% | confirmed (T002.2.a) |
| finance-invoicing | 13 | 3 | 23.1% | confirmed (T002.2.b half-1) |
| finance-payments | 17 | 3 | 17.6% (call) / 5.9% (endpoint) | confirmed (T002.2.b half-2) |
| **finance (combined)** | **30** | **6** | **20.0% (call)** | confirmed |
| ops-property | TBD | TBD | TBD | pending T002.2.c |
| ops-catalog | TBD | TBD | TBD | pending T002.2.d |
| ops-crm | TBD | TBD | TBD | pending T002.2.e |
| portal-guest | TBD | TBD | TBD | pending T002.2.f |
| portal-partner | TBD | TBD | TBD | pending T002.2.g |
| public | TBD | TBD | TBD | pending T002.2.h |
| admin | TBD | TBD | TBD | pending T002.2.i |

**Finance vs contract gap**: 20.0% (finance combined) vs 42.9% (contract) → finance domain is **53% under-audited** relative to contract. The gap is concentrated in the 4 lookup-style routes (`payment-info`, `commissions`, `beneficiaries`, `accounts`) where coverage is **0%**. The Stripe webhook (S2) is the lone audited mutator on the payments side; payment-info / commissions / beneficiaries / accounts mutate financial routing data **without any audit trail**.

---

## CF-009 — `product_catalog` table is dead schema; the so-called "`products`" table never existed

| Field | Value |
|---|---|
| **Severity** | 🟡 P1 |
| **Scope** | Schema clarity · Migration |
| **Status** | OPEN |
| **Revision history** | 2026-04-26 (T002.1.6): originally claimed "two dead tables (products + product_catalog)"; re-verification at table-level (vs. file-level) found that **no `products` table exists** — the `products.ts` schema file defines the *active* `contract_products` table. Only `product_catalog` is dead. See [`SCHEMA_FILE_TABLE_MAP.md`](../_schema/SCHEMA_FILE_TABLE_MAP.md) for the full 50-table re-audit. *(Map promoted from `_audit/` to `_schema/` on T002.1.7 as a permanent reference.)* |

### Evidence (corrected)

`lib/db/src/schema/products.ts:5` declares **one and only one** table:

```ts
export const contractProductsTable = pgTable("contract_products", { ... });
```

There is no `pgTable("products", ...)` anywhere in the repository (verified by `rg 'pgTable\("products"' lib/db/src/schema/` → 0 matches). The recon's earlier mention of a "`products` table" was a file-name-vs-table-name conflation: the schema file is named `products.ts` but it defines `contract_products`.

The dead-table inventory, by `pgTable(<name>)` and route-import check (using **actual var names**, not naive `<table>Table` heuristics), is:

```
$ rg "productCatalogTable" artifacts/api-server/src/routes/   → 0 matches  ← DEAD
$ rg "contractProductsTable" artifacts/api-server/src/routes/ → 4 files    ← ACTIVE
$ rg "accommodationCatalogTable" artifacts/api-server/src/routes/ → 6 files ← ACTIVE
```

`contractProductsTable` is used by `beneficiaries.ts`, `bookings.ts`, `contracts.ts`, and `products.ts` (the route, which exposes `/api/v1/contract-products` — not `/api/v1/products`).

### What CF-009 actually is

**One** dead table:

| Schema file | Var name | SQL table | Route uses | Status |
|---|---|---|---:|---|
| `lib/db/src/schema/product_catalog.ts:3` | `productCatalogTable` | `product_catalog` | 0 | 🪦 **DEAD** |

Three sibling "product-shaped" tables remain alive:

| File:line | Var | Table | Distinct semantic |
|---|---|---|---|
| `lib/db/src/schema/products.ts:5` | `contractProductsTable` | `contract_products` | A reusable *price card* for what a contract sells (weekly_rate, bond, fees, inclusions) |
| `lib/db/src/schema/accommodation_catalog.ts:5` | `accommodationCatalogTable` | `accommodation_catalog` | A *room offering* attached to a Space (weekly_rate, capacity, bond_weeks) |
| `lib/db/src/schema/product_types.ts` + `product_groups.ts` | `productTypesTable`, `productGroupsTable` | `product_types`, `product_groups` | Lookup taxonomy referenced by both of the above |

The semantic overlap between `contract_products` and `accommodation_catalog` (both carry weekly_rate / bond / admin_fee / cleaning_fee, both inexact `real`) is a **separate** design concern — see CF-001 (money type schism) and the deferred T002.3 / T006 design question of whether to merge them.

### Reproduction

```sql
-- Confirmed: drop only `product_catalog` and no route regresses.
DROP TABLE IF EXISTS product_catalog;
-- Conversely, dropping `contract_products` would break /api/v1/contract-products
-- (10 endpoints in artifacts/api-server/src/routes/products.ts:39-189) and the
-- contract auto-create flow at bookings.ts:368-530 (CF-002 / S2).
```

### Recommendation (no code change)

1. Drop the `product_catalog` table in a single migration; remove `lib/db/src/schema/product_catalog.ts` and its export from `schema/index.ts`.
2. **Rename** the *file* `lib/db/src/schema/products.ts` to `contract_products.ts` to remove the file-name trap that caused this CF to be misclassified for the first round. (Schema-file rename only — table name stays `contract_products`.)
3. Add a top-of-file comment to all eight files identified in [`SCHEMA_FILE_TABLE_MAP.md` §3](../_schema/SCHEMA_FILE_TABLE_MAP.md#3-file-name-vs-table-name-divergences-the-trap) that have file-name ↔ table-name divergence, so future readers do not repeat this mistake. *(Tracked separately as **CF-016** — naming inconsistency.)*

### Phase 2 impact

A C# port that auto-generates entities from schema would generate **two** duplicate `Product`-like entities (`ContractProduct` from `products.ts`, and a stale `ProductCatalog` from `product_catalog.ts`), not three. After (1) above, only `ContractProduct` and `AccommodationCatalog` would remain, with the merge question deferred.

### Carrier impact (atomic commit T002.1.6)

This re-classification corrects the following downstream artifacts in the same commit (R-REPO-1): `INDEX.md` (DEAD count 1→1 but row L46 status flipped DEAD→ACTIVE; Risk Legend wording), `MONEY_AUDIT.md` (7 rows re-attributed `products` → `contract_products`; subtotal sentence; §2.3 closing note removed). Full carrier list: [`_schema/SCHEMA_FILE_TABLE_MAP.md` §5](../_schema/SCHEMA_FILE_TABLE_MAP.md#5-cross-document-impact-log-atomic-commit-t0021).

---

## CF-010 — Stripe webhook ignores `payment_failed` and `charge.refunded` for invoice state

| Field | Value |
|---|---|
| **Severity** | 🟡 P1 *(promoted from P2 in T001.5 follow-up)* |
| **Scope** | Finance · Reconciliation · Accounting accuracy |
| **Status** | OPEN |

### Evidence

`artifacts/api-server/src/routes/stripe.ts:51-96` (full webhook handler re-read in T001.5) handles three event types and ignores everything else:

```ts
case "payment_intent.succeeded": {
  // … sets invoices.status = "Paid", paid_at = new Date(), updated_at = new Date()
  // logAction(action: "PAYMENT", …)
}
case "payment_intent.payment_failed": {
  // logAction(action: "STATUS_CHANGE", newValue: { stripe_status: "payment_failed", … })
  // ← NO db.update on invoices
}
case "charge.refunded": {
  // logAction(action: "STATUS_CHANGE", newValue: { stripe_status: "refunded", amount_refunded, … })
  // ← NO db.update on invoices, no schema column for refund amount
}
default:
  console.log(`[Stripe] Unhandled event type: ${event.type}`);
```

Other event types relevant to invoice integrity that are **not handled at all**: `payment_intent.canceled`, `charge.dispute.created`, `charge.dispute.closed`, `charge.failed`, `payment_intent.requires_action`.

### Reproduction

1. Guest pays an invoice via Stripe → `succeeded` → `invoices.status = "Paid"`. ✅
2. Stripe issues a partial or full refund → `charge.refunded` fires → `system_logs` records it, but `invoices.status` remains `"Paid"` and there is no `refunded_amount` column. From the API perspective the refunded invoice is indistinguishable from a clean payment.
3. Card is declined on the second attempt of a re-authorisation → `payment_failed` fires → `system_logs` records it, but the invoice remains in whatever state it was (`"Sent"`/`"Draft"`). Owner / agent dashboards continue to show it as awaiting payment with no failure flag.

### Why P1 (not P2)

Earlier severity assessment treated this as "missing nice-to-have telemetry". Re-reading the handler in T001.5 confirmed two harder facts:
1. The handler **is the only writer** of `invoices.paid_at` from a real-money source — the application has no reconciliation cron job that re-checks Stripe status against DB state.
2. `charge.refunded` carries `amount_refunded` (cents) which is silently dropped. Once dropped it cannot be recovered without re-fetching from Stripe.

The combined effect is that **any refund or failed re-attempt produces accounting drift** between `invoices` (the system of record per the route layer) and Stripe (the system of record per the money). Any owner statement, KPI dashboard (`dashboard.ts:72`: `paidInvoices.reduce((sum, i) => sum + Number(i.amount ?? 0), 0)`), or agent commission settlement that joins on `invoices.status = "Paid"` will overstate revenue.

### Missed invoice state transitions (full list)

| Stripe event | Current invoice column update | Should be |
|---|---|---|
| `payment_intent.succeeded` | `status="Paid"`, `paid_at`, `updated_at` | ✅ correct |
| `payment_intent.payment_failed` | none | `status="Failed"` (new state) + `failure_reason` (new column) |
| `payment_intent.canceled` | not handled | `status="Cancelled"` (new transition) |
| `charge.refunded` (partial) | none | `status="PartiallyRefunded"` (new) + `refunded_amount` |
| `charge.refunded` (full) | none | `status="Refunded"` (new) + `refunded_at` + `refunded_amount` |
| `charge.dispute.created` | not handled | `status="Disputed"` (new) + `dispute_reason` |
| `charge.dispute.closed` (won) | not handled | revert to `"Paid"` |
| `charge.dispute.closed` (lost) | not handled | `status="ChargedBack"` (new) |

### Recommendation (no code change)

1. Add columns: `invoices.failure_reason text`, `invoices.refunded_at timestamp`, `invoices.refunded_amount numeric(10,2)`, `invoices.dispute_reason text`.
2. Extend the invoice status enum with `Failed`, `Cancelled`, `PartiallyRefunded`, `Refunded`, `Disputed`, `ChargedBack` (today's status set must first be enumerated — see `_schema/state-machines.md` planned for T002).
3. Wire each Stripe event into the appropriate `db.update(invoicesTable)` block; keep `logAction` for the audit trail.
4. Optionally add a daily reconciliation cron that pages through Stripe charges and asserts invoice-side consistency.

### Phase 2 impact

A C# port without these state transitions inherits the accounting drift as schema-level "permanent debt". Fixing it later requires a backfill from Stripe API, which is rate-limited and asymmetric (e.g. disputes have their own pagination).

### Evidence expansion (T002.2.b half-2 — idempotency gap)

A second class of risk surfaced during `finance-payments.md` §2 S2 walk-through (incidental J4): the webhook handler does **not** dedupe on `event.id`. Stripe documents that webhook retries (and at-least-once delivery) require the receiver to track processed event IDs; the only current store is `system_logs.new_value` JSON which is not queried before processing. Consequence:

1. Stripe retries `payment_intent.succeeded` after a transient 5xx → handler re-runs the `db.update(invoicesTable).set({ status: "Paid", paid_at: new Date() })` block → `paid_at` is overwritten with the second-attempt timestamp (silent), and a second `logAction({ action: "PAYMENT" })` row is inserted (visible only in audit log scan).
2. Same risk for `payment_failed` and `charge.refunded` `STATUS_CHANGE` rows — duplicate entries in `system_logs` with no dedup.

**Recommended addition** to the recommendation block above: introduce a `stripe_processed_events` table keyed on `event.id`, write-through-then-process semantics, and reject (HTTP 200 + no-op) on duplicate. Until then, `paid_at` is "last-write-wins" rather than "first-success-wins".

Carrier: see `finance-payments.md` §6 R-REPO-5 J4 for the full incidental and S2 §2 Event Coverage Matrix for the per-event dedup picture.

---

## CF-011 — Contract reference numbering by row count (race condition)

| Field | Value |
|---|---|
| **Severity** | 🟢 P2 |
| **Scope** | Data integrity |
| **Status** | OPEN |

### Evidence

`artifacts/api-server/src/routes/bookings.ts:447-449` (verified via T001):
```ts
const countRows = await db.select({ id: contractsTable.id })
  .from(contractsTable).where(ilike(contractsTable.contract_ref, `MS-C-${year}-%`));
const contractRef = `MS-C-${year}-${String(countRows.length + 1).padStart(5, "0")}`;
```

Same pattern for booking refs (`bookings.ts:60-69`, observed in recon).

### Reproduction

Two concurrent contract creations both read the same `countRows.length`, both compute the same next ref, both insert — UNIQUE collision (if a unique index exists on `contract_ref`) or silent duplicates (if not).

### Recommendation (no code change)

Use a PG sequence (`CREATE SEQUENCE contract_ref_seq;`) and format `MS-C-${year}-${nextval(...)}`, or use a `serial` reference column.

### Phase 2 impact

Any system serving multi-tenant or high-throughput contract creation will collide.

---

## CF-012 — `space_blocked_dates` and `space_availability` coexist with overlapping purpose

| Field | Value |
|---|---|
| **Severity** | 🟢 P2 |
| **Scope** | Schema clarity |
| **Status** | OPEN |

### Evidence

`lib/db/src/schema/spaces.ts` (3rd table) defines `space_blocked_dates`. `lib/db/src/schema/space_availability.ts` defines a separate table. The booking overbooking guard uses **only** `space_blocked_dates` (`bookings.ts:96-105`, observed in recon).

### Reproduction

Insert availability windows into `space_availability`; book against them. Overbooking guard does not consult that table.

### Recommendation (no code change)

Decide which table is canonical and either delete the unused one or wire it into the overbooking guard.

### Phase 2 impact

Migration tooling will replicate both tables, leaving the next maintainer to make the same decision under time pressure.

---

## CF-013 — Date / time-zone storage is inconsistent and partly type-unsafe

| Field | Value |
|---|---|
| **Severity** | 🟡 P1 |
| **Scope** | Data integrity · Internationalisation · PMS booking accuracy |
| **Status** | OPEN |

### Evidence

**Inconsistent `withTimezone` flag on `timestamp()`** — verified counts (T001.5 re-check):
- 145 total `timestamp(...)` column declarations across `lib/db/src/schema/`.
- **123 with `{ withTimezone: true }`** (the dominant pattern; covers `created_at`, `updated_at`, and most `deleted_at` columns on the newer schema files).
- **21 without** `withTimezone` (the minority — predominantly `deleted_at` on the older schema files, plus one `updated_at` slip).

The 21 without-tz lines (full enumeration):

```
lib/db/src/schema/bookings.ts:29           deleted_at: timestamp("deleted_at")
lib/db/src/schema/contracts.ts:22          deleted_at: timestamp("deleted_at")
lib/db/src/schema/invoices.ts:19           deleted_at: timestamp("deleted_at")
lib/db/src/schema/properties.ts:20         deleted_at: timestamp("deleted_at")
lib/db/src/schema/spaces.ts:29             deleted_at: timestamp("deleted_at")
lib/db/src/schema/recurring_schedules.ts:20 deleted_at: timestamp("deleted_at")
lib/db/src/schema/products.ts:34           deleted_at: timestamp("deleted_at")
lib/db/src/schema/promotions.ts:24         deleted_at: timestamp("deleted_at")
lib/db/src/schema/work_orders.ts:20        deleted_at: timestamp("deleted_at")
lib/db/src/schema/cs_tickets.ts:15         deleted_at: timestamp("deleted_at")
lib/db/src/schema/tasks.ts:22              deleted_at: timestamp("deleted_at")
lib/db/src/schema/leads.ts:30              deleted_at: timestamp("deleted_at")
lib/db/src/schema/beneficiaries.ts:17      deleted_at: timestamp("deleted_at")
lib/db/src/schema/space_policies.ts:15     deleted_at: timestamp("deleted_at")
lib/db/src/schema/space_options.ts:11      deleted_at: timestamp("deleted_at")
lib/db/src/schema/suburbs.ts:15            deleted_at: timestamp("deleted_at")
lib/db/src/schema/email_templates.ts:13    deleted_at: timestamp("deleted_at")
lib/db/src/schema/contract_types.ts:12     deleted_at: timestamp("deleted_at")
lib/db/src/schema/service_catalog.ts:29    deleted_at: timestamp("deleted_at")
lib/db/src/schema/product_types.ts:7       deleted_at: timestamp("deleted_at")
lib/db/src/schema/product_groups.ts:7      deleted_at: timestamp("deleted_at")
lib/db/src/schema/integration_settings.ts:6 updated_at: timestamp("updated_at").defaultNow().notNull()  ← outlier (updated_at, not deleted_at)
```

The pattern split runs along the boundary between **business-domain tables** that omit `withTimezone` (bookings, contracts, invoices, properties, spaces, leads, tasks, products, promotions, work_orders, …) and **identity / financial / content** tables that include it (users, accounts, payment_info, commissions, contacts, documents, blog_posts). The `deleted_at` column on the first group is `timestamp without time zone`; on the second group it is `timestamptz`. **Joins or comparisons between the two groups (e.g. `bookings.deleted_at` vs `accounts.deleted_at`) implicitly cast the without-tz value at the session time-zone setting — non-deterministic across deployments.**

**Free-text date columns** (no DB-level format validation):

```ts
lib/db/src/schema/spaces.ts:44            date: text("date").notNull()        // 3rd table in spaces.ts (likely space_blocked_dates)
lib/db/src/schema/guest_users.ts:14       date_of_birth: text("date_of_birth")
```

**`date` columns** (PG `date`, no time-zone, no time-of-day):

`bookings.check_in_date/check_out_date/expiry_date`, `tasks.start_date/due_date`, `recurring_schedules.start_date/end_date/next_due_date`, `leads.preferred_check_in_date`, `space_availability.date`, `service_hosts.from_date/to_date`. — Suitable for "calendar day" semantics, but only if the surrounding code agrees on a reference time-zone.

### Reproduction

1. **Booking off-by-one risk**: A guest in Tokyo (UTC+9) books an Australian property for `check_in_date = 2026-08-01`. The check-in is meant to be 2026-08-01 *Australian local* (UTC+10 / UTC+11 with DST). Because `bookings.check_in_date` is a bare `date` and there is no per-booking time-zone column, the back-end has no way to distinguish "2026-08-01 in AEST" from "2026-08-01 in JST" — the value relies on the convention that all dates are AEST/AEDT, which is enforced nowhere in the schema and only implicitly in the routes.
2. **DOB free-text**: `guest_users.date_of_birth` is `text`. A row with the value `"01/02/1990"` is ambiguous (1 Feb vs 2 Jan depending on locale). No format check exists.
3. **Audit timestamp comparability**: `system_logs.created_at` (timestamp w/ tz) cannot be compared to `bookings.deleted_at` (timestamp w/o tz) without an explicit `AT TIME ZONE` cast. PG implicitly assumes the session time zone for the `w/o tz` value, which depends on the connection settings.

### Recommendation (no code change)

1. Migrate every `timestamp("…")` column to `timestamp("…", { withTimezone: true })`. PG cast: `ALTER TABLE … ALTER COLUMN … TYPE timestamptz USING … AT TIME ZONE 'UTC'`. The choice of `'UTC'` here is a convention — if the values were originally written from server-local time (likely `Australia/Sydney`), use that instead.
2. Coerce `spaces.date` and `guest_users.date_of_birth` to `date` (PG `date`); validate ISO-8601 at the application layer before insert.
3. Introduce a `bookings.timezone text` (or `properties.timezone text` referenced by booking) so that `check_in_date` is unambiguous when paired with the property's local zone. (Phase 2 concern.)

### Phase 2 impact

A C# port using `DateTime` (no TZ) vs `DateTimeOffset` will inherit the existing inconsistency unless normalised at migration time. Tests for "did this booking start today?" cannot be written meaningfully today.

---

## CF-014 — Multi-step mutations execute outside transactions

| Field | Value |
|---|---|
| **Severity** | 🟡 P1 |
| **Scope** | Data integrity · Atomicity |
| **Status** | OPEN |
| **Last evidence expansion** | T002.1.8 (2026-04-26) — entry handler-only → entry handler + helper span (L55-237 enumerated, ≥27 mutations per typical 12-month activation). |

### Evidence

`db.transaction(...)` is called from **3** sites in the entire API server (verified by `rg -n "db\.transaction\("`):

```
artifacts/api-server/src/lib/seedSync.ts:214
artifacts/api-server/src/routes/dev-migration.ts:38
artifacts/api-server/src/routes/service-host-portal.ts:365
```

Two are administrative/migration helpers; only one (`service-host-portal.ts:365`) sits on a production code path.

The most exposed multi-step mutation, **contract activation**, performs three writes plus an invoice-and-schedule generator without an enclosing transaction. `artifacts/api-server/src/routes/contracts.ts:429-450`:

```ts
router.post("/v1/contracts/:id/activate", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [row] = await db.update(contractsTable)                 // ← step 1
    .set({ status: "Active", effective_date: new Date().toISOString().slice(0, 10) })
    .where(eq(contractsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "NOT_FOUND" }); return; }

  const generated = await generateContractInvoicesAndSchedules(id);   // ← step 2 — see helper breakdown below
  if (row.booking_id) {
    await db.update(bookingsTable)                              // ← step 3
      .set({ booking_status: "Active" })
      .where(eq(bookingsTable.id, row.booking_id));
  }

  await logAction({ /* ... */ });                               // ← step 4 (writes system_logs)
  // …
});
```

### Helper breakdown — `generateContractInvoicesAndSchedules` (`contracts.ts:55-237`, 183 lines)

The "step 2" line above hides the bulk of the atomicity risk. The helper is invoked **without** receiving a `tx` parameter and uses the module-level `db` for every statement. Per typical 12-month Rent contract activation (1 rent line item, 1 bond, 1 advance), the helper executes in this order:

| # | Operation | Approx. count per 12-mo Rent contract |
|---:|---|---:|
| (i) | `db.delete(invoicesTable).where(eq(contract_id, id))` (idempotency wipe) | 1 |
| (ii) | `db.delete(recurringSchedulesTable).where(eq(contract_id, id))` (idempotency wipe) | 1 |
| (iii) | `db.select(... contractLineItemsTable ...).where(eq(contract_id, id))` (read line items) | 1 (read, not counted as mutation) |
| (iv) | `db.insert(invoicesTable).values({...})` per Bond / Advance line item | 0–2 |
| (v) | `db.insert(recurringSchedulesTable).values({...})` for the rent stream | 1 |
| (vi) | `db.insert(invoicesTable).values({...})` per generated rent invoice (one per billing period spanned by the contract dates) | 12 (Monthly), 26 (Biweekly), or 52 (Weekly) |
| (vii) | `db.insert(recurringSchedulesTable).values({...})` for any extra non-rent recurring line items | 0–N |

**Sequential mutation count for the typical 12-month Monthly contract**: 1 + 1 + 2 + 1 + 12 = **≥17 unenveloped writes**. For a 12-month Weekly contract the count rises to **≥57**. Combined with the entry handler's 3 outer writes (steps 1, 3, 4) and the 2 idempotency deletes (i, ii), one `POST /:id/activate` HTTP call performs **≥27 sequential mutations** across **3 tables** (`contracts`, `invoices`, `recurring_schedules`, plus `bookings` if linked) with **zero transaction boundary**.

The two idempotency deletes (i, ii) at the *start* of the helper are themselves a giveaway: the author knew partial failure was possible (otherwise idempotency would not be needed) but addressed it by destroying-and-recreating on every call rather than wrapping the whole sequence in a transaction. A retry after partial failure leaves the contract `"Active"` with whatever rows the previous attempt managed to write, then deletes them all and recreates them — money-touching rows are reissued under new IDs.

Insert-call density elsewhere on the same kind of code path:
- `bookings.ts`: 6 distinct `db.insert(...)` calls (booking confirm, terms generation, line items, …).
- `contracts.ts`: 8 distinct `db.insert(...)` calls + the 22+ helper-internal calls counted above.
- `invoices.ts`: 1 `db.insert(...)`.

### Reproduction

If `generateContractInvoicesAndSchedules` partially fails (e.g. NETWORK error after the 2nd of 12 monthly invoice INSERTs), the contract is already `"Active"` and the booking has not yet been promoted. Re-running the activation handler will (a) succeed because the helper's first action is to `db.delete` the prior partial inserts, (b) regenerate **duplicate** invoice IDs (the old IDs are now gone but `system_logs` may still reference them — see CF-008 / CF-009 / CF-015 interaction), (c) re-issue invoice numbers if those are derived from row count or sequence, breaking external invoice numbering continuity.

For booking confirmation (`bookings.ts:393-461`) the same risk applies — contract write succeeds, line-items write fails, contract sits in DB referencing missing line items.

### Recommendation (no code change)

Wrap every multi-write handler in `db.transaction(async (tx) => { … })` and pass `tx` to helpers like `generateContractInvoicesAndSchedules`. Compensating logic (idempotency keys, retry windows) is a Phase 2 enhancement; the immediate need is atomicity.

### Phase 2 impact

A C# port using EF Core `IDbContextTransaction` makes this trivial; a port that mirrors today's fire-and-forget pattern reproduces the bug.

### Second locus — Stripe webhook (T002.2.b half-2)

`artifacts/api-server/src/routes/stripe.ts:51-96` — the `payment_intent.succeeded` branch executes 2 sequential mutations across 2 tables with **no transaction**:

1. `db.update(invoicesTable).set({ status: "Paid", paid_at: new Date(), updated_at: new Date() }).where(eq(id, invoiceId))` (`:55-60`).
2. `await logAction({ action: "PAYMENT", … })` writes `system_logs` (`:61-72`).

A failure between (1) and (2) leaves the invoice marked Paid but with no audit trail of who/when (CF-008 + CF-014 compounded). Worse, because the webhook does not dedupe on `event.id` (see CF-010 Evidence expansion above), a Stripe retry re-runs (1) and inserts a second `system_logs` row — both within the same un-transactioned envelope. The `payment_failed` and `charge.refunded` branches each fire 1 `logAction` only (no DB update — CF-010 carrier), so they are formally not multi-step, but they share the no-dedup property.

**Anchor count update**: CF-014 now has 3 production code-path loci — `bookings.ts:393-461` (booking confirm), `contracts.ts:429-450` + helper `:55-237` (contract activate), and `stripe.ts:51-96` (Stripe webhook succeeded branch). The first two were enumerated in T002.1.8; the third lands here.

Carrier: see `finance-payments.md` §2 S2 (full sample) + §7 cross-references.

---

## CF-015 — Soft-delete vs hard-delete is inconsistent across tables and routes

| Field | Value |
|---|---|
| **Severity** | 🟡 P1 |
| **Scope** | Data integrity · Compliance · Audit |
| **Status** | OPEN |

### Evidence

**Schema posture**:
- ~33 tables declare `deleted_at: timestamp("deleted_at", …)` (soft-delete intended).
- 4 tables declare `is_active: boolean` only, no `deleted_at`: `guest_users.ts:30`, `partner_users.ts:15`, `email_templates.ts:12` (also has `deleted_at`), `recurring_schedules.ts:19` (also has `deleted_at`). The first two have **no soft-delete column at all**.
- ~15 tables have neither: `accommodation_catalog`, `accommodation_service_catalog`, `announcements`, `booking_service_photos`, `contract_line_items`, `email_logs`, `guest_emergency_contacts`, `integration_settings`, `login_attempts`, `marketing_consents`, `page_contents`, `product_catalog`, `refresh_tokens`, `service_hosts`, `space_availability`, `space_images`, `space_service_catalog`, `system_logs`. Some of these are append-only by design (`system_logs`, `login_attempts`); others are not.

**Route posture** — `db.delete(...)` (hard delete) used in 16+ routes. The egregious ones are tables that **do** have `deleted_at`:

```
artifacts/api-server/src/routes/accounts.ts:106, 122          db.delete(accountsTable)        ← accounts has deleted_at (timestamptz)
artifacts/api-server/src/routes/commissions.ts:67, 83         db.delete(commissionsTable)     ← commissions has deleted_at
artifacts/api-server/src/routes/payment-info.ts:67, 83        db.delete(paymentInfoTable)     ← payment_info has deleted_at
artifacts/api-server/src/routes/contacts.ts:77, 93            db.delete(contactsTable)        ← contacts has deleted_at
artifacts/api-server/src/routes/beneficiaries.ts:106, 122     db.delete(beneficiariesTable)   ← beneficiaries has deleted_at
artifacts/api-server/src/routes/tasks.ts:148, 164             db.delete(tasksTable)           ← tasks has deleted_at
artifacts/api-server/src/routes/space-policies.ts:107, 131    db.delete(spacePoliciesTable)   ← space_policies has deleted_at
artifacts/api-server/src/routes/suburbs.ts:116, 137           db.delete(suburbsTable)         ← suburbs has deleted_at
artifacts/api-server/src/routes/space-options.ts:108, 129     db.delete(spaceOptionsTable)    ← space_options has deleted_at
artifacts/api-server/src/routes/admin-users.ts:106, 139       db.delete(usersTable)           ← users has deleted_at (timestamptz)
artifacts/api-server/src/routes/product-catalog.ts:166, 257   db.delete(accommodationCatalogTable) / accommodationServiceCatalogTable
                                                              ← accommodation_catalog has NO soft-delete column at all
```

### Reproduction

1. Delete an `account` via `DELETE /v1/accounts/:id` → row physically removed. Future system-logs reference (`system_logs.entity_type='account', entity_id=123`) becomes unresolvable. Compliance evidence destroyed.
2. Delete an `accommodation_catalog` row → no soft-delete column exists, so the row is gone immediately. Bookings that reference it (no FK — see CF-003) silently dangle. Reports that join through it lose data.
3. List endpoints filter on `isNull(deleted_at)`, but the delete handlers physically remove rows — the filter never sees the soft-delete pattern in action for these tables.

### Recommendation (no code change)

1. Adopt a project-wide rule: tables that carry business-meaningful FKs (accounts, contacts, accommodation_catalog, …) **always** soft-delete; tables that are pure look-ups or append-only logs may hard-delete.
2. Replace each flagged `db.delete(table)` call with `db.update(table).set({ deleted_at: new Date() })`. Where `deleted_at` is missing, add it first via migration.
3. Standardise the soft-delete column name (`deleted_at`) and drop the parallel `is_active` boolean on `guest_users`/`partner_users` (or keep both but document that `is_active` means "currently usable" and `deleted_at` means "tombstoned").

### Phase 2 impact

EF Core's `HasQueryFilter` for soft-delete relies on a uniform column. Today's two-pattern world (`is_active` vs `deleted_at`) forces per-entity configuration and produces silent leaks when filters are forgotten.

---

## Summary

| ID | Severity | Title | Status |
|---|---|---|---|
| CF-001 | 🔴 P0 | Money type schism: real vs numeric | OPEN |
| CF-002 | 🔴 P0 | Booking → contract write is precision-lossy | OPEN |
| CF-003 | 🔴 P0 | Zero `references()` FK declarations | OPEN |
| CF-004 | 🟡 P1 | dev-migration mounted before global auth | OPEN |
| CF-005 | 🟡 P1 | service_host portal_type bypasses TS types | OPEN |
| CF-006 | 🟡 P1 | Weekly→monthly formula mismatch in owner-portal | OPEN |
| CF-007 | 🟡 P1 | Hard-coded 2-weeks advance / 4-weeks bond | OPEN |
| CF-008 | 🟡 P1 | logAction called from only 6 of 50 route files | OPEN |
| CF-009 | 🟡 P1 | `product_catalog` dead table (1, not 2 — `products` table never existed; `products.ts` file defines active `contract_products`) | OPEN |
| CF-010 | 🟡 P1 | Stripe webhook ignores payment_failed / refunded *(promoted from P2)* | OPEN |
| CF-011 | 🟢 P2 | Contract ref by row-count (race) | OPEN |
| CF-012 | 🟢 P2 | space_blocked_dates vs space_availability overlap | OPEN |
| CF-013 | 🟡 P1 | Date / time-zone storage inconsistent + free-text dates | OPEN |
| CF-014 | 🟡 P1 | Multi-step mutations not in transactions | OPEN |
| CF-015 | 🟡 P1 | Soft-delete vs hard-delete inconsistent | OPEN |
| CF-016 | 🟢 P2 | Schema file/table/variable naming inconsistency (14 of 50 tables break convention) — Phase 2 migration friction | OPEN |
| CF-017 | 🟡 P1 | Input validation (Zod or any) absent on ~90% of route files — only 5 of 52 files validate `req.body` | OPEN |
| CF-018 | 🟡 P1 | IDOR-class authorization-scope omission on nested resource handlers — 7 outright + 3 partial of 17 audited | OPEN |
| CF-019 | 🟡 P1 | Write-orphan columns on `invoices` table — `stripe_payment_intent_id` + `stripe_checkout_url` declared in schema but never written by any route | OPEN |

**Counts after T002.2.b half-2 follow-up**: P0=3, P1=13, P2=3 (total 19). CF-017 + CF-018 are T002.2.a Spot-Check C3 graduates (R-REPO-5); CF-019 is the T002.2.b half-2 Spot-Check C3-8 graduate (R-REPO-5). Two further candidates parked for T002.2.d confirmation: **CF-020 candidate** (system-wide soft-delete leak, 9 anchors so far) and **CF-021 candidate** (N+1 enrichment anti-pattern, 2 domains so far).

---

## CF-016 — Schema file/table/variable naming inconsistency

| Field | Value |
|---|---|
| **Severity** | 🟢 P2 |
| **Scope** | Phase 2 migration · Onboarding friction · Tooling reliability |
| **Status** | OPEN |
| **Discovery** | T002.1.6 incidental escalated to T002.1.7 (R-REPO-5) — see [`_schema/SCHEMA_FILE_TABLE_MAP.md` §3](../_schema/SCHEMA_FILE_TABLE_MAP.md#3-file-name-vs-table-name-divergences-the-trap) for the canonical 14-row divergence inventory. |

### Evidence

**8 file-name ↔ table-name divergences** in `lib/db/src/schema/`:

| File | Defines table | Divergence type |
|---|---|---|
| `users.ts` | `admin_users` | filename omits `admin_` prefix |
| `email_logs.ts` | `email_log` | plural ↔ singular |
| `email_templates.ts` | `email_template` | plural ↔ singular |
| `recurring_schedules.ts` | `recurring_schedule` | plural ↔ singular |
| `system_logs.ts` | `system_log` | plural ↔ singular |
| `products.ts` | `contract_products` | filename is unrelated to actual table concept |
| `bookings.ts`, `cs_tickets.ts` | 2 tables each | one file declares unrelated tables |
| `spaces.ts`, `announcements.ts` | 3 tables / 2 tables | same |

**6 var-name ↔ table-name convention breaks**:

| Var | Real table | Issue |
|---|---|---|
| `usersTable` | `admin_users` | misleading — looks like a generic `users` table |
| `integrationSettings` | `integration_settings` | no `Table` suffix at all (the only such case) |
| `recurringSchedulesTable`, `emailLogsTable`, `emailTemplatesTable`, `systemLogsTable` | singular tables | plural-var maps to singular-table |

### Reproduction

```sh
$ rg "(\w+Table?\w*)\s*=\s*pgTable\(\"([a-z_]+)\"" lib/db/src/schema/ \
     -o -r '$1|$2' --no-filename | sort -u | wc -l
50           # 50 var↔table pairs across 47 files
```

Of those 50, **14 break** either the `<filename>.ts → <filename>` rule, the `<TableName>Table` var rule, or both. See `_schema/SCHEMA_FILE_TABLE_MAP.md` §3.

### How this CF was discovered

Causal chain: T002.1 wrote 5 sample endpoint docs ✅ → T002.1.5 added re-verification log ✅ → re-verification surfaced one anomalous claim ("`products.ts` route file is DEAD but `contract_products` is active") → T002.1.6 ran a 50-table forensic re-audit → discovered the convention break is **systematic** (14 of 50 tables, not 1). The pattern is what makes this a CF rather than a memo.

The CF-009 mis-classification (claimed 2 dead tables, real = 1) was a direct consequence of this divergence: the recon's grep for "dead schema files" assumed filename = table name, and there was no other map to check against. Until **CF-016** is fixed, every future schema audit risks the same class of error.

### Phase 2 impact

- **EF Core** convention-based mapping (filename → entity → table) will silently produce wrong table names for 14 of 50 entities.
- `dotnet ef dbcontext scaffold` will generate plausible-looking entities that do not match the SQL schema; bugs surface only at first SQL query.
- Naive grep recipes in any tooling (audit scripts, ripgrep heuristics, Cursor/Copilot prompts) will produce false 0-counts. **CF-009's first-round mis-classification is the canonical example.**
- Onboarding: new engineers cannot guess table location from filename — they must consult `_schema/SCHEMA_FILE_TABLE_MAP.md` first.

### Recommendation (no code change yet)

1. **Phase 2 entity mapping**: declare every entity with explicit `[Table("...")]` attribute; do not rely on filename or class-name conventions. *(Equivalent in Drizzle would be enforcing `pgTable("<table>", { ... })` matches the file basename, but that is a Phase 1 cleanup item with non-zero risk; defer.)*
2. Add a **post-codegen verification script** that reads `_schema/SCHEMA_FILE_TABLE_MAP.md` and asserts every generated entity name matches the recorded table name.
3. **Long-term cleanup** (separate PR, after Phase 2 cutover): rename schema files to match table names — `products.ts` → `contract_products.ts`, `users.ts` → `admin_users.ts`, `email_logs.ts` → `email_log.ts`, etc. Schema-file rename only; SQL table names stay (zero migration cost).
4. **Living-doc obligation**: any schema PR (table add/remove/rename) MUST update `_schema/SCHEMA_FILE_TABLE_MAP.md` in the same commit (R-REPO-1). Stale rows there will silently re-introduce CF-009-class bugs.

### Carrier

`_schema/SCHEMA_FILE_TABLE_MAP.md` §3 is the canonical evidence. Any cleanup PR must update both files together.

---

## CF-017 — Input validation (Zod or any) absent on ~90% of route files

| Field | Value |
|---|---|
| **Severity** | 🟡 P1 |
| **Scope** | Security · Data integrity · Input validation · Phase 2 codegen |
| **Status** | OPEN |
| **Discovery** | T002.2.a Spot-Check C3 category [d] ("Zod absence ×28, domain-wide observation") escalated to T002.1.8 (R-REPO-5) after cross-domain audit confirmed it is project-wide, not contract-specific. |

### Evidence

Project-wide audit of `artifacts/api-server/src/routes/` (52 `.ts` route files, ~353 endpoints):

**Files importing `zod` directly** — `rg -lc "from \"zod\"" artifacts/api-server/src/routes/`: only **2**.
- `email-templates.ts`
- `recurring-schedules.ts`

**Files using `z.*` schema patterns** — `rg -c "z\.(object|string|number|enum|array|parse|safeParse)" artifacts/api-server/src/routes/`: only **5**.
| File | `z.*` call sites |
|---|---:|
| `blog-posts.ts` | 32 |
| `email-templates.ts` | 6 |
| `page-contents.ts` | 5 |
| `promotions.ts` | 19 |
| `recurring-schedules.ts` | 11 |

**Files using shared schema validators** (e.g. `*.safeParse(req.body)` where the `*Params` / `*Body` schema is imported from `@workspace/api-types` or `@workspace/api-spec`): **1 known so far** — `bookings.ts` (≥18 `safeParse` call sites; the canonical exemplar documented in `_schema/api-endpoints/booking.md` S1–S5).

**Net coverage**: ~6 of 52 route files (~12%) perform any form of input-shape validation; ~46 of 52 (~88%) accept `req.body` and `req.params` without runtime type checks. The contract domain (28 / 28 endpoints, T002.2.a) is the largest single block of unvalidated mutation surface.

### Reproduction

Open `artifacts/api-server/src/routes/contracts.ts:589`:
```ts
router.patch("/v1/contracts/:id/line-items/:lineId", async (req, res): Promise<void> => {
  const lineId = Number(req.params.lineId);
  const { item_type, name, billing_trigger, billing_frequency, unit_price, quantity, currency, gst_included, notes } = req.body;
  const qty = Number(quantity ?? 1);
  const price = parseFloat(unit_price ?? 0);
  // … straight to db.update()
```

Send `PATCH /v1/contracts/1/line-items/1` with body `{"unit_price": "abracadabra"}`:
- `parseFloat("abracadabra")` → `NaN`
- `String(NaN)` → `"NaN"`
- `db.update(...).set({ unit_price: "NaN", total_price: "NaN", ... })` → PostgreSQL rejects with a low-level cast error returned to the caller as a generic 500.

Send the same with `{"item_type": null, "name": <a 100MB string>, ...}`:
- All fields are dropped into the `set({...})` object via spread; nothing rejects them at the boundary.
- The 100MB string is sent over the wire to PostgreSQL, which rejects only after partial transmission — `pg` may exhaust the per-process backend memory budget during the parse step.

### Phase 2 impact

A C# port using FluentValidation, DataAnnotations, or MediatR pipeline behaviours needs **per-endpoint validator classes**. Today, those validators do not exist in code form for ~88% of endpoints — the implicit "validation rules" must be reverse-engineered from each handler's downstream behaviour (which fields it reads off `req.body`, what types it coerces them to, what DB column types they land in). Migration tooling cannot auto-generate validators from absent specs; a human re-derivation pass per endpoint is required. With 353 endpoints, this is a multi-week task that will be done after the port and patched in over time, leaving a window during which the C# server has no input validation either.

### Recommendation (no code change)

1. Establish a project-wide policy: every write endpoint MUST validate `req.body` with a Zod schema (or equivalent) before any business logic. Read endpoints MUST validate `req.params` and `req.query`.
2. **Phase 1 cleanup** (separate PR): define schemas in `@workspace/api-types` (or per-route file when domain-local) for all ~46 currently unvalidated route files; add `safeParse` at the top of each handler. The `bookings.ts` pattern (`GetBookingParams` / `CreateBookingBody` / etc., parsed via `safeParse`, with `400 BAD_REQUEST` on failure) is the project's chosen exemplar — extend it.
3. **Phase 2 contract**: the resulting Zod schemas double as the source of truth for OpenAPI generation and for FluentValidation port — preserve them through the migration.

### Carrier

`_schema/api-endpoints/contract.md` C3 row [d] graduates here. `_schema/api-endpoints/booking.md` is the **positive exemplar** (Sample S1 explicitly documents the `ListBookingsQueryParams.safeParse(req.query)` pattern). Per-domain Zod-coverage cell to be added to each domain doc as it is written (T002.2.b–.j).

---

## CF-018 — IDOR-class authorization-scope omission on nested resource handlers

| Field | Value |
|---|---|
| **Severity** | 🟡 P1 |
| **Scope** | Security · Authorization · Multi-tenant data isolation |
| **Status** | OPEN |
| **Discovery** | T002.2.a Spot-Check C3 incidental I3 (initially "single-domain memo") escalated to T002.1.8 (R-REPO-5) after cross-domain audit found 6 additional vulnerable sites in 2 other route files. |

### Evidence

**Pattern**: handlers mounted at `:parentId/.../:subId` that mutate `subId`-class rows but omit `parentId` from the WHERE clause. An authenticated caller can mutate any sub-resource by guessing its ID, regardless of which parent it logically belongs to.

**Universe** — `rg 'router\.(put|patch|delete)\("[^"]*/:[a-zA-Z_]+/[^"]*/:[a-zA-Z_]+' artifacts/api-server/src/routes/`: **17** nested-write handlers across **7** route files.

**Per-handler audit**:

| File:Line | Method · Path | WHERE on mutating SQL | Verdict |
|---|---|---|---|
| `contracts.ts:589` | PATCH `/v1/contracts/:id/line-items/:lineId` | `eq(id, lineId)` (`:605`) | ❌ vulnerable |
| `contracts.ts:610` | DELETE `/v1/contracts/:id/line-items/:lineId` | `eq(id, lineId)` (`:612`) | ❌ vulnerable |
| `bookings.ts:572` | DELETE `/v1/bookings/:id/services/:svcId` | `eq(id, svcId)` (`:574`) | ❌ vulnerable |
| `bookings.ts:728` | PATCH `/v1/bookings/:id/documents/:doc_id/verify` | `eq(id, docId)` (`:730`) | ❌ vulnerable |
| `bookings.ts:735` | PATCH `/v1/bookings/:id/documents/:doc_id/reject` | `eq(id, docId)` (`:739`) | ❌ vulnerable |
| `space-images.ts:129` | PUT `/v1/spaces/:id/images/:imageId` | `eq(id, imageId)` (`:139`) | ❌ vulnerable |
| `space-images.ts:162` | DELETE `/v1/spaces/:id/images/:imageId` | `eq(id, imageId)` (`:172`) | ❌ vulnerable |
| `space-images.ts:146` | PATCH `/v1/spaces/:id/images/:imageId/set-primary` | clear-step `eq(space_id, spaceId)` ✅ but the set-primary update uses `eq(id, imageId)` only | ⚠️ partial |
| `bookings.ts:580` | PATCH `/v1/bookings/:id/services/:svcId` | pre-check select uses `and(...id, ...booking_id)` ✅ then naked update `eq(id, svcId)` | ⚠️ partial (TOCTOU) |
| `service-host-portal.ts:461` | DELETE `/v1/service-host/jobs/:id/photos/:photoId` | pre-check select uses `and(...id, ...booking_service_id)` ✅ then naked delete `eq(id, photoId)` | ⚠️ partial (TOCTOU) |
| `spaces.ts:407` | PUT `/v1/spaces/:id/services/:mapId` | `and(eq(id, mapId), eq(space_id, spaceId))` | ✅ safe |
| `spaces.ts:439` | DELETE same | `and(eq(id, mapId), eq(space_id, spaceId))` | ✅ safe |
| `product-catalog.ts:229` | PUT `/v1/accommodations/:id/services/:mapId` | `and(eq(id, mapId), eq(accommodation_id, accId))` | ✅ safe |
| `product-catalog.ts:252` | DELETE same | `and(...)` | ✅ safe |
| `contracts.ts:510` | PATCH `/v1/contracts/:id/payment-schedule/:schedId` | `and(eq(id, schedId), eq(contract_id, contractId))` | ✅ safe |
| `contracts.ts:533` | DELETE same | `and(...)` | ✅ safe |
| `bookings.ts` (hypothetical extras) | — | n/a | n/a |

**Tally**: **7 outright vulnerable + 3 partial / TOCTOU-weak + 7 safe** out of 17 nested-write handlers. Of the 7 audited route files, the failure is concentrated in **3 files** (`contracts.ts`, `bookings.ts`, `space-images.ts`). The 7 safe sites prove the pattern is **known** in the codebase — its inconsistent application is the failure, not a missing primitive.

### Reproduction

`PATCH /v1/contracts/:id/line-items/:lineId`:
1. Authenticate as any user that passes the global `requireAuth` (no role check on this route).
2. Issue `PATCH /v1/contracts/999999/line-items/<arbitrary lineId of another contract>` with a body changing `unit_price`.
3. The `:id=999999` is parsed in JS but never used in the WHERE clause — the line item belonging to a different contract is mutated. The `logAction` call (when present; this handler omits it — see CF-008) would log the wrong `entity_id`.

`DELETE /v1/space-images/:id/images/:imageId`:
1. Authenticate as a space owner with at least one image of their own.
2. Issue `DELETE /v1/spaces/<your spaceId>/images/<some other space's imageId>`.
3. The pre-check `db.select().from(spaceImagesTable).where(eq(id, imageId))` returns the *other* space's image; the subsequent `db.delete().where(eq(id, imageId))` removes it.
4. Cloudinary delete in the same handler also fires against the other tenant's image URL.

### Severity rationale (not P0)

All flagged routes sit behind the global `requireAuth` middleware (no anonymous IDOR). The vulnerability is **authenticated horizontal privilege escalation**: any logged-in caller within the route's auth-class can mutate sub-resources of any parent in the same class. This maps to OWASP-A01 "Broken Access Control" → CWE-639 ("Authorization Bypass Through User-Controlled Key"). P1 fits; P0 would require anonymous reach.

Note: when the route's auth-class is a customer-facing one (e.g. a guest portal where any registered guest can call), this becomes a multi-tenant data leak. The `service-host-portal.ts:461` partial site is exactly that risk class (multiple service hosts on the same shared route).

### Recommendation (no code change)

1. **Repo-wide convention**: every nested-resource WHERE clause MUST include the parent ID. Add a CI grep to fail PRs that match `db\.(update|delete)\(.+\)\.where\(eq\(.+Id\)\)` on routes that contain `/:id/[^"]*/:[a-zA-Z_]+`.
2. **Defense-in-depth**: even when an explicit pre-check select with parent ID exists, the subsequent mutation should also include the parent in its WHERE — pre-check + mutation are two separate SQL statements and a TOCTOU race is theoretically possible. Eliminate the `⚠️ partial` rows, not just the `❌ vulnerable` ones.
3. **Phase 2**: in EF Core, define `Parent.HasMany(Subs)` and route every sub-resource mutation through the parent navigation property (`parent.Subs.Single(s => s.Id == subId)`). The framework enforces the join.

### Carrier

`_schema/api-endpoints/contract.md` C3 row [bonus e] is the original surface; this CF is its cross-domain extension. Each remaining `T002.2.x` domain doc must add a row to its own self-check table for the nested-write handlers it owns and link back here. When all 9 domain docs are complete (`T002.2.a–.i`), the universe count of 17 nested-write handlers should be re-verified end-to-end.

---

## CF-019 — Write-orphan columns on `invoices`: `stripe_payment_intent_id` + `stripe_checkout_url`

| Field | Value |
|---|---|
| **Severity** | 🟡 P1 |
| **Scope** | Finance · Reconciliation · Schema-vs-code drift |
| **Status** | OPEN |
| **Discovery** | T002.2.b half-2 Spot-Check C3-8 (R-REPO-5 incidental J2). CF-018 was already taken by IDOR (T002.1.8), so this NEW finding lands at the next free slot, **CF-019**. |

### Evidence

`lib/db/src/schema/invoices.ts:15-16` declares two Stripe-linkage columns:

```ts
stripe_payment_intent_id: text("stripe_payment_intent_id"),
stripe_checkout_url:      text("stripe_checkout_url"),
```

Repo-wide writer scan: `rg -n "stripe_payment_intent_id|stripe_checkout_url" artifacts/api-server/src/routes/` returns hits in **read positions only**. There are zero `db.insert(invoicesTable).values({ … stripe_payment_intent_id … })` and zero `db.update(invoicesTable).set({ … stripe_payment_intent_id … })` call sites.

The Stripe payment-intent id **is** captured at webhook time, but only into `system_logs.new_value` JSON. `artifacts/api-server/src/routes/stripe.ts:55-72` (`payment_intent.succeeded` branch):

```ts
await db.update(invoicesTable)
  .set({ status: "Paid", paid_at: new Date(), updated_at: new Date() })   // ← the Stripe PI id is NOT written here
  .where(eq(invoicesTable.id, Number(invoiceId)));

await logAction({
  action: "PAYMENT",
  newValue: { stripe_payment_intent_id: pi.id, … },                       // ← written into system_logs JSON only
});
```

Symmetric finding for `stripe_checkout_url`: `guest-portal.ts` (the only file that creates a Stripe Checkout Session for invoice payment, around `:885`) does not write the resulting `session.url` back to `invoices.stripe_checkout_url` either. The session URL is returned in the HTTP response and lost as soon as the guest closes the page.

### Reproduction

1. Guest pays invoice #N via Stripe → `payment_intent.succeeded` → `invoices.status = "Paid"`, `paid_at` set.
2. Query: `SELECT id, status, paid_at, stripe_payment_intent_id FROM invoices WHERE id = N`. Result: status=Paid, paid_at populated, **stripe_payment_intent_id = NULL**.
3. To reconcile this invoice against Stripe (e.g. for a chargeback investigation, refund, or dispute response), the operator must full-text grep `system_logs.new_value::text` for the invoice id and parse out the PI id by hand. There is no SQL JOIN path from `invoices` to the originating Stripe charge.

Same for `stripe_checkout_url`: there is no record of which Checkout Session the guest used, so a guest who closes the browser after payment cannot be re-sent the receipt URL.

### Why P1 (not P2)

This is a **schema-vs-code drift** with reconciliation impact:
1. The columns exist — implying the original author intended to write them. Today they are dead capacity, but the *expectation* of their presence may already be baked into downstream consumers (Phase 2 .NET port, BI tooling, finance reconciliation queries).
2. **Reconciliation gap**: the only authoritative join from invoice → Stripe charge is via `system_logs.new_value` JSON. This is unindexed, untyped, and conflates with every other "PAYMENT" log entry in the table.
3. CF-010 (Stripe webhook coverage gaps) and CF-019 (write-orphan PI id) **compound**: even the events that *are* handled produce no permanent invoice-side linkage to Stripe.

### Recommendation (no code change)

1. **Stripe webhook handler** (`stripe.ts:55-60`): extend the `db.update(invoicesTable).set({...})` to include `stripe_payment_intent_id: pi.id` and `stripe_checkout_url: pi.latest_charge?.receipt_url ?? row.stripe_checkout_url`.
2. **Guest portal Checkout Session creator** (`guest-portal.ts` ~`:885`): on `stripe.checkout.sessions.create()` success, immediately `db.update(invoicesTable).set({ stripe_checkout_url: session.url, … }).where(eq(id, invoiceId))`.
3. Add a NOT NULL constraint to `stripe_payment_intent_id` for any row in `invoices.status = 'Paid'` going forward (SQL CHECK constraint or application-level invariant).

### Phase 2 impact

A C# port that respects the schema as a contract will allocate fields for both columns and likely fail integration tests when they come back NULL on Paid invoices. The current behaviour (drop the values, keep them in `system_logs` JSON) is non-obvious and will be lost in translation.

### Carrier

`finance-payments.md` §3 row C3-8 (originating site) and §6 R-REPO-5 J2 (escalation rationale). `finance-invoicing.md` E8 (Stripe transition consumer side — the open question that this CF closes on the schema-drift axis). When the guest portal domain doc is written (`T002.2.f portal-guest.md`), the `:885` Checkout Session site must add a row to its self-check table re-verifying the write-orphan finding.

---
*End of CRITICAL_FINDINGS.md*
