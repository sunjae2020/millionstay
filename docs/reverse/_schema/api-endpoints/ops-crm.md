# Domain — `ops-crm`

> **Scope**: 운영/CRM 워크플로 7 라우트 파일 (51 endpoints) — 작업 지시 (work_orders), 리드 (leads), 작업 (tasks), 고객 지원 (cs_tickets + cs_messages), 연락처 (contacts), 서비스 호스트 (service_hosts), 프로모션 (promotions).
>
> **Read order**: §1 (Overview + 🪦 ghost) → §2 (Cross-Cutting Findings 9 항목 — CF-022 candidate 포함) → §3 (Endpoint Catalogue, 7 sub-files) → §4 (Self-Check Matrix 51×7) → §5 (Spot-Check Verification Log) → §6 (R-REPO-5 closeout).
>
> **Conventions**: file:line 인용, 산문 한국어, 코드 영문, Format A (전체 안전·재무 anchor 후보) / Format B (CRUD 변형) / Format C (단순 lookup) 혼합.
>
> **Cross-references**:
> - [`../SCHEMA_FILE_TABLE_MAP.md`](../SCHEMA_FILE_TABLE_MAP.md) — 7-file 명명은 모두 `<file>.ts ↔ <file>Table` 정규형 (CF-016 무관)
> - [`../../_audit/CRITICAL_FINDINGS.md`](../../_audit/CRITICAL_FINDINGS.md) — CF-001/008/015/017/018/019.a/020/021 + **CF-022 candidate**
> - [`./contract.md`](./contract.md), [`./booking.md`](./booking.md), [`./finance-invoicing.md`](./finance-invoicing.md), [`./ops-catalog.md`](./ops-catalog.md) — downstream consumers (booking_id / contract_product_id / promotion_id 횡단)

---

## 1. Domain Overview

### 1.1 Scope · File · Endpoint matrix

| # | Route file | Mount prefix | Endpoints | Active table(s) | Format mix |
|---|---|---|---|---|---|
| 1 | `work-orders.ts` (203 L) | `/api/v1/work-orders` | **10** | `work_orders` (CF-001 `cost: real` carrier) | 6 A + 4 B (state-transition heavy) |
| 2 | `leads.ts` (216 L) | `/api/v1/leads` | **8** | `leads` (Zod-validated, retry-aware ref helper) | 4 A + 4 B |
| 3 | `tasks.ts` (184 L) | `/api/v1/tasks` | **7** | `tasks` | 3 A + 4 B |
| 4 | `cs-tickets.ts` (209 L) | `/api/v1/cs-tickets` + `/v1/cs/admin` | **7** | `cs_tickets`, `cs_messages` (nested), `guest_users`/`bookings` (read join) | 4 A + 3 B |
| 5 | `contacts.ts` (100 L) | `/api/v1/contacts` | **6** | `contacts` | 2 A + 4 B |
| 6 | `service-hosts.ts` (89 L) | `/api/v1/service-hosts` | **5** | `service_hosts`, `accounts` (per-row enrich read) | 2 A + 3 B |
| 7 | `promotions.ts` (180 L) | `/api/v1/promotions` + `/v1/lookup/promotions` | **8** | `promotions` (CF-001 `discount_percentage: real`), `accommodation_catalog`/`service_catalog` (CF-019.a reverse-lookup) | 3 A + 3 B + 2 C |
| **Σ** | | | **51** | 8 active tables (1 nested `cs_messages` + 0 ghost) | |

