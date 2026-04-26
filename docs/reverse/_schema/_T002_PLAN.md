# T002 Pre-flight Plan — STEP 1 `_schema/` documentation

> **Status**: DRAFT — awaiting user approval before T002.1 begins.
> **Purpose**: Lock down ordering, domain boundaries, INDEX columns, sample format, ERD strategy, dead-table policy, verification cadence, and size budget before writing 12+ files. Re-read by any future task that touches `_schema/`.
> **Sources**: `docs/reverse/_audit/T001_RECON_REPORT.md`, `docs/reverse/_audit/CRITICAL_FINDINGS.md`, `docs/reverse/_audit/MONEY_AUDIT.md`, raw scans under `_audit/raw/`. **No `docs/reverse/` legacy files consulted (RULE 1).**

---

## §1. Work Order — why this sequence

| # | Sub-task | Output | Rationale |
|---|---|---|---|
| T002.1 | `api-endpoints/INDEX.md` + first **5 sample endpoints** of `booking.md` | INDEX + 1 sample file (partial) | INDEX freezes the domain mapping for the rest. The 5-endpoint sample lets the user approve the per-endpoint format **before** 348 more are written. |
| T002.2 | All remaining domain files (booking through admin) — full 353 endpoint catalogue | 8 (or 10 if ops splits) files | Format is locked. Each file is independent → can be written per-domain in sequence with light cross-refs. |
| Gate 1 | 3-claim verification on T002.1 + T002.2 outputs | — | Sample claims drawn from booking, ops, and one portal domain. |
| T002.3 | `db-schema-overview.md` | 1 file | Endpoints are the surface; the schema is the substrate. Doing endpoints first prevents over-modelling unused columns. |
| Gate 2 | 3-claim verification on T002.3 | — | Schema-side claims (column types, default values, table-count). |
| T002.4 | `erd-core.md` | 1 file (8 Mermaid diagrams) | Builds on T002.3 — relationships are inferred from join sites in routes (already enumerated in T002.1/2) **and** from FK-shaped column names (already in T002.3). |
| Gate 3 | 3-claim verification on T002.4 | — | ERD relationship correctness. |
| T002.5 | `state-machines.md` | 1 file | Status enums sit on top of schema (T002.3) and are mutated by routes (T002.1/2) — must come last. |
| Gate 4 | 3-claim verification on T002.5 | — | State-transition correctness. |

**Why endpoints before schema?** The original session-plan order (`erd-core` first) is a top-down design instinct. A reverse-engineering pack works better bottom-up: routes are the **observed** behaviour; schema is the structural inference. Writing endpoints first surfaces the actual joins, projections, and ignored columns that schema docs would otherwise over-index on.

**Why state-machines last?** Status enums live in the routes (string literals like `"Active"`, `"Sent"`, `"Paid"`). Until every route is catalogued, the enum extraction is incomplete.

---

## §2. Domain Mapping — 51 route files → 8 (possibly 10) domains

### §2.1 Decision principle

> **File-of-origin rule**: Each endpoint is filed under the domain corresponding to **its source route file's primary entity**. Cross-domain endpoints (e.g. `POST /api/v1/contracts/:id/invoices` in `contracts.ts`) stay with their file (`contract.md`) and carry a **→ cross-ref** line pointing to the related domain (`finance.md`).

This rule is robust because:
- It mirrors the file system. A reader who lands on a route knows immediately where to look in the docs.
- It eliminates re-shuffling: the file an endpoint lives in does not change.
- It pairs naturally with cross-refs, which we add at the per-endpoint level.

The alternative ("primary entity" rule) was rejected because the same entity (e.g. `invoice`) is touched by both `invoices.ts` and `contracts.ts`, and would force a per-endpoint judgement call hundreds of times.

### §2.2 Mapping table (51 files, 353 endpoints) — **verified counts**

