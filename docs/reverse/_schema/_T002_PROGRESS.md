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
- **Status**: ✅ **DONE** (2026-04-26) — approved by user with 3 follow-up Decisions; D1+D2+D3 dispatched as T002.1.8 (entry below).
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
- **Blocker**: ~~user `proceed` to begin T002.2.b~~ — RESOLVED 2026-04-26 (user chose Option A: execute T002.1.8 BEFORE T002.2.b, see entry below).

### T002.1.8 — CF-006 + CF-014 evidence expansion + CF-017 + CF-018 graduation + §8 size-budget revision
- **Status**: ⏸️ **AWAITING_APPROVAL** (2026-04-26)
- **Triggered by**: user Decision after T002.2.a approval — Option A (execute now, before T002.2.b) for 3 R-REPO-5-class concerns surfaced during T002.2.a Spot-Check C3 + R-REPO-5 incidentals.
- **Outputs (atomic — R-REPO-1, 5 file ops)**:
  - `_audit/CRITICAL_FINDINGS.md` (4 in-file edits):
    - **CF-006 Evidence section rewritten** — was 2 sites (both in `owner-portal.ts`); now 4 sites (added `bookings.ts:485` and `contracts.ts:92-94`). Distribution analysis added (3 of 4 use Formula B). Recommendation reframed to centralisation-first.
    - **CF-014 Evidence section expanded** — added 17-line "Helper breakdown" subsection enumerating `generateContractInvoicesAndSchedules` (`contracts.ts:55-237`) operations (i)–(vii) with mutation counts per typical 12-month contract; total ≥27 sequential mutations per `POST /:id/activate` call across 3–4 tables, no transaction boundary. The two idempotency `db.delete` calls at the helper's start are flagged as a "the author knew partial failure was possible but did not use a transaction" tell.
    - **NEW CF-017** — "Input validation (Zod or any) absent on ~90% of route files": 2 files import `zod` directly, 5 use `z.*` patterns, 1 (`bookings.ts`) uses shared schemas via `safeParse` → ~6 of 52 route files (~12%) validate input; ~46 of 52 (~88%) accept `req.body` directly. Reproduction shows `parseFloat("abracadabra") → NaN → "NaN"` propagating to the DB. Phase 2 impact: no validators to port. Severity 🟡 P1.
    - **NEW CF-018** — "IDOR-class authorization-scope omission on nested resource handlers": full 17-handler audit table — **7 outright vulnerable + 3 partial / TOCTOU-weak + 7 safe** across 7 route files; vulnerable concentration in `contracts.ts`, `bookings.ts`, `space-images.ts`. Severity 🟡 P1 (authenticated horizontal privilege escalation, OWASP-A01 / CWE-639; not P0 because all routes sit behind `requireAuth`).
    - **Summary table** — added CF-017 + CF-018 rows; count line updated `P0=3, P1=10, P2=3 (total 16)` → `P0=3, P1=12, P2=3 (total 18)`.
  - `_schema/_T002_PLAN.md` §8 — added revision banner + revised prediction column (~2.4× upward); flagged `ops-crm.md` as exceeding the 1500-line cap → mandatory pre-write split at start of T002.2.e; flagged 3 more files (`finance.md`, `ops-property.md`, `admin.md`) as borderline (≥1300, pre-write split decision required). Total `_schema/` revised from ~6700 to ~11,300–11,800.
  - `_schema/api-endpoints/contract.md` (2 in-file edits):
    - C3 verdict line — added "Post-T002.1.8 graduation note" mapping categories [d] and [bonus e] → CF-017 / CF-018; categories [a]/[b]/[c] retained as domain-local within existing CF-008 / CF-015.
    - Cross-reference Index — added 4 new `→ CRITICAL_FINDINGS.md` rows (CF-006, CF-014, CF-017, CF-018) + flipped the "Back-fill required" subsection to ✅ COMPLETED with file:line verifier.
  - `_schema/_T002_PROGRESS.md` — T002.2.a ✅ DONE; T002.1.8 entry (this entry); blocker on T002.2 main entry switched to T002.1.8 approval; cumulative tracker `CRITICAL_FINDINGS.md` size delta noted (was 791 → after T002.1.8 ~1100 lines, +~309 from CF-006/014 expansion + CF-017/018 NEW + summary update).
  - `.local/session_plan.md` — T002.2.a marker `⏸️ AWAITING USER` → ✅ DONE; T002.1.8 entry; T002.2.b NEXT marker preserved.
