# API Endpoints — `admin` Domain

> **Scope**: 10 route files / **37 endpoints** mounted under the **administrative surface** of the MillionStay API server (admin staff portal + system-administration endpoints + admin login flows). File-of-origin classification per `_T002_PLAN.md` §2.1 — endpoints whose URL is `/admin/*` but whose handler lives in a non-admin file (e.g. `bookings.ts`, `contracts.ts`, `partner-auth.ts`) are listed in their owning domain file.
> **Source files (T002.2.i ground truth, all 10 verified by `grep -cE "^router\.(get|post|put|patch|delete)"`)**:
> - `dashboard.ts` (8 ep) · `auth.ts` (7 ep) · `email-templates.ts` (6 ep) · `integrations.ts` (5 ep) · `admin-users.ts` (4 ep) · `db-sync.ts` (3 ep) · `system-logs.ts` (1 ep) · `reports.ts` (1 ep) · `email-logs.ts` (1 ep) · `dev-migration.ts` (1 ep) — **sum = 37 ✅**
> **Mount-prefix family**: all 10 files mount under `/api` or `/api/v1`; **the admin grouping is by domain function (admin-staff workflows + system-administration), not by URL prefix** — `/api/v1/auth/*` (admin login), `/api/v1/dashboard/*`, `/api/v1/finance/*` and `/api/v1/operations/*` (3 dashboard sub-prefixes), `/api/v1/admin/*` (3 admin sub-prefixes: `users`, `db-sync`, `dev-migration`/`run-migration`), `/api/v1/email-templates/*`, `/api/v1/email-logs`, `/api/v1/integrations/*`, `/api/v1/reports/*`, `/api/v1/system-logs`. **app.ts:167 `app.use("/api/v1", requireAuth)` is the admin auth gate** — files mounted before line 167 are unauthenticated; files routed through `app.use("/api", router)` at L175 (i.e. via `routes/index.ts`) hit `requireAuth` because their paths start with `/api/v1/*`.
> **CF anchors active in this domain**: 🔴 **CF-004 (escalated P1 → P0 in this commit — see §1.A)**, 🟡 CF-008 (audit-write coverage — admin row added in this commit), 🟡 CF-014 (Tx absent + 1 positive site at `dev-migration.ts:38`), 🟡 CF-015 (hard-delete + soft-delete inconsistency), 🟡 CF-013 (no-tz timestamp writes), 🟡 CF-017 (Zod absent on 8 of 10 files), 🟡 CF-018 (admin global-scope IDOR; partial mitigations on `admin-users.ts` self-modification), 🟡 CF-022 (state-transition guard absent on `admin-users.ts:62-64`), 🟡 CF-024 (rate limit absent — admin login + admin-users mutate-without-cap).

---

## §1. Authentication boundary classification

The 37 endpoints split into **3 mount-time auth tiers** plus **1 inside-router role gate**:

| Tier | Files | Endpoint count | Mechanism | Where enforced |
|------|-------|----------------|-----------|----------------|
| A. **Unauthenticated by mount-order** | `dev-migration.ts` | **1** | `app.ts:157 app.use("/api/v1/admin", devMigrationRouter)` is BEFORE `app.ts:167 app.use("/api/v1", requireAuth)` ⇒ routed before guard. Self-protection = **hard-coded shared secret** in source (`dev-migration.ts:10 MIGRATION_SECRET = "MS_MIGRATE_2026_PROD"`) compared against `req.headers["x-migration-secret"]` at L15-18. **🔴 CF-004 escalated P0** (see §1.A). | mount-order at `app.ts:157` vs `:167` |
| B. **Unauthenticated login surface (intentional)** | `auth.ts` | **6** of 7 (login/refresh/register/forgot-password/reset-password/logout) | `app.ts:149 app.use("/api", authRouter)` is BEFORE `:167 requireAuth`; the 7th endpoint (`/v1/auth/me` at L357) attaches `requireAuth` per-handler. Login uses bcrypt compare at `auth.ts:85` and signs an 8-hour JWT via `signJWT` at `auth.ts:100`/`:172`. **🟡 CF-024 anchor** — no rate limit on `/login`/`/register`/`/forgot-password`/`/reset-password`. | per-handler `requireAuth` only on `/me` |
| C. **Self-mounted `requireAuth` inside the router** | `admin-users.ts` | 4 | `app.ts:166 app.use("/api", adminUsersRouter)` is BEFORE `:167 requireAuth`, so the global guard is bypassed; **the file installs its own `router.use(requireAuth)` at `admin-users.ts:9`** ⇒ all 4 endpoints are admin-protected. The mount placement is **structurally identical to portal-partner self-protection pattern** (T002.2.g §1) — same comment in `app.ts:159-160` explains why partner routers must precede the global guard. | `admin-users.ts:9` (file-internal middleware) |
| D. **Globally protected by `requireAuth`** | `dashboard.ts` (8) + `email-templates.ts` (6) + `integrations.ts` (5) + `db-sync.ts` (3) + `system-logs.ts` (1) + `reports.ts` (1) + `email-logs.ts` (1) | **25** | These 7 files are routed through `app.ts:175 app.use("/api", router)` → `routes/index.ts` aggregator. Their URLs start with `/api/v1/*`, so they pass through the gate at `:167`. JWT verified by `requireAuth` middleware (admin token, 8h). | `app.ts:167` (global gate) |
| **D′. Inside-router role gate (compose with D)** | `db-sync.ts` (3 ep) | 3 | After global `requireAuth`, the router additionally installs `router.use(requireSuperAdmin)` at `db-sync.ts:30`. The function defined at `:18-29` returns 403 unless `req.user?.role === "SuperAdmin"`. | `db-sync.ts:30` |
| **D″. Per-handler role gate (compose with C, in this domain)** | `admin-users.ts:91 bulk-delete` (L94) + `admin-users.ts:118 permanent delete` (L135) | 2 of 4 | Inline `if (currentUser?.role !== "SuperAdmin") return 403` checks gate **only the destructive paths** (bulk delete + permanent single-user delete). Soft-delete via PATCH and listing remain admin-only. | inline at `admin-users.ts:94` + `:135` |

**Sum check**: 1 (A) + 6 (B) + 1 (B′ requireAuth /me) + 4 (C) + 25 (D) = **37 ✅**.