**Total file LOC**: 1181 (avg **23 LOC/endpoint** — ops-catalog 21 / ops-property 11 보다 풍부; cs-tickets multer + cloudinary + sql\`CONCAT\` 가 평균을 끌어올림).

### 1.2 Auth / Mount wiring (`artifacts/api-server/src/routes/index.ts`)

7 라우터 모두 `index.ts:41-77` 의 `router.use(...)` 체인에 등록 — 본 블록 직전에 global `requireAuth` middleware 가 mount 되어 있으므로 (cf. `index.ts:78-79` "BEFORE the requireAuth middleware" 주석으로 partner-portal 분기가 *위쪽* 임을 확인) 7 라우터 전부 admin JWT 강제.

- `index.ts:55` `router.use(contactsRouter)`
- `index.ts:58` `router.use(tasksRouter)`
- `index.ts:59` `router.use(leadsRouter)`
- `index.ts:60` `router.use(serviceHostsRouter)`
- `index.ts:65` `router.use(workOrdersRouter)`
- `index.ts:73` `router.use(promotionsRouter)`
- `index.ts:76` `router.use(csTicketsRouter)` ← 단일 예외: 핸들러 단마다 `requireAuth` decorator **재선언** (defense-in-depth; ImageUpload + List + Detail + PUT + Reply + bulk-delete + DELETE 7건 전부) — 다른 6 라우터는 router-level 의존.

**Auth 표** (INDEX.md 일치 검증): 7/7 = `requireAuth` (admin JWT) | partner/guest auth 우회 0 ✅. **SuperAdmin role gate**: bulk-delete + permanent DELETE 변형에 한정 — 6 파일 × 2 = **12 SuperAdmin gates** (service-hosts.ts 단일 예외; soft-delete via `status="Deleted"` 만 — bulk-delete/permanent 자체 부재; §3.6.SH5 evidence).

### 1.3 Cross-domain dependencies

| Out-bound (이 도메인이 의존) | In-bound (이 도메인을 참조) |
|---|---|
| `propertiesTable`, `spacesTable` (work_orders enrichment) | `contracts.ts` (work_order 비용 청구 가능성 — 검증 필요, T002.4 ERD) |
| `contactsTable` (assignment FK convention) | `tasks.ts` (primary/secondary contact), `work-orders.ts` (assigned_contact_id) — **자기-참조** |
| `accountsTable` (service-hosts enrichment, tasks join) | — |
| `suburbsTable` (leads.preferred_suburb_id) | — |
| `guestUsersTable`, `bookingsTable` (cs-tickets join, tasks.booking_id) | — |
| `accommodationCatalogTable`, `serviceCatalogTable` (promotions reverse-lookup; CF-019.a anchor) | — |

### 1.4 Money / `real` 매트릭스 (CF-001 anchor)

| Table.Column | 타입 | 사용 범위 | CF-001 영향 |
|---|---|---|---|
| `work_orders.cost` | `real` (`work_orders.ts:19`) | POST/PUT/complete handler 가 client body 직접 set; 응답에 그대로 노출 | **🔴 P0 carrier** — work order 결산 → invoice 청구 가능성 (T002.4 ERD 검증 필요) |
| `promotions.discount_percentage` | `real` (`promotions.ts:7`) | POST/PUT body, lookup 응답 노출, ops-catalog `enrich()` upstream | **🔴 P0 carrier** — `effective_weekly_rate` 산출 (CF-019.b)에 직접 투입 = ops-catalog 와 cross-domain joint anchor |
| `promotions.discount_amount` | `numeric(10,2)` | POST/PUT body | ✅ numeric — 정상 |
| `leads.budget_min/max` | `numeric(12,2)` | POST/PUT body, 응답 노출 | ✅ numeric — 정상 |

**Net**: ops-crm 도메인은 2 `real` carrier (work_orders.cost + promotions.discount_percentage). 다른 5 파일 (leads/tasks/cs-tickets/contacts/service-hosts) 은 money-touching 컬럼 부재.

### 1.5 🪦 Ghost / Dead-schema 검사 결과

**없음** — 7 active 테이블 + 1 nested (`cs_messages`) 모두 라우트 또는 helper 가 read/write 함. CF-009 후보 0 (ops-catalog 의 `product_catalog` 와 대비).

다만 **부분-orphan 의심 1건** (cross-pass anchor, CF-019.a candidate):
- `service_catalog.promotion_id` (T002.2.d.fix-1 CANDIDATE) — 본 도메인 `promotions.ts:146` 에서 **read-only reverse-lookup join** 으로만 등장 (E7 `/promotions/:id/associated-products`). Write site 0건 (7 파일 grep `promotion_id` → read 만). → **CANDIDATE 상태 유지**. T002.3 db-schema-overview 에서 schema 전수 write-surface enumeration 후 promote/해제 결정.

---

## 2. Cross-cutting findings (9 항목)

### 2.1 CF-001 — Money type 분열 (이 도메인 2 anchor)

**Anchor 추가**:
- `work_orders.cost: real("cost")` `work_orders.ts:19` — POST L81 `parsed.data.cost ?? null` (Zod `CreateWorkOrderBody` 가 어떤 타입으로 받는지 확인 필요; 기본 z.number() 가정 시 IEEE 754 직접 저장), PUT L108, complete L177, bulk-delete L121-131 → 4 mutator anchor in single file. 응답: `enrichWorkOrders()` L44-49 spread → JSON serialize 시 IEEE 754 부동소수 그대로 직렬화.
- `promotions.discount_percentage: real` `promotions.ts:7` — POST L58 `db.insert(...).values(parsed.data)` (raw spread, Zod `z.coerce.number()` 만), PUT L75-77, lookup L164 응답 → ops-catalog `products.ts:18-37` `enrich()` 가 read 하여 `weekly_rate * (1 - disc/100)` 계산에 투입 = **CF-019.b compute-drift 의 입력 변동성 직접 매개**.

**Cross-domain joint**: ops-crm `discount_percentage` (real) + ops-catalog `weekly_rate` (real) → ops-catalog `effective_weekly_rate` (real, 저장-vs-재계산 divergence) → contract.ts `bond_weekly` (real) → invoice line items (numeric, **여기서 정밀도 회복 시점**). CF-001 chain 의 **upstream side** ops-crm 위치 확정.

### 2.2 CF-008 — Audit log 0/51 = **0%** (NEW domain-LOWEST tie)

**Re-verification**: `grep -n "logAction\|systemLog\|systemLogsTable" artifacts/api-server/src/routes/{work-orders,leads,tasks,cs-tickets,contacts,service-hosts,promotions}.ts` → **0 hit across 7 files**.

**ops-catalog 와 동률** (둘 다 0/N = 0%). Severity matrix 갱신:
| Domain | Audit 비율 | 변화 |
|---|---:|---|
| booking | (T002.2.j) | TBD |
| contract | (계산 보류) | TBD |
| finance-invoicing | (T002.2.b) | partial |
| finance-payments | (T002.2.b) | partial |
| ops-property | 1 / 44 = 2.3% | low |
| ops-catalog | 0 / 39 = 0% | LOWEST |
| **ops-crm** | **0 / 51 = 0%** | **TIED LOWEST** |

**Inverse correlation 가설 데이터 추가**: ops-property (1/44) → ops-catalog (0/39) → ops-crm (0/51). 패턴 = **순수 마스터-데이터 도메인 (catalog) + 운영 워크플로 (crm) 가 audit 부재 빈도 최고**. 가설: "audit 가 있는 곳은 transactional 또는 cross-actor 도메인 (booking/finance/admin) — author 가 reconciliation 필요성을 인식한 곳"으로 구체화. 검증은 T002.2.f-.i (portal/public/admin) 에서 inverse 가설 직접 충돌 케이스 (admin = 높을 것 vs ops 도메인 = 낮음) 확인.

### 2.3 CF-015 — Soft-delete 비균질 (이 도메인 핵심 anchor)

**Site-by-site 매트릭스**:

| File | `deleted_at` 컬럼 | DELETE 패턴 | bulk-delete | 주의 |
|---|---|---|---|---|
| work_orders | ✅ `timestamp("deleted_at")` (no tz) | soft default + `permanent=true` SA hard | ✅ SA gate | **CF-013 anchor**: deleted_at no-tz |
| leads | ✅ `timestamp("deleted_at")` (no tz) | 동일 | ✅ SA gate | CF-013 anchor |
| tasks | ✅ `timestamp("deleted_at")` (no tz) | 동일 | ✅ SA gate | CF-013 anchor |
| cs_tickets | ✅ `timestamp("deleted_at")` (no tz) | 동일 | ✅ SA gate | CF-013 anchor |
| contacts | ✅ `timestamp("deleted_at", { withTimezone: true })` | 동일 | ✅ SA gate | tz 일치 (예외) |
| **service_hosts** | **❌ 컬럼 자체 부재** | **soft via `status="Deleted"`** (DELETE L84) | **❌ bulk-delete 자체 부재** | **CF-015 신규 anchor** — 단일 status-as-soft-delete 사이트 |
| promotions | ✅ `timestamp("deleted_at")` (no tz) | 동일 | ✅ SA gate | CF-013 anchor |

**CF-015 evidence 강화**: service_hosts 는 schema 차원에서 deleted_at 부재 → `status="Deleted"` 가 *유일* soft-delete 신호 → list/lookup endpoint (L20-28) 가 `status` 필터 명시하지 않으면 deleted record 누출. **추가 anchor**: list endpoint `service-hosts.ts:21` `if (status) conditions.push(eq(...))` — status 미지정 시 모든 row (Deleted 포함) 반환 = **CF-020.a soft-delete leak 의 변형 (sentinel-value 기반)**. 본 패턴은 "deleted_at 부재 → 별도 sentinel 컬럼" 전형 antipattern.

**CF-013 anchor counts**: 7 파일 中 6 = `deleted_at` (no tz) + 1 contacts = `withTimezone: true` → **6 신규 no-tz anchor** (T001.5 21/145 카운트에 합산: 21 → 27).

### 2.4 CF-017 — Validation 부재/혼재 (3-way matrix)

| 구분 | 파일 | 패턴 |
|---|---|---|
| **Zod end-to-end** (이상적) | leads, tasks, contacts | `*.safeParse(req.params)` + `*.safeParse(req.body)` 양쪽 → 불일치 시 400 |
| **Zod 일부** | work-orders, promotions | body 만 Zod (params 는 raw `Number(req.params.id)`); IDOR risk 는 단순 PK 라 낮음 |
| **Ad-hoc** | cs-tickets | `if (!message?.trim())` (L147), `CS_STATUSES.includes(status)` (L126) — Zod 없음, **status whitelist 만** |
| **Spread-from-body** | service-hosts | `db.insert(...).values(parsed.data)` 이지만 PUT L73 도 `CreateServiceHostBody.safeParse(req.body)` 사용 (UpdateServiceHostBody 부재로 Create schema 재사용) — partial update 시 missing field 가 NOT NULL violation 으로 갈 수 있음 |

**Cross-domain 누적 카운트** (T002.2.b 시작 6/52 → T002.2.c 7/52 → T002.2.d 7/52 → 본 sub-task): ops-crm 7 파일 中 **3 파일 end-to-end + 2 파일 부분 + 2 파일 ad-hoc/spread**. 누적 정확 카운트는 CRITICAL_FINDINGS.md CF-017 anchor 표 갱신 시 +5 (3 strong + 2 partial).

### 2.5 CF-018 — IDOR / nested-resource scope (1 anchor)

**유일 nested handler**: `cs-tickets.ts:141 POST /:id/messages`. 검증 (L152-153 `select.where(eq(csTicketsTable.id, id))` → ticket 존재만 확인, **scope/owner 가드 부재**) — 단, 본 라우터는 admin-only 이므로 admin 이 임의 ticket 에 message 생성 가능 = **scope 의도된 동작**. 따라서 **CF-018 false positive** 로 분류. 17-handler universe 에 추가하지 않음. 단순 메모.

### 2.6 CF-019.a candidate cross-check (T002.2.d.fix-1 carryover)

**Verification (R-REPO-6)**: `grep -nE "promotion_id" artifacts/api-server/src/routes/{work-orders,leads,tasks,cs-tickets,contacts,service-hosts,promotions}.ts` → 3 hit 모두 `promotions.ts` 내부 read-only join (L118 코멘트, L135 accommodation_catalog, L146 service_catalog). **Write site 0건**.

**결정**: CANDIDATE 상태 유지 (T002.2.d.fix-1 anchor table row 3 변경 없음). T002.3 db-schema-overview 에서 schema 전수 write-surface enumeration (전 50 라우트 파일) 시 최종 promote/해제. 본 sub-task에서는 단순 메모로 처리 (R-REPO-5 (e)).

### 2.7 CF-020 — Soft-delete leak (이 도메인 12 신규 anchor)

| Sub-pattern | 파일 | site | 카테고리 |
|---|---|---|---|
| **CF-020.a GET-by-id leak** | work-orders | L88 GET `/:id` — `eq(id, ...)` only, **no isNull(deleted_at)** | leak |
| | leads | L86 GET `/:id` — leftJoin select, **no isNull guard** | leak |
| | tasks | L77 GET `/:id` — select.where(eq(id)), no guard | leak |
| | cs-tickets | L74 GET `/:id` — admin select, no guard | leak |
| | contacts | L45 GET `/:id` — select.where(eq(id)), no guard | leak |
| | promotions | L62 GET `/:id` + L119 associated-products + L155 lookup, **3 sites no guard** | leak (3) |
| **CF-020.b zombie revival** | work-orders | L95 PUT, L149 /start, L159 /review, L169 /complete, L187 /cancel — **5 mutators, no isNull guard** → archived (deleted_at set) row 가 status 갱신으로 부활 가능 | revival (5) |
| | leads | L126 PUT, L175 /convert, L205 /mark-lost — **3 sites no guard** | revival (3) |
| | tasks | L124 PUT, L173 /complete — **2 sites no guard** | revival (2) |
| | cs-tickets | L121 PUT, L141 POST messages, L166 auto-status update — **3 sites no guard** | revival (3) |
| | contacts | L53 PUT — **1 site** | revival (1) |
| | promotions | L70 PUT — **1 site** | revival (1) |

**Net additions to CF-020 anchor counts**:
- .a GET-leak: **8 신규** (work-orders 1 + leads 1 + tasks 1 + cs-tickets 1 + contacts 1 + promotions 3) → 18 + 8 = **26 total**
- .b revival: **15 신규** (5+3+2+3+1+1) → 기존 카운트 (T002.2.c 4 + T002.2.d 1 = 5) + 15 = **20 total**

**Pattern density**: ops-crm 가 단일 도메인 최대 anchor 공급 (23 신규). LIST endpoints 는 모두 isNull(deleted_at) 정확히 적용 (`work-orders.ts:54`, `leads.ts:21`, `tasks.ts:19`, `cs-tickets.ts:35`, `contacts.ts:19`, `promotions.ts:45`) — **author 가 패턴을 알지만 GET-by-id 와 mutator 에 일관 적용 실패**. CF-020 P1 정당화 강화.

### 2.8 CF-021 — N+1 enrichment (이 도메인 3 신규 anchor)

| File:line | Pattern | 비용 |
|---|---|---|
| `work-orders.ts:31-42` | `for (const id of propertyIds)` + `for (const id of spaceIds)` + `for (const id of contactIds)` 3 sequential loops, 각 loop 마다 `db.select().from(...).where(eq(id))` 단발 쿼리 | **3N+1** per page (degree 3, list size N) |
| `tasks.ts:107-119` | GET `/:id` detail handler — primary_contact_id (L111) 와 account_id (L115) 각각 별도 select | 2N+1 per detail (단 detail = N=1 이라 작음, 다만 패턴 anchor) |
| `service-hosts.ts:30-37` | `Promise.all(rows.map(async row => await db.select(...).where(eq(accountsTable.id, row.account_id))))` — Promise.all 로 병렬화는 했으나 여전히 **per-row select** = N round-trips | N round-trip per page (병렬, 그러나 connection-pool 압박) |

**대비**: leads.ts:64-67 + tasks.ts:53-58 + cs-tickets.ts:50-52 = `leftJoin` 으로 단일 SELECT (positive exemplar). **저자별 패턴 분기**: leads/tasks/cs-tickets 작성자 = JOIN 능숙; work-orders/service-hosts 작성자 = sequential-loop 습관.

**CF-021 anchor 누적**: T002.2.c 4 + T002.2.d 2 + 본 sub-task 3 = **9 anchors total**.

### 2.9 CF-022 — State-transition guard 누락 (NEW CANDIDATE — Step 4 결정)

**4 가지 핸들러에서 동일-파일 inconsistency 발견** — 일부는 precondition gate 있고 일부는 없음:

| File | gated transitions | ungated transitions | judgement |
|---|---|---|---|
| work-orders | `/start` L149-153 (`and(eq(id), eq(status, "Open"))`) ✅, `/review` L159-163 (`status="InProgress"`) ✅ | `/complete` L169-184 (no precondition) ❌, `/cancel` L187-200 (no precondition) ❌ | **2 ✅ + 2 ❌ in same file** |
| leads | `/convert` L175-203 (`if (lead.lead_status === "ConvertedToBooking") return 400`) ✅ | `/mark-lost` L205-213 (no precondition — 어떤 상태에서도 Lost) ❌ | **1 ✅ + 1 ❌** |
| tasks | — | `/complete` L173-181 (no precondition — 모든 status 에서 Done) ❌ | **0 ✅ + 1 ❌** |
| cs-tickets | — (PUT L121-130 status whitelist 만; transition graph 가드 없음 — Closed→Open 가능) | L121 PUT ❌, L166 자동 status="InProgress" guarded by `eq(status, "Open")` 이므로 정상 ✅ | partial |

**Failure modes**:
- 부적절 transition 으로 audit/billing 인식과 DB 상태 divergence (예: Cancelled work order 가 /complete 호출로 Completed 가 되며 closed_at 만 갱신; 매출 인식 misclassification)
- `/mark-lost` 가 ConvertedToBooking 상태를 덮어쓰면 booking 추적 끊김
- Closed cs-ticket 을 Open 으로 되돌려도 audit 부재 (CF-008 compound)

**Decision (Step 4 spot-check 후 확정)**: **promote 후보 — P1**. 근거: state graph 무결성 직결 + audit 부재 (CF-008) compound + 동일-파일 inconsistency 가 *의도된 게이트* 와 *누락된 게이트* 의 명확한 차이 → 단순 oversight, 즉 fix-able pattern. P0 은 아님 — 데이터 무결성 손상이 자료-차원이 아닌 *상태-차원* (rows 자체 손실 없음).

**Carrier 의무**: Step 4 spot-check 검증 후 Step 5 atomic commit 시 CRITICAL_FINDINGS.md 에 CF-022 신규 등재 (P1). **본 sub-task 한정 — anchor 표 + Discovery + Phase 2 mitigation 까지 포함, ~70 lines 예상** (CF-019 / CF-020 / CF-021 신규 등재 평균 분량 기준).

---

## 3. Endpoint Catalogue

### 3.1 `work-orders.ts` — 10 endpoints

#### WO1 GET `/v1/work-orders` (L52-64) — list

**Meta**: `Auth: requireAuth | $$: cost(real)→response | logAction: 0 | CF: 020.a✅(L54 isNull guard), 021(L31-42 3N+1 enrich)`

Query filters: `q` (title ilike), `status`, `priority`, `property_id`. 정렬 `id ASC`. `enrichWorkOrders()` (L21-50) helper 가 property_name + space_name + assigned_contact_name 추가 — N=page 이면 (3·distinct + 1) round-trips. CF-021 strong anchor.

#### WO2 POST `/v1/work-orders` (L66-86) — create

**Meta**: `Auth: requireAuth | $$: cost(real)| logAction: 0 | CF: 001(L81), 017(Zod body)`

Zod `CreateWorkOrderBody.safeParse(req.body)` (L67). `nextOrderRef()` (L13-19) — `MS-WO-${year}-${count+1:05d}` 카운트 증가, **race condition 위험** (concurrent INSERT 시 동일 ref 충돌 가능; leads.ts:13-44 의 retry-with-23505 패턴과 대비 — work-orders 는 retry 없음 → unique constraint violation 발생 시 500). cost L81 `?? null` — Zod schema 가 number 인지 string 인지 미확인 (api-zod 패키지 위치 grep 0 — 별도 검증 필요).

#### WO3 GET `/v1/work-orders/:id` (L88-93) — detail

**Meta**: `Auth: requireAuth | $$: — | logAction: 0 | CF: 020.a❌(no isNull), 021(detail-level enrich)`

`select.where(eq(id))` 단독 — **deleted_at filter 부재 → soft-deleted row leak**. CF-020.a anchor.

#### WO4 PUT `/v1/work-orders/:id` (L95-114) — update

**Meta**: `Auth: requireAuth | $$: cost(real, L108) | logAction: 0 | CF: 020.b❌(zombie revival), 017(partial Zod)`

Field-by-field guard (`if (parsed.data.X !== undefined)`) — partial update 의 정석. 다만 `where(eq(id))` 단독 — deleted_at 필터 없어 archived row 가 PUT 으로 부활 가능 (status 미설정 시 기존 "Archived" 유지하지만 `updated_at` 만 갱신; status 명시 시 직접 부활).

#### WO5 POST `/v1/work-orders/bulk-delete` (L116-132) — bulk soft/hard delete

**Meta**: `Auth: requireAuth + SuperAdmin (L118-120) | $$: — | logAction: 0 | CF: —`

`req.body.permanent` flag 로 분기. soft = `set({deleted_at, status:"Archived"})`. SuperAdmin role gate ✅. **logAction 부재** (CF-008).

#### WO6 DELETE `/v1/work-orders/:id` (L134-147) — single soft/hard delete

**Meta**: `Auth: requireAuth + SuperAdmin(permanent only) | $$: — | logAction: 0 | CF: —`

`?permanent=true` query → SA gate (L139). 기본 soft. 동일 패턴이 7 파일 중 6 파일에 반복 (service-hosts 제외) — **R-REPO-5 incidental: common helper 추출 후보**.

#### WO7 POST `/v1/work-orders/:id/start` (L149-157) — state transition

**Meta**: `Auth: requireAuth | $$: — | logAction: 0 | CF: 022✅(precondition gate)`

`update.where(and(eq(id), eq(status,"Open")))` — **precondition gate 정상**. 다른 상태에서 호출 시 row 0 → 400 반환. **state transition guard 의 모범**. CF-022 evidence 의 *✅ side*.

#### WO8 POST `/v1/work-orders/:id/review` (L159-167) — state transition

**Meta**: `Auth: requireAuth | $$: — | logAction: 0 | CF: 022✅(precondition gate)`

`status="InProgress"` 만 허용. 동일 패턴.

#### WO9 POST `/v1/work-orders/:id/complete` (L169-185) — state transition (UNGATED)

**Meta**: `Auth: requireAuth | $$: cost(real, L177) | logAction: 0 | CF: 022❌(no precondition), 001`

Zod body. `where(eq(id))` 만 — **precondition gate 부재**. Cancelled 상태 work order 도 Complete 로 전이 가능 → completed_at 만 갱신, 매출 인식 misclassification risk. CF-022 evidence 의 *❌ side* + same-file inconsistency.

#### WO10 POST `/v1/work-orders/:id/cancel` (L187-201) — state transition (UNGATED)

**Meta**: `Auth: requireAuth | $$: — | logAction: 0 | CF: 022❌(no precondition)`

Zod body. `where(eq(id))` 만. WO7+WO8 ✅ vs WO9+WO10 ❌ = 동일 파일 내 4개 transition 의 50% gate 누락.

### 3.2 `leads.ts` — 8 endpoints

#### L1 GET `/v1/leads` (L17-72) — list

**Meta**: `Auth: requireAuth | $$: budget_min/max(numeric)→response | logAction: 0 | CF: 020.a✅(L21), 017(Zod query)`

Zod `ListLeadsQueryParams.safeParse(req.query)` (L18) — query string Zod 검증. `or(...)` search L27-33. leftJoin `suburbs` for name enrichment (CF-021 *positive* exemplar — JOIN 사용). isNull(deleted_at) ✅.

#### L2 POST `/v1/leads` (L74-84) — create with retry

**Meta**: `Auth: requireAuth | $$: budget(numeric) | logAction: 0 | CF: 017(Zod body)`

Zod body. `insertLeadWithGeneratedRef()` (`lib/leadRef.ts:15-44`) — **6-attempt retry on PG error code 23505 (unique violation)**. ref 형식 `LEAD-${year}-${count+1:05d}`. work-orders.ts WO2 가 동일 race-condition 노출인데 retry 없음 — **inconsistency (R-REPO-5 incidental)**.

#### L3 GET `/v1/leads/:id` (L86-124) — detail

**Meta**: `Auth: requireAuth | $$: budget→response | logAction: 0 | CF: 020.a❌(no isNull), 017(Zod params)`

leftJoin 단일 쿼리 (CF-021 positive). 다만 `where(eq(id))` 단독 — deleted_at 누출.

#### L4 PUT `/v1/leads/:id` (L126-137) — update

**Meta**: `Auth: requireAuth | $$: — | logAction: 0 | CF: 020.b❌, 017(Zod both)`

`set({...bodyParsed.data, updated_at: new Date()})` — **spread-from-body** 다만 Zod 가 unknown key drop 한다고 가정 (UpdateLeadBody schema 가 strict 인지 확인 필요 — 현재 grep 0). status 임의 변경 가능 → archived 부활.

#### L5 POST `/v1/leads/bulk-delete` (L139-155) — bulk delete

**Meta**: `Auth: requireAuth + SuperAdmin | $$: — | logAction: 0 | CF: —`

표준 패턴.

#### L6 DELETE `/v1/leads/:id` (L157-173) — single delete

**Meta**: `Auth: requireAuth + SuperAdmin(permanent) | $$: — | logAction: 0 | CF: —`

표준 패턴.

#### L7 PATCH `/v1/leads/:id/convert` (L175-203) — state transition (GATED)

**Meta**: `Auth: requireAuth | $$: — | logAction: 0 | CF: 022✅(precondition L183)`

**Precondition L183** `if (lead.lead_status === "ConvertedToBooking") return 400`. Zod params + body. **🚨 booking_ref 생성 L188** `BK-${year}-${random.10000-99999}` — bookings 테이블 INSERT 부재! booking_ref 만 *문자열로 반환*하고 lead.converted_at + lead_status 업데이트만. **booking 실제 생성 fork** 가 다른 곳에 있는지 검증 필요 (T002.4 ERD). 현재로선 **fake booking_ref** = R-REPO-5 incidental (impact: T002.5 state-machines 에 booking 생성 흐름과 reconciliation 필요).

#### L8 PATCH `/v1/leads/:id/mark-lost` (L205-214) — state transition (UNGATED)

**Meta**: `Auth: requireAuth | $$: — | logAction: 0 | CF: 022❌`

`set({lead_status:"Lost"})` `where(eq(id))` 만. **precondition 0** — ConvertedToBooking 상태 lead 를 Lost 로 덮어쓰기 가능. CF-022 evidence.

### 3.3 `tasks.ts` — 7 endpoints

#### T1 GET `/v1/tasks` (L15-68) — list

**Meta**: `Auth: requireAuth | $$: — | logAction: 0 | CF: 020.a✅(L19), 017(Zod query)`

Zod query. due_date `gte/lte` filter L23-24. leftJoin contacts + accounts (CF-021 positive). 응답 mapping L62-67 — primary_contact_name 조립 시 account_name 을 이어붙이는 **버그 가능성**: `${first_name} ${account_name}` (L65) — 의도가 contact 의 last_name 인지 account 인지 모호. R-REPO-5 incidental: data layer naming bug 후보.

#### T2 POST `/v1/tasks` (L70-75) — create

**Meta**: `Auth: requireAuth | $$: — | logAction: 0 | CF: 017(Zod), 015(no ref)`

Zod body, `db.insert(...).values(parsed.data).returning()`. work_orders/leads 와 다르게 **ref 컬럼 없음** (schema 확인 — tasks 는 id 만 PK).

#### T3 GET `/v1/tasks/:id` (L77-122) — detail

**Meta**: `Auth: requireAuth | $$: — | logAction: 0 | CF: 020.a❌, 021(2-loop sequential)`

select 후 primary_contact_id (L110) + account_id (L115) **각각 별도 select** = 2N+1 (detail 1 row 이라 작지만 패턴 anchor — 같은 파일 L1 list 는 leftJoin 으로 처리). **저자 일관성 부재 within-file**.

#### T4 PUT `/v1/tasks/:id` (L124-135) — update

**Meta**: `Auth: requireAuth | $$: — | logAction: 0 | CF: 020.b❌, 017(Zod both)`

스프레드 패턴.

#### T5 POST `/v1/tasks/bulk-delete` (L137-153) — bulk delete

**Meta**: `Auth: requireAuth + SuperAdmin | $$: — | logAction: 0 | CF: —`

표준.

#### T6 DELETE `/v1/tasks/:id` (L155-171) — single delete

**Meta**: `Auth: requireAuth + SuperAdmin(permanent) | $$: — | logAction: 0 | CF: —`

표준.

#### T7 PATCH `/v1/tasks/:id/complete` (L173-182) — state transition (UNGATED)

**Meta**: `Auth: requireAuth | $$: — | logAction: 0 | CF: 022❌`

`set({task_status:"Done", completed_at})` precondition 0. Cancelled task 도 Done 가능. CF-022 evidence.

### 3.4 `cs-tickets.ts` — 7 endpoints

#### CT1 POST `/v1/cs/admin/upload-image` (L17-26) — image upload

**Meta**: `Auth: requireAuth | $$: — | logAction: 0 | CF: 017(ad-hoc)`

multer in-memory 10MB limit. Cloudinary upload to `millionstay/cs` folder. **service-side concern**: `isCloudinaryConfigured()` 체크 → 503 fallback. 단순 NO_FILE / UPLOAD_FAILED 분기. **별도 file-system 저장 안 함** = stateless. 본 endpoint 만 `/v1/cs/admin/*` prefix (다른 6개는 `/v1/cs-tickets/*`) — **prefix 불일치 R-REPO-5 incidental** (URL routing 의도성 모호; `/cs/admin` vs `/cs-tickets/admin`).

#### CT2 GET `/v1/cs-tickets` (L31-69) — admin list

**Meta**: `Auth: requireAuth (per-handler) | $$: — | logAction: 0 | CF: 020.a✅(L35), 021(leftJoin positive)`

leftJoin guest_users + bookings. count(*) sub-query (L58) — pagination support. try/catch wrap → 500. **per-handler requireAuth** (router-level + handler-level 중복) = defense-in-depth.

#### CT3 GET `/v1/cs-tickets/:id` (L74-116) — admin detail with messages

**Meta**: `Auth: requireAuth (per-handler) | $$: — | logAction: 0 | CF: 020.a❌(no isNull), 021(messages secondary fetch)`

leftJoin guest+booking (positive). 그러나 `where(eq(id))` 단독 — deleted_at 누출. messages 별도 SELECT (L95-97) — 정상 (1+1, not N+1).

#### CT4 PUT `/v1/cs-tickets/:id` (L121-136) — update (status/priority/assigned)

**Meta**: `Auth: requireAuth (per-handler) | $$: — | logAction: 0 | CF: 017(ad-hoc whitelist), 022❌(no transition graph), 020.b❌`

`CS_STATUSES.includes(status)` (L126) **whitelist 만** — Closed→Open transition 허용. CF-022 evidence (transition graph 부재). closed_at 자동 set L129 (status="Closed" 시).

#### CT5 POST `/v1/cs-tickets/:id/messages` (L141-174) — nested message + auto-status

**Meta**: `Auth: requireAuth (per-handler) | $$: — | logAction: 0 | CF: 017(ad-hoc), 018-FP, 022✅(L167 auto-transition gated)`

ad-hoc validation `if (!message?.trim())` (L147). ticket 존재 확인 (L152) — admin scope 라 IDOR FP. **L165-168 자동 status="InProgress"** `where(and(eq(id), eq(status,"Open")))` — **gated transition** (CF-022 evidence ✅, drive-by side effect on POST). is_internal 메시지는 자동 status 갱신 skip (L165).

#### CT6 POST `/v1/cs-tickets/bulk-delete` (L176-192) — bulk delete

**Meta**: `Auth: requireAuth (per-handler) + SuperAdmin | $$: — | logAction: 0 | CF: —`

표준.

#### CT7 DELETE `/v1/cs-tickets/:id` (L194-207) — single delete

**Meta**: `Auth: requireAuth (per-handler) + SuperAdmin(permanent) | $$: — | logAction: 0 | CF: —`

표준.

### 3.5 `contacts.ts` — 6 endpoints

#### C1 GET `/v1/contacts` (L15-36) — list

**Meta**: `Auth: requireAuth | $$: — | logAction: 0 | CF: 020.a✅, 017(Zod)`

filters: nationality, gender, portal_enabled, status, search (or 4-field). orderBy last_name. 단일 SELECT (no enrichment) — most lean handler in domain.

#### C2 POST `/v1/contacts` (L38-43) — create

**Meta**: `Auth: requireAuth | $$: — | logAction: 0 | CF: 017(Zod), 015(no ref)`

Zod body, raw insert. ref 없음 (PK only).

#### C3 GET `/v1/contacts/:id` (L45-51) — detail

**Meta**: `Auth: requireAuth | $$: — | logAction: 0 | CF: 020.a❌, 017(Zod params)`

`select.where(eq(id))` 단독 — soft-deleted leak.

#### C4 PUT `/v1/contacts/:id` (L53-64) — update

**Meta**: `Auth: requireAuth | $$: — | logAction: 0 | CF: 020.b❌, 017(Zod both)`

스프레드 패턴.

#### C5 POST `/v1/contacts/bulk-delete` (L66-82) — bulk

**Meta**: `Auth: requireAuth + SuperAdmin | $$: — | logAction: 0 | CF: —`

표준.

#### C6 DELETE `/v1/contacts/:id` (L84-98) — single

**Meta**: `Auth: requireAuth + SuperAdmin(permanent) | $$: — | logAction: 0 | CF: —`

표준. L91 typo `"Only Super Admin"` (다른 파일들은 `"Only SuperAdmin"`) — R-REPO-5 incidental: client error-string drift.

### 3.6 `service-hosts.ts` — 5 endpoints

#### SH1 GET `/v1/service-hosts` (L14-39) — list with per-row enrich

**Meta**: `Auth: requireAuth | $$: — | logAction: 0 | CF: 015(no deleted_at column, status filter only), 020.a-variant(L21 no soft filter), 021(L30-37 Promise.all per-row)`

Zod query. `if (status)` push (L22) — 미지정 시 status="Deleted" 도 포함 → CF-015 + CF-020.a sentinel-variant. `Promise.all(rows.map(async ... await db.select(accountsTable)))` (L30-37) — 병렬화 했지만 N round-trips = CF-021.

#### SH2 POST `/v1/service-hosts` (L41-52) — create

**Meta**: `Auth: requireAuth | $$: — | logAction: 0 | CF: 017(Zod)`

Zod body. account 별도 lookup (L48-50) for response enrichment.

#### SH3 GET `/v1/service-hosts/:id` (L54-66) — detail

**Meta**: `Auth: requireAuth | $$: — | logAction: 0 | CF: 020.a-variant, 017(Zod params)`

`Number(req.params.id)` 후 Zod — 우회 패턴 (다른 파일은 raw req.params Zod 직접). account enrichment 추가 fetch.

#### SH4 PUT `/v1/service-hosts/:id` (L68-79) — update

**Meta**: `Auth: requireAuth | $$: — | logAction: 0 | CF: 017(schema 재사용 risk), 022(implicit)`

**`CreateServiceHostBody.safeParse(req.body)` 재사용** (L71) — 별도 Update schema 부재. PUT 인데 Create schema 강제 → 모든 NOT NULL 필드 (name) 필수 → partial update 불가. **partial 의도 시 client 가 전체 payload 보내야 함**. R-REPO-5 incidental: schema-reuse antipattern + UpdateServiceHostParams (L69) 만 있고 UpdateServiceHostBody 부재 = api-zod 누락.

#### SH5 DELETE `/v1/service-hosts/:id` (L81-87) — sentinel-soft delete

**Meta**: `Auth: requireAuth | $$: — | logAction: 0 | CF: 015(sentinel-via-status, no SA gate, no permanent option, no bulk-delete)`

`set({status:"Deleted"})` — **단일 sentinel-soft 패턴**. SA gate 없음 (다른 6 파일과 다름). permanent option 없음. bulk-delete endpoint 자체 부재. **CF-015 핵심 anchor** — 도메인 정책 비균질의 가장 명확한 예시.

### 3.7 `promotions.ts` — 8 endpoints

#### P1 GET `/v1/promotions` (L41-53) — list

**Meta**: `Auth: requireAuth | $$: discount_percentage(real)→response | logAction: 0 | CF: 001, 020.a✅(L45), 017(Zod)`

inline Zod (L6-10). orderBy name. real carrier 응답 노출 (CF-001 anchor).

#### P2 POST `/v1/promotions` (L55-60) — create

**Meta**: `Auth: requireAuth | $$: discount_percentage(real, L58) | logAction: 0 | CF: 001, 017(Zod)`

Zod body (L12-32 풍부한 schema). `db.insert(...).values(parsed.data)` raw spread — `z.coerce.number()` 가 client string 을 number 로 변환. real 컬럼 직접 set.

#### P3 GET `/v1/promotions/:id` (L62-68) — detail

**Meta**: `Auth: requireAuth | $$: real→response | logAction: 0 | CF: 001, 020.a❌(no isNull), 017(Zod params)`

soft-deleted leak.

#### P4 PUT `/v1/promotions/:id` (L70-81) — update

**Meta**: `Auth: requireAuth | $$: real(L75-77) | logAction: 0 | CF: 001, 020.b❌, 017(Zod)`

`UpdatePromotionBody = CreatePromotionBody.partial()` (L36) — 정상 partial Zod. spread set.

#### P5 POST `/v1/promotions/bulk-delete` (L83-99) — bulk

**Meta**: `Auth: requireAuth + SuperAdmin | $$: — | logAction: 0 | CF: —`

표준.

#### P6 DELETE `/v1/promotions/:id` (L101-115) — single

**Meta**: `Auth: requireAuth + SuperAdmin(permanent) | $$: — | logAction: 0 | CF: —`

표준.

#### P7 GET `/v1/promotions/:id/associated-products` (L119-153) — reverse-lookup

**Meta**: `Auth: requireAuth | $$: price(numeric)/base_price(real)→response | logAction: 0 | CF: 001(base_price re-leak), 019.a-CANDIDATE-readsite, 020.a❌(no isNull on either join target)`

**CF-019.a candidate cross-check anchor**: L135 `where(eq(accommodationCatalogTable.promotion_id, promoId))` + L146 `where(eq(serviceCatalogTable.promotion_id, promoId))` — **read-only join** 두 catalog 테이블에서 promotion_id 컬럼 사용. accommodation_catalog 와 service_catalog 양쪽 모두 promotion_id 가 schema 에 선언돼 있고 본 endpoint 가 reverse-lookup read 만 수행. write site 는 본 도메인 0건.

`Promise.all([accommodation_select, service_select])` 병렬 — 정상. 다만 양 join 모두 `isNull(deleted_at)` 미설정 → soft-deleted catalog row 가 promotion association 응답에 포함될 수 있음.

#### P8 GET `/v1/lookup/promotions` (L155-178) — slim lookup

**Meta**: `Auth: requireAuth | $$: discount_percentage(real)→display string | logAction: 0 | CF: 001, 020.a❌(no isNull)`

display string composite L173 `${name}${term_type}${discount}` — UI dropdown 용. real 노출.

---

## 4. Self-check matrix (51 × 7 = 357 cells)

7 차원: **AuthOK / `$$`OK / Zod / softDel-list / softDel-byId / softDel-mut / logAction**.
Legend: ✅ = OK · ❌ = gap (CF anchor) · — = N/A.

| Endpoint | AuthOK | $$OK | Zod | sd-list | sd-byId | sd-mut | logAct |
|---|---|---|---|---|---|---|---|
| WO1 | ✅ | ❌ (real) | ❌ | ✅ | — | — | ❌ |
| WO2 | ✅ | ❌ (real) | ✅ | — | — | — | ❌ |
| WO3 | ✅ | — | ❌ (raw id) | — | ❌ | — | ❌ |
| WO4 | ✅ | ❌ (real) | partial | — | — | ❌ | ❌ |
| WO5 | ✅ +SA | — | partial | — | — | — | ❌ |
| WO6 | ✅ +SA | — | ❌ | — | — | — | ❌ |
| WO7 | ✅ | — | ❌ | — | — | — (state-gate ✅) | ❌ |
| WO8 | ✅ | — | ❌ | — | — | — (state-gate ✅) | ❌ |
| WO9 | ✅ | ❌ (real) | ✅ | — | — | ❌ (no precondition CF-022) | ❌ |
| WO10 | ✅ | — | ✅ | — | — | ❌ (CF-022) | ❌ |
| L1 | ✅ | numeric ✅ | ✅ | ✅ | — | — | ❌ |
| L2 | ✅ | numeric ✅ | ✅ | — | — | — | ❌ |
| L3 | ✅ | numeric ✅ | ✅ | — | ❌ | — | ❌ |
| L4 | ✅ | — | ✅ | — | — | ❌ | ❌ |
| L5 | ✅ +SA | — | ❌ | — | — | — | ❌ |
| L6 | ✅ +SA | — | ✅ | — | — | — | ❌ |
| L7 | ✅ | — | ✅ | — | — | ✅ (CF-022 ✅; **fake booking_ref bug**) | ❌ |
| L8 | ✅ | — | ✅ | — | — | ❌ (CF-022) | ❌ |
| T1 | ✅ | — | ✅ | ✅ | — | — | ❌ |
| T2 | ✅ | — | ✅ | — | — | — | ❌ |
| T3 | ✅ | — | ✅ | — | ❌ | — | ❌ |
| T4 | ✅ | — | ✅ | — | — | ❌ | ❌ |
| T5 | ✅ +SA | — | ❌ | — | — | — | ❌ |
| T6 | ✅ +SA | — | ✅ | — | — | — | ❌ |
| T7 | ✅ | — | ✅ | — | — | ❌ (CF-022) | ❌ |
| CT1 | ✅ (per-h) | — | ad-hoc | — | — | — | ❌ |
| CT2 | ✅ (per-h) | — | ❌ | ✅ | — | — | ❌ |
| CT3 | ✅ (per-h) | — | ❌ | — | ❌ | — | ❌ |
| CT4 | ✅ (per-h) | — | whitelist | — | — | ❌ (CF-022) | ❌ |
| CT5 | ✅ (per-h) | — | ad-hoc | — | — | ✅ (gated auto-status) | ❌ |
| CT6 | ✅ +SA | — | ❌ | — | — | — | ❌ |
| CT7 | ✅ +SA | — | ❌ | — | — | — | ❌ |
| C1 | ✅ | — | ✅ | ✅ | — | — | ❌ |
| C2 | ✅ | — | ✅ | — | — | — | ❌ |
| C3 | ✅ | — | ✅ | — | ❌ | — | ❌ |
| C4 | ✅ | — | ✅ | — | — | ❌ | ❌ |
| C5 | ✅ +SA | — | ❌ | — | — | — | ❌ |
| C6 | ✅ +SA | — | ✅ | — | — | — | ❌ |
| SH1 | ✅ | — | ✅ | ❌ (sentinel) | — | — | ❌ |
| SH2 | ✅ | — | ✅ | — | — | — | ❌ |
| SH3 | ✅ | — | ✅ | — | ❌ (sentinel) | — | ❌ |
| SH4 | ✅ | — | reuse | — | — | ❌ | ❌ |
| SH5 | ✅ (no SA) | — | ✅ | — | — | sentinel-soft | ❌ |
| P1 | ✅ | ❌ (real) | ✅ | ✅ | — | — | ❌ |
| P2 | ✅ | ❌ (real) | ✅ | — | — | — | ❌ |
| P3 | ✅ | ❌ (real) | ✅ | — | ❌ | — | ❌ |
| P4 | ✅ | ❌ (real) | ✅ | — | — | ❌ | ❌ |
| P5 | ✅ +SA | — | ❌ | — | — | — | ❌ |
| P6 | ✅ +SA | — | ✅ | — | — | — | ❌ |
| P7 | ✅ | ❌ (base_price re-leak) | ✅ | — | ❌ | — | ❌ |
| P8 | ✅ | ❌ (real) | ❌ | — | — | — | ❌ |

**Aggregates** (51 endpoints):
- Auth: 51/51 ✅ (100%)
- `$$`: 9 real-carrier endpoints ❌ (work_orders 4 + promotions 5)
- Zod: 31 ✅ end-to-end · 11 partial/ad-hoc/raw · 9 ❌ (Zod 부재)
- soft-delete list: 6/7 list endpoints ✅, 1 sentinel-variant (SH1) ❌
- soft-delete byId: 8 ❌ (CF-020.a, 8 신규 anchor)
- soft-delete mutator (zombie revival): 15 ❌ (CF-020.b, 15 신규 anchor)
- logAction: 0/51 ✅ (0%) — **CF-008 LOWEST 동률 with ops-catalog**

---

## 5. Spot-check verification log (Step 4)

### C1 — work-orders.ts CF-022 / CF-001 / CF-021 동시 anchor 정확성

**Claim**: WO1 GET `/v1/work-orders` (L52-64) 의 `enrichWorkOrders()` (L21-50) 가 3 sequential per-id loop 를 실행 = CF-021 strong anchor; WO9 POST `/:id/complete` (L169-185) 가 cost: real 직접 set + precondition gate 부재 = CF-001 + CF-022 joint anchor.

**Re-verification**:
- L21-42 — `for (const id of propertyIds)`, `for (const id of spaceIds)`, `for (const id of contactIds)` 3 sequential loops ✅. 각 loop 내 `await db.select(...).where(eq(id))` — 비병렬, dependency 없음. **3·distinct_count + 1 round-trips per page** 산식 정확.
- L19 schema `cost: real("cost")` ✅ (re-grep `grep -n "cost" lib/db/src/schema/work_orders.ts` → L19 only).
- L177 `if (parsed.data.cost != null) updates.cost = parsed.data.cost` — Zod 검증 후 직접 set, real 컬럼 입력 정확.
- L179-181 `where(eq(workOrdersTable.id, ...))` — **precondition gate 부재 확인 (CF-022 ❌ side)**. L149-153 `/start` 와 비교: `where(and(eq(id), eq(status,"Open")))` 명시 — same file 내 패턴 분기 명백.

**Result**: ✅ 3 anchor 모두 정확. **추가 발견**: `enrichWorkOrders()` 가 `Promise.all` 사용하지 않고 순수 `for...of await` 사용 — service-hosts.ts:30 의 `Promise.all(rows.map(async))` 보다 더 순차적 = round-trip latency 누적. **저자 패턴 다양성**: ops-crm 7 파일 中 CF-021 처리 방식이 (a) leftJoin (leads/tasks-list/cs-tickets), (b) Promise.all per-row (service-hosts), (c) sequential per-id (work-orders), (d) sequential per-detail (tasks-detail) 4 가지로 분기 — **single domain 내 4 분기는 codebase 전체에서 가장 다양한 N+1 spectrum**. CF-021 P1 정당화 강화.

### C2 — leads.ts L7 PATCH /convert 의 fake booking_ref bug 검증

**Claim**: L188 `const bookingRef = "BK-${year}-${random.10000-99999}"` 가 *문자열만 생성*하고 bookings 테이블 INSERT 부재 → R-REPO-5 incidental (impact: T002.5 state-machines 에 reconciliation 추가 필요).

**Re-verification**:
- L175-203 전체 핸들러 — `db.insert(bookingsTable)` 또는 `db.insert(bookingsTable.*)` grep 0 ✅
- `grep -n "bookingsTable\|insertBooking" artifacts/api-server/src/routes/leads.ts` → L0 hit (전혀 없음) ✅
- L199-202 응답 — `{ booking_ref: bookingRef, lead_ref: updated!.lead_ref }` — booking_ref 클라이언트 반환 only
- 비교: bookings.ts (T002.2.j 예정) 의 actual booking ref 생성 패턴은 별도 — leads.ts L188 의 random ref 와 collide 가능성 높음 (UUID 도 아니고 5-digit random, prefix 같음).

**Result**: ✅ Bug 100% 확인. **승격 결정**: 본 발견은 단순 incidental 이 아니라 **functional bug** — Phase 2 검토 항목. 그러나 *파괴적이지 않음* (lead.lead_status 정상 갱신, booking 생성은 다른 fork 가정 시 의미상 문제 없음 — 다만 *호출자가 booking_ref 를 진짜로 사용*하면 404). **분류**: R-REPO-5 단순 메모 → T002.5 state-machines 에서 booking 생성 흐름 전수 audit 시 cross-check; 승격 보류.

### C3 — CF-022 promotion 결정 (4 핸들러 동일-파일 inconsistency 정확성)

**Claim**: work-orders 2/4 ✅ + leads 1/2 ✅ + tasks 0/1 + cs-tickets PUT 0/1 (CT5 ✅) → **5 gated + 4 ungated transitions** 동일 도메인 내 mixed pattern → CF-022 P1 등재 정당.

**Re-verification per-line**:
- WO7 L152 `where(and(eq(id), eq(status,"Open")))` ✅ gated
- WO8 L162 `where(and(eq(id), eq(status,"InProgress")))` ✅ gated
- WO9 L180 `where(eq(id))` ❌ ungated
- WO10 L196 `where(eq(id))` ❌ ungated
- L7 (leads convert) L183 explicit `if (lead.lead_status === "ConvertedToBooking") return 400` ✅ gated
- L8 (leads mark-lost) L210 `where(eq(id))` ❌ ungated
- T7 (tasks complete) L178 `where(eq(id))` ❌ ungated
- CT4 (cs-tickets PUT) L130 `where(eq(id))` ❌ ungated (whitelist 만, transition graph 부재)
- CT5 (cs-tickets POST messages auto-status) L167 `where(and(eq(id), eq(status,"Open")))` ✅ gated

**Result**: ✅ 산식 5 ✅ + 4 ❌ 정확. **승격 결정**: **CF-022 P1 신규 등재 확정**. 근거 (R-REPO-7 trade-off):
- (a) 등재 (P1) 채택 ← **추천**: 9개 transition 中 4개 (44%) 가 무가드 + same-file inconsistency 가 의도된 게이트 vs 누락된 게이트 차이 명확 → fix-able pattern; CF-008 audit 부재와 compound; data integrity (rows 보존되나 *상태 기반 비즈니스 로직 분기*가 잘못된 row 에 작동) 직접 영향. P1 = 데이터 손상이 아니므로 P0 아님.
- (b) Sub-pattern of CF-018 (.c) 미채택: CF-018 은 IDOR / authorization-scope 라 root cause 다름. 혼재 시 future audit 시 cross-cut 어려움.
- (c) Park as candidate 미채택: 9 anchor / same-file inconsistency 가 임계 (T002.1.9 model: ≥5 anchors / ≥2 distinct files = promote) 이미 충족.

**Step 5 carrier 의무**: CRITICAL_FINDINGS.md 에 CF-022 신규 등재 (P1). counts P0=3 / P1=**16** / P2=3 = **22**.

---

## 6. R-REPO-5 incidentals — sub-task closeout

본 sub-task (T002.2.e) 작성 중 발견된 시키지 않은 패턴/오류:

1. **incidental-1**: WO2 (L13-19 `nextOrderRef`) **race condition + retry 부재** vs L2 (`leadRef.ts:15-44` 6-attempt retry on 23505) — work-orders 가 더 위험 (concurrent admin clicks → 500). **impact: 단순 메모** → T004 architecture-rules "ref generation pattern" anchor.
2. **incidental-2**: 6 파일 (work-orders, leads, tasks, cs-tickets, contacts, promotions) 의 bulk-delete + DELETE handler 가 **거의 동일한 18-line 패턴** 반복 (SA gate + permanent flag + soft default). common helper 추출 후보. **impact: 단순 메모** → T004.
3. **incidental-3**: T1 L65 `${first_name} ${account_name}` — primary_contact_name 조립에 account_name 을 이어붙임 (의도가 contact.last_name 이어야 자연스러움). **impact: 코드 버그 가능성** → R-REPO-5 (b) 평가: fix 는 코드 수정이라 본 mini-task 범위 외. 단순 메모 → T002.5 또는 T004 에서 데이터-layer naming 검토.
4. **incidental-4**: L7 (leads convert) L188 **fake booking_ref 생성** (random string, INSERT 부재) — C2 spot-check 에서 검증. **impact: T002.5 state-machines audit 시 cross-check 의무** (booking 생성 fork 추적). 단순 메모.
5. **incidental-5**: CT1 prefix `/v1/cs/admin/upload-image` 가 다른 6개 (`/v1/cs-tickets/*`) 와 다름 — URL routing 의도성 모호. **impact: 단순 메모** → T004 또는 T008 README API surface 정리 시 cross-ref.
6. **incidental-6**: SH4 L71 `CreateServiceHostBody.safeParse(req.body)` 재사용 (PUT 인데 Create schema) — partial update 불가, NOT NULL violation risk. **impact: 단순 메모** → T004 또는 CF-017 expansion 후속 (현재는 single-anchor 라 별도 expansion 불필요).
7. **incidental-7**: C6 L91 typo `"Only Super Admin"` (다른 모든 파일은 `"Only SuperAdmin"`) — error string drift. **impact: 단순 메모** → T004.
8. **incidental-8**: CF-019.a candidate `service_catalog.promotion_id` cross-check 결과 = ops-crm 도메인에서 write site 0건 (본 §2.6) — 변경 없이 CANDIDATE 상태 유지. T002.3 db-schema-overview 에서 최종 결정. **impact: 단순 메모** (이미 CF-019 anchor table 에 CANDIDATE row 존재).

**Net impact**: 8 incidental 모두 단순 메모; **신규 mini-task 분리 불필요** (R-REPO-5 (e) 전수 단순 메모 분류). T002.2.e atomic commit 본 산출물에 포함, 후속 sub-task 자동 진행 안 함 (R-REPO-4 명시).

---

*end of `ops-crm.md` — 51 endpoints documented across 7 files, R-REPO-1 v2 / 4 / 5 / 6 / 7 적용, T002.2.e sub-task 완료. CF-022 신규 P1 promotion ready for Step 5 atomic carrier.*
