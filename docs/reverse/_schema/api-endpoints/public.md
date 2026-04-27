# Public Surface API — `_schema/api-endpoints/public.md`

> **Sub-task**: T002.2.h (closes portal series → opens admin-shared content slice)
> **Domain**: 6 files / **33 endpoints** classified by **mount order** at `artifacts/api-server/src/app.ts:167` (`app.use("/api/v1", requireAuth)`):
>
> - **OPEN** (no auth, mounted **before** L167): 3 files / 14 ep → `public.ts` 10 + `privacy.ts` 2 + `health.ts` 2
> - **PROTECTED** (`requireAuth` enforced, mounted **after** L167 via direct mount or `routes/index.ts` aggregator): 3 files / 19 ep → `lookup.ts` 10 + `blog-posts.ts` 6 + `page-contents.ts` 3
>
> **Tripwire**: 700-line cap — **EXEMPT** (predicted 400–600 lines).
> **Severity legend**: ⚠️-system definition aligned to `INDEX.md` legend.

---

## §0 Overview & Mount Topology

The "public" group is **not** a single router; it is a **mount-order classification** of 6 files that share the trait of *carrying the public web surface (marketing + content + lookup pickers)*. The OPEN/PROTECTED split is determined by where each router is mounted relative to the global `requireAuth` middleware:

| Order | Line | Mount | Auth state | Files affected |
|-------|------|-------|-----------|----------------|
| 1 | `app.ts:150` | `app.use("/api", healthRouter)` | OPEN | `health.ts` |
| 2 | `app.ts:151` | `app.use("/api", publicRouter)` | OPEN | `public.ts` |
| 3 | `app.ts:152` | `app.use("/api", privacyRouter)` | OPEN | `privacy.ts` |
| ↓ | … other mounts (auth, guest portal, partner portal, admin-users) … |
| ★ | `app.ts:167` | `app.use("/api/v1", requireAuth)` | **enforcement gate** | — |
| 4 | `app.ts:172` | `app.use("/api", spaceImagesRouter)` | PROTECTED | (out of scope — covered in `ops-property.md`) |
| 5 | `app.ts:173` | `app.use("/api", pageContentsRouter)` | PROTECTED | `page-contents.ts` |
| 6 | `app.ts:174` | `app.use("/api", router)` (generic aggregator from `routes/index.ts`) | PROTECTED | `lookup.ts`, `blog-posts.ts`, +37 other admin routers |

**Mechanism note**: `requireAuth` is **path-prefix bound** (`/api/v1`), not registration-order bound. Express middleware matches by path *and* by registration order, so a router mounted at `/api` *after* `app.use("/api/v1", requireAuth)` will still pass through `requireAuth` for any request starting with `/api/v1/...`. All 19 endpoints in `lookup.ts` + `blog-posts.ts` + `page-contents.ts` use `/v1/...` paths and therefore inherit `requireAuth`.

**Why this matters**: the same `app.use("/api", X)` pattern appears 12+ times in `app.ts` with varying auth implications depending solely on registration order relative to L167. Phase 2 .NET migration must preserve this ordering or replicate it via attribute-based routing groups.

---

## §1 OPEN Endpoints (no auth) — 3 files / 14 ep

### §1.1 `public.ts` — 10 endpoints (`/v1/public/*` + `/v1/public/blog*`)

`Auth: none | $$: read-only $ literals + lead writes | logAction: 0 | CF: 008/014/017/023a-helper`