| Source file | # endpoints | Assigned domain | Notes |
|---|---:|---|---|
| bookings.ts | 27 | **booking** | Includes `/admin/bookings/*` paths — file-rule wins. |
| contracts.ts | 21 | **contract** | Includes nested `/contracts/:id/invoices/*` and `/contracts/:id/line-items/*`. Cross-ref → finance. |
| contract-types.ts | 7 | **contract** | Lookup-style CRUD for contract types. |
| invoices.ts | 10 | **finance** | |
| recurring-schedules.ts | 7 | **finance** | Drives invoice generation. |
| payment-info.ts | 6 | **finance** | |
| commissions.ts | 6 | **finance** | |
| beneficiaries.ts | 6 | **finance** | Payment recipients. |
| accounts.ts | 6 | **finance** | Boundary case — see §2.3 #1. |
| stripe.ts | 2 | **finance** | Webhook + intent-create. CF-010 anchor. |
| spaces.ts | 13 | **ops** (sub: property) | |
| properties.ts | 7 | **ops** (sub: property) | |
| space-policies.ts | 6 | **ops** (sub: property) | |
| space-options.ts | 6 | **ops** (sub: property) | |
| space-images.ts | 6 | **ops** (sub: property) | |
| suburbs.ts | 6 | **ops** (sub: property) | Boundary case — see §2.3 #2. |
| product-catalog.ts | 11 | **ops** (sub: catalog) | Wired up — keep. |
| products.ts | 10 | **ops** (sub: catalog) | 🪦 DEAD per CF-009 — must be flagged at file level. |
| product-types.ts | 6 | **ops** (sub: catalog) | |
| product-groups.ts | 6 | **ops** (sub: catalog) | |
| service-catalog.ts | 6 | **ops** (sub: catalog) | |
| work-orders.ts | 10 | **ops** (sub: crm) | |
| leads.ts | 8 | **ops** (sub: crm) | |
| tasks.ts | 7 | **ops** (sub: crm) | |
| cs-tickets.ts | 7 | **ops** (sub: crm) | |
| contacts.ts | 6 | **ops** (sub: crm) | |
| service-hosts.ts | 5 | **ops** (sub: crm) | Service-host *directory* (≠ service-host portal). |
| promotions.ts | 8 | **ops** (sub: crm) | Boundary case — see §2.3 #3. |
| guest-portal.ts | 18 | **portal-guest** | |
| guest-cs.ts | 8 | **portal-guest** | |
| guest-auth.ts | 3 | **portal-guest** | |
| service-host-portal.ts | 9 | **portal-partner** | Boundary case — see §2.3 #4 (CF-005 anchor). |
| owner-portal.ts | 5 | **portal-partner** | |
| agent-portal.ts | 5 | **portal-partner** | |
| partner-auth.ts | 3 | **portal-partner** | |
| public.ts | 10 | **public** | |
| lookup.ts | 10 | **public** | Form lookups (suburbs, types). |
| blog-posts.ts | 6 | **public** | Boundary case — see §2.3 #5. |
| page-contents.ts | 3 | **public** | |
| privacy.ts | 2 | **public** | |
| health.ts | 2 | **public** | |
| dashboard.ts | 8 | **admin** | Property-admin dashboard aggregations. |
| auth.ts | 7 | **admin** | Admin-side login/refresh. |
| email-templates.ts | 6 | **admin** | |
| integrations.ts | 5 | **admin** | |
| admin-users.ts | 4 | **admin** | |
| db-sync.ts | 3 | **admin** | |
| dev-migration.ts | 1 | **admin** | CF-004 anchor — flag prominently. |
| system-logs.ts | 1 | **admin** | |
| reports.ts | 1 | **admin** | |
| email-logs.ts | 1 | **admin** | |
| index.ts | 0 | (n/a) | Barrel only. |
| **Total** | **353** | — | ✅ matches recon. |

### §2.3 Boundary cases — pre-decided

1. **`accounts.ts` → finance, not admin.** `accounts` are billable parties (owner / agent / corporate). They carry payment metadata and appear in MONEY_AUDIT cross-table flow #5. Admin-grade CRUD does not move them out of finance — the data is financial.
2. **`suburbs.ts` → ops/property, not public.** Although suburbs are used as form lookups (which would suggest public), the CRUD operations (POST/PUT/DELETE) are admin-side and the entity is a property classifier. The READ endpoints are mirrored into `lookup.ts`, which is in public.
3. **`promotions.ts` → ops/crm, not finance.** Promotions are admin-managed marketing artefacts; they affect the price *at booking time* but the entity itself is operational, not a money-bearing record. Money flow lives in `bookings.ts` where the discount is applied.
4. **`service-host-portal.ts` → portal-partner.** Per the agreed 8-domain list there is no separate `portal-service-host`. Service-host is a third `partner_users.portal_type` (CF-005 says it leaks past TS types). It will be a §-section inside `portal-partner.md` with a header note pointing to CF-005.
5. **`blog-posts.ts` → public.** All endpoints in the file are content endpoints (GET list / GET detail / POST / PUT / DELETE). The mutating endpoints likely require admin auth, but the *file's* primary entity is public-facing content. We surface the auth split inside the file rather than across files.
6. **`/api/v1/contracts/:id/invoices/*` → contract.md (file-rule), not finance.md.** The endpoint mutates an `invoices` row but the route is defined in `contracts.ts`. `contract.md` will document the endpoint and add a `→ finance.md#invoice-lifecycle` cross-ref. `finance.md` will list these endpoints in a "Cross-domain writers to invoices" appendix.
7. **`/api/v1/admin/bookings/*` → booking.md.** Same logic — the routes are in `bookings.ts`. The fact that they sit under `/admin/` is captured in the URL prefix column of INDEX, not in the domain assignment.

