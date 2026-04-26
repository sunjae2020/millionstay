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

  const generated = await generateContractInvoicesAndSchedules(id);   // ← step 2 (multiple INSERTs)

  if (row.booking_id) {
    await db.update(bookingsTable)                              // ← step 3
      .set({ booking_status: "Active" })
      .where(eq(bookingsTable.id, row.booking_id));
  }

  await logAction({ /* ... */ });                               // ← step 4 (writes system_logs)
  // …
});
```

Insert-call density elsewhere on the same kind of code path:
- `bookings.ts`: 6 distinct `db.insert(...)` calls (booking confirm, terms generation, line items, …).
- `contracts.ts`: 8 distinct `db.insert(...)` calls.
- `invoices.ts`: 1 `db.insert(...)`.

### Reproduction

If `generateContractInvoicesAndSchedules` partially fails (e.g. NETWORK error after the 2nd of 4 invoice INSERTs), the contract is already `"Active"` and the booking has not yet been promoted. Re-running the activation handler will (a) succeed because no idempotency check exists, (b) generate **duplicate** invoices for the periods that did succeed.

For booking confirmation (`bookings.ts:393-461`) the same risk applies — contract write succeeds, line-items write fails, contract sits in DB referencing missing line items.

### Recommendation (no code change)

Wrap every multi-write handler in `db.transaction(async (tx) => { … })` and pass `tx` to helpers like `generateContractInvoicesAndSchedules`. Compensating logic (idempotency keys, retry windows) is a Phase 2 enhancement; the immediate need is atomicity.

### Phase 2 impact

A C# port using EF Core `IDbContextTransaction` makes this trivial; a port that mirrors today's fire-and-forget pattern reproduces the bug.

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
| CF-009 | 🟡 P1 | products / product_catalog dead tables | OPEN |
| CF-010 | 🟡 P1 | Stripe webhook ignores payment_failed / refunded *(promoted from P2)* | OPEN |
| CF-011 | 🟢 P2 | Contract ref by row-count (race) | OPEN |
| CF-012 | 🟢 P2 | space_blocked_dates vs space_availability overlap | OPEN |
| CF-013 | 🟡 P1 | Date / time-zone storage inconsistent + free-text dates | OPEN |
| CF-014 | 🟡 P1 | Multi-step mutations not in transactions | OPEN |
| CF-015 | 🟡 P1 | Soft-delete vs hard-delete inconsistent | OPEN |

**Counts after T001.5 follow-up**: P0=3, P1=10, P2=2 (total 15). All financial- and data-integrity-class findings are now P1+.

---
*End of CRITICAL_FINDINGS.md*