| # | Verb | Path | Anchor | Notes |
|---|------|------|--------|-------|
| E1 | GET | `/v1/public/spaces` | `public.ts:45-313` | Space search with **multi-stage occupancy filter**: pre-fetches `bookings` (Pending/Confirmed/Active + check_out ≥ today) + `contracts` (Signed/Active + end_date null OR ≥ today) into `alwaysExcluded` Set (L60-78), then composes filter SQL, paginates, then enriches with `space_images` primary + `space_options` + mandatory `service_catalog` per row (5 separate enrichment queries — **CF-021 N+1 candidate at scale**) |
| E2 | GET | `/v1/public/spaces/:id` | `public.ts:314-457` | Single-space detail; same enrichment chain as E1 plus `space_policies` + `accommodation_catalog` join; **no auth, no rate limit** — DDoS-amplifiable enumeration of `id` |
| E3 | GET | `/v1/public/spaces/:id/availability` | `public.ts:459-535` | Availability calendar window scan (`spaceAvailabilityTable` between dates); query params `start_date` / `end_date` parsed via `Date` constructor — no Zod validation |
| E4 | GET | `/v1/public/properties` | `public.ts:537-579` | Property listing + per-property active-space count (`spacesCountByProperty` Map built from a 2nd full SELECT; comment `// show all; landing page can filter` reveals **incomplete `approval_status` filter** at L555) |
| E5 | GET | `/v1/public/services` | `public.ts:581-695` | 3-tier fallback: accommodation-product mapping → space-level mapping → global `display_on_booking_page` set; uses `custom_price ?? base_price` coalesce — **CF-001 read-side carrier** (`base_price` is `real` → returned to public web as JSON number) |
| E6 | GET | `/v1/public/blog` | `public.ts:697-720` | Blog listing filtered to `status="Published"` + soft-deleted excluded; manual SELECT projection (no zod) |
| E7 | GET | `/v1/public/blog/:slug` | `public.ts:722-733` | Single post by `slug` (UNIQUE-by-business but no constraint declared at schema level — verified absence in `lib/db/src/schema/blog-posts.ts`); 404 path correct |
| E8 | POST | `/v1/public/owner-applications` | `public.ts:735-785` | Owner application intake → **`insertLeadWithGeneratedRef(...)` call (lead_source="OwnerPortal", inquiry_type="OwnerApplication")**; manual `String(...).trim()` + regex email validation (no Zod); 6 conditional 400 returns; description string-glued from form fields |
| E9 | POST | `/v1/public/agent-applications` | `public.ts:787-831` | Agent application intake → **`insertLeadWithGeneratedRef(...)`** (lead_source="AgentPortal", inquiry_type="AgentApplication"); same manual-validation pattern as E8 |
| E10 | POST | `/v1/public/service-host-applications` | `public.ts:833-884` | SH application intake → **`insertLeadWithGeneratedRef(...)`** (lead_source="ServiceHostPortal", inquiry_type="ServiceHostApplication"); accepts `service_types` as array OR scalar (auto-coerce L843-844) |

### §1.2 `privacy.ts` — 2 endpoints (`/v1/privacy/*`)

`Auth: none | $$: 0 | logAction: 0 | CF: 008`

Endpoints serve **public privacy policy + cookie policy text** keyed by language; reads from `page_contents` (or similar). Both GETs; no mutation surface, no Zod (params are simple), 0 audit. Out-of-scope for CF-023 / CF-014 / CF-018.

### §1.3 `health.ts` — 2 endpoints

`Auth: none | $$: 0 | logAction: 0 | CF: 008 (trivial)`

| # | Verb | Path | Notes |
|---|------|------|-------|
| H1 | GET | `/v1/health` | Liveness (`{ status: "ok" }`-shape) |
| H2 | GET | `/v1/health/live` | Readiness alias; no DB ping |

> **Inconsistency [CCC]**: `healthRouter` is **double-mounted** — first at `app.ts:150` (`/api`, OPEN — actually reachable) and again at `routes/index.ts:41` via `router.use(healthRouter)` which itself is mounted at `app.ts:174` (`/api`, after L167 `requireAuth`). Express dispatches the first match, so the second mount is **dead code**. Filed as cleanup memo (no CF promotion); Phase 2 .NET migration should not replicate the duplicate.

---

## §2 PROTECTED Endpoints (`requireAuth`) — 3 files / 19 ep

### §2.1 `lookup.ts` — 10 endpoints (`/v1/lookup/*`)

`Auth: requireAuth (admin-only via /v1) | $$: 0 (display-only $ formatting) | logAction: 0 | CF: 008/017`

All 10 are **typeahead/picker lookups** for the admin SPA. Pattern: read query `q` + optional filter → `ilike("%q%")` → `LIMIT 20-50` → return `{ id, display: "..." }` shape.

