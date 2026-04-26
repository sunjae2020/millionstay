# T002 Progress Tracker

> **Purpose**: Anchor file for T002 context recovery (RULE 8). Every sub-task entry contains: status, date, output paths, line counts, gate result, blockers, and next-action.
> **Read order on context recovery**: this file → `_T002_PLAN.md` → most recent in-progress output → `CRITICAL_FINDINGS.md` (cross-ref) → `MONEY_AUDIT.md` (cross-ref).
> **Update rule**: this file MUST be updated at the close of every sub-task (success or fail), before any chat report.

---

## Status Legend

- ✅ **DONE** — output saved, gate passed (if applicable), user `proceed` received (if required)
- ⏳ **IN_PROGRESS** — actively being worked on
- ⏸️ **AWAITING_APPROVAL** — output saved, awaiting user review/proceed
- 🟥 **BLOCKED** — cannot proceed; blocker recorded
- ⚪ **PENDING** — not yet started

---

## Sub-task ledger

### T002.0 — Pre-flight plan
- **Status**: ✅ **DONE** (2026-04-26)
- **Output**: `docs/reverse/_schema/_T002_PLAN.md` (~430 lines after Q1-Q4 resolution)
- **Gate**: n/a (planning task)
- **Outcome**: 4 open questions answered by user; plan locked.

### T002.1 — INDEX.md + Sample 5 endpoints (booking.md partial)
- **Status**: ✅ **DONE** (2026-04-26) — format approved by user with minor B1/B2/B3 reinforcements
- **Outputs**:
  - `docs/reverse/_schema/api-endpoints/INDEX.md` (146) — 51-file index, 9-column schema + Risk Legend footer
  - `docs/reverse/_schema/api-endpoints/booking.md` (partial) — 5 sample endpoints (S1–S5 per `_T002_PLAN.md` §9.Q4)
- **Gate**: Sample Self-Check protocol (§9.Q4 directive [C]) executed inline; 35-cell table at top of `booking.md`, all ✅.
- **Outcome**: format `(a) lock` per user reply. Subsequent reinforcements applied in T002.1.5 below.

### T002.1.5 — Format lock reinforcement (B1 + B2 + B3 setup)
- **Status**: ✅ **DONE** (2026-04-26) — approved
- See entry below.

### T002.1.6 — CF-009 re-verification (table-level vs file-level)
- **Status**: ⏸️ **AWAITING_APPROVAL** (2026-04-26)
- **Triggered by**: T002.1.5 incidental finding ("schema-file deadness ≠ table deadness") — user demanded re-audit before T002.2 starts to prevent retrofit costs in T002.3.
- **Outputs (atomic — R-REPO-1)**:
  - **NEW** `docs/reverse/_audit/SCHEMA_FILE_TABLE_MAP.md` (~190 lines) — full 50-table inventory: Schema File · Var Name · SQL Table · Route Files Using · Status; methodology; 8 file-name vs table-name divergences; T002.0 §6 candidates re-evaluation (all cleared); cross-doc impact log.
  - `docs/reverse/_audit/CRITICAL_FINDINGS.md` — CF-009 fully rewritten: title, evidence, count (2 dead → 1 dead), recommendation, summary table row.
  - `docs/reverse/_schema/api-endpoints/INDEX.md` — `products.ts` row L49 status DEAD → ACTIVE with file-misnaming note + path corrected `/v1/products` → `/v1/contract-products`; L93 domain-group blurb; L131 Risk Legend wording.
  - `docs/reverse/_audit/MONEY_AUDIT.md` — 7 column rows re-attributed `products` → `contract_products`; subtotal sentence rewritten (4 dead, not 6); §1.5 cross-pair rows; §2.2 `bond_weeks` row clarified; §2.3 closing note rewritten.
- **Findings**:
  1. **`products` table never existed** in this repo (`rg 'pgTable\("products"' lib/db/src/schema/` → 0 matches).
  2. **Only 1 confirmed dead table**: `product_catalog` (0 route uses).
  3. **8 file-name ↔ table-name divergences** trap naive grep; remedy = use actual var name (see SCHEMA_FILE_TABLE_MAP §1.3).
  4. **All T002.0 §6 "suspected dead" candidates cleared** (announcements, *_service_catalog, product_types/groups all heavily used internally).
  5. **Variable-name convention also drifts** in 6 places (e.g. `usersTable` → `admin_users`, `integrationSettings` no `Table` suffix).