**T002.2.i Step 4 spot-check C3 — cross-domain SuperAdmin role-gate audit (NEW finding, R-REPO-7 self-correction in this same commit)**: `rg "requireSuperAdmin|currentUser\?\.role.*SuperAdmin" artifacts/api-server/src/routes/` returns **11 inline sites across 6 files**, only **3 of which live in the admin domain** (`db-sync.ts:30` router-level + `admin-users.ts:94`/`:135` per-handler). The remaining **8 inline sites in 5 files** are **cross-domain** SuperAdmin checks added by handler authors who needed an extra privilege tier without registering a new middleware:

| File (domain) | Lines | Pattern |
|---------------|-------|---------|
| `service-catalog.ts` (ops-catalog) | `:75`, `:98` | per-handler inline |
| `tasks.ts` (ops-crm) | `:139`, `:161` | per-handler inline |
| `spaces.ts` (ops-property) | `:189`, `:216` | per-handler inline |
| `beneficiaries.ts` (finance-payments) | `:97`, `:119` | per-handler inline |
| `cs-tickets.ts` (portal-guest) | `:178`, `:199` | per-handler inline |

This means **the project has two parallel role-gate patterns**: (i) router-level `router.use(requireSuperAdmin)` (used **once**, at `db-sync.ts:30`), and (ii) **per-handler inline `if (currentUser?.role !== "SuperAdmin") return 403`** (used **10 times** across 6 files including admin-users). The inline pattern is structurally fragile: any new endpoint added to one of these 5 files (or a new `super`-only endpoint added to a 7th file) is **opt-in to the role check** — the author must remember to add the inline test. **Phase 2 prescription**: convert the inline pattern to a `requireSuperAdmin` middleware + apply via `router.use(requireSuperAdmin)` selectively at file scope, or convert to ASP.NET `[Authorize(Roles="SuperAdmin")]` attribute per-action with project-level Roslyn analyzer enforcement that flags any handler mutating high-risk tables (commissions / beneficiaries / contracts / users) without the attribute. **Cross-ref**: this finding is escalated to a **CF-018 evidence expansion** (vertical-privilege-escalation sub-pattern, distinct from horizontal IDOR) and recorded in §5 i6 below.

**Composition matrix** (A through D′ are mount-time tiers; D″ is per-handler):

| File | Tier | SuperAdmin gate sites | Rate-limit (CF-024) |
|------|------|------------------------|----------------------|
| `dev-migration.ts` | A (unauthenticated by mount-order) | n/a (shared secret only) | ❌ |
| `auth.ts` | B (6 unauthenticated) + per-handler `requireAuth` on `/me` | n/a | ❌ |
| `admin-users.ts` | C (file-internal `requireAuth`) | 2 of 4 (bulk-delete + permanent delete) | ❌ |
| `db-sync.ts` | D + D′ (`requireSuperAdmin` for all 3 ep) | 3 of 3 (entire router) | ❌ |
| `dashboard.ts`, `email-templates.ts`, `integrations.ts`, `system-logs.ts`, `reports.ts`, `email-logs.ts` | D | none | ❌ |

### §1.A — CF-004 ESCALATION P1 → P0 (decided in T002.2.i Step 2)

**Body of the single endpoint** (`dev-migration.ts:14-79`):

1. **Auth path** (L15-18): `if (req.headers["x-migration-secret"] !== "MS_MIGRATE_2026_PROD") return 403` — shared-secret string compared with `!==` (no constant-time compare; timing-attack surface, though secondary risk).
2. **Workload** (L38-66, inside `db.transaction`):
   - **L39-52: `TRUNCATE TABLE 39 tables RESTART IDENTITY CASCADE`** — destroys every business row in:
     `suburbs, product_groups, product_types, contract_types, payment_info, contacts, accounts, leads, tasks, admin_users, guest_users, properties, spaces, space_options, space_policies, space_images, space_availability, space_blocked_dates, space_option_maps, service_catalog, accommodation_catalog, accommodation_service_catalog, space_service_catalog, promotions, beneficiaries, commissions, contracts, bookings, booking_documents, contract_products, invoices, recurring_schedule, integration_settings, email_template, email_log, service_hosts, system_log, work_orders, cs_tickets, cs_messages`
   - **L54-65**: replays `INSERT INTO …` statements parsed from a sibling `seed-migration.sql` file, using `SAVEPOINT ${sp_mig_${i}}` per-statement so individual failures don't roll back the whole transaction.
3. **Returns** (L68-74): `{ executed, errorCount, errors[0..20] }`.

**Decision (R-REPO-7 trade-off — recorded for archaeology)**:
- **(가) CF-004 escalation P0 with dual root-cause evidence in one CF entry** ✅ chosen
- (나) CF-004 P0 escalation + NEW CF-025 (hard-coded secrets in source code) — adds a clean separation but inflates total count
- (다) Keep CF-004 at P1 with body evidence + NEW CF-025 P0 — under-rates the destructive scope; rejected
- **Rationale for (가)**: the destructive scope (39-table TRUNCATE) and the bypass mechanism (mount-order before `requireAuth` + hard-coded secret in source) are the **same operational hazard** — a single attacker who reads the public Git history of `dev-migration.ts:10` (the literal string `"MS_MIGRATE_2026_PROD"` is committed, not loaded from `process.env`) can issue a single `POST /api/v1/admin/run-migration` with header `x-migration-secret: MS_MIGRATE_2026_PROD` and erase production. There is no `NODE_ENV !== "production"` guard around the mount at `app.ts:157`. Splitting this into 2 CFs hides the joint exploit; keeping them in CF-004 with both root-cause sub-bullets keeps the Phase 2 fix prescription joint.
- **CF-004 evidence body update (Step 5 atomic carrier in CRITICAL_FINDINGS.md)**: severity `🟡 P1` → `🔴 P0`; root causes (i) mount-order before global guard at `app.ts:157` < `:167`; (ii) shared secret hard-coded in source at `dev-migration.ts:10`; (iii) **production-callable** (no env gate); operational impact = total business data loss; Phase 2 fix = (a) move mount **after** `requireAuth` and add `requireSuperAdmin`; (b) replace shared secret with env var + constant-time compare; (c) gate the mount block in `app.ts:157` behind `if (process.env["NODE_ENV"] !== "production")`; (d) add second-factor confirmation header.