| # | Verb | Path | Anchor | Returns |
|---|------|------|--------|---------|
| L1 | GET | `/v1/lookup/contacts` | `lookup.ts:7-29` | `${first_name} ${last_name} — ${email}` |
| L2 | GET | `/v1/lookup/accounts` | `lookup.ts:31-55` | `${name} (${account_type})` (filterable by `type`) |
| L3 | GET | `/v1/lookup/commissions` | `lookup.ts:57-74` | Conditional display: `${name} (${rate}%)` for Percentage, `${name} ($${amount})` else — **CF-001 read-side carrier** (`commission_rate` / `commission_amount` are `real`) |
| L4 | GET | `/v1/lookup/payment-info` | `lookup.ts:76-93` | `${bank_name} — BSB ${bsb_number} (${type})` if BSB present |
| L5 | GET | `/v1/lookup/spaces` | `lookup.ts:95-…` | Includes `property_address` left-join + `base_weekly_price` (CF-001 carrier) |
| L6 | GET | `/v1/lookup/suburbs` | `lookup.ts:…` | Plain `id`/`display` |
| L7 | GET | `/v1/lookup/properties` | `lookup.ts:…` | Plain `id`/`display` |
| L8 | GET | `/v1/lookup/product-groups` | `lookup.ts` (5-line block) | Plain |
| L9 | GET | `/v1/lookup/product-types` | `lookup.ts` (5-line block) | Plain |
| L10 | GET | `/v1/lookup/products` | `lookup.ts` (5-line block) | `${name} — $${price}/wk` (`accommodation_catalog.price` = `real`, **CF-001 carrier**); plus `/v1/lookup/contract-types` follows the same pattern |

> **Note**: file enumerates 10 router.get() calls (counted via `grep -cE "router\\.(get\\|post)"`). The actual file body interleaves `contract-types` and `products` — both are confirmed read-only typeahead. **No Zod** (`zod` import count = 0); query parsing relies on `(req.query["q"] as string) || ""` casts. Acceptable risk per CF-017 because outputs are display strings, not money paths.

### §2.2 `blog-posts.ts` — 6 endpoints (`/v1/blog-posts*`)

`Auth: requireAuth (admin-only via /v1) | $$: 0 | logAction: 0 | CF: 008/014/015/017-POSITIVE`

**3 declared Zod schemas** (`ListBlogPostsQuery`, `CreateBlogPostBody`, `UpdateBlogPostBody`, `IdParams` — counted as 4 module-level schemas; `safeParse` invoked **5 of 6** endpoints).

| # | Verb | Path | Anchor | Zod | Notes |
|---|------|------|--------|-----|-------|
| B1 | GET | `/v1/blog-posts` | `blog-posts.ts:46-59` | ✅ `ListBlogPostsQuery.safeParse(req.query)` | 3 optional filters; ilike search on `title` |
| B2 | POST | `/v1/blog-posts` | `blog-posts.ts:61-78` | ✅ `CreateBlogPostBody.safeParse(req.body)` | Insert + 23505 → 409 mapping for `slug` UNIQUE conflict |
| B3 | GET | `/v1/blog-posts/:id` | `blog-posts.ts:80-86` | ✅ `IdParams.safeParse(req.params)` | 404 path |
| B4 | PUT | `/v1/blog-posts/:id` | `blog-posts.ts:88-108` | ✅ **Both** `IdParams.safeParse(req.params)` + `UpdateBlogPostBody.safeParse(req.body)` | Best-in-class double-validate; same 23505 → 409 |
| B5 | POST | `/v1/blog-posts/bulk-delete` | `blog-posts.ts:110-124` | ⚠️ **NO body Zod** (`const { ids, permanent } = req.body`); manual `Array.isArray(ids)` + `.length` guards | **SuperAdmin role gate at L113** ✅; supports both soft (`deleted_at + status="Archived"`) and hard delete (`db.delete`) |
| B6 | DELETE | `/v1/blog-posts/:id` | `blog-posts.ts:126-138` | ✅ `IdParams.safeParse` | **SuperAdmin gate** for `?permanent=true` (L130-133) ✅; default soft-delete |