- **Incidental finding (R-REPO-5)**: route file `product-catalog.ts` actually queries `accommodation_catalog` (not `product_catalog`); cleaner than feared. *Impact: simple memo — no further CF.*
- **Verification gate (RULE 7) — 3-claim spot-check**:
  1. `pgTable("products"` count → 0 (verified by `rg`) ✅
  2. `productCatalogTable` route imports → 0 ✅
  3. `contractProductsTable` route imports → 4 files (`beneficiaries.ts`, `bookings.ts`, `contracts.ts`, `products.ts`) ✅
- **Blocker**: user `proceed` to begin T002.2.a (contract.md) with corrected CF-009 baseline.

### T002.2 — All remaining endpoints (348 endpoints) — split per [B3] into 9 sub-tasks
- **Status**: ⚪ **PENDING** (blocked by T002.1.6 approval)
- **Sub-tasks** (each: write → 3-claim spot-check → ≤50-line report → user `proceed` → next):
  - **T002.2.a — `contract.md`** (28 endpoints: contracts.ts 21 + contract-types.ts 7) — first because it's the receiver of S2's auto-create writes; cross-ref hooks already in booking.md S2/S5.
  - **T002.2.b — `finance.md`** (43 endpoints across 7 files) — depends on contract for invoice cross-ref pattern.
  - **T002.2.c — `ops-property.md`** (44 endpoints across 6 files).
  - **T002.2.d — `ops-catalog.md`** (39 endpoints; `products.ts` 🪦 DEAD — first chance to validate dead-file documentation pattern).
  - **T002.2.e — `ops-crm.md`** (51 endpoints; largest single file, watch budget).
  - **T002.2.f — `portal-guest.md`** (29 endpoints; CF-010 Stripe boundary).
  - **T002.2.g — `portal-partner.md`** (22 endpoints; CF-005 + CF-006 anchors).
  - **T002.2.h — `public.md`** (33 endpoints).
  - **T002.2.i — `admin.md`** (37 endpoints; CF-004 dev-migration anchor).
  - **T002.2.j — `booking.md` close-out** (remaining 22 endpoints; deferred to last so booking-domain re-reads benefit from cross-domain context).
- **Per-sub-task report fields** (per [B3]): endpoints written / cumulative endpoint count (vs 353 target) / domain logAction coverage / $$ touching count / new CF candidates discovered / 3-claim spot-check verdict.

### Gate 1 — 3-claim verification on T002.1 + T002.2
- **Status**: ⚪ **PENDING**
- **Claim sources**: see `_T002_PLAN.md` §7 (boundary-case + DEAD endpoint + money-touching with audit gap)

### T002.3 — `db-schema-overview.md`
- **Status**: ⚪ **PENDING**

### Gate 2 — 3-claim verification on T002.3
- **Status**: ⚪ **PENDING**

### T002.4 — `erd-core.md` (8 Mermaid diagrams + Dead Tables appendix)
- **Status**: ⚪ **PENDING**

### Gate 3 — 3-claim verification on T002.4
- **Status**: ⚪ **PENDING**

### T002.5 — `state-machines.md`
- **Status**: ⚪ **PENDING**

### Gate 4 — 3-claim verification on T002.5
- **Status**: ⚪ **PENDING**

### T002 — close
- **Status**: ⚪ **PENDING**
- **Done condition**: all 12+ files saved, all 4 gates passed, session_plan T002 entry marked DONE, user `proceed` for T003.

---

## Cumulative size tracker

| File | Predicted | Actual | Δ |
|---|---:|---:|---:|
| `_T002_PLAN.md` | — | 366 | — |
| `_T002_PROGRESS.md` | — | 93 | — |
| `api-endpoints/INDEX.md` | ~120 | 146 | +26 (Risk Legend richer than expected) |
| `api-endpoints/booking.md` | ~350 (full file) | 306 (5 of 27 endpoints + self-check + remaining-22 stub) | tracking — full file projected ~600-700 after T002.2 |
| `api-endpoints/contract.md` | ~370 | — | — |
| `api-endpoints/finance.md` | ~560 | — | — |
| `api-endpoints/ops-property.md` | ~570 | — | — |
| `api-endpoints/ops-catalog.md` | ~510 | — | — |
| `api-endpoints/ops-crm.md` | ~660 | — | — |
| `api-endpoints/portal-guest.md` | ~380 | — | — |
| `api-endpoints/portal-partner.md` | ~290 | — | — |
| `api-endpoints/public.md` | ~430 | — | — |
| `api-endpoints/admin.md` | ~480 | — | — |
| `db-schema-overview.md` | ~950 | — | — |
| `erd-core.md` | ~500 | — | — |
| `state-machines.md` | ~500 | — | — |
| **TOTAL** | **~6700** | — | — |

---

*Update this tracker at the close of every sub-task.*
