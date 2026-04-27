# Public 도메인 — 비즈니스 규칙 + 워크플로우 + 불변식

> **Sub-task**: T003 묶음 4 sub-task 3 (portal × 2 + public + admin, 분할 (β)). [domain-logic-portal-guest.md](./domain-logic-portal-guest.md) + [domain-logic-portal-partner.md](./domain-logic-portal-partner.md) + [domain-logic-admin.md](./domain-logic-admin.md) 와 짝.
> **Scope**: 6 routes / 1442 lines / **33 endpoints** (사용자 안 일치 ✅) — `public.ts` (881L, 10 ep) + `privacy.ts` (135L, 2 ep) + `health.ts` (28L, 2 ep) + `lookup.ts` (184L, 10 ep) + `blog-posts.ts` (144L, 6 ep) + `page-contents.ts` (70L, 3 ep).
> **Risk**: 🟡 P1 — Triggering findings: [CF-024 P1](../_audit/CRITICAL_FINDINGS.md#cf-024) (**rate-limit absence repo-wide 0 hits — 본 도메인 3 unauthenticated POST `:735 :787 :833` (owner-/agent-/service-host-applications) = DDoS/spam vector primary 표면**; T002.2.h promotion 결과 P1 confirmed) / [CF-023.a CLOSED](../_audit/CRITICAL_FINDINGS.md#cf-023) (T002.2.h verification CLOSED — `lib/leadRef.ts:15-41 insertLeadWithGeneratedRef` safe helper 사용 in `public.ts` 3 application POST + 6-attempt retry on 23505 unique violation; **leads.ts:175-204 /convert sole outlier 확정** — 본 도메인 측 helper-driven INSERT 100% safe vs admin 측 random outlier) / [CF-017 POSITIVE EXEMPLAR](../_audit/CRITICAL_FINDINGS.md#cf-017) (**`blog-posts.ts` 3-schema validation = ListBlogPostsQuery + CreateBlogPostBody + UpdateBlogPostBody = 5/6 = 83% safeParse coverage**; T002.2.h promotion 결과; admin 도메인 측 email-templates.ts 5.4% 와 양극단) / [CF-008](../_audit/CRITICAL_FINDINGS.md#cf-008) (**audit floor 0/33 = 0%** — repo 단일 도메인 max-blind floor; 3 unauthenticated POST 가 lead 측 audit 0 → 보안 사후 추적 불가) / [CF-014 POSITIVE](../_audit/CRITICAL_FINDINGS.md#cf-014) (helper `insertLeadWithGeneratedRef` 측 6-attempt retry on 23505 = race 방지 패턴; SELECT FOR UPDATE 는 아니지만 retry 패턴으로 idempotency 확보).
> **Cross-domain effects**: ① downstream — public.ts 3 application POST → leads INSERT (helper safe) → admin 측 leads.ts /convert 측 funnel cross-pack source (T003 묶음 3 crm CF-023 .a anchor와 비교 reference). ② side — public.ts spaces/properties/services 측 read = ops-property + ops-catalog 측 cross-domain READ (T003 묶음 3). ③ side — blog-posts.ts + page-contents.ts content-side read = guest-portal.ts 측 marketing entry source. ④ side — health.ts mount-time double-mount (`app.ts:150 + routes/index.ts:41 dead-mount` — T002.2.h inconsistency memo).

---

## §0 PURPOSE & SCOPE

### §0.1 두 정체성 (unauthenticated entry + content delivery)

Public 도메인 = **두 정체성 동시 보유**:
1. **Unauthenticated entry** = mount order `app.ts:147` `app.use("/api", publicRouter)` BEFORE `app.use("/api/v1", requireAuth)` (`:167`) → public.ts + privacy.ts + health.ts 모두 인증 우회 + 3 application POST 가 lead INSERT 측 carrier (CF-024 + CF-023.a closed reference).
2. **Content delivery** = lookup.ts (CRUD lookup data) + blog-posts.ts (blog content) + page-contents.ts (CMS-style page content) — 모두 admin 측 mount 후 PROTECTED (admin auth 필요).

**도메인 책임 분담**: OPEN tier (3 file 12 ep — public + privacy + health) = 인증 우회 unauthenticated / PROTECTED tier (3 file 19 ep — lookup + blog-posts + page-contents) = admin 측 content-side CRUD.

### §0.2 In-scope / Out-of-scope

- **In**: 6 route files / 33 endpoint 패턴 + CF-024 P1 promotion ground truth (rate-limit 0 hits) + CF-023.a CLOSED verification (`insertLeadWithGeneratedRef` helper safe pattern) + CF-017 POSITIVE blog-posts 3-schema 분석 + CF-008 audit floor 0/33 (repo max-blind) + helper retry 6-attempt 23505 race 방지 분석 + healthRouter double-mount inconsistency memo.
- **Out**: admin 측 leads.ts /convert (→ T003 묶음 3 crm CF-023 .a anchor sole outlier), admin 측 blog-posts CRUD 가 본 도메인 외 (사실 본 도메인 측 blog-posts.ts 가 admin guard 적용 — admin 측 mount route 측), spaces/properties/services 측 admin (→ T003 묶음 3 ops-property/catalog).

---

## §1 비즈니스 규칙 (BR1-BR12)

### §1.1 6 routes 의 정체성 (2 tier 분류)

| tier | route file | endpoints | 정체성 | mount order | auth |
|------|------------|-----------|--------|-------------|------|
| **OPEN** | `public.ts` (881L) | 10 | 부동산 + 서비스 + blog 공개 read + **3 application POST (lead INSERT carrier)** | `app.ts:147` BEFORE requireAuth | none |
| **OPEN** | `privacy.ts` (135L) | 2 | privacy policy + terms (정적 content) | `app.ts:148` BEFORE requireAuth | none |
| **OPEN** | `health.ts` (28L) | 2 | /health + /health/db (status check) | `app.ts:150` + dead-mount `routes/index.ts:41` | none |
| **PROTECTED** | `lookup.ts` (184L) | 10 | lookup data CRUD (suburbs / categories / 등) | mount AFTER requireAuth | admin |
| **PROTECTED** | `blog-posts.ts` (144L) | 6 | **CF-017 POSITIVE 3-schema validation** | mount AFTER requireAuth | admin |
| **PROTECTED** | `page-contents.ts` (70L) | 3 | CMS-style page content read + admin update | mount AFTER requireAuth | admin |

### §1.2 OPEN tier — public.ts 10 endpoints (CF-024 carrier 핵심)

| endpoint | line | 책임 | CF carrier |
|----------|------|------|------------|
| GET /v1/public/spaces | :45 | spaces list (filter + pagination) | none |
| GET /v1/public/spaces/:id | :314 | space detail (multi-table aggregation) | none |
| GET /v1/public/spaces/:id/availability | :459 | availability calendar | none |
| GET /v1/public/properties | :537 | properties list | none |
| GET /v1/public/services | :581 | services catalog | none |
| GET /v1/public/blog | :697 | blog list | none |
| GET /v1/public/blog/:slug | :722 | blog detail | none |
| **POST /v1/public/owner-applications** | **:735** | **lead INSERT (helper safe)** | **CF-024 + CF-008 + CF-023.a CLOSED** |
| **POST /v1/public/agent-applications** | **:787** | **lead INSERT (helper safe)** | **CF-024 + CF-008** |
| **POST /v1/public/service-host-applications** | **:833** | **lead INSERT (helper safe)** | **CF-024 + CF-008** |

**CF-024 carrier 분석**: 3 unauthenticated POST = DDoS/spam vector primary 표면. `rg "rateLimit\|express-rate-limit" api-server/src/` = **0 hits** (T002.2.h promotion ground truth). `package.json` 측도 0 = `express-rate-limit` 의존성 부재. Phase 2 = `express-rate-limit` 도입 + per-IP 제한 (e.g., 5 req / 15 min on 3 application POST). 본 도메인 outside 추가 carrier 도 cross-domain READ 측 (예: GET /v1/public/spaces 측 enumeration scan 가능 — CSV-style scrape).

### §1.3 CF-023.a CLOSED — `insertLeadWithGeneratedRef` 안전 패턴 (`lib/leadRef.ts:15-41`)

```
export async function insertLeadWithGeneratedRef<T>(values: T): Promise<{...}> {
  const MAX_ATTEMPTS = 6;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const lead_ref = await generateLeadRef();  // (a) full-table SELECT + max+1 (CF-021 sub-anchor)
    try {
      const [row] = await db.insert(leadsTable).values({...values, lead_ref}).returning();
      return row;
    } catch (e) {
      const code = e?.code; const cause = e?.cause?.code;
      if (code === "23505" || cause === "23505") { continue; }  // (b) 23505 unique violation → retry
      throw e;
    }
  }
  throw lastErr ?? new Error("Could not allocate unique lead_ref after retries");
}
```

**도메인 의미 (CF-014 POSITIVE pattern)**: ① **6-attempt retry on 23505** = race condition 방지 (concurrent INSERT 시 unique violation → retry; 6 시도 = exponential backoff 없는 단순 retry). ② **full-table SELECT + max+1** = `generateLeadRef` 측 N rows scan (성능 carrier — Phase 2 `nextval()` sequence 또는 `ON CONFLICT` 권장). ③ **CF-023.a CLOSED 결과**: 본 도메인 3 application POST = helper-driven safe ✅ vs admin `leads.ts:175-204 /convert` = bookingRef 5-digit random + booking row 미생성 = **sole outlier 확정** (T003 묶음 3 crm §1.2).

### §1.4 PROTECTED tier — blog-posts.ts (CF-017 POSITIVE EXEMPLAR)

| endpoint | line | Zod schema | 검증 |
|----------|------|------------|------|
| GET /v1/blog-posts | (list) | **ListBlogPostsQuery** (`:6`) | search + status + category 측 string optional |
| GET /v1/blog-posts/:id | (detail) | **IdParams** | id 측 number coerce |
| POST /v1/blog-posts | (create) | **CreateBlogPostBody** (`:12`) | title + slug + excerpt + content + cover_image_url 측 정밀 |
| PUT /v1/blog-posts/:id | (update) | **IdParams + UpdateBlogPostBody** | double-validate B4 패턴 |
| DELETE /v1/blog-posts/:id | (delete) | IdParams | id only |
| POST /v1/blog-posts/bulk-delete | (bulk) | (validation 없음 — afterthought endpoint anti-pattern) | 1/6 = 17% no-validation |

**CF-017 POSITIVE 분석**: 5/6 = **83% safeParse coverage** (T002.2.h ground truth). `blog-posts.ts` 가 repo 전체 ~88% 부재 (CF-017 carrier) 측에서 **POSITIVE 모범 사례 단일 file**. `email-templates.ts` (T003 묶음 4 sub-task 4 admin §1.5) 측은 5.4% (37 ep 중 ~2 endpoint) = 양극단. Phase 2 = blog-posts.ts 패턴이 reference exemplar — 다른 51 route file 측에 동일 적용.

### §1.5 PROTECTED tier — lookup.ts + page-contents.ts (admin content CRUD)

`lookup.ts` (184L, 10 ep) = suburbs / categories / amenities / 등 lookup data CRUD (admin 측). 6-endpoint 패턴 (list / detail / create / update / delete / bulk-delete) 변형 — T003 묶음 3 catalog 측 9 routes 와 유사 구조. `page-contents.ts` (70L, 3 ep) = page key + language unique compound (T002.3 §3.1 16 unique 측 `page_contents(page_key,language)` compound 단일 anchor) + admin update.

---

## §2 워크플로우 (3 sub-flows)

### §2.1 Unauthenticated lead INSERT (CF-024 carrier + helper safe pattern)

```
[Anonymous] POST /v1/public/owner-applications (public.ts:735)
  ├─ ⚠️ no rate-limit (CF-024 P1)
  ├─ no Zod safeParse (CF-017 carrier — 본 도메인 3 POST validation 부재)
  ├─ helper: await insertLeadWithGeneratedRef({...applicationData}) ✅ CF-023.a CLOSED reference
  │     ├─ generateLeadRef() — full-table SELECT + max+1
  │     ├─ INSERT leads { lead_ref, ...values }
  │     └─ retry 6 times on 23505 unique violation
  ├─ no logAction (CF-008 0/33 floor)
  └─ response { id, lead_ref }

[admin 측 후속] PATCH /admin/leads/:id /convert → CF-023.a sole outlier (booking row 미생성)
```

### §2.2 Unauthenticated content read (open + scan-able)

```
[Anonymous] GET /v1/public/spaces (public.ts:45) — list + filter + pagination
[Anonymous] GET /v1/public/spaces/:id (:314) — multi-table aggregation
[Anonymous] GET /v1/public/spaces/:id/availability (:459) — calendar
[Anonymous] GET /v1/public/properties (:537) / GET /v1/public/services (:581)
[Anonymous] GET /v1/public/blog (:697) / GET /v1/public/blog/:slug (:722)
[Anonymous] GET /health (health.ts:7) / GET /health/db (:18) — status check
[Anonymous] GET /v1/privacy/policy (privacy.ts) / GET /v1/privacy/terms — 정적 content
```

**도메인 의미**: 모든 7 read endpoint = scan-able (rate-limit 부재) → CF-024 secondary 표면 (lead INSERT 외 enumeration 측 scrape risk).

### §2.3 PROTECTED tier — admin content CRUD

```
[Admin] GET/POST/PUT/DELETE /v1/lookup/* (lookup.ts) — 6-endpoint 패턴 × 다중 lookup type
[Admin] GET/POST/PUT/DELETE /v1/blog-posts/* (blog-posts.ts) ✅ CF-017 POSITIVE 5/6 safeParse
[Admin] GET/PUT /v1/page-contents/* (page-contents.ts) — page_key + language compound
```

---

## §3 불변식 (INV1-INV9)

| # | Invariant | 강제 site | 위반 시 동작 |
|---|-----------|-----------|------------|
| INV1 | OPEN tier 3 file (public + privacy + health) = 인증 우회 (mount BEFORE requireAuth) | `app.ts:147-150` | 모든 endpoint 인증 없이 접근 가능 |
| INV2 | 3 unauthenticated POST 측 lead INSERT = `insertLeadWithGeneratedRef` helper 사용 (CF-023.a CLOSED) | `public.ts:735, :787, :833` | helper 측 6-attempt retry → 23505 race 방지 |
| INV3 | rate-limit 부재 (CF-024 P1) | (강제 부재) | DDoS/spam 가능 — Phase 2 express-rate-limit 도입 |
| INV4 | audit log 부재 (CF-008 0/33 floor) | (강제 부재) | lead INSERT + content read 측 사후 추적 불가 |
| INV5 | blog-posts.ts 5/6 safeParse coverage (CF-017 POSITIVE) | `blog-posts.ts:6, :12 + IdParams` | 1/6 (bulk-delete) afterthought anti-pattern |
| INV6 | page_contents (page_key, language) UNIQUE compound | `page-contents.ts` schema (T002.3 §3.1) | 23505 unique violation → 운영자 측 정정 |
| INV7 | healthRouter double-mount (T002.2.h memo) | `app.ts:150` + `routes/index.ts:41 dead-mount` | 두 mount 중 하나 dead — Phase 2 dead-mount cleanup |
| INV8 | helper `generateLeadRef` full-table SELECT (CF-021 sub-anchor) | `lib/leadRef.ts:3-12` | N rows scan — Phase 2 `nextval()` sequence |
| INV9 | PROTECTED tier 3 file (lookup + blog-posts + page-contents) admin guard | mount AFTER `app.ts:167 requireAuth` | 401 |

---

## §4 Cross-domain effects 매핑

| 발신 transition | 수신 도메인 / 컬럼 | 효과 | 시점 | audit log |
|-----------------|-------------------|------|------|-----------|
| public.ts:735/787/833 application POST | leads INSERT (helper safe) → admin /convert sole outlier 측 funnel source | 익명 → admin 측 lead funnel (CF-023.a sole outlier vs 본 도메인 helper 안전) | sync | ✗ (CF-008 0/33 floor) |
| public.ts:45-722 read endpoints | spaces + properties + services + blog 측 read (cross-domain ops + content) | scan-able read (CF-024 secondary 표면) | sync | n/a (read-only) |
| blog-posts.ts CRUD | blog_posts table mutator (admin 측) — CF-017 POSITIVE 모범 | 5/6 safeParse — afterthought 1/6 anti-pattern | mutator | ✗ |
| page-contents.ts PUT | page_contents (page_key, language) UNIQUE compound | 23505 unique violation 시 운영 정정 | mutator | ✗ |

**audit coverage**: T002.2.h 결과 **0/33 = 0%** = repo 단일 도메인 max-blind floor (6-way TIE 일치 + 본 도메인 3 unauthenticated POST 측 lead INSERT 측 audit 0 → 보안 사후 추적 불가).

---

## §5 Cross-references + R-REPO-7 trade-off + Self-check

### §5.1 Cross-references

- Endpoints: [api-endpoints/public.md](../_schema/api-endpoints/public.md) (33 ep / 323 lines).
- Schema: [db-schema-overview.md §1.6 leads + §3.1 UNIQUE compound](../_schema/db-schema-overview.md).
- ERD: [erd-core.md §6 CRM-Ops cluster](../_schema/erd-core.md).
- Pair (guest): [domain-logic-portal-guest.md](./domain-logic-portal-guest.md).
- Pair (partner): [domain-logic-portal-partner.md](./domain-logic-portal-partner.md).
- Pair (admin): [domain-logic-admin.md](./domain-logic-admin.md).
- Cross-domain (crm): [domain-logic-ops-crm.md §1.2 + §2.1](./domain-logic-ops-crm.md) — admin /convert sole outlier vs 본 도메인 helper safe (CF-023 .a CLOSED reference).
- Cross-domain (booking): [domain-logic-booking.md](./domain-logic-booking.md) — bookingRef sibling generators (CF-023 cross-pack).
- Helper: `artifacts/api-server/src/lib/leadRef.ts:1-41` (full source — 41 lines).

### §5.2 R-REPO-7 Trade-off (3개 결정)

| # | 결정 | 채택 | 미채택 | 이유 |
|---|------|------|--------|------|
| 1 | 2-tier 분류 (OPEN vs PROTECTED) | §1.1 통합 표 + tier 컬럼 + §1.2-1.5 tier 별 sub-section | (a) 6 file 균등 sub-section / (b) endpoint type 별 통합 | mount order (auth tier) 가 본 도메인 핵심 — tier 분류 우위 + CF-024 carrier 강조 가능 |
| 2 | CF-023.a CLOSED 표기 | §1.3 helper 코드 snippet + INV2 + §2.1 workflow ✅ marker + cross-ref crm 측 sole outlier | (a) cross-ref only / (b) helper 분석 단독 sub-section | CLOSED verification result 가 본 도메인 reference exemplar — snippet + cross-anchor 우위 (T003 묶음 3 crm 측 sole outlier 확정 기반) |
| 3 | CF-017 POSITIVE blog-posts 표기 | §1.4 5/6 분석 표 + INV5 + §2.3 workflow ✅ marker + admin email-templates 양극단 cross-ref | (a) INV5 단순 줄 / (b) blog-posts 단독 sub-section | CF-017 POSITIVE 단일 file 모범 사례 = repo-wide reference exemplar — 5/6 분석 표 + 양극단 cross-ref 우위 |

### §5.3 R-REPO-5 Incidental disposition (0 신규)

본 sub-task 신규 incidental 0. healthRouter double-mount memo (T002.2.h 등록 완료) cross-ref 만.

### §5.4 3-claim spot-check

| # | Claim | 검증 방법 | 결과 |
|---|-------|-----------|------|
| C1 | 3 unauthenticated POST = `insertLeadWithGeneratedRef` helper 사용 (CF-023.a CLOSED) | `rg "insertLeadWithGeneratedRef" public.ts` + helper 본문 inspect | ✅ public.ts 3 site 사용 + helper 6-attempt retry on 23505 |
| C2 | rate-limit 0 hits repo-wide (CF-024 ground truth) | `rg "rateLimit\|express-rate-limit\|rate.limit" api-server/src/` + `package.json` | ✅ 0 hits + package.json 측 의존성 0 |
| C3 | blog-posts.ts 3-schema = ListBlogPostsQuery + CreateBlogPostBody + UpdateBlogPostBody | `rg "z\.object\|safeParse" blog-posts.ts` + line :6, :12 inspect | ✅ 3 schema + 5/6 endpoint safeParse (1/6 bulk-delete 부재) |

3/3 spot-check ✅.

---

**T003 묶음 4 sub-task 3 (public) 완료. admin sub-task 진행 (T003 GROUP COMPLETE marker 포함).**