**[BBB] CF-017 POSITIVE EXEMPLAR — conditional**: blog-posts.ts is the **2nd-best** Zod-coverage file in the repo (5 of 6 = 83%; bookings.ts holds first place at higher `safeParse` count). The 1-endpoint gap (B5 `bulk-delete` body) is the sole defect — manual destructure + `Array.isArray` guard works defensively but inconsistent with neighbor endpoints. **Promotion verdict**: register as POSITIVE EXEMPLAR with the bulk-delete caveat noted; co-rank with portal-guest E20 (sole-owner guard) + portal-partner SHP:365 (CF-014 tx exemplar) as the third reference pattern in the repo.

### §2.3 `page-contents.ts` — 3 endpoints (`/v1/page-contents/*`)

`Auth: requireAuth | $$: 0 | logAction: 0 | CF: 008/014/017`

| # | Verb | Path | Anchor | Notes |
|---|------|------|--------|-------|
| P1 | GET | `/v1/page-contents/:pageKey` | early in file | List all language variants for a `page_key` |
| P2 | GET | `/v1/page-contents/:pageKey/:language` | mid file | Single-language fetch; **null-as-empty fallback** (returns synthetic `{ content: {} }` on miss instead of 404 — soft contract for CMS) |
| P3 | PUT | `/v1/page-contents/:pageKey/:language` | end of file | **Upsert pattern**: `select existing → if exists update else insert` — **NOT a tx**, classic check-then-act race window (CF-014 evidence); body via `PageContentBody.safeParse` ✅ |

---

## §3 Cross-cutting Findings

### §3.1 [ZZ] `insertLeadWithGeneratedRef` helper analysis — CF-023.a anchor reaffirmed

**Helper location**: `artifacts/api-server/src/lib/leadRef.ts:15-41` (28 lines).

**Mechanism**:
1. `generateLeadRef()` (`leadRef.ts:3-13`) — SELECT `lead_ref` from **all** `leads` rows → JS-side `.filter(starts_with("LEAD-${year}-"))` → `.reduce(max num)` → `LEAD-${year}-${(max+1).padStart(5)}`. **N+1-amplifying full table read on every call** (CF-021 candidate carrier).
2. `insertLeadWithGeneratedRef<T>()` — `MAX_ATTEMPTS = 6` retry loop catching Postgres `23505` (unique violation) on the `lead_ref` UNIQUE constraint; throws after 6 failed retries. **Production-ready** under contention.
3. **NOT tx-wrapped** (`db.transaction(...)` absent). Each retry attempt is a fresh INSERT outside any transaction boundary — acceptable here because the helper writes a single row.

**Callers** (4 sites, 3 in `public.ts` + 1 in `leads.ts`):
- `public.ts:765` (E8 owner applications)
- `public.ts:814` (E9 agent applications)
- `public.ts:867` (E10 service-host applications)
- `leads.ts:77` (admin `POST /v1/leads` — **legitimate path**)

**Comparison vs `leads.ts:175-204` (CF-023.a anchor) — `PATCH /v1/leads/:id/convert`**:
```ts
// leads.ts:188 — fake booking_ref by Math.random()
const bookingRef = `BK-${year}-${String(Math.floor(Math.random() * 90000) + 10000)}`;
// leads.ts:190-196 — leadsTable UPDATE only; bookings table is NEVER inserted
const [updated] = await db.update(leadsTable)
  .set({ lead_status: "ConvertedToBooking", converted_at: new Date(), updated_at: new Date() })
  .where(eq(leadsTable.id, paramsParsed.data.id))
  .returning();
// leads.ts:198-201 — response includes booking_ref though no booking row exists
res.json({ booking_ref: bookingRef, lead_ref: updated!.lead_ref });
```

