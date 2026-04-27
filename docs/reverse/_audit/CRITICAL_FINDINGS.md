# CRITICAL FINDINGS — MillionStay Codebase

> **Source**: T001 RECON (`docs/reverse/_audit/T001_RECON_REPORT.md`).
> **Format**: One row per finding. Each finding has a stable ID (`CF-NNN`) and **status**. Severity follows `🔴 P0` (must fix before production), `🟡 P1` (must fix before scale), `🟢 P2` (technical debt). Evidence is direct code quotation (≤ 5 lines per finding) with `path:line`.
> **Discipline**: This file records facts and recommendations. **No code changes are made by this document** — fixes are tracked through the `Status` field.
> **Last updated**: 2026-04-27 (T002.2.i — `admin.md` 10 files / 37 ep [Tier A 1 unauth-by-mount-order = `dev-migration.ts`; Tier B 6 unauth-login = `auth.ts` 1-6; Tier B′ 1 per-handler `requireAuth` = `auth.ts:357`/me; Tier C 4 file-internal `requireAuth` = `admin-users.ts`; Tier D 25 globally-guarded; Tier D′ 3 router-level `requireSuperAdmin` = `db-sync.ts`; Tier D″ 2 per-handler inline SuperAdmin = admin-users bulk-delete + permanent-delete]: **🔴 CF-004 ESCALATION P1 → P0** — `dev-migration.ts:14-79` body now confirmed = TRUNCATE 39 production tables RESTART IDENTITY CASCADE + SAVEPOINT-per-statement seed-replay; protected only by hard-coded shared secret `MIGRATION_SECRET = "MS_MIGRATE_2026_PROD"` at `dev-migration.ts:10` (literal string committed to source) + mount-order at `app.ts:157` < `:167 requireAuth` (no `NODE_ENV !== "production"` gate) → publicly callable in production with a single header-set `POST /api/v1/admin/run-migration` to erase all business data; R-REPO-7 trade-off (가) chosen — dual root cause (mount-order + hard-coded secret) consolidated into CF-004 evidence body, no separate CF-025 promotion. **CF-008 admin row CLOSURE** — 0 of 10 admin route files contain `logAction` calls (= 0/37 = 0% coverage; admin joins ops-property/ops-catalog/ops-crm/portal-partner/public for a **6-way TIE at the absolute floor**); inverse-correlation hypothesis CONFIRMED with **reversal twist** — admin (the domain that consumes audit data via `system-logs.ts:7 GET /v1/system-logs`) is itself audit-blind for its own 18-20 mutators; matrix completed with admin row = inverse correlation policy validated. **CF-014 POSITIVE EXEMPLAR co-promotion #2** — `dev-migration.ts:38-66` is a textbook SAVEPOINT-per-statement Tx pattern (TRUNCATE + per-row INSERT under sub-savepoints that tolerate partial failure) — 3rd known production Tx site project-wide (after `seedSync.ts:214` and `service-host-portal.ts:365-393`), now co-listed with the SHP and `blog-posts.ts` exemplars. **CF-018 SUB-PATTERN B EXPANSION** (R-REPO-7 (c) self-correction triggered by Step 4 spot-check C3) — vertical-privilege-escalation: `requireSuperAdmin` enforcement uses **two parallel patterns** repo-wide: (i) router-level once at `db-sync.ts:30`, (ii) **per-handler inline** `if (currentUser?.role !== "SuperAdmin") return 403` 10 times across 6 files spanning admin (`admin-users.ts:94/:135`), ops-catalog (`service-catalog.ts:75/:98`), ops-crm (`tasks.ts:139/:161`), ops-property (`spaces.ts:189/:216`), finance-payments (`beneficiaries.ts:97/:119`) and portal-guest (`cs-tickets.ts:178/:199`); fragile by-construction, missed by T002.2.b–.g enumeration, recovered by T002.2.i project-wide spot-check; CF-018 evidence body adds Sub-pattern B section. **CF-022 admin row** — `admin-users.ts:62-64` status whitelist `["active","pending","rejected"]` is unguarded (`pending → rejected → active` arbitrary transition allowed); 1 ungated transition added (totals 5 gated + 5 ungated = 10 transitions across 5 files). **CF-013** +4 carriers (admin-users `deleted_at: new Date()` ×2 + integrations `updated_at: new Date()` ×2). **CF-015** +3 carriers (admin-users hard-delete branches + email-templates DELETE) + 1 POSITIVE (AU3/AU4 self-id filter at `admin-users.ts:101`/`:127`). **CF-017** +2 carriers (email-templates 2 of 6 = 33%) + B5/ET5 confirmed 2nd "afterthought endpoint" anti-pattern. **CF-024** +6 unauthenticated mutation carriers (auth.ts 6 sites). Inconsistencies memo: (i) `process.env` mutation precedes DB UPSERT at `integrations.ts:211-227` = transient inconsistency window; (ii) `system_log` table = producer-consumer split (admin reads, contract writes, all others 0% rate) = T002.4 erd-core annotation. **1 NEW CF promotion** (CF-004 P0 — escalation): counts P0=3→**4** / P1=18 / P2=3 = **25**.
> **Last updated**: 2026-04-27 (T002.2.j — `booking.md` close-out 11 of 11 endpoint domain files closed; 27 ep / 759 lines source / `bookings.ts`; 22 stub completion + 189-cell self-check + 10-domain cross-ref matrix; **🔴 CF-018 SUB-PATTERN B RETROACTIVE CORRECTION** — T002.2.i seed `11 sites in 6 files` corrected at T002.2.j Step 1 multi-pattern verification to **55 sites in 28 files** (54 inline `!== "SuperAdmin"` × 27 files × 2 + 1 router-level `db-sync.ts:30`); all 27 inline-check files use exact-string `"SuperAdmin"` literal while db-sync.ts uses 4-variant Set ⇒ **NEW SUB-FINDING role-string normalisation drift** (db-sync.ts:16 `SUPER_ADMIN_ROLES = {"Super Admin","SuperAdmin","superadmin","super_admin"}` 4-variant case-insensitive normalisation vs 27 inline files exact `"SuperAdmin"` literal; user with `role = "super_admin"` passes db-sync helper but is denied by all 54 inline sites — Phase 2 prescription: extract single `requireSuperAdmin` middleware applied via `router.use` at file scope on all 28 files, retire 54 inline duplications); T002.2.b–.i blind-spot map embedded at booking.md §6.C (.b half-1 +2 invoices.ts; .c +8 ops-property; .d +6 ops-catalog; .e +14 ops-crm with .e capturing 4 of 7; .h +2 blog-posts.ts; .i +2 email-templates.ts) reconciled in this sub-task. **CF-008** booking row added = 7/27 = 26% (logAction coverage: S3 + S4 + T1-T5 only; all 7 documents/services mutators silent ⇒ booking domain audit gap centred on `booking_services`/`booking_documents` tables; booking ranks 4th from top of all 11 endpoint domains, no longer at floor — admin/ops-property/ops-catalog/ops-crm/portal-partner/public hold 0% absolute floor with 6-way TIE). **CF-022** booking row = 9/9 ✅ state-transition coverage (S2 confirm + S4 submit + T1 reject + T2 check-in + T3 check-out + T4 cancel + T5 extend + T6 doc-verify + T7 doc-reject) — **booking is cross-pack leader** for state-machine discipline (totals across 11 domains: 14 gated + 5 ungated = 19 transitions). **CF-018 booking row** = 14 mutator endpoints audited: ✅ POSITIVE 2 (N2 PATCH service + R6 GET service photos with compound `WHERE id=svcId AND booking_id=bookingId`) / ⚠️ admin-scope-only 8 / 🔴 BAD 3 (T6 PATCH document/verify `:728`, T7 PATCH document/reject `:735`, N1 DELETE service `:572` — all 3 use WHERE on `id`/`svcId` only, ignoring URL `:id` booking_id param entirely; **N2 vs N1 same-prefix inconsistency in same file** = canonical "author knew the safe pattern but didn't apply it consistently" anti-pattern) / SuperAdmin-gated 2 (W2 bulk-delete + W3 DELETE permanent at Sub-pattern B sites). **CF-017 booking row** = 12/27 = 44% Zod safeParse coverage (well above ~12% repo baseline; weakest spot = document handlers' raw `Number(req.params.doc_id)`). **CF-014** +5 carriers (W2 bulk-delete N-row UPDATE/DELETE no tx + W1 PUT checkOverbooking + UPDATE no tx + T4 cancel N×DELETE on space_blocked_dates + UPDATE + logAction no tx + T5 extend unblock-then-block N×2 round-trips no tx + ALL 7 state-transitions `SELECT-then-UPDATE-then-logAction` no tx). **CF-013** +1 carrier (T1/T4 `cancelled_at: new Date()` written into `bookings.cancelled_at` — verify `timestamptz` vs `timestamp` in T002.4). **CF-011 sibling** booking domain has `generateBookingRef()` at `:60-69` row-count race (sibling of `generateContractRef`/`nextInvoiceRef` already enumerated; T002.2.b.fix-1 deferred mini-task can absorb this site). **CF-021** booking row = `buildBookingResponse` helper at `:36-58` performs 4 sequential SELECTs per row (account + contact + space + property) called by 8 of 27 endpoints; today/arrivals + today/departures + listing all triggers full N+1 fan-out. **R-REPO-7 (c) trade-off recorded permanently** at booking.md §7 — (가) atomic carrier absorption chosen over (나) separate `T002.2.i.fix-2` mini-task + (다) inline scattered correction; (가) reasoning = T002.2.j is the natural close-out carrier for cross-pack CF reconciliation, single-shot mechanical correction. R-REPO-5 self-check: 0 new incidentals beyond the §6.B role-normalisation drift sub-finding which is absorbed under CF-018 expansion. **0 NEW CF promotion** in T002.2.j (CF-018 Sub-pattern B is expansion, not new): counts P0=**4** / P1=**18** / P2=**3** = **25** unchanged. **T002.2 endpoint sub-task COMPLETE — 11 of 11 endpoint domain files closed** (booking + contract + finance-invoicing + finance-payments + ops-property + ops-catalog + ops-crm + portal-guest + portal-partner + public + admin); next sub-task = T002.3 db-schema-overview. Earlier history follows:
> 2026-04-27 (T002.2.h — `public.md` 6 files / 33 ep [public 10 + privacy 2 + health 2 OPEN; lookup 10 + blog-posts 6 + page-contents 3 PROTECTED]: **NEW CF-024 P1 promoted** — Project-wide rate limiting absence (0 hits across `artifacts/api-server/src/` + `lib/`; 9 unauthenticated mutation entry points DDoS-amplifiable, including 3 lead-INSERT applications POSTs); **CF-023 cross-domain verification CLOSED** at this sub-task (9 domains audited; helper `insertLeadWithGeneratedRef` confirmed safe → leads.ts:175-204 sole outlier per option (가)); **CF-017 POSITIVE EXEMPLAR co-promotion** — `blog-posts.ts` 5/6 = 83% safeParse coverage with double-validate B4 (IdParams + UpdateBlogPostBody), B5 bulk-delete the sole gap; **CF-008 new lowest absolute floor** = 0/33 = 0% (3 unauthenticated POSTs create leads with zero audit trail — operationally invisible inbound funnel); CF-001 +5 read-side carriers (services base_price + 4 lookup `real` columns); CF-013 +3 (insertLead writes via `new Date()`); CF-014 +5 (3 applications + bulk-delete + page-contents upsert); CF-015 +1 POSITIVE (SuperAdmin role gate on permanent delete); CF-021 +1 helper-internal carrier (generateLeadRef full-table SELECT). Inconsistencies memo: healthRouter double-mount (app.ts:150 + routes/index.ts:41 dead). **1 NEW CF promoted (CF-024 P1)**: counts P0=3 / P1=**18** / P2=3 = **24**. Earlier history follows:
> 2026-04-26 (T002.2.e — ops-crm anchors: **NEW CF-022 P1 promoted** — state-transition guard inconsistency, 9 transition handlers across 4 files = 5 gated + 4 ungated, same-file inconsistency in `work-orders.ts` 2-of-4 + `leads.ts` 1-of-2; CF-001 +2 carrier columns (`work_orders.cost`, `promotions.discount_percentage`); CF-008 ops-crm row 0/51 = 0% **TIED LOWEST** with ops-catalog; CF-013 +6 no-tz anchors → 27; CF-015 NEW sentinel-via-status sub-pattern at `service-hosts.ts`; CF-019.a CANDIDATE row 3 status note updated (`service_catalog.promotion_id` write-site cross-check from ops-crm domain = 0 hits; CANDIDATE retained pending T002.3); CF-020.a +8 GET-leak anchors → 26 / .b +15 zombie-revival anchors → 20 (split formalized); CF-021 +3 N+1 anchors → 13. **1 NEW CF promoted (CF-022 P1)**: counts P0=3 / P1=**16** / P2=3 = **22**).

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

### Source-side anchor (T002.2.c addition)

`spaces.base_weekly_price` and `spaces.base_daily_price` (`lib/db/src/schema/spaces.ts:13-14`) are the **upstream origin** of the rent figure for the entire booking → contract → invoice pipeline. Both are `real`. This means the rent flow has **two precision-loss boundaries** (revising CF-002 from "1 boundary" to "2 boundaries"):

```
spaces.base_weekly_price (real ⚠️)  ──► bookings.weekly_rate (numeric ✅)  ──► contracts.weekly_rate (real ⚠️)
        space → booking write                                    booking → contract write
        = boundary #1 (CF-002 source side, NEW)                  = boundary #2 (CF-002 receiving side, original)
```

`ops-property.md` §1.4 carries the full data-flow diagram. Phase 2 migration carrier (CF-001 sub-list) is therefore extended: `spaces.base_weekly_price`, `spaces.base_daily_price`, `spaces.floor_area_sqm` join the `commissions` + `beneficiaries` migration candidates as **the upstream-most carriers** — they must migrate before any downstream carrier or both boundaries continue to leak precision. Cross-domain `service_catalog.base_price` + `space_service_catalog.custom_price` (read by `ops-property.md` SP10 / written by SP11) are also `real` carriers visible from this domain but live in `ops-catalog` schema (T002.2.d will own those anchors).

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
| **ops-property** | **30** | **4** | **13.3%** | T002.2.c |
| **ops-catalog** | **39** | **0** | **0.0%** ⬅ **NEW LOWEST** | T002.2.d |
| ops-crm | TBD | TBD | TBD | pending T002.2.e |
| portal-guest | TBD | TBD | TBD | pending T002.2.f |
| portal-partner | TBD | TBD | TBD | pending T002.2.g |
| public | TBD | TBD | TBD | pending T002.2.h |
| admin | TBD | TBD | TBD | pending T002.2.i |

**Finance vs contract gap**: 20.0% (finance combined) vs 42.9% (contract) → finance domain is **53% under-audited** relative to contract. The gap is concentrated in the 4 lookup-style routes (`payment-info`, `commissions`, `beneficiaries`, `accounts`) where coverage is **0%**. The Stripe webhook (S2) is the lone audited mutator on the payments side; payment-info / commissions / beneficiaries / accounts mutate financial routing data **without any audit trail**.

**ops-property gap (T002.2.c addition)**: 13.3% — new domain low. The 4 audited mutators (`spaces.ts:301,327,398,451`) are all "side-effect on already-existing entity" (BLOCK / UNBLOCK availability + ADD_SERVICE / REMOVE_SERVICE). **None** of the CRUD-on-the-entity-itself (create/update/delete space, property, policy, option, image, suburb) is audited. Two compounding sub-patterns:

- **CF-008.a — destructive-action zero-audit** (sub-pattern, T002.2.c origin): the 11 hard-delete branches (`permanent=true`) across `spaces` × 2, `properties` × 2, `space-policies` × 2, `space-options` × 2, `space-images`, `suburbs` × 2 emit no `logAction` despite being the most destructive operations available; only the SuperAdmin role gate stands between any one admin and irreversible bulk wipe of the entire physical-asset graph. **Defer-confirm at T002.2.j (admin.md)** — likely additional anchors there.
- **CF-008.b — IDOR + Cloudinary-delete compound** (sub-pattern): `space-images.ts` SI5 DELETE (line 162) calls external `deleteFromCloudinary()` and is also IDOR-vulnerable (CF-018). Combined effect: any authenticated user can delete arbitrary Cloudinary assets across all spaces with **no audit trail**.

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

### Domain re-confirmation (T002.2.d — ops-catalog ground truth)

Direct verification at the start of `T002.2.d` (re-running the route-import scan) confirms the CF-009 finding is stable:

```
$ rg "productCatalogTable" artifacts/                  → 0 matches  (route + portals + lib outside schema/)
$ rg "from.*product_catalog\b" lib/                    → 1 match    (schema/index.ts re-export only)
$ rg "productCatalogTable\." lib/ artifacts/           → 0 matches  (column-level access)
```

**4 `real` money columns dead at the schema level** — `product_catalog.ts:8` (`price`), `:18` (`bond_amount`), `:19` (`admin_fee`), `:20` (`cleaning_fee`). All four are CF-001-class precision-lossy carriers but **read by zero code paths** → harm = 0 today, harm = full carrier propagation if any future code starts SELECTing the table. Carrier: [`api-endpoints/ops-catalog.md` §1.5](../_schema/api-endpoints/ops-catalog.md) walks the ghost lifecycle, lists the 4 columns 1:1 with schema lines, and presents the (a) DROP / (b) deprecate / (c) status-quo trade-off.

**Cross-domain ghost search**: `ops-catalog` is the natural owner of `product_catalog` because of name proximity. T002.2.d confirmed there is no *other* file that could have plausibly imported it (5 files audited; the 5 are the only ones in the ops-catalog domain that touch any "product" table). Recommendation #1 (DROP) becomes more defensible after this confirmation.

---

## CF-010 — Stripe payment lifecycle 와 invoice document lifecycle 분리 (🔄 T002.5 본문 재작성)

> **🔄 T002.5 재작성 (2026-04)**: T001.5 본문 "8 누락 transition" 가설은 Stripe webhook 이 `invoices.status` 를 직접 update 한다는 가정에 의존했으나, T002.5 ground truth 검증 (state-machines.md §4.4) 결과 stripe.ts:77/92 의 `stripe_status` 는 **별도 audit-only payload** 이며 (별도 컬럼이 존재하지 않고 `system_logs.new_value` JSON 안에만 기록) `invoices.status` 컬럼과 분리된 두 lifecycle. 본문 재작성. 이전 본문은 § Archive 보존.

| Field | Value |
|---|---|
| **Severity** | 🟡 P1 *(promoted from P2 in T001.5; 재작성 T002.5)* |
| **Scope** | Finance · Reconciliation · Accounting accuracy · State machine boundary |
| **Status** | OPEN |

### 재작성 evidence (T002.5 ground truth — state-machines.md §4)

invoices 테이블에는 두 분리된 status lifecycle 이 존재:

| Lifecycle | 컬럼 | Values | Write path |
|---|---|---|---|
| **Document** (invoice 발행/수금/보관) | `invoices.status` | Draft / Sent / Paid / Archived / Void (5) | `invoices.ts:146/160/172/124/139` admin + `stripe.ts:56` webhook (1 transition only: → Paid) |
| **Stripe payment** (audit-only) | (no column — JSON in `system_logs.new_value`) | succeeded / payment_failed / refunded / dispute.* / canceled | `stripe.ts:62/77/92` audit-row only — **invoices 테이블 update 없음** for failed/refunded |

**3 Stripe handled events** (stripe.ts:51-96):
- `payment_intent.succeeded` (`:56`) — **invoices.status="Paid"** ✅ + audit (유일하게 invoices update 하는 transition)
- `payment_intent.payment_failed` (`:77`) — **invoices.status 변경 없음** + audit only with `stripe_status="payment_failed"`
- `charge.refunded` (`:92`) — **invoices.status 변경 없음** + audit only with `stripe_status="refunded"` + `amount_refunded` silently dropped

**Silent-ignore events** (default branch): `payment_intent.canceled`, `charge.dispute.created`, `charge.dispute.closed`, `charge.failed`, `payment_intent.requires_action`.

**CF-019.a cross-anchor**: `invoices.stripe_payment_intent_id text` (`schema/invoices.ts:15`) 컬럼 정의 존재 + `rg "stripe_payment_intent_id" artifacts/api-server/` 결과 **write site 0** (audit log payload 의 `stripe_payment_intent` 다른 키명 만 등장) → storage orphan column. W1 handler 가 set 해야 하는 위치이나 누락.

### 영향

1. **회계 정확성**: `invoices.status="Paid"` 가 실제 받은 돈 의미하지 않음 (refund/dispute 후에도 Paid 유지). `dashboard.ts:72` `paidInvoices.reduce(sum + amount)` / agent commission settlement / owner statement (any join on `status="Paid"`) **revenue 과대계상**. `stripe_status` 를 `system_logs` JSON 에서 join 하지 않으면 net revenue 계산 불가.
2. **운영 추적 불가**: chargeback / dispute 발생 시 Stripe Dashboard 수동 조회 의존 — application 측 view 부재.
3. **State machine boundary 모호**: 5-state document lifecycle 과 Stripe payment lifecycle 의 분리 의도가 의도적 (audit-only) 인지 미완성 (handler 누락) 인지 코드만으로 판단 불가.
4. **Idempotency gap** (T002.2.b half-2 evidence): webhook handler `event.id` dedupe 부재 — Stripe at-least-once delivery 시 같은 succeeded 두 번 처리 → invoices 두 번 update + 두 번 audit row.

### Phase 2 권장 (R-REPO-7 옵션 영구 보존)

- **Option A**: invoices.status enum 확장 (Refunded / Disputed / PartiallyRefunded / Cancelled / ChargedBack) + W2/W3 handler `db.update(invoicesTable)` 추가 + 새 컬럼 (`refunded_amount numeric`, `failure_reason text`, `dispute_reason text`, `refunded_at timestamp`) → 단일 lifecycle 통합.
- **Option B (추천)**: 별도 entity `payment_events` 분리 (Stripe webhook 전용 테이블) — invoices 1:N payment_events. 의도적 분리 가시화 + at-least-once dedupe 테이블 가능 + W4/W5 handler 추가 시 schema 깔끔.
- **Option C (보조)**: invoice.status 변경 trigger (refund → Refunded auto) + chargeback handler 신설 + daily reconciliation cron (Stripe API page-through + DB assert).

### Phase 2 impact

C# 포팅 시 본 boundary 미명시 그대로면 EF Core 에 `PaymentEvent` entity 자동생성 부재 → reconciliation cron 도 함께 missing. Option B 채택 시 `PaymentEvent` 별도 DbSet + `Invoice.PaymentEvents` navigation property 신설.

### Archive — T001.5 원본 본문 (T002.5 재작성으로 superseded)

> 이하 T001.5 원본. "missed invoice state transitions" 표 (8 transition) 는 Phase 2 Option A desired-state 가설로 read; 현재 코드 ground truth 는 위 § 재작성 evidence.

| Field | Value |
|---|---|
| **Severity (archive)** | 🟡 P1 *(T001.5 promotion 그대로 유지)* |
| **Scope (archive)** | Finance · Reconciliation · Accounting accuracy |
| **Status (archive)** | superseded by T002.5 재작성 본문 위 |

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

### ops-property business-domain enumeration (T002.2.c addition)

Of the 21 no-tz `timestamp()` columns originally enumerated, the ops-property domain owns **5 of them** — all `deleted_at` columns:

| Table | File:line | Column | Type |
|---|---|---|---|
| `spaces` | `lib/db/src/schema/spaces.ts:29` | `deleted_at` | `timestamp("deleted_at")` (no `withTimezone`) |
| `properties` | `lib/db/src/schema/properties.ts:20` | `deleted_at` | same |
| `space_policies` | `lib/db/src/schema/space_policies.ts:15` | `deleted_at` | same |
| `space_options` | `lib/db/src/schema/space_options.ts:11` | `deleted_at` | same |
| `suburbs` | `lib/db/src/schema/suburbs.ts:15` | `deleted_at` | same |

In addition, ops-property surfaces **2 free-text date columns** (CF-013 secondary anchor — date stored as `text`, not `date`):

| Table | File:line | Column | Notes |
|---|---|---|---|
| `space_blocked_dates` | `lib/db/src/schema/spaces.ts:44` | `date: text("date").notNull()` | Read by `spaces.ts:228-278` GET availability with `Date` constructor — DST-ambiguous |
| `space_availability` | (cross-domain — owned by `bookings.ts` schema) | `date: text` | Written by `spaces.ts:280-330` block/unblock |

**Consistency observation**: `created_at` + `updated_at` use `withTimezone: true` consistently in this domain (5 of 5 main tables); the inconsistency is **strictly on `deleted_at`** — suggesting Drizzle authors copy-pasted a deletion-column template that omitted the modifier. This is the cleanest pattern of the CF-013 anchor population so far and **strengthens the case** that a single editor sweep would close the bulk of the gap project-wide.

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

### POSITIVE EXEMPLAR — `service-host-portal.ts:365-393` (T002.2.g promotion)

The 3rd of the 3 tx-using sites is the **only production runtime mutation handler** that uses `db.transaction(...)` correctly. T002.2.g (`portal-partner.md` E4 `POST /v1/service-host/jobs/:id/photos`) promotes this site from a raw count entry to a documented Phase 2 reference template:

| Pattern element | Code locus | Why exemplary |
|---|---|---|
| (i) **`SELECT ... FOR UPDATE` row lock** | `:367` | Serialises concurrent uploads on the same job row → enforces `MAX_JOB_PHOTOS` ceiling under concurrency |
| (ii) **Read-after-lock count check** | `:368-374` | Reads `existing.length` under lock so business-rule check is consistent with subsequent INSERTs |
| (iii) **Sentinel + throw for business-rule violation** | `:375-380` | Sets outer-scope `limitError` then `throw new Error("LIMIT")` → guarantees rollback + carries structured error to outer catch |
| (iv) **Atomic INSERT loop** | `:382-392` | All N photos either persist or none do |
| (v) **Cross-system compensating action** | `:394-402` outer catch | Cloudinary blobs uploaded outside tx (network call should not extend lock duration); rollback path knows to delete the orphan blobs via `deleteFromCloudinary(public_id)` |

**Why uploads are intentionally OUTSIDE the tx**: holding a row lock during a network upload would create a wide concurrency window. The author deliberately separated (a) idempotent-ish external system operation (Cloudinary) from (b) atomic DB writes (within tx) and accepted the cost of compensating cleanup on rollback.

**Anti-comparison** with the 8 untransacted multi-write handlers in finance (CF-014 §half-2) and the 11 in ops-property (`ops-property` loci section above) and the 3 in contract (T002.1.8 helper breakdown): every one of those would benefit from this exact pattern. The reusable shape is helper-extractable as approximately:

```ts
async function withRowLockAndLimit<R>(opts: {
  rowId: number, table: PgTable, currentColumn: string,
  cap: number, addCount: number, action: (tx: any, remaining: number) => Promise<R>
}): Promise<R> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM ${opts.table} WHERE id = ${opts.rowId} FOR UPDATE`);
    const remaining = opts.cap - (await currentCount(tx, opts));
    if (remaining < opts.addCount) throw new LimitError(opts.cap, opts.addCount, remaining);
    return opts.action(tx, remaining);
  });
}
```

**Limitation**: even this exemplar lacks `logAction` (CF-008 carrier — uploads are invisible to audit). Phase 2 should add `logAction("job_photo.uploaded", { job_id, count, partner_id })` after successful tx commit.

Carrier: see `portal-partner.md` E4 (full sample format) + §6 CF anchor matrix.

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

### ops-property loci (T002.2.c addition) — **anchor count 3 → 11**

8 additional multi-write handlers in this domain execute without `db.transaction`:

| Locus | File:line | Steps without tx | Failure mode |
|---|---|---|---|
| SP2 `POST /spaces` | `spaces.ts:106-125` | (i) insert space, (ii) bulk-insert option_maps | mid-failure → space exists with no options; retry creates duplicate space |
| SP4 `PUT /spaces/:id` | `spaces.ts:148-185` | (i) update space, (ii) delete all option_maps, (iii) bulk-insert option_maps | "delete-then-reinsert" without tx: crash mid-(iii) leaves space updated + options wiped (idempotency-by-destruction tell — author was aware of partial-failure risk) |
| SP5 `POST /spaces/bulk-delete?permanent` | `spaces.ts:187-205` | 3 sequential `db.delete` across `space_option_maps` + `space_blocked_dates` + `spaces` | crash mid-sequence leaves orphan rows in surviving children |
| SP6 `DELETE /spaces/:id?permanent` | `spaces.ts:207-226` | same 3-table sequence (single-row) | same orphan risk |
| SP8 `POST /spaces/:id/availability/block` | `spaces.ts:280-304` | N sequential INSERT-onConflictDoUpdate (one per date) | for 30-day block: 30 sequential round-trips, no atomicity; partial block possible |
| SP9 `POST /spaces/:id/availability/unblock` | `spaces.ts:306-330` | same loop pattern | mirror of SP8 |
| SI2 `POST /spaces/:id/images` | `space-images.ts:65-127` | per file: optional Cloudinary HTTP + optional UPDATE all-primary→false + INSERT row | **worst case**: N files × 3 ops, no tx; mid-loop crash leaves Cloudinary objects + DB rows out of sync |
| SI4 `PATCH /set-primary` | `space-images.ts:146-160` | (i) UPDATE all primary→false for spaceId, (ii) UPDATE imageId primary→true | crash between → no primary image |
| SI5 `DELETE /spaces/:id/images/:imageId` | `space-images.ts:162-187` | 4 ops (fetch + Cloudinary delete + DB delete + maybe-promote next) | irreversible Cloudinary deletion + DB partial state |
| SI6 `PATCH /reorder` | `space-images.ts:189-203` | N sequential UPDATE display_order | partial reorder on crash |

Total: **11 production loci** across 3 files (bookings.ts, contracts.ts, stripe.ts, spaces.ts, space-images.ts). The 8 ops-property loci are concentrated in 2 files (spaces.ts × 6, space-images.ts × 4 — image total includes SI2's per-file inner loop counted once). Carrier: see `ops-property.md` §3 C3-TX.

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

## CF-022 — State-transition guard inconsistency on PATCH/POST `/:id/<verb>` handlers

| Field | Value |
|---|---|
| **Severity** | 🟡 P1 |
| **Scope** | State machine integrity · Business rules · Audit reliability |
| **Discovery** | T002.2.e ops-crm sub-task (Step 4 spot-check C3). 4 ops-crm files (`work-orders.ts`, `leads.ts`, `tasks.ts`, `cs-tickets.ts`) define 9 explicit state-transition handlers (POST/PATCH `/:id/<verb>` or PUT with status change). 5 of 9 use precondition gates (`where(and(eq(id, ...), eq(status, "AllowedFromState")))`); 4 of 9 use only `where(eq(id, ...))`, accepting any source state. **Same-file inconsistency** in `work-orders.ts` (2 of 4 ungated) and `leads.ts` (1 of 2 ungated) demonstrates author oversight rather than intentional design — fix-able pattern. |

### Anchor table (9 transitions across 4 files)

| Handler | File:line | Precondition | Status | Failure mode if invalid transition is invoked |
|---|---|---|---|---|
| WO `/start` | `work-orders.ts:149-157` | `eq(status, "Open")` | ✅ gated | row count = 0 → 400 returned ✅ |
| WO `/review` | `work-orders.ts:159-167` | `eq(status, "InProgress")` | ✅ gated | ✅ |
| WO `/complete` | `work-orders.ts:169-185` | none | ❌ ungated | Cancelled/Archived work order accepts complete; `completed_at` + `cost` (real, CF-001) updated → matures into invoice line item with wrong status history |
| WO `/cancel` | `work-orders.ts:187-201` | none | ❌ ungated | Already-Completed order can be reverted to Cancelled silently; `completed_at` not cleared → state vs timestamp divergence |
| Lead `/convert` | `leads.ts:175-203` | explicit `if (lead.lead_status === "ConvertedToBooking") return 400` | ✅ gated (imperative-style) | ✅ — but **fake `booking_ref` generated without `db.insert(bookingsTable)`** (R-REPO-5 incidental from T002.2.e §5.C2) |
| Lead `/mark-lost` | `leads.ts:205-214` | none | ❌ ungated | A `ConvertedToBooking` lead can be overwritten to `Lost`, severing the booking trace |
| Task `/complete` | `tasks.ts:173-182` | none | ❌ ungated | Cancelled tasks accept `Done`; analytics for completed-task counts inflate |
| CS-ticket PUT (status) | `cs-tickets.ts:121-136` | `CS_STATUSES.includes(status)` whitelist only | ❌ ungated transition graph | Closed→Open→Closed cycles permitted; `closed_at` overwritten on each Closed entry |
| CS-ticket POST `/:id/messages` (auto-status) | `cs-tickets.ts:165-168` | `eq(status, "Open")` | ✅ gated (drive-by side effect) | ✅ — `is_internal=true` messages skip auto-transition (`L165`) |

**5 ✅ gated · 4 ❌ ungated · 9 total transition handlers.**

### Compound failure modes

1. **Audit invisibility (CF-008 compound)** — All 4 files have `logAction` count = 0 (CF-008 LOWEST tier). Invalid transitions leave no audit trail; only DB inspection reveals the divergence. Reconciliation requires SQL on `updated_at` deltas with no actor attribution.
2. **State vs timestamp divergence** — `completed_at` (set on /complete) and `closed_at` (set on PUT status="Closed") are written unconditionally; reverting status leaves the timestamp populated → row state and row history disagree silently.
3. **Real-money carrier (CF-001 compound)** — `work-orders.ts` `/complete` writes `cost: real` (CF-001 P0 carrier); ungated transition means cost can be set/changed on Cancelled orders → potential mis-invoice when downstream billing reads work-order cost field.
4. **Same-file inconsistency** — `work-orders.ts` author wrote correct gates for `/start` + `/review` but skipped them for `/complete` + `/cancel`; `leads.ts` author gated `/convert` but skipped `/mark-lost`. Pattern is *known* to authors but inconsistently applied — strong fix-ability signal.

### Recovery (recommendation)

- **Immediate (low risk)**: Add `eq(status, ...)` precondition to the 4 ungated handlers, returning 400 (or 409 Conflict) on row-count = 0. Mirror the WO `/start` + `/review` pattern.
- **Phase 2 (.NET port)**: Encode state transitions as enum + transition table; reject invalid transitions in domain layer before SQL emission. Compounds well with CF-019.b solution (DB GENERATED columns) and CF-020 fix (centralized `isNull(deleted_at) AND status IN (...)` predicate).
- **Audit (CF-008 dependency)**: Adding `logAction` to these 9 handlers is a prerequisite for retroactive audit; without it, fixing CF-022 still leaves Phase 1 invalid-state rows undetectable.

### Cross-references

- [`../_schema/api-endpoints/ops-crm.md` §2.9](../_schema/api-endpoints/ops-crm.md) — full 9-handler taxonomy + spot-check C3 verification log
- T002.2.h-.j (booking, admin, public) — must scan for additional transition handlers; estimate ≥5 more (booking lifecycle, invoice state, contract activate/cancel) → CF-022 anchor count likely doubles by T002.2 close
- CF-008 (audit gap) and CF-020 (soft-delete leak) are **prerequisite** repairs for CF-022 to be fully solvable

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
| CF-019 | 🟡 P1 | Write-orphan family — schema declares column, code does not honour it as single source of truth. Two sub-patterns: **.a Storage orphan** (column stored-then-NULL, never read; e.g. `invoices.stripe_payment_intent_id`); **.b Compute drift** (column written by raw INSERT/UPDATE but readers always recompute from upstream → DB-vs-response divergence; e.g. `contract_products.effective_weekly_rate`) | OPEN |
| CF-020 | 🟡 P1 | Soft-delete leak — query/mutation handlers omit `isNull(deleted_at)` filter; soft-deleted rows leak into list endpoints (.a, **26 anchors**) and can be revived by mutation (.b, **20 anchors**) — 4 domains; `service-hosts.ts` sentinel-via-status sub-variant (no `deleted_at` column) cross-cuts CF-015 | OPEN |
| CF-021 | 🟡 P1 | N+1 enrichment anti-pattern — list endpoints issue per-row follow-up SELECTs in JS rather than SQL JOIN; worst case `buildSpaceResponse` degree 4 → 4× page-size additional round-trips per list call. **13 anchors across 4 domains**; ops-crm exposes 4-way author-pattern split (leftJoin / Promise.all per-row / sequential per-id / sequential per-detail) within single domain | OPEN |
| CF-022 | 🟡 P1 | State-transition guard inconsistency — 9 transition handlers across 4 ops-crm files, 5 with precondition gate (`where(and(eq(id), eq(status, "Allowed")))`) + 4 without; same-file inconsistency in `work-orders.ts` (2 of 4 ungated) and `leads.ts` (1 of 2 ungated). Failure mode: invalid state transitions silently succeed (e.g. Cancelled→Completed, ConvertedToBooking→Lost), corrupting state-machine semantics; compounds with CF-008 (no audit trail to detect post-hoc) | OPEN |
| CF-023 | 🟡 P1 | Ad-hoc `booking_ref` generation outside the canonical helper (`bookings.ts:60` `generateBookingRef()` → `MS-${year}-${seq:5}` via DB COUNT). **Two sub-patterns** (T002.2.f split): **.a Orphan reference** — `leads.ts:175-204` `PATCH /v1/leads/:id/convert` marks `lead_status='ConvertedToBooking'`, generates `BK-${year}-${rand5}` (`leads.ts:188-189`), but **never INSERTs into `bookings` table** + omits `converted_booking_id` from UPDATE set (column exists at `lib/db/src/schema/leads.ts:24`, persists NULL forever). Production-critical: client receives fake `booking_ref` → believes booking created; revenue reporting (converted vs actual) diverges; audit invisible (CF-008 compound). **.b Fake-ref + real INSERT** — `guest-portal.ts:138-141` `POST /v1/guest/bookings` generates `GBK-${ts36}-${rand36×3}` then performs **real `bookings` INSERT** (L149-171). No orphan, but produces **dual-source-of-truth on `bookings.booking_ref`** (`MS-…` canonical vs `GBK-…` from this entry-point) → downstream consumers (admin search/filter UIs assuming `MS-` prefix) silently miss `GBK-…` rows; collision space ~46 656 per ms; no DB UNIQUE constraint declared on `booking_ref`. Compounds CF-022 (.a only — no precondition gate against ConvertedToBooking re-conversion). | OPEN |

**Counts after T002.1.9**: P0=3, P1=**15**, P2=3 (total **21**) — **2 NEW promotions** (CF-020 + CF-021, both T002.2.c R-REPO-5 graduates with sufficient anchor density to warrant promotion this commit). Both candidates were parked at T002.2.b half-2 (CF-020 9 anchors / CF-021 2 anchors); T002.2.c surfaced 7 additional CF-020 anchors + 6 additional CF-021 anchors, crossing the typical promotion threshold (≥10 anchors / ≥3 domains) without waiting for T002.2.d. CF-017 + CF-018 are T002.2.a Spot-Check C3 graduates (R-REPO-5); CF-019 is T002.2.b half-2 graduate. **0 deferred candidates** remaining; T002.2.d-.j may surface fresh ones.

**Counts after T002.2.i**: P0=**4**, P1=**18**, P2=3 (total **25**) — **1 NEW CF promotion in T002.2.i**: CF-004 P1 → **P0 escalation** (`dev-migration.ts:14-79` body confirmed = TRUNCATE 39 production tables RESTART IDENTITY CASCADE + SAVEPOINT-per-statement seed-replay; protected only by hard-coded shared secret `MIGRATION_SECRET = "MS_MIGRATE_2026_PROD"` at `dev-migration.ts:10` + mount-order at `app.ts:157` < `:167 requireAuth` with no `NODE_ENV !== "production"` gate); R-REPO-7 trade-off (가) chosen — single CF entry with dual root-cause evidence (mount-order + hard-coded secret) consolidated, separate CF-025 (hard-coded secrets) declined to keep Phase 2 fix prescription joint. **CF-008 admin row added** = 0/37 = 0% coverage; **6-way TIE at the absolute floor** (admin + ops-property + ops-catalog + ops-crm + portal-partner + public — `service-hosts.ts` rounding aside); inverse-correlation hypothesis CONFIRMED with reversal twist (admin = audit-data CONSUMER via `system-logs.ts:7` but audit-blind for own 18-20 mutators); Phase 2 prescription = `logAction` interceptor in `requireAuth` middleware. **CF-014 POSITIVE EXEMPLAR co-promotion #2** — `dev-migration.ts:38-66` SAVEPOINT-per-statement Tx pattern is now the **3rd known production runtime Tx site** (with `seedSync.ts:214` and `service-host-portal.ts:365-393`); co-listed alongside SHP and `blog-posts.ts` exemplars. **CF-018 SUB-PATTERN B EXPANSION** (R-REPO-7 (c) self-correction triggered by Step 4 spot-check C3): repo-wide `requireSuperAdmin` enforcement uses **two parallel patterns** = (i) router-level (1×, `db-sync.ts:30`); (ii) **per-handler inline** `if (currentUser?.role !== "SuperAdmin") return 403` (10× across 6 files: admin-users + service-catalog + tasks + spaces + beneficiaries + cs-tickets); 8 of the 10 inline sites are **cross-domain** (outside admin), missed by T002.2.b–.g enumeration, recovered by project-wide spot-check; CF-018 evidence body adds Sub-pattern B section distinct from Sub-pattern A (horizontal IDOR omission); Phase 2 prescription = consolidate into a single `requireSuperAdmin` middleware applied via `router.use` at file scope (or `[Authorize(Roles="SuperAdmin")]` attribute in .NET). **CF-022** +1 ungated transition (`admin-users.ts:62-64` status whitelist `["active","pending","rejected"]` allows arbitrary `pending → rejected → active`) → totals 5 gated + 5 ungated = 10 transitions across 5 files. **CF-013** +4 carriers (admin-users `deleted_at: new Date()` ×2 + integrations `updated_at: new Date()` ×2). **CF-015** +3 carriers + 1 POSITIVE (admin-users self-id filter at `:101`/`:127` is canonical "cannot-target-self" guard pattern). **CF-017** +2 carriers (email-templates ET3/ET4 `safeParse` use; only admin-domain Zod-using file = 2/6 = 33% on this file, but 2/37 = 5.4% on admin domain overall = **second-lowest absolute floor after public's 0/33**); ET5 `bulk-delete` confirmed as 2nd "afterthought endpoint" anti-pattern after blog-posts B5. **CF-024** +6 carriers (auth.ts 6 unauthenticated mutation sites: login/refresh/register/forgot-password/reset-password/logout); the 9 lead-INSERT carriers from T002.2.h + the 6 auth carriers here total 15 worst-exposed unauthenticated mutation entry points. Inconsistencies memo: (i) `integrations.ts:211-227` `process.env` mutation precedes DB UPSERT = transient inconsistency window across the failure boundary; (ii) `system_log` table = producer-consumer split = T002.4 erd-core annotation; (iii) `system-logs.ts:7` is read-only over `system_log` despite naming.

**Counts after T002.2.h**: P0=3, P1=**18**, P2=3 (total **24**) — **1 NEW CF promotion in T002.2.h**: CF-024 (project-wide rate limiting absence, P1) graduated from Step-1 sealed `0 hits` finding (`rg "rate.?limit|express-rate-limit|rateLimit"` across `artifacts/api-server/src/` + `lib/` = 0 hits; package.json carries no throttling library). Worst-exposed surface: 9 unauthenticated mutation entry points (3 `*-applications` lead-INSERT POSTs in public.ts:735/787/833 + 4 auth login/register endpoints + 2 reset/auth endpoints across guest-auth/partner-auth). Authenticated surface (~339 ep) also uncapped — session-level abuse uncapped. R-REPO-7 P1 즉시 등재 원칙 적용. **CF-023 cross-domain verification CLOSED at this sub-task** — all 9 audit domains (leads/finance×2/ops×3/portal×2/public) scanned for `bookings.booking_ref` minting paths and lead/booking write-orphan patterns; no remaining unaudited regions for cross-domain hunt (within-domain expansions only, e.g. T002.2.i admin.md). Helper analysis (`leadRef.ts:15-41` `insertLeadWithGeneratedRef`) confirmed safe (23505 retry, race-safe, single-row INSERT) → `leads.ts:175-204` is the sole outlier (option (가) per Step-1 ZZ matrix); CF-023.a P1 status maintained, Phase 2 fix prescription refined. **CF-017 POSITIVE EXEMPLAR co-promotion** — `blog-posts.ts` 5/6 = 83% safeParse coverage (4 module-level schemas: ListBlogPostsQuery + CreateBlogPostBody + UpdateBlogPostBody + IdParams; double-validate B4 PUT uses both IdParams + UpdateBlogPostBody); B5 bulk-delete is the sole gap (`Array.isArray + .length` manual guard) — POSITIVE EXEMPLAR sub-section appended. Anchor count updates: **CF-001** +5 read-side carriers (services base_price + commission_rate/amount + base_weekly_price + accommodation_catalog.price); **CF-008** new lowest absolute floor (33/33 = 0% audit coverage; particularly egregious: 3 unauthenticated POST applications create `leads` rows with zero audit trail — operationally invisible inbound funnel); **CF-013** +3 carriers (insertLeadWithGeneratedRef writes via server `new Date()` into `leads.created_at` no-tz column); **CF-014** +5 carriers (3 applications POSTs single-row + 1 bulk-delete multi-row + 1 page-contents check-then-act upsert); **CF-015** +1 POSITIVE evidence (blog-posts.ts:118/130-133 SuperAdmin role gate on permanent delete = safe pattern); **CF-021** +1 helper-internal carrier (`leadRef.ts:5-12` `generateLeadRef` full-table SELECT on every helper invocation → O(N) on each lead INSERT, 4 callers). Inconsistencies memo: `healthRouter` double-mounted at `app.ts:150` + `routes/index.ts:41` (via `app.ts:174`); first match wins, second mount dead — Phase 2 cleanup memo, no CF.

**Counts after T002.2.g**: P0=3, P1=**17**, P2=3 (total **23**) — **0 new CF promotions**. T002.2.g (`portal-partner.md`, 4 files / 22 endpoints: service-host-portal.ts 9 + owner-portal.ts 5 + agent-portal.ts 5 + partner-auth.ts 3) anchor count updates: **CF-014 POSITIVE EXEMPLAR PROMOTION** — service-host-portal.ts:365-393 (E4 `POST /v1/service-host/jobs/:id/photos`) is the **sole production runtime mutation handler** that uses `db.transaction(...)` correctly project-wide; pattern catalogued above (POSITIVE EXEMPLAR sub-section, ~30 lines: row-lock + count check + sentinel-throw + atomic INSERT loop + cross-system compensating action). Promotion is qualitative (raw count → exemplar status) — site count unchanged at 3. **CF-008** portal-partner 22/22 = 0% — TIES with ops-catalog 0/39 + ops-crm 0/51 for absolute lowest (3-way tie at exact 0%, distinct from portal-guest 1/29 = 3.4%). **CF-005** evidence reinforced: signing site `partner-auth.ts:43` `as "agent" | "owner"` cast lies to TS while runtime accepts `"service_host"` (single JWT signing locus → 9 RSHA consumer endpoints). **CF-001** +6 carriers (1 `contracts.weekly_rate` read at owner-portal.ts:236 / 5 `commissions.commission_rate`+`amount` reads at agent-portal.ts:71/72/252-254). **CF-006** owner-portal.ts:83 (Formula A) + owner-portal.ts:236 (Formula B) already in 4-site list at T002.1.8 — T002.2.g formalises **same-file inconsistency** (one author / one file / two different formulas) as a documented sub-pattern; site count unchanged at 4. **CF-018** **strongest IDOR-defense surface yet** — 22/22 = 100% safe (overtakes portal-guest 26/29 by raw ratio); qualified by structural difference (partner has flat ownership graph vs portal-guest's account_sharers). DOUBLE GUARD pattern (E5 PATCH job + E12 GET property/:id + E17 GET agent booking/:id) recommended as canonical exemplar for `_rules/security-rules.md` (T004) alongside portal-guest E20 sole-owner guard. **CF-023.b consumer-drift hypothesis REJECTED for partner domain** — partner is read-only consumer (12 SELECT projection sites, 0 INSERT into bookings); systemically prefix-blind (no `LIKE 'MS-%'` filter; fallback `\`#${booking_id}\`` at SHP:573/673 confirms blindness). Drift is admin-domain risk only (T002.2.i). **0 R-REPO-5 mini-task escalations** (4 incidentals: 1 INDEX.md mount-prefix factual correction landed in this commit, 3 deferred memos to T002.5/CF-015/T004).

