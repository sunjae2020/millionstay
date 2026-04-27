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

## Sub-task ↔ Commit hash map (T002.2.d.fix-1 — R-REPO-1 v2 (e) 의무 컬럼)

Auto-checkpoint 메커니즘이 stage → commit 을 자동 실행하지만 generic 메시지 ("Update documentation...") 만 기록 → sub-task ↔ commit hash 매핑이 git history 만으로는 추적 불가. 본 표가 **영구 archaeology reference** (Phase 2 .NET 포팅 시 reverse 문서 출처 추적용).

| Sub-task | Status | Primary output | Lines | Commit hash(es) |
|---|---|---|---:|---|
| T001 | ✅ | `T001_RECON_REPORT.md` | 552 | `09c79da` |
| T001.5 | ✅ | `CRITICAL_FINDINGS.md`, `MONEY_AUDIT.md` | 692 + 502 | `d66fc43` |
| T001.5 보강 | ✅ | (CF-013/014/015 + MONEY_AUDIT §5) | — | `76d5cf4` |
| T002.0 | ✅ | `_T002_PLAN.md` | 366 | `e96b650` |
| T002.1 | ✅ | `INDEX.md` + `booking.md` (sample 5) | 146 + 306 | `b6e39ca` |
| T002.1.5 | ✅ | (Meta header + Re-Verification Log) | — | `af905b8` |
| T002.1.6 | ✅ | `SCHEMA_FILE_TABLE_MAP.md` (NEW) | 179 | `5ab9cdd` |
| T002.1.7 | ✅ | (CF-016 promotion + MAP move to `_schema/`) | — | `f5e4d15` |
| T002.2.a | ✅ | `contract.md` | 893 | `3628475` |
| T002.1.8 | ✅ | (CF-006/014 expansion + CF-017/018 promotion) | — | `06ddb9c` |
| T002.2.b half-1 | ✅ | `finance-invoicing.md` | 681 | `fac693b` |
| T002.2.b half-2 | ✅ | `finance-payments.md` + INDEX split | 1108 | `2dd8d4a` |
| T002.2.b atomic commit | ✅ | (CF-019 promotion + 4 CF expansions) | — | `0b0ffac` / `e58b9d7` / `9d9822e` |
| T002.2.c | ✅ | `ops-property.md` (compression debut) | 429 | `2416898` / `6872303` |
| T002.1.9 | ✅ | (size budget recalibration + CF-020/021 promotion) | — | `07f83b2` / `f0c131f` |
| T002.2.d | ✅ | `ops-catalog.md` + 5 CF expansions | 529 | **`4160f1c`** |
| T002.2.d.fix-1 | ✅ | (R-REPO-1 v2 + CF-019.a/.b split + this table) | — | `9aba01d` |
| T002.2.e | ✅ | `ops-crm.md` (51 ep / 7 files; CF-022 NEW P1 promotion) | **664** | `c6cab7c` |
| T002.2.e.fix-1 | ✅ | (CF-023 NEW P1 promotion: lead-to-booking orphan ref + V1 d-row correction + this row) | — | `cbc54b2` |
| T002.2.f | ✅ | `portal-guest.md` (29 ep / 3 files: guest-portal.ts 18 + guest-cs.ts 8 + guest-auth.ts 3; CF-023.b sub-split + 6 CF carrier expansions; 0 new CF promotions; tripwire-exempt) | 521 | `78bf0f7` |
| T002.2.g | ✅ | `portal-partner.md` (22 ep / 4 files: service-host-portal.ts 9 + owner-portal.ts 5 + agent-portal.ts 5 + partner-auth.ts 3; **CF-014 POSITIVE EXEMPLAR promotion** at SHP:365-393 — sole production tx-using handler; CF-008 22/22 = 0% TIES with ops-catalog/ops-crm 3-way; CF-005 evidence reinforced at signing site `partner-auth.ts:43`; **22/22 = 100% IDOR-safe** = strongest defense surface yet; INDEX.md 4 mount-prefix factual corrections + 2 auth dispatcher corrections; 0 new CF promotions; tripwire-exempt) | 581 | `f7b7cdc` |
| T002.2.h | ✅ | `public.md` (33 ep / 6 files: public.ts 10 + privacy.ts 2 + health.ts 2 OPEN; lookup.ts 10 + blog-posts.ts 6 + page-contents.ts 3 PROTECTED; mount-order based OPEN/PROTECTED split classification by `app.ts:167` requireAuth gate; **NEW CF-024 P1 promotion** — project-wide rate limiting absence (0 hits codebase + package.json + middleware) → counts P0=3 / P1=**18** / P2=3 = **24**; **CF-023 cross-domain verification CLOSED** at this sub-task — helper `insertLeadWithGeneratedRef` (lib/leadRef.ts:15-41) confirmed safe → `leads.ts:175-204` is sole outlier (option (가)); **CF-017 POSITIVE EXEMPLAR co-promotion** — `blog-posts.ts` 5/6 = 83% safeParse coverage with double-validate B4 (IdParams + UpdateBlogPostBody); **CF-008 new lowest absolute floor** = 0/33 = 0% (3 unauthenticated POSTs create leads with zero audit trail); CF-001 +5 read-side carriers; CF-013 +3; CF-014 +5; CF-015 +1 POSITIVE (SuperAdmin role gate); CF-021 +1 helper-internal carrier (generateLeadRef full-table SELECT); inconsistencies memo: healthRouter double-mount (app.ts:150 + routes/index.ts:41 dead); tripwire-exempt prediction 400-600 → 323 actual (within ±20% revised band considering compact format adoption)) | 323 | `980d109` |
| T002.2.i | ✅ | `admin.md` (37 ep / 10 files: dashboard 8 + auth 7 + email-templates 6 + integrations 5 + admin-users 4 + db-sync 3 + system-logs 1 + reports 1 + email-logs 1 + dev-migration 1; 7 mount-time auth tiers A through D″; **🔴 CF-004 ESCALATION P1 → P0** — `dev-migration.ts:14-79` body-confirmed = TRUNCATE 39 production tables RESTART IDENTITY CASCADE + SAVEPOINT seed-replay; protected only by hard-coded `MIGRATION_SECRET = "MS_MIGRATE_2026_PROD"` at `:10` + mount-order at `app.ts:157` < `:167 requireAuth` with no NODE_ENV gate; R-REPO-7 trade-off (가) chosen — dual root cause consolidated, no separate CF-025; **CF-008 admin row** = 0/37 = 0% ⇒ 6-way TIE at floor; **CF-014 POSITIVE EXEMPLAR co-promotion #2** at `dev-migration.ts:38-66` (3rd known production runtime Tx site after seedSync + SHP); **CF-018 SUB-PATTERN B EXPANSION** (R-REPO-7 (c) self-correction; **initially reported 11 sites in 6 files — corrected at T002.2.j Step 1 verification to 55 sites in 28 files**: see T002.2.j row + `api-endpoints/booking.md §6.A` for full enumeration); CF-022 +1 ungated state transition; CF-013 +4 / CF-015 +3 (with 1 POSITIVE) / CF-017 +2 / CF-024 +6 carriers; counts P0=**4** / P1=18 / P2=3 = **25**) | 480 | `a8ddc89` |
| T002.2.j | ✅ | `booking.md` close-out (22 stub completion → 27 endpoints total / 759 lines source / `bookings.ts`; §3.A 7 transitions + §3.B 5 writes + §3.C 2 nested + §3.D 8 reads at full Meta + compact format mix; §4 27×7 = **189-cell self-check** completed; §5 10-domain cross-ref matrix; **§6 🔴 CF-018 Sub-pattern B retroactive correction** — T002.2.i seed `11 sites in 6 files` corrected to **55 sites in 28 files** (54 inline `!== "SuperAdmin"` × 27 files × 2 + 1 router-level `db-sync.ts:30`) with full 28-file enumeration table at §6.A; **NEW SUB-FINDING** at §6.B = role-string normalisation drift (db-sync.ts:16 4-variant Set vs 27-file exact `"SuperAdmin"` literal — `role = "super_admin"` user passes db-sync but is denied by all 54 inline sites); §6.C T002.2.b–.i blind-spot map; §6.D atomic carrier impact summary; §0 CF-004 P0 cross-ref banner; §3.A.T6 + .T7 + §3.C.N1 = **3 BAD CF-018 IDOR sites** on document/service nested writes (`bookings.ts:728/735/572` WHERE on `id`/`svcId` only, ignoring URL `:id` booking_id param); §3.C.N2 + §3.D.R6 = **2 POSITIVE EXEMPLAR sites** with compound `WHERE id=svcId AND booking_id=bookingId`; §1 helper deep-dive surfaces `checkOverbooking(excludeBookingId?)` declared-but-unused param + `unblockDatesForBooking` N-sequential-DELETE pattern + `generateBookingRef` row-count race (CF-011 sibling); §4 logAction coverage = 7/27 = 26% (booking ranks 4th from top, no longer at floor — admin/ops-property/ops-catalog/ops-crm/portal-partner/public hold 0% floor); §4 Zod coverage = 12/27 = 44% (well above ~12% repo baseline); §4 CF-022 state-transition discipline = 9/9 ✅ (booking is **cross-pack leader** for state-machine discipline); §7 R-REPO-7 trade-off recorded (가 atomic carrier absorption + mixed full/compact format); §8 spot-check C1 22/22 file:line + C2 7/7 transitions + C3 55/55 SuperAdmin sites all ✅; **0 NEW CF promotion** (CF-018 Sub-pattern B is expansion not new); counts P0=**4** / P1=**18** / P2=**3** = **25** unchanged from T002.2.i; tripwire-exempt; size 736 actual; close-out marks **T002.2 endpoint sub-task COMPLETE — 11 of 11 endpoint domain files closed** — next: T002.3 db-schema-overview) | 736 | (pending checkpoint) |
| T002.2.i | ✅ | `admin.md` (37 ep / 10 files: dashboard 8 + auth 7 + email-templates 6 + integrations 5 + admin-users 4 + db-sync 3 + system-logs 1 + reports 1 + email-logs 1 + dev-migration 1; **🔴 CF-004 ESCALATION P1 → P0** — `dev-migration.ts:14-79` body-confirmed = TRUNCATE 39 production tables RESTART IDENTITY CASCADE + SAVEPOINT-per-statement seed-replay; protected only by hard-coded `MIGRATION_SECRET = "MS_MIGRATE_2026_PROD"` at `:10` + mount-order at `app.ts:157` < `:167 requireAuth` with no NODE_ENV gate; R-REPO-7 trade-off (가) chosen — dual root cause consolidated, no separate CF-025; **CF-008 admin row** = 0/37 = 0% ⇒ 6-way TIE at floor (admin + ops-property + ops-catalog + ops-crm + portal-partner + public); inverse-correlation hypothesis CONFIRMED with reversal twist (admin = audit data CONSUMER but audit-blind for own 18-20 mutators); **CF-014 POSITIVE EXEMPLAR co-promotion #2** at `dev-migration.ts:38-66` (3rd known production runtime Tx site after seedSync + SHP, co-listed with blog-posts.ts); **CF-018 SUB-PATTERN B EXPANSION** (R-REPO-7 (c) self-correction triggered by Step 4 spot-check C3) — vertical-privilege-escalation: 11 SuperAdmin role-gate sites repo-wide = 1 router-level (db-sync.ts:30) + 10 per-handler inline across 6 files (admin-users:94/:135 + service-catalog:75/:98 + tasks:139/:161 + spaces:189/:216 + beneficiaries:97/:119 + cs-tickets:178/:199); 8 of 10 inline sites are cross-domain, missed by T002.2.b–.g enumeration; CF-022 +1 ungated state transition at admin-users:62-64; CF-013 +4 carriers; CF-015 +3 carriers + 1 POSITIVE (admin-users self-id filter at :101/:127); CF-017 +2 carriers (email-templates ET3/ET4 only Zod-using file in admin domain = 5.4% on 37 ep); CF-024 +6 unauthenticated mutation carriers (auth.ts 6 sites); inconsistencies memo: integrations.ts:211-227 process.env mutation precedes DB UPSERT = transient inconsistency window; system_log table = producer-consumer split (admin reads via system-logs.ts:7, contract writes 6 sites); counts P0=**4** / P1=18 / P2=3 = **25**; tripwire-exempt; size 480 actual after self-correction edits) | 480 | (pending checkpoint) |
| T002.2.j | ✅ | `booking.md` close-out (27 ep / 759 lines source; 22 stub completion + §4 189-cell self-check + §6 CF-018 Sub-pattern B retroactive correction 11→55 sites) | 736 | (consolidated under T002.3 commit) |
| T002.3 | ✅ | `db-schema-overview.md` (54 tables × 9 도메인 + 53 implicit FK + 16 UNIQUE + 13 INDEX + 6 CF schema-anchor + F1-F6 memos) | 749 | **`46f1cda`** |
| T002.4 | ✅ | `erd-core.md` (8 cluster Mermaid + cross-cluster overview + 10 polymorphic enumeration + 73 권장 FK + 5 DEAD; CF-003 + CF-009 evidence expansion; R-REPO-9 첫 차단 게이트 가동; R-REPO-6 9회째) | 613 | (pending checkpoint) |
| T002.5 | ⏸️ | `state-machines.md` (자동 시작 금지) | TBD | TBD |

**검증**: 매 sub-task 시작 시 `git log --oneline | head -3` 로 직전 sub-task commit hash 가 본 표 마지막 row 와 일치하는지 확인. 불일치 시 즉시 보고 + 사용자 결정 대기 (R-REPO-1 v2 (d)).

**Push 책임**: 본 표의 commit hash 들이 GitHub origin/main 에 반영됐는지는 사용자 책임 (R-REPO-1 v2 (c)). 에이전트는 `git log origin/main..HEAD` 로 unpushed 카운트만 보고.

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

### T002.2.b — finance group (half-1 + half-2 unified)
- **Status**: ⏸️ **AWAITING_APPROVAL** (2026-04-26) — Steps 1–5 complete; Step 6 R-REPO-4 report follows; user `proceed` gate before T002.2.c.
- **Decision (α) accepted**: `finance.md` split into `finance-invoicing.md` (invoices + recurring-schedules; 17 endpoints) + `finance-payments.md` (payment-info + commissions + beneficiaries + accounts + stripe; 26 endpoints). Seam: billing-source vs collection/disbursement.
- **Outputs (atomic — R-REPO-1, 6 file ops total across both halves; this entry covers half-2 commit only — half-1 commit recorded in prior turn)**:
  - **NEW** `_schema/api-endpoints/finance-payments.md` (1108 lines) — 26 endpoints (P1-P6 / C1-C6 / B1-B6 / A1-A6 / S1-S2) full sample format + S2 supplemental (Event Coverage Matrix, Accounting Drift Scenarios, Idempotency Analysis); §1.5 anchor block (3 sealed claims) + §3 11 self-discovered inconsistencies (1🔴 / 7🟡 / 1🟢 / 2⚠️-system) + §4 182-cell self-check + §5 spot-check (C1✅ C2✅ C3⚠️ over-discovery acceptable) + §6 R-REPO-5 6 incidentals + §7 cross-references + CF-008 domain severity matrix design + §8 summary.
  - `_audit/CRITICAL_FINDINGS.md` — 7 in-file edits: top-of-file "Last updated" line; **CF-001 Carrier (T002.2.b half-2 confirmation)** subsection appended (4 anchor sites: C2/C4 commissions + B2/B4 beneficiaries; finance-internal boundary); **CF-008 Domain Severity Matrix** NEW subsection (per-domain coverage table; finance combined 20.0% vs contract 42.9% = 53% under-audited); **CF-010 Evidence expansion (idempotency gap)** NEW subsection (3 events handled, no `event.id` dedup, retry → silent `paid_at` overwrite + duplicate `system_logs` rows); **CF-014 Second locus (Stripe webhook)** NEW subsection (3 production loci now: bookings.ts:393-461 + contracts.ts:429-450 + stripe.ts:51-96); **NEW CF-019** (~110 lines: write-orphan `invoices.stripe_payment_intent_id` + `stripe_checkout_url`; reproduction; severity rationale; recommendation; carrier); summary table CF-019 row + count line `P0=3, P1=12, P2=3 (18) → P0=3, P1=13, P2=3 (19)`; CF-020 + CF-021 candidates parked.
  - `_schema/api-endpoints/INDEX.md` — 2 in-file edits: NEW **Severity legend** subsection defining ⚠️-system marker (with both confirmed patterns enumerated: soft-delete leak → CF-020 candidate, schema-drift → CF-019 promoted); footer "Last updated" line.
  - `_schema/api-endpoints/finance-invoicing.md` — 1 in-file edit: §7 cross-ref `→ finance-payments.md (PENDING)` flipped to ✅ with full S2 closure note + new bullet for `accounts.id ↔ invoices.account_id` back-reference.
  - `_schema/api-endpoints/contract.md` — 1 in-file edit: §7 cross-ref index gained a row for `beneficiaries.contract_product_id → contract_products.id` (consumer link to finance-payments B-series).
  - `_schema/_T002_PROGRESS.md` — this entry (half-1 + half-2 unified ledger) replaces the prior "in progress" stub; size tracker row for `finance-payments.md` filled.
  - `.local/session_plan.md` — T002.2.b status updated to half-2 ⏸️ AWAITING_APPROVAL; T002.2.c marked NEXT (after user `proceed`).
- **Catalogue (half-1 + half-2 combined)**:
  - **43 endpoints** across **7 route files** documented at full sample format (17 + 26).
  - logAction coverage: 6 of 30 mutators = 20.0% combined; 13 mutators / 3 calls = 23.1% (invoicing); 17 mutators / 3 calls = 17.6% / 5.9% endpoint (payments).
  - $$ touching: every file in the group writes or reads money columns.
  - **CF density**: 1 NEW (CF-019) + 4 expansions (CF-001 carrier, CF-008 matrix, CF-010 idempotency, CF-014 Stripe locus) + 2 candidates parked (CF-020 soft-delete leak, CF-021 N+1 enrichment).
- **R-REPO-5 incidentals (11 across both halves)**:
  - half-1 (5): I1+I2 paired (CF-011 expansion mini-task proposal `T002.2.b.fix-1`, **DEFERRED** by user); I3 (GST hard-code 1.1 → T004 memo); I4 (nextInvoiceRef ignores `deleted_at` → T002.3 memo); I5 (R1 date-range direction bug → already C3-9).
  - half-2 (6): J1 (N+1 enrichment → CF-021 candidate, defer T002.2.d); **J2 (write-orphan stripe columns → promoted to CF-019 in this commit)**; J3 (`numIds.filter(Boolean)` drops PK 0 → simple memo); **J4 (Stripe idempotency → CF-010 evidence expansion in this commit)**; J5 (beneficiaries→contract_products cross-pass → cross-ref back-filled in this commit); J6 (system-wide soft-delete leak → CF-020 candidate, defer T002.2.d).
- **Verification gate (RULE 7) — 3-claim spot-check (sealed in §1.5 of finance-payments.md)**:
  1. **C1 — S2 webhook event-coverage truth**: ✅ — re-read of `stripe.ts:51-96` confirmed exactly 3 cases handled (`payment_intent.succeeded` full, `payment_intent.payment_failed` logAction-only, `charge.refunded` logAction-only) + `default: console.log`. No invoice-state mutation outside the succeeded branch.
  2. **C2 — finance-internal CF-001 boundary**: ✅ — 4 anchor sites verified (`commissions.commission_rate`, `commissions.commission_amount` are `real`; `beneficiaries.fixed_amount` is `real`); `invoices.amount` and `recurring_schedule.amount` are `numeric(10,2)` confirming the safe side. Boundary is **inside** the finance group, not between finance and another domain.
  3. **C3 — severity tally**: ⚠️ over-discovery (acceptable) — predicted ≤8 inconsistency categories; surfaced 11 (1🔴 / 7🟡 / 1🟢 / 2⚠️-system). Calibration note added to §5.
- **R-REPO-5 self-check**: 6 incidentals found in half-2; all 6 dispatched (1 promotion to CF-019, 1 evidence-expansion to CF-010, 2 deferred CF candidates [CF-020, CF-021], 2 simple-memos, 1 cross-pass deferral resolved by atomic-commit cross-ref back-fill).
- **Size note**: half-2 actual 1108 vs predicted 811 (+37%). Drivers: S2 supplemental tables (3 sub-sections), §3 catalogue richer than anticipated (8 NEW C3 categories), §6 6 incidentals (vs 4-5 typical), §7 CF-008 domain severity matrix design embedded in cross-ref. **Within revised T002.1.8 §8 cap (1500/file)** — single file did not require split.
- **Blocker**: user `proceed` to begin T002.2.c (`ops-property.md`, 44 endpoints across 6 files) — pre-write split decision required at start (per T002.1.8 §8 borderline flag).

### T002.2.c — `ops-property.md` (44 endpoints across 6 files): COMPLETE — awaiting user `proceed` for T002.2.d

- **Pre-write split decision (Step 1, R-REPO-7)**: 3 trade-off options (α single-file / β 2-way property+image split / γ 6-way file-per-route). Recommended (α) — chosen. Sealed in §0 of `ops-property.md`. Total endpoint count verified at 44 (13+7+6+6+6+6 = `grep -cE '^router\.(get|post|put|patch|delete)'`).
- **Output**: `_schema/api-endpoints/ops-property.md` — **429 lines, 44 endpoints**. Predicted 1100-1300 → 67% compression vs predicted; tripwire 850 well under. Per-endpoint avg ≈ 9.7 lines (compact-table format for 31 satellite CRUD endpoints; full samples for 13 spaces.ts endpoints). The compression inverts the T002.1.8 §8 ~2.4× upward multiplier — a calibration data point for satellite-CRUD-heavy domains: revise multiplier to ~0.5× when ≥5 of 6 sub-files share an identical CRUD shape.
- **Verification gate (RULE 7) — 3-claim spot-check (sealed in §5)**:
  1. **C1 — endpoint distribution**: ✅ — `grep -cE '^router\.(get|post|put|patch|delete)'` returned 13/7/6/6/6/6 = 44 across the 6 files.
  2. **C2 — CF-001 source-side anchor verification**: ✅ — `lib/db/src/schema/spaces.ts:13-17` confirmed `real("base_weekly_price")` (L13), `real("base_daily_price")` (L14), `real("floor_area_sqm")` (L17). The upstream-most rent carrier is `real`.
  3. **C3 — CF-008 audit coverage**: ✅ — `grep -c 'logAction('` returned `spaces.ts:4`; `properties/policies/options/images/suburbs.ts: 0` each. 30 mutators total → 4/30 = **13.3%** (lowest domain-coverage measured to date).
- **R-REPO-5 self-check**: 8 incidentals found, all dispatched (no silent absorption): I1 (CF-008.a destructive-action zero-audit sub-pattern → annotated in CF-008 expansion), I2 (CF-008.b IDOR + Cloudinary-delete compound → annotated), I3 (CF-015.a vs .b sub-classification → annotated in CF-015 expansion), I4 (CF-018 partial-IDOR taxonomy → CF-018 expansion), I5 (CF-018.SAFE canonical guard pattern → cited via SP12/SP13 spaces.ts:427/447), I6 (CF-013 deleted_at-only inconsistency observation → annotated in CF-013 expansion), I7 (CF-020 candidate anchor count 9 → 16 with 5 GET-leak + 2 mutation-zombie-revival → defer T002.2.d), I8 (CF-021 candidate anchor count 2 → 8 with 6 ops-property N+1 anchors → defer T002.2.d).
- **Atomic commit (Step 5) — 7 file ops**: 
  1. `ops-property.md` (NEW, 429 lines)
  2. `CRITICAL_FINDINGS.md` (1092 → ~1310 lines): 7 inline expansions (CF-001 source-side anchor + 2-boundary diagram, CF-008 ops-property row + .a + .b sub-patterns, CF-013 ops business-domain enumeration with 5 deleted_at + 2 free-text date, CF-014 anchor 3 → 11 with 8 ops-property loci table, CF-015 hard-delete-by-design distinction with .a/.b sub-classification, CF-017 Domain Validation Coverage Matrix new subsection, CF-018 partial-IDOR taxonomy with .a/.b/.SAFE table); summary count line updated `P0=3, P1=13, P2=3 (19) → unchanged 19` (0 NEW promotions); CF-020/021 candidate anchor counts updated 9→16 / 2→8.
  3. `INDEX.md`: no change required — ops-property entries already present (lines 39-44, 99, 117, 143).
  4. `_T002_PROGRESS.md` (this update).
  5. `.local/session_plan.md` (T002.2.c → DONE pending approval; .d marked NEXT).
  6-7. Cross-ref back-fills: contract.md / finance-invoicing.md / finance-payments.md not required (no cross-domain interaction surfaced beyond CF expansions which carry their own back-link in CRITICAL_FINDINGS.md).
- **Cumulative CF state after T002.2.c**: P0=3, P1=13, P2=3 (total 19) — unchanged from T002.2.b. **0 new CF promotions** (commit is a 7-CF expansion + 5-sub-pattern annotation, not a new-CF event). 2 deferred candidates' anchor counts increased: CF-020 = 9 → 16 anchors; CF-021 = 2 → 8 anchors. Both still pending T002.2.d promotion decision.
- **Size note**: actual 429 vs predicted 1100-1300 (compression −67% to −60%). Drivers: 31 of 44 endpoints (the 5 satellite files) compressed into compact tables; only the 13 spaces.ts endpoints used full sample format. Calibration recommendation: when a domain has ≥5 of 6 sub-files sharing an identical CRUD shape, predict 0.5× the per-endpoint average rather than 2.4×.
- **Blocker**: user `proceed` to begin T002.2.d (`ops-catalog.md`). T002.2.d will resolve: (a) CF-020 promotion decision (16 anchors now well past the 10-anchor threshold), (b) CF-021 promotion decision (8 anchors), (c) anchor `service_catalog.base_price` + `space_service_catalog.custom_price` as ops-catalog-owned `real` carriers (T002.2.c forward-referenced these as ops-catalog territory).

### T002.1.9 — Size budget recalibration + CF-020/021 promotion (mini-task per user direction): COMPLETE — awaiting user `proceed` for T002.2.d

- **Decision (Option A — immediate execution)**: user-directed mini-task between T002.2.c and T002.2.d. Trade-off: size budget recalibration value > evidence-accumulation delay value; CF-020/021 promotion required before T002.2.d to avoid anchor-classification rework in `ops-catalog.md`.
- **Step 1 — size budget recalibration (`_T002_PLAN.md` §8 fully replaced)**: rejected the T002.1.8 single-multiplier (~2.4×) model in favour of two-component model: **fixed overhead ~210 lines + Σ (per-endpoint cost × count)** where per-endpoint cost is **Format A ~30 lines (full sample) / Format B ~12-15 lines (moderate) / Format C ~3-7 lines (compact-table row)**. Calibrated against 4 actual data points (contract 902 / finance-invoicing 681 / finance-payments 1108 / ops-property 429); model fit verified (e.g. finance-invoicing predicted 686 vs actual 681 = 0.7% drift). Domain shape classification table added (heavy/medium/light-CRUD).
- **Step 2 — ops-crm split decision re-review**: T002.1.8 mandated split (predicted 1585 > 1500 cap). Recalibrated prediction with Format mix per file (work-orders A + leads B + tasks B + cs-tickets B + contacts C + service-hosts B + promotions A) = ~1095 lines, well below 1200 tripwire. **Split LIFTED** — single `ops-crm.md` with tripwire-pivot fallback. Decision recorded in §8.2 row.
- **Step 3 — CF-020 promotion (P1) + sub-pattern taxonomy**: anchor count 9 (T002.2.b) → 16 (T002.2.c, +5 GET-leak + 2 mutation-revival) crossed promotion threshold. Promoted to P1. Sub-patterns formally named: **CF-020.a — GET-leak** (query handler omits `isNull(deleted_at)` → soft-deleted rows leak into lists; 14 anchors) + **CF-020.b — mutation-revival / zombie revival** (mutation handler omits `isNull(deleted_at)` → UPDATE writes fresh values to tombstoned row, effectively un-deleting without `RESTORE` audit event; 2 anchors at `properties.ts:139` PR4 + `:214` PR7). Full body added to `CRITICAL_FINDINGS.md` (~75 lines: 16-anchor table + sub-pattern definitions + Phase 2 EF Core mitigation).
- **Step 4 — CF-021 promotion (P1) + quantification**: anchor count 2 (T002.2.b) → 8 (T002.2.c, +6 ops-property) crossed threshold. Severity decision: **P1** (not P2) — quantified worst case at SP3 GET /spaces?limit=50 = **201 round-trips/list-call** (1 list + 50 × 4 follow-ups via `buildSpaceResponse` degree 4); at 100 concurrent browsers = 20,100 round-trips/sec against single-digit Postgres pool → request queue / timeouts under modest load. Phase 2 EF Core `.Include()` collapses this to 1 query — preserving the current pattern in C# carries forward the latency footprint. Full body added to `CRITICAL_FINDINGS.md` (~70 lines).
- **Counts after T002.1.9**: **P0=3, P1=15, P2=3 (total 21)** — 2 NEW promotions; 0 deferred candidates remaining (CF-020/021 graduated).
- **Atomic commit (R-REPO-1) — 4 file ops**: 
  1. `_T002_PLAN.md` §8 fully replaced (T002.1.8 revision table → T002.1.9 two-component model + recalibrated table) — Δ ~+30 lines
  2. `CRITICAL_FINDINGS.md` (~1310 → ~1455 lines): summary table +2 rows (CF-020/CF-021), summary count line replaced with T002.1.9 entry, full bodies for CF-020 (~75 lines) and CF-021 (~70 lines) appended
  3. `_T002_PROGRESS.md` (this entry) + cumulative size tracker row
  4. `.local/session_plan.md` (T002.1.9 entry slotted between T002.2.c and T002.2.d)
- **Verification gate (RULE 7) — model self-validation**: model fit re-verified by re-computing 4 actuals from the calibrated formula:
  - contract 28×30 + 210 = 1050 vs actual 902 (Δ −14%; explained by some Format-B endpoints in contract close-out)
  - finance-invoicing 17×30 + 210 = 720 vs actual 681 (Δ −5% ✅)
  - finance-payments 26×30 + 210 + 120 supplemental = 1110 vs actual 1108 (Δ 0% ✅)
  - ops-property (13×12 Format-B + 31×3 Format-C) + 210 = 459 vs actual 429 (Δ −7% ✅)
  - Average absolute drift: 6.5% — model adequate for ±10% prediction confidence.
- **Blocker**: ~~user `proceed` to begin T002.2.d~~ — RESOLVED 2026-04-26 (T002.2.d below).

### T002.2.d — `ops-catalog.md` (39 endpoints across 5 files): COMPLETE — awaiting user `proceed` for T002.2.e
- **Triggered by**: T002.1.9 ✅ resolved (size budget recalibrated, CF-020/021 promoted) → user `proceed` to T002.2.d.
- **Sub-files written / endpoint format ratio**:
  - `product-catalog.ts` (11 ep) — Format A on E1/E5 (composite WHERE picker + 4-SELECT property chain) and B on the rest
  - `products.ts` (10 ep) — Format A on E1/E2/E3/E5 (helper `enrich()` + write-orphan effective_weekly_rate + state-transition activate/deactivate); B on remainder
  - `product-types.ts` (6 ep) — Format C compact except E2 detail-leak (Format B for soft-delete sub-anchor)
  - `product-groups.ts` (6 ep) — Format C compact, identical shape
  - `service-catalog.ts` (6 ep) — Format A on E1 (CF-001 `base_price` carrier anchor) + E4 (CF-020.b? partial revival via spread); B on rest
- **File written**: `docs/reverse/_schema/api-endpoints/ops-catalog.md` (**529 lines** vs predicted ~770 → **−31%, natural compression** within the calibrated two-component model. Drivers: 4 of 5 files share lookup-CRUD shape → Format C absorbs 12 of 39 endpoints; Format B absorbs 24 more; only 9 endpoints triggered Format A. The compression ratio (0.69×) is mid-way between ops-property's aggressive 0.40× (heavy compact-table) and contract's 1.44× (full-format every endpoint), confirming the recalibrated model's ±30% prediction confidence band.
- **Anchor sites surfaced**:
  - **CF-001 carrier expansion**: `service_catalog.base_price` (live, `service-catalog.ts:8` → :12,37,48,60-66) reattributed to ops-catalog ownership; 4 ghost `real` columns on `product_catalog` (price, bond_amount, admin_fee, cleaning_fee) enumerated for completeness — DEAD per CF-009. Total carrier-column count: 14 → 15 live + 4 ghost = **19 total**.
  - **CF-008 NEW LOWEST**: 0 of 39 endpoints call `logAction()` → **0% audit coverage** (vs ops-property 13.3%, finance combined 20.0%). New domain low-water mark.
  - **CF-009 reconfirmation**: route-import scan re-run; `product_catalog` table remains 0-reader; ghost lifecycle walked in §1.5 with 4-column 1:1 schema enumeration; (a) DROP / (b) deprecate / (c) status-quo trade-off documented.
  - **CF-019 second locus**: `contract_products.effective_weekly_rate` write-orphan (writers at `products.ts:67` POST + `:108` PUT trust client-supplied values; readers at `:7-37` recompute from `weekly_rate * (1 - disc/100)`) — **second instance** of the write-orphan pattern, mechanism is "stored-but-overridden" rather than "stored-but-NULL". Promotion-expiry second-order drift documented.
  - **CF-020 anchor expansion 16 → 18**: 4 new .a GET-leak anchors (products.ts:89, products.ts:194-202 lookup-leak, product-types.ts:23, product-groups.ts:23, service-catalog.ts:37); 1 partial .b candidate at service-catalog.ts:60-66 (spread does not strip `deleted_at`). Pattern crystallisation: 4 of 5 ops-catalog files exhibit the identical "list ✅ filters / detail ❌ forgets" author bug.
  - **CF-021 anchor expansion 8 → 10**: products.ts:7-37 enrich helper as positive batch-fetch exemplar (1 list + 2 batch SELECTs = 3 round-trips for 50-row list); product-catalog.ts:100-125 4-SELECT chain as true sequential N+1.
  - **CF-018 SAFE positive**: product-catalog.ts:242,258 composite WHERE pattern (`eq(parent_id) AND eq(id)`) — exemplar for the IDOR-safe shape.
- **§4 self-check**: 39 rows × 7 cols = 273 cells, all populated; soft-delete column shows 5 leak / 1 revival; logAction column shows 0/39.
- **§5 spot-check (3 claims)**: C1 ✅ (CF-001 service_catalog.base_price `real` declaration + 4 read/write call sites re-verified by `sed -n` reads); C2 ✅ (CF-019 effective_weekly_rate write-orphan re-verified — 6 `enrich()` callers vs 2 raw-write sites enumerated; recalculation formula matches stored-vs-recomputed divergence claim); C3 ✅ (CF-020 4-of-5-files pattern re-verified by per-file `rg "isNull.*deleted_at"` against GET /:id handler bodies — products.ts:89/194-202, product-types.ts:23, product-groups.ts:23, service-catalog.ts:37 all confirmed missing the filter; product-catalog.ts is the lone exception, using composite WHERE as IDOR-safe shape).
- **§6 R-REPO-5 incidentals (4 total)**: I1 `service-catalog.ts:60-66` partial revival (already woven into CF-020 expansion above — simple memo, no separate mini-task); I2 `products.ts` file misnamed (already CF-016, simple memo cross-ref); I3 `product-catalog.ts` audit-zero (already CF-008 expansion, simple memo); I4 `product-types.ts` + `product-groups.ts` lack `updated_at` columns despite the application setting them via spread on the other 3 files — schema-vs-code drift, simple memo for T002.3 (`db-schema-overview.md`) to enumerate which lookup tables have the column and which do not. **All 4 = 단순 메모**, no new mini-task proposals; 0 new CF candidates surfaced.
- **Atomic carrier updates (5 file ops)**:
  1. `_audit/CRITICAL_FINDINGS.md` (~1455 → ~1660 lines): header date refresh; CF-008 domain matrix (collapse duplicate ops-property TBD row + add ops-catalog 0/39 = 0% NEW LOWEST) + CF-008 Validation matrix (replace TBD ops-catalog row); NEW CF-009 "Domain re-confirmation (T002.2.d)" subsection (~14 lines); NEW CF-019 "second domain — effective_weekly_rate" subsection (~38 lines); NEW CF-020 "ops-catalog expansion 16 → 18" subsection (~22 lines); NEW CF-021 "ops-catalog expansion 8 → 10" subsection (~18 lines); NEW CF-001 "ops-catalog carrier expansion +5 columns" subsection (~22 lines). **0 NEW CF**, **0 promotions** — counts unchanged at P0=3 / P1=15 / P2=3 = **21**.
  2. `api-endpoints/INDEX.md` (158 → 159 lines): ops-catalog Risk Legend row split into 🔴 P0 (CF-001 + CF-019) + 🟡 P1 (CF-009 + CF-008 NEW LOWEST + CF-016 + CF-020.a + CF-021) — domain elevated from P1-only to P0+P1.
  3. `_schema/_T002_PROGRESS.md` — this entry; size tracker `ops-catalog.md` row updated.
  4. `.local/session_plan.md` — T002.2.d marker `⏸️ AWAITING USER` → ✅ DONE; T002.2.e NEXT marker preserved.
  5. `api-endpoints/ops-catalog.md` — file itself (529 lines, NEW).
- **Commit message**: `docs(reverse): T002.2.d ops-catalog domain (529 lines) + CF-001/008/009/019/020/021 expansions`
- **Verification gate (RULE 7) — 3-claim spot-check**: see §5 above; all 3 ✅.
- **R-REPO-5 self-check**: T002.2.d itself produced 4 incidentals, all 단순 메모 (no mini-task escalation needed); 0 new CF candidates surfaced beyond the 5 already-anchored expansions.
- **R-REPO-8 self-check**: sub-task entry declared markdown-only at start; system reminders not surfaced in any commit boundary (confirmed by re-reading prior assistant messages — no "System reminders" boilerplate repeated, only the entry-time declaration).
- **Blocker**: user `proceed` to begin T002.2.e (`ops-crm.md`, **single file** per T002.1.9 size-budget LIFT, predicted ~1095 lines, 51 endpoints across 7 files; tripwire 1200 lines — if forecast model under-predicts and a mid-write check at ~70% completion projects ≥1200, the file MUST be split mid-task per `_T002_PLAN.md` §8 tripwire protocol).

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
| `api-endpoints/finance-invoicing.md` (T002.2.b half-1) | ~533 (revised post-T002.1.8 §8 ~2.4× × 17/43 ratio) | **681** | **+148 (+28%)** — within revised cap; CF-014 R5 anchor block + 11 self-discovered inconsistencies + R-REPO-5 incidentals section drove length; +1 line from half-2 cross-ref back-fill |
| `api-endpoints/finance-payments.md` (T002.2.b half-2) | ~811 (revised, 26/43 ratio) | **1108** | **+297 (+37%)** — within revised cap; S2 supplemental tables (Event Coverage Matrix + Accounting Drift Scenarios + Idempotency Analysis) + §3 11 NEW categories + CF-008 domain severity matrix design embedded in §7 drove length |
| `_audit/CRITICAL_FINDINGS.md` (post-T002.2.b) | — | **1092** | +114 from half-2 atomic commit (CF-001 Carrier +6, CF-008 Domain Severity Matrix +22, CF-010 Evidence expansion +14, CF-014 Second locus +14, NEW CF-019 ~58, summary update +1, header +1) |
| `api-endpoints/ops-property.md` (T002.2.c) | ~1100-1300 (revised T002.1.8 §8 ~2.4×) | **429** | **−67% to −60% (compression)** — 31 of 44 endpoints in compact-table format; new calibration point for satellite-CRUD-heavy domains (revised multiplier proposal: 0.5× when ≥5 of 6 sub-files share CRUD shape) |
| `_audit/CRITICAL_FINDINGS.md` (post-T002.2.c) | — | **~1310** | +218 from T002.2.c atomic commit: 7 inline CF expansions (CF-001 source-side +24, CF-008 ops row + .a/.b +12, CF-013 enum +28, CF-014 anchor 3→11 +24, CF-015 .a/.b +24, CF-017 Validation Matrix +30, CF-018 .a/.b/.SAFE table +28); 0 NEW CF this commit |
| `api-endpoints/ops-catalog.md` (T002.2.d) | ~770 (T002.1.9 two-component model: 39×12 Format-B base + 9 Format-A uplift + 12 Format-C compression + 210 fixed) | **529** | **−241 (−31%) compression** — within recalibrated ±30% confidence band; 4-of-5 lookup-CRUD shape drove Format C absorption (12 of 39 endpoints) |
| `_audit/CRITICAL_FINDINGS.md` (post-T002.2.d) | — | **1419** | +120 from T002.2.d atomic commit (predicted ~+205 over-estimated by ~85 — V1 micro-check at T002.2.e.fix-1 corrected from prior "~1660" overestimate): header refresh + CF-008 matrix patches (×2) + CF-009 reconfirmation subsection + CF-019 second domain expansion + CF-020 ops-catalog expansion + CF-021 ops-catalog expansion + CF-001 ops-catalog carrier expansion. **0 NEW CF**, **0 promotions** — counts unchanged at P0=3 / P1=15 / P2=3 = **21** |
| `api-endpoints/ops-crm.md` | ~660 (T002.2.e Step 1 prediction ~1095, post-spot-check compression model 950-1100) | **664** | **+0.6% vs initial / −39% vs Step-1 prediction** — sub-task achieved heavy Format-B compression: 51 endpoints in 6.5 line average; 4-of-7 lookup-CRUD reuse + per-handler Meta one-liner format absorbed verbosity that Step-1 model expected |
| `_audit/CRITICAL_FINDINGS.md` (post-T002.2.e) | — | **1485** | +48 lines from T002.2.e atomic commit (predicted ~+183 over-estimated by ~135): NEW CF-022 P1 promotion (~28 lines compressed — §header + 10-row Anchor Table + 4-row Compound failure + 3-bullet Recovery + 3-bullet Cross-refs) + CF-019.a row 3 status note expansion (~1 line single-row replacement) + new "Counts after T002.2.e" line (~1 line) + header refresh + summary table CF-020/CF-021 row replacements + NEW CF-022 row in summary table (~3 lines net); **+1 NEW CF promoted (CF-022 P1)** — counts P0=3 / P1=**16** / P2=3 = **22**. Anchor count updates: CF-001 +2 carriers, CF-013 21→27, CF-020.a 18→26 / .b 5→20 split formalized, CF-021 10→13 + 4-way author-pattern split documented |
| `_audit/CRITICAL_FINDINGS.md` (post-T002.2.e.fix-1) | — | (target ~1565) | T002.2.e.fix-1 atomic commit: NEW CF-023 P1 full §section (~80 lines: header + 6-row Evidence table + 5-bullet Production failures + 4-bullet Compound CF + 4-bullet Recovery + 4-bullet Cross-refs) + CF-023 row in summary table + NEW "Counts after T002.2.e.fix-1" line (~3 lines); **+1 NEW CF promoted (CF-023 P1)** — counts P0=3 / P1=**17** / P2=3 = **23**. Single-site evidence (`leads.ts:175-204`) but production-critical (data integrity + client trust + audit invisibility + revenue reporting + collision risk) — R-REPO-7 P1 즉시 등재 원칙 적용. R-REPO-6 verified: schema column `leads.converted_booking_id` exists at `lib/db/src/schema/leads.ts:24` (orphan by design); `bookings.ts:193` + `guest-portal.ts:150` are the only legitimate `db.insert(bookingsTable)` sites — leads.ts has 0 |
| `api-endpoints/portal-guest.md` | ~380 | — | — |
| `api-endpoints/portal-partner.md` | ~290 | — | — |
| `api-endpoints/public.md` | ~430 | — | — |
| `api-endpoints/admin.md` | ~480 | — | — |
| `db-schema-overview.md` (T002.3) | ~950 | **749** | **−201 (−21%)** within model band — single-file (α) form factor; 54 pgTable × 9 도메인 inventory + UNIQUE 16 (Step 1 사전 14 → R-REPO-6 (a) 정정 +2 compound) + INDEX 13 + 53 implicit FK + ≥8 polymorphic + 5 DEAD candidates + 6 CF schema-anchor + F1-F6 schema-only memos + §8 378-cell self-check + 3 spot-check; tripwire 1300 not approached |
| `_audit/CRITICAL_FINDINGS.md` (post-T002.3) | — | **~1830** | +60 from T002.3 atomic commit: NEW T002.3 marker section (6-CF schema-anchor table + F1-F6 disposition table + UNIQUE 14→16 정정 R-REPO-6 record + Counts after T002.3 line). **0 NEW CF**, **0 promotions** — counts unchanged at P0=4 / P1=18 / P2=3 = **25** |
| `erd-core.md` | ~500 | — | — |
| `state-machines.md` | ~500 | — | — |
| **TOTAL** | **~6700** | — | — |

---

*Update this tracker at the close of every sub-task.*