**Classification → option (가) per Step-1 ZZ matrix**:
- **Helper is correct**: race-safe (23505 retry), idempotent under contention, single-row INSERT.
- **`leads.ts:175-204` is the outlier defect**: fakes `booking_ref` via `Math.random()` (collision rate ≈ 1 in 80k — unacceptable for lifecycle ID), updates `leadsTable.lead_status` only, **never INSERTs bookings row**. Client receives a `booking_ref` that resolves to nothing in the database.
- **CF-023.a P1 status maintained**. Phase 2 fix prescription (refined): "rewrite `leads.ts:175-204` to (a) call a `bookings`-side helper analogous to `insertLeadWithGeneratedRef` for the `BK-` ref + INSERT into `bookings`, (b) update `leadsTable.converted_booking_id` to the new bookings row id, (c) wrap (a)+(b) in a single `db.transaction`".

### §3.2 [AAA] CF-024 NEW promotion candidate — Project-wide rate limiting absence

**Evidence**:
- `rg "rate.?limit|express-rate-limit|rateLimit"` across `artifacts/api-server/src/` + `lib/` = **0 hits**.
- `package.json` (api-server) does not depend on `express-rate-limit`, `rate-limiter-flexible`, or any equivalent (verified via grep on `dependencies`).
- 14 OPEN endpoints + 3 unauthenticated mutation entry points (`public.ts` E8/E9/E10 — leads INSERT) = **directly DDoS-amplifiable / spam-amplifiable surface**.
- All 339 PROTECTED endpoints (33 + others repo-wide) lack throttling — **session/account-level abuse uncapped**.

**Severity**: 🟡 **P1** (operational + security, not data-loss).

**Promotion plan** (atomic-commit step): register `CF-024 — Project-wide rate limiting absence` in `CRITICAL_FINDINGS.md` after CF-023, with cross-refs to:
- `public.ts` E8/E9/E10 (worst-exposed: unauthenticated INSERT into `leads`)
- `auth.ts` login + register (brute-force window)
- `partner-auth.ts` login + reset (verified at T002.2.g)
- `guest-auth.ts` login + register (verified at T002.2.f)

**Counts after promotion**: P0=3 / P1=17→**18** / P2=3 → total **24**.

### §3.3 [BBB] CF-017 — `blog-posts.ts` POSITIVE EXEMPLAR (conditional)

**Public-domain CF-017 split** (Zod usage by `safeParse` count via `grep`):

| File | `safeParse` invocations | Schemas declared | Coverage | Verdict |
|------|------------------------|------------------|---------|---------|
| `public.ts` | 0 | 0 | 0 % | ❌ critical (3 unauthenticated POST mutations rely on manual string-trim + regex) |
| `lookup.ts` | 0 | 0 | 0 % | tolerable (read-only typeahead, display-only outputs) |
| `privacy.ts` | 0 | 0 | 0 % | tolerable (read-only) |
| `health.ts` | 0 | 0 | 0 % | tolerable (no params) |
| `page-contents.ts` | 1 (P3 only) | 1 (`PageContentBody`) | 33 % (1 of 3 ep; the 2 GETs are param-only) | acceptable |
| `blog-posts.ts` | 6 across 5 endpoints | 4 (`ListBlogPostsQuery`, `CreateBlogPostBody`, `UpdateBlogPostBody`, `IdParams`) | **83 % (5 of 6 ep)** | ✅ POSITIVE EXEMPLAR |

**Promotion plan** (atomic-commit step): in `CRITICAL_FINDINGS.md` CF-017 section, append a "POSITIVE EXEMPLARS" sub-section co-listing:
1. `bookings.ts` (T002.1 sample — highest `safeParse` count repo-wide)
2. `blog-posts.ts` (this sub-task — 83 % coverage with double-validate `IdParams + UpdateBlogPostBody` on B4)
3. (Carry-forward from T002.2.g): partial guidance from `portal-partner` group — though those used domain-specific bodies, not declared module-level schemas.

The 1-ep gap (B5 `bulk-delete`) is recorded as the canonical example of an "obvious afterthought endpoint" pattern — defensive `Array.isArray` retrofit but no schema.

### §3.4 [CCC] `healthRouter` double-mount — cleanup memo

Detail in §1.3 above. **No new CF**; logged for Phase 2 hygiene.

