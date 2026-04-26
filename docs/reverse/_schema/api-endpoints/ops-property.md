# `ops-property` — 물리 자산 도메인 API 엔드포인트

> **Domain**: `ops-property` (1 of 3 in the `ops` group; companion: `ops-catalog`, `ops-crm` — see [INDEX.md#domain-groups](./INDEX.md#domain-groups)).
> **Files** (6): `routes/spaces.ts` (13 endpoints, the heart) · `routes/properties.ts` (7) · `routes/space-policies.ts` (6) · `routes/space-options.ts` (6) · `routes/space-images.ts` (6) · `routes/suburbs.ts` (6) — total **44 endpoints**.
> **Risk**: 🔴 P0. **File size: 429 lines** (well under 1500 cap; tripwire 850 not triggered).
> **Triggering findings** — [CF-001](../../_audit/CRITICAL_FINDINGS.md#cf-001) (`spaces.base_weekly_price`/`base_daily_price`/`floor_area_sqm` are `real`; geographic `lat`/`lng` on `properties` + `suburbs` also `real` but non-money), [CF-003](../../_audit/CRITICAL_FINDINGS.md#cf-003) (zero `references()` — every parent-child link is application-level: `spaces.property_id`, `properties.suburb_id`, `space_images.space_id`, `space_option_maps.{space_id,space_option_id}`), [CF-008](../../_audit/CRITICAL_FINDINGS.md#cf-008) (4 of 30 mutators emit `logAction` = **13.3% coverage** — lowest yet measured; spaces availability + services only), [CF-013](../../_audit/CRITICAL_FINDINGS.md#cf-013) (5 of 6 `deleted_at` columns lack `withTimezone`; `space_blocked_dates.date` + `space_availability.date` are `text`), [CF-014](../../_audit/CRITICAL_FINDINGS.md#cf-014) (8 multi-step handlers without `db.transaction` — `POST/PUT /spaces` with option_maps, `DELETE /spaces` permanent across 3 tables, block/unblock loops, image upload loop, image set-primary, image delete-with-promotion), [CF-015](../../_audit/CRITICAL_FINDINGS.md#cf-015) (`space_images` table has **no `deleted_at` column** — hard-delete only by design; 5 endpoints offer dual-mode `permanent` flag), [CF-017](../../_audit/CRITICAL_FINDINGS.md#cf-017) **positive exemplar** (4 of 6 satellite files validate **all** endpoints with Zod; ~31/44 = 70.5% coverage — strongest validated domain after `bookings.ts`), [CF-018](../../_audit/CRITICAL_FINDINGS.md#cf-018) (4 of 6 `space-images` nested handlers omit parent-id WHERE clause = IDOR; spaces.ts services 2 handlers = SAFE exemplar with `and(id, space_id)` guard).

---

## §1. Domain Overview

### §1.1 Route file → endpoint map (R-REPO-6 3-way verified: `INDEX.md:39-44` ↔ `T001_RECON_REPORT.md:182-200` ↔ actual `ls`)

| File | Lines | Endpoints | Mutators | logAction | Validated (Zod) | $$ | Mount |
|---|---:|---:|---:|---:|---:|:---:|---|
| `spaces.ts` | 459 | 13 | 8 | **4** (BLOCK/UNBLOCK/ADD_SERVICE/REMOVE_SERVICE) | 6 of 13 (46%) | ✅ (`base_weekly_price`, `base_daily_price` real) | `app.ts` (default `/api`) |
| `properties.ts` | 238 | 7 | 5 | 0 | **7 of 7 (100%)** | ❌ | `app.ts` |
| `space-policies.ts` | 138 | 6 | 4 | 0 | **6 of 6 (100%)** | ❌ | `app.ts` |
| `space-options.ts` | 142 | 6 | 4 | 0 | **6 of 6 (100%)** | ❌ | `app.ts` |
| `space-images.ts` | 205 | 6 | 5 | 0 | **0 of 6 (0%)** | ❌ | `app.ts` (multer upload) |
| `suburbs.ts` | 150 | 6 | 4 | 0 | **6 of 6 (100%)** | ❌ | `app.ts` |
| **Σ** | **1332** | **44** | **30** | **4 (13.3%)** | **31 of 44 (70.5%)** | 1 of 6 | — |

### §1.2 Schema tables owned by this domain

| Table | File:lines | Tables / row | Notes |
|---|---|---|---|
| `spaces` | `spaces.ts:5-32` | 28 cols | `base_weekly_price`/`base_daily_price` `real` ⚠️ (CF-001); `floor_area_sqm` `real`; `deleted_at` no-tz; `created_at`/`updated_at` with-tz |
| `space_option_maps` | `spaces.ts:34-39` | 4 cols | Junction table; **no `deleted_at`/`updated_at`** (immutable, hard-delete only) |
| `space_blocked_dates` | `spaces.ts:41-46` | 4 cols | `date: text` (CF-013); **no `deleted_at`/`updated_at`** (immutable) |
| `properties` | `properties.ts:5-23` | 16 cols | `lat`/`lng` `real`; `approval_status` default `"Pending"`; `deleted_at` no-tz |
| `space_policies` | `space_policies.ts:5-18` | 11 cols | `status` default `"Active"`; `deleted_at` no-tz |
| `space_options` | `space_options.ts:5-14` | 7 cols | `status` default `"Active"`; `deleted_at` no-tz |
| `space_images` | `space_images.ts:3-15` | 10 cols | **No `deleted_at` column** (CF-015 anchor — hard-delete only by design); **no `updated_at`** (caption updates lose history); `varchar` (not `text`) for URLs/captions — sole domain-internal `varchar` use |
| `suburbs` | `suburbs.ts:5-18` | 11 cols | `lat`/`lng` `real`; `deleted_at` no-tz |

**`space_availability` table** is owned by `bookings.ts` schema file (cross-domain) but consumed exclusively by `spaces.ts` block/unblock/availability endpoints — see §1.3 cross-cutting.

### §1.3 Cross-cutting concerns (mutator-side; READ-side enrichment in §3)

- **Application-level FK** (CF-003): every parent-child link is enforced by code only:
  - `spaces.property_id` → `properties.id` (`buildSpaceResponse:33-35`, `spaces.ts list join`)
  - `spaces.parent_space_id` → `spaces.id` self-ref (image fallback chain in `space-images.ts:37-43`)
  - `spaces.space_policy_id` → `space_policies.id` (`buildSpaceResponse:37-39`)
  - `properties.suburb_id` → `suburbs.id` (`properties.ts list join`, `enrichProperty`)
  - `space_images.space_id` → `spaces.id` (no parent-id guard on PUT/PATCH/DELETE — 4 IDOR loci, see §3 C3-IDOR)
  - `space_option_maps.{space_id, space_option_id}` → `spaces.id` × `space_options.id` (junction)
  - `space_blocked_dates.space_id` → `spaces.id` (cascade-by-application in `spaces.ts:199`)
- **No transactions** (CF-014): 8 multi-step handlers identified (counted in §3 C3-TX).
- **`SuperAdmin` gate** (cross-cutting permission): `bulk-delete` and `permanent=true` paths in spaces/properties/policies/options/suburbs reject non-SuperAdmin (5 endpoints + 5 single-delete branches). `space-images.ts` has no permanence gate (no soft-delete option exists at schema level).

### §1.4 Data-flow diagram — money & precision (CF-001/CF-002 source-side anchor)

```
                      ┌─────────────────────────────┐
                      │ spaces.base_weekly_price    │ real ⚠️ CF-001
                      │ spaces.base_daily_price     │ real ⚠️ CF-001
                      └────────────┬────────────────┘
                                   │ read in: bookings list/calculate (cross-domain)
                                   ▼
                  ┌──────────────────────────────────┐
                  │ bookings.weekly_rate              │ numeric(10,2) ✅
                  │ bookings.daily_rate               │ numeric(10,2) ✅
                  │   ← precision LOSS (real→numeric) │
                  │   = CF-002 source-side write       │
                  └────────────┬─────────────────────┘
                               │ contract activation (cross-domain)
                               ▼
                  ┌──────────────────────────────────┐
                  │ contracts.weekly_rate             │ real ⚠️ CF-001
                  │ contracts.total_rent              │ real ⚠️ CF-001
                  │   ← precision LOSS again          │
                  │   = CF-002 receiving side          │
                  └──────────────────────────────────┘
```

**Implication**: `spaces` is the **source-side carrier** of CF-001 for the rent pipeline — money originates here as `real`, briefly normalised to `numeric` at booking-time, then re-stored as `real` at contract-time. Two precision loss boundaries per booking→contract cycle. This data-flow diagram is the **first time the source side is anchored in any T002.2.x doc** — `contract.md` and `finance-invoicing.md` only documented receiving sides. Carries forward into CF-002 evidence-expansion at atomic commit (§7 / Step 5).

### §1.5 Sealed claims (Step 5 spot-check input — frozen at start of §2)

1. **C1** — Endpoint count distribution `13/7/6/6/6/6 = 44` (R-REPO-6 verified at INDEX:39-44 + RECON:182,197,200; per-`router.<verb>` line count via `grep`).
2. **C2** — `spaces.base_weekly_price` and `spaces.base_daily_price` are `real` (lib/db/src/schema/spaces.ts:13-14) → CF-001 source-side anchor → CF-002 data-flow diagram §1.4 produced.
3. **C3** — Domain `logAction` coverage = 4 calls / 30 mutators = **13.3%** (lowest yet); finance combined = 20.0%; contract = 42.9% — adds row to CF-008 Domain Severity Matrix.

---

## §2. Endpoint walk-through

### §2.1 `spaces.ts` — 13 endpoints (full sample format)

#### SP1 — `GET /api/v1/spaces` (`spaces.ts:56-104`)

> **Meta**: Auth `requireAuth` (global) | $$ ✅ (returns `base_weekly_price` / `base_daily_price` `real`) | logAction ❌ | CF-003 (joins via app), CF-017 ✅ Zod, CF-021 candidate (option_maps batch read at L93-95 = 1 SELECT, not N+1 — well-formed; counter-evidence to CF-021)

- **Inputs**: query `space_type? · status? · property_id? · booking_mode? · search?` validated by `ListSpacesQueryParams.safeParse(req.query)` (`:57`).
- **Behavior**: `WHERE deleted_at IS NULL` (`:64`) + optional filters. LEFT JOIN `properties` + `space_policies` for enrichment; second batched SELECT on `space_option_maps` filtered by `inArray(space_id, allIds)` (`:93-95`) — **N+1 averted**, single batch.
- **Output**: `ListSpacesResponse.parse(...)` array of 12-field projections + `space_option_ids[]` per row.
- **Notes**: `parent_space_name` always `null` in list (`:99`) — only resolved in detail (SP3). Soft-delete filter present ✅.

#### SP2 — `POST /api/v1/spaces` (`spaces.ts:106-125`)

> **Meta**: Auth `requireAuth` | $$ ✅ (writes `base_weekly_price`/`base_daily_price` real) | logAction ❌ (CF-008 gap on CREATE) | CF-014 (2-step: insert space + bulk-insert option_maps, no tx) | CF-017 ✅ Zod

- **Inputs**: body `CreateSpaceBody.safeParse(req.body)` (`:107`); destructures `space_option_ids[]` from rest.
- **Behavior**: (i) `db.insert(spacesTable).values(spaceData).returning()` (`:115`); (ii) if `space_option_ids.length > 0`, `db.insert(spaceOptionMapsTable)` bulk for each option (`:117-121`); (iii) `buildSpaceResponse(space)` for full projection.
- **Output**: 201 + `GetSpaceResponse.parse(full)`.
- **CF-014 detail**: failure between (i) and (ii) → orphan space with no options. No idempotency-delete (unlike contract activation), so retry creates duplicate space.
- **CF-008 gap**: space CREATE writes `real`-typed money columns with no audit row.

#### SP3 — `GET /api/v1/spaces/:id` (`spaces.ts:127-146`)

> **Meta**: Auth `requireAuth` | $$ ❌ (read) | logAction ❌ | **CF-020 anchor** (no `isNull(deleted_at)` filter on `:137`) | CF-017 ✅ Zod | CF-021 4× single-row SELECTs in `buildSpaceResponse`

- **Inputs**: `GetSpaceParams.safeParse(req.params)` (`:128`).
- **Behavior**: `SELECT WHERE id = ?` only — **soft-deleted spaces are returned with full money + privacy fields**. `buildSpaceResponse(space)` then issues 4 sequential SELECTs (property + policy + parent + option_maps) — N+1 of degree 4 per call.
- **Output**: `GetSpaceResponse.parse(full)`.
- **CF-020 anchor #1 in this domain** (5 total in §3); soft-delete leak.
- **CF-021 anchor**: 4-SELECT enrichment per detail call; for 100 detail calls = 400 SELECTs. Mitigatable by single 4-table LEFT JOIN.

#### SP4 — `PUT /api/v1/spaces/:id` (`spaces.ts:148-185`)

> **Meta**: Auth `requireAuth` | $$ ✅ (writes real money) | logAction ❌ | CF-014 (3-step: update + delete option_maps + bulk-insert option_maps) | CF-017 ✅ Zod

- **Inputs**: `UpdateSpaceParams` + `UpdateSpaceBody` both safeParse (`:149`, `:155`).
- **Behavior**: (i) update space; (ii) if `space_option_ids !== undefined`: `db.delete(spaceOptionMapsTable)` then bulk-insert (`:174-181`); (iii) `buildSpaceResponse`.
- **CF-014 detail**: same idempotency-by-destruction pattern as `generateContractInvoicesAndSchedules` (CF-014 §3 helper) — author knew partial failure was possible (otherwise the delete-then-reinsert would be unnecessary) but did not wrap in tx. Re-running after crash mid-insert leaves space updated + options wiped.

#### SP5 — `POST /api/v1/spaces/bulk-delete` (`spaces.ts:187-205`)

> **Meta**: Auth `requireAuth` + **`role === "SuperAdmin"`** gate | $$ side-effect ✅ | logAction ❌ (mass-delete with no audit — CF-008 worst case) | CF-014 (3-step permanent: maps + blocked_dates + spaces) | CF-015 dual-mode | CF-017 ❌ no Zod (raw `req.body`)

- **Inputs**: body `{ ids: number[], permanent: boolean }` — **no Zod**, raw destructure.
- **Behavior**: `numIds = ids.map(Number).filter(Boolean)` → **drops ID 0** (J3-class incidental from finance-payments §6 — recurs here, see §6 K1).
  - if `permanent`: 3 sequential `db.delete` across `space_option_maps` + `space_blocked_dates` + `spaces` (no tx — orphan risk).
  - else: bulk `update` `deleted_at = now()`, `status = "Archived"`.
- **CF-008**: SuperAdmin can delete 1000s of spaces with **zero audit trail**.

#### SP6 — `DELETE /api/v1/spaces/:id` (`spaces.ts:207-226`)

> **Meta**: Auth `requireAuth` + permanent-mode `SuperAdmin` gate | $$ side-effect ✅ | logAction ❌ | CF-014 (3-step permanent) | CF-015 dual-mode

- **Inputs**: `DeleteSpaceParams.safeParse(req.params)` (`:208`); `permanent` from query string `?permanent=true` (`:214`).
- **Behavior**: same dual-mode as SP5 but single-row; permanent → 3 deletes, soft → status flip + `deleted_at`.
- **CF-008**: single-space delete also unaudited (cf. contract activate has `logAction` for STATUS_CHANGE).

#### SP7 — `GET /api/v1/spaces/:id/availability` (`spaces.ts:228-278`)

> **Meta**: Auth `requireAuth` | $$ ❌ | logAction ❌ | **CF-013 anchor** (`from`/`to` query params are `text` cast to `Date`, no tz) | CF-017 ❌ no Zod (raw `req.query`)

- **Inputs**: raw `req.params.id` (`Number()`); raw `req.query.from`/`req.query.to` defaulting to today + 30d.
- **Behavior**: `space_availability` rows by date range (`:241-246`); fills calendar day-by-day for `[from, to]` inclusive — generates ≤30 default-window entries; rec-or-default: present rec → use, else `is_available: true` (default-on policy).
- **Output**: `{ space_id, space_name, from, to, calendar[], available_count, blocked_count }` raw object — no Zod-validated response.
- **CF-013**: `space_availability.date` is `text` (not `date`) per `bookings.ts` schema sister-table; date arithmetic uses `Date` constructor → ambiguous timezone semantics around DST boundaries.

#### SP8 — `POST /api/v1/spaces/:id/availability/block` (`spaces.ts:280-304`)

> **Meta**: Auth `requireAuth` | $$ ❌ | **logAction ✅** (`action: "BLOCK"`) | CF-014 (loop INSERT, no tx) | CF-017 ❌ no Zod (raw `req.body`)

- **Inputs**: raw `{ dates: string[], reason?: string }`; default `reason = "Manual"`.
- **Behavior**: existence-check space; loop `db.insert(spaceAvailabilityTable).onConflictDoUpdate({ target: [space_id, date], set: { is_available: false, block_reason } })` (`:292-299`); audit `BLOCK` (`:301`).
- **CF-014**: N sequential INSERTs (one per date) without tx. For a 30-day block: 30 sequential round-trips, no atomicity.
- **Audit ✅** but no per-date logging (single audit row covers entire batch).

#### SP9 — `POST /api/v1/spaces/:id/availability/unblock` (`spaces.ts:306-330`)

> **Meta**: Auth `requireAuth` | logAction ✅ (`UNBLOCK`) | CF-014 loop INSERT | CF-017 ❌ no Zod

- Behavior: mirror of SP8; uses `onConflictDoUpdate` to set `is_available: true, block_reason: null, booking_id: null`.
- Same CF-014 multi-write risk.

#### SP10 — `GET /api/v1/spaces/:id/services` (`spaces.ts:335-366`)

> **Meta**: Auth `requireAuth` | $$ ✅ (returns `custom_price` real + `base_price` real from service_catalog) | logAction ❌ | CF-001 carrier (cross-domain join exposes 2 `real` money fields)

- **Behavior**: INNER JOIN `space_service_catalog` × `service_catalog` on `service_id`; 12-field projection ordered by `sort_order, name`.
- **Cross-domain note**: this is the **only ops-property endpoint that surfaces `service_catalog.base_price` and `space_service_catalog.custom_price`** — both `real`. Phase 2 finance carrier impact = `service_catalog` migration must precede this endpoint's port (otherwise client floats are exposed).

#### SP11 — `POST /api/v1/spaces/:id/services` (`spaces.ts:369-404`)

> **Meta**: Auth `requireAuth` | $$ ✅ (writes `custom_price` real) | **logAction ✅** (`ADD_SERVICE`) | CF-014 (existence-check + insert, racy) | CF-017 ❌ no Zod (raw `req.body`)

- **Inputs**: raw `{ service_id, is_mandatory?, custom_price?, sort_order? }` cast.
- **Behavior**: (i) check existing mapping (race); (ii) if not exists, insert; (iii) audit. Race window between (i) and (ii) → can produce duplicate mapping (no unique constraint on `(space_id, service_id)` per schema review).
- **CF-014 lite**: 2-step racy (no tx).

#### SP12 — `PUT /api/v1/spaces/:id/services/:mapId` (`spaces.ts:407-436`)

> **Meta**: Auth `requireAuth` | $$ ✅ (writes `custom_price` real) | logAction ❌ (mutator without audit) | **CF-018 SAFE exemplar** — uses `and(eq(id, mapId), eq(space_id, spaceId))` (`:427`) | CF-017 ❌ no Zod

- **Behavior**: parent-id WHERE guard correctly applied. **This is the canonical SAFE pattern for nested-write handlers** — referenced in CF-018 carrier as the recommended fix shape for the 7 vulnerable handlers.
- **Discovered finding**: positive exemplar adds 1 SAFE row to CF-018 audit table (audit was previously: 7 vulnerable + 3 partial + **7 safe** of 17 — confirms upper count; this domain contributes 2 of those 7 safes).

#### SP13 — `DELETE /api/v1/spaces/:id/services/:mapId` (`spaces.ts:439-457`)

> **Meta**: Auth `requireAuth` | $$ side-effect | **logAction ✅** (`REMOVE_SERVICE`) | **CF-018 SAFE exemplar** | CF-017 ❌ no Zod

- **Behavior**: same parent-id guard as SP12; hard-delete (no soft-delete option for mappings). 2nd SAFE example in this file.

### §2.2 `properties.ts` — 7 endpoints (compact format)

> **Meta (file-level)**: Auth `requireAuth` (all 7) | $$ ❌ | logAction ❌ (0 of 5 mutators — CF-008 gap) | CF-017 ✅ all 7 validate (Zod positive exemplar) | CF-013 `lat`/`lng` `real`, `deleted_at` no-tz

| ID | Endpoint | Lines | Behaviour | Discovered findings |
|---|---|---:|---|---|
| **PR1** | `GET /v1/properties` | 21-58 | List with `WHERE deleted_at IS NULL` + filters (approval_status, owner_account_id, suburb_id, search); LEFT JOIN suburbs for `suburb_name`; `owner_account_name` always `null` (TODO debt) | List filter ✅; `owner_account_name: null` is **stub-data leak**: client receives field but value is uniformly null. **Inconsistency** [P-stub] |
| **PR2** | `POST /v1/properties` | 60-80 | Insert + 1 follow-up SELECT for suburb name (CF-021 N+1 lite — 2 round-trips per create) | CF-014 lite (2-step but read-after-write, low risk); CF-008 mutator without audit |
| **PR3** | `GET /v1/properties/:id` | 82-124 | LEFT JOIN suburbs; **no `isNull(deleted_at)` filter** (`:111`) → soft-delete leak | **CF-020 anchor #2** |
| **PR4** | `PUT /v1/properties/:id` | 126-161 | Update + same suburb follow-up SELECT (CF-021 lite) | CF-008 mutator without audit; no soft-delete check before update (can resurrect soft-deleted rows) |
| **PR5** | `POST /v1/properties/bulk-delete` | 163-179 | SuperAdmin gate; `permanent` → hard-delete; else `deleted_at = now()` (no `status` field — properties has no status column other than `approval_status`) | **CF-008** mass-delete unaudited; J3-class `numIds.filter(Boolean)` drops ID 0 |
| **PR6** | `DELETE /v1/properties/:id` | 181-199 | Single-row dual-mode delete; SuperAdmin gate on permanent | CF-008 unaudited |
| **PR7** | `PATCH /v1/properties/:id/status` | 201-236 | State transition `approval_status` (target values not enumerated in schema; default `"Pending"`) + suburb follow-up SELECT | **State transition without `logAction`** — only state-changing endpoint in this file, audit gap critical for compliance (property approval is a regulated action) |

### §2.3 `space-policies.ts` — 6 endpoints (compact format)

> **Meta (file-level)**: Auth `requireAuth` | $$ ❌ | logAction ❌ (0 of 4 mutators) | CF-017 ✅ all 6 (Zod positive exemplar) | CF-013 `deleted_at` no-tz

| ID | Endpoint | Lines | Behaviour | Discovered findings |
|---|---|---:|---|---|
| **SL1** | `GET /v1/space-policies` | 18-33 | List `WHERE deleted_at IS NULL` + optional `search` ilike on `name` | Soft-delete filter ✅ |
| **SL2** | `POST /v1/space-policies` | 35-44 | Insert; immediate `GetSpacePolicyResponse.parse` from inserted row | Plain CRUD; CF-008 unaudited |
| **SL3** | `GET /v1/space-policies/:id` | 46-64 | `WHERE id = ?` only — **no soft-delete filter** | **CF-020 anchor #3** |
| **SL4** | `PUT /v1/space-policies/:id` | 66-91 | Update; auto-bumps `updated_at = new Date()` | CF-008 unaudited |
| **SL5** | `DELETE /v1/space-policies/:id` | 93-118 | Dual-mode (permanent SuperAdmin gate); soft = `deleted_at + status: "Archived"` | CF-015 dual-mode |
| **SL6** | `POST /v1/space-policies/bulk-delete` | 120-136 | SuperAdmin gate; same dual-mode bulk pattern | J3 `numIds.filter(Boolean)` ID=0 drop |

### §2.4 `space-options.ts` — 6 endpoints (compact format)

> **Meta (file-level)**: identical to §2.3 except adds `category` filter on list. logAction ❌ (0 of 4 mutators); CF-017 ✅ all 6.

| ID | Endpoint | Lines | Behaviour | Discovered findings |
|---|---|---:|---|---|
| **SO1** | `GET /v1/space-options` | 18-37 | List with `deleted_at IS NULL` + optional `search` (name ilike) + `category` exact | Soft-delete filter ✅ |
| **SO2** | `POST /v1/space-options` | 39-48 | Insert + parse-back | CF-008 unaudited |
| **SO3** | `GET /v1/space-options/:id` | 50-68 | `WHERE id = ?` only | **CF-020 anchor #4** |
| **SO4** | `PUT /v1/space-options/:id` | 70-95 | Update + `updated_at` bump | CF-008 unaudited |
| **SO5** | `POST /v1/space-options/bulk-delete` | 97-113 | SuperAdmin gate; same dual-mode | J3 ID=0 drop |
| **SO6** | `DELETE /v1/space-options/:id` | 115-140 | Dual-mode single delete | CF-015 |

### §2.5 `space-images.ts` — 6 endpoints (Cloudinary + multer; **all 6 unvalidated**)

> **Meta (file-level)**: Auth `requireAuth` | $$ ❌ | logAction ❌ (0 of 5 mutators) | **CF-017 ❌ all 6 unvalidated** (raw `req.body as` casts; multer for files) | **CF-018 4 IDOR-class handlers** (already in T002.1.8 audit) | CF-015 (`space_images` table has **no `deleted_at` column** — hard-delete-only by design)

| ID | Endpoint | Lines | Behaviour | Discovered findings |
|---|---|---:|---|---|
| **SI1** | `GET /v1/spaces/:id/images` | 22-63 | 3-tier fallback chain: own → parent_space → root-of-property; emits `source` field tagging which tier matched. Inner helper `getImagesForSpace(spaceId)` ordered by `is_primary DESC, display_order ASC, created_at ASC` | **Inconsistency [SI-fallback]**: `data: []` returned with `source: "own"` for both "no images at all" and "no `space.parent_space_id`+`space.property_id` set" → indistinguishable from caller. Suggests missing `source: "none"` fourth value. CF-021 lite (up to 2 chained SELECTs for fallback) |
| **SI2** | `POST /v1/spaces/:id/images` | 65-127 | Multer upload (≤20 MB/file); existence-check space; loop over files: optional Cloudinary upload, demote prior primary if first-ever upload, insert `space_images` row | **CF-014 worst-case in this domain**: per file = (1) optional Cloudinary HTTP, (2) optional UPDATE all primary→false, (3) INSERT row — N files × 3 ops, no tx. Mid-loop crash leaves Cloudinary objects + DB rows partially in sync. **CF-018 SAFE** for parent-id (existence-checks `space.id`). Base64 fallback when Cloudinary unconfigured (`:103-105`) — **24-bit truncation** of binary as base64 in DB, file_url length unbounded → potential DB row blow-up |
| **SI3** | `PUT /v1/spaces/:id/images/:imageId` | 129-144 | Update `caption` only; **WHERE `eq(id, imageId)` only** — no parent-id guard | **CF-018 IDOR vulnerable** (already in T002.1.8 audit) — caller can update caption of *any* image by guessing `imageId`, regardless of `:id` (space) in URL. Already documented; this row re-confirms |
| **SI4** | `PATCH /v1/spaces/:id/images/:imageId/set-primary` | 146-160 | (1) Bulk UPDATE all images of `spaceId` `is_primary=false`; (2) UPDATE `imageId` `is_primary=true` — **WHERE `eq(id, imageId)` only** for step 2 | **CF-018 IDOR partial / cross-space corruption**: step (1) demotes correct space's primary; step (2) promotes a possibly-wrong space's image. Net effect: spaceA loses its primary, imageX (belonging to spaceB) gets `is_primary=true` while remaining child of spaceB. **CF-014**: 2-step no tx |
| **SI5** | `DELETE /v1/spaces/:id/images/:imageId` | 162-187 | Fetch image; if `cloudinary_id` → `deleteFromCloudinary`; DELETE row; if was primary → promote next-by-display_order to primary | **CF-018 IDOR vulnerable** (`:167` `eq(id, imageId)` only); **CF-014**: 4 steps (fetch + cloud + delete + maybe-promote) no tx; **CF-015 anchor**: hard-delete without `deleted_at` option (because table has no such column) |
| **SI6** | `PATCH /v1/spaces/:id/images/reorder` | 189-203 | Loop UPDATE display_order from `order: [{id, display_order}]` array | **CF-018 IDOR vulnerable** (`:199` `eq(id, item.id)` only — no `space_id` guard); attacker can reorder any space's images. **CF-014**: N sequential UPDATEs no tx |

### §2.6 `suburbs.ts` — 6 endpoints (compact format)

> **Meta (file-level)**: Auth `requireAuth` | $$ ❌ | logAction ❌ (0 of 4 mutators) | CF-017 ✅ all 6 (Zod positive exemplar) | CF-013 `lat`/`lng` `real`, `deleted_at` no-tz

| ID | Endpoint | Lines | Behaviour | Discovered findings |
|---|---|---:|---|---|
| **SU1** | `GET /v1/suburbs` | 18-45 | List with `deleted_at IS NULL` + filters `country_code` exact + `state` exact + `search` (OR ilike across `name` + `area_name`) | Cleanest list-filter in domain — only file using `or(...)` for multi-column search. Soft-delete filter ✅ |
| **SU2** | `POST /v1/suburbs` | 47-56 | Insert + parse-back | CF-008 unaudited |
| **SU3** | `GET /v1/suburbs/:id` | 58-76 | `WHERE id = ?` only | **CF-020 anchor #5** |
| **SU4** | `PUT /v1/suburbs/:id` | 78-103 | Update + `updated_at` bump | CF-008 unaudited |
| **SU5** | `POST /v1/suburbs/bulk-delete` | 105-121 | SuperAdmin gate; dual-mode | J3 ID=0 drop |
| **SU6** | `DELETE /v1/suburbs/:id` | 123-148 | Dual-mode single delete | CF-015 |

---

## §3. Self-discovered inconsistencies & cross-cutting findings (16 categories)

| # | Category | Severity | Sites | Disposition |
|---|---|:---:|---|---|
| **C3-VAL** | CF-017 **positive exemplar amplification** — properties / policies / options / suburbs all 4 files validate **every** endpoint via `safeParse` | 🟢 P2 (positive) | properties.ts × 7, space-policies.ts × 6, space-options.ts × 6, suburbs.ts × 6 = **25 of 25 endpoints in 4 files** | CF-017 carrier addition: now **3 positive exemplar files / domains** (booking.ts, finance-payments R2, ops-property × 4). Domain validation rate 70.5% (31/44) — strongest measured. **Recommended re-baseline**: CF-017 originally claimed ~10% project-wide; ops-property contradicts the assumed uniformity. Atomic commit will append "Domain Validation Coverage Matrix" to CF-017 (parallel to CF-008 Domain Severity Matrix). |
| **C3-IDOR** | CF-018 IDOR — `space-images.ts` 4 of 5 nested-write handlers omit parent-id guard; 2 spaces.ts services handlers correctly use `and(id, space_id)` | 🟡 P1 | SI3 PUT `:129`, SI4 set-primary `:155`, SI5 DELETE `:172,182`, SI6 reorder `:199` (vulnerable); SP12 `:427`, SP13 `:447` (SAFE exemplar) | Already in CF-018 audit (T002.1.8 enumerated 7 vuln + 3 partial + 7 safe of 17). This domain confirms 4 vuln + 2 safe. SP12/SP13 promoted to "canonical SAFE pattern" reference. |
| **C3-TX** | CF-014 multi-write without `db.transaction` — 8 handlers in this domain | 🟡 P1 | SP2 (insert+option_maps), SP4 (update+delete+insert option_maps), SP5 (3 deletes permanent), SP6 (3 deletes permanent), SP8 (loop INSERT block), SP9 (loop INSERT unblock), SI2 (cloudinary+demote+insert per file in loop), SI4 (2 updates), SI5 (4 sequential ops), SI6 (loop UPDATE) | CF-014 evidence-expansion: anchor count was 3 (bookings + contracts + stripe). This adds **8 more loci** → 11 total. Atomic commit appends "ops-property loci" subsection. |
| **C3-SOFT** | **CF-020 candidate** soft-delete leak — `GET /:id` lacks `isNull(deleted_at)` in 5 of 6 detail endpoints | 🟡 P1 (system) | SP3 spaces:137, PR3 properties:111, SL3 policies:56, SO3 options:60, SU3 suburbs:68 | **CF-020 promotion threshold reached**: 9 prior anchors (finance) + 5 here = **14 anchors across 4 domains** (finance-invoicing E3/E10, finance-payments P3/C3/B3/A3 + 3 prior, ops-property SP3/PR3/SL3/SO3/SU3). User-deferred to T002.2.d for promotion; this domain doc carries the count forward to 14 in the §6 incidentals table for promotion rationale. |
| **C3-NPLUS1** | **CF-021 candidate** N+1 enrichment — `buildSpaceResponse` issues 4 single-row SELECTs (property + policy + parent + option_maps) per call; `properties.ts` 3 endpoints (PR2/PR4/PR7) issue 1 follow-up SELECT for suburb name | 🟡 P1 (system) | spaces.ts:32-54 helper × invoked from SP2/SP3/SP4 (3 callers) = **3 anchors at degree 4**; properties.ts:69-71/150-152/225-227 = **3 anchors at degree 1** | CF-021 candidate evidence: finance-payments had 2 domains; ops-property adds 6 more anchors → **8 anchors across 3 domains**. Defer-confirm at T002.2.d unchanged. |
| **C3-013** | CF-013 timezone — domain enumeration (BUSINESS DOMAIN FIRST ENTRY) | 🟡 P1 | spaces.deleted_at no-tz (`:29`); properties.deleted_at no-tz (`:20`); space_policies.deleted_at no-tz (`:15`); space_options.deleted_at no-tz (`:11`); suburbs.deleted_at no-tz (`:15`); space_blocked_dates.date `text` (`spaces.ts:44`); space_availability.date `text` (cross-table, owned by bookings.ts schema). **5 deleted_at + 2 free-text date** = 7 ops-property timezone anchors | CF-013 evidence: previously 21 of 145 timestamp() lacked tz; ops-property contributes **5 of those 21** + adds 2 free-text date columns (running anchor inventory). Atomic commit adds "ops-property business-domain timezone enumeration" subsection. |
| **C3-AUDIT** | CF-008 worst-yet domain coverage 13.3% | 🟡 P1 | 4 logAction calls, 30 mutators, 4 endpoints with audit (SP8/SP9/SP11/SP13) of 30 | CF-008 Domain Severity Matrix row addition: ops-property = 13.3% (vs finance 20.0%, contract 42.9%) — **new lowest**. Worth noting: the 4 audited mutators are all "side-effect on already-existing entity" (block/unblock/add/remove service); none of the **CRUD on the entity itself** (create/update/delete space, property, policy, option, image, suburb) is audited |
| **C3-PERM-AUDIT-GAP** | **CF-008 sub-pattern**: `permanent=true` deletes (5 endpoints + 5 single-row branches) skip audit despite being the most destructive operations | 🟡 P1 | SP5/SP6 (spaces), PR5/PR6 (properties), SL5/SL6 (policies), SO5/SO6 (options), SI5 (images), SU5/SU6 (suburbs) = **11 hard-delete branches with no audit** | **NEW C3 sub-finding**: the SuperAdmin gate is treated as the only safeguard, but a malicious or compromised SuperAdmin can wipe spaces / properties without trace. Promotion candidate to "CF-008 sub-pattern" once measured across remaining domains. **Defer-confirm at T002.2.j (admin.md)**. |
| **C3-001-SOURCE** | CF-001 source-side anchor identified for the first time — `spaces.base_weekly_price` / `base_daily_price` are the **upstream origin** of the rent figure; data flows space → booking (numeric) → contract (real); §1.4 diagram | 🔴 P0 | spaces.ts:13-14 (real), bookings.weekly_rate (numeric), contracts.weekly_rate (real) — 2 precision-loss boundaries | CF-001 + CF-002 evidence-expansion: **adds the source-side carrier**, completing the rent-pipeline picture. Previously CF-001 listed `spaces.base_weekly_price`/`base_daily_price` in the Phase-2 carrier inventory but did not mark them as the **rent flow source**. CF-002 boundary count revised: 1 (booking→contract) → 2 (space→booking + booking→contract). Atomic commit updates CF-001 evidence list framing + CF-002 boundary diagram. |
| **C3-DEL-NULL** | `space_images` table has **no `deleted_at` column** — hard-delete-only by design (CF-015 anchor) | 🟢 P2 | space_images.ts schema has no `deleted_at` | CF-015 carrier: this domain's image table is the **first anchored "hard-delete-only-by-design" table**. Past CF-015 anchors all had `deleted_at` and chose to skip it; here the column is absent so soft-delete is impossible. Worth distinguishing in CF-015 — "design omission" vs "behaviour omission". |
| **C3-IMG-FALLBACK** | SI1 3-tier fallback chain (own → parent → property root) returns `data: []` with `source: "own"` for "no images at all" — indistinguishable from "no fallback found" | 🟢 P2 | space-images.ts:35,62 | Local UX defect; simple memo to `_rules/api-rules.md` (T004) — recommend `source: "none"` fourth value. |
| **C3-BASE64-BLOAT** | SI2 base64 fallback when Cloudinary unconfigured stores image binary as `data:...;base64,...` URL string in DB `file_url` column (`varchar(500)` declared but data exceeds 500 chars) — likely silent truncation or insert failure | 🟡 P1 | space-images.ts:104; schema:6 declares `varchar("file_url", { length: 500 })` | **Upgrade-worthy**: 20 MB image → ~28 MB base64 → 28,000,000 chars >> 500 char limit. Either (a) Cloudinary is always configured in production (reasonable but unverified), or (b) any insert in the fallback branch crashes with PG `value too long` error. Sandbox-only path; treat as production correctness bug. **Promotion candidate**: CF-XXX (TBD next domain) — defer-confirm at T002.2.f (portal-guest may include similar upload). |
| **C3-OWNER-NULL** | `properties.ts` returns `owner_account_name: null` uniformly — stub field (TODO debt) | 🟢 P2 | properties.ts:54,77,121,158,233 (5 sites) | Simple memo: T002.5 state-machines / T004 api-rules — `owner_account_id` enrichment never wired up. Production frontend likely shows blank "owner name" column. |
| **C3-RAW-BODY** | 7 endpoints in spaces.ts + 6 endpoints in space-images.ts skip Zod validation (`req.body as { ... }` casts) | 🟡 P1 | SP5, SP7, SP8, SP9, SP10, SP11, SP12, SP13 (8 in spaces.ts after re-count); SI1-SI6 (6 in space-images.ts) — total 14 of 44 = 31.8% unvalidated | CF-017 carrier: while domain-wide 70.5% is strong, the **un-validated subset is concentrated in spaces.ts side-effect handlers** (block/unblock/services/availability) and the entire space-images.ts file. Suggests Zod was wired for "primary CRUD" path but not for "operations" path. Re-baseline anchor for CF-017. |
| **C3-PROPS-RES** | PR4 `PUT /properties/:id` does not check `isNull(deleted_at)` before update — soft-deleted properties can be revived by update without admin intent | 🟡 P1 | properties.ts:139 (also PR7 status patch :214) | **CF-020 sub-pattern** ("zombie revival via update"): different from soft-delete leak in GET; same root cause (no `isNull(deleted_at)` filter on mutation predicates). Same defer rationale. Adds 2 more anchors to CF-020 candidate (now 14 + 2 = 16). |
| **C3-IMG-AUDIT** | space-images.ts has **zero audit** despite being the only file with destructive external side-effects (Cloudinary delete on SI5) | 🟡 P1 | space-images.ts (entire file: SI1-SI6) | CF-008 sub-anchor: image deletes call `deleteFromCloudinary(image.cloudinary_id)` (`:170`) — irreversible external mutation with no audit trail. If a malicious user exploits the SI5 IDOR (C3-IDOR), they can permanently delete arbitrary Cloudinary assets across all spaces with no log. Defer to CF-008 audit. |

**Self-check**: 16 categories surfaced (predicted ≤8 in §1.5; **over-discovery 2×** — same direction as finance-payments, calibration confirms ops-property's surprise complexity for a "non-money domain"). Severity tally: 1🔴 + 9🟡 + 4🟢 + 2 sub-patterns = 16 total.

---

## §4. Self-check matrix (44 endpoints × 8 attributes = 352 cells)

> Format: ✅ present / ❌ absent / ⚠️ partial / N/A not-applicable. **Validation discipline**: every row was re-derived from the route handler quotes in §2 (no aggregation shortcuts).

| ID | Auth | $$ | Zod-validated | logAction | Soft-delete-filter on read | Tx-wrapped | Idempotent | Parent-guard (nested) |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| SP1 | ✅ | ✅ | ✅ | ❌ | ✅ | N/A | ✅ (read) | N/A |
| SP2 | ✅ | ✅ | ✅ | ❌ | N/A | ❌ | ❌ | N/A |
| SP3 | ✅ | ❌ | ✅ | ❌ | ❌ **CF-020** | N/A | ✅ | N/A |
| SP4 | ✅ | ✅ | ✅ | ❌ | N/A | ❌ | ❌ | N/A |
| SP5 | ✅+SA | side | ❌ | ❌ | N/A | ❌ | ⚠️ | N/A |
| SP6 | ✅+SA-perm | side | ✅ | ❌ | N/A | ❌ | ⚠️ | N/A |
| SP7 | ✅ | ❌ | ❌ | ❌ | N/A | N/A | ✅ | ✅ (existence) |
| SP8 | ✅ | ❌ | ❌ | ✅ | N/A | ❌ | ✅ (onConflict) | ✅ (existence) |
| SP9 | ✅ | ❌ | ❌ | ✅ | N/A | ❌ | ✅ (onConflict) | ✅ (existence) |
| SP10 | ✅ | ✅ | ❌ | ❌ | N/A | N/A | ✅ | ✅ (parent) |
| SP11 | ✅ | ✅ | ❌ | ✅ | N/A | ❌ | ⚠️ (race) | ✅ (existence) |
| SP12 | ✅ | ✅ | ❌ | ❌ | N/A | N/A | ✅ | ✅ **SAFE** |
| SP13 | ✅ | side | ❌ | ✅ | N/A | N/A | ✅ | ✅ **SAFE** |
| PR1 | ✅ | ❌ | ✅ | ❌ | ✅ | N/A | ✅ | N/A |
| PR2 | ✅ | ❌ | ✅ | ❌ | N/A | ❌ (read-after-write) | ❌ | N/A |
| PR3 | ✅ | ❌ | ✅ | ❌ | ❌ **CF-020** | N/A | ✅ | N/A |
| PR4 | ✅ | ❌ | ✅ | ❌ | ❌ **C3-PROPS-RES** | ❌ | ❌ | N/A |
| PR5 | ✅+SA | side | ❌ | ❌ | N/A | ❌ | ⚠️ | N/A |
| PR6 | ✅+SA-perm | side | ✅ | ❌ | N/A | N/A | ⚠️ | N/A |
| PR7 | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ (read-after-write) | ❌ | N/A |
| SL1 | ✅ | ❌ | ✅ | ❌ | ✅ | N/A | ✅ | N/A |
| SL2 | ✅ | ❌ | ✅ | ❌ | N/A | N/A | ❌ | N/A |
| SL3 | ✅ | ❌ | ✅ | ❌ | ❌ **CF-020** | N/A | ✅ | N/A |
| SL4 | ✅ | ❌ | ✅ | ❌ | ❌ | N/A | ❌ | N/A |
| SL5 | ✅+SA-perm | side | ✅ | ❌ | N/A | N/A | ⚠️ | N/A |
| SL6 | ✅+SA | side | ❌ | ❌ | N/A | N/A | ⚠️ | N/A |
| SO1 | ✅ | ❌ | ✅ | ❌ | ✅ | N/A | ✅ | N/A |
| SO2 | ✅ | ❌ | ✅ | ❌ | N/A | N/A | ❌ | N/A |
| SO3 | ✅ | ❌ | ✅ | ❌ | ❌ **CF-020** | N/A | ✅ | N/A |
| SO4 | ✅ | ❌ | ✅ | ❌ | ❌ | N/A | ❌ | N/A |
| SO5 | ✅+SA | side | ❌ | ❌ | N/A | N/A | ⚠️ | N/A |
| SO6 | ✅+SA-perm | side | ✅ | ❌ | N/A | N/A | ⚠️ | N/A |
| SI1 | ✅ | ❌ | ❌ | ❌ | N/A | N/A | ✅ | ✅ (parent fallback) |
| SI2 | ✅ | ❌ | ❌ | ❌ | N/A | ❌ | ❌ | ✅ (existence) |
| SI3 | ✅ | ❌ | ❌ | ❌ | N/A | N/A | ❌ | ❌ **CF-018** |
| SI4 | ✅ | ❌ | ❌ | ❌ | N/A | ❌ | ❌ | ⚠️ **CF-018** |
| SI5 | ✅ | ❌ | ❌ | ❌ | N/A | ❌ | ❌ | ❌ **CF-018** |
| SI6 | ✅ | ❌ | ❌ | ❌ | N/A | ❌ | ✅ | ❌ **CF-018** |
| SU1 | ✅ | ❌ | ✅ | ❌ | ✅ | N/A | ✅ | N/A |
| SU2 | ✅ | ❌ | ✅ | ❌ | N/A | N/A | ❌ | N/A |
| SU3 | ✅ | ❌ | ✅ | ❌ | ❌ **CF-020** | N/A | ✅ | N/A |
| SU4 | ✅ | ❌ | ✅ | ❌ | ❌ | N/A | ❌ | N/A |
| SU5 | ✅+SA | side | ❌ | ❌ | N/A | N/A | ⚠️ | N/A |
| SU6 | ✅+SA-perm | side | ✅ | ❌ | N/A | N/A | ⚠️ | N/A |
| **Σ** | 44 ✅ | 6 ✅ + 11 side | **31 ✅ / 13 ❌** | **4 ✅ / 26 ❌** | 6 ✅ / 7 ❌ / 31 N/A | 2 ✅ / 12 ❌ / 30 N/A | mixed | 4 ✅ / 4 ❌ / 1 ⚠️ / 35 N/A |

**Aggregate observations from the matrix**:
- **Auth**: uniform `requireAuth` across all 44 (no IDOR-via-no-auth; the IDOR is post-auth scope omission).
- **Validation**: 31/44 = 70.5% Zod-validated (CF-017 positive exemplar — 4 satellite files = 100%; spaces.ts = 46% partial; space-images.ts = 0%).
- **Audit**: 4/26 mutators = 13.3% (CF-008 worst-yet).
- **Soft-delete-filter on read** of detail endpoints: 0/6 (5 leak sites + 1 N/A-because-images-have-no-deleted_at).
- **Tx coverage**: 0/12 multi-write handlers — 100% miss rate for the domain.
- **Parent-guard on nested writes**: 4 SAFE (SP10/SP12/SP13, SI2 existence) + 4 IDOR (SI3/SI5/SI6 outright + SI4 partial) of 9 nested-write sites = 44% safe.

---

## §5. Spot-check verification (RULE 7)

| Claim | Predicted | Verified | Result |
|---|---|---|---|
| **C1** Endpoint count distribution | 13/7/6/6/6/6 = 44 | `grep -nE "^router\.(get\|post\|put\|patch\|delete)"` per file: 13 + 7 + 6 + 6 + 6 + 6 = 44 | ✅ |
| **C2** `spaces.base_weekly_price`/`base_daily_price` are `real` (CF-001 source) | Both real → CF-001 source-side anchor | `lib/db/src/schema/spaces.ts:13-14` `real("base_weekly_price")`, `real("base_daily_price")` | ✅ |
| **C3** Domain `logAction` coverage = 13.3% | 4 / 30 = 13.3% (lowest yet) | `rg -c 'logAction\(' artifacts/api-server/src/routes/{spaces,properties,space-policies,space-options,space-images,suburbs}.ts` → spaces.ts: 4, all others: 0; mutator count = 8+5+4+4+5+4 = 30; 4/30 = 0.1333 ✅ | ✅ |

**Self-check error count**: 0 spot-check errors found. C3 spans across §3 (over-discovery 16 vs predicted 8) is calibration finding, not a spot-check error.

---

## §6. R-REPO-5 incidentals

| ID | Description | Severity | Disposition |
|---|---|:---:|---|
| **K1** | `numIds.filter(Boolean)` drops PK 0 — recurs in 5 of this domain's bulk-delete endpoints (SP5, PR5, SL6, SO5, SU5) — same pattern as finance-payments J3 | 🟢 simple memo | Recurrence proves project-wide pattern — escalate from "simple memo" to **`_rules/no-magic-rules.md` (T004)** anchor: ban `filter(Boolean)` on numeric IDs project-wide; recommend `filter((n) => Number.isFinite(n) && n > 0)` |
| **K2** | SI2 base64 fallback writes >>500 chars to `varchar(500)` `file_url` — silent truncation or insert failure (C3-BASE64-BLOAT) | 🟡 promotion candidate | **NEW CF candidate** "schema-vs-runtime length contract violation". Defer-confirm at T002.2.f (portal-guest may have similar upload path); do **not** promote in this commit (only 1 anchor). Park alongside CF-020 / CF-021 candidates. |
| **K3** | `properties.owner_account_name: null` stubbed in 5 sites — TODO debt | 🟢 simple memo | T002.5 state-machines / T004 api-rules — flag as "named-but-unwired enrichment field" pattern. |
| **K4** | SI1 fallback `source: "own"` returned for both "no images" and "no parent fallback" — indistinguishable | 🟢 simple memo | T004 api-rules — recommend explicit `source: "none"` value. |
| **K5** | SI4 set-primary partial-IDOR is qualitatively distinct from SI3/SI5/SI6 (causes cross-space data corruption, not just unauthorized access) | 🟡 evidence-expansion | CF-018 carrier: add a "**partial vs outright**" sub-classification to CF-018 audit table; currently lumped together. Defer to atomic commit (this domain). Atomic commit will append "Partial-IDOR taxonomy" subsection to CF-018. |
| **K6** | Permanent-delete branches across 11 endpoints have **zero audit** — SuperAdmin gate is the only safeguard | 🟡 candidate sub-finding | CF-008 sub-pattern "destructive-action-zero-audit" — defer-confirm at T002.2.j (admin.md will likely add more). Park. |
| **K7** | Date `text` columns in `space_blocked_dates.date` and `space_availability.date` are computed by `Date` constructor with no tz handling | 🟢 simple memo | CF-013 carrier: add to ops-property timezone enumeration (already in atomic commit per C3-013). |
| **K8** | `space_images` table sole `varchar` user in this domain (5 schemas use `text`); inconsistent type choice | 🟢 simple memo | CF-016 sub-finding (naming/type inconsistency — already CF-016 territory); add as note to CF-016 §3 inventory. Atomic commit: 1 line addition. |

**R-REPO-5 self-check**: 8 incidentals found; all 8 dispatched (1 promotion to T004 rule, 1 NEW CF candidate K2 parked, 1 evidence-expansion to CF-018 (K5 — atomic commit), 1 to CF-013 (K7), 1 to CF-016 (K8), 3 simple memos). 0 silently absorbed.

---

## §7. Cross-References

### To other domain files

- → [`booking.md`](./booking.md) — `space_availability.date` (text) + `space_availability.booking_id` consumed exclusively by spaces.ts SP7-SP9 (this file owns the writes; bookings.ts owns the schema). Cross-domain **soft-coupling** anchor for state-machines.md (T002.5).
- → [`finance-invoicing.md`](./finance-invoicing.md), [`finance-payments.md`](./finance-payments.md) — none direct; **CF-001 data flow** §1.4 is the only finance-domain interaction (space → booking → contract → invoice pipeline; this file is upstream of all finance writes).
- → [`contract.md`](./contract.md) — `spaces.id` referenced as `contract_products.space_id` (`contract.md` E13/E14); `contract.md` reads `spaces.base_weekly_price` for invoice calculation; CF-002 source confirmed in this commit.

### To audit findings (atomic commit action items)

- 🔴 [CF-001](../../_audit/CRITICAL_FINDINGS.md#cf-001) — **NEW source-side anchor**: `spaces.base_weekly_price`/`base_daily_price` (real) flagged as the **upstream origin** of CF-002 boundary chain. Atomic commit appends "Phase 2 source-side carrier (T002.2.c addition)" subsection to CF-001 with §1.4 data-flow diagram inlined; CF-002 evidence updates "boundary count" from 1 to 2 + adds source diagram.
- 🟡 [CF-008](../../_audit/CRITICAL_FINDINGS.md#cf-008) — **Domain Severity Matrix row addition**: ops-property = 13.3% (lowest yet); update matrix already established at T002.2.b half-2.
- 🟡 [CF-013](../../_audit/CRITICAL_FINDINGS.md#cf-013) — **Business-domain timezone enumeration NEW subsection**: 5 deleted_at no-tz + 2 free-text `date` text columns in this domain.
- 🟡 [CF-014](../../_audit/CRITICAL_FINDINGS.md#cf-014) — **Anchor-count update**: 3 → 11 production loci (adds 8 ops-property loci).
- 🟡 [CF-015](../../_audit/CRITICAL_FINDINGS.md#cf-015) — **Distinction added**: `space_images` is the first "hard-delete-only-by-design" anchor (column absent, not skipped); CF-015 evidence subsection.
- 🟡 [CF-017](../../_audit/CRITICAL_FINDINGS.md#cf-017) — **Domain Validation Coverage Matrix NEW subsection** (parallel to CF-008); ops-property = 70.5% strongest measured; project-wide CF-017 baseline must re-measure once all T002.2.x complete.
- 🟡 [CF-018](../../_audit/CRITICAL_FINDINGS.md#cf-018) — **Partial-IDOR taxonomy NEW subsection** + **SAFE exemplar reference** (SP12/SP13).
- 🟡 [CF-020 candidate](../../_audit/CRITICAL_FINDINGS.md#cf-019) — anchor count now 16 (5 GET-leak + 2 mutation-zombie-revival + 9 prior). Promotion deferred to T002.2.d per user.
- 🟡 [CF-021 candidate](../../_audit/CRITICAL_FINDINGS.md#cf-019) — anchor count now 8 (3 spaces buildSpaceResponse callers degree-4 + 3 properties degree-1 + 2 prior). Promotion deferred to T002.2.d.

### To upcoming docs

- → state-machines.md (T002.5) — **3 state graphs additions**:
  - `properties.approval_status`: `Pending → ?` (PR7 transitions; allowed values not enumerated in schema — open question for state-machines.md to resolve);
  - `spaces.status`: `Active → Archived` (SP5/SP6 soft-delete) + open question on which transitions are allowed elsewhere;
  - `space_availability.is_available`: boolean toggle via SP8/SP9 (no formal state).
- → `_rules/architecture-rules.md` (T004) — C3-TX (8 new tx-missing loci), C3-IDOR (4 IDOR + 2 SAFE pattern), C3-OWNER-NULL (named-but-unwired enrichment).
- → `_rules/api-rules.md` (T004) — C3-VAL positive exemplar (Zod-on-CRUD pattern), C3-RAW-BODY (operations-path validation gap), C3-IMG-FALLBACK (missing source value), K4 disambiguation.
- → `_rules/security-rules.md` (T004) — C3-IDOR + C3-IMG-AUDIT (Cloudinary-delete via IDOR), K6 destructive-action-no-audit.
- → `_rules/financial-rules.md` (T004) — CF-001 source-side carrier, §1.4 data-flow diagram.
- → `_rules/no-magic-rules.md` (T004) — K1 `filter(Boolean)` ban.

---

## §8. Summary

- **44 endpoints** across **6 route files** documented; 13 spaces.ts in full sample format, 31 satellites in compact tabular format (size-management decision per pre-write tripwire — kept under cap).
- **CF density (this commit)**: 0 NEW CF promotions (vs T002.2.b half-2's 1); **5 CF expansions** (CF-001 source-side, CF-008 matrix row, CF-013 ops business-domain timezone, CF-014 anchor 3→11, CF-015 hard-delete-by-design distinction, CF-017 Domain Validation Matrix NEW, CF-018 partial-IDOR taxonomy + SAFE exemplar reference). **2 NEW CF candidates parked**: K2 (varchar(500) base64 overflow) for T002.2.f confirm, K6 (destructive-action-no-audit) for T002.2.j confirm.
- **Coverage data points added**: logAction 13.3% (new lowest) → CF-008 matrix; Zod 70.5% (new highest) → CF-017 matrix.
- **CF-020 candidate count progression**: 9 (T002.2.b) → **16** (5 GET-leak + 2 mutation-revival here); CF-021 candidate count: 2 → **8** (8 N+1 anchors here).
- **3 spot-check claims**: all ✅ (C1 distribution / C2 CF-001 source / C3 13.3% audit coverage); over-discovery in §3 (16 vs predicted 8) flagged as calibration data point.
- **8 R-REPO-5 incidentals**: all dispatched (no silent absorption).

**File size**: **429 lines actual** (predicted 1100-1300; achieved 67% compression vs predicted via compact-table format for 31 satellite endpoints; tripwire 850 lines well under — no split-pivot triggered). Per-endpoint average ≈ 9.7 lines (vs `contract.md` 31.9, `finance-payments.md` 42.6) — compact format viable for files where ≥5 of 6 sub-files share an identical CRUD shape. Self-correction (R-REPO-7 (c)): §0 `pre-write tripwire` framing was premature; final size dominated by table density. Recommend updating `_T002_PLAN.md` §8 size budget for satellite-CRUD-heavy domains: revise the 2.4× upward multiplier (set at T002.1.8) to ~0.5× for files where the spaces.ts↔properties.ts ratio of "operational complexity" inverts.

---

*End of `ops-property.md` — T002.2.c. Atomic commit (R-REPO-1) will follow at Step 5: this file + CRITICAL_FINDINGS.md (5 expansions) + INDEX.md (no change — ops group structure unchanged) + _T002_PROGRESS.md + session_plan.md + cross-ref back-fills (contract.md, finance-invoicing.md, finance-payments.md if any).*