- **Cross-domain findings (the substantive content of T002.1.8)**:
  - **D1 (CF-006)** — formula sites: 4 total, 3 of 4 use Formula B (`52/12`), only `owner-portal.ts:83` (the dashboard aggregator) uses Formula A (`*4`). Formula B is the de-facto majority but no helper enforces it.
  - **D1 (CF-014)** — helper `generateContractInvoicesAndSchedules` performs ≥17 mutations per typical 12-month Monthly Rent contract activation; ≥57 for Weekly. Combined with entry handler's 3 outer writes + 2 idempotency wipes = ≥27 sequential mutations across 3–4 tables in one HTTP call, zero transaction boundary.
  - **D2 (Zod)** — project-wide: 6 of 52 route files (~12%) validate input. The 28-endpoint contract domain is the largest unvalidated block. `bookings.ts` is the canonical positive exemplar (≥18 `safeParse` call sites).
  - **D3 (IDOR)** — project-wide: 17 nested-write handlers across 7 route files; 7 outright vulnerable, 3 partial/TOCTOU-weak, 7 safe. Vulnerable concentration in `contracts.ts` (E19, E20), `bookings.ts` (DELETE/PATCH services + verify/reject documents), `space-images.ts` (PUT, DELETE, set-primary). Safe sites in `spaces.ts`, `product-catalog.ts`, `contracts.ts` payment-schedule prove the pattern is *known* — its inconsistent application is the failure.
- **Verification gate (RULE 7) — 3-claim spot-check**:
  1. **C1 — CF-006 4-site enumeration accuracy** ✅ — re-verified by `sed -n` reads on `bookings.ts:480-492` (Biweekly→`*2`, else→`*52/12`) and `contracts.ts:88-96` (identical conditional). Both sites use Formula B. Owner-portal sites unchanged from prior CF-006 evidence.
  2. **C2 — CF-018 audit table accuracy** ✅ — every row's WHERE clause re-verified by per-handler `sed -n | rg "where"` reads. The "partial / TOCTOU-weak" verdict on `space-images.ts:146`, `bookings.ts:580`, `service-host-portal.ts:461` was given fairly: the pre-check select properly chains parent ID, but the subsequent mutation does not. Defense-in-depth weakness, not silent vulnerability.
  3. **C3 — CF-017 coverage count** ✅ — `rg -lc "from \"zod\"" artifacts/api-server/src/routes/` returned 2 files; `rg -c "z\.(object|string|number|enum|array|parse|safeParse)"` returned 5; `bookings.ts` separately confirmed via 18 `safeParse` call sites despite no direct `zod` import (uses shared schemas). Net: ~6 of 52 (~12%) validate input.
- **R-REPO-5 self-check**: T002.1.8 itself produced **0 new incidental findings**. Two minor observations worth recording but not escalating: (a) `bookings.ts:580` PATCH /services and `service-host-portal.ts:461` DELETE /photos use a "pre-check select with parent ID, then naked mutation" pattern that is technically TOCTOU-vulnerable but pragmatically safe under PostgreSQL default isolation — this is reflected in the CF-018 "⚠️ partial" verdict and needs no separate finding; (b) the T002.2.a back-fill section in `contract.md` (now flipped to ✅ COMPLETED) is a useful template for future T002.2.x docs to reference their own back-fill obligations.
- **Blocker**: user `proceed` to begin T002.2.b (`finance.md`) — and at the **start of T002.2.b**, a pre-write split decision is required for `finance.md` (revised prediction ~1340, borderline; the natural seam is `invoices.ts` + `invoice-rules.ts` + `expenses.ts` vs `payments.ts` + `payment-info.ts` + `commissions.ts` + `accounts.ts`).

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

