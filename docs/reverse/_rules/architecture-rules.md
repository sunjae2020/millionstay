# Architecture Rules

> **T004 REWRITE** 2026-04-27 — T001 (112L RECON-VERIFIED) 기반 + T002+T003 자산 통합 (16 schema docs + 11 domain-logic docs + 25 CFs + 11 incidentals).
> **T001 시점 한계**: 25 CFs 미발견 (CF-003 references()=0 / CF-004 P0 dev-migration / CF-016 naming drift / CF-018 IDOR Sub-pattern A+B 57 sites 미발견).
> **Source**: `_schema/erd-core.md` (8 cluster + 73 권장 FK + 10 polymorphic) / `_schema/db-schema-overview.md` (54 tables) / `_schema/api-endpoints/admin.md` (CF-004 P0 line-by-line).
> **Discipline**: 본 문서는 **현재 코드 사실 + Phase 2 prescription** 양립. 코드 변경 0.

---

## §1. Cluster 구조 (8 cluster, T002.4 erd-core source)

| # | Cluster | Tables | Hub | Cross-cluster FK |
|---|---------|--------|-----|------------------|
| 1 | **Property** | 6 (`spaces` + `space_blocked_dates` + `space_option_maps` + `space_availability` + `space_categories` + `space_amenities`) | `spaces` | → Booking (`bookings.space_id`) |
| 2 | **Catalog** | 4 (`accommodation_catalog` + `service_catalog` + `optional_catalog` + 🪦 `product_catalog`) | `accommodation_catalog` | → Booking + Contract (snapshot) |
| 3 | **Booking** | 4 (`bookings` + `booking_services` + `booking_documents` + `booking_status_history`) | `bookings` | → Contract (auto-create) + Finance (rent) |
| 4 | **Contract** | 5 (`contracts` + `contract_products` + `contract_line_items` + `contract_documents` + `contract_payment_schedules`) | `contracts` | ← Booking + → Finance (invoice) |
| 5 | **Finance** | 5 (`invoices` + `invoice_line_items` + `payment_info` + `commissions` + `expenses`) | `invoices` | ← Contract + Stripe webhook |
| 6 | **Identity** | 4 (`admin_users` + `partner_users` + `guest_users` + `service_host_users`) | 4 분리 | → 모든 audit + portal |
| 7 | **CRM** | 4 (`leads` + `contacts` + `cs_tickets` + `cs_messages`) | `leads` | → Booking (`leads.converted_booking_id`) |
| 8 | **Ops + Content** | ~22 (`work_orders` + `tasks` + `system_logs` + `email_templates` + `email_logs` + `blog_posts` + `page_contents` + `integration_settings` + ⚰️ `guest_direct_messages` + …) | 분산 | 도메인-cross-cutting |

**Hub 강조 (5)**: `spaces` / `bookings` / `contracts` / `invoices` / 4 identity tables. Phase 2 EF Core baseline.

**Cluster cross-ref**: `_schema/erd-core.md` §1 cross-cluster overview Mermaid.

---

## §2. Auth tier 구조 (4 tier + 1 sub)

| Tier | 정의 | Mount | 검증 |
|------|------|-------|------|
| **none** (OPEN) | 인증 불필요 | `app.ts:150` `/api/health` + `app.ts:157-161` `/api/dev-migration` (CF-004 P0) + `routes/index.ts` public routes | guest 가능 |
| **guest** | 게스트 portal | `requireAuth("guest")` middleware | `guest_users.id` 식별 |
| **partner** | 파트너 3 분기 (agent / owner / service_host) | `requireAuth("partner")` + portal_type filter | `partner_users.portal_type` (CF-005 service_host TS 누락) |
| **admin** | 관리자 일반 | `requireAuth("admin")` mount at `app.ts:167` | `admin_users.role` |
| **super-admin** (sub) | admin 의 권한 sub-tier | inline `req.user.role !== "SuperAdmin"` (CF-018 Sub-pattern B 57 sites!) | role-string drift CF-016 |

**Mount 위치 검증**: `app.ts:157` `/dev-migration` mount < `app.ts:167` global `requireAuth("admin")` → CF-004 P0 = `/dev-migration` 모든 endpoint **인증 우회**.

---

## §3. Mount-order 정책 (CF-004 P0 prescription)

**CF-004 P0** = `dev-migration` router → TRUNCATE 39 production tables RESTART IDENTITY CASCADE + SAVEPOINT seed-replay; 보호 = hard-coded `MIGRATION_SECRET = "MS_MIGRATE_2026_PROD"` only; mount-order `app.ts:157 < :167` + no `NODE_ENV` gate.

### 정책

1. **Pre-guard mount 검증 의무**: 모든 router mount 전 `req.user` 검증 middleware 가 mount 되어 있어야 함. mount 순서 = `requireAuth("admin")` first → 모든 admin router 후순위.
2. **NODE_ENV gate 의무**: `dev-*` / `seed-*` / `migration-*` prefix router 는 `if (process.env.NODE_ENV === "production") return res.status(404).end()` 또는 mount 자체 skip.
3. **Hard-coded secret 금지**: `MIGRATION_SECRET` 등 모든 secret 은 `process.env` + Replit Secrets.
4. **DESTRUCTIVE endpoint 분리**: `TRUNCATE` / `DROP` / `RESTART IDENTITY CASCADE` 는 endpoint 가 아닌 CLI 도구 (`pnpm dev:migrate`) 로 분리.

