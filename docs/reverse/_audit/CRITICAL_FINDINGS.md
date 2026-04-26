# CRITICAL FINDINGS — MillionStay Codebase

> **Source**: T001 RECON (`docs/reverse/_audit/T001_RECON_REPORT.md`).
> **Format**: One row per finding. Each finding has a stable ID (`CF-NNN`) and **status**. Severity follows `🔴 P0` (must fix before production), `🟡 P1` (must fix before scale), `🟢 P2` (technical debt). Evidence is direct code quotation (≤ 5 lines per finding) with `path:line`.
> **Discipline**: This file records facts and recommendations. **No code changes are made by this document** — fixes are tracked through the `Status` field.
> **Last updated**: 2026-04-26 (T001.5).

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

## CF-006 — Two contradictory weekly→monthly conversion formulas in the same file

| Field | Value |
|---|---|
| **Severity** | 🟡 P1 |
| **Scope** | Finance · Reporting |
| **Status** | OPEN |

### Evidence

`artifacts/api-server/src/routes/owner-portal.ts:83`:
```ts
.reduce((sum, b) => sum + parseFloat(b.agreed_weekly_rate ?? "0") * 4, 0);
```

`artifacts/api-server/src/routes/owner-portal.ts:236`:
```ts
const monthlyRent = (c.weekly_rate ?? 0) * 52 / 12;
```

### Reproduction

Within `owner-portal.ts`:
- The dashboard "rent under management" sum (line 83) treats one month as **4 weeks**.
- The contract-detail "monthlyRent" (line 236) treats one month as **52 ÷ 12 ≈ 4.333 weeks**.

For a `$500 / week` property the two figures are `$2,000` and `$2,166.67` respectively — a 8.3% delta. Owners will see one number on the dashboard and a different number on the contract detail page.

### Recommendation (no code change)

Consolidate into a single helper (`weeklyToMonthly(weekly: Decimal): Decimal`) and pick one formula by policy. The `52/12` form matches Australian rental industry practice and is also used in `bookings.ts:485` and `contracts.ts:94`, so it is the de-facto standard inside the codebase.

### Phase 2 impact

Reports, settlement statements, and any owner-facing summary are exposed.

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

---

## CF-009 — Three product-shaped tables; two are dead schema

| Field | Value |
|---|---|
| **Severity** | 🟡 P1 |
| **Scope** | Schema clarity · Migration |
| **Status** | OPEN |

### Evidence

`lib/db/src/schema/index.ts:14-15` exports `products` and `product_catalog`. `lib/db/src/schema/accommodation_catalog.ts` defines a third table.

```
$ rg "productsTable|productCatalogTable" artifacts/api-server/src/routes/  → 0 matches
$ rg "accommodationCatalogTable"        artifacts/api-server/src/routes/  → 6 files
```

The route layer references `accommodationCatalogTable` from `lookup.ts`, `product-catalog.ts`, `public.ts`, `contracts.ts`, `bookings.ts`, `promotions.ts`. Neither `productsTable` nor `productCatalogTable` is imported by any route.

`contractProductsTable` (also exported by `products.ts`) **is** used — by `beneficiaries.ts`, `bookings.ts`, `contracts.ts`, `products.ts` (the route).

### Reproduction

Drop `products` and `product_catalog` tables from the database and observe that no route handler regresses.

### Recommendation (no code change)

Plan a deprecation: announce, run a single migration to drop both tables, and remove the schema files. Until then, mark the schema files with a top-of-file comment so future readers understand they are inactive.

### Phase 2 impact

A C# port that auto-generates entities from schema would create three duplicate `Product`-like entities, polluting the model.

---

## CF-010 — Stripe webhook ignores `payment_failed` and `charge.refunded` for invoice state

| Field | Value |
|---|---|
| **Severity** | 🟢 P2 |
| **Scope** | Finance · Reconciliation |
| **Status** | OPEN |

### Evidence

`artifacts/api-server/src/routes/stripe.ts:51-100` (range scanned in T001 §d.3) handles three event types:
- `payment_intent.succeeded` → updates `invoices.status = "Paid"`, sets `paid_at`.
- `payment_intent.payment_failed` → writes audit log only. **Invoice state unchanged.**
- `charge.refunded` → writes audit log only. **No invoice column for refund state.**

### Reproduction

A guest pays an invoice; payment fails; invoice still appears as `Sent` (or `Draft`). A refund fires; invoice still appears as `Paid`.

### Recommendation (no code change)

Add invoice columns (`failure_reason`, `refunded_at`, `refunded_amount`) and route the failure / refund events into the invoice state machine.

### Phase 2 impact

Reconciliation reports cannot distinguish "paid then refunded" from "paid clean" without joining `system_logs`.

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
| CF-009 | 🟡 P1 | products / product_catalog dead tables | OPEN |
| CF-010 | 🟢 P2 | Stripe webhook ignores payment_failed / refunded | OPEN |
| CF-011 | 🟢 P2 | Contract ref by row-count (race) | OPEN |
| CF-012 | 🟢 P2 | space_blocked_dates vs space_availability overlap | OPEN |

**P0 count**: 3 — all financial / data-integrity. Should be addressed before any production go-live or large-scale data migration.

---
*End of CRITICAL_FINDINGS.md*