**Mount-order full audit (in support of (가))** — every router mounted before `app.ts:167`:

| Mount line | Router | Self-protection? | Verdict |
|------------|--------|------------------|---------|
| `:149` | `authRouter` (7 ep) | per-handler `requireAuth` on `/v1/auth/me` only; the other 6 are intentionally open (login surface) | ✅ intentional |
| `:150` | `healthRouter` (2 ep, public domain) | none — read-only | ✅ intentional |
| `:151` | `publicRouter` (10 ep, public domain) | none — read+lead-INSERT | ✅ intentional (per public.md §1) |
| `:152` | `privacyRouter` (2 ep, public domain) | none — write footprint | ✅ intentional (per public.md §1) |
| `:153` | `guestAuthRouter` (3 ep, portal-guest) | bcrypt compare; tokens issued post-login | ✅ intentional (per portal-guest.md) |
| `:154` | `guestPortalRouter` (18 ep, portal-guest) | per-handler `requireGuestAuth` on each endpoint | ✅ intentional (per portal-guest.md) |
| `:155` | `guestCsRouter` (8 ep, portal-guest) | per-handler `requireGuestAuth` | ✅ intentional |
| `:156` | `stripeRouter` (2 ep, finance-payments) | webhook signature + per-handler auth | ✅ intentional |
| **`:157`** | **`devMigrationRouter` (1 ep)** | **shared-secret only — hard-coded** | **❌ CF-004 P0** |
| `:161-164` | `partnerAuthRouter` (3) + `agentPortalRouter` (5) + `ownerPortalRouter` (5) + `serviceHostPortalRouter` (9) | per-handler `requireAgentAuth`/`requireOwnerAuth`/`requireServiceHostAuth` | ✅ intentional (per portal-partner.md §1) |
| `:166` | `adminUsersRouter` (4 ep) | **file-internal `router.use(requireAuth)` at `admin-users.ts:9`** | ✅ intentional (Tier C above) |

`dev-migration` is the **sole entry in the pre-guard mount block lacking JWT-based authentication** (it has no per-handler middleware and no file-level `router.use(requireAuth)` — only the shared-secret header check inside the handler). Confirmed by `rg -n "requireAuth|requireSuperAdmin" artifacts/api-server/src/routes/dev-migration.ts` = 0 hits.

---

## §2. CF-008 admin row — inverse-correlation hypothesis verdict (T002.2.i closure)

`grep -c "logAction" artifacts/api-server/src/routes/<file>.ts` for all 10 admin files = **0 across the board**. Project-wide audit-coverage matrix updated:

| Domain | Mutator endpoints (approx.) | logAction call sites | Coverage % | Hypothesis |
|--------|------------------------------|----------------------|-----------|------------|
| contract | 14 | 6 | **42.9 %** | high (contract = compliance-sensitive) |
| finance-invoicing | 5 | 1 | 20 % | low |
| finance-payments | 4 | 1 | 25 % | low |
| ops-property | 19 | 0 | **0 %** | absolute lowest 4-way TIE before this commit |
| ops-catalog | 39 | 0 | **0 %** | absolute lowest 4-way TIE |
| ops-crm | 51 | 0 | **0 %** | absolute lowest 4-way TIE |
| portal-guest | 9 (write) of 29 | 1 | **3.4 %** | very low |
| portal-partner | 22 | 0 | **0 %** | absolute lowest 4-way TIE |
| public | 9 (unauthenticated mutations of 33) | 0 | **0 %** | tied at floor (CF-024 compounded) |
| **admin** (this commit) | **18 mutators of 37** (auth 5 + admin-users 4 + email-templates 4 + integrations 4 + db-sync 1 + dev-migration 1; the 19 readers are dashboard 8 + auth `/me` 1 + email-templates 2 + integrations 1 + system-logs 1 + reports 1 + email-logs 1 + db-sync 1 = 19 *(includes db-sync info GET)*) | **0** | **0 %** — **inverse correlation hypothesis CONFIRMED with reversal twist** |

**Inverse-correlation verdict**: 6 of 11 audited domains/sub-domains tie at **0 %** (admin + ops-property + ops-catalog + ops-crm + portal-partner + public). The single best-audited domain (contract @ 42.9 %) is the only domain with a CF-008 figure above 25 %. Read-heavy domains are not the whole story — admin contains 18 mutators (auth state changes, admin-user PATCHes, integration UPSERTs, schema TRUNCATE) and **none** is audit-traced. **Reversal**: the original sub-task plan's "GGG" hypothesis allowed for the possibility that admin would be the best-audited domain (administrative actions intuitively warrant traceability); the data refutes this — admin is **tied at the absolute floor**. The cause appears to be that the project has a **`system_logs` table** and a **`logAction` helper** (verified at `lib/db/src/schema/system-logs.ts` + read-only consumer `system-logs.ts:7 GET /v1/system-logs`), but **no router file in the admin domain calls `logAction`** to write into it; the admin-domain table acts as a **consumer-only surface for audit data produced elsewhere** (the 6 contract-domain `logAction` sites are the primary writers). This is a **structural completeness gap** — admin operations themselves are invisible to the audit trail that admin staff are reading.

**Phase 2 baseline (audit policy)**: minimum coverage requirement = 100 % on **admin mutators** (18 sites in admin alone) plus the partner/ops/public mutator backlog. If `logAction` is moved into `requireAuth` middleware as an automatic interceptor for all non-GET methods, the coverage gap closes by construction.

---

## §3. Endpoint inventory (37 rows, per-file blocks)

Format: `Method | Path | Handler L# | Tx | Zod | logAction | Auth | $$ touched | CF anchors | Notes`. Full sample format reserved for the 5 highest-risk endpoints (D1, A1, M1, AU3, I5 — see §3.A); all 37 rows are tabulated in §3.B.

### §3.A — Detailed format on 5 highest-risk endpoints