**Counts after T002.2.f**: P0=3, P1=**17**, P2=3 (total **23**) — **0 new CF promotions** (CF-023 split into .a / .b sub-patterns documented as expansion-not-promotion; sub-split is structural, not a count change). Anchor count updates this commit: **CF-008** portal-guest 1/29 = 3.4% — **NEW lowest** in any domain audited so far (overtakes ops-catalog 0/39 and ops-crm 0/51 by ratio of intent — portal-guest is auth-protected guest mutation surface, not internal admin); **CF-011** +1 carrier (`guest-portal.ts:762-764` invoice_ref `count+1` race); **CF-013** +1 evidence site (`guest-portal.ts:480` DOB raw text passthrough into PUT/profile); **CF-014** +5 carrier sites (E1 register accounts+guest_users, E10 profile+accounts.name, E17 invoice+booking_status, E24 ticket+message, E26 message+ticket-update — domain is now CF-014's largest carrier domain by site count); **CF-017** +5 carrier sites (E5 bookings POST, E10 profile/bank, E14 emergency-contact POST, E17 payment/confirm amount unbounded, E24 ticket booking_id unchecked); **CF-018** +1 partial site (E24 `guest-cs.ts:79` ticket booking_id unchecked); **CF-023.b** NEW sub-pattern formalized (split from CF-023.a). E17 `guest-portal.ts:802` dead-branch ternary `bank_transfer ? "PendingApproval" : "PendingApproval"` filed as memo for T002.5 (state-machines.md). Domain is **strongest IDOR-defense surface** of any audited so far (26/29 ✅ + 1 partial, 2 n/a) — sole-owner guard at E20 (`:1086-1092`) recommended as canonical exemplar for `_rules/security-rules.md` (T004).

**Counts after T002.2.e.fix-1**: P0=3, P1=**17**, P2=3 (total **23**) — **1 NEW CF promotion in T002.2.e.fix-1**: CF-023 (lead-to-booking conversion creates orphan reference, P1) graduated from T002.2.e Step 6 R-REPO-5 incidental "L7 fake booking_ref". V2 verification confirmed production-critical defect: `PATCH /v1/leads/:id/convert` (`leads.ts:175-204`) marks lead status as converted but never INSERTs into `bookings` table — `booking_ref` is generated client-side via `Math.random()` (`leads.ts:188-189`), and `converted_booking_id` schema column (`lib/db/src/schema/leads.ts:24`) is omitted from the UPDATE set (`leads.ts:191-198`). R-REPO-7 P1 즉시 등재 원칙 적용. Single endpoint scope, but compounds CF-008 (no audit) + CF-022 (no precondition gate). T002.5 state-machine doc must encode dual-source-of-truth defect on bookings/leads diagram.

**Counts after T002.2.e**: P0=3, P1=**16**, P2=3 (total **22**) — **1 NEW CF promotion in T002.2.e**: CF-022 (state-transition guard inconsistency, P1) graduated from T002.2.e Spot-Check C3 (R-REPO-5). 9 transition handlers across 4 ops-crm files; 5 gated + 4 ungated; same-file inconsistency in `work-orders.ts` (2/4) + `leads.ts` (1/2). CF-019.a candidate row 3 (`service_catalog.promotion_id`) status note updated with ops-crm cross-check result (0 write hits — CANDIDATE retained pending T002.3 full enumeration). Anchor count updates this commit: **CF-001** +2 carriers (`work_orders.cost`, `promotions.discount_percentage`); **CF-008** ops-crm row 0/51 = 0% TIED LOWEST with ops-catalog; **CF-013** +6 no-tz anchors (21 → 27); **CF-015** NEW sentinel-via-status sub-pattern at `service-hosts.ts` (single-site evidence, no separate sub-ID promoted); **CF-017** +5 evidence sites (3 strong end-to-end + 2 partial/spread-reuse); **CF-018** false-positive note (cs-tickets nested message handler is admin-scoped); **CF-020.a** +8 GET-by-id leak anchors (18 → **26**) + **.b** zombie-revival anchors split formalized (5 → **20**); **CF-021** +3 N+1 anchors (10 → **13**) with 4-way author-pattern split documented (leftJoin / Promise.all per-row / sequential per-id / sequential per-detail in single domain).

**Counts after T002.2.c**: P0=3, P1=13, P2=3 (total 19) — **0 new CF promotions in T002.2.c** (commit consists of 7 CF expansions + 5 sub-pattern annotations: CF-001 source-side anchor, CF-008 ops-property row + CF-008.a + CF-008.b sub-patterns, CF-013 ops business-domain enumeration, CF-014 anchor 3 → 11, CF-015 hard-delete-by-design distinction, CF-017 Domain Validation Coverage Matrix, CF-018 partial-IDOR taxonomy + SAFE exemplar references). CF-017 + CF-018 are T002.2.a Spot-Check C3 graduates (R-REPO-5); CF-019 is the T002.2.b half-2 Spot-Check C3-8 graduate (R-REPO-5). Two CF candidates' anchor counts updated this commit: **CF-020 candidate** (system-wide soft-delete leak — 9 → **16 anchors**: 5 ops-property GET-leak SP3/PR3/SL3/SO3/SU3 + 2 ops-property mutation-zombie-revival PR4/PR7 + 9 prior across finance) and **CF-021 candidate** (N+1 enrichment anti-pattern — 2 → **8 anchors**: 6 ops-property: 3 spaces buildSpaceResponse degree-4 callers + 3 properties degree-1 + 2 prior). Both still parked for T002.2.d promotion decision per user.

---

### Hard-delete-by-design distinction (T002.2.c addition)

CF-015 to date has anchored only "tables that **have** a `deleted_at` column but where some routes **skip** soft-delete in favour of `db.delete(...)`" — a behavioural omission. T002.2.c adds the **first design-omission anchor**: `space_images` (`lib/db/src/schema/space_images.ts:3-15`) declares **no `deleted_at` column at all**. Soft-delete is impossible by schema design; all 5 mutators (SI2 INSERT, SI3 PUT caption, SI4 set-primary, SI5 DELETE, SI6 reorder) operate in hard-delete-only mode by necessity.

Sub-classification proposal for CF-015 going forward:

| Sub-pattern | Definition | Anchor table examples |
|---|---|---|
| **CF-015.a — design omission** | Schema declares no `deleted_at` column → soft-delete is structurally impossible. | `space_images` (T002.2.c, this commit) |
| **CF-015.b — behaviour omission** | Schema declares `deleted_at` but route file uses `db.delete(...)` instead of soft-flagging. | `accounts.ts` (T001.5 origin), `commissions`, `payment_info` (T002.2.b half-2) |

Carrier: `ops-property.md` SI1-SI6 walks the design-omission anchor. Phase 2 mitigation also splits: 15.a requires schema change (add column + migration), 15.b requires route-file change only.

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

### Domain Validation Coverage Matrix (T002.2.c addition — new subsection, parallel to CF-008's matrix)

Per-domain Zod-validated-endpoint coverage as docs are written:

| Domain | Endpoints | Zod-validated | % | Source |
|---|---:|---:|---:|---|
| booking (sample 5) | 5 | 5 | 100% | T002.1 |
| contract | 28 | 28 | 100% | T002.2.a |
| finance-invoicing | 17 | TBD | TBD | T002.2.b half-1 (re-measure pending — R2 was positive exemplar) |
| finance-payments | 26 | TBD | TBD | T002.2.b half-2 |
| **ops-property** | **44** | **31** | **70.5%** | T002.2.c |
| **ops-catalog** | **39** | **0** | **0.0%** ⬅ **NEW LOWEST (this commit)** | **T002.2.d** |
| ops-crm | TBD | TBD | TBD | pending T002.2.e |
| portal-guest | TBD | TBD | TBD | pending T002.2.f |
| portal-partner | TBD | TBD | TBD | pending T002.2.g |
| public | TBD | TBD | TBD | pending T002.2.h |
| admin | TBD | TBD | TBD | pending T002.2.i |

**Project-wide re-baseline candidate**: CF-017's original "~10% project-wide" claim was based on the count of route files that import Zod / use `safeParse` (~5-6 of 52). The per-endpoint measure (per-handler `safeParse` call) tells a different story — ops-property hits 70.5% endpoint-level coverage. The two metrics are not interchangeable: a file-level "uses Zod" flag does not guarantee per-endpoint validation, and conversely a file with no Zod-import line can still validate via shared schemas (the `bookings.ts` exemplar). Once `T002.2.b–.j` are complete, the project-wide re-baseline should re-measure CF-017 as: **(endpoints with `safeParse(req.{body|query|params})` on the request side) / (total endpoints)** — replacing the file-level proxy with the endpoint-level ground truth.

**ops-property internal pattern**: 4 of 6 satellite files (properties / policies / options / suburbs) hit 100% (25 of 25 endpoints). The 13/19 gap (31.8%) is concentrated in 2 files: `spaces.ts` operations endpoints (block/unblock/services — 7 unvalidated of 13) + `space-images.ts` (all 6 unvalidated). This suggests the original author wired Zod for "primary CRUD" path but skipped "operations" path — a recurring architectural inconsistency within a single file. **Defer-confirm** in T002.2.f (portal-guest may have similar primary-vs-operations split).

### CF-017 POSITIVE EXEMPLARS — repository-wide ranking (T002.2.h promotion)

Files that approach or achieve full per-handler `safeParse` coverage on the **request side** (body / query / params), promoted progressively through T002.x sub-tasks:

| Rank | File | safeParse / endpoints | Coverage | Schemas declared | Notable pattern | Sub-task source |
|------|------|----------------------|---------|------------------|----------------|-----------------|
| 1 | `bookings.ts` | (highest project-wide; T002.1) | (highest) | shared schemas via cross-file import | shared-schema reuse via `lib/db` exports | T002.2.a peer reference |
| 2 | `blog-posts.ts` | **5 / 6 = 83 %** | 83 % | 4 module-level (`ListBlogPostsQuery`, `CreateBlogPostBody`, `UpdateBlogPostBody`, `IdParams`) | **double-validate B4 PUT** uses *both* `IdParams.safeParse(req.params)` *and* `UpdateBlogPostBody.safeParse(req.body)` (L88-108) — best-in-class per-endpoint defense | **T002.2.h (this commit)** |
| 3 | ops-property satellites (4 files: properties, policies, options, suburbs) | 25 / 25 = 100 % | 100 % | per-file local | "primary CRUD" path discipline | T002.2.c |
| Gap-pattern | `blog-posts.ts:110-124` (B5 `bulk-delete`) | 0 of 1 ep on this handler | 0 % | none on body | manual `Array.isArray(ids) && ids.length > 0` guard + SuperAdmin role gate; **canonical "afterthought endpoint" anti-pattern** — defensive retrofit but inconsistent with the surrounding 5 schema-validated endpoints in the same file | **T002.2.h (this commit)** |

**Lesson**: the 1-endpoint gap in `blog-posts.ts` (B5) is itself instructive. When a file is otherwise 100% Zod-covered, the bulk-delete handler is the most likely "added later" endpoint that was never retrofitted. Phase 2 .NET port should generate model-bound DTOs for **every** action method including bulk operations — `[FromBody] BulkDeleteRequest` validated by FluentValidation closes this class of regression by construction.

**Co-listed with `service-host-portal.ts:365-393` (CF-014 POSITIVE EXEMPLAR, T002.2.g)** as the canonical "best of class" pattern set across the 3 dimensions Zod / Tx / Authorization.

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

### Partial-IDOR taxonomy + SAFE exemplar (T002.2.c addition)

The 7 + 3 + 7 audit table established at T002.1.8 lumped "outright IDOR" and "partial / TOCTOU-weak" into separate buckets but did not distinguish their **failure modes**. T002.2.c surfaces a qualitative distinction worth annotating in the audit table:

| Sub-class | Definition | Failure mode | T002.2.c anchor |
|---|---|---|---|
| **CF-018.a — outright IDOR** | Nested handler omits parent-id from WHERE entirely; e.g. `eq(id, childId)` only. | Unauthorized access (read or mutate) of any sibling record by guessing child id. | `space-images.ts:139,167,199` (SI3 PUT, SI5 DELETE, SI6 reorder) — **3 anchors here** |
| **CF-018.b — partial / cross-resource corruption** | Nested handler uses parent-id correctly for one step but omits it for another step in the same handler. The handler does not just leak data — it can **corrupt** state on a second resource by side effect. | Mutation cascades across resource boundaries; state on resource A can leave state on resource B in an invalid configuration. | `space-images.ts:151-156` (SI4 set-primary): step 1 demotes spaceA's correct primary; step 2 sets `is_primary=true` on imageX which may belong to spaceB — net effect: spaceA loses primary, spaceB has 2 primaries. **1 anchor here** |
| **CF-018.SAFE — canonical guard pattern** | Both child-id AND parent-id in WHERE, joined via `and(...)`. Recommended fix shape for vulnerable handlers. | N/A (safe). | `spaces.ts:427` (SP12 PUT services) and `spaces.ts:447` (SP13 DELETE services) — **2 SAFE exemplars here**; project-wide universe of 7 SAFE handlers identified at T002.1.8 |

T002.2.c contributes **4 vulnerable + 2 SAFE** to the 17-handler universe. Universe ledger: 7 outright (CF-018.a; 3 here = `space-images.ts`, 4 from prior) + 1 partial (CF-018.b; 1 here = `space-images.ts:151-156` SI4; 2 prior partial cases re-classify as `bookings.ts` services + `contracts.ts` schedules) + 7 SAFE (2 here + 5 prior). The remaining 2 handlers from the original 17 audit are still pending review in T002.2.f-.j.

**Phase 2 mitigation**: SP12 / SP13 are the **canonical SAFE fix shape** — `where(and(eq(<child_id>, mapId), eq(<parent_fk>, parentId)))`. Vulnerable handlers should adopt this guard before Phase 2 port; the C# port will inherit the IDOR if the original WHERE clause is translated literally.

### Sub-pattern B — vertical privilege escalation: SuperAdmin role-gate enforcement drift (T002.2.i seed → T002.2.j corrected enumeration)

**Discovery**: T002.2.i Step 4 spot-check C3 surfaced a **second axis** of CF-018 distinct from the horizontal sub-classes a/b above (which both concern parent/child WHERE-clause omission). Sub-pattern B is **role-gate enforcement drift**: the codebase defends `SuperAdmin`-only operations through **two parallel mechanisms** that coexist and are inconsistently applied.

**T002.2.i seed**: 11 sites in 6 files (1 router-level + 10 per-handler inline).

**T002.2.j Step 1 multi-pattern verification — CORRECTED**: **55 sites in 28 files** = 54 inline `if (currentUser?.role !== "SuperAdmin")` returns 403 across 27 files (each typically a paired GET-then-mutate guard, hence × 2) + 1 router-level `requireSuperAdmin` middleware at `db-sync.ts:30`. The T002.2.i seed under-counted by 5× because it only swept the 6 files visible from T002.2.b–.h enumeration; the project-wide multi-pattern scan run at T002.2.j Step 1 (`rg "!== \"SuperAdmin\""` + `rg "requireSuperAdmin"`) recovered the full surface. See `docs/reverse/_schema/api-endpoints/booking.md §6.A` for the full 28-file enumeration table.

**The two mechanisms**:

| Mechanism | Locus | Site count | Role-string handling |
|---|---|---|---|
| (i) Router-level middleware | `lib/db/src/db-sync.ts:18-29` declares `requireSuperAdmin(req,res,next)` then `:30` mounts via `router.use(requireSuperAdmin)` | 1 file / 1 mount | Uses `SUPER_ADMIN_ROLES` Set at `:16` containing **4 variants** `{"Super Admin", "SuperAdmin", "superadmin", "super_admin"}` ⇒ case-insensitive normalisation |
| (ii) Per-handler inline guard | `if (currentUser?.role !== "SuperAdmin") return res.status(403).json(...)` repeated at handler entry | 27 files / 54 inline checks (paired GET-list-then-mutate per file) | Uses **exact-string `"SuperAdmin"` literal** in every site ⇒ strict equality |

**Sub-finding — role-string normalisation drift (NEW at T002.2.j)**: A user record with `role = "super_admin"` (snake_case) successfully passes the db-sync helper but is **denied by all 54 inline sites**. Equivalently, a user with `role = "Super Admin"` (with space) bypasses the inline gate at zero of the 54 sites but reaches db-sync routes. There is no single source of truth for role normalisation in the codebase, and no documented contract for what the canonical stored value should be.

**Why P1 (not new CF promotion)**: this is an **expansion** of CF-018 (authorization-scope omission) into the vertical-privilege axis, not a structurally new failure. The same fix shape recovers both: extract a single `requireSuperAdmin` middleware and apply via `router.use` at file scope. The role-normalisation sub-finding is absorbed into this same prescription (the extracted middleware should also be the sole site of role-string canonicalisation).

**Phase 2 prescription**:
1. Extract the 54 inline duplications into a single shared `requireSuperAdmin` middleware (one site to test, one site to maintain).
2. Mount via `router.use(requireSuperAdmin)` at file scope on all 28 files (collapses 55 sites to 28 mount points).
3. Canonicalise the role string at the **identity issuer** (login + register handlers in `auth.ts`), so by the time `currentUser.role` is read inside any middleware, it is already normalised — drift becomes impossible by construction.
4. In the C# / .NET port, this maps directly to `[Authorize(Roles="SuperAdmin")]` attribute on the controller class — the framework supplies both extraction and normalisation for free.

### Carrier (Sub-pattern B)

`api-endpoints/admin.md` (T002.2.i — initial seed evidence and chip update). `api-endpoints/booking.md §6.A/§6.B/§6.C` (T002.2.j — corrected 28-file enumeration table, role-normalisation NEW SUB-FINDING, and full T002.2.b–.i blind-spot map). Future cross-domain re-tests of any `requireSuperAdmin` route in T002.3+ should re-verify against the §6.A table.

---

## CF-019 — Write-orphan family: schema-declared columns the code does not honour as single source of truth

| Field | Value |
|---|---|
| **Severity** | 🟡 P1 |
| **Scope** | Finance · Reconciliation · Catalogue · Schema-vs-code drift |
| **Status** | OPEN |
| **Discovery** | T002.2.b half-2 Spot-Check C3-8 surfaced .a (R-REPO-5 incidental J2 → original CF-019). T002.2.d surfaced .b as a structurally-distinct second locus → T002.2.d.fix-1 split into family with two sub-patterns. |

### Sub-pattern taxonomy (T002.2.d.fix-1)

The original CF-019 named one mechanism (Stripe columns declared but never written → stored-as-NULL). T002.2.d's `effective_weekly_rate` finding is *structurally* different: the column **is** written, but every reader recomputes the value, so the stored bytes never appear in any HTTP response. Both share the schema-vs-code drift root, with opposite mechanisms — hence sub-pattern split:

| Sub-pattern | Definition | Failure mode | Phase 2 risk |
|---|---|---|---|
| **CF-019.a — Storage orphan** | Schema declares column. No route writes it (or writes are dead — values land as NULL). Some readers may declare it in `select(...)` projections but always observe NULL. | Dead schema capacity; downstream consumers (BI tooling, .NET reader, finance reconciliation) **expect** the value because the schema implies presence. Joins on this column return empty. | C# port allocates property → integration tests fail when value comes back NULL on rows that "should" have it. Reconciliation jobs grep `system_logs` JSON to recover what should have been a typed column. |
| **CF-019.b — Compute drift** | Schema declares column. Routes write it (raw `INSERT.values({col: data.col})` / `UPDATE.set({col: data.col})` — client-supplied, no validation, no recomputation). Readers always recompute from upstream (e.g. `weekly_rate * (1 - disc/100)`). DB-stored bytes and HTTP-response bytes diverge silently. | Two sources of truth disagreeing without alarm. Direct SQL queries (BI, `pg_dump`, .NET reader) see the stored value; HTTP callers see the recomputed value. **Promotion-expiry second-order drift**: when an upstream input (e.g. `promotions.discount_percentage`, or the promotion's `valid_to` boundary) changes, the recomputed value updates but the stored value remains frozen at write-time. | C# port that respects the column as authoritative will read the wrong value. Recovery requires a rewrite of the stored column **or** a removal of the write surface (deferring to the read-time formula or a Postgres GENERATED column). |

### Anchor table

| # | Sub | File:line (schema) | Write site(s) | Read site(s) | Status |
|---|---|---|---|---|---|
| 1 | .a | `invoices.ts:15` (`stripe_payment_intent_id`) | none (Stripe webhook writes only `status` + `paid_at`; PI id lands in `system_logs.new_value` JSON only) | none in routes | confirmed orphan |
| 2 | .a | `invoices.ts:16` (`stripe_checkout_url`) | none (`guest-portal.ts:885` returns `session.url` in HTTP response, never persisted) | none in routes | confirmed orphan |
| 3 | .a | `service_catalog.ts:24` (`promotion_id`) | unclear — `service-catalog.ts:48,60-66` use spread-from-body that could *implicitly* carry `promotion_id` if the client sends it, but no explicit enumeration; default case = NULL. **T002.2.e ops-crm cross-check completed**: 7-file grep `promotion_id` across `{work-orders,leads,tasks,cs-tickets,contacts,service-hosts,promotions}.ts` = **0 write hits** (only read at `promotions.ts:135,146` reverse-lookup join). | `promotions.ts:146` (reverse-lookup join: list services attached to a promotion) | **CANDIDATE retained** — ops-crm domain confirmed write-less; final promotion decision pending T002.3 db-schema-overview full write-surface enumeration across remaining 43 route files (admin/portal/public clusters) |
| 4 | .b | `products.ts:8` (`effective_weekly_rate` on `contract_products`) | `products.ts:67` POST + `products.ts:108` PUT (client-supplied, no validation) | `products.ts:7-37` `enrich()` helper (recomputes from `weekly_rate * (1 - disc/100)`) called by 6 of 10 endpoints | **confirmed compute-drift** — divergence demonstrated; promotion-expiry second-order drift documented |

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

### CF-019 second domain — `contract_products.effective_weekly_rate` calculated-on-read but stored-on-write (T002.2.d expansion)

T002.2.d surfaces a **second instance** of the write-orphan pattern, this time inside `ops-catalog`, with a different mechanism: the column is *not* abandoned (writers exist) but the writers **trust client-supplied values** while the readers **recalculate from upstream**, producing silent DB-vs-response divergence.

**Schema**: `lib/db/src/schema/products.ts` declares `effective_weekly_rate` on `contract_products` (the table actually defined in this misnamed file — see CF-016).

**Read path** — `artifacts/api-server/src/routes/products.ts:7-37` (`enrich()` helper called by 6 of 10 endpoints):

```ts
const promo = p.promotion_id ? promoMap[p.promotion_id] : null;
const disc = promo?.discount_percentage ?? 0;
const effective_weekly_rate =
  p.weekly_rate != null ? parseFloat((p.weekly_rate * (1 - disc / 100)).toFixed(2)) : null;
return { ...p, effective_weekly_rate, … };
```

The helper **always recomputes** the effective rate from `weekly_rate` and the (current) promotion's `discount_percentage`, **overriding** whatever value sits in the DB column. So all GET responses (E2 list, E3 POST echo, E4 GET :id, E5 PUT echo, E8/E9/E10 state-transition echo) appear correct.

**Write path** — `artifacts/api-server/src/routes/products.ts:67` (POST) and `:108` (PUT):

```ts
effective_weekly_rate: data.effective_weekly_rate ?? null,
```

Both INSERT and UPDATE store **whatever the client supplied** with no validation, no recalculation, and no cross-check against `weekly_rate * (1 - discount_percentage / 100)`.

**Divergence mechanism**: an admin sets `weekly_rate=1000` and (deliberately or by client bug) sends `effective_weekly_rate=999`. The DB now holds `1000` and `999` simultaneously. Every API response shows the recalculated `1000` (or whatever the live promotion says). But:

1. Any **direct SQL query** (BI tool, `pg_dump`, Phase 2 .NET reader) sees the stored `999`.
2. Any **other route** that joins `contract_products` and reads the column directly (without going through `enrich()`) would surface the stale value. Today this set is empty (`rg "effective_weekly_rate" artifacts/api-server/src/routes/` returns hits only inside `products.ts`), but the discoverability is fragile — the next developer to write a JOIN will not know about the read-time recalculation.
3. **Promotion lifecycle**: when a promotion expires (`promotions.valid_to < now()`), the recalculation begins to use `disc=0` (since `enrich` only joins live promo rows by id, no time gate visible at L18-23). The stored value, frozen at write time with the *old* disc, no longer matches. This is a second-order silent drift specific to promotion expiry — invisible until it bites.

**Difference from the original CF-019 (Stripe write-orphan)**: that one's columns are NULL in production; this one's columns are populated but **wrong**. Both fall under "schema declares a column that the code does not honour as a single source of truth", but the recovery is harder here — there is no obvious null-marker to grep for.

**Recommendation extension**: the original CF-019 recommendations apply, plus —

4. **products.ts route**: drop `effective_weekly_rate` from the `INSERT.values({...})` and `UPDATE.set({...})` blocks (lines 67, 108). Either compute server-side at write time using the same formula as `enrich()`, or convert the column to a Postgres **generated column** (`GENERATED ALWAYS AS ((weekly_rate * (1 - COALESCE(p_discount, 0)/100)))` joined via view) and forbid manual writes.
5. **Phase 2**: in EF Core, mark this property as `[NotMapped]` for writes and compute it in the entity getter, or use a SQL-side computed column.

### Carrier (T002.2.d)

`api-endpoints/ops-catalog.md` §3.2 E1 (helper `enrich()` walkthrough — N+1 + write-orphan combined anchor) and §3.2 E2/E4 (POST/PUT call sites). When `T002.2.f portal-guest.md` is written, the contract-products selector path (if any) must verify whether it surfaces stale stored values or routes through `enrich()`.

---

## CF-020 — Soft-delete leak: query/mutation handlers omit `isNull(deleted_at)` filter

| Field | Value |
|---|---|
| **Severity** | 🟡 P1 |
| **Status** | OPEN — promoted from candidate at T002.1.9 (16 anchors across 3 domains) |
| **Origin** | T002.2.b half-2 (CF-020 candidate, 9 anchors) → T002.2.c (+7 anchors → 16) → T002.1.9 promotion |
| **Affected** | List endpoints (data leak), mutation endpoints (state corruption + audit gap), Phase 2 RLS port |

### Sub-pattern taxonomy

CF-020 anchors split cleanly into two sub-patterns by mutation direction:

| Sub-pattern | Definition | Failure mode | Anchor count |
|---|---|---|---:|
| **CF-020.a — GET-leak** | Query handler (typically `db.select().from(t).where(...)`) omits `isNull(t.deleted_at)` from the WHERE clause. Soft-deleted rows are returned to the caller alongside live rows. | **Data leak**: rows the operator believed deleted reappear in lists, dashboards, picker dropdowns, exports. May leak previously-redacted PII (deleted user accounts, terminated contracts). | **14** anchors (5 ops-property GET-list + 9 prior across finance) |
| **CF-020.b — mutation-revival** (zombie revival) | Mutation handler (`db.update(t).set({...}).where(eq(t.id, X))` or `db.delete(t).where(eq(t.id, X))`) omits `isNull(t.deleted_at)` from the WHERE predicate. UPDATE writes fresh values into a soft-deleted row, effectively "reviving" it without admin intent (the row appears live again because `updated_at` is now newer than `deleted_at` in any read query that doesn't strictly check `isNull(deleted_at)`). | **State corruption + audit gap**: soft-deleted row resurfaces in production with operator unaware they are editing a tombstoned record; second-order effect — any downstream system that already learned of the deletion (cached list, Phase 2 BI extract, archived export) is now out of sync with primary DB; no `RESTORE` audit event is emitted. | **2** anchors (`properties.ts:139` PR4 PUT + `properties.ts:214` PR7 PATCH status) |

### Anchor table (16 of 16)

| # | Sub | File:line | Endpoint | Detection |
|---|---|---|---|---|
| 1 | .a | `properties.ts:69` | PR3 GET list | no `isNull(properties.deleted_at)` in WHERE |
| 2 | .a | `spaces.ts:32-54` | SP3 GET list (helper `buildSpaceResponse`) | filter omitted in helper join |
| 3 | .a | `space-policies.ts` | SL3 GET list | omitted |
| 4 | .a | `space-options.ts` | SO3 GET list | omitted |
| 5 | .a | `suburbs.ts` | SU3 GET list | omitted |
| 6-14 | .a | (9 prior) | finance-payments accounts/commissions/beneficiaries list endpoints | per T002.2.b half-2 audit |
| 15 | .b | `properties.ts:139` | PR4 PUT update | UPDATE WHERE = `eq(id, X)` only |
| 16 | .b | `properties.ts:214` | PR7 PATCH status | same |

### Why P1

The .a leak alone might be P2 (operational nuisance), but .b crosses into "silent state corruption that defeats the entire soft-delete invariant" — a tombstoned record can come back to life without a `RESTORE` audit event, breaking the assumption every downstream consumer (BI extract, cached selectors, Phase 2 sync feed) makes about the meaning of `deleted_at IS NOT NULL`. Compounded with **CF-008** (audit log absent on the same mutators) the revival is invisible to operations.

### Recommendation (no code change)

1. **Repo-wide convention**: every query against a soft-deletable table MUST include `isNull(t.deleted_at)` in the WHERE clause unless explicitly listing tombstones. Mutations must also include this guard (or perform an explicit pre-check + emit `RESTORE` audit event when un-deleting).
2. **CI grep**: add a lint rule that fails PRs which call `db.select().from(<soft-deletable table>)` without `isNull(...deleted_at)` adjacent in the WHERE clause. Same for `db.update`/`db.delete` mutators.
3. **Phase 2**: in EF Core / .NET, register a global query filter (`modelBuilder.Entity<T>().HasQueryFilter(x => x.DeletedAt == null)`) on every soft-deletable entity. The framework enforces the filter on every query.

### Carrier

`ops-property.md` §3 row C3-PROPS-RES (originating mutation-revival anchor) + `_schema/api-endpoints/finance-payments.md` accounts/commissions/beneficiaries (originating GET-leak anchors). T002.2.d (`ops-catalog.md`) and T002.2.e (`ops-crm.md`) are likely to surface additional .a anchors (similar list-endpoint pattern). When all 9 domain docs are complete, anchor universe should be re-verified.

### CF-020 ops-catalog expansion (T002.2.d — anchor count 16 → 18)

T002.2.d adds **2 net new anchors** (4 found, 2 already implicitly counted under "general GET /:id pattern"). The ops-catalog domain confirms .a leaks are **endemic** — every domain so far surfaces them at the GET /:id detail-view layer.

**Sub-pattern .a (GET-leak)** — 4 new ops-catalog anchors:

| # | Sub | File:line | Endpoint | Note |
|---|---|---|---|---|
| 17 | .a | `products.ts:89` | E4 GET /v1/contract-products/:id | List sibling (E2 L41) ✅ guards; detail does not — same intra-file inconsistency as ops-property |
| 18 | .a | `products.ts:194-202` | E11 GET /v1/lookup/contract-products | Picker endpoint — soft-deleted product surfaces in booking/contract selectors → invoice/quote builds against tombstoned price card |
| 19 | .a | `product-types.ts:23` | E2 GET /v1/product-types/:id | Lookup detail; list sibling L13 ✅ guards |
| 20 | .a | `product-groups.ts:23` | E2 GET /v1/product-groups/:id | Same pattern, symmetric file |
| 21 | .a | `service-catalog.ts:37` | E2 GET /v1/services/:id | Service catalog detail; list sibling L12 ✅ guards |

**Pattern crystallisation**: across 4 of 5 ops-catalog files (products + product-types + product-groups + service-catalog) the **identical author bug** appears — `GET /list` correctly filters `isNull(deleted_at)`, **`GET /:id` forgets the same filter**. This is now a 4-domain consistent finding (finance + ops-property + ops-catalog all show it). The recommendation #2 (CI lint) is justified by this pattern density: a per-PR grep would have caught all 5 of these on first commit.

**Sub-pattern .b** — 1 new candidate, partial:

| # | Sub | File:line | Endpoint | Note |
|---|---|---|---|---|
| 22 | .b? | `service-catalog.ts:60-66` | E4 PUT /v1/services/:id | `{ id: _id, created_at, ...updates }` strips `id` and `created_at` but **does not strip `deleted_at`** → client `{ "deleted_at": null }` revives a tombstoned service. Same hazard as PR4/PR7 (.b carrier) but here gated behind explicit client cooperation, hence "partial" / weaker than the unconditional ops-property revival. **Recommend**: explicitly drop `deleted_at` from the spread before update. |

**Updated anchor count**: 14 .a + 2 + .b 2 = **18 .a / 3 .b = 21 total**. (Pre-T002.2.d: 14 .a + 2 .b = 16; post: 18 .a + 3 .b = 21.) Carrier: [`api-endpoints/ops-catalog.md` §1.4 + §3.2/3.3/3.4/3.5](../_schema/api-endpoints/ops-catalog.md) + §4.1 column totals (5 leak / 1 revival of 39).

---

## CF-021 — N+1 enrichment anti-pattern: per-row follow-up SELECTs in JS rather than SQL JOIN

| Field | Value |
|---|---|
| **Severity** | 🟡 P1 |
| **Status** | OPEN — promoted from candidate at T002.1.9 (8 anchors across 3 domains) |
| **Origin** | T002.2.b half-2 (CF-021 candidate, 2 anchors) → T002.2.c (+6 anchors → 8) → T002.1.9 promotion |
| **Affected** | List endpoints under traffic load; guest portal browse path; admin dashboards; Phase 2 latency budgets |

### Pattern definition

A list-style endpoint returns N rows from a primary table, then in JavaScript iterates the N rows and issues one or more follow-up `db.select().from(<related table>)` per row (or per primary FK). This produces **N×K additional round-trips** where K is the enrichment degree (number of related tables fetched per primary row), instead of the single JOIN that SQL would have permitted.

### Anchor table (8 of 8)

| # | File:line | Endpoint | Degree (K) | Worst-case at default page size 50 |
|---|---|---|---:|---:|
| 1 | `spaces.ts:32-54` (helper `buildSpaceResponse`) called by SP2 (POST returning created space) | 1 row × 4 follow-ups | 4 | 4 round-trips (single-row case) |
| 2 | same helper called by SP3 GET list | N rows × 4 follow-ups | 4 | **200** round-trips for 50-space list |
| 3 | same helper called by SP4 PUT returning updated space | 1 row × 4 follow-ups | 4 | 4 |
| 4 | `properties.ts:69-71` PR3 GET list — per-row suburb name SELECT | 1 | **50** for 50-property list |
| 5 | `properties.ts:150-152` PR4 PUT — same suburb follow-up | 1 | 1 (single-row case) |
| 6 | `properties.ts:225-227` PR7 PATCH status — same | 1 | 1 |
| 7 | (prior, finance-payments) commission list enrichment | 1-2 | per T002.2.b half-2 |
| 8 | (prior, finance-payments) beneficiaries list enrichment | 1-2 | per T002.2.b half-2 |

### Quantification (justifies P1, not P2)

`spaces.ts` SP3 (anchor #2) is the **guest portal browse path** — every visitor to MillionStay sees a list of spaces. At default page size 50:
- 1 SELECT for the space list (the "1") → returns 50 rows
- For each of 50 rows: 4 SELECTs (property + policy + parent space + option_maps) → 200 follow-ups
- **Total: 201 round-trips per list call** instead of 1 with proper JOINs

At 100 concurrent browsers each opening a fresh list page, that is 20,100 round-trips/sec against the connection pool. Postgres connection pool default in this project is **single digits**; the request will queue and time out under modest load. Phase 2 .NET port using EF Core `.Include()` would collapse this to the single-query JOIN by default; preserving the current pattern in C# would carry the latency forward unchanged.

### Recommendation (no code change)

1. Replace the helper-driven N+1 pattern with a single Drizzle `db.select(...).from(spaces).leftJoin(properties, ...).leftJoin(spacePolicies, ...).leftJoin(spaceOptionMaps, ...)` — or batch-fetch related rows once per list and lookup-map them in JS (acceptable when JOINs would explode columns).
2. **Phase 2**: define EF Core navigation properties and use `.Include(s => s.Property).Include(s => s.Policy)...` in queries. The framework emits a single SQL statement.
3. Add a load-test gate before production cut-over: GET `/api/v1/spaces?limit=50` × 100 concurrent users; assert P95 latency < 200 ms.

### Carrier

`ops-property.md` §3 row C3-NPLUS1 (originating site, helper enumeration) + `_schema/api-endpoints/finance-payments.md` (2 prior anchors). T002.2.d (`ops-catalog.md`) likely to surface `service-catalog` enrichment anchors; T002.2.e (`ops-crm.md`) likely to surface `work-orders` + `leads` enrichment anchors.

### CF-021 ops-catalog expansion (T002.2.d — anchor count 8 → 10)

T002.2.d adds **2 net new anchors** of the **same per-row enrichment shape**, both with sub-2 degrees per row:

| # | File:line | Endpoint | Degree (K) | Worst-case |
|---|---|---|---:|---:|
| 9 | `products.ts:7-37` (helper `enrich()`) called by E2 GET list (L41) | N rows × 2 follow-ups (promotions map + product-types map) | 2 | **100** round-trips for 50-row product list |
| 10 | `product-catalog.ts:100-125` E5 GET /v1/properties/:id/contract-products | 1 row × 4 sequential SELECT chain (property → space-list → contract-list → contract-product-list) | 4 | 4 round-trips per single-property fetch |

**Variant note**: anchor #9 is **batch-enrichment** — `enrich()` does **2 SELECTs total** (`SELECT … WHERE id IN (...)`) regardless of row count, then maps in JS. This is the *correct* fix for the helper pattern. The "100 round-trips" overstates: actual cost is `1 (list) + 2 (batch enrich) = 3 round-trips for 50-row list`. **This anchor demonstrates the fix-shape**, not the bug — keep counted as part of pattern audit but note as a positive exemplar.

Anchor #10 is the *true* N+1 family — 4 sequential single-row SELECTs in a chain (each waits for the prior `id` field). Single property today = 4 round-trips (acceptable); but if the endpoint is ever called list-style (admin "show all properties' contract-products at once") the 4 multiplies by N.

**Updated anchor count**: **10 total** (3 spaces + 3 properties + 2 finance + 2 ops-catalog). Anchor #9 carries an asterisk in `ops-catalog.md` §3.2 calling out it is a *positive* exemplar of the recommended batch-fetch fix. Carrier: [`api-endpoints/ops-catalog.md` §3.2 + §3.5](../_schema/api-endpoints/ops-catalog.md).

### CF-001 ops-catalog carrier expansion (T002.2.d — +5 carrier columns)

T002.2.d enumerates **5 ops-catalog `real` money columns** newly anchored (vs. the prior CF-001 inventory of 14 columns across finance + ops-property). The owner of these is `ops-catalog`, not `ops-property` — the schema separation matters for Phase 2 module ownership.

**Live carriers (1 column, 1 site)**:

| Schema column | File:line | Read by | Written by | Status |
|---|---|---|---|---|
| `service_catalog.base_price` | `lib/db/src/schema/service_catalog.ts:8` | `service-catalog.ts:12,37` (E1 list, E2 detail) | `service-catalog.ts:48,60-66` (E3 POST, E4 PUT spread) | LIVE — propagates into `space_service_catalog.custom_price` (already counted) when copy-on-attach via PR21 (`spaces.ts:451`) |

**Dead carriers (4 columns, schema-only — see CF-009 cross-ref above)**:

| Schema column | File:line | Read sites | Status |
|---|---|---:|---|
| `product_catalog.price` | `lib/db/src/schema/product_catalog.ts:8` | 0 | 🪦 GHOST — only enumerated for completeness; no code reads or writes it. CF-009 recommends DROP. |
| `product_catalog.bond_amount` | `:18` | 0 | same |
| `product_catalog.admin_fee` | `:19` | 0 | same |
| `product_catalog.cleaning_fee` | `:20` | 0 | same |

**Cross-domain note**: ops-catalog owns the `service_catalog.base_price` upstream that `ops-property` already counted as a downstream carrier (see CF-001 carrier sub-list `service_catalog.base_price + space_service_catalog.custom_price`). T002.2.d formally claims `service_catalog.base_price` for ops-catalog; ops-property keeps `space_service_catalog.custom_price` (its own table). The 4 ghost columns are inert today but **must be deleted alongside the table** if CF-009 recommendation #1 lands, otherwise Phase 2 will inherit 4 dead `decimal` columns in C# entity definitions.

**Updated CF-001 carrier sub-list count**: prior 14 + 1 live (service_catalog.base_price reattributed to ops-catalog) + 4 ghost = **15 live + 4 ghost = 19 total `real` carrier columns** documented across finance + ops-property + ops-catalog. T002.2.e (ops-crm) will surface `work_orders.cost` evidence (already in CF-001 inventory list, now needing route-anchor).

Carrier: [`api-endpoints/ops-catalog.md` §1.2 + §1.5 + §6 R-REPO-5 I3](../_schema/api-endpoints/ops-catalog.md).

---

## CF-023 — Lead-to-booking conversion creates orphan reference (T002.2.e.fix-1 promotion, P1)

**Severity**: 🟡 P1 (production data integrity + client trust + audit invisibility)
**Promoted**: T002.2.e.fix-1 (from Step 6 R-REPO-5 incidental "L7 fake booking_ref" + V2 verification)
**Scope**: Single endpoint, single file (`leads.ts:175-204`) — narrow but production-critical

### Evidence (file:line — R-REPO-6 verified)

| # | Site | Code excerpt | Defect |
|---|---|---|---|
| 1 | `leads.ts:188-189` | `const year = new Date().getFullYear();`<br>`const bookingRef = "BK-${year}-${String(Math.floor(Math.random() * 90000) + 10000)}";` | `booking_ref` is **client-side `Math.random()` 5-digit string** with **no FK, no uniqueness check, no DB lookup, no `bookings` table coordination** — collisions ~1/90000 per year |
| 2 | `leads.ts:191-198` | `db.update(leadsTable).set({ lead_status: "ConvertedToBooking", converted_at: new Date(), updated_at: new Date() })` | UPDATE set **omits `converted_booking_id`** despite schema column existing (cf. site 4); leads row marked converted but no link to a (non-existent) booking row |
| 3 | (absent) `leads.ts:175-204` | (no `db.insert(bookingsTable)` anywhere in handler body) | **`bookings` table receives 0 INSERTs** — handler never creates a booking row that matches `bookingRef` |
| 4 | `lib/db/src/schema/leads.ts:24` | `converted_booking_id: integer("converted_booking_id"),` | Schema column **exists** (nullable integer, no FK declaration per CF-003) — designed to hold the booking PK reference, but the handler never populates it |
| 5 | `leads.ts:199-202` | `res.json({ booking_ref: bookingRef, lead_ref: updated!.lead_ref });` | Response returns **fabricated `booking_ref`** to client; client believes booking was created and may display it on confirmation UI |
| 6 | (absent) `leads.ts:175-204` | (no `logAction(...)` call anywhere) | **No audit log** — compounds CF-008; no post-hoc reconstruction possible (which lead became which "booking") |

### Production failure scenarios

1. **Client trust**: CRM agent clicks "Convert to Booking" → UI shows success + `booking_ref` → guest is told "booking BK-2026-12345 confirmed" → guest arrives expecting reservation → **bookings table has no such row** → check-in failure, refund/dispute escalation
2. **Revenue reporting**: BI queries `SELECT COUNT(*) FROM leads WHERE lead_status='ConvertedToBooking'` for "conversion rate" KPI **vs** `SELECT COUNT(*) FROM bookings WHERE source='lead_conversion'` for "actual bookings" KPI → **two numbers diverge by exactly the count of this endpoint's invocations**, silently under-reporting actual bookings (zero) and over-reporting conversions
3. **Audit invisibility**: no `logAction` (CF-008 ops-crm 0/51) + no booking row + `converted_booking_id=NULL` → **forensic reconstruction impossible**; "which lead → which booking?" has no answer
4. **Re-conversion**: status check at `leads.ts:184` blocks re-conversion of `ConvertedToBooking`-status leads, but lacks state-transition gate audit (CF-022 compound) → manual DB update flipping status back to "New" allows infinite re-issue of fake `booking_ref` strings
5. **Collision risk**: `Math.random() * 90000` → ~1/90000 collision probability per year per generated ref; over 1000 conversions/year = ~5.5% chance of duplicate `booking_ref` in client logs / email confirmations

### Compound failures (cross-CF)

- **CF-008** (audit gap): handler is in ops-crm domain (TIED LOWEST 0/51 = 0% logAction coverage) → no audit trail, defect invisible until guest complains
- **CF-022** (state-transition guard inconsistency): leads.ts:175 has `if (lead.lead_status === "ConvertedToBooking") { ...400 }` precondition (counted as gated in CF-022 leads.ts 1/2 split) but does NOT gate against re-arrival from "Lost" or other terminal states
- **CF-014** (no-transactions): even if a future fix adds `bookings INSERT` + `leads UPDATE`, both must execute atomically inside `db.transaction(...)` — current zero-tx pattern would allow partial completion (booking row created, lead status not updated, or vice versa)
- **CF-003** (no `references()` FK): even when populated, `converted_booking_id` cannot be RI-enforced at DB level — application code bears full responsibility

### Recovery / fix recommendation (Phase 2 .NET port)

1. **Replace handler body** with transactional INSERT-then-UPDATE:
   - Wrap in `db.transaction(async (tx) => { ... })` (CF-014 fix)
   - INSERT into `bookings` first, capture returned PK
   - UPDATE leads: `set({ lead_status: "ConvertedToBooking", converted_booking_id: <new booking PK>, converted_at, updated_at })`
   - Generate `booking_ref` from a **DB sequence** or from `bookings.id` post-INSERT, never client-side random
2. **Add `logAction`** call (CF-008 fix): `logAction("lead.converted", { lead_id, booking_id, agent_id })`
3. **Add `references()` FK** declaration (CF-003 fix): `converted_booking_id: integer("converted_booking_id").references(() => bookings.id)`
4. **Add reverse-direction state-transition gate** (CF-022 fix): block conversion from terminal states (Lost, Cancelled) explicitly, not just from `ConvertedToBooking`

### Cross-references

- Carrier endpoint doc: `_schema/api-endpoints/ops-crm.md` §3.2.7 (L7 ConvertedToBooking transition)
- State machine doc (T002.5, pending): MUST encode dual-source-of-truth defect on bookings/leads diagram — `leads.lead_status='ConvertedToBooking'` is currently a write-only sentinel, not a true state in the bookings lifecycle
- CF-008 anchors: `_schema/api-endpoints/ops-crm.md` §1.4 (0/51 logAction coverage)
- CF-022 anchors: §6 above (leads.ts 1/2 ungated split)

---

## CF-023.b — Fake-ref generator with real INSERT (T002.2.f sub-split, P1)

**Severity**: 🟡 P1 (data-quality + downstream-consumer drift; no orphan, no integrity violation)
**Promoted**: T002.2.f (split from CF-023 root cause "ad-hoc `booking_ref` generation outside canonical helper")
**Scope**: Single endpoint, single file (`guest-portal.ts:85-195`) — narrow but **second carrier** of the same root cause as CF-023.a

### Evidence (file:line — R-REPO-6 verified)

| # | Site | Code excerpt | Defect |
|---|---|---|---|
| 1 | `guest-portal.ts:138-141` | `const timestamp = Date.now().toString(36).toUpperCase();`<br>`const random = Math.random().toString(36).substring(2, 5).toUpperCase();`<br>`const booking_ref = \`GBK-${timestamp}-${random}\`;` | `booking_ref` generated client-side from `Date.now()` + `Math.random()` 3-char base36 — collision space ~46 656 per ms; no DB UNIQUE constraint asserted on `bookings.booking_ref` (cross-check schema in T002.3) |
| 2 | `guest-portal.ts:149-171` | `const [newBooking] = await db.insert(bookingsTable).values({ booking_ref, account_id, space_id, ..., booking_status: "Pending", booking_source: "Guest Portal", status: "Active", }).returning(...)` | **Real `bookings` INSERT** — distinguishes this from CF-023.a (no orphan, ref points to a real row) |
| 3 | `bookings.ts:60` (canonical helper, NOT used here) | `async function generateBookingRef(): Promise<string> { ... return \`MS-${year}-${seq.padStart(5,"0")}\`; }` | **Canonical generator exists** with proper sequential pattern (DB `COUNT(*) WHERE EXTRACT(YEAR)`) but is bypassed by this handler — guest-portal author wrote ad-hoc generator inline |
| 4 | (consumer assumption) admin search/filter UIs | (not enumerated in this audit; T006 design pack) | Downstream UIs assuming `MS-…` prefix for filtering / display formatting silently miss `GBK-…` rows from guest portal |

### Distinction from CF-023.a

| Aspect | CF-023.a (`leads.ts:175-204`) | CF-023.b (`guest-portal.ts:85-195`) |
|---|---|---|
| Generation pattern | `BK-${year}-${Math.random()×5}` | `GBK-${Date.now()36}-${Math.random()36×3}` |
| `bookings` INSERT? | ❌ NO — orphan | ✅ YES — real row created |
| `converted_booking_id` populated? | ❌ schema column NULL forever | n/a (different relation) |
| Client trust impact | 🔴 fake ref → check-in failure | 🟢 ref points to real row → no immediate failure |
| Reporting impact | 🔴 conversions over-reported, bookings under-reported | 🟡 booking volume correct, but ref-prefix split confuses analytics |
| Severity | P1 (production-critical integrity) | P1 (data-quality + drift) |
| Recovery | Fix handler to actually INSERT + add FK | Fix handler to call `generateBookingRef()` helper |

### Production failure scenarios (.b-specific)

1. **Search UX drift**: admin types `MS-2026-` into booking search UI → 0 matches for guest-portal-originated bookings → ops thinks guest never booked → opens duplicate booking, double-charges
2. **Reporting bucket mismatch**: BI splits bookings by ref-prefix as proxy for `booking_source` → `MS-…` (admin-created) vs `GBK-…` (guest portal) coexist → if `booking_source` column is later dropped or null-filled, prefix-grouping silently fails
3. **Collision (lower probability than .a)**: `Math.random().substring(2,5)` yields ~46 656 distinct values per timestamp millisecond — under bursty load (many guests booking the same instant), collisions possible but rare; no DB UNIQUE protection means duplicate refs can persist
4. **Confirmation-email leak**: `booking_ref` is included in `sendBookingConfirmation(...)` (`guest-portal.ts:177-188`) → guest receives `GBK-…` in email → guest later contacts support quoting `GBK-…` → support system search by `MS-` prefix returns nothing → escalation friction

### Compound failures (cross-CF)

- **CF-008** (audit gap): no `logAction` on this handler — booking creation event invisible
- **CF-014** (no transaction): N/A — single DB write (`bookings` INSERT only); email is fire-and-forget outside tx-need
- **CF-017** (input validation): `space_id`, `check_in_date`, `check_out_date`, `num_guests` all unvalidated — type/range/format check absent
- **CF-019** (write-orphan family): not a write-orphan per se — `booking_ref` is read after write (returned to client) — different etiology from CF-019.a / .b

### Recovery / fix recommendation (Phase 2 .NET port)

1. **Replace L138-141** with single call to the canonical helper:
   ```ts
   const booking_ref = await generateBookingRef();
   ```
2. **Add DB UNIQUE constraint** on `bookings.booking_ref` (schema migration, T002.3 to flag)
3. **Add `logAction`** call (CF-008 fix): `logAction("booking.created", { booking_id, booking_ref, source: "guest_portal" })`
4. **Add Zod validation** on body (CF-017 fix): enforce `space_id: number`, `check_in_date: ISO-date`, `num_guests: 1..N`

### Cross-references

- Carrier endpoint doc: `_schema/api-endpoints/portal-guest.md` §3.1 (E5 POST `/v1/guest/bookings`)
- CF-023.a (parent) anchors: §1490-1539 above
- T002.5 (state-machines.md, pending): MUST document dual-source-of-truth on `bookings.booking_ref` — three spawn paths (`MS-…` canonical / `GBK-…` guest-portal / `BK-…` orphan from leads)
- T002.3 (db-schema-overview.md, pending): MUST note absence of UNIQUE constraint on `bookings.booking_ref` despite multiple insertion paths

---

## CF-024 — Project-wide rate limiting absence (T002.2.h promotion, P1)

**Severity**: 🟡 **P1** (operational + security; not data-loss but enables DDoS / brute-force / spam at scale)
**Promoted at**: T002.2.h (`public.md`) — graduated from Step-1 [WW] sealed finding.

### Evidence

- **Codebase grep** (`rg "rate.?limit|express-rate-limit|rateLimit"` across `artifacts/api-server/src/` + `lib/`): **0 hits**.
- **Package dependency check** (`artifacts/api-server/package.json`): no dependency on `express-rate-limit`, `rate-limiter-flexible`, `express-slow-down`, or any equivalent throttling library.
- **No middleware applies request-rate caps** anywhere in `app.ts` (verified by reading `app.ts:84-180` registration block).

### Worst-exposed surface (unauthenticated mutation entry points)

| Endpoint | File:Line | Mutation effect | Risk |
|----------|-----------|-----------------|------|
| `POST /v1/public/owner-applications` | `public.ts:735-785` | INSERT into `leads` (`lead_source="OwnerPortal"`) via `insertLeadWithGeneratedRef` | Spam-flood `leads` table; DDoS-amplifies `generateLeadRef` (full SELECT per call — see CF-021 helper-internal carrier) |
| `POST /v1/public/agent-applications` | `public.ts:787-831` | Same | Same |
| `POST /v1/public/service-host-applications` | `public.ts:833-884` | Same | Same |
| `POST /v1/auth/login` | `auth.ts` | Session establish | Brute-force window |
| `POST /v1/auth/register` | `auth.ts` | Account create | Account-spawn flood |
| `POST /v1/partner-auth/login` | `partner-auth.ts:43` (T002.2.g anchor) | Partner JWT mint | Brute-force partner accounts |
| `POST /v1/partner-auth/reset-password` | `partner-auth.ts` | Password-reset email enumerate | Account-existence enumeration via timing/response |
| `POST /v1/guest-auth/login` | `guest-auth.ts` (T002.2.f) | Guest session establish | Brute-force guest accounts |
| `POST /v1/guest-auth/register` | `guest-auth.ts` | Guest account create | Account-spawn flood |

### Authenticated surface (also uncapped)

All ~339 admin-protected endpoints across `routes/index.ts` aggregator (lookup, blog-posts, page-contents, contracts, bookings, invoices, payments, work-orders, etc.) lack throttling. **Session-level abuse is uncapped** — a compromised session token yields unlimited request rate.

### Why NOT promoted earlier

Earlier sub-tasks (T002.2.a–.g) operated on **authenticated-only** domains, where the missing throttling is one defensive layer of many. T002.2.h surfaces three **unauthenticated** lead-INSERT entries simultaneously, making the absence operationally critical (lead-list pollution + helper N+1 amplification → DB load).

### Recovery / fix recommendation (Phase 2 .NET port)

1. **Adopt `Microsoft.AspNetCore.RateLimiting`** (built into ASP.NET Core 7+) as the primary middleware.
2. **Three-tier limit policy** (initial proposal — finalize at T004 `_rules/security-rules.md`):
   - **public-unauthenticated**: 10 req/min per source IP for `*-applications` POST + `auth/*` `register` & `login` (sliding window)
   - **public-read**: 100 req/min per source IP for `/v1/public/*` GET + `/v1/health*` + `/v1/privacy/*`
   - **authenticated**: 1000 req/min per session/account-id for all `/v1/...` after `requireAuth`
3. **Response contract**: 429 `Too Many Requests` with `Retry-After` header (seconds).
4. **Logging hook**: emit a structured audit event (`logAction("rate_limit.exceeded", { route, identity, count })`) — also closes a CF-008 evidence carrier here.

### Cross-references

- Carrier endpoint doc: `_schema/api-endpoints/public.md` §3.2 (this sub-task)
- CF-021 helper-internal carrier: `lib/leadRef.ts:5-12` `generateLeadRef` full-table SELECT (DDoS amplifier under unthrottled application POSTs)
- CF-008: rate-limit violation logging proposed as new audit event (closes one entry of the audit gap)
- T002.2.f / .g cross-link: guest-auth + partner-auth login endpoints (also uncapped — same fix policy)
- T004 (`_rules/security-rules.md`, pending): MUST encode the three-tier policy as an architecture rule
- T002.5 (`state-machines.md`, pending): no direct overlap (rate-limit is gateway-layer, not state-machine)

### Counts impact

P0=3 / P1=17→**18** / P2=3 → total **24** (single new P1 promotion).

---

## CF-023 — Cross-domain verification CLOSED at T002.2.h

(Marker section — does not change CF-023 / .b severity or content.)

After T002.2.h, all 9 audit domains have been scanned for `bookings.booking_ref` minting paths and lead/booking write-orphan patterns. Coverage map:

| Domain | Status | Audited at | Outcome |
|--------|--------|-----------|---------|
| `leads.ts` | **.a anchor** | T002.1.7 + reaffirmed T002.2.h §3.1 | Orphan `BK-` ref via `Math.random()`, no booking INSERT |
| `finance-invoicing` | clean | T002.2.b half-1 | No anchor sites |
| `finance-payments` | clean | T002.2.b half-2 | No anchor sites |
| `ops-property` | clean | T002.2.c | No anchor sites |
| `ops-catalog` | clean | T002.2.d | No anchor sites |
| `ops-crm` | clean | T002.2.e | No anchor sites |
| `portal-guest` | **.b sub-pattern** | T002.2.f | Consumer-side fake-ref + INSERT in 1 isolated site |
| `portal-partner` | **REJECT** | T002.2.g | Consumer-drift hypothesis falsified (read-only consumer; flat ownership) |
| `public.ts` | helper analyzed | T002.2.h §3.1 | Helper safe; option (가) — leads.ts:175-204 confirmed sole outlier |

**Search status**: cross-domain scan **CLOSED**. T002.3 / T002.5 future evidence additions are evidence-row expansions to existing sub-IDs only; no further cross-domain hunt required. T002.2.i (admin.md) may surface additional admin-side carriers but those are within-domain expansions, not new cross-domain regions.

---

## T002.3 — Schema-side anchor confirmation (no severity change)

(Marker section — does not change CF severity, count, or content. Records that 6 existing CF have schema-side evidence permanently anchored in `_schema/db-schema-overview.md` §6.)

**Counts after T002.3**: P0=4, P1=18, P2=3 (total **25**) — **0 NEW promotions / 0 changes**. T002.3 is a schema-overview sub-task; CF surface unchanged.

| CF | Schema anchor in `db-schema-overview.md` | Quantitative anchor |
|---|---|---|
| **CF-001** (real ↔ numeric money inconsistency) | §2.3 + §6.1 | 39 `real` cols vs 12 `numeric(p,s)` cols (3.25:1 ratio); decisive lossy site = `bookings.total_rent numeric(12,2)` → `contracts.total_rent real` (executed by `contracts.ts:55-237` activate helper per CF-014) |
| **CF-003** (`references()` = 0 — no DB-level RI) | §3.1 + §4 | `rg 'references\(' lib/db/src/schema/` = **0 hits**; §4 enumerates **53 implicit FK + ≥8 polymorphic** that the missing `references()` would have declared |
| **CF-009** (DEAD `product_catalog` schema) | §5.2 + Appendix A | 5 zero-route-hit tables surfaced: `product_catalog` (T002.1.6 confirmed) + `space_option_maps` / `space_blocked_dates` (high confidence) + `cs_messages` / `guest_direct_messages` (medium confidence — raw-SQL false-positive risk). 4 schema-only finds parked as F4 memo for T004 `_rules` bulk processing — **CF-009 expansion deferred** to T004 |
| **CF-013** (date / timezone) | §2.4 + §6.4 | 145 no-tz vs 123 with-tz timestamps (54% no-tz); **11 text-date sites** newly enumerated (`contracts` 4 + `space_blocked_dates` 1 + `contacts` 4 incl. DOB/passport_expiry/visa_expiry + `promotions` 2) — text-date is type drift sub-issue, anchored as schema-side evidence |
| **CF-016** (file/table/variable naming inconsistency) | §1.2 + §6.5 | 8 file ≠ table + 6 var ≠ table + **5 type drift sub-instances** (`is_published integer` / `is_internal integer` boolean drift; `csMessagesTable` vs hypothesised `csTicketMessagesTable`; `guestDirectMessagesTable` cross-domain placement; `default(sql\`now()\`)` vs `defaultNow()`) |
| **CF-019** (write-orphan stripe columns) | §6.6 + Appendix D | 2 schema-side anchor cols: `invoices.stripe_payment_intent_id text` + `payment_info.stripe_account_id text` — both are NULLABLE text without integrity constraint and Pathway 2.b half-2 confirmed only stripe webhook handler writes them (no sync trigger) |

### Schema-only findings F1-F6 (all single-memo dispositions)

T002.3 surfaced 6 schema-level patterns that do NOT meet promotion threshold (insufficient anchor density / cosmetic) but warrant T004 `_rules` bulk processing:

| # | Finding | Severity (informal) | Disposition |
|---|---|---|---|
| F1 | `space_availability.ts:16` INDEX duplicates Pg-auto-generated UNIQUE-constraint index | P3 / cosmetic | T004 `_rules/architecture-rules.md` "duplicate index" |
| F2 | `bookings.product_id` + `bookings.contract_product_id` both reference `contract_products` — semantic redundancy / one likely dead | P2 / data-clarity | T002.4 `erd-core.md` dotted-line both + T004 prescription |
| F3 | `space_blocked_dates.date = text` vs `space_availability.date = date` — type + responsibility overlap | P2 / type-drift | T002.5 `state-machines.md` availability diagram + T004 |
| F4 | DEAD 5 sites = CF-009 expansion candidate (4 of 5 schema-only) | P2 | T004 `_rules` bulk processing |
| F5 | ≥8 polymorphic FK with discriminator pattern (`refresh_tokens`, `marketing_consents`, `cs_messages`, `system_log`, `email_log`, `documents`, `contacts.portal_user_id`, `booking_service_photos`) — schema-level integrity unverifiable | P1-equivalent / sibling-of-CF-018 | T002.4 `erd-core.md` separate "polymorphic relationships" + T002.5 actor branching |
| F6 | `is_published integer` / `is_internal integer` boolean drift | P3 / cosmetic | CF-016 sub-pattern, already cross-ref'd at T002 endpoint stage |

### Quantitative ground-truth corrections (R-REPO-6 (a))

- **UNIQUE count**: T002.3 Step 1 사전 분류 보고 **14** sites (single-column only); 본문 작성 중 실측 **16** sites (단일 14 + compound 2: `space_availability(space_id,date)` at `space_availability.ts:15` + `page_contents(page_key,language)` at `page_contents.ts:13`). Compound `unique()` 가 Step 1 카운트에서 누락 → 본문 §3.2 가 정정-진실. T002.3 Step 4 spot-check C2 (UNIQUE-gap × 23505 catch 매핑) 는 16 기준으로 재실행 (6 catch / 16 UNIQUE = 37.5% coverage 확정).

---

*End of CRITICAL_FINDINGS.md*

## T002.4 — ERD Core 시각화 + Phase 2 RI baseline (no severity change)

(Marker section — does not change CF severity, count, or content. Records that 6 schema-anchored CF + 2 schema-only findings F4/F5 have ERD-side visualisation permanently anchored in `_schema/erd-core.md`, and that **CF-003 + CF-009** receive quantitative evidence expansion.)

**Counts after T002.4**: P0=4, P1=18, P2=3 (total **25**) — **0 NEW promotions / 0 changes**. T002.4 is an ERD visualisation sub-task; CF surface unchanged. CF-003 / CF-009 evidence rows expanded only.

### CF-003 evidence expansion — 53 implicit FK + 10 polymorphic = **83 RI rows** for EF Core scaffolding

T002.3 §4 enumerated 53 implicit FK at column-grain. T002.4 §11 권장 FK 부록 re-decomposes per-policy (`ON DELETE` / `ON UPDATE` per row) yielding **73 policy rows** + §10 polymorphic enumeration **10 sites** = **83 RI rows** Phase 2 EF Core baseline.

| Source | Count | Form factor |
|---|---:|---|
| §11.1 Property cluster | 14 | 정책-단위 row (CASCADE/RESTRICT/SET NULL/NO ACTION 결정) |
| §11.2 Catalog cluster | 14 | 동일 |
| §11.3 Booking + Contract + Finance | 28 | 동일 (F2 두 컬럼 분해 포함) |
| §11.4 Identity + CRM + Ops | 17 | 동일 (자기참조 + leaf 보충 포함) |
| **Implicit FK 정책 row** | **73** | T002.3 53-col-grain → +20 정책 분해 보충 |
| §10 Polymorphic enumeration | 10 | discriminator-based (P1-P10) |
| **TOTAL RI baseline** | **83** | Phase 2 `OnModelCreating` source |

**T002.3 53 vs T002.4 73 차이 +20 해석** (R-REPO-6 자가 검증, erd-core.md §13.2): T002.3 § 4 = pgTable column 기준 컴팩트 카운트. T002.4 §11 = Phase 2 정책-단위 row 분해 (자기참조 + leaf 보충 + 일부 누락 cluster 보충). 두 카운트 모두 ground truth 의 다른 cut, 양립.

**위험 등급 — 10 polymorphic FK** (erd-core.md §10):
- **HIGH** (P5/P7/P8 — open-ended `entity_type`): `system_logs.entity_id` / `email_logs.entity_id` / `documents.entity_id` 가 임의 entity table 가리킴; cascade-delete 시 일관성 검증 매뉴얼 SQL 필수. F5 schema-only finding (T002.3 §6.7) sibling-of-CF-018.
- **MEDIUM** (P1/P6/P9 — 3-way limited): `refresh_tokens.user_id` / `system_logs.actor_id` / `documents.uploaded_by` discriminator enum 강제 부재 → typo 가능 (CF-018 Sub-pattern B sibling).
- **LOW** (P2/P3/P4 — 2-way 또는 잠정 1-way): `marketing_consents` / `booking_service_photos` / `cs_messages` 현재 1-2 user_type 만 활성.

**Phase 2 prescription** (T004 `_rules` 권장 inputs):
- P5/P7/P8 = polymorphic association junction table 분리 (`<source>_<target>_links`)
- P1/P2/P6/P9 = `enum` constraint + 분기 partial index
- P10 (`contacts.portal_user_id text`) = type drift 정정 필수 (text → integer FK)

### CF-009 evidence expansion — DEAD 1 → 5 candidates (3 high + 2 medium)

T002.3 §5.2 cross-ref matrix 가 endpoint-side 0-route-hit 5 sites 발굴. T002.4 erd-core.md §12 DEAD tables 부록 = 2-tier confidence marker + Phase 2 액션 매핑.

| ID | Table | File:Line | Confidence | Phase 2 Action | T002.4 ERD marker |
|---|---|---|---|---|---|
| A1 | `product_catalog` | `product_catalog.ts:3` | high (T002.1.6 confirmed; 0 endpoint hit; 책임 = `contract_products`) | **DROP** + EF Core 미생성 | 🪦 |
| A2 | `space_option_maps` | `spaces.ts:34` (M:N junction with space_options) | high (0 hit; junction 의미 사라짐) | **DROP** | 🪦 |
| A3 | `space_blocked_dates` | `spaces.ts:41` | high (0 hit; 책임 = `space_availability`; F3 type drift `text` vs `date`) | **DROP** + `space_availability` 로 일원화 | 🪦 |
| A4 | `cs_messages` | `cs_tickets.ts:23` | medium (변수 import 0 hit, raw SQL false-positive 가능) | **INVESTIGATE** raw SQL audit 후 결정 | ⚰️ |
| A5 | `guest_direct_messages` | `announcements.ts:20` | medium (변수 import 0 hit, file 위치 mismatch) | **INVESTIGATE** + RENAME (announcements ↔ guest_direct 분리) | ⚰️ |

**Cleanup 권장 순서**: A1 → A2 → A3 (3 high-confidence DROP) → A4/A5 (raw SQL audit 후 결정).

**Phase 2 .NET 영향**: DEAD 5 sites EF Core 미생성 시 -5 entity / -1 DbContext leaf / -1 navigation property cluster (`product_catalog` ↔ `accommodation_catalog` 의미 충돌 제거).

**CF-009 promotion 보류 사유**: 4 추가 site (A2-A5) 는 schema-only 추적이라 endpoint 차원의 라이프사이클 확인 미수행. T002.3 F4 disposition 그대로 = T004 `_rules/architecture-rules.md` "DEAD schema retirement policy" 항목으로 일괄 처리. 본 marker = evidence 기록만, severity 변동 없음.

### F4 + F5 disposition 변동 (T002.3 → T002.4)

| # | Finding | T002.3 disposition | T002.4 disposition |
|---|---|---|---|
| F4 | DEAD 5 sites (CF-009 expansion) | T004 `_rules` 일괄 처리 | **erd-core.md §12 부록에서 시각화 + 액션 매핑** + T004 `_rules` 일괄 처리 (정책 결정만 위임) |
| F5 | 6+ polymorphic FK + discriminator 패턴 | T002.4 separate "polymorphic relationships" 섹션 + T002.5 actor 분기 | **erd-core.md §10 enumeration 10 sites + 위험 등급 + Phase 2 prescription 완료** + T002.5 state-machines.md 에서 actor 분기 사용 |

F4/F5 = T002.4 에서 시각화 + 액션 단계까지 완료. 나머지 정책 결정 (CASCADE 정확성 등) 은 T004 / T002.5 inputs.

### R-REPO-6 (a) ground-truth correction 9회째 — Step 1 KKKK Pre-flight

T002.4 KKKK Pre-flight 시 사용자 cluster 8안 검증:
- 4 가상 table (`extensions` / `expenses` / `privacy` / `health`) — schema 0 file → corrected 8-cluster proposal 제시
- 1 누락 (`users.ts` → `admin_users` table) — corrected 매핑 추가
- 1 카운트 정정 (`bookings 3 tables` → 4 = bookings + booking_documents + booking_services + booking_service_photos)

R-REPO-6 9회째 가동 + R-REPO-9 차단 게이트 첫 적용 = corrected 8-cluster 안 사용자 채택 (option (가)) 후 Step 2 본문 작성 진입. **R-REPO-9 차단 게이트 가동 성공 사례** 영구 기록.

### R-REPO-7 trade-off 영구 기록 (erd-core.md §14 mirror)

| 결정 | 채택 | 미채택 |
|---|---|---|
| ERD 형식 | Mermaid `flowchart` + `-.->` (CF-003 시각화 가능) | `erDiagram` (dashed edge 미지원) |
| Cluster FK 표시 | (나) cluster 내부 모든 FK + cross-cluster overview 별도 | (가) overview 한 장에 53 FK 모두 / (다) major FK 만 (정보 손실) |
| Polymorphic 표시 | (i) 분기 화살표 + (iii) §10 enumeration table 조합 | (ii) annotation only (검색 어려움) |
| Cluster 8 분리 | Ops/Comm + Content 통합 14 (Content 2 단독 cluster 너무 작음) | 9 cluster (Content 분리 — diagram 1 추가 비용) |
| DEAD marker | 🪦 high (3) + ⚰️ medium (2) 2-tier (T002.0 §6 합의) | 단일 marker (confidence 표현 손실) |

---

## T002.5 — State machines 5 entity (no severity change; CF-010 본문 재작성 + 6 evidence expansion + F7 incidental)

(Marker section. T002.5 = T002 group 결산 sub-task. 동적 측면 — 5 entity status 컬럼 전이 — 코드 ground truth enumerate. **0 NEW CF promotion**. CF-010 본문 재작성 (위 § CF-010 참조) + CF-008 / CF-014 / CF-019.a / CF-022 / CF-023 evidence expansion + F7 신규 R-REPO-5 incidental memo.)

**Counts after T002.5**: P0=4, P1=18, P2=3 (total **25**) — **0 changes**. T002.4 와 동일.

### 6 CF evidence expansion (T002.5 state-machine context)

| CF | T002.5 expansion | Anchor in `state-machines.md` |
|---|---|---|
| **CF-008** | 5-entity audit-coverage matrix: invoices 80% > contracts 71% > bookings 67% > work_orders 0% = cs_tickets 0% (audit-blind floor). Producer-consumer split: admin (T002.2.i, audit data CONSUMER) vs work_orders+cs_tickets (producer-side blind). | §1 Entity Index + §7.1 |
| **CF-010** | **본문 재작성** (위 § CF-010 — 8 누락 transition 가설 → Stripe payment vs document lifecycle 분리). | §4.4 + §4.5 + §4.6 |
| **CF-014** | 3 known production runtime Tx sites (seedSync.ts:214 + dev-migration.ts:38 + service-host-portal.ts:365) vs 2 multi-step no-tx locus (bookings.S2 + contracts.TR3 activate). State-machine context = silent partial failure 위험. contracts.TR3 fallback `db.delete(WHERE contract_id=?)` 의 idempotency 시도가 status 검사 없어 이미 Paid invoice 삭제 위험 (Phase 2 footgun). | §3.3 + §7.3 |
| **CF-019.a** | invoices.stripe_payment_intent_id 0 write site 검증 강화 (`rg "stripe_payment_intent_id" artifacts/api-server/` zero hits 외 schema/audit-payload 만). W1 handler prescription 명시. | §4.5 + §7.4 |
| **CF-022** | 5-entity gated-discipline 종합 표 (cross-pack ranking): bookings 77.8% leader / cs_tickets 50% / work_orders 40% / invoices 0% = contracts 0% floor (extreme spread). booking.md §4 "9/9" claim 의 transition-grain vs 본 entity-grain 7/9 정밀 재계산 — 두 metric cross-anchored valid. | §1 + §7.2 |
| **CF-023** | 3 booking_ref generators state-entry context 매핑: bookings.ts:60 canonical (Draft entry) + guest-portal.ts:141 ad-hoc CF-023.b (Pending outlier entry — F7) + lib/leadRef.ts canonical helper. | §7.5 |

### F7 신규 R-REPO-5 incidental — Booking "Pending" outlier (memo only, no promotion)

**Evidence**: `guest-portal.ts:160` `booking_status: "Pending"` — bookings.booking_status 의 8 main state (`Draft / PendingPayment / PendingApproval / Confirmed / Active / CheckedOut / Cancelled / Archived`) 중 어느 것도 아님. + `:162` `status: "Active"` (bookings 테이블 미존재 컬럼).

**분석** (state-machines.md §8): "Pending" 진입 후 모든 admin 측 transition (S2 confirm precondition `["PendingApproval","PendingPayment"]` / S4 submit precondition `=== "Draft"` / PUT update guard `["Draft","Confirmed"]`) **모두 거부** → guest-portal C0' booking 은 dead-end state 진입 → admin promotion 경로 부재.

**Severity 보류 사유**: P1 candidate (guest booking flow 전체 마비 가능) 이지만 runtime 데이터 부재 (실제 production 영향 미확인). **본 sub-task promotion 보류** + T003 (도메인 로직) `_rules/business-rules.md` 또는 T004 `_rules/architecture-rules.md` "state literal normalisation" 일괄 처리 baseline.

**Phase 2 prescription**:
- Option A (추천): guest-portal.ts:160 `"Pending"` → `"PendingApproval"` 정정 (1 line fix; S2 precondition 와 정합).
- Option B: bookings.booking_status enum 에 `"Pending"` 추가 + 새 transition handler 신설.

### F8 추가 incidental memo (T002.5 검증 부산물; cs_tickets Resolved 부재)

cs_tickets 의 `Resolved` / `Closed` state 부재 — InProgress 진입 후 영구 → Archived (soft-delete) 만이 종료. 운영 분석 시 "해결된 티켓 수" 쿼리 불가. T004 일괄 처리.

### R-REPO-6 10번째 가동 + R-REPO-9 차단 게이트 2회째 가동 영구 기록

T002.5 KKKK Pre-flight 시 사용자 5-entity 안 검증:
- Bookings 9-state cross-pack leader (정합 — 8 main + 1 Pending outlier 정체 ground truth 검증)
- Contracts 4-state → **7-state** (Sent / Signed / Archived 3 누락; +contract_line_items.Deleted 별도 테이블)
- Invoices 5-state "Pending/Failed/Refunded/Disputed" → **5/5 가짜** (Paid 1만 우연 일치; 실제 ground truth: Draft / Sent / Paid / Archived / Void; Stripe webhook 의 stripe_status 별도 audit-only payload 와 혼동 결과)
- Work_orders "free-transition" → **half-true** (실제 6 values + 2/4 transition gated = 40%)
- Cs_tickets 3-state OK ✅

**R-REPO-6 작동 사례 가장 강력**: 사용자 invoice 5-state 안 5/5 가짜 (Paid 1만 우연 일치) — Stripe payment lifecycle 와 invoice document lifecycle 혼동 evidence. **R-REPO-9 차단 게이트 2회째 가동 = 영구 패턴 작동 확인** (corrected 5-entity enumeration 사용자 채택 후 Step 2~6 자동 진행).

### R-REPO-7 trade-off 영구 기록 (state-machines.md §9 mirror)

| 결정 | 채택 | 미채택 |
|---|---|---|
| Status taxonomy 표기 | (가) ⓑ ground truth + 사용자 안 가짜 비교 column | ⓐ entity 단일 enum / ⓒ ground truth + footnote |
| Stripe webhook 표기 | (나) ⓑ invoice 본체 + stripe_status sub-section 분리 | ⓐ single diagram / ⓒ separate entity #6 |
| Booking 9th "Pending" | (다) ⓑ §8 §X.fix sub-section + F7 incidental 등록 | ⓐ mainline 통합 / ⓒ defer to T004 |
| CF-010 본문 처리 | (라) 재작성 (제목 + evidence + 영향 + Phase 2 옵션 A/B/C) | (이전 본문 유지 + addendum) |
| Mermaid 형식 | (마) `stateDiagram-v2` (transition label + [*] terminal native) | `flowchart` (T002.4 cluster 와 의도적 차별화) / `erDiagram` |

---

## 🎯 T002 GROUP COMPLETE (T002.0 ~ T002.5)

T002 group 16 doc files in `_schema/` 모두 완료:
- 11 endpoint domain files (T002.2.a-j + booking.md baseline) + INDEX.md + SCHEMA_FILE_TABLE_MAP.md = 13 in `_schema/api-endpoints/` + `_schema/`
- db-schema-overview.md (T002.3) + erd-core.md (T002.4) + state-machines.md (T002.5) = 3 in `_schema/`

**Final counts**: P0=4 / P1=18 / P2=3 = **25 CF**. 4 R-REPO-5 incidentals 누적 (F7+F8 신규 from T002.5; F4+F5 기존). **R-REPO-9 차단 게이트 2회 가동** (T002.4 KKKK 8-cluster + T002.5 KKKK 5-entity) = 영구 패턴 작동 confirm. **R-REPO-6 10회 가동** 누적.

**Next**: T003 (도메인 로직) — **자동 시작 절대 금지**. 사용자 `proceed` + R-REPO-9 + 묶음 위임 검토 후 진입.

---

## T003 묶음 1 (booking + contract domain logic) — marker section

> Sub-task: T003 묶음 1 = `domain-logic-booking.md` (200 lines, NEW) + `domain-logic-contract.md` (315 lines, NEW). R-REPO-10 묶음 위임 첫 가동. Atomic commit = 단일 commit 1회 push.

### CF expansion (booking + contract domain anchor)

| CF | 확장 항목 | booking-side anchor | contract-side anchor |
|----|----------|---------------------|---------------------|
| CF-002 | money path source-receiver 양방향 | source: `bookings.ts:393-394` parseFloat (BR1-BR2) | receiver: `contracts.ts:458-461` real-typed 4 cols + `:569,593` line_items parseFloat |
| CF-006 | Formula B 4 site cross-ref 완성 | `bookings.ts:485` (S2 confirm) | `contracts.ts:93-94` (helper fallback) — 2 sites of 4 |
| CF-007 | bond=4주 / advance=2주 hard-code 도메인 의미 | `bookings.ts:395-396` BR1+BR2 anchor | (booking 측만 — contract 는 receiver 4 col) |
| CF-008 | 5-entity audit-coverage matrix 검증 | booking 7/9 transition = 78% (cross-pack #1) | contract 5/7 transition = 71% (cross-pack #2) |
| CF-014 | repo 최대 mutation no-tx locus 확정 | S2 ≥6+N+M, T5 ≥3 | helper §2.2 7-step ≥27 mutation no-tx (repo 최대 carrier) |
| CF-018 | Sub-pattern A booking-side 3 BAD anchor | `bookings.ts:572,728,735` (N1+T6+T7) + `:587,614` POSITIVE | (contract 측 — scoped CRUD 안전) |
| CF-022 | state-guard discipline 양극단 anchor | bookings 9/9 = 100% (cross-pack leader) | contracts 0/7 = 0% (cross-pack floor 동률) |

**Cross-pack 양극단 도메인 의미**: booking 과 contract 가 **같은 cluster 안에 정반대 패턴** 으로 공존 — `domain-logic-contract.md §6.2` cross-pack ranking 상세. 한 cluster 안 일관성 부재 = CF-024 sister 후보 (T004 architecture-rules 일괄).

### F9 신규 R-REPO-5 incidental (memo only, no promotion)

**F9 — `bookings.ts:436` PDF 본문 bond return 14-day text-only**: contract PDF 텍스트 `"The bond will be returned within 14 days after vacating, subject to inspection."` 는 코드 어디에도 14-day timer / refund handler / escrow 로직 없음. T3 check-out 시 bond return scheduling/escrow 메커니즘 부재. 운영 분쟁 시 SLA 보장 불가능. **Phase 2 = `bond_return` 별도 entity + scheduled job 필요**. T003 묶음 2 `domain-logic-payment.md` 에서 finance-side cross-ref + T004 `_rules/financial-rules.md` 일괄 처리 후보. 사용자 ack 받음.

### R-REPO-6 11회째 가동 mirror

**T003 묶음 1 Step 1 KKKKK Pre-flight**: 사용자 안 "bond 2주 / advance 4주" → 코드 ground truth 검증 결과 **SWAP 정정** = bond=4주 (`bookings.ts:395` `weeklyRate * 4`) / advance=2주 (`bookings.ts:396` `weeklyRate * 2`). swap 자체가 산출물 영향 없음 (실 코드 인용); 사용자 ack + Corrected (BR1=4주/BR2=2주) 채택. R-REPO-6 11회째 가동.

### R-REPO-9 차단 게이트 3회째 가동 mirror

**T003 묶음 1 Step 1 KKKKK Pre-flight**: 사용자 안 vs 코드 ground truth 비교 시 R-REPO-6 SWAP 정정 발생 → R-REPO-9 (b) 차단 조건 1 (R-REPO-6 환각 감지) 발동 → 게이트 후 사용자 proceed + Corrected + F9 등재 채택 후 Step 2-5 자동 진행. **R-REPO-9 영구 패턴 작동 confirm 3회째** (T002.4 + T002.5 + T003 묶음 1).

### R-REPO-10 묶음 위임 첫 가동 mirror

**T003 묶음 1 = R-REPO-10 첫 가동**: 2 sub-task (booking + contract) / 1 응답 / 1 atomic commit / 1 사용자 push. `domain-logic-contract.md §6.4` 측정 = 응답 -50% / commit -67% / push -67% 가속 효과 confirm. 묶음 2-4 영구 발효.

### Counts unchanged

P0=4 / P1=18 / P2=3 = **25 CF** (T002.5 와 동일 — T003 묶음 1 신규 promotion 0).

---


## 🎯 T003 묶음 2 (finance × 2: invoice + payment) — atomic commit marker (2026-04-27)

**Sub-tasks**: 2 (invoice + payment, R-REPO-10 묶음 위임 2회째 stable). **0 NEW promotion** (counts P0=4 / P1=18 / P2=3 = 25 unchanged from T003 묶음 1). **0 차단** (R-REPO-9 자동 진행 4회째). **R-REPO-6 환각 0** (사용자 가이드 RRRRR-UUUUU 전부 코드 일치).

### 6 CF expansion (no severity change)

| CF | T003 묶음 2 추가 evidence | invoice 측 anchor | payment 측 anchor |
|----|--------------------------|-------------------|-------------------|
| CF-001 | 본 도메인 양극단 — invoices.amount=numeric (정밀 보존 ✓) vs commissions.amount=real (정밀 손실 ⚠️) finance-internal split | invoice §1 BR1 (numeric ✓) | payment §1.2 BR1 (commissions=real) |
| CF-008 | (가) booking 26%/78% 두 측정 단위 차이 명확화 — endpoint-grain (7/27=26%) vs transition-grain (7/9=78%); (나) finance polarisation invoices 60% vs payment 0% = 60% gap (단일 도메인 내부 양극단) | invoice §4 audit matrix 60% endpoint + 60% transition | payment §4 audit matrix 0/24 = **0% (repo-wide max-carrier floor)** |
| CF-010 | webhook bypass + chargeback/dispute carrier — Stripe 3 case + default `console.log` only | invoice §1.3 BR11-BR13 + INV6 webhook bypass + F11 chargeback 누락 | payment §2.3 cross-ref (chargeback handler 부재) |
| CF-018 | finance 도메인 carrier 10/55 = **18.2% repo 최대 cluster** (invoice 2 + payment 8) | invoice §3 INV4-INV5 (`invoices.ts:113`,`134`) | payment §1.3 BR5+BR6 = 8 사이트 (4 routes × 2) |
| CF-019.a/.b | 두 stripe orphan column 모두 carrier confirmed | invoice §3 INV6 (invoices.stripe_payment_intent_id audit-only) | payment §1.2 BR2 + §3 INV6 (payment_info.stripe_payment_method_id 0 write site) |
| CF-022 | invoice manual 67% (2/3 send+pay ✓; void ✗) vs webhook 0% bypass — 동일 entity 안 정책 split anomaly | invoice §6.2 cross-pack matrix (manual 67% / webhook 0%) | payment §3 INV1 (state machine 부재 — n/a) |

### CF-008 booking 26% vs 78% 두 측정 단위 명확화 (사용자 요구 의무 처리)

**T002.2.j booking.md §4** = `logAction call site / total endpoint 27 = 7/27 = 26%` (**endpoint-grain**) — 모든 endpoint (read+write+state) 분모.
**T003 묶음 1 domain-logic-booking.md §4** = `logAction call site / state-transition 9 = 7/9 = 78%` (**transition-grain**) — state transition 핸들러만 분모.
**둘 다 valid** — 측정 단위 (endpoint vs transition) 가 다름. 본 CF-008 은 두 측정을 모두 보존 + 비교 시 같은 단위 사용 의무. T003 묶음 2 finance polarisation 추가: invoices 60% endpoint = 60% transition (manual 측 동일), payment 0% (state 부재).

### F10 / F11 / F12 신규 R-REPO-5 incidentals (memo only, no promotion)

**F10** — helper auto-create invoice = "Pending" (5-state 외 6th label) at `contracts.ts:152` (recurring) + `:214` (at_activation). manual `/send` 가드 (`Draft only` `invoices.ts:147`) 와 충돌 → helper-generated invoice 운영자 send 불가. T004 `_rules/financial-rules.md` "invoice status taxonomy 통일" 일괄.

**F11** — Stripe webhook chargeback / dispute 미처리 at `stripe.ts:99-100` default branch `console.log('Unhandled event type')` 만; `charge.dispute.created/closed/funds_withdrawn/funds_reinstated` + `charge.failed` 핸들 부재. 분쟁 발생 시 운영 무반응. CF-010 Phase 2 Option B `payment_events` 별도 entity 가 cover.

**F12** — commissions.status enum 정의 부재 at `commissions.ts:20,69` (status filter + Archived 만 등장). 다른 status 값 의미 불명. Phase 2 = enum 정의 + lifecycle 명문화. T004 `_rules/financial-rules.md` 일괄.

### R-REPO-9 자동 진행 4회째 mirror

**T003 묶음 2 Step 1 RRRRR-UUUUU Pre-flight**: 사용자 가이드 baseline inputs (T002 자산 6 + CF anchor 8) + 분할 (β) + 차단 조건 4가지 평가 모두 코드 ground truth 일치 → 차단 0 → Step 2-5 자동 진행. **R-REPO-9 영구 패턴 4회째 confirm** (T002.4 + T002.5 + T003 묶음 1 + T003 묶음 2).

### R-REPO-10 묶음 위임 2회째 mirror (stable)

**T003 묶음 2 = R-REPO-10 2회째**: 2 sub-task (invoice + payment) / 1 응답 / 1 atomic commit / 1 사용자 push. `domain-logic-finance-payment.md §6.4` 측정 = 묶음 1 동일 패턴 재현 → 응답 -50% / commit -67% / push -67% 가속 효과 stable. 묶음 3-4 동일 적용.

### Counts unchanged

P0=4 / P1=18 / P2=3 = **25 CF** (T003 묶음 1 와 동일 — T003 묶음 2 신규 promotion 0).

---

## T003 묶음 3 (ops × 3: property + catalog + crm) — 2026-04-27

### Sub-task 산출물 (3 NEW domain logic files in `_context/`)

| sub-task | file | lines | target | 핵심 anchor |
|----------|------|-------|--------|-------------|
| 3.1 property | `_context/domain-logic-ops-property.md` | 250 | 350-500 (-29% 컴팩트) | CF-021 POSITIVE list-side leftJoin + counter-evidence buildSpaceResponse 4 sub-query / CF-009 ⚰️ 3 candidate (space_blocked_dates + space_option_maps + space_availability) hybrid usage 재평가 / CF-018 Sub-pattern A POSITIVE SP12/SP13 nested space-services |
| 3.2 catalog | `_context/domain-logic-ops-catalog.md` | 320 | 350-500 (-9%) | CF-016 carrier 양극단 (products.ts→contract_products + product-catalog.ts→accommodation_catalog; 9 routes 중 2 = 25% file/var/table mismatch) / CF-009 product_catalog DEAD 확정 유지 (T002.1.6 강화) / CF-018 Sub-pattern B 18 sites = repo 32.7% 단일 도메인 max-carrier |
| 3.3 crm | `_context/domain-logic-ops-crm.md` | 380 | 350-500 (+9%) | CF-023 .a anchor `leads.ts:175-204 /convert` orphan booking_ref 핵심 분석 (sole outlier 확정) / CF-022 work_orders 4 transition 정확화 (start/review gated + complete/cancel free; 2/4=50% transitions / 2/5=40% transitions+soft-delete; state-machines.md §1 line 48 일치) / CF-018 Sub-pattern A 10 sites |

**합계 250+320+380 = 950 lines** (사용자 예측 1100-1550 의 86%; 단일 file ≤ 700 cap 미달; tripwire 850 미달 단일 file).

### 6 CF expansion (no severity change, counts unchanged)

| CF | property | catalog | crm |
|----|----------|---------|-----|
| CF-009 | ⚰️ 3 candidate (space_blocked_dates + space_option_maps + space_availability) **mutator 사용 명확 → DEAD 아님** 재평가 evidence 제출 (F13 신규) | product_catalog **DEAD 확정 유지** (routes 0 hits — T002.1.6 결론 강화) | cs_messages **active dual-domain entity** 평가 정정 (cs-tickets.ts:5 + guest-cs.ts:14 두 도메인 사용) |
| CF-016 | n/a | **carrier 양극단** — 9 routes 중 2 = file ≠ table (products.ts→contract_products + product-catalog.ts→accommodation_catalog) = repo 단일 도메인 max-carrier 25% | n/a |
| CF-018 (Sub-pattern A POSITIVE) | SP12/SP13 nested space-services compound `WHERE id=mapId AND space_id=spaceId` ✅ | n/a | work-orders.ts transition handlers single-entity scope (URL :id only — nested-write 없음) ✅ |
| CF-018 (Sub-pattern B carrier) | 6 routes × 2 = 12 sites | **9 routes × 2 = 18 sites = 단일 도메인 max-carrier 32.7%** | 5 routes × 2 = 10 sites |
| CF-021 | **list-side SP1 leftJoin POSITIVE** vs **single-row SP3/SP4 buildSpaceResponse 4 sub-query counter-evidence** (`spaces.ts:31-55` helper N+1 분석) | product-catalog.ts list-side multi-table aggregation ✓ POSITIVE sister | n/a |
| CF-022 | spaces.status text 자유 (state machine 부재) — INV4 단순 명시 | 9 routes 모두 state machine 부재 (lookup-only) | **work_orders 4 transition 정확화** — start/review = gated (Open/InProgress precondition) + complete/cancel = FREE (no precondition); 2/4 = 50% transitions / 2/5 = 40% transitions+soft-delete; state-machines.md §1 line 48 "2/5 = 40%" 일치 — 사용자 안 "free-transition" 가설 절반 정확 (R-REPO-6 12회째 단순 정정) |
| CF-023 .a | n/a | n/a | **`leads.ts:175-204 /convert` PATCH = bookingRef = "BK-${year}-${random}" 5-digit random + leads UPDATE only + booking row 미생성** = orphan ref. T002.2.h cross-domain verification CLOSED 결과 sole outlier 확정 (lib/leadRef.ts:15-41 safe helper 제외). Phase 2 = atomic transaction 또는 safe helper 통일. |

### F13 / F14 / F15 신규 R-REPO-5 incidentals (memo only, no promotion)

**F13** — property 도메인 `space_blocked_dates` + `space_option_maps` + `space_availability` 3 ⚰️ medium DEAD candidate (T002.4 erd-core §10) 모두 mutator 사용 명확 → **DEAD 아님** 재평가 필요. T004 `_rules/architecture-rules.md` "DEAD schema retirement" 일괄에서 ⚰️ → "active orphan" 또는 "read-only catalog" 등급 신설.

**F14** — catalog 도메인 contract S2 confirm 시점 `contract_products` 카탈로그 snapshot 부재 — 운영자가 PUT 으로 amount 변경 시 미래 contract activate 의 invoice line items 와 historical contract record 의 amount 가 시점 차이 발생 가능. Phase 2 trade-off (a) snapshot 별도 entity / (b) contract row 안 amount embed / (c) 운영자 정책. T004 일괄.

**F15** — crm 도메인 `tasks` schema = polymorphic FK 정의 (`related_entity_type` + `related_entity_id`) vs `tasks.ts` route 0 사용 (read/write/filter 모두 부재) = **orphan polymorphic schema**. 운영자가 task 와 booking/contract/property 등 결합 안 함. T004 `_rules/architecture-rules.md` "orphan polymorphic schema retirement + tasks 도메인 결합 정책" 일괄.

### CF-018 Sub-pattern B 55-site repo-wide 매트릭스 보강 (T003 묶음 3 추가)

| 도메인 | sites | 비율 |
|--------|-------|------|
| catalog (9 routes × 2) | **18** | **32.7% — 단일 도메인 max-carrier** |
| property (6 routes × 2) | 12 | 21.8% |
| finance (payment 4 + invoice) | 10 | 18.2% |
| crm (5 routes × 2) | 10 | 18.2% |
| booking + 다른 도메인 | 5 | 9.1% |
| 합계 | **55** | 100% (booking.md §6 / T002.2.j confirmed) |

### 6-way TIE at audit floor (T002.2.i + T003 묶음 3 보강)

admin (37 ep) + payment (4 routes 24 ep) + catalog (9 routes 39 ep) + property (6 routes 44 ep) + crm (5 routes 51 ep) + portal-partner (22 ep) = **6 도메인 floor — repo 전체 8 도메인 중 6 = 75% 도메인이 audit-blind**. T004 `_rules/architecture-rules.md` "audit log 정책 통일" 단일 일괄 처리 시 6 도메인 동시 적용.

### R-REPO-6 12회째 가동 (단순 정정 — 차단 미발동)

T003 묶음 3 Step 1 VVVVV-YYYYY Pre-flight 시 사용자 안 "T002.5 시점 보류 (free-transition 가설) → T003 묶음 3 에서 확정 의무" 검증 결과 코드 ground truth = work_orders **start/review = gated** (Open/InProgress precondition) + **complete/cancel = free** (no precondition) → **사용자 안 "free-transition (no precondition gate)" 절반 정확**. R-REPO-6 12회째 단순 정정 (corrected proposal 의 본문 §1.3 정확화 흡수, 차단 미발동 — Step 2-5 자동 진행).

### R-REPO-9 자동 진행 5회째 confirm

**T003 묶음 3 Step 1 VVVVV-YYYYY Pre-flight**: 사용자 가이드 baseline inputs (T002 자산 6 + CF anchor 8) + 분할 (β) + 차단 조건 4가지 평가 → 차단 0 → Step 2-5 자동 진행. **R-REPO-9 영구 패턴 5회째 confirm** (T002.4 + T002.5 + T003 묶음 1 + T003 묶음 2 + T003 묶음 3).

### R-REPO-10 묶음 위임 3회째 stable

**T003 묶음 3 = R-REPO-10 3회째**: 3 sub-task (property + catalog + crm) / 1 응답 / 1 atomic commit / 1 사용자 push. 묶음 1 (2 sub-task) + 묶음 2 (2 sub-task) + 묶음 3 (3 sub-task) 가속 효과 stable across varying sub-task counts. `domain-logic-ops-crm.md §5.5` 측정 = 응답 -67% (3→1) / commit -67% / push -67% / 시간 ~50% 단축.

### Counts unchanged

P0=4 / P1=18 / P2=3 = **25 CF** (T003 묶음 2 와 동일 — T003 묶음 3 신규 promotion 0). R-REPO-5 incidentals 8→**11** (+F13/F14/F15).

---

---

## T003 묶음 4 marker section (2026-04-27)

### 산출물 (4 sub-task — R-REPO-10 4회째 — 가장 큰 묶음 max 가속)

| sub-task | 산출물 | Lines | scope |
|----------|--------|-------|-------|
| 1 — portal-guest | `_context/domain-logic-portal-guest.md` (NEW) | 252 | 29 ep / 3 files (guest-portal 21 + guest-cs 6 + guest-auth 2) |
| 2 — portal-partner | `_context/domain-logic-portal-partner.md` (NEW) | 231 | 22 ep / 4 files (agent + owner + service-host + partner-auth) |
| 3 — public | `_context/domain-logic-public.md` (NEW) | 207 | 33 ep / 6 files (OPEN 4 + PROTECTED 2) |
| 4 — admin | `_context/domain-logic-admin.md` (NEW) | 396 | 37 ep / 10 files + CF-004 P0 line-by-line |
| **묶음 4 합계** | 4 NEW domain-logic files | **1086** | 121 ep / 23 files |

### 7 CF expansion (no severity change, counts unchanged)

| CF | 묶음 4 expansion |
|----|------------------|
| CF-004 P0 | dev-migration.ts:14-79 line-by-line catastrophic deep dive (admin §1.2 + §2.1 workflow + §3 INV1-INV4+INV12 5 invariants + Phase 2 5-step prescription) |
| CF-005 portal_type drift | partner §1.5 cross-pack (admin-users.ts:91 hard-delete + 3-way identity cluster reference) |
| CF-008 audit floor | 9-domain final matrix — booking 78% > contract 71% > invoice 60% > guest 3.4% > **6-way TIE 0% floor** (admin + ops × 3 + portal-partner + public); reversal twist (admin = audit consumer but blind for own 18-20 mutators) |
| CF-014 POSITIVE EXEMPLAR #3 | dev-migration.ts:38-66 SAVEPOINT seed-replay = ironic positive in catastrophic P0 site (3 known production runtime Tx site final: seedSync.ts:214 + service-host-portal.ts:365 + dev-migration.ts:38) |
| CF-016 role-string drift | admin §1.2 carrier — db-sync.ts:16 4-variant Set vs 29-file exact `"SuperAdmin"` literal; `role = "super_admin"` user passes db-sync but denied by all 56 inline sites |
| CF-017 양극단 carrier | admin email-templates.ts 1/6 = 17% file-internal; admin total 2/37 = **5.4% 도메인 floor** vs blog-posts 5/6 = 83% 도메인 ceiling = repo 양극단 |
| **CF-018 Sub-pattern B 정정** | T002.2.j seed `27 files × 54 hits` → 묶음 4 atomic carrier 흡수 정정 = **29 files × 56 hits + 1 router-level db-sync.ts:30 = 57 sites total** (small drift +2/+2; T002.2.j 시점 27→29 files / 54→56 hits) |

### F13/F14/F15 incidentals (memo only — no promotion)

(이전 묶음 3 marker section 에서 등재 완료) — 묶음 4 신규 incidental **0** (모든 발견 기존 CF expansion 으로 흡수).

### CF-018 9-domain final matrix (T003 묶음 4 마무리)

| 도메인 | sites | 비율 |
|--------|-------|------|
| catalog (T003 묶음 3) | **18** | **32.7% — repo single max-carrier** |
| property (T003 묶음 3) | 12 | 21.8% |
| finance (T003 묶음 2 invoice 2 + payment 8) | 10 | 18.2% |
| crm (T003 묶음 3) | 10 | 18.2% |
| booking (T003 묶음 1) | 5 | 9.1% |
| **합계** | **55 inline + 1 router-level db-sync.ts:30 + 1 small drift +1 admin** | **57 sites** |

### Sub-pattern A POSITIVE 9-domain final summary

- **portal-guest** (sub-task 1): **26/29 = 90% IDOR-safe** (3 known BAD outliers `bookings.ts:572,728,735` cross-domain) + sole-owner guard E20 canonical exemplar
- **portal-partner** (sub-task 2): **22/22 = 100% IDOR-safe** + DOUBLE GUARD pattern E5/E12/E17 canonical exemplar
- **property** (T003 묶음 3): SP12/SP13 nested space-services compound WHERE = canonical exemplar
- **public** (sub-task 3): N/A (lookup-only mutators on PROTECTED tier)
- **booking** (T003 묶음 1): N2/R6 compound WHERE same-file POSITIVE vs N1 BAD same-prefix inconsistency

### Audit 9-domain final matrix (CF-008 마무리)

| 도메인 | endpoints / transitions | logAction | % | rank |
|--------|-------------------------|-----------|---|------|
| booking (T003 묶음 1) | 9 transitions | 7/9 | **78%** | #1 |
| contract (T003 묶음 1) | 7 transitions | 5/7 | 71% | #2 |
| invoices (T003 묶음 2) | 5 transitions | 3/5 | 60% | #3 |
| portal-guest (sub-task 1) | 29 ep | 1/29 | 3.4% | #5 |
| **6-way TIE at floor** | (admin 37 + ops-property 44 + ops-catalog 39 + ops-crm 51 + portal-partner 22 + public 33) | 0/each | **0%** | **floor** |

**Inverse-correlation 가설 confirmed**: high audit coverage = state machine 도메인 (booking + contract + invoice) / low audit coverage = CRUD/lookup 도메인 (admin + ops × 3 + portal-partner + public). Reversal twist = admin = audit data CONSUMER (system-logs.ts + reports.ts + email-logs.ts) but blind for own 18-20 mutators.

### R-REPO-9 자동 진행 6회째 confirm

**T003 묶음 4 Step 1 ZZZZZ-CCCCCC Pre-flight**: 사용자 가이드 baseline inputs (T002 자산 6 + CF anchor 8) + 분할 (β) + 차단 조건 4가지 평가 → 차단 0 → Step 2-5 자동 진행. R-REPO-6 환각 0. 신규 P0/P1 0 (CF-004 P0 이미 T002.2.i escalation 완료). Tripwire 0 (예측 1100-1500 미달, 실측 1086). 분할 (β) 명확. **R-REPO-9 영구 패턴 6회째 confirm** (T002.4 + T002.5 + T003 묶음 1 + 묶음 2 + 묶음 3 + 묶음 4).

### R-REPO-10 묶음 위임 4회째 stable — 가장 큰 묶음 max 가속

**T003 묶음 4 = R-REPO-10 4회째**: **4 sub-task / 1 응답 / 1 atomic commit / 1 사용자 push**. 4 묶음 누적 stable across varying sub-task counts (2/2/3/4):
- 묶음 1 (2 sub-task): 응답 -50% / commit -50% / push -50%
- 묶음 2 (2 sub-task): 응답 -50% / commit -50% / push -50%
- 묶음 3 (3 sub-task): 응답 -67% / commit -67% / push -67%
- **묶음 4 (4 sub-task): 응답 -83% / commit -75% / push -75% — max 가속**

### Counts unchanged

P0=4 / P1=18 / P2=3 = **25 CF** (T003 묶음 3 와 동일 — 묶음 4 신규 promotion 0). R-REPO-5 incidentals **11** unchanged (F4/F5/F7/F8/F9/F10/F11/F12/F13/F14/F15).

---

## 🎯 T003 GROUP COMPLETE marker (2026-04-27)

- **T003 시작**: 2026-04-27 (T002 GROUP COMPLETE 후)
- **T003 완료**: 2026-04-27 (묶음 4 sub-task 4 admin.md 완료 시점)
- **묶음 4 / sub-task 10 / domain-logic doc files 10 = 누적 ~2300 lines** (booking 200 + contract 315 + finance-invoice 250 + finance-payment 280 + ops-property 250 + ops-catalog 320 + ops-crm 380 + portal-guest 252 + portal-partner 231 + public 207 + admin 396)
- **CF count final**: P0=4 / P1=18 / P2=3 = **25** (T003 전체 0 NEW promotion — 모든 발견 expansion 흡수)
- **R-REPO-5 incidentals final**: **11** (F4/F5/F7/F8/F9/F10/F11/F12/F13/F14/F15)
- **R-REPO 가동 누적 final**:
  - R-REPO-6 = 12회 (사용자 입력 검증)
  - R-REPO-9 차단 = 3회 (T002.4 + T002.5 + T003 묶음 1 corrected 채택)
  - R-REPO-9 자동 진행 = 6회 (T003 묶음 2 + 묶음 3 + 묶음 4 — 차단 0)
  - R-REPO-10 묶음 = 4회 (묶음 1 / 2 / 3 / 4 — 모두 stable)
- **다음 단계**: T004 `_rules/` (4 files: architecture-rules + financial-rules + security-rules + no-magic-rules) — **자동 시작 절대 금지**, 사용자 push + proceed 명시 후 진입.