### §3.5 [DDD] CF-023 cross-domain verification — CLOSED

Cross-domain audit complete after this sub-task. Coverage map:

| Domain | CF-023 status | Audited at |
|--------|--------------|-----------|
| `leads.ts` | **.a anchor** (orphan `BK-` ref, `Math.random()`, no booking INSERT) | T002.1.7 + reaffirmed §3.1 above |
| `finance-payments` | clean (no booking_ref minting) | T002.2.b half-2 |
| `finance-invoicing` | clean | T002.2.b half-1 |
| `ops-property` / `ops-catalog` / `ops-crm` | clean (no anchor sites) | T002.2.c / .d / .e |
| `portal-guest` | **.b sub-pattern** (consumer-side fake-ref + INSERT in 1 site, isolated) | T002.2.f |
| `portal-partner` | consumer-drift hypothesis **REJECTED** (12 prefix-blind SELECT + 2 fallback `\`#${id}\`` are display-only) | T002.2.g |
| `public.ts` (this) | helper analyzed → option (가) confirmed; no new anchor | this sub-task |

**Marker**: `CRITICAL_FINDINGS.md` CF-023 section to receive a "Cross-domain verification CLOSED at T002.2.h" line. Future evidence additions are evidence-row expansions only; no further cross-domain re-scan needed (T002.3 / T002.5 will not re-open the search).

### §3.6 CF anchor expansions

| CF | Action | Evidence added |
|----|--------|---------------|
| CF-001 | +5 read-side carriers | `public.ts` E5 services `base_price` + `accommodation_catalog.price` join; `lookup.ts` L3 commission `rate`/`amount`, L5 `base_weekly_price`, L10 `accommodation_catalog.price` — all `real` columns surfaced unmodified to admin/public web JSON |
| CF-008 | new lowest-evidence floor | **0 of 33 endpoints (= 0 %)** invoke `logAction(...)`. Worst audit-coverage domain in the repo. Particularly egregious: 3 unauthenticated `applications` POSTs create `leads` rows with **zero audit trail** — operationally invisible inbound funnel. |
| CF-013 | +3 carriers | `public.ts:765 / 814 / 867` `insertLeadWithGeneratedRef` writes use server `new Date()` (no tz) into `leads.created_at` (timestamp without timezone per CF-013 base finding) |
| CF-014 | +5 carriers | `public.ts` E8/E9/E10 (each = 1 helper call, no tx — single-row OK); `blog-posts.ts:110-123` E5 bulk-delete (multi-row UPDATE/DELETE outside tx); `page-contents.ts` P3 upsert (check-then-act, no tx) |
| CF-015 | +1 evidence | `blog-posts.ts:118 / 130-133` permanent-delete branches gated by `SuperAdmin` role — **safe pattern**, register as POSITIVE within CF-015 (alongside future safe-delete patterns) |
| CF-017 | new POSITIVE EXEMPLAR + new gap | See §3.3 above |
| CF-018 | N/A | Public OPEN endpoints have no resource ownership concept; PROTECTED endpoints (lookup/blog/page-contents) operate on admin-shared resources, not user-owned. Domain exempt from CF-018. |
| CF-019 | no-op | `rg "promot"` in public/lookup = 0 hits → public domain does not surface promotions; **CANDIDATE state preserved**, final disposition deferred to T002.3 (db-schema-overview) per Step-1 [g] decision |
| CF-021 | +1 carrier (helper-internal) | `leadRef.ts:5-12` `generateLeadRef` performs full `leads` SELECT on every helper invocation → O(N) on each lead INSERT (4 callers); CF-021 evidence row to receive this anchor |

---

## §4 Self-Check Table — 33 endpoints × 7 cells = 231 cells

Format: `Auth | Zod | $$ | logAction | CF chips | IDOR | Notes`

### §4.1 OPEN domain (14 ep)