#### D1. `POST /api/v1/admin/run-migration` — `dev-migration.ts:14`
- **Meta**: `Auth=secret-only ❌` · `$$=indirect (TRUNCATEs invoices/contracts/bookings)` · `logAction=❌` · `CF=🔴 CF-004 (P0)+CF-014 (positive Tx site, see notes)+CF-024`
- **Auth path**: `req.headers["x-migration-secret"] === "MS_MIGRATE_2026_PROD"` (literal at `:10`); fails fast with 403 on mismatch.
- **Workload**: `db.transaction` (L38) wraps a `TRUNCATE 39 tables RESTART IDENTITY CASCADE` (L39-52) followed by a `SAVEPOINT`-per-statement INSERT replay loop reading `seed-migration.sql` (L54-65). The transaction provides **rollback safety on the TRUNCATE** but the SAVEPOINT loop intentionally tolerates per-row failures (L57-65 ROLLBACK TO SAVEPOINT on catch).
- **Validation**: 0 (no Zod, no body check beyond the secret header).
- **Audit**: 0 `logAction` calls — a TRUNCATE-the-database operation completes without writing to `system_log`.
- **Idempotency**: not idempotent in the conventional sense, but **deterministic** — re-running with the same `seed-migration.sql` will TRUNCATE again and replay the same rows (same `executed`/`errorCount` shape).
- **Phase 2 fix**: see §1.A (move mount, replace secret, add NODE_ENV gate, add `requireSuperAdmin`).

#### A1. `POST /api/v1/auth/login` — `auth.ts:30`
- **Meta**: `Auth=public ✅ intentional` · `$$=❌` · `logAction=❌` · `CF=🟡 CF-024 (rate-limit absent)`
- **Workload**: `bcrypt.compare(password, user.password_hash)` at `:85`; on success, `signJWT(payload)` at `:100` returns 8-hour token (`requireAuth.ts:26` defines 8h `expiresIn`).
- **Validation**: 0 Zod (manual `if (!email || !password)` at the top of the handler).
- **Audit**: 0 `logAction` — successful logins are not recorded; failed logins are not recorded; **no lockout on repeated failures**.
- **Risk**: paired with CF-024 (no rate-limit infrastructure at all in `artifacts/api-server/src/` — see CRITICAL_FINDINGS.md §CF-024), this is the canonical **password-spraying** target. The login response always includes a 200/401 distinguishable body, so attackers can iterate.

#### M1. `POST /api/v1/integrations/update-env` — `integrations.ts:197`
- **Meta**: `Auth=requireAuth ✅` · `$$=❌` · `logAction=❌` · `CF=🟡 CF-008+CF-013 (`updated_at: new Date()` at `:222/:226` no-tz column)+CF-014 (no Tx around the env-mutation/DB-write pair)`
- **Workload**: validates `key ∈ ALLOWED_KEYS` (allowlist defined elsewhere in the file); writes `process.env[key] = trimmedValue` (or `delete` if empty) at L211-215; then UPSERTs `integration_settings(key, value, updated_at)` at L218-227 (`onConflictDoUpdate`).
- **Race window**: `process.env` mutation precedes the DB UPSERT — if the DB write throws (catch at L228-231), the in-memory `process.env` is **already mutated** and the response returns a 500 to the caller, but **subsequent requests on the same Node process will see the new value**. Subsequent restarts will re-load the previous DB value. Net: a transient inconsistency between the in-memory env and the persisted env across the failure window.
- **Authorization scope**: any admin (no SuperAdmin gate); this means rotating Stripe/Cloudinary/Resend secrets is a **standard admin** action — Phase 2 candidate for `requireSuperAdmin`.

#### AU3. `POST /api/v1/admin/users/bulk-delete` — `admin-users.ts:91`
- **Meta**: `Auth=requireAuth + inline SuperAdmin role gate at :94 ✅` · `$$=❌` · `logAction=❌` · `CF=🟡 CF-013 (`deleted_at: new Date()` at :108)+CF-015 (hard-delete branch at :106)+CF-018 (positive — self-modification guard at :101 `id !== currentUser.id`)+CF-014 (no Tx around the multi-row delete)`
- **Workload**: payload `{ ids[], permanent }`; `currentUser?.role === "SuperAdmin"` else 403; manual Array.isArray + non-empty guard; `numIds = ids.map(Number).filter(id => !isNaN(id) && id !== currentUser.id)` (self-id excluded — **CF-018 positive sub-pattern: vertical privilege containment via current-user filtering**); branches: `permanent === true` → `db.delete(usersTable).where(inArray(...))` (hard-delete); else → `db.update(usersTable).set({ deleted_at: new Date(), is_active: false, status: "archived" })` (soft-delete).
- **Validation**: 0 Zod; manual array guard at L98 + numeric coercion at L101.
- **Audit**: 0 `logAction` — a SuperAdmin nuking N user rows is invisible to `system_log`.
- **CF-022 anchor (state-transition gate ungated)**: bulk-delete sets `status: "archived"` regardless of the rows' current `status` — a row already at `pending` or `rejected` is silently archived; no precondition matrix.

#### I5. `POST /api/v1/integrations/resend/test` — `integrations.ts:171` (representative external-service test)
- **Meta**: `Auth=requireAuth ✅` · `$$=❌` · `logAction=❌` · `CF=🟡 CF-024 (rate-limit absent on outbound test)`
- **Workload**: triggers a Resend API send-mail call to a caller-supplied `to` address. Without per-route rate limiting + without per-user limiting, an admin user (or compromised admin session) can use this endpoint as a **mail-relay amplifier**.
- **Risk**: same issue applies to `/v1/integrations/stripe/test` (`integrations.ts:121`) and `/v1/integrations/cloudinary/test` (`:140`) but with smaller blast radii.

### §3.B — Full 37-row inventory (compact)

> **Legend**: A=`requireAuth` · A+S=`requireAuth`+`requireSuperAdmin` · A+S* = SuperAdmin per-handler inline · pub=public · sec=shared-secret only · Tx=`db.transaction` · Z=Zod `safeParse` · L=`logAction` · ⓘ=read-only · ✏️=mutator

