# Security Rules

> **T004 REWRITE** 2026-04-27 — T001 (100L NEEDS REVISION) 기반 + T002+T003 자산 통합.
> **T001 시점 한계**: CF-004 P0 dev-migration line-by-line / CF-016 role-string drift / CF-017 Zod 5.4%-83% 양극단 / CF-018 IDOR Sub-pattern A+B 57 sites / CF-024 rate limiting absence 모두 미발견.
> **Source**: `_schema/api-endpoints/admin.md` + `portal-{guest,partner}.md` + `public.md` + `booking.md` §6 / `_context/domain-logic-{portal-guest,portal-partner,public,admin}.md`.

---

## §1. IDOR defense (CF-018 POSITIVE EXEMPLAR — guest-portal)

### 1.1 Sole-owner guard pattern (canonical exemplar)

`guest-portal.ts E20` (booking detail) compound WHERE:

```ts
WHERE bookings.id = :bookingId AND bookings.account_id = :sessionAccountId
```

**핵심 패턴**: account_id × resource_id 동시 검증 = sole-owner enforcement. 5 sites in guest-portal (T003 묶음 4 발견).

### 1.2 Phase 2 reference

모든 nested-write handler:
```ts
WHERE :nestedResourceId AND :parentResourceId IN account_scope
```

**예외 금지**: URL :id 만 사용한 WHERE = IDOR vulnerable.

---

## §2. CF-018 Sub-pattern A — booking-side IDOR

### 2.1 3 BAD sites (`bookings.ts`)

| 사이트 | 코드 패턴 | 위험 |
|--------|----------|------|
| `bookings.ts:572` | `WHERE id = :svcId` only (booking_id 무시) | 다른 booking 의 service 수정/삭제 가능 |
| `bookings.ts:728` | `WHERE id = :docId` only | 다른 booking 의 document 수정 가능 |
| `bookings.ts:735` | `WHERE id = :docId` only | 다른 booking 의 document 삭제 가능 |

### 2.2 2 POSITIVE EXEMPLAR sites

| 사이트 | 패턴 | 핵심 |
|--------|------|------|
| `bookings.ts` N2 (nested service) | `WHERE id = :svcId AND booking_id = :bookingId` | compound — N1 (BAD) 와 동일 파일 |
| `bookings.ts` R6 (read) | compound | "author knew the safe pattern but didn't apply consistently" |

### 2.3 Phase 2 fix scope

3 BAD → compound WHERE 통일. Sub-pattern A booking-side 즉시 hotfix 가능 (3 file:line 정확).

---

## §3. CF-018 Sub-pattern B — vertical privilege (57 sites)

### 3.1 9-domain final matrix (T003 묶음 4 정정)

| Domain | Sites | 비율 |
|--------|-------|------|
| catalog | 18 | 32.7% (max) |
| property | 12 | 21.8% |
| crm | 10 | 18.2% |
| finance | 10 | 18.2% |
| booking | 5 | 9.1% |
| admin (inline) | 1 | 1.8% |
| router-level (`db-sync.ts:30`) | 1 | 1.8% |
| **Total** | **57** | **100%** |

### 3.2 Phase 2 normalize

단일 `requireSuperAdmin` middleware extraction:
```ts
function requireSuperAdmin(req, res, next) {
  if (req.user.role !== "SuperAdmin") return res.status(403).end();
  next();
}
```

→ 57 inline duplications 모두 retire. CF-016 role-string drift 동시 해결 (단일 source).

---

## §4. Role-string drift (CF-016)

### 4.1 Drift 본체

- `db-sync.ts:16` 4-variant Set: `["SuperAdmin","superadmin","super_admin","SUPER_ADMIN"]`
- 29 files inline = exact `"SuperAdmin"` literal × 56 hits

**결과**: `role = "super_admin"` user → db-sync 통과 ✓ + 모든 56 inline 사이트 거부 ✗.

### 4.2 Phase 2 단일 enum

```ts
enum AdminRole { SuperAdmin = "SuperAdmin", Admin = "Admin", SubAdmin = "SubAdmin" }
```

+ DB CHECK constraint + `requireSuperAdmin` middleware (§3.2 cross-ref).

---

## §5. Rate limiting (CF-024 P1)

### 5.1 현재 상태

- `public.ts` 3 unauthenticated POST endpoints (lead create + form submit + …)
- `package.json` `express-rate-limit` 0 hits + `middleware/rateLimit.ts` 부재 + repo-wide grep 0 hits

**위험**: DDoS / spam vector — `leads` table flood 가능.

### 5.2 Phase 2 prescription

- Express: `express-rate-limit` 5 req/min/IP for POST `/api/public/*`
- Phase 2 .NET: `RateLimiter` middleware (FixedWindow / SlidingWindow)
- Cloudflare WAF (운영 layer)

---

## §6. Input validation (CF-017 POSITIVE EXEMPLAR)

