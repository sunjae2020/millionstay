# API Endpoints — INDEX

> **Scope**: All 353 endpoints across 51 route files in `artifacts/api-server/src/routes/`.
> **Convention**: rows follow the **file-of-origin rule** (see `_T002_PLAN.md` §2.1). An endpoint defined in `bookings.ts` belongs to the `booking` domain even if its URL is `/admin/bookings/*` and even if it ends up writing the `contracts` table — cross-cutting effects are surfaced via per-endpoint cross-references in the domain file, not by re-classifying the row.
> **Numbers** below are verified by `rg -c "^router\.(get|post|put|patch|delete)\("` (T001.5 follow-up scan, 2026-04-26).
> **🎯 T003 GROUP COMPLETE**: 2026-04-27 — domain-logic 10 doc files in `_context/` 완료 (booking 200 + contract 315 + finance-invoice 250 + finance-payment 280 + ops-property 250 + ops-catalog 320 + ops-crm 380 + portal-guest 252 + portal-partner 231 + public 207 + admin 396 = **누적 ~2300 lines**). CF count final P0=4 / P1=18 / P2=3 = **25** (T003 전체 0 NEW promotion). R-REPO-5 incidentals final **11**. R-REPO-9 차단 3회 / 자동 진행 6회 / R-REPO-10 묶음 4회 모두 stable.
> **Last updated**: 2026-04-27 (T003 묶음 4 — portal × 2 + public + admin domain logic published in `_context/`: `domain-logic-{portal-guest,portal-partner,public,admin}.md` (252+231+207+396 = **1086 lines**, 4 sub-task 1 응답); 7 CF expansion (CF-004 P0 line-by-line dev-migration + CF-005 portal_type cross-pack + CF-008 9-domain final 6-way TIE + CF-014 POSITIVE #3 SAVEPOINT + CF-016 role-string drift + CF-017 양극단 5.4% admin floor vs 83% public ceiling + CF-018 Sub-pattern B 정정 27→29 files / 54→56 hits + 1 router-level = 57 sites total); 0 NEW R-REPO-5 incidentals (모든 발견 expansion 흡수); R-REPO-9 자동 진행 6회째; R-REPO-10 묶음 위임 4회째 stable — **가장 큰 묶음 max 가속 -83% / -75% / -75%**; counts unchanged P0=4 / P1=18 / P2=3 = 25 CF; incidentals **11** unchanged).
> **Previous**: 2026-04-27 (T002.2.h — `public.md` published, 6 files / 33 endpoints; **NEW CF-024 P1 promoted** — project-wide rate limiting absence; `public` group row CF chip set to 🟡 (CF-008/014/017/023a/024); CF-023 cross-domain verification CLOSED at this sub-task).
> **Last updated**: 2026-04-27 (T002.2.i — `admin.md` published, 10 files / 37 endpoints; **🔴 CF-004 ESCALATED P1 → P0** at `dev-migration.ts:14-79` body-confirmed (TRUNCATE 39 production tables + hard-coded shared secret + mount-order before global guard, no NODE_ENV gate); `admin` group row CF chip should be updated from `[CF-004 + CF-008]` to **`[🔴 CF-004 (P0) + CF-008 + CF-013 + CF-014 (positive site #3) + CF-015 + CF-017 + CF-018 sub-pattern B + CF-022 + CF-024]`**; CF-008 6-way TIE at floor (admin = 0/37 = 0%); CF-018 vertical-privilege-escalation Sub-pattern B newly enumerated (10 inline `requireSuperAdmin` sites in 6 files, 8 cross-domain). Counts: P0=**4** / P1=18 / P2=3 = **25**.
> **Last updated**: 2026-04-27 (🎯 **T002 GROUP COMPLETE** — T002.5 `state-machines.md` published, **541 lines** (target 600-800, −9% within tripwire 850; content-complete with 5-entity Mermaid `stateDiagram-v2`: bookings 8 main + Pending outlier (F7) / contracts 7 / invoices 5 + Stripe sub-section / work_orders 6 / cs_tickets 3). **CF-010 본문 재작성** (T001.5 8-누락-transition 가설 → Stripe payment lifecycle (audit-only payload) vs invoice document lifecycle (5-state) 분리 ground truth; CF-010 § Archive 에 원본 보존; Phase 2 Option A/B/C 영구 보존, Option B `payment_events` 별도 entity 추천). **6 CF evidence expansion**: CF-008 (5-entity audit-coverage matrix invoices 80% > contracts 71% > bookings 67% > work_orders 0% = cs_tickets 0% audit-blind floor; producer-consumer split admin = audit data CONSUMER vs work_orders+cs_tickets producer-side blind) / CF-010 (재작성) / CF-014 (3 known production runtime Tx vs 2 multi-step no-tx locus; contracts.TR3 fallback `db.delete(WHERE contract_id=?)` Phase 2 footgun) / CF-019.a (invoices.stripe_payment_intent_id 0 write site 검증 강화) / CF-022 (5-entity gated-discipline cross-pack ranking bookings 77.8% leader / cs_tickets 50% / work_orders 40% / invoices=contracts 0% floor) / CF-023 (3 booking_ref generators state-entry context 매핑). **F7 신규 incidental**: `guest-portal.ts:160` `booking_status="Pending"` (8 main state 미존재) + `:162` `status="Active"` (bookings 컬럼 미존재) → guest-portal C0' booking dead-end state 진입 (S2/S4/PUT 모든 admin transition 거부); P1 candidate 보류 (runtime 데이터 부재); T003/T004 일괄 처리 baseline. **F8 추가 incidental memo**: cs_tickets `Resolved`/`Closed` state 부재. **R-REPO-9 차단 게이트 2회째 가동 성공** + R-REPO-6 10회째. T002 GROUP 16 doc files in `_schema/` 모두 완료 (11 endpoint domain + INDEX + SCHEMA_FILE_TABLE_MAP + db-schema-overview + erd-core + state-machines). Final counts P0=4 / P1=18 / P2=3 = **25 CF** + 4 incidentals (F4/F5/F7/F8). **Counts unchanged**. Next: T003 `_context/` (자동 시작 금지).
> **Last updated**: 2026-04-27 (T002.4 — `erd-core.md` published, **613 lines** (target 350-500, +23% — 8 cluster diagrams + overview + polymorphic enumeration + 권장 FK 부록 + DEAD 부록 + self-check; tripwire 850 not approached). 8 Mermaid `flowchart` cluster diagrams (option (나) cluster 내부 모든 implicit FK + cross-cluster overview 별도; option (i)+(iii) polymorphic 분기 화살표 + §10 enumeration table 조합 per T002.4 trade-off matrix). **CF-003 evidence expansion**: 53 implicit FK (T002.3 §4) → 73 정책-단위 row (T002.4 §11) + 10 polymorphic = **83 RI rows** Phase 2 EF Core baseline. **CF-009 evidence expansion**: 1 confirmed → 5 candidates (3 🪦 high + 2 ⚰️ medium) per §12 부록; promotion 보류 (T004 `_rules` bulk processing). **R-REPO-6 9회째 가동 + R-REPO-9 차단 게이트 첫 적용** = 사용자 cluster 8안 4 가상 table + 1 누락 + 1 카운트 정정 → corrected 8-cluster 안 (option (가)) 사용자 채택 후 본문 작성 진입. F4/F5 schema-only finding T002.3 → T002.4 disposition 변동 (시각화 + Phase 2 prescription 완료). **Counts unchanged**: P0=4 / P1=18 / P2=3 = **25**. Next: T002.5 `state-machines.md` (자동 시작 금지).
> **Last updated**: 2026-04-27 (T002.3 — `db-schema-overview.md` published, **749 lines** (target 1100-1400, −32% — single-file + Appendix A-D form factor per Step 1 (α) trade-off; tripwire 1300 not approached). 54 `pgTable` declarations × 9-domain inventory; **UNIQUE = 16** sites (Step 1 사전 분류 14 → 정정 +2 compound: `space_availability(space_id,date)` + `page_contents(page_key,language)` per R-REPO-6 (a)); INDEX = 13 sites; PK = 49 serial + 4 uuid + 1 text; `references()` = **0** (CF-003 anchor); 53 implicit FK + ≥8 polymorphic enumerated; 54×11-domain cross-ref matrix surfaces **5 zero-hit DEAD candidates** (`product_catalog` confirmed CF-009 + 4 schema-only finds: `space_option_maps` / `space_blocked_dates` (high confidence), `cs_messages` / `guest_direct_messages` (medium — raw-SQL false-positive risk)); §6 schema-anchor for **6 CF** (CF-001 / CF-003 / CF-009 / CF-013 / CF-016 / CF-019); **6 schema-only findings F1-F6** logged as memos for T004 `_rules` bulk processing (no new CF promotion this sub-task); §8 378-cell self-check (54×7) + 3 spot-check all ✅; **counts P0=4 / P1=18 / P2=3 = 25 unchanged**. Next: T002.4 `erd-core.md`.
> **Last updated**: 2026-04-27 (T002.2.j — `booking.md` close-out published, 27 endpoints total / 759 lines source / `bookings.ts` last endpoint domain in T002.2; 22 stub completion at full Meta + compact format mix [§3.A 7 transitions + §3.B 5 writes + §3.C 2 nested + §3.D 8 reads]; §4 27×7 = 189-cell self-check; §5 10-domain cross-ref matrix; **§6 🔴 CF-018 Sub-pattern B retroactive correction** — T002.2.i seed `11 sites in 6 files` corrected to **55 sites in 28 files** (54 inline `!== "SuperAdmin"` × 27 files × 2 + 1 router-level `db-sync.ts:30`); **NEW SUB-FINDING** at §6.B = role-string normalisation drift (db-sync.ts:16 4-variant Set vs 27-file exact-literal); §6.C T002.2.b–.i blind-spot map; **3 BAD CF-018 IDOR sites** in this domain at `bookings.ts:728/735/572` (document/service nested writes WHERE on `id`/`svcId` only, ignoring URL booking_id) + 2 POSITIVE EXEMPLAR sites; §4 logAction = 7/27 = 26% (booking ranks 4th from top, no longer at floor); §4 Zod = 12/27 = 44% (well above repo baseline); §4 CF-022 state-transition discipline = 9/9 ✅ (booking is **cross-pack leader**); `booking` group row CF chip should be updated from `[CF-002 + CF-003 + CF-006 + CF-007 + CF-008 + CF-011 + CF-014 + CF-015]` to add **`[🔴 CF-004 (P0 cross-ref) + CF-013 + CF-017 + CF-018 (Sub-pattern B at W2/W3 + 3 BAD IDOR at T6/T7/N1 + 2 POSITIVE at N2/R6) + CF-021 + CF-022]`** for full coverage. **0 NEW CF promotions** (CF-018 Sub-pattern B is expansion not new); counts P0=**4** / P1=**18** / P2=**3** = **25** unchanged. **T002.2 endpoint sub-task COMPLETE — 11 of 11 endpoint domain files closed.** Next: T002.3 db-schema-overview.

---

## Column meaning

| Column | Meaning |
|---|---|
| **Domain** | One of: booking · contract · finance-invoicing · finance-payments · ops-property · ops-catalog · ops-crm · portal-guest · portal-partner · public · admin. The two `finance-*` domains form a single conceptual `finance` group, and the three `ops-*` domains form a single conceptual `ops` group — both splits respect the per-file size budget (see [Domain Groups](#domain-groups)). |
| **Source File** | Path relative to `artifacts/api-server/src/routes/`. |
| **URL Prefix** | App-mount prefix from `app.ts:149-175`, plus the file's predominant in-route prefix. All endpoints in this file inherit at least this prefix. |
| **# Endpoints** | Count of `router.<method>(...)` declarations at file root. |
| **Auth Guard** | The middleware that gates this file's endpoints. `requireAuth` is the admin guard at `app.ts:167`. `none` means the file is mounted before `requireAuth`. `webhook` means signature-verified at `stripe.ts:25-44`. ⚠️ markers reference CF entries. |
| **logAction** | ✅ = the file calls `logAction(...)` at least once. ❌ = the file never calls it (CF-008 footprint). The count in parentheses is the number of distinct call sites. |
| **$$** | Money-touching: ✅ if the file reads or writes any column listed in `MONEY_AUDIT.md §1`. ❌ otherwise. |
| **Status** | `ACTIVE` or 🪦 `DEAD` (file backs a tombstoned table per CF-009). |
| **Risk** | 🔴 P0 finding present in the domain · 🟡 P1 finding present · 🟢 only P2 or no finding. See [Risk Legend](#risk-legend). |

---

## Index

| Domain | Source File | URL Prefix | # | Auth Guard | logAction | $$ | Status | Risk |
|---|---|---|---:|---|---|---|---|---|
| booking | `bookings.ts` | `/api/v1/bookings` | 27 | `requireAuth` | ✅ (6) | ✅ | ACTIVE | 🔴 |
| contract | `contracts.ts` | `/api/v1/contracts` | 21 | `requireAuth` | ✅ (8) | ✅ | ACTIVE | 🔴 |
| contract | `contract-types.ts` | `/api/v1/contract-types` | 7 | `requireAuth` | ❌ | ❌ | ACTIVE | 🔴 |
| finance-invoicing | `invoices.ts` | `/api/v1/invoices` | 10 | `requireAuth` | ✅ (3) | ✅ | ACTIVE | 🔴 |
| finance-invoicing | `recurring-schedules.ts` | `/api/v1/recurring-schedules` | 7 | `requireAuth` | ❌ | ✅ | ACTIVE | 🔴 |
| finance-payments | `payment-info.ts` | `/api/v1/payment-info` | 6 | `requireAuth` | ❌ | ✅ | ACTIVE | 🔴 |
| finance-payments | `commissions.ts` | `/api/v1/commissions` | 6 | `requireAuth` | ❌ | ✅ | ACTIVE | 🔴 |
| finance-payments | `beneficiaries.ts` | `/api/v1/beneficiaries` | 6 | `requireAuth` | ❌ | ✅ | ACTIVE | 🔴 |
| finance-payments | `accounts.ts` | `/api/v1/accounts` | 6 | `requireAuth` | ❌ | ✅ | ACTIVE | 🔴 |
| finance-payments | `stripe.ts` | `/api/stripe` | 2 | `webhook` (signature) | ✅ (3) | ✅ | ACTIVE | 🔴 |
| ops-property | `spaces.ts` | `/api/v1/spaces` | 13 | `requireAuth` | ✅ (4) | ✅ | ACTIVE | 🔴 |
| ops-property | `properties.ts` | `/api/v1/properties` | 7 | `requireAuth` | ❌ | ❌ | ACTIVE | 🔴 |
| ops-property | `space-policies.ts` | `/api/v1/space-policies` | 6 | `requireAuth` | ❌ | ❌ | ACTIVE | 🔴 |
| ops-property | `space-options.ts` | `/api/v1/space-options` | 6 | `requireAuth` | ❌ | ❌ | ACTIVE | 🔴 |
| ops-property | `space-images.ts` | `/api/v1/space-images` | 6 | `requireAuth` *(mounted at `/api`, see app.ts:173)* | ❌ | ❌ | ACTIVE | 🔴 |
| ops-property | `suburbs.ts` | `/api/v1/suburbs` | 6 | `requireAuth` | ❌ | ❌ | ACTIVE | 🔴 |
| ops-catalog | `product-catalog.ts` | `/api/v1/product-catalog` | 11 | `requireAuth` | ❌ | ✅ | ACTIVE | 🟡 |
| ops-catalog | `products.ts` | `/api/v1/contract-products` | 10 | `requireAuth` | ❌ | ✅ | ✅ ACTIVE *(file misnamed — defines `contract_products`; see CF-009 rev. + CF-016 + [`../SCHEMA_FILE_TABLE_MAP.md` §3](../SCHEMA_FILE_TABLE_MAP.md#3-file-name-vs-table-name-divergences-the-trap))* | 🟡 |
| ops-catalog | `product-types.ts` | `/api/v1/product-types` | 6 | `requireAuth` | ❌ | ❌ | ACTIVE | 🟡 |
| ops-catalog | `product-groups.ts` | `/api/v1/product-groups` | 6 | `requireAuth` | ❌ | ❌ | ACTIVE | 🟡 |
| ops-catalog | `service-catalog.ts` | `/api/v1/service-catalog` | 6 | `requireAuth` | ❌ | ✅ | ACTIVE | 🟡 |
| ops-crm | `work-orders.ts` | `/api/v1/work-orders` | 10 | `requireAuth` | ❌ | ✅ | ACTIVE | 🔴 |
| ops-crm | `leads.ts` | `/api/v1/leads` | 8 | `requireAuth` | ❌ | ❌ | ACTIVE | 🔴 |
| ops-crm | `tasks.ts` | `/api/v1/tasks` | 7 | `requireAuth` | ❌ | ❌ | ACTIVE | 🔴 |
| ops-crm | `cs-tickets.ts` | `/api/v1/cs-tickets` | 7 | `requireAuth` | ❌ | ❌ | ACTIVE | 🔴 |
| ops-crm | `contacts.ts` | `/api/v1/contacts` | 6 | `requireAuth` | ❌ | ❌ | ACTIVE | 🔴 |
| ops-crm | `service-hosts.ts` | `/api/v1/service-hosts` | 5 | `requireAuth` | ❌ | ❌ | ACTIVE | 🔴 |
| ops-crm | `promotions.ts` | `/api/v1/promotions` | 8 | `requireAuth` | ❌ | ✅ | ACTIVE | 🔴 |
| portal-guest | `guest-portal.ts` | `/api/v1/guest` | 18 | `requireGuestAuth` | ✅ (1) | ✅ | ACTIVE | 🟡 |
| portal-guest | `guest-cs.ts` | `/api/v1/guest/cs` | 8 | `requireGuestAuth` | ❌ | ❌ | ACTIVE | 🟡 |
| portal-guest | `guest-auth.ts` | `/api/v1/guest/auth` | 3 | `none` (login) | ❌ | ❌ | ACTIVE | 🟡 |
| portal-partner | `service-host-portal.ts` | `/api/v1/service-host` | 9 | `requireServiceHostAuth` *(CF-005)* | ❌ | ✅ | ACTIVE | 🟡 |
| portal-partner | `owner-portal.ts` | `/api/v1/owner` | 5 | `requireOwnerAuth` | ❌ | ✅ | ACTIVE | 🟡 |
| portal-partner | `agent-portal.ts` | `/api/v1/agent` | 5 | `requireAgentAuth` | ❌ | ✅ | ACTIVE | 🟡 |
| portal-partner | `partner-auth.ts` | `/api/v1/auth/partner` | 3 | `none` (login) + `requirePartnerAuth` (me/change-pw) | ❌ | ❌ | ACTIVE | 🟡 |
| public | `public.ts` | `/api/v1/public` | 10 | `none` | ❌ | ❌ | ACTIVE | 🟢 |
| public | `lookup.ts` | `/api/v1/lookup` | 10 | `requireAuth` *(via /v1)* | ❌ | ❌ | ACTIVE | 🟢 |
| public | `blog-posts.ts` | `/api/v1/blog-posts` | 6 | `requireAuth` *(mutators)* | ❌ | ❌ | ACTIVE | 🟢 |
| public | `page-contents.ts` | `/api/v1/page-contents` | 3 | `requireAuth` *(mounted at `/api`)* | ❌ | ❌ | ACTIVE | 🟢 |
| public | `privacy.ts` | `/api/v1/privacy` | 2 | `none` | ❌ | ❌ | ACTIVE | 🟢 |
| public | `health.ts` | `/api/health` | 2 | `none` | ❌ | ❌ | ACTIVE | 🟢 |
| admin | `dashboard.ts` | `/api/v1/dashboard` | 8 | `requireAuth` | ❌ | ✅ | ACTIVE | 🟡 |
| admin | `auth.ts` | `/api/v1/auth` | 7 | `none` (login flows) | ❌ | ❌ | ACTIVE | 🟡 |
| admin | `email-templates.ts` | `/api/v1/email-templates` | 6 | `requireAuth` | ❌ | ❌ | ACTIVE | 🟡 |
| admin | `integrations.ts` | `/api/v1/integrations` | 5 | `requireAuth` | ❌ | ❌ | ACTIVE | 🟡 |
| admin | `admin-users.ts` | `/api/v1/admin-users` | 4 | `requireAuth` *(mounted at `/api` before global guard, app.ts:166)* | ❌ | ❌ | ACTIVE | 🟡 |
| admin | `db-sync.ts` | `/api/v1/admin/db-sync` | 3 | `requireAuth` | ❌ | ❌ | ACTIVE | 🟡 |
| admin | `dev-migration.ts` | `/api/v1/admin/dev-migration` | 1 | ⚠️ **`none` (CF-004)** | ❌ | ❌ | ACTIVE | 🟡 |
| admin | `system-logs.ts` | `/api/v1/system-logs` | 1 | `requireAuth` | ❌ | ❌ | ACTIVE | 🟡 |
| admin | `reports.ts` | `/api/v1/reports` | 1 | `requireAuth` | ❌ | ✅ *(reads invoices/contracts)* | ACTIVE | 🟡 |
| admin | `email-logs.ts` | `/api/v1/email-logs` | 1 | `requireAuth` | ❌ | ❌ | ACTIVE | 🟡 |
| **Σ** | **51 files** | — | **353** | — | **6 of 51** | **20 of 51** | **1 DEAD** | — |

---

## Domain Groups

Two conceptual domains are split across multiple files to respect the 1500-line per-file budget set in `_T002_PLAN.md` §8 (revised T002.1.8 §8):

### `finance` group (2 files)

Split along the **billing/source vs collection/disbursement** seam (T002.2.b Decision (α) per session_plan):

- **[`finance-invoicing.md`](./finance-invoicing.md)** — billing/source side: `invoices.ts`, `recurring-schedules.ts`. 2 files, **17 endpoints**.
- **[`finance-payments.md`](./finance-payments.md)** — collection/disbursement side: `payment-info.ts`, `commissions.ts`, `beneficiaries.ts`, `accounts.ts`, `stripe.ts`. 5 files, **26 endpoints**.

CF-014 (multi-step mutation without `db.transaction`) and CF-008 (audit-log gap) are tracked as **cross-file anchors** between the two halves — see each file's §1 anchor block and `CRITICAL_FINDINGS.md#cf-014` / `#cf-008` for cross-references.

### `ops` group (3 files)

- **`ops-property.md`** — physical assets (spaces, properties, space-policies/options/images, suburbs). 6 files, **44 endpoints**.
- **`ops-catalog.md`** — catalogue tables (product-catalog [table DEAD per CF-009 rev.], products [file misnamed; serves active `contract_products`], product-types, product-groups, service-catalog). 5 files, **39 endpoints**.
- **`ops-crm.md`** — operational/CRM workflows (work-orders, leads, tasks, cs-tickets, contacts, service-hosts, promotions). 7 files, **51 endpoints** — pre-write split mandatory per `_T002_PLAN.md` §8.

Cross-domain endpoints stay with their **file of origin**, not with the entity they touch. Examples cataloged in `_T002_PLAN.md` §2.3:
- `POST /api/v1/contracts/:id/invoices` lives in `contract.md` (file = `contracts.ts`) and carries `→ finance-invoicing.md#e2` cross-ref.
- `PATCH /api/v1/bookings/:id/confirm` lives in `booking.md` (file = `bookings.ts`) even though it inserts a `contracts` row and N `contract_line_items` rows; cross-ref to `contract.md#auto-creation` is required on the row.

---

## Domain summary

| Domain | Files | Endpoints | logAction-covered files | $$ files |
|---|---:|---:|---:|---:|
| booking | 1 | 27 | 1 | 1 |
| contract | 2 | 28 | 1 | 1 |
| finance-invoicing | 2 | 17 | 1 | 2 |
| finance-payments | 5 | 26 | 1 | 5 |
| ops-property | 6 | 44 | 1 | 1 |
| ops-catalog | 5 | 39 | 0 | 2 |
| ops-crm | 7 | 51 | 0 | 2 |
| portal-guest | 3 | 29 | 1 | 1 |
| portal-partner | 4 | 22 | 0 | 3 |
| public | 6 | 33 | 0 | 0 |
| admin | 10 | 37 | 0 | 2 |
| **Σ** | **51** | **353** | **6** | **20** |

**Audit-coverage gap (CF-008)**: only **6 of 51 files (11.8%)** call `logAction`. Money-relevant files without audit logging include `recurring-schedules.ts`, `payment-info.ts`, `commissions.ts`, `beneficiaries.ts`, `accounts.ts`, `dashboard.ts` (read-only but reports), and the entire `portal-partner` cluster's mutating endpoints.

---

## Severity legend

In addition to the standard `🔴 P0 / 🟡 P1 / 🟢 P2 / ⚠️` markers used across this pack, per-domain self-check tables (§3 of each `T002.2.x` doc) may use the auxiliary marker:

- **⚠️-system** — a recurring pattern that is not local to one file but spans the codebase and is **not** sized by per-site 🔴/🟡/🟢 severity. Sized instead by **breadth** (anchor count). Once breadth is established (≥ 2 domains), the pattern is promoted to a CF candidate and tracked in `CRITICAL_FINDINGS.md` under its own ID. Currently **confirmed** ⚠️-system patterns (all promoted): (1) **CF-020** soft-delete leak via missing `isNull(deleted_at)` filter — 26 GET-by-id anchors (.a) + 20 zombie-revival anchors (.b) across 4 domains; (2) **CF-019** schema-vs-code drift family (.a Storage orphan + .b Compute drift); (3) **CF-021** N+1 enrichment anti-pattern — 13 anchors across 4 domains, 4-way author-pattern split (leftJoin / Promise.all per-row / sequential per-id / sequential per-detail); (4) **CF-022** state-transition guard inconsistency — 9 transition handlers across 4 ops-crm files (5 gated + 4 ungated, same-file inconsistency promoted T002.2.e).

## Risk Legend

| Risk | Domain(s) | Triggering CF |
|---|---|---|
| 🔴 P0 | **booking** | [CF-002 booking→contract precision loss](../../_audit/CRITICAL_FINDINGS.md#cf-002), [CF-003 zero `references()` FK](../../_audit/CRITICAL_FINDINGS.md#cf-003) |
| 🔴 P0 | **contract** | [CF-002](../../_audit/CRITICAL_FINDINGS.md#cf-002), [CF-003](../../_audit/CRITICAL_FINDINGS.md#cf-003) |
| 🔴 P0 | **finance** | [CF-001 money type schism](../../_audit/CRITICAL_FINDINGS.md#cf-001), [CF-002](../../_audit/CRITICAL_FINDINGS.md#cf-002), [CF-003](../../_audit/CRITICAL_FINDINGS.md#cf-003) |
| 🔴 P0 | **ops-property** | [CF-001](../../_audit/CRITICAL_FINDINGS.md#cf-001) (`spaces.weekly_rate` is `real`), [CF-003](../../_audit/CRITICAL_FINDINGS.md#cf-003) |
| 🔴 P0 | **ops-crm** | [CF-001](../../_audit/CRITICAL_FINDINGS.md#cf-001) (`work_orders.cost` is `real`), [CF-003](../../_audit/CRITICAL_FINDINGS.md#cf-003) |
| 🔴 P0 | **ops-catalog** | [CF-001](../../_audit/CRITICAL_FINDINGS.md#cf-001) — `service_catalog.base_price` is `real` (live carrier into `space_service_catalog.custom_price`); 4 ghost `real` columns on `product_catalog` (DEAD per CF-009). [CF-019 expansion](../../_audit/CRITICAL_FINDINGS.md#cf-019) — `contract_products.effective_weekly_rate` write-orphan (stored at `products.ts:67/108`, recalculated at `:7-37`) |
| 🟡 P1 | **ops-catalog** | [CF-009 dead `product_catalog`](../../_audit/CRITICAL_FINDINGS.md#cf-009) (revised — singular, not "products/product_catalog"; canonical map at [`../SCHEMA_FILE_TABLE_MAP.md`](../SCHEMA_FILE_TABLE_MAP.md)), [CF-008 audit gap](../../_audit/CRITICAL_FINDINGS.md#cf-008) — **NEW LOWEST 0/39 = 0%**, [CF-016 naming inconsistency](../../_audit/CRITICAL_FINDINGS.md#cf-016), [CF-020.a soft-delete leak](../../_audit/CRITICAL_FINDINGS.md#cf-020) — 4 ops-catalog GET-leak anchors + 1 partial revival (anchor count 16 → 18), [CF-021 N+1 enrichment](../../_audit/CRITICAL_FINDINGS.md#cf-021) — `products.ts:7-37` enrich helper (positive batch-fetch exemplar) + `product-catalog.ts:100-125` 4-SELECT chain |
| 🟡 P1 | **portal-guest** | [CF-010 Stripe webhook gap](../../_audit/CRITICAL_FINDINGS.md#cf-010) (Stripe payment intent created at `guest-portal.ts:887`); [CF-023.b NEW sub-split](../../_audit/CRITICAL_FINDINGS.md#cf-023b--fake-ref-generator-with-real-insert-t0022f-sub-split-p1) — `guest-portal.ts:138-141` ad-hoc `GBK-…` `booking_ref` + real INSERT (vs canonical `MS-…` from `bookings.ts:60`); [CF-008](../../_audit/CRITICAL_FINDINGS.md#cf-008) — **NEW lowest 1/29 = 3.4%**; [CF-011](../../_audit/CRITICAL_FINDINGS.md#cf-011) +1 carrier (`guest-portal.ts:762-764` invoice_ref count+1 race); [CF-014](../../_audit/CRITICAL_FINDINGS.md#cf-014) +5 carriers (E1/E10/E17/E24/E26 — domain is largest CF-014 carrier by site count); [CF-017](../../_audit/CRITICAL_FINDINGS.md#cf-017) +5 carriers (E5/E10/E14/E17/E24); [CF-018](../../_audit/CRITICAL_FINDINGS.md#cf-018) +1 partial (E24 ticket `booking_id` unchecked); E17 dead-branch L802 `bank_transfer ? "PendingApproval" : "PendingApproval"` filed for T002.5; **strongest IDOR-defense domain so far** (26/29 ✅ + 1 partial, 2 n/a) — sole-owner guard E20 (`:1086-1092`) is canonical exemplar |
| 🟡 P1 | **portal-partner** | [CF-005 service_host portal_type leak](../../_audit/CRITICAL_FINDINGS.md#cf-005) — JWT signer at `partner-auth.ts:43` `as "agent" | "owner"` cast carries `"service_host"` runtime value past 3-way RSHA/ROA/RAA guard ladder; [CF-006 weekly→monthly formula mismatch](../../_audit/CRITICAL_FINDINGS.md#cf-006) — `owner-portal.ts:83` Formula A `*4` vs `:236` Formula B `*52/12` = **same-file inconsistency** (8.3% delta on dashboard vs detail view; 4 sites total unchanged); [CF-008](../../_audit/CRITICAL_FINDINGS.md#cf-008) — **22/22 = 0% logAction** (TIES with ops-catalog 0/39 + ops-crm 0/51 for absolute lowest 3-way); [CF-014 POSITIVE EXEMPLAR](../../_audit/CRITICAL_FINDINGS.md#cf-014) — `service-host-portal.ts:365-393` (E4 photo upload) is **sole production runtime tx-using handler** project-wide (FOR UPDATE row-lock + count check + sentinel-throw + atomic INSERT loop + Cloudinary compensating cleanup on rollback — Phase 2 reference template); [CF-001](../../_audit/CRITICAL_FINDINGS.md#cf-001) +6 carriers (`contracts.weekly_rate` E12 + `commissions.commission_rate`/`amount` E15/E19); **strongest IDOR-defense surface yet** — 22/22 = 100% safe (DOUBLE GUARD pattern at E5/E12/E17 = canonical exemplar candidate alongside portal-guest E20); CF-023.b consumer-drift hypothesis **REJECTED** for partner (12 prefix-blind SELECT projection sites + 2 fallback `\`#${id}\`` confirm consumer-side blindness — drift is admin-domain risk only) |
| 🟡 P1 | **admin** | [CF-004 dev-migration before requireAuth](../../_audit/CRITICAL_FINDINGS.md#cf-004), [CF-008 audit gap](../../_audit/CRITICAL_FINDINGS.md#cf-008) |
| 🟢 — | **public** | None (P2: CF-011, CF-012 do not affect public surface) |

Cross-cutting findings ([CF-013](../../_audit/CRITICAL_FINDINGS.md#cf-013) date/timezone, [CF-014](../../_audit/CRITICAL_FINDINGS.md#cf-014) no-transactions, [CF-015](../../_audit/CRITICAL_FINDINGS.md#cf-015) soft/hard-delete) apply to every mutating domain and are not enumerated per-row to avoid noise.

---

## Reading order recommendation

For a Phase 2 (.NET) port team:
1. Read this index → pick a domain → open the corresponding `<domain>.md`.
2. Inside each domain file, the per-endpoint blocks follow a single fixed format (see `_T002_PLAN.md` §4). Cross-references are clickable.
3. For finance / booking / contract domains, **always** read `MONEY_AUDIT.md` and `CRITICAL_FINDINGS.md` CF-001/002/007/010 before re-implementing any handler.

---

*End of `INDEX.md` — last updated 2026-04-27 (T003 묶음 2 — domain-logic-finance-{invoice,payment}.md NEW in `_context/`: 250+280=530 lines / R-REPO-10 묶음 위임 2회째 stable / **0 차단** (R-REPO-9 자동 진행 4회째) / 6 CF expansion (CF-001 finance-internal 양극단 / CF-008 booking 26%/78% 두 단위 명확화 + finance polarisation 60%-0% 60% gap / CF-010 webhook bypass + chargeback/dispute carrier / CF-018 finance 도메인 carrier 10/55 = 18.2% max-cluster / CF-019.a/.b 두 stripe orphan column carrier / CF-022 invoice manual 67% vs webhook 0% bypass split) / **F10/F11/F12 3 신규 incidental** (helper "Pending" 5-state 외 / chargeback/dispute 미처리 / commissions.status enum 부재) / counts unchanged P0=4 P1=18 P2=3 = 25).*