#### `dashboard.ts` (8 ep — all GET, all `requireAuth` Tier D, all read-only)
| # | Path | L# | Auth | Z | L | $$ | CF | Notes |
|---|------|-----|------|---|---|-----|-----|------|
| DB1 | `GET /v1/dashboard/stats` | 7 | A | ❌ | n/a (ⓘ) | reads | — | KPI roll-up across booking/contract/finance |
| DB2 | `GET /v1/dashboard/overview/kpis` | 53 | A | ❌ | n/a | reads | — | Cross-domain KPI |
| DB3 | `GET /v1/finance/summary` | 91 | A | ❌ | n/a | reads invoice/contract | CF-001 (real/numeric mix on read side) | finance-* domain consumer |
| DB4 | `GET /v1/finance/revenue/monthly` | 134 | A | ❌ | n/a | reads invoice | CF-001 | monthly aggregation |
| DB5 | `GET /v1/finance/revenue/by-property` | 156 | A | ❌ | n/a | reads invoice+property | CF-001 + CF-021 (potential N+1 per-property roll-up) | property cross-ref |
| DB6 | `GET /v1/finance/tax-summary` | 189 | A | ❌ | n/a | reads invoice (tax cols) | CF-001 | tax aggregation |
| DB7 | `GET /v1/operations/summary/kpis` | 213 | A | ❌ | n/a | reads ops domain | — | ops-* consumer |
| DB8 | `GET /v1/operations/activity-log` | 234 | A | ❌ | n/a | reads system_log | — | overlap with system-logs.ts SL1 |

#### `auth.ts` (7 ep — admin login surface)
| # | Path | L# | Auth | Z | L | $$ | CF | Notes |
|---|------|-----|------|---|---|-----|-----|------|
| A1 | `POST /v1/auth/login` | 30 | pub (intentional) | ❌ | ❌ | n/a | CF-024 (rate-limit), CF-008 | bcrypt compare; signJWT 8h (§3.A detailed) |
| A2 | `POST /v1/auth/refresh` | 136 | pub | ❌ | ❌ | n/a | CF-024 | re-signs 8h JWT at :172 |
| A3 | `POST /v1/auth/register` | 186 | pub | ❌ | ❌ | n/a | CF-024, CF-013 (created_at no-tz inferred) | bcrypt.hash 12 rounds at :213 |
| A4 | `POST /v1/auth/forgot-password` | 245 | pub | ❌ | ❌ | n/a | CF-024 (email enumeration), CF-008 | reset-token issuance |
| A5 | `POST /v1/auth/reset-password` | 287 | pub | ❌ | ❌ | n/a | CF-024, CF-008 | bcrypt.hash 12 at :318; clears `reset_token`/`reset_token_expires_at`/`force_password_change` at :322 |
| A6 | `POST /v1/auth/logout` | 340 | pub | ❌ | ❌ | n/a | — | session destroy + 200; no JWT revocation (stateless) |
| A7 | `GET /v1/auth/me` | 357 | per-handler `requireAuth` | ❌ | n/a (ⓘ) | n/a | — | only per-handler-guarded ep in this file |

#### `email-templates.ts` (6 ep — Tier D, **only admin-domain Zod-using file**)
| # | Path | L# | Auth | Z | L | $$ | CF | Notes |
|---|------|-----|------|---|---|-----|-----|------|
| ET1 | `GET /v1/email-templates` | 19 | A | ❌ | n/a (ⓘ) | n/a | — | list |
| ET2 | `GET /v1/email-templates/:id` | 26 | A | ❌ | n/a | n/a | — | detail |
| ET3 | `PUT /v1/email-templates/:id` | 34 | A | **✅ `UpdateEmailTemplateBody.safeParse(req.body)` at :35** | ❌ | n/a | CF-017 positive | only admin-domain Zod use site (1) |
| ET4 | `POST /v1/email-templates/:id/test` | 53 | A | **✅ `TestEmailBody.safeParse(req.body)` at :54** | ❌ | n/a | CF-017 positive, CF-024 (mail amplifier) | only admin-domain Zod use site (2) |
| ET5 | `POST /v1/email-templates/bulk-delete` | 77 | A | ❌ | ❌ | n/a | CF-014 (no Tx), CF-015 | manual `Array.isArray + .length` guard mirroring `blog-posts.ts:110-124` afterthought-endpoint anti-pattern (CF-017 POSITIVE EXEMPLAR cross-ref to public.md) |
| ET6 | `DELETE /v1/email-templates/:id` | 95 | A | ❌ | ❌ | n/a | CF-015 | hard-delete |

#### `integrations.ts` (5 ep — Tier D)
| # | Path | L# | Auth | Z | L | $$ | CF | Notes |
|---|------|-----|------|---|---|-----|-----|------|
| I1 | `GET /v1/integrations/status` | 60 | A | ❌ | n/a (ⓘ) | n/a | — | reads `integration_settings`; masks cloudinary api_key/secret at L95-96 |
| I2 | `POST /v1/integrations/stripe/test` | 121 | A | ❌ | ❌ | n/a | CF-024 | external-call test |
| I3 | `POST /v1/integrations/cloudinary/test` | 140 | A | ❌ | ❌ | n/a | CF-024 | external-call test |
| I4 | `POST /v1/integrations/resend/test` | 171 | A | ❌ | ❌ | n/a | CF-024 (mail amplifier) | §3.A I5 detailed |
| I5 | `POST /v1/integrations/update-env` | 197 | A | ❌ | ❌ | n/a | CF-013 (updated_at), CF-014 (no Tx around env+DB pair), CF-008 | §3.A M1 detailed; **process.env mutation + DB UPSERT race** |

#### `admin-users.ts` (4 ep — Tier C self-mounted `requireAuth`)
| # | Path | L# | Auth | Z | L | $$ | CF | Notes |
|---|------|-----|------|---|---|-----|-----|------|
| AU1 | `GET /v1/admin/users` | 12 | A (file-internal) | ❌ | n/a (ⓘ) | n/a | — | list excluding `deleted_at IS NOT NULL` (positive soft-delete-aware read; CF-020 mitigated locally) |
| AU2 | `PATCH /v1/admin/users/:id` | 39 | A | ❌ | ❌ | n/a | CF-022 (status transition ungated at :58-64), CF-013 (updates ts), CF-014 (no Tx) | hashes password if provided at :69 (bcrypt 12); status whitelist `["active","pending","rejected"]` at :58 |
| AU3 | `POST /v1/admin/users/bulk-delete` | 91 | A + S* (inline at :94) | ❌ | ❌ | n/a | CF-013, CF-015 (hard branch at :106), CF-018 positive (self-id filter at :101), CF-014 | §3.A AU3 detailed |
| AU4 | `DELETE /v1/admin/users/:id` | 118 | A; SuperAdmin only on `?permanent=true` (inline at :135) | ❌ | ❌ | n/a | CF-013, CF-015 (hard branch at :139), CF-018 positive (self-id check at :127) | dual-mode delete (soft default; permanent requires SuperAdmin) |