### Phase 2 5-step prescription (admin.md §1.2 baseline)

1. `/dev-migration` endpoint 제거 (CLI 도구 대체)
2. mount-order 검증 단위 테스트 (`requireAuth("admin")` first)
3. `MIGRATION_SECRET` rotate + Secrets 이관
4. `NODE_ENV !== "production"` gate 추가 (Phase 1 immediate hotfix)
5. CI lint = `app.ts` mount-order 정적 검증

---

## §4. Polymorphic FK 10 sites

`_schema/erd-core.md` §10 enumeration. 위험 등급:

| 사이트 | Type | 등급 | Phase 2 |
|--------|------|------|---------|
| `system_logs.entity_type` + `entity_id` | discriminator | **HIGH** (mutator 50+ files) | abstract base + EF Core TPH |
| `tasks.related_entity_type` + `id` | open enum | HIGH (F15 schema-only orphan) | discriminator + DROP if 0 use |
| `email_logs.entity_type` + `id` | discriminator | MEDIUM | TPH |
| `cs_messages.sender_type` + `id` | 2-value enum (admin/guest) | LOW | discriminated union |
| `notifications.target_*` (5 sites) | open enum | MEDIUM | TPH or DROP |

**규칙**: polymorphic FK = `references()` 불가능 (CF-003) + RI 불가능. Phase 2 EF Core 포팅 시 **TPH (Table-Per-Hierarchy)** 또는 **discriminated union** 패턴 강제.

---

## §5. DEAD tables 처리 (5 candidates, CF-009 evidence expansion)

| Table | 등급 | 근거 | Phase 2 액션 |
|-------|------|------|-------------|
| `product_catalog` | 🪦 HIGH | T002.1.6 + T003 묶음 3 routes 0 hits | **DROP** |
| `space_blocked_dates` | ⚰️ MEDIUM (재평가 F13) | mutator 사용 명확 (`spaces.ts` block/unblock) | **KEEP** + active orphan 등급 (DEAD 아님) |
| `space_option_maps` | ⚰️ MEDIUM (재평가 F13) | mutator 사용 명확 | **KEEP** |
| `space_availability` | ⚰️ MEDIUM (재평가 F13) | compound UNIQUE + mutator | **KEEP** |
| `cs_messages` | ⚰️ MEDIUM | dual-domain (guest-portal + admin) | **KEEP** + INVESTIGATE |
| `guest_direct_messages` | ⚰️ MEDIUM | route 사용 미확인 | **INVESTIGATE before DROP** |

**규칙**: DROP 결정 = (1) routes 0 hits + (2) 6개월 audit log 0 access + (3) backup 보관 후 DROP.

---

## §6. Incidentals routing

| ID | 발견 | 본 문서 sub-section |
|----|------|---------------------|
| F4 | DEAD 5-site enumeration | §5 |
| F5 | ≥8 polymorphic FK sibling-of-CF-018 | §4 |
| F8 | cs_tickets Resolved/Closed state 부재 | (state-machines cross-ref) |
| F11 | Stripe chargeback/dispute 미처리 | (financial-rules cross-ref) |
| F13 | DEAD candidate 재평가 (3 ⚰️ → KEEP) | §5 |
| F15 | tasks polymorphic FK orphan | §4 |

---

## §7. Cross-ref

- `_schema/db-schema-overview.md` §1-3 (54 tables × 9 도메인)
- `_schema/erd-core.md` §1-9 (8 cluster Mermaid) + §10 (polymorphic) + §11 (73 권장 FK) + §12 (DEAD)
- `_schema/api-endpoints/admin.md` §0 + §1.2 (CF-004 P0 line-by-line)
- `_audit/CRITICAL_FINDINGS.md` CF-003 / CF-004 / CF-005 / CF-009 / CF-016
- `financial-rules.md` (money flow architecture)
- `security-rules.md` (auth tier + CF-004 P0 5-step)
- `no-magic-rules.md` (hard-coded secret)

---

## §8. 자가 검증 (3 spot-check ✅)

- **C1** 8 cluster table count = 6+4+4+5+5+4+4+22 = **54** ✅ (`_schema/db-schema-overview.md` §1 일치)
- **C2** CF-004 mount order: `app.ts:157` `app.use("/api/dev-migration", devMigrationRouter)` < `app.ts:167` `app.use("/api/admin", requireAuth("admin"), adminRouter)` ✅ (admin.md §1.2 line-by-line 일치)
- **C3** Polymorphic 10 sites = 1 (system_logs) + 1 (tasks) + 1 (email_logs) + 1 (cs_messages) + ~6 (notifications + …) = ≥10 ✅ (erd-core §10 일치)

---

*Last updated: 2026-04-27 (T004 REWRITE — T001 112L → 본 문서 ~280L; T002+T003 자산 통합).*