### §2.4 Domain endpoint distribution — **size warning**

| Domain | Endpoints | Estimated lines | Risk |
|---|---:|---:|---|
| booking | 27 | ~350 | OK |
| contract | 28 | ~370 | OK |
| finance | 43 | ~560 | OK |
| **ops** | **134** | **~1700** | ❌ **exceeds 1500-line split threshold (§8)** |
| portal-guest | 29 | ~380 | OK |
| portal-partner | 22 | ~290 | OK |
| public | 33 | ~430 | OK |
| admin | 37 | ~480 | OK |

**Recommendation**: split `ops.md` along the §2.2 sub-labels into **3 files**:

- `ops-property.md` — spaces, properties, space-policies, space-options, space-images, suburbs ≈ **44 endpoints, ~570 lines**
- `ops-catalog.md` — product-catalog, products (DEAD), product-types, product-groups, service-catalog ≈ **39 endpoints, ~510 lines**
- `ops-crm.md` — work-orders, leads, tasks, cs-tickets, contacts, service-hosts, promotions ≈ **51 endpoints, ~660 lines**

This keeps every file inside the 1500-line ceiling and matches the natural sub-domain seams already visible in the file list. **❓ Awaiting user approval — accept split (10-file domain layout) or insist on single `ops.md`.**

---

## §3. INDEX.md column schema — final

After weighing each candidate column against its production cost (one row × 51 files = 51 cells per column) and downstream value:

| Column | Keep? | Justification |
|---|---|---|
| **Domain** | ✅ | Anchors the row. |
| **Source file** | ✅ | Click-through target for the reader. Path relative to `artifacts/api-server/src/routes/`. |
| **URL prefix(es)** | ✅ | Every row needs at least one. Some files mount under multiple prefixes — list comma-separated. |
| **# Endpoints** | ✅ | Sums to 353; doubles as integrity check. |
| **Auth guard** | ✅ | One of: `requireAuth`, `requireGuestAuth`, `requirePartnerAuth`, `requireServiceHostAuth`, `requireAdminRole`, `none` (public), `mixed` (file has both). |
| **Public Y/N** | ❌ drop | Redundant with Auth guard column. |
| **logAction Y/N** *(CF-008 tracker)* | ✅ | Cheap (single grep per file). High value — surfaces the audit-coverage gap at the index level. Encoded as `✅` / `❌` / `partial`. |
| **$$ Money-touching** | ✅ | Already enumerated in MONEY_AUDIT §1; mapping file→Y/N is mechanical. Filterable view of finance-relevant routes. |
| **Side-effect density (HIGH/MED/LOW)** | ❌ defer | Definition fuzzy (writes per endpoint? FX calls? emails sent?). Manual judgement on 51 rows is high cost / low repeatability. Deferred to a future audit pass. |
| **Status (ACTIVE/DEAD)** | ✅ | New column — flags `products.ts` 🪦 and any other file marked dead in CF-009. Default `ACTIVE`. |

### Final INDEX.md row schema

| Domain | Source File | URL Prefix(es) | # Endpoints | Auth Guard | logAction | $$ | Status |
|---|---|---|---:|---|---|---|---|

The index will also include:
1. A short prologue (≤ 30 lines) with the file-rule, cross-ref convention, and link list.
2. A footer summary: total endpoints by domain, total by auth guard, total `$$=Y` count, total `logAction=N` count (re-affirms CF-008).

---

## §4. Per-endpoint format — sample for `booking.md` first 5