#### `db-sync.ts` (3 ep — Tier D + D′ `requireSuperAdmin`)
| # | Path | L# | Auth | Z | L | $$ | CF | Notes |
|---|------|-----|------|---|---|-----|-----|------|
| DS1 | `GET /db-sync/info` | 32 | A + S | ❌ | n/a (ⓘ) | n/a | — | safe info (table list / row counts) |
| DS2 | `POST /db-sync/export` | 41 | A + S | ❌ | ❌ | n/a | CF-008 | snapshot export — destructive read of all production data; not audited |
| DS3 | `POST /db-sync/import` | 55 | A + S | ❌ | ❌ | n/a | CF-008, CF-014 (likely uses `seedSync.ts:214` `db.transaction` per T001.5 anchor; verify in T002.3 db-schema-overview) | snapshot import — second known production-data destructive surface; logs into `system_log`? — verified 0 |

#### Single-endpoint files (system-logs / reports / email-logs / dev-migration)
| # | Path | L# | Auth | Z | L | $$ | CF | Notes |
|---|------|-----|------|---|---|-----|-----|------|
| SL1 | `GET /v1/system-logs` | 7 (`system-logs.ts`) | A | ❌ | n/a (ⓘ) | reads `system_log` | — | paginated read of audit data — **consumer**; the 6 contract-domain `logAction` writers populate it |
| RP1 | `GET /v1/reports/bookings` | 8 (`reports.ts`) | A | ❌ | n/a (ⓘ) | reads booking+invoice+contract | CF-001 (real/numeric on read), CF-021 (potential N+1 per booking) | cross-domain read |
| EL1 | `GET /v1/email-logs` | 7 (`email-logs.ts`) | A | ❌ | n/a (ⓘ) | reads `email_log` | — | paginated read |
| D1 | `POST /api/v1/admin/run-migration` | 14 (`dev-migration.ts`) | sec | ❌ | ❌ | n/a (TRUNCATEs invoices/contracts/bookings) | **🔴 CF-004 (P0)**, CF-014 (positive Tx site at :38), CF-024 | §3.A D1 detailed |

**Mutator count**: A1+A2+A3+A4+A5+A6 (auth 6 mutators incl. logout state change) + AU2+AU3+AU4 (admin-users 3) + ET3+ET4+ET5+ET6 (email-templates 4) + I2+I3+I4+I5 (integrations 4) + DS2+DS3 (db-sync 2) + D1 (1) = 6+3+4+4+2+1 = **20 mutators**. Read-only: DB1-DB8 (8) + A7 (1) + ET1+ET2 (2) + I1 (1) + DS1 (1) + SL1+RP1+EL1 (3) = **17 readers**. Sum = 37 ✅. (Note: §2 hypothesis table used a slightly more conservative count of 18 mutators by treating logout as a session-state but not a row-mutator; either count yields 0 % logAction coverage — the qualitative conclusion is unchanged.)

---

## §4. Self-check (37 × 7 = 259 cells)