### T002.2.b status (in progress)

- **Decision (α) accepted**: `finance.md` split into `finance-invoicing.md` (invoices + recurring-schedules; 17 endpoints) + `finance-payments.md` (payment-info + commissions + beneficiaries + accounts + stripe; 26 endpoints). Seam: billing-source vs collection/disbursement.
- **Half-1 `finance-invoicing.md`**: ✅ Step 2-5 complete (680 lines, 17 endpoints full sample format, CF-014 R5 anchor + 11 C3 inconsistencies + 5 R-REPO-5 incidentals). C2 spot-check found E5 Meta auth qualifier error (`when permanent` → `always`) — fixed pre-commit.
- **Half-1 atomic carrier (5 files)**: finance-invoicing.md (NEW), INDEX.md (Domain Groups + summary split), contract.md (4 cross-ref back-fills), this PROGRESS file, session_plan.md (R-REPO-6/7 added).
- **Half-2 `finance-payments.md`**: PENDING — auto-segue Step 1 sub-classification report (≤30 lines) follows the half-1 R-REPO-4 report; Steps 2-6 await user `proceed`.

### T002.2.b — R-REPO-5 incidentals queued for downstream tasks

- **Mini-task proposal `T002.2.b.fix-1`** (CF-011 evidence-expansion): append `nextInvoiceRef` race + verbatim duplication to CF-011 evidence. Decision deferred to user.
- **Simple memos** (3): I3 GST hard-code `1.1` → `_rules/no-magic-rules.md` (T004); I4 `nextInvoiceRef` ignores `deleted_at` → `db-schema-overview.md` (T002.3); I5 R1 date-range filter direction bug → already documented as C3-9 in finance-invoicing.md.

---

## Cumulative size tracker

| File | Predicted | Actual | Δ |
|---|---:|---:|---:|
| `_T002_PLAN.md` | — | 366 | — |
| `_T002_PROGRESS.md` | — | 93 | — |
| `api-endpoints/INDEX.md` | ~120 | 146 | +26 (Risk Legend richer than expected) |
| `api-endpoints/booking.md` | ~350 (full file) | 306 (5 of 27 endpoints + self-check + remaining-22 stub) | tracking — full file projected ~600-700 after T002.2 |
| `api-endpoints/contract.md` | ~370 | **902** | **+532 (+144%)** — base 893 + T002.1.8 cross-ref additions + T002.2.b cross-ref back-fills (4 sites: line 7 / L345 / L370 / L883) updated `finance.md` → `finance-invoicing.md` |
| `_audit/CRITICAL_FINDINGS.md` | — | ~1100 | T002.1.8 added ~309 lines (CF-006 expansion +30, CF-014 expansion +35, NEW CF-017 ~80, NEW CF-018 ~120, summary update ~5) on top of the 791 baseline established at end of T002.1.7 |
| `api-endpoints/INDEX.md` (post-T002.2.b) | — | **158** | +12 — Domain Groups now lists `finance` group (2 files) + `ops` group (3 files); finance row block re-tagged from single `finance` to `finance-invoicing` × 2 + `finance-payments` × 5; Domain summary table split |
| `api-endpoints/finance-invoicing.md` (T002.2.b half-1) | ~533 (revised post-T002.1.8 §8 ~2.4× × 17/43 ratio) | **680** | **+147 (+28%)** — within revised cap; CF-014 R5 anchor block + 11 self-discovered inconsistencies + R-REPO-5 incidentals section drove length |
| `api-endpoints/finance-payments.md` (T002.2.b half-2) | ~811 (revised, 26/43 ratio) | — | PENDING (sub-classification report next, Step 2 body after user `proceed`) |
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
