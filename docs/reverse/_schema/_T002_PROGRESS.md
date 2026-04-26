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
- **Status**: ✅ **DONE** (2026-04-26) — approved; key win = caught hallucinated `products` table (6 columns) before T002.2 retrofit.
- **Triggered by**: T002.1.5 incidental finding ("schema-file deadness ≠ table deadness") — user demanded re-audit before T002.2 starts to prevent retrofit costs in T002.3.
- **Outputs (atomic — R-REPO-1)**:
  - **NEW** `docs/reverse/_audit/SCHEMA_FILE_TABLE_MAP.md` (~190 lines) — full 50-table inventory: Schema File · Var Name · SQL Table · Route Files Using · Status; methodology; 8 file-name vs table-name divergences; T002.0 §6 candidates re-evaluation (all cleared); cross-doc impact log. *(Promoted to `docs/reverse/_schema/SCHEMA_FILE_TABLE_MAP.md` in T002.1.7 — see entry below.)*
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
- **Outcome**: approved by user with R-REPO-5 directive to escalate the incidental naming pattern to a new CF — see T002.1.7 below.

### T002.1.7 — CF-016 etablis + SCHEMA_FILE_TABLE_MAP promotion + T002_PLAN §6 sync
- **Status**: ✅ **DONE** (2026-04-26) — approved by user; micro-check (CF severity ground-truth re-aggregation) confirmed `P0=3, P1=10, P2=3 (total 16)` with no body↔summary mismatch; CF-009 stayed 🟡 P1 (count-only revision in T002.1.6, severity unchanged).
- **Triggered by**: user directive after T002.1.6 approval — escalate the systematic naming pattern (8 file/table + 6 var/table divergences) from "incidental memo" to a registered P2 CF, and harden `SCHEMA_FILE_TABLE_MAP.md` from a one-shot audit artefact into a permanent reference asset before T002.2.x starts citing it heavily.
- **Outputs (atomic — R-REPO-1, 7 file ops)**:
  - **MOVE** `docs/reverse/_audit/SCHEMA_FILE_TABLE_MAP.md` → `docs/reverse/_schema/SCHEMA_FILE_TABLE_MAP.md` *(audit one-shot → schema permanent reference)*
  - `_schema/SCHEMA_FILE_TABLE_MAP.md` — added §0 (Status / Maintenance contract: location, audience, update obligation, anchored CFs, last re-audit) + "How to use this map" with 3 lookup recipes (table→file, file→tables, var→table); added CF-016 anchor in §3; updated footer.
  - `_audit/CRITICAL_FINDINGS.md` — **NEW CF-016** (~60 lines: severity P2, scope Phase 2 + onboarding, 8+6 evidence table, reproduction, "how this CF was discovered" causal chain, Phase 2 impact, recommendations, carrier note); summary table updated `P2: 2 → 3 (total 15 → 16)`; CF-009 revision-history link path corrected `_audit/` → `_schema/`; recommendation #3 cross-refs CF-016; carrier link path corrected.
  - `_audit/MONEY_AUDIT.md` — 2 cross-ref paths corrected (`SCHEMA_FILE_TABLE_MAP.md` → `../_schema/SCHEMA_FILE_TABLE_MAP.md`); §1.2 subtotal mentions CF-016; §2.3 closing note links to §3 anchor + CF-016.
  - `_schema/api-endpoints/INDEX.md` — L49 product.ts row + L131 Risk Legend ops-catalog row both updated to use new path `../SCHEMA_FILE_TABLE_MAP.md` and to cite CF-016.
  - `_schema/_T002_PLAN.md` §6 — full rewrite per T002.1.6 results: §6.1 reduced from 2 dead tables to **1** (`product_catalog` only); §6.2 candidates table converted from "suspect, verify in T002.3" → "ALL CLEARED as ACTIVE (T002.1.6)" with route file evidence; new top-of-§6 revision banner directing to canonical map + CF-009 revised + CF-016; §6.3 display rule unchanged but now applies to 1 table.
  - `_schema/_T002_PROGRESS.md` — T002.1.6 ✅ DONE; T002.1.7 entry (this entry); T002.2 blocker switched to T002.1.7.
  - `.local/session_plan.md` — T002.1.6 ✅ DONE; T002.1.7 entry; T002.2 blocker switched.