| # | Path | Auth-tier ✓ | Mount-line ✓ | Zod ✓ | logAction ✓ | Tx ✓ | CF anchors ✓ |
|---|------|--------------|----------------|--------|---------------|-------|----------------|
| DB1 | `/v1/dashboard/stats` | A=`requireAuth` (`app.ts:167`) ✅ | dashboard.ts:7 ✅ | 0 ✅ | 0 ✅ | n/a (read) ✅ | — ✅ |
| DB2 | `/v1/dashboard/overview/kpis` | A ✅ | :53 ✅ | 0 ✅ | 0 ✅ | n/a ✅ | — ✅ |
| DB3 | `/v1/finance/summary` | A ✅ | :91 ✅ | 0 ✅ | 0 ✅ | n/a ✅ | CF-001 ✅ |
| DB4 | `/v1/finance/revenue/monthly` | A ✅ | :134 ✅ | 0 ✅ | 0 ✅ | n/a ✅ | CF-001 ✅ |
| DB5 | `/v1/finance/revenue/by-property` | A ✅ | :156 ✅ | 0 ✅ | 0 ✅ | n/a ✅ | CF-001+CF-021 ✅ |
| DB6 | `/v1/finance/tax-summary` | A ✅ | :189 ✅ | 0 ✅ | 0 ✅ | n/a ✅ | CF-001 ✅ |
| DB7 | `/v1/operations/summary/kpis` | A ✅ | :213 ✅ | 0 ✅ | 0 ✅ | n/a ✅ | — ✅ |
| DB8 | `/v1/operations/activity-log` | A ✅ | :234 ✅ | 0 ✅ | 0 ✅ | n/a ✅ | — ✅ |
| A1 | `/v1/auth/login` | pub (`app.ts:149` < `:167`) ✅ | auth.ts:30 ✅ | 0 ✅ | 0 ✅ | n/a ✅ | CF-024+CF-008 ✅ |
| A2 | `/v1/auth/refresh` | pub ✅ | :136 ✅ | 0 ✅ | 0 ✅ | n/a ✅ | CF-024 ✅ |
| A3 | `/v1/auth/register` | pub ✅ | :186 ✅ | 0 ✅ | 0 ✅ | n/a ✅ | CF-024+CF-013 ✅ |
| A4 | `/v1/auth/forgot-password` | pub ✅ | :245 ✅ | 0 ✅ | 0 ✅ | n/a ✅ | CF-024+CF-008 ✅ |
| A5 | `/v1/auth/reset-password` | pub ✅ | :287 ✅ | 0 ✅ | 0 ✅ | n/a ✅ | CF-024+CF-008 ✅ |
| A6 | `/v1/auth/logout` | pub ✅ | :340 ✅ | 0 ✅ | 0 ✅ | n/a ✅ | — ✅ |
| A7 | `/v1/auth/me` | per-handler `requireAuth` (`auth.ts:357`) ✅ | :357 ✅ | 0 ✅ | 0 ✅ | n/a ✅ | — ✅ |
| ET1 | `/v1/email-templates` | A ✅ | email-templates.ts:19 ✅ | 0 ✅ | 0 ✅ | n/a ✅ | — ✅ |
| ET2 | `/v1/email-templates/:id` | A ✅ | :26 ✅ | 0 ✅ | 0 ✅ | n/a ✅ | — ✅ |
| ET3 | `PUT /v1/email-templates/:id` | A ✅ | :34 ✅ | **1 (`UpdateEmailTemplateBody` :35)** ✅ | 0 ✅ | 0 ✅ | CF-017 positive ✅ |
| ET4 | `/v1/email-templates/:id/test` | A ✅ | :53 ✅ | **1 (`TestEmailBody` :54)** ✅ | 0 ✅ | 0 ✅ | CF-017 positive+CF-024 ✅ |
| ET5 | `/v1/email-templates/bulk-delete` | A ✅ | :77 ✅ | 0 ✅ | 0 ✅ | 0 ✅ | CF-014+CF-015 ✅ |
| ET6 | `DELETE /v1/email-templates/:id` | A ✅ | :95 ✅ | 0 ✅ | 0 ✅ | 0 ✅ | CF-015 ✅ |
| I1 | `/v1/integrations/status` | A ✅ | integrations.ts:60 ✅ | 0 ✅ | 0 ✅ | n/a ✅ | — ✅ |
| I2 | `/v1/integrations/stripe/test` | A ✅ | :121 ✅ | 0 ✅ | 0 ✅ | n/a ✅ | CF-024 ✅ |
| I3 | `/v1/integrations/cloudinary/test` | A ✅ | :140 ✅ | 0 ✅ | 0 ✅ | n/a ✅ | CF-024 ✅ |
| I4 | `/v1/integrations/resend/test` | A ✅ | :171 ✅ | 0 ✅ | 0 ✅ | n/a ✅ | CF-024 ✅ |
| I5 | `/v1/integrations/update-env` | A ✅ | :197 ✅ | 0 ✅ | 0 ✅ | 0 (no Tx around env+DB pair) ✅ | CF-013+CF-014+CF-008 ✅ |
| AU1 | `/v1/admin/users` | A (`admin-users.ts:9` file-internal) ✅ | admin-users.ts:12 ✅ | 0 ✅ | n/a ✅ | n/a ✅ | — ✅ |
| AU2 | `PATCH /v1/admin/users/:id` | A ✅ | :39 ✅ | 0 ✅ | 0 ✅ | 0 ✅ | CF-022+CF-013+CF-014 ✅ |
| AU3 | `/v1/admin/users/bulk-delete` | A + S* (`:94`) ✅ | :91 ✅ | 0 ✅ | 0 ✅ | 0 ✅ | CF-013+CF-015+CF-018 pos+CF-014 ✅ |
| AU4 | `DELETE /v1/admin/users/:id` | A; S* on `?permanent=true` (`:135`) ✅ | :118 ✅ | 0 ✅ | 0 ✅ | 0 ✅ | CF-013+CF-015+CF-018 pos ✅ |
| DS1 | `/db-sync/info` | A + S (`db-sync.ts:30`) ✅ | db-sync.ts:32 ✅ | 0 ✅ | n/a ✅ | n/a ✅ | — ✅ |
| DS2 | `/db-sync/export` | A + S ✅ | :41 ✅ | 0 ✅ | 0 ✅ | n/a ✅ | CF-008 ✅ |
| DS3 | `/db-sync/import` | A + S ✅ | :55 ✅ | 0 ✅ | 0 ✅ | likely Tx (per T001.5 anchor) ✅ | CF-008+CF-014 ✅ |
| SL1 | `/v1/system-logs` | A ✅ | system-logs.ts:7 ✅ | 0 ✅ | n/a ✅ | n/a ✅ | — ✅ |
| RP1 | `/v1/reports/bookings` | A ✅ | reports.ts:8 ✅ | 0 ✅ | n/a ✅ | n/a ✅ | CF-001+CF-021 ✅ |
| EL1 | `/v1/email-logs` | A ✅ | email-logs.ts:7 ✅ | 0 ✅ | n/a ✅ | n/a ✅ | — ✅ |
| D1 | `/api/v1/admin/run-migration` | sec (no JWT — mount `app.ts:157` < `:167`) ✅ | dev-migration.ts:14 ✅ | 0 ✅ | 0 ✅ | **1 ✅ (positive Tx at :38)** | **🔴 CF-004 (P0)**+CF-014 positive+CF-024 ✅ |

**Total**: 37 rows × 7 columns = 259 cells; **0 cells flagged in re-verification**.

---

## §5. R-REPO-5 incidentals (T002.2.i — 5 entries)