### 6.1 양극단

- **Ceiling**: `blog-posts.ts` 5/6 = **83% Zod safeParse coverage** (double-validate B4: `IdParams` + `UpdateBlogPostBody`)
- **Floor**: `admin.md` 도메인 2/37 = **5.4%** (admin email-templates 1/6 = 17% 만 사용)
- Repo baseline: ~12% (T002.2.b 측정)

### 6.2 Phase 2 Zod baseline

모든 mutation route (POST/PUT/PATCH/DELETE):
```ts
const ParsedBody = SchemaName.safeParse(req.body);
if (!ParsedBody.success) return res.status(400).json(ParsedBody.error);
```

+ 모든 `:id` URL param → `IdParams.safeParse(req.params)` (B4 double-validate pattern).

---

## §7. CF-004 P0 dev-migration 5-step (architecture-rules cross-ref)

`/api/dev-migration` = TRUNCATE 39 production tables RESTART IDENTITY CASCADE + SAVEPOINT seed-replay; 보호 = hard-coded `MIGRATION_SECRET = "MS_MIGRATE_2026_PROD"` only; mount `app.ts:157 < :167` + no NODE_ENV gate.

### 5-step (Phase 1 immediate hotfix → Phase 2)

1. **mount-order 정정**: `requireAuth("admin")` mount before all admin routers (architecture-rules §3).
2. **Secret rotation**: `MIGRATION_SECRET` → `process.env.MIGRATION_SECRET` (Replit Secrets) + 즉시 rotate.
3. **NODE_ENV gate**: `if (NODE_ENV === "production") return 404`.
4. **CLI 도구 대체**: `pnpm dev:migrate` script + endpoint 제거.
5. **Endpoint 제거**: `/api/dev-migration` route 삭제.

---

## §8. CF-005 service_host TS type 누락

`partner_users.portal_type` runtime 값 = `"agent"` / `"owner"` / `"service_host"` (3 값) vs TS type 정의 = `"agent" | "owner"` (2 값) → service_host 누락.

**규칙**:
1. TS type 즉시 추가: `"agent" | "owner" | "service_host"`.
2. DB CHECK constraint (3 값 enum) — Phase 2 schema migration.
3. Phase 2 EF Core enum + EFCore.NamingConventions.

---

## §9. Super-admin / admin / sub-admin 분리

### 9.1 현재 (admin.md §0 7 mount-time auth tier)

- A: `requireAuth("admin")` only
- B: A + inline `role !== "SuperAdmin"` (Sub-pattern B 56 inline)
- C: router-level `db-sync.ts:30` super gate
- D″: 7 mount-time tiers 분기

### 9.2 Phase 2 단일 모델

3-role enum (`SuperAdmin` / `Admin` / `SubAdmin`) + middleware chain (`requireAuth("admin")` → `requireRole(SuperAdmin)` 옵셔널).

---

## §10. Audit log 정책 (CF-008 cross-ref)

9-domain final 6-way TIE 0% floor (admin + payment + catalog + property + crm + portal-partner). 75% 도메인 audit-blind.

**규칙**: 모든 mutation route → `logAction(admin_user_id, action, entity_type, entity_id, old_value, new_value)` 의무. Phase 2 Drizzle middleware 또는 EF Core SaveChanges interceptor.

---

## §11. Cross-ref

- `_schema/api-endpoints/admin.md` (CF-004 P0 line-by-line)
- `_schema/api-endpoints/booking.md` §6 (Sub-pattern B 55/57 매트릭스 origin)
- `_context/domain-logic-portal-guest.md` (sole-owner E20)
- `_context/domain-logic-portal-partner.md` (CF-014 POSITIVE + 22/22 IDOR-safe)
- `_context/domain-logic-public.md` (CF-024 carrier + blog-posts 83% ceiling)
- `_context/domain-logic-admin.md` (CF-004 P0 deep dive + 7 auth tier)
- `architecture-rules.md` §2-3 (auth tier + mount-order)
- `financial-rules.md` §4.2 (webhook source state guard)
- `no-magic-rules.md` §3 (role-string magic)

---

## §12. 자가 검증 (3 spot-check ✅)

- **C1** Sub-pattern B 57 sites = catalog 18 + property 12 + finance 10 + crm 10 + booking 5 + admin 1 + router 1 = **57** ✅ (T003 묶음 4 정정 일치)
- **C2** CF-016 role drift = `db-sync.ts:16` 4-variant Set + 29 files inline `"SuperAdmin"` literal × 56 hits ✅
- **C3** CF-024 = `package.json` `express-rate-limit` 0 hits + repo-wide `rateLimit` 0 hits ✅

---

*Last updated: 2026-04-27 (T004 REWRITE — T001 100L NEEDS REVISION → 본 문서 ~280L; CF-004/005/016/017/018/024 anchored).*