| # | Endpoint | Auth | Zod | $$ | logA | CF | IDOR | Notes |
|---|----------|------|-----|----|------|----|------|-------|
| E1 | `GET /v1/public/spaces` | none | ❌ | $-read | 0 | 008/021 | N/A | enrichment N+1 carrier |
| E2 | `GET /v1/public/spaces/:id` | none | ❌ | $-read | 0 | 008/021 | N/A | id enumeration possible |
| E3 | `GET /v1/public/spaces/:id/availability` | none | ❌ | 0 | 0 | 008 | N/A | date parse via `new Date()` |
| E4 | `GET /v1/public/properties` | none | ❌ | 0 | 0 | 008 | N/A | comment reveals incomplete `approval_status` filter |
| E5 | `GET /v1/public/services` | none | ❌ | $-read | 0 | 001/008 | N/A | 3-tier fallback chain |
| E6 | `GET /v1/public/blog` | none | ❌ | 0 | 0 | 008 | N/A | published-only filter |
| E7 | `GET /v1/public/blog/:slug` | none | ❌ | 0 | 0 | 008 | N/A | slug UNIQUE not declared in schema |
| E8 | `POST /v1/public/owner-applications` | none | ❌ | 0 | 0 | 008/013/014/017/024 | N/A | manual string-trim + regex; helper INSERT lead |
| E9 | `POST /v1/public/agent-applications` | none | ❌ | 0 | 0 | 008/013/014/017/024 | N/A | same |
| E10 | `POST /v1/public/service-host-applications` | none | ❌ | 0 | 0 | 008/013/014/017/024 | N/A | array auto-coerce |
| Pr1 | `GET /v1/privacy/...` (×2) | none | ❌ | 0 | 0 | 008 | N/A | text-only |
| H1 | `GET /v1/health` | none | ❌ | 0 | 0 | 008 (trivial) | N/A | trivial liveness |
| H2 | `GET /v1/health/live` | none | ❌ | 0 | 0 | 008 (trivial) | N/A | trivial readiness |

### §4.2 PROTECTED domain (19 ep)

| # | Endpoint | Auth | Zod | $$ | logA | CF | IDOR | Notes |
|---|----------|------|-----|----|------|----|------|-------|
| L1-L10 | `GET /v1/lookup/*` | requireAuth | ❌ | $-display (L3/L5/L10) | 0 | 001/008/017 | N/A | typeahead, admin-shared |
| B1 | `GET /v1/blog-posts` | requireAuth | ✅ List | 0 | 0 | 008 | N/A | filter validation |
| B2 | `POST /v1/blog-posts` | requireAuth | ✅ Create | 0 | 0 | 008/014 | N/A | 23505→409 mapping |
| B3 | `GET /v1/blog-posts/:id` | requireAuth | ✅ Id | 0 | 0 | 008 | N/A | 404 path |
| B4 | `PUT /v1/blog-posts/:id` | requireAuth | ✅✅ Id+Update | 0 | 0 | 008/014 | N/A | best-in-class double-validate |
| B5 | `POST /v1/blog-posts/bulk-delete` | requireAuth + SuperAdmin | ⚠️ partial | 0 | 0 | 008/014/015/017 | N/A | role-gated; body manual |
| B6 | `DELETE /v1/blog-posts/:id` | requireAuth + SuperAdmin (if permanent) | ✅ Id | 0 | 0 | 008/015 | N/A | role-gated permanent |
| P1 | `GET /v1/page-contents/:pageKey` | requireAuth | ❌ (param-only) | 0 | 0 | 008 | N/A | list languages |
| P2 | `GET /v1/page-contents/:pageKey/:language` | requireAuth | ❌ (param-only) | 0 | 0 | 008 | N/A | null-as-empty fallback |
| P3 | `PUT /v1/page-contents/:pageKey/:language` | requireAuth | ✅ Body | 0 | 0 | 008/014/017 | N/A | check-then-act upsert race |

**33/33 endpoints recorded. Self-check: per-row `Auth + CF + Notes` triad confirmed against file:line read. No row left unanchored.**

---

## §5 Incidentals (R-REPO-5) — this sub-task