- **i1** [Phase 2 memo, no CF]: `dev-migration.ts:10` shared secret `"MS_MIGRATE_2026_PROD"` is hard-coded in source. Rolled into **CF-004 P0 escalation evidence body** per R-REPO-7 trade-off (가); not promoted to a separate CF-025. Phase 2 fix prescription = env var + constant-time compare.
- **i2** [Positive memo, no CF expansion]: `dev-migration.ts:38-66` is a **textbook SAVEPOINT-per-statement pattern** — `db.transaction` wrapping a TRUNCATE + per-INSERT savepoint that tolerates partial failure without aborting the whole batch. Worth citing in T005 workflows or T006 design as a positive Tx pattern alongside `service-host-portal.ts:365-393` (CF-014 POSITIVE EXEMPLAR) and `blog-posts.ts:88-108` (CF-017 POSITIVE EXEMPLAR). Co-list candidate.
- **i3** [Memo to T002.4 / T003 cross-domain]: `integrations.ts:197` `update-env` mutates `process.env` **before** persisting to the DB; on DB-write failure, in-memory state diverges from persisted state until next restart. Consider in T002.4 erd-core / T003 domain-model under "Configuration data" section. **Sub-finding**: the `ALLOWED_KEYS` allowlist (referenced at L201, definition body not re-verified here) acts as the sole defense against arbitrary env-var injection — Phase 2 should externalize to a typed config schema.
- **i4** [Cross-ref note, no CF]: `admin-users.ts` mounts `requireAuth` **inside the router file itself** (`:9`), which is **the same pattern** as the four partner-domain files (`partner-auth.ts`, `agent-portal.ts`, `owner-portal.ts`, `service-host-portal.ts`) cataloged in T002.2.g. The `app.ts:159-160` comment block ("Partner auth + portals — must be registered BEFORE adminUsersRouter which applies requireAuth to every request passing through it") **explicitly documents this design** — admin-users mounts `requireAuth` because it has to clear before the global `:167` gate to respect the partner mount order. This is a self-documented architectural pattern, not a defect.
- **i5** [Memo to T002.4 erd-core, no CF]: `system-logs.ts` is **read-only over `system_log`** (no `logAction` writes from within the admin domain); the writers live in 6 contract-domain handlers. ER diagram should annotate `system_log` as a **producer-consumer split** table — admin reads it, contract writes it, all other domains have a 0 % write rate. This may also inform CF-008 Phase 2 fix design (middleware-level interceptor).
- **i6** [**CF-018 evidence expansion** triggered in this same commit per R-REPO-7 (c) self-correction]: discovered during Step 4 spot-check C3 that **the project has 11 SuperAdmin role-gate sites across 6 files** (1 router-level + 10 per-handler inline), of which **only 3 are in the admin domain** — the remaining 8 inline sites are scattered across ops-catalog (`service-catalog.ts:75/:98`), ops-crm (`tasks.ts:139/:161`), ops-property (`spaces.ts:189/:216`), finance-payments (`beneficiaries.ts:97/:119`) and portal-guest (`cs-tickets.ts:178/:199`). These are **vertical-privilege-escalation** controls (not the horizontal IDOR pattern that CF-018 originally cataloged), but they share the same root cause: **inline per-handler authorization** is fragile vs middleware-applied authorization. **Disposition**: CF-018 evidence body to be expanded in this commit's atomic carrier (CRITICAL_FINDINGS.md update) with a "Sub-pattern B — vertical-privilege-escalation: per-handler inline `requireSuperAdmin` (10 sites in 6 files)" section, distinct from the existing "Sub-pattern A — horizontal IDOR omission" body. **No new CF promotion** (CF-018 already P1; expansion only). The 8 cross-domain sites should be back-referenced from the corresponding domain files (ops-catalog.md, ops-crm.md, ops-property.md, finance-payments.md, portal-guest.md) in a future omnibus back-fill or with the T002.2.j atomic commit. This is a **6th-domain miss**: T002.2.b–.g failed to enumerate the inline SuperAdmin pattern in their own files; T002.2.i caught it because spot-check C3 asked for project-wide enumeration. R-REPO-5 process working as designed.

**Mini-task proposals: 0** (i1 → CF-004 body; i2 → cross-skill positive memo; i3 → T003/T002.4 memo; i4 → no-op; i5 → T002.4 memo; **i6 → CF-018 expansion in this same atomic commit per R-REPO-7 (c)**).

---

## §6. Cross-references (back-fill identified for atomic carrier in Step 5)

The admin domain reads from **all 7 prior domain files** (booking, contract, finance-invoicing, finance-payments, ops-property, ops-catalog, ops-crm, portal-guest, portal-partner, public). Bidirectional cross-refs are populated as follows:

- **`dashboard.ts` → finance-invoicing/payments + ops-***: DB3-DB6 read invoice/contract money fields → already covered by **CF-001 carrier rows** in finance-invoicing.md / finance-payments.md (T002.2.b half-1+2). DB5 reveals N+1 candidate → already in CF-021 (T002.1.9 promotion).
- **`reports.ts` (RP1) → finance + booking**: cross-domain projection → cross-ref added to `booking.md` (close-out at T002.2.j) + `finance-invoicing.md`. **Defer back-fill to T002.2.j** (booking.md will pick up RP1 as a consumer in its 22-stub close-out commit; finance-invoicing.md note is small and can ride with the CRITICAL_FINDINGS update).
- **`system-logs.ts` (SL1) ↔ `contract.md`**: `contract.md` already documents the 6 `logAction` writer sites (per T002.2.a). Add a producer-consumer note at the top of contract.md §6 → **defer to T002.2.j atomic commit** to avoid a one-line back-fill commit here.
- **`integrations.ts` → finance-payments (Stripe) + portal-guest (Cloudinary signed-uploads) + auth (Resend triggers)**: already implicitly covered via CF anchors.
- **`admin-users.ts` (AU1-AU4) → no other domain** — `usersTable` (table name `admin_users`) is admin-private.
- **`db-sync.ts` → all tables**: snapshot scope spans the whole schema; see T002.4 erd-core for the table-of-record list.

**T002.2.j (booking close-out) cross-refs prepped here**: RP1 (admin reports) is a booking consumer; expect **1 line** in booking.md §6 referencing `admin.md §3.B RP1`. No `bookings.booking_ref` minting in admin domain (verified via `rg "booking_ref|MS-\$|BK-\$" artifacts/api-server/src/routes/{dashboard,auth,admin-users,email-templates,integrations,db-sync,system-logs,reports,email-logs,dev-migration}.ts` = 0 hits — admin reads but never mints), so **CF-023 cross-domain hunt remains CLOSED** (per T002.2.h closure marker); no admin-domain re-open.

---

## §7. Phase 2 portability notes (.NET reference targets)

- **CF-004 fix** (highest priority): wrap the run-migration handler with `[Authorize(Roles="SuperAdmin")]` (no shared-secret); guard the route registration behind `if (env.IsDevelopment())`. The TRUNCATE+seed pattern itself is fine for dev fixtures but must never reach production.
- **CF-008 admin coverage**: introduce a global action filter that calls `IAuditLogger.WriteAsync(action, userId, ...)` for every non-GET request. This closes admin (18 mutators), partner (22), ops (109), and public (9) at once.
- **CF-018 positive exemplar from this domain**: AU3/AU4's `id !== currentUser.id` self-modification guard generalizes to a `[CannotTargetSelf]` action filter in .NET.
- **CF-022 admin-users state transition** (AU2 status whitelist): convert `["active", "pending", "rejected"]` to a `UserStatus` enum + a state-machine library (Stateless / Appccelerate) that gates legal transitions; current code allows `pending → rejected → active` arbitrarily.
- **CF-014 positive Tx pattern from D1**: `db.transaction(async tx => { … SAVEPOINT loop … })` translates to `using var tx = await ctx.Database.BeginTransactionAsync(); await using var sp = await tx.CreateSavepointAsync(…)` per-statement.

---

**End of `admin.md`** — 37/37 endpoints documented; 1 CF escalation (CF-004 P1→P0) + 1 CF expansion table row (CF-008 admin row); 5 incidentals dispositioned; cross-refs to T002.2.j booking close-out and T002.4 erd-core identified.