Each endpoint block is **≤ 35 lines**. Format locked:

```markdown
## [METHOD] /url/path

| Field | Value |
|---|---|
| Source | artifacts/api-server/src/routes/<file>.ts:<startLine>–<endLine> |
| Auth | <guard name or "none"> |
| Status | ACTIVE / DEAD / DEPRECATED |
| Money-touching | ✅ writes <table.col> / ✅ reads only / ❌ none |
| Side effects | <comma-separated list — DB writes, external API calls, emails, logs> |
| logAction | ✅ <action_name> / ❌ none |
| Idempotent | ✅ / ❌ / N/A |

### Request
**Path params**: `:id` — number (booking id)
**Query**: (none) | `?status=…&from=…`
**Body** (if any):
```ts
// Zod schema OR inline literal — transcribed from code, NOT inferred
{
  field_a: number,
  field_b: "Pending" | "Confirmed",
}
```

### Response (success)
```ts
// from res.json(...) — transcribed
{ ok: true, data: { … } }
```

### Logic summary (≤ 5 sentences, file:line citations)
1. Validates the body via Zod (`bookings.ts:LXX`).
2. …

### Cross-references
- → `finance.md#…` if writes invoices
- → CRITICAL_FINDINGS CF-XXX if relevant
- → MONEY_AUDIT §X if money-touching
```

**T002.1 deliverable**: INDEX.md + the **first 5 endpoints of `booking.md`** in this format. User reviews → approves or requests format adjustments → T002.2 proceeds with remaining 348 endpoints.

---

## §5. ERD cluster plan — 8 Mermaid diagrams in `erd-core.md`

55+ tables in one diagram is unreadable. Split into **7 thematic clusters + 1 high-level overview**.

| # | Cluster | Tables (initial — refine in T002.4) | Notes |
|---|---|---|---|
| 1 | **Property** | properties, spaces, space_availability, space_blocked_dates, space_policies, space_options, space_images, suburbs, accommodation_catalog, accommodation_service_catalog, space_service_catalog | Largest cluster. |
| 2 | **Booking** | bookings, booking_service_photos, promotions | quotes are not a separate table — fields on `bookings`. |
| 3 | **Contract** | contracts, contract_line_items, contract_types | |
| 4 | **Finance** | invoices, recurring_schedules, payment_info, commissions, beneficiaries, accounts, stripe-related (no table — just webhook) | `accounts` overlaps with Identity (cross-cluster edge). |
| 5 | **Identity** | users, partner_users, guest_users, refresh_tokens, login_attempts, marketing_consents | `accounts` referenced via dotted edge. |
| 6 | **CRM/Ops** | contacts, leads, tasks, cs_tickets, work_orders, service_hosts, guest_emergency_contacts | |
| 7 | **Catalog** | products 🪦, product_catalog 🪦, product_types, product_groups, service_catalog | Two dead tables — see §6. |
| 8 | **Content/System** | blog_posts, page_contents, announcements, email_templates, email_logs, system_logs, integration_settings, documents | Mostly admin-side. |
| **+ Overview** | **High-level cluster map** — boxes per cluster, edges only where cross-cluster references exist | Last diagram in the file. |

**Mermaid styling decisions** (per agreed Q2 = a):
- Every relationship rendered as a **dotted line** (`-..->`) because no `.references()` exists in code (CF-003). The dotted convention is documented at the top of `erd-core.md` with a **prominent warning box**.
- Each diagram is preceded by a 5-line cluster summary (purpose, table count, notable findings).
- Tables present in the schema but with no observed reads/writes get a `🪦 DEAD` suffix in their node label.
- An **appendix at the end of `erd-core.md`** lists "recommended FK constraints to add" (per agreed Q2=c addendum) — file:line of the inferred parent and child columns, sourced from the route layer's join shapes.

---

## §6. Dead-tables policy

> **REVISED 2026-04-26 (T002.1.6 + T002.1.7)**: forensic re-audit at the **table** level (vs. the original file-level guess) found that **only 1 table is actually dead**, not 2. The "`products` table" that the recon listed never existed — the file `products.ts` defines the *active* `contract_products` table. All §6.2 suspects were also cleared as ACTIVE. See [`SCHEMA_FILE_TABLE_MAP.md`](./SCHEMA_FILE_TABLE_MAP.md) (canonical map) and [CF-009 revised](../_audit/CRITICAL_FINDINGS.md#cf-009) + [CF-016](../_audit/CRITICAL_FINDINGS.md#cf-016).

### §6.1 Confirmed-dead inventory (REVISED — 1 table only)

| Table | Evidence | Recommendation |
|---|---|---|
| `product_catalog` | CF-009 revised — `productCatalogTable` imported by 0 route files (verified `rg "productCatalogTable" routes/` → 0). | Display in ERD with 🪦 suffix + footnote reference to CF-009 (revised). |

### §6.2 Possibly-dead candidates — ALL CLEARED as ACTIVE (T002.1.6)

| Table | Original suspicion | Re-audit verdict | Evidence |
|---|---|---|---|
| `announcements` | No route file named after it. | ✅ ACTIVE | `guest-cs.ts:5` — 5 distinct uses |
| `accommodation_service_catalog` | Cross-table — joins only? | ✅ ACTIVE | 2 route files, normal CRUD |
| `space_service_catalog` | Cross-table — joins only? | ✅ ACTIVE | 2 route files, normal CRUD |
| `product_types` | Lookup serving dead `products`? | ✅ ACTIVE | 3 route files, lookup + CRUD |
| `product_groups` | Lookup serving dead `products`? | ✅ ACTIVE | 3 route files, lookup + CRUD |

**Implication for T002.4 (erd-core)**: apply the 🪦 marker to **`product_catalog` only**. Do NOT mark §6.2 candidates with 🪦, ⚰️, or any "suspect" qualifier — they are confirmed active. Do not invent new visual qualifiers for "almost dead" — none of these qualify.

### §6.3 Display rule (option **c** — recommended)

> **Display the table normally + add 🪦 to the node label + footnote citing CF-009 (or new finding).**

Reasoning over alternatives:
- **(a) grey/strikethrough**: Mermaid's CSS support is limited and inconsistent across renderers. Risk of looking broken.
- **(b) exclude from ERD**: Hides the fact that the table still exists in production DB. Future engineer who hits the schema dump will be confused.
- **(c) normal + 🪦 + footnote**: Keeps the reader oriented. Footnote turns the marker into actionable information.

---

## §7. Verification gate split — 4 rounds × 3 claims = 12 total

> Each gate follows RULE 7. Claims are picked from the **highest-uncertainty** parts of the just-written output, **not** the most-confident parts.

| Gate | After | Claim sources |
|---|---|---|
| **Gate 1** | T002.2 (all endpoint files) | (i) one boundary-case endpoint (e.g. `POST /contracts/:id/invoices` filed under contract.md), (ii) one DEAD-marked endpoint (likely from `products.ts`), (iii) one money-touching endpoint with `logAction=❌` (audit gap visible at the row). |
| **Gate 2** | T002.3 (db-schema-overview) | (i) total table count vs raw scan, (ii) one column type that affected MONEY_AUDIT (e.g. `contracts.weekly_rate` = `real`), (iii) one possibly-dead table from §6.2. |
| **Gate 3** | T002.4 (erd-core) | (i) one cross-cluster edge (e.g. `accounts` ↔ Finance + Identity), (ii) one inferred FK in the appendix (parent/child columns must be cited file:line), (iii) one cluster's table list completeness vs schema dir. |
| **Gate 4** | T002.5 (state-machines) | (i) one status enum value extraction (e.g. `bookings.booking_status` ∈ {…}), (ii) one transition rule (`Active → Cancelled`) cited file:line, (iii) one **missing** transition discovered (CF-010 expected to surface here). |

Errors found at any gate → fix immediately, re-verify, then `proceed` request.

---

## §8. Size budget & split-threshold rules

> **§8 REVISION 2026-04-26 (T002.1.8)** — `contract.md` actual = 893 lines vs predicted 370 (**+141%**). The drift is structural, not domain-specific: the full sample-format-on-every-endpoint pattern adopted in T002.2.a (vs the 5-sample-only pattern in `booking.md`) plus the new permanent sections (Anchor Block, full Self-Check table, Spot-Check Log, R-REPO-5 incidental block) account for the bulk of the increase. Predictions for `.b–.i` are revised upward by **~2.4×** in the table below; new totals project ~10,000 lines across `_schema/` (vs the original ~6700). Hard cap of 1500 lines per file remains in force; `finance.md`, `ops-property.md`, `ops-crm.md`, and `admin.md` are now expected to push against it and may require **preventive sub-splits announced before writing begins** (e.g. `T002.2.b1 invoices.md` + `T002.2.b2 payments.md`). Decision deferred to the start of each sub-task.

| File | Original prediction | **Revised prediction (T002.1.8)** | Hard cap | Action if cap exceeded |
|---|---:|---:|---:|---|
| `api-endpoints/INDEX.md` | ~120 | ~146 (actual) | 250 | unlikely; if so, drop summary footer. |
| `api-endpoints/booking.md` | ~350 | ~700 (5 samples + 22 close-out × 2.4 minus the already-emitted 306 ≈ 700–800 net) | 1500 | OK |
| `api-endpoints/contract.md` | ~370 | **893 (actual)** | 1500 | OK |
| `api-endpoints/finance.md` | ~560 | **~1340** | 1500 | borderline — pre-write split decision required at start of T002.2.b. |
| `api-endpoints/ops-property.md` | ~570 | **~1370** | 1500 | borderline — same. |
| `api-endpoints/ops-catalog.md` | ~510 | **~1225** | 1500 | OK |
| `api-endpoints/ops-crm.md` | ~660 | **~1585 → exceeds cap** | 1500 | **pre-write split mandatory** at start of T002.2.e. |
| `api-endpoints/portal-guest.md` | ~380 | **~915** | 1500 | OK |
| `api-endpoints/portal-partner.md` | ~290 | **~700** | 1500 | OK |
| `api-endpoints/public.md` | ~430 | **~1035** | 1500 | OK |
| `api-endpoints/admin.md` | ~480 | **~1155** | 1500 | OK |
| `db-schema-overview.md` | ~900–1000 | ~900–1000 (re-prediction not yet justified — different file class) | 1500 | TOC by cluster (§5). |
| `erd-core.md` | ~500 | ~500 | 1200 | diagrams render as Mermaid blocks. |
| `state-machines.md` | ~500 | ~500 | 1000 | one section per status enum. |
| **Total pack (`_schema/`)** | ~6500–7000 | **~11,300–11,800** | — | revised across 12–14 files (15–16 if pre-write splits trigger). |

**General rule**: any single file approaching 1500 lines is split along its natural sub-section seams. The split is announced as a separate sub-task in the session plan (e.g. `T002.4a / T002.4b`), never silently. **Revised rule (T002.1.8)**: when revised prediction ≥ 1300 (within 200 lines of cap), the split decision is taken **before writing begins**, not at the cap; this avoids wasted work if the file must be split mid-write.

---

## §9. RESOLVED questions (user-approved 2026-04-26)

> All four open questions answered. Plan is locked. T002.1 begins immediately after this update + `_T002_PROGRESS.md` creation.

### §9.Q1 — `ops.md` split: ✅ APPROVED 3-way split + INDEX visual grouping
- `ops` domain becomes **3 files**: `ops-property.md`, `ops-catalog.md`, `ops-crm.md`. Total `_schema/api-endpoints/` count = **10 files** (booking, contract, finance, ops-property, ops-catalog, ops-crm, portal-guest, portal-partner, public, admin).
- INDEX.md must visually group the three `ops-*` rows. Implementation: use sortable domain prefix `ops-*` so the rows naturally cluster, plus a **"Domain Groups" footnote** at the table foot identifying the cluster and the historical reason for the split (1500-line size cap, see §2.4).

### §9.Q2 — INDEX columns: ✅ APPROVED 8 columns + Risk = 9
- Final column order: **Domain | Source File | URL Prefix | # Endpoints | Auth Guard | logAction | $$ | Status | Risk**.
- **Risk** column scheme:
  - 🔴 — domain has at least one **P0** finding in `CRITICAL_FINDINGS.md` (CF-001 / CF-002 / CF-003).
  - 🟡 — domain has at least one **P1** finding (CF-004 … CF-015 minus the P2 set).
  - 🟢 — only P2 or no finding.
- INDEX **footer** includes a "Risk Legend" subsection mapping each domain → its triggering CF IDs with markdown anchors `(./../CRITICAL_FINDINGS.md#cf-XXX)` for one-click navigation.

### §9.Q3 — Dead-table policy: ✅ APPROVED option (c) with stronger separation + appendix
- Two distinct markers in ERD node labels:
  - **🪦 (tombstone)** = **Confirmed dead** — 0 route references AND 0 schema FK references. Hard verdict.
  - **⚰️ (coffin) or "🪦?"** = **Suspected dead** — ≤2 route references, or routes reference only internally (admin-only setup), or reference pattern ambiguous. Soft verdict, requires Phase 2 investigation.
- `erd-core.md` **appendix** "Dead Tables 정리 후보" with mandatory columns:

  | Table | Status | Last Reference | Suspected Reason | Phase 2 Action |
  |---|---|---|---|---|
  | `products` | 🪦 confirmed dead | (none in routes) | Superseded by `accommodation_catalog` | DROP after audit-log retention check |
  | `product_catalog` | 🪦 confirmed dead | (none in routes) | Superseded by `accommodation_catalog` | DROP after audit-log retention check |
  | `announcements` | ⚰️ suspected | (verify in T002.3) | (verify) | INVESTIGATE |
  | … | … | … | … | … |

  - Phase 2 Action vocabulary: **DROP / KEEP-FOR-AUDIT / RENAME / INVESTIGATE**.
  - "Last Reference" cell is `file:line` (or `(none in routes)` literal). No prose.
- The classification rule is itself documented at the top of the appendix: **"Confirmed = 0 route uses AND 0 FK references; Suspected = ≤2 route uses OR routes-only-internal OR ambiguous reference pattern."**

### §9.Q4 — Sample selection criteria: ✅ APPROVED 5-category coverage (not first-5)
- Sample 5 endpoints selected from `bookings.ts` to **exercise every format dimension** (read / complex-write-with-CFs / money / missing-audit / cross-ref). If any category is unmatched in `booking.md`, borrow from another domain (`contract.md`, etc.) — **pattern coverage > file purity**.
- Final selection (verified against actual `bookings.ts` content):

  | # | Category | Endpoint | File:line | Why |
  |---|---|---|---|---|
  | **S1** | Simple GET | `GET /v1/bookings/:id` | bookings.ts:283 | Minimal — single read + buildBookingResponse enrichment. |
  | **S2** | Complex POST + multi-CF | `PATCH /v1/bookings/:id/confirm` | bookings.ts:368 | **Hits CF-002 (precision-loss `numeric→real` write to contract), CF-007 (`bondAmount = weeklyRate*4` hard-coded), CF-014 (multi-INSERT outside `db.transaction`), cross-domain (creates contract + line items)**. Worst-case stress test for the format. |
  | **S3** | Money-touching create | `POST /v1/bookings` | bookings.ts:161 | Calls `calcStayDetails` which writes `total_rent` derived from `weekly_rate × weeks` (fp arithmetic). Also: **logAction missing** despite a state-creating write. |
  | **S4** | Missing logAction (pure) | `PATCH /v1/bookings/:id/submit` | bookings.ts:355 | Status transition Draft→PendingPayment with **zero logAction**. Pure CF-008 anchor — no money, no cross-ref, just an audit-gap demonstration. |
  | **S5** | Cross-domain read | `GET /v1/bookings/:id/contract` | bookings.ts:533 | Booking → contract domain crossing. Demonstrates the cross-ref convention (file-of-origin = booking; entity = contract). |

  All 5 categories sourced from `booking.md` itself — no borrowing needed. ✅

- After T002.1 sample written, agent runs **Sample Self-Check** (per directive [C]):
  1. Each sample cites `file:line` for both request *and* response (not just one).
  2. DB writes table-named (e.g. `bookings`, `contracts`, `contract_line_items`).
  3. logAction call recorded (✅ / ❌).
  4. Money-impact column populated (writes which money cols, or "read only", or "none").
  5. Cross-references attached where applicable (CF-XXX, MONEY_AUDIT §X, other endpoint).
  6. Audit-gap explicit when logAction missing (`⚠️ Missing logAction (CF-008)` line).
  - Self-check result table prepended to the sample output. Any row missing ✅ → fix before submitting.

### §9.Resolution stamp

| ID | Decision | Section impacted |
|---|---|---|
| Q1 | 3-way ops split + INDEX visual grouping | §2.4, §3, §8 |
| Q2 | 9 columns including Risk + Risk Legend footer | §3 |
| Q3 | Confirmed/Suspected separation + appendix | §6 |
| Q4 | 5-category sample + self-check protocol | §4, §7 |

---

*End of `_T002_PLAN.md` — locked. T002.1 in progress (see `_T002_PROGRESS.md`).*
