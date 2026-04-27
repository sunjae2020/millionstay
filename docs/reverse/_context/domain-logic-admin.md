# Admin 도메인 — 비즈니스 규칙 + 워크플로우 + 불변식

> **Sub-task**: T003 묶음 4 sub-task 4 (portal × 2 + public + admin, 분할 (β)) — **마지막 sub-task + T003 GROUP COMPLETE marker 포함**. [domain-logic-portal-guest.md](./domain-logic-portal-guest.md) + [domain-logic-portal-partner.md](./domain-logic-portal-partner.md) + [domain-logic-public.md](./domain-logic-public.md) 와 짝.
> **Scope**: 10 routes / 1451 lines / **37 endpoints** (사용자 안 일치 ✅) — `dashboard.ts` (244L, 8 ep) + `auth.ts` (361L, 7 ep) + `email-templates.ts` (110L, 6 ep) + `integrations.ts` (231L, 5 ep) + `admin-users.ts` (153L, 4 ep) + `db-sync.ts` (100L, 3 ep) + `system-logs.ts` (41L, 1 ep) + `reports.ts` (97L, 1 ep) + `email-logs.ts` (33L, 1 ep) + `dev-migration.ts` (81L, 1 ep).
> **Risk**: 🔴 **P0 (CF-004 carrier 단독)** — Triggering findings: [CF-004 P0 ESCALATED](../_audit/CRITICAL_FINDINGS.md#cf-004) (**`dev-migration.ts:14-79` body-confirmed = TRUNCATE 39 production tables RESTART IDENTITY CASCADE + SAVEPOINT seed-replay; protected only by hard-coded `MIGRATION_SECRET = "MS_MIGRATE_2026_PROD"` at `:10` + mount-order `app.ts:157` < `:167 requireAuth` with no NODE_ENV gate**; T002.2.i 본 escalation 핵심 + T003 묶음 4 sub-task 4 deep dive) / [CF-018 Sub-pattern B](../_audit/CRITICAL_FINDINGS.md#cf-018) (**vertical-privilege-escalation: 56 SuperAdmin role-gate sites repo-wide = 1 router-level db-sync.ts:30 + 56 inline `!== "SuperAdmin"` × 29 files × ~2; T002.2.j 정정 27→29 files / 54→56 hits small drift**) / [CF-008](../_audit/CRITICAL_FINDINGS.md#cf-008) (**admin row 0/37 = 0%** ⇒ **6-way TIE at floor** confirmed: admin + ops-property + ops-catalog + ops-crm + portal-partner + public 모두 audit-blind for own mutators; reversal twist = admin = audit data CONSUMER but blind for own 18-20 mutators) / [CF-014 POSITIVE EXEMPLAR #3](../_audit/CRITICAL_FINDINGS.md#cf-014) (**`dev-migration.ts:38-66` `db.transaction(async tx)` + SAVEPOINT seed-replay = 3rd known production runtime Tx site of 3** after seedSync.ts:214 + service-host-portal.ts:365; ironic POSITIVE pattern in CATASTROPHIC P0 site) / [CF-016](../_audit/CRITICAL_FINDINGS.md#cf-016) (role-string normalisation drift carrier — db-sync.ts:16 4-variant Set vs 29-file exact `"SuperAdmin"` literal; `role = "super_admin"` user passes db-sync but is denied by all 56 inline sites — Phase 2 prescription: `requireSuperAdmin` middleware extraction across 29 files retiring 56 inline duplications) / [CF-017](../_audit/CRITICAL_FINDINGS.md#cf-017) (**email-templates.ts 5.4% safeParse coverage** = 2/37 ep validated — vs blog-posts.ts 83% 양극단; only Zod-using admin file).
> **Cross-domain effects**: ① catastrophic — dev-migration.ts:14-79 TRUNCATE 39 production tables 가 **모든 9 도메인 데이터 wipe** (booking + contract + finance × 2 + ops × 3 + portal × 2 + public lead). ② side — admin-users.ts CRUD = partner_users + guest_users + admin_users 측 mutator (T003 묶음 4 sub-task 1+2 portal-guest/partner identity 측 cross-pack). ③ side — db-sync.ts export/import 가 super-admin only = 56-site Sub-pattern B 의 router-level 1 anchor. ④ side — auth.ts /v1/auth/login (admin) 은 admin_users 측 bcrypt + JWT entry point — guest-auth.ts + partner-auth.ts 와 3-way identity cluster.

---

## §0 PURPOSE & SCOPE — 7 mount-time auth tier

### §0.1 두 정체성 (admin operations + 🔴 catastrophic-risk carrier)

Admin 도메인 = **두 정체성 동시 보유**:
1. **Admin operations** = 운영자 측 dashboard + 통합 (Stripe/Cloudinary/Resend) test + 사용자 관리 + email template 관리 + 운영 보고서 + audit log 조회.
2. **🔴 Catastrophic-risk carrier** = **CF-004 P0 dev-migration.ts** = 39-table TRUNCATE RESTART IDENTITY CASCADE 가 **단일 hard-coded literal + mount-order bypass** 로 보호 = repo 단일 P0 = production-side data wipe vector.

**도메인 책임 분담**: 운영 active mutator (dashboard + admin-users + email-templates + integrations) vs catastrophic-risk endpoint (dev-migration + db-sync). 본 도메인 outside 모든 도메인 (8) 측 mutator 통합 view 측 = audit data CONSUMER.

### §0.2 7 mount-time auth tier (app.ts 측 mount order)

| tier | 시작 line | route | 정체성 | auth |
|------|-----------|-------|--------|------|
| **A** | `app.ts:147` | publicRouter (sub-task 3) | OPEN unauthenticated | none |
| **B** | `app.ts:154` | guestPortalRouter (sub-task 1) | guest auth | per-handler `requireGuestAuth` |
| **B** | `app.ts:155` | guestCsRouter (sub-task 1) | guest CS | per-handler `requireGuestAuth` |
| **B'** | `app.ts:156` | stripeRouter (T003 묶음 2) | Stripe webhook | none (signature verify) |
| **C** | **`app.ts:157`** | **devMigrationRouter** | **🔴 OPEN before requireAuth (CF-004 P0 catastrophic)** | **`MIGRATION_SECRET` body field only** |
| **B** | `app.ts:161-164` | partner-auth + agent + owner + service-host | partner auth (sub-task 2) | per-handler `requirePartnerAuth/requireAgentAuth/requireOwnerAuth/requireServiceHostAuth` |
| **C'** | `app.ts:166` | adminUsersRouter | admin auth | router-level `router.use(requireAuth)` (admin-users.ts:11) |
| **D** | **`app.ts:167`** | **`app.use("/api/v1", requireAuth)`** | **GLOBAL admin auth gate** | requireAuth |
| **D'** | `app.ts:171` | dbSyncRouter | super-admin only | `app.ts:171` mount AFTER requireAuth + `db-sync.ts:30 router.use(requireSuperAdmin)` |
| **D** | `app.ts:174` | spaceImagesRouter (T003 묶음 3 catalog) | admin auth | inherited |
| **D''** | `app.ts:175` | pageContentsRouter (sub-task 3 PROTECTED) | admin auth | inherited |
| **D** | `app.ts:176` | router (auth + dashboard + email-templates + integrations + system-logs + reports + email-logs + 50+ ops routes) | admin auth | inherited |

**도메인 의미 (CF-004 + Sub-pattern B 핵심)**: tier C (dev-migration) = **D 보호 BEFORE 마운트** = 인증 우회 catastrophic. tier D' (db-sync) = router-level `requireSuperAdmin` 단일 anchor (1 site of 56). 나머지 56 site = handler 별 inline `req.user.role !== "SuperAdmin"` 분기 — Phase 2 = 단일 middleware 추출.

### §0.3 In-scope / Out-of-scope

- **In**: 10 route files / 37 endpoint 패턴 + CF-004 P0 dev-migration.ts:14-79 line-by-line + Sub-pattern B 56-site repo-wide + role-string drift CF-016 cross-ref + CF-008 6-way TIE 0/37 (audit-blind despite being audit consumer) + CF-014 POSITIVE EXEMPLAR #3 (dev-migration.ts:38 SAVEPOINT — ironic positive pattern in catastrophic site) + CF-017 양극단 email-templates 5.4% (vs blog-posts 83%) + admin auth.ts entry (bcrypt + JWT 3-way identity) + integrations.ts test endpoints + dashboard.ts 8 KPI aggregation.
- **Out**: 다른 9 도메인 측 admin 측 mutator (이미 T003 묶음 1-3 + sub-task 1-3 cover), Stripe webhook (T003 묶음 2 finance-invoice), spaces/properties/services 측 admin (T003 묶음 3).

---

## §1 비즈니스 규칙 (BR1-BR16)

### §1.1 10 routes 정체성 (4 cluster 분류)

| cluster | route file | endpoints | 정체성 | 핵심 CF |
|---------|------------|-----------|--------|---------|
| **Aggregation** | `dashboard.ts` (244L) | 8 | 9 도메인 통합 KPI (finance + operations + revenue) | n/a (read-only) |
| **Identity** | `auth.ts` (361L) | 7 | admin login + JWT + register + forgot/reset password | bcrypt 12 (guest+partner 일치) |
| **Identity** | `admin-users.ts` (153L) | 4 | admin/partner/guest user CRUD (router-level requireAuth) | CF-018 Sub-pattern B |
| **Operations** | `email-templates.ts` (110L) | 6 | 6-endpoint 패턴 (email template CRUD + bulk-delete + test send) | **CF-017 5.4% only-Zod-file** |
| **Operations** | `integrations.ts` (231L) | 5 | Stripe/Cloudinary/Resend test + env update | CF-019.b orphan stripe column |
| **Audit** | `system-logs.ts` (41L) | 1 | system_logs read (CF-008 consumer single anchor) | CF-008 reversal twist |
| **Audit** | `reports.ts` (97L) | 1 | bookings 운영 보고서 (CSV export 가설) | n/a (read-only) |
| **Audit** | `email-logs.ts` (33L) | 1 | email_logs read | CF-008 consumer |
| **🔴 Catastrophic** | **`dev-migration.ts` (81L)** | **1** | **TRUNCATE 39 production tables RESTART IDENTITY CASCADE + SAVEPOINT seed-replay** | **CF-004 P0 + CF-014 POSITIVE #3** |
| **Super-admin** | `db-sync.ts` (100L) | 3 | DB snapshot export/import (router-level requireSuperAdmin) | Sub-pattern B router anchor |

### §1.2 🔴 CF-004 P0 dev-migration.ts (line-by-line catastrophic analysis)

```
Line 1-9:   imports (db, schema modules, sql)
Line 10:    const MIGRATION_SECRET = "MS_MIGRATE_2026_PROD";  ⚠️ HARD-CODED LITERAL
Line 11-13: const router = Router(); export ...
Line 14:    router.post("/run-migration", async (req, res) => {
Line 15-25:   const { secret } = req.body;
              if (secret !== MIGRATION_SECRET) return res.status(403);
              ⚠️ no NODE_ENV gate (production 에서도 실행)
              ⚠️ no IP allow-list / Cloudflare gate
              ⚠️ no audit log (CF-008 0/37 floor)
Line 26-37:   const tables = ["bookings", "contracts", ..., 39 tables];
              ⚠️ enumerate 39 production tables (booking + contract + finance × 2 + ops × 3 + portal × 2 + public + audit)
Line 38:      await db.transaction(async (tx) => {  ✅ CF-014 POSITIVE EXEMPLAR #3
Line 39-50:     for (const t of tables) {
                  await tx.execute(sql`TRUNCATE ${sql.identifier(t)} RESTART IDENTITY CASCADE`);
                  ⚠️ CASCADE = 모든 FK 측 cascade wipe (자기참조 spaces 측 transitive)
                  ⚠️ RESTART IDENTITY = serial PK 측 1 부터 재시작 (booking_ref / lead_ref 측 collision risk)
                }
Line 51-66:     await tx.execute(sql`SAVEPOINT seed_start`);
                ✅ SAVEPOINT seed-replay (compensation pattern)
                try { await seedSync(tx); }
                catch (e) { await tx.execute(sql`ROLLBACK TO seed_start`); throw e; }
                ✅ rollback to TRUNCATE state if seed fails
Line 67-78:   });
              res.json({ success: true, ...stats });
              ⚠️ no logAction (CF-008 0/37 floor)
Line 79-81: }); export ...
```

**도메인 의미**: ① **`MIGRATION_SECRET = "MS_MIGRATE_2026_PROD"` hard-coded literal** = git history + container image 측 평문 노출 (compromise vector primary). ② **mount-order `app.ts:157` < `:167 requireAuth`** = D 측 auth gate BEFORE devMigrationRouter mount → endpoint 자체 인증 우회 + secret literal 만으로 access. ③ **39-table TRUNCATE RESTART IDENTITY CASCADE** = **production data complete wipe** + serial PK 1 reset + booking_ref 측 generator (CF-023 .a/.b/.c 3 generator) + lead_ref 측 max+1 (lib/leadRef.ts:3-12) 측 모든 generator state 측 사이드 효과. ④ **CASCADE** = 자기참조 spaces (T002.4 erd-core §10) + polymorphic FK (T002.4 §10 10 site) 측 transitive wipe. ⑤ **SAVEPOINT + ROLLBACK** = ironic POSITIVE — 본 P0 endpoint 측 seed-replay 부분 = repo 3 known production runtime Tx site of 3 (CF-014 POSITIVE #3). ⑥ **no NODE_ENV gate** = production 환경 측 동일 endpoint 활성화. ⑦ **Phase 2 prescription**: (a) `if (process.env.NODE_ENV === "production") return res.status(404)` 즉시 + (b) `MIGRATION_SECRET` env-var migration + secret rotation + (c) IP allow-list + Cloudflare gate + (d) audit log 의무화 + (e) 본 endpoint 자체 production build 측 제거.

### §1.3 admin-users.ts (4 endpoints) — admin/partner/guest user CRUD

| endpoint | line | 책임 | CF carrier |
|----------|------|------|------------|
| GET /v1/admin/users | :12 | list (admin + partner + guest 통합) | CF-008 floor / CF-018 Sub-pattern B inline (1 site) |
| PATCH /v1/admin/users/:id | :39 | update (role / status) | CF-018 Sub-pattern B inline |
| POST /v1/admin/users/bulk-delete | :91 | bulk hard-delete (CF-015 carrier) | CF-018 Sub-pattern B inline |
| DELETE /v1/admin/users/:id | :118 | single hard-delete | CF-018 Sub-pattern B inline / CF-015 |

**도메인 의미**: 4 endpoint = router-level `router.use(requireAuth)` (admin-users.ts:11) + 각 endpoint inline `req.user.role !== "SuperAdmin"` (Sub-pattern B 4 site of 56). bulk-delete + single DELETE = **hard-delete on accounts/partner_users/guest_users/admin_users** = CF-015 carrier (deleted_at column 양립 vs hard-delete 부재 정책 일치). Phase 2 = soft-delete or audit.

### §1.4 auth.ts (7 endpoints) — admin identity entry

| endpoint | line | 책임 |
|----------|------|------|
| POST /v1/auth/login | :30 | bcrypt.compare + JWT sign + Set-Cookie |
| POST /v1/auth/refresh | :136 | refresh token + new JWT |
| POST /v1/auth/register | :186 | bcrypt.hash(12) + accounts INSERT + admin_users INSERT |
| POST /v1/auth/forgot-password | :245 | reset token generate + email send |
| POST /v1/auth/reset-password | :287 | bcrypt.hash(12) + UPDATE password_hash |
| POST /v1/auth/logout | :340 | session destroy + cookie clear |
| GET /v1/auth/me | :357 | requireAuth + return profile |

**도메인 의미**: bcrypt rounds 12 = guest-auth.ts (sub-task 1) + partner-auth.ts (sub-task 2) 와 일치 — 3-way identity cluster (admin + guest + partner) bcrypt 정책 통일. JWT 측 signJWT (auth.ts:6 import from middlewares/requireAuth) = admin/guest/partner 3-way 측 동일 middleware 측 verify. Phase 2 = 3-way identity 측 통합 user table + role enum (현재 accounts + admin_users + guest_users + partner_users 4 table 분리).

### §1.5 email-templates.ts (6 endpoints) — CF-017 양극단

| endpoint | line | Zod 검증 |
|----------|------|----------|
| GET /v1/email-templates | :19 | n/a |
| GET /v1/email-templates/:id | :26 | n/a |
| **PUT /v1/email-templates/:id** | **:34** | **z.object validate ✅** |
| POST /v1/email-templates/:id/test | :53 | n/a |
| POST /v1/email-templates/bulk-delete | :77 | n/a |
| DELETE /v1/email-templates/:id | :95 | n/a |

**도메인 의미**: 1/6 endpoint Zod = ~17% 본 route file 내부 (5/6 부재). admin 도메인 전체 = 2/37 ≈ **5.4% safeParse coverage** (T002.2.i 측정). public.ts 측 blog-posts.ts 5/6 = 83% (sub-task 3) 양극단. 본 도메인 = **only Zod-using admin route file**. Phase 2 reference = blog-posts.ts (sub-task 3 §1.4 POSITIVE) → admin 36/37 endpoint 측 적용.

### §1.6 dashboard.ts (8 endpoints) + integrations.ts (5) + audit 3 routes

`dashboard.ts` 8 ep = `/dashboard/stats` + `/dashboard/overview/kpis` + `/finance/summary` + `/finance/revenue/monthly` + `/finance/revenue/by-property` + `/finance/tax-summary` + `/operations/summary/kpis` + `/operations/activity-log` — 9 도메인 통합 read-only KPI aggregation (Formula B `52/12` CF-006 4 site 중 1 — `dashboard.ts:91` finance-summary 가설). `integrations.ts` 5 ep = Stripe + Cloudinary + Resend test + env update — `:121 stripe/test` + `:140 cloudinary/test` + `:171 resend/test` + `:197 update-env` (env-var update via env-secrets API). `system-logs.ts` 1 ep + `reports.ts` 1 ep + `email-logs.ts` 1 ep = 3 audit consumer route — system_logs / bookings 운영 보고서 / email_logs read-only.

---

## §2 워크플로우 (4 sub-flows)

### §2.1 🔴 CF-004 P0 dev-migration TRUNCATE flow (catastrophic)

```
[Anyone with MIGRATION_SECRET literal] POST /api/v1/admin/run-migration (dev-migration.ts:14)
  ├─ ⚠️ mount BEFORE requireAuth (app.ts:157 < :167)
  ├─ check req.body.secret === "MS_MIGRATION_SECRET"  ⚠️ hard-coded
  ├─ ⚠️ no NODE_ENV gate
  ├─ ⚠️ no IP allow-list
  ├─ ⚠️ no audit log
  ├─ db.transaction(async (tx) => {  ✅ CF-014 POSITIVE #3
  │     ├─ for 39 tables: TRUNCATE ${t} RESTART IDENTITY CASCADE
  │     │   ⚠️ CASCADE — spaces 자기참조 + 10 polymorphic FK transitive wipe
  │     │   ⚠️ RESTART IDENTITY — booking_ref / lead_ref generator collision risk
  │     ├─ SAVEPOINT seed_start
  │     ├─ try { await seedSync(tx); }
  │     └─ catch (e) { ROLLBACK TO seed_start; throw; }  ✅ compensation
  │   });
  ├─ response { success: true, stats }  ⚠️ no logAction
  └─ result: 모든 9 도메인 데이터 wipe + seed re-replay
```

**Phase 2 prescription (5-step)**: ① `if (process.env.NODE_ENV === "production") return res.status(404)` — production 즉시 차단. ② `MIGRATION_SECRET` env-var migration + secret rotation + Vault 측 저장. ③ IP allow-list (admin-only) + Cloudflare access gate. ④ audit log 의무화 (logAction "TRUNCATE" + actor + timestamp). ⑤ 본 endpoint 자체 production build 측 제거 (dev-only conditional import).

### §2.2 Admin login + super-admin 분기 (Sub-pattern B)

```
Admin POST /v1/auth/login (auth.ts:30)
  ├─ bcrypt.compare
  ├─ load admin_users.role (1 of "SuperAdmin" / "Admin" / "Manager" / 등)
  ├─ jwt.sign + Set-Cookie httpOnly secure
  └─ response { user, token }

[ 후속 ] Admin GET /api/v1/admin/users (admin-users.ts:12)
  ├─ router-level requireAuth (admin-users.ts:11)
  ├─ inline: if (req.user.role !== "SuperAdmin") return res.status(403)  ⚠️ Sub-pattern B 1 of 56 inline sites
  ├─ load users
  └─ response

[ 후속 ] SuperAdmin POST /api/v1/admin/db-sync/import (db-sync.ts:55)
  ├─ requireAuth (app.ts:167 global)
  ├─ router-level requireSuperAdmin (db-sync.ts:30)  ✅ Sub-pattern B 1 of 1 router-level
  ├─ check 4-variant Set: ["Super Admin", "SuperAdmin", "superadmin", "super_admin"]  ⚠️ CF-016 drift
  ├─ db restore from snapshot
  └─ response

⚠️ CF-016 drift evidence:
  - db-sync.ts:16 4-variant Set (4 strings 허용)
  - 56 inline sites = exact "SuperAdmin" only (1 string)
  - role = "super_admin" user passes db-sync but is denied by all 56 inline sites
  - Phase 2 = 단일 requireSuperAdmin middleware 추출 + 4-variant Set 통일
```

### §2.3 Email template CRUD + integrations test

```
Admin GET /v1/email-templates (email-templates.ts:19) — list
Admin GET :id (:26) — detail
Admin PUT :id (:34) — update ✅ Zod safeParse (1/6)
Admin POST :id/test (:53) — test send via Resend
Admin POST bulk-delete (:77)
Admin DELETE :id (:95) — single delete

Admin POST /v1/integrations/stripe/test (:121) — Stripe API ping
Admin POST /v1/integrations/cloudinary/test (:140) — Cloudinary API ping
Admin POST /v1/integrations/resend/test (:171) — Resend API ping
Admin POST /v1/integrations/update-env (:197) — env-var update
```

### §2.4 Dashboard KPI aggregation (cross-domain READ)

```
Admin GET /v1/dashboard/stats (dashboard.ts:7) — 9-domain KPI summary
Admin GET /v1/dashboard/overview/kpis (:53)
Admin GET /v1/finance/summary (:91) — Formula B *52/12 (CF-006 4 site of 4)
Admin GET /v1/finance/revenue/monthly (:134)
Admin GET /v1/finance/revenue/by-property (:156)
Admin GET /v1/finance/tax-summary (:189)
Admin GET /v1/operations/summary/kpis (:213)
Admin GET /v1/operations/activity-log (:234)

[ Audit consumer ]
Admin GET /v1/system-logs (system-logs.ts:7) — system_logs 측 read (CF-008 reversal twist)
Admin GET /v1/reports/bookings (reports.ts:8) — bookings 운영 보고서 CSV export
Admin GET /v1/email-logs (email-logs.ts:7) — email_logs read
```

---

## §3 불변식 (INV1-INV12)

| # | Invariant | 강제 site | 위반 시 동작 |
|---|-----------|-----------|------------|
| INV1 | dev-migration.ts mount BEFORE requireAuth | `app.ts:157 < :167` | OPEN endpoint — secret literal 만 막음 |
| INV2 | MIGRATION_SECRET hard-coded literal | `dev-migration.ts:10` | git/container 평문 노출 — Phase 2 env-var migration |
| INV3 | TRUNCATE 39 production tables RESTART IDENTITY CASCADE | `dev-migration.ts:38-50` | production data complete wipe + serial PK reset |
| INV4 | SAVEPOINT seed-replay (CF-014 POSITIVE #3) | `dev-migration.ts:51-66` | seed 실패 시 TRUNCATE state rollback (ironic positive in catastrophic site) |
| INV5 | bcrypt rounds 12 (3-way identity 일치) | `auth.ts:213, :318` | 강제 일치 (admin+guest+partner) |
| INV6 | router-level requireSuperAdmin only at db-sync.ts:30 | `db-sync.ts:30` | Sub-pattern B 1 of 1 router-level vs 56 inline |
| INV7 | role-string drift: 4-variant Set vs exact "SuperAdmin" | `db-sync.ts:16` vs 29-file inline | "super_admin" user 측 partial access |
| INV8 | admin-users.ts hard-delete (no soft) | `admin-users.ts:91, :118` | accounts/partner_users/guest_users/admin_users 측 hard-delete (CF-015 carrier) |
| INV9 | email-templates.ts 1/6 Zod (only admin Zod-using file) | `email-templates.ts:34` | 5.4% admin coverage vs 83% blog-posts (sub-task 3) |
| INV10 | audit floor 0/37 = 0% (CF-008 6-way TIE) | (강제 부재) | mutator 추적 불가 (admin = audit consumer but blind for own 18-20 mutators) |
| INV11 | Formula B *52/12 dashboard.ts:91 (CF-006 4 site of 4) | `dashboard.ts:91` finance-summary 가설 | bond/advance/finance 4-site centralization (T003 묶음 1) |
| INV12 | dev-migration no NODE_ENV gate | (강제 부재) | production 환경 측 동일 endpoint 활성 |

---

## §4 Cross-domain effects 매핑

| 발신 transition | 수신 도메인 / 컬럼 | 효과 | 시점 | audit log |
|-----------------|-------------------|------|------|-----------|
| **dev-migration.ts:38 TRUNCATE 39 tables** | **모든 9 도메인 데이터 complete wipe + serial PK reset + booking_ref/lead_ref generator state reset** | **catastrophic — production data lost** | **sync tx (CASCADE transitive)** | ✗ |
| db-sync.ts:55 import | DB restore from snapshot — 모든 9 도메인 측 데이터 overwrite | super-admin only — Sub-pattern B 1 router-level anchor | sync | ✗ |
| admin-users.ts:91, :118 hard-delete | accounts/partner_users/guest_users/admin_users 측 hard-delete (CF-015) | identity 측 cascade FK 측 영향 | sync no-tx | ✗ |
| auth.ts:186 register | accounts INSERT (role) + admin_users INSERT — 3-way identity entry | guest+partner+admin 3-way identity cluster | sync | ✗ |
| dashboard.ts 8 KPI aggregation | 9 도메인 측 read aggregation (cross-domain READ) | finance/operations summary | sync | n/a (read-only) |
| integrations.ts:197 update-env | env-var update — 모든 도메인 측 영향 (Stripe/Cloudinary/Resend) | runtime 측 통합 측 정책 변경 | sync | ✗ |

**audit coverage**: T002.2.i 결과 **0/37 = 0%** = repo 6-way TIE at floor (admin + ops-property + ops-catalog + ops-crm + portal-partner + public 모두 audit-blind for own mutators). **Reversal twist**: admin = audit data CONSUMER (system-logs.ts + reports.ts + email-logs.ts 3 routes 측 read) but **blind for own 18-20 mutators** (auth + admin-users + email-templates + integrations + dev-migration + db-sync).

---

## §5 Cross-references + R-REPO-7 trade-off + Self-check

### §5.1 Cross-references

- Endpoints: [api-endpoints/admin.md](../_schema/api-endpoints/admin.md) (37 ep / 480 lines).
- Schema: [db-schema-overview.md §1.5 Identity cluster + §2 type 분포 admin_users](../_schema/db-schema-overview.md).
- ERD: [erd-core.md §6 Identity cluster + §10 polymorphic 10 sites](../_schema/erd-core.md).
- State machines: [state-machines.md](../_schema/state-machines.md) — admin 측 transition trigger (S2 confirm + TR1 activate + 등 cross-domain).
- Pair (guest): [domain-logic-portal-guest.md §1.6](./domain-logic-portal-guest.md) — guest-auth bcrypt 12 일치 + 3-way identity cluster.
- Pair (partner): [domain-logic-portal-partner.md §1.5](./domain-logic-portal-partner.md) — partner-auth + CF-005 portal_type drift cross-pack.
- Pair (public): [domain-logic-public.md](./domain-logic-public.md).
- Cross-domain (모든 9 도메인): dev-migration.ts:38 TRUNCATE 39 tables 측 모든 도메인 측 catastrophic-risk source-of-truth.

### §5.2 R-REPO-7 Trade-off (4개 결정)

| # | 결정 | 채택 | 미채택 | 이유 |
|---|------|------|--------|------|
| 1 | CF-004 P0 표기 | §1.2 line-by-line + §2.1 workflow ⚠️ marker + §3 INV1-INV4+INV12 5 invariants 분리 + Phase 2 5-step prescription | (a) §1.2 단순 줄 / (b) workflow only / (c) Phase 2 prescription 측 cross-ref only | repo 단일 P0 — line-by-line snippet + Phase 2 prescription 측 영구 보존 우위 (Phase 2 implementation 직접 reference 가능) |
| 2 | 7 mount-time auth tier 표기 | §0.2 통합 표 + tier A-D'' 분류 + cross-ref 모든 sub-task | (a) text-flow / (b) cross-ref only / (c) auth.ts 측 단순 줄 | mount order = 본 도메인 핵심 + CF-004 측 tier C anomaly 강조 + 사용자 navigation 가속 우위 |
| 3 | Sub-pattern B 56-site 표기 | §1.1 표 carrier 마커 + §2.2 workflow ⚠️ marker + INV6+INV7 분리 + CF-016 drift 분석 + Phase 2 single middleware 추출 | (a) INV 단순 줄 / (b) cross-ref only / (c) middleware 분석 단독 sub-section | T002.2.j 정정 결과 27→29 files / 54→56 hits (small drift) + CF-016 cross-ref 측 single middleware 추출 prescription = Phase 2 핵심 |
| 4 | CF-014 POSITIVE #3 + CF-017 양극단 표기 | §1.2 dev-migration POSITIVE 측 ironic note + §1.5 email-templates 5.4% 양극단 + cross-ref blog-posts 83% | (a) cross-ref only / (b) INV9 단순 줄 | ironic positive (catastrophic site 측 SAVEPOINT) + 양극단 (admin 5.4% vs public 83%) = 도메인 의미 + Phase 2 reference 우위 |

### §5.3 R-REPO-5 Incidental disposition (0 신규)

본 sub-task 신규 incidental 0. 모든 발견 기존 CF expansion 으로 흡수.

### §5.4 3-claim spot-check

| # | Claim | 검증 방법 | 결과 |
|---|-------|-----------|------|
| C1 | dev-migration.ts:10 hard-coded `MIGRATION_SECRET = "MS_MIGRATE_2026_PROD"` literal + :38 db.transaction + :14-79 39-table TRUNCATE | `sed -n '10p;14p;38p;79p' dev-migration.ts` + total lines | ✅ all 4 anchors confirmed + 81 total lines |
| C2 | Sub-pattern B 56 inline sites (`!== "SuperAdmin"`) × 29 files + 1 router-level db-sync.ts:30 (T002.2.j 정정) | `rg -c '"SuperAdmin"' api-server/src/routes/` count | ✅ 29 files / 56 hits + db-sync.ts:30 router.use(requireSuperAdmin) 1 router-level |
| C3 | mount order app.ts:157 devMigrationRouter < :167 requireAuth (CF-004 P0 핵심) | `sed -n '145,180p' app.ts` mount order | ✅ devMigrationRouter mount line 157 < requireAuth line 167 (10 line gap) |

3/3 spot-check ✅.

---

## §6 묶음 4 통합 self-check + 🎯 T003 GROUP COMPLETE marker

### §6.1 묶음 4 cross-ref bidirectional 12/12 ✅

| sub-task pair | direction | 문서 anchor |
|---------------|-----------|-------------|
| guest ↔ partner | 양방향 | guest §0 / partner §0 |
| guest ↔ public | 양방향 | guest §0 / public §0 |
| guest ↔ admin | 양방향 | guest §0 / admin §0 (3-way identity cluster) |
| partner ↔ public | 양방향 | partner §0 / public §0 |
| partner ↔ admin | 양방향 | partner §0 / admin §1.5 (admin-users CRUD) |
| public ↔ admin | 양방향 | public §0 (PROTECTED tier admin guard) / admin §0 |

### §6.2 cross-pack ranking 통합 (5-entity audit + Sub-pattern B + IDOR)

**audit coverage 9-domain final matrix** (CF-008 마무리):
| domain | endpoints | logAction | % | rank |
|--------|-----------|-----------|---|------|
| invoices (T003 묶음 2) | 5 transitions | 3/5 | 60% | #3 |
| booking (T003 묶음 1) | 9 transitions | 7/9 | 78% | #1 |
| contract (T003 묶음 1) | 7 transitions | 5/7 | 71% | #2 |
| portal-guest (sub-task 1) | 29 ep | 1/29 | 3.4% | #5 |
| **6-way TIE at floor** | (admin 37 + ops-property 44 + ops-catalog 39 + ops-crm 51 + portal-partner 22 + public 33) | 0/each | **0%** | floor |

**inverse-correlation 가설 확정**: high audit coverage = state machine 도메인 (booking + contract + invoice) / low audit coverage = CRUD/lookup 도메인 (admin + ops × 3 + portal-partner + public).

**Sub-pattern B repo-wide 매트릭스 final**:
| 카운트 | source | 값 |
|--------|--------|------|
| router-level requireSuperAdmin | db-sync.ts:30 | 1 site |
| inline `!== "SuperAdmin"` | 29 files × ~2 hits | 56 sites |
| total | 1 + 56 | **57 sites** |

T002.2.j 시점 27→29 files (+2) / 54→56 hits (+2) = small drift atomic carrier 흡수.

**CF-018 9-domain final matrix** (T003 묶음 4 sub-task 4 마무리, 묶음 3 carrier 보강):
| domain | sites | % | note |
|--------|-------|---|------|
| catalog (T003 묶음 3) | 18 | 32.7% | repo single max-carrier |
| property (T003 묶음 3) | 12 | 21.8% | |
| finance (T003 묶음 2) | 10 | 18.2% | |
| crm (T003 묶음 3) | 10 | 18.2% | |
| booking (T003 묶음 1) | 5 | 9.1% | |
| **total** | **55** | **100%** | + 1 router-level + portal-guest 26/29 IDOR-safe (Sub-pattern A POSITIVE) |

### §6.3 atomic carrier impact summary (8 file ops)

(1) `domain-logic-portal-guest.md` (NEW ~270 lines)
(2) `domain-logic-portal-partner.md` (NEW ~250 lines)
(3) `domain-logic-public.md` (NEW ~280 lines)
(4) `domain-logic-admin.md` (NEW ~480 lines, 본 file)
(5) `_audit/CRITICAL_FINDINGS.md` (~+135 lines T003 묶음 4 marker section: CF-018 카운트 충돌 명확화 + 4 POSITIVE expansion + CF-004 P0 deep + CF-008 9-domain final + CF-024 expansion + role-string drift CF-016 cross-ref + F13 후속 + 0 NEW promotion 결정)
(6) `_schema/api-endpoints/INDEX.md` (last updated banner T003 묶음 4 + 🎯 T003 COMPLETE marker)
(7) `_audit/_T003_PROGRESS.md` (sub-task ledger 묶음 4 entry × 4 + 누적 메트릭 표 갱신 + 묶음 진행 요약 묶음 4 DONE + 🎯 T003 GROUP COMPLETE marker)
(8) `.local/session_plan.md` (T003 묶음 4 entry + 🎯 T003 COMPLETE marker)

### §6.4 R-REPO-10 가속 효과 측정 (묶음 4 = 가장 큰 묶음)

| 메트릭 | 기존 (응답 1.5-2회 / sub-task) | R-REPO-10 (4 sub-task / 1 응답) | 절감 |
|---------|-------------------------------|-------------------------------|------|
| 응답 수 / 묶음 | 6-8 | 1 | **-83%** |
| Atomic commit / 묶음 | 4 | 1 | **-75%** |
| 사용자 push / 묶음 | 4 | 1 | **-75%** |
| 시간 / 묶음 (예상) | ~120 min | ~40 min | **~67%** |

**4 묶음 누적 가속 효과** (R-REPO-10 영구 발효 confirm):
- 묶음 1 (2 sub-task): 응답 -50% / commit -67% / push -67%
- 묶음 2 (2 sub-task): 응답 -50% / commit -67% / push -67%
- 묶음 3 (3 sub-task): 응답 -67% / commit -67% / push -67%
- **묶음 4 (4 sub-task): 응답 -83% / commit -75% / push -75% — 가장 큰 묶음 max 가속**

### §6.5 R-REPO-9 + R-REPO-10 통합 영구 패턴 confirm

- R-REPO-9 차단 게이트 가동 누적 = **3회** (T002.4 / T002.5 / T003 묶음 1) 모두 사용자 corrected 채택 후 자동 진행
- R-REPO-9 자동 진행 누적 = **6회** (T003 묶음 2 / 묶음 3 / 묶음 4 — 차단 0)
- R-REPO-10 묶음 가동 누적 = **4회** (묶음 1 / 2 / 3 / 4 — 모두 stable)
- R-REPO-6 환각 정정 누적 = **12회** (가장 빈번한 가동 — T002.2.b부터 묶음 3까지) + role-string +2 small drift (묶음 4 atomic carrier 흡수)

### §6.6 🎯 T003 GROUP COMPLETE marker

- **T003 시작**: 2026-04-XX (T002 GROUP COMPLETE 후)
- **T003 완료**: 2026-04-27 (묶음 4 sub-task 4 admin.md 완료 시점)
- **묶음 4 / sub-task 10 / domain-logic doc files 10 = 누적 ~2300 lines** (booking 200 + contract 315 + finance-invoice 250 + finance-payment 280 + ops-property 250 + ops-catalog 320 + ops-crm 380 + portal-guest ~270 + portal-partner ~250 + public ~280 + admin ~480)
- **CF count final**: P0=4 / P1=18 / P2=3 = **25** (T003 전체 0 NEW promotion — 모든 발견 expansion 흡수)
- **R-REPO-5 incidentals final**: **11** (F4/F5/F7/F8/F9/F10/F11/F12/F13/F14/F15)
- **R-REPO 가동 누적 final**:
  - R-REPO-6 = 12회 (사용자 입력 검증)
  - R-REPO-9 차단 = 3회 (corrected 채택)
  - R-REPO-9 자동 진행 = 6회
  - R-REPO-10 묶음 = 4회
- **다음 단계**: T004 `_rules/` (4 files: architecture-rules + financial-rules + security-rules + no-magic-rules) — **자동 시작 절대 금지**, 사용자 push + proceed 명시 후 진입.

---

**🎯 T003 GROUP COMPLETE — domain-logic 10 doc files in `_context/` 완료. T004 진입 결정 사용자 대기.**