- **Findings (no new code-level surprises)**: nothing new about the codebase; T002.1.7 is purely organizational hardening of T002.1.6's findings.
- **Verification gate (RULE 7) — 3-claim spot-check**:
  1. New file location `docs/reverse/_schema/SCHEMA_FILE_TABLE_MAP.md` exists; old `_audit/` path absent (verified by `ls`) ✅
  2. CF-016 entry present in CRITICAL_FINDINGS.md + summary table row added + count line reads `P0=3, P1=10, P2=3 (total 16)` ✅
  3. All cross-refs to `SCHEMA_FILE_TABLE_MAP.md` in `_audit/` files use relative `../_schema/` path; INDEX.md uses sibling-dir `../` path; no broken `./SCHEMA_FILE_TABLE_MAP.md` link remains ✅
- **R-REPO-5 self-check**: T002.1.7 itself produced no new incidental findings (the work is purely the systematization of T002.1.6's naming-pattern incidental into CF-016).
- **Blocker**: ~~user `proceed` to begin T002.2.a~~ — RESOLVED 2026-04-26.

### T002.2.a — `contract.md` (28 endpoints: contracts.ts 21 + contract-types.ts 7)
- **Status**: ⏸️ **AWAITING_APPROVAL** (2026-04-26)
- **Triggered by**: user `proceed` after T002.1.7 micro-check.
- **Outputs (atomic — R-REPO-1, 5 file ops)**:
  - **NEW** `docs/reverse/_schema/api-endpoints/contract.md` (893 lines) — file-of-origin banner + Anchor Block (3 sealed claims) + Section A (E1–E21 from `contracts.ts`, full sample format with Meta header / Field table / Request / Response / Logic summary / Cross-references) + Section B (T1–T7 from `contract-types.ts`, same format) + 28-row × 7-column Self-Check table + Spot-Check Log (C1/C2/C3) + R-REPO-5 Incidental block (I1, I2, I3) + Cross-reference Index.
  - `docs/reverse/_schema/api-endpoints/booking.md` — S2 cross-ref tightened to point at E2 (alternate creator) + E9 (next state); S5 cross-ref tightened to point at E3 (canonical single-row read) and notes the shared soft-delete-unaware pattern; close-out paragraph updated `awaiting T002.2.a` → `T002.2.a complete; awaiting T002.2.b (finance.md)`.
  - `docs/reverse/_schema/_T002_PROGRESS.md` — T002.1.7 ✅ DONE; T002.2.a entry (this entry); T002.2 sub-task ledger row for `.a` checked off; cumulative tracker `contract.md` actual = 893 (vs predicted ~370, **Δ +523** — see size-budget note below).
  - `.local/session_plan.md` — T002.1.7 marker `⏸️ AWAITING USER` → ✅ DONE; T002.2.a entry added; T002.2 sub-task list `.a` checked off.
- **Findings (catalogue)**:
  - 28 endpoints classified: **8 READ-only** / **14 WRITE/CRUD** / **6 STATE-TRANSITION** (cross-cut **9 NESTED** tags).
  - Domain logAction coverage: **8 of 20 mutation handlers** call `logAction` (40%); 12 omit (CF-008 footprint, all enumerated in C3).
  - $$ touching: **7 endpoints** write money columns (E2, E4 directly; E9 indirectly via helper; E13, E14, E18, E19 via nested resources).
  - **CF anchor density** (this domain): CF-001 (3 ep), CF-002 (3 ep), CF-003 (1 ep, structural), CF-008 (12 ep), CF-014 (1 entry + 1 helper), CF-015 (4 hard-delete flags + 2 unconditional helper hard-deletes).
- **R-REPO-5 incidental findings** (3, escalation summarised below):
  - **I1 — CF-006 evidence expansion** (`contracts.ts:92-94` adds a 3rd file site to the `weeklyRate * (52/12)` formula). *Impact: CF-006 evidence-expansion mini-task.*
  - **I2 — CF-014 evidence expansion** (helper `generateContractInvoicesAndSchedules`, `:55-237`, performs ≥27 mutations sequentially with no transaction; CF-014 currently cites only the entry handler `:429`). *Impact: CF-014 evidence-expansion mini-task — bundleable with I1.*
  - **I3 — line-items authorization-scope gap** (E19 PATCH + E20 DELETE WHERE-clause omits the `:id` parent contract id; any authenticated user can edit any line item by guessing `lineId`). *Impact: simple memo for now; potential new CF-P1 contingent on a domain-wide authorization-scope audit (out of scope for T002.2.a).*
- **Verification gate (RULE 7) — 3-claim spot-check** (sealed in Anchor Block at the top of `contract.md`, verified at the bottom):
  1. **C1 — file:line + helper chain accuracy on E9 (`POST /v1/contracts/:id/activate`)** ✅ — entry at `contracts.ts:430`, 4 direct DB writes (`:432-434`, `:438`, `:442-444`, `:447`), helper span `:55-237`, mutation count for typical 12-mo Rent contract recomputed at 28+ (cited "27+" is conservative-correct).
  2. **C2 — Meta-header accuracy on the 3 endpoints carrying CF-002 or CF-014 anchor (E2 POST, E4 PUT, E9 activate)** ✅ — each Meta line literal-checked against source.
  3. **C3 — self-discovered inconsistency surfaced (or "none, n=28")** ✅ — surfaced **15 distinct sites across 5 categories**: deleted_at filter omission (4), logAction omission (12), hard-delete flag (4 + 2 unconditional), Zod absence (28 = whole domain), bonus authorization-scope gap (2 sites = I3 above).
- **Size-budget note**: predicted 370, actual 893 (**+523, +141%**). Drivers: (a) full sample format applied to all 28 endpoints (vs the ~5-sample-only format used in booking.md so far — this is the first complete-domain file); (b) the Anchor Block + 28-row Self-Check + Spot-Check Log are net-new sections, not present in booking.md; (c) E9 helper decomposition is deep (1 endpoint ≈ 80 lines). **Implication for T002.2.b–.i**: predictions in `_T002_PLAN.md` §7 should be revised upward by ~2.4× before starting `finance.md` (43 endpoints, originally predicted 560 → revised ~1340). Total T002 size now projects ~10,000+ lines vs original ~6,700; still well under any practical limit.
- **Blocker**: user `proceed` to begin T002.2.b (`finance.md`) AND user decision on the I1+I2 mini-task proposal (T002.1.8 — bundle the two CF-006/CF-014 evidence expansions before T002.2.b, OR defer to T002 close-out).

### T002.2 — All remaining endpoints (348 endpoints) — split per [B3] into 9 sub-tasks
- **Status**: ⏳ **IN_PROGRESS** (`.a` complete, `.b–.j` pending)
- **Sub-tasks** (each: write → 3-claim spot-check → ≤50-line report → user `proceed` → next):
  - **T002.2.a — `contract.md`** ✅ DONE (2026-04-26, 893 lines) — see dedicated entry above.
  - **T002.2.b — `finance.md`** (43 endpoints across 7 files) — depends on contract for invoice cross-ref pattern; back-fill required from contract.md E9 (helper invoice/schedule generation) when written.
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
| `api-endpoints/contract.md` | ~370 | **893** | **+523 (+141%)** — full sample format on all 28 + Anchor Block + 28-row Self-Check + Spot-Check Log + R-REPO-5 incidental block; revise §7 predictions for `.b–.i` upward by ~2.4× |
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