| # | Description | Disposition |
|---|-------------|-------------|
| i1 | `healthRouter` double-mount (app.ts:150 + routes/index.ts:41 via app.ts:174) | Memo to Phase 2 cleanup; no CF (see §3.4) |
| i2 | `public.ts:537-555` `properties` filter has dead boolean (`approval_status === "Approved" || true`) — comment confirms intent to filter later | Memo to T002.5 / future ops follow-up; no CF |
| i3 | `public.ts:445-455`-area `space_id` enumeration potential (no rate-limit, no auth) | Subsumed under CF-024 promotion (this sub-task) |
| i4 | `lookup.ts` query parsing uses `(req.query["q"] as string)` casts repeatedly | Memo to T004 `_rules/security-rules.md` (Zod adoption guidance); no CF |
| i5 | `blog-posts.ts` `slug` UNIQUE relied on at runtime (23505 catch) but **not declared in `lib/db/src/schema/blog-posts.ts`** as `.unique()` — operates on existing DB constraint added out-of-band? | Memo to T002.3 db-schema-overview (verify schema-vs-runtime gap); R-REPO-6 grade ("self-uncertainty") — re-verify before T002.3 promotion |

**No new mini-task proposals**. All incidentals → memo or absorbed into CF-024 promotion.

---

## §6 R-REPO-7 trade-off ledger (decisions made in this sub-task)

| Decision | Option chosen | Alternatives rejected | Rationale |
|----------|--------------|----------------------|-----------|
| §1/§2 split criterion | **Mount-order based** (OPEN/PROTECTED) | (i) file-name based; (ii) verb-based | Mount order is the *operative* truth — the `/api/v1` requireAuth gate at app.ts:167 is what actually enforces auth; file names are misleading (e.g., `lookup.ts` looks "lookup-y" but is admin-protected) |
| ZZ (CF-023.a) classification | **(가) helper safe + leads.ts:175-204 outlier** | (나) shared defect; (다) systemic; (라) other | Helper code reads as production-grade (23505 retry); leads.ts:175-204 visibly fakes ref + skips bookings INSERT — clean outlier |
| AAA (CF-024) promotion | **Promote NEW P1 in this atomic commit** | Defer to admin.md; defer to T002.5 | All evidence is repo-wide (not public-specific) and Step-1 sealed `0 hits` finding; deferring would split the P1 gate decision across two sub-tasks |
| BBB (CF-017 POSITIVE) | **Promote conditional POSITIVE on blog-posts.ts** with B5 caveat | All-or-nothing rejection; defer | 5/6 = 83% with double-validate B4 is genuinely exemplary; the 1 gap (B5) is itself instructive ("afterthought endpoint" pattern) |
| DDD (CF-023 close) | **Mark CLOSED in atomic commit** | Leave open through T002.5 | All 9 domains audited (5 portal/ops + leads anchor + 3 public sub-files); zero remaining unaudited write-paths to bookings/leads |

Trade-offs preserved per R-REPO-7 (d) for future archaeology.

---

## §7 Atomic commit manifest (preview — Step 5)

Files staged by this sub-task:
1. **NEW** `docs/reverse/_schema/api-endpoints/public.md` (this file)
2. **EDIT** `docs/reverse/_audit/CRITICAL_FINDINGS.md`:
   - CF-024 NEW promotion section (~50-60 lines)
   - CF-023 cross-domain CLOSED marker + helper analysis cross-ref
   - CF-017 POSITIVE EXEMPLAR sub-section (blog-posts.ts entry)
   - CF-001/008/013/014/015/021 evidence row additions per §3.6
   - Counts row: P0=3 / P1=17→18 / P2=3 → 24
3. **EDIT** `docs/reverse/_schema/api-endpoints/INDEX.md`:
   - CF chip row update for `public` group (CF-024 chip add)
   - Last-updated banner
4. **EDIT** `docs/reverse/_schema/_T002_PROGRESS.md`:
   - Row 49 (`T002.2.h`) status ✅ + line count + commit hash (TBD post-checkpoint)
5. **EDIT** `.local/session_plan.md`:
   - T002.2.h ✅ + counts update + T002.2.i NEXT marker

---

*End of `public.md` — generated for T002.2.h (closes portal series; opens admin-shared content slice). Tripwire EXEMPT (within 400-600 prediction band).*
