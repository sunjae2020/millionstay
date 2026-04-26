# Domain — `ops-catalog`

> **Scope**: 카탈로그 마스터 데이터 5 라우트 파일 (39 endpoints) — accommodation 상품, contract 상품, 서비스 옵션, 룩업 분류 (group/type).
>
> **Read order**: §1 (Overview + 🪦 ghost) → §2 (Cross-Cutting Findings 9 항목) → §3 (Endpoint Catalogue, 5 sub-files) → §4 (Self-Check Matrix 39×7) → §5 (Spot-Check Verification Log).
>
> **Conventions**: file:line 인용, 산문 한국어, 코드 영문, Format A (전체 안전·재무 anchor 후보) / Format B (CRUD 변형) / Format C (단순 룩업) 혼합.
>
> **Cross-references**:
> - [`../SCHEMA_FILE_TABLE_MAP.md`](../SCHEMA_FILE_TABLE_MAP.md) §1.2 — products.ts file vs `contract_products` table 명명 분기
> - [`../../_audit/CRITICAL_FINDINGS.md`](../../_audit/CRITICAL_FINDINGS.md) — CF-001/008/009/016/017/018/019/020/021
> - [`./contract.md`](./contract.md), [`./booking.md`](./booking.md), [`./finance-invoicing.md`](./finance-invoicing.md), [`./ops-property.md`](./ops-property.md) — downstream consumers

---

## 1. Domain Overview

### 1.1 Scope · File · Endpoint matrix

| # | Route file | Mount prefix | Endpoints | Active table(s) | Format mix |
|---|---|---|---|---|---|
| 1 | `product-catalog.ts` (305 L) | `/api/v1/accommodations` + `/v1/lookup/products` | **11** | `accommodation_catalog`, `accommodation_service_catalog` (read), `service_catalog` (join read) | 2 A + 9 B |
| 2 | `products.ts` (207 L) | `/api/v1/contract-products` + `/v1/lookup/contract-products` | **10** | `contract_products` (file misnamed; see CF-016 + [SCHEMA_FILE_TABLE_MAP §3](../SCHEMA_FILE_TABLE_MAP.md#3-file-name-vs-table-name-divergences-the-trap)) | 4 A + 6 B |
| 3 | `product-types.ts` (97 L) | `/api/v1/product-types` | **6** | `product_types` | 6 C |
| 4 | `product-groups.ts` (97 L) | `/api/v1/product-groups` | **6** | `product_groups` | 6 C |
| 5 | `service-catalog.ts` (111 L) | `/api/v1/services` | **6** | `service_catalog` (CF-001 `real` carrier) | 3 A + 3 B |
| **Σ** | | | **39** | 6 active tables (+ 1 schema-only ghost — see §1.5) | |

**Total file LOC**: 817 (avg 21 LOC/endpoint — ops-property 11 LOC/ep 보다 2× rich, 즉 헬퍼 enrichment 비중 큼).

### 1.2 Auth / Mount wiring (`artifacts/api-server/src/routes/index.ts`)

5 라우터 모두 **router-level auth 미선언** — `index.ts` global mount 후 `requireAuth` middleware 가 일괄 적용된다 (cf. `index.ts:79` "BEFORE the requireAuth middleware to allow partner JWT auth to bypass" — 본 5 라우터는 그 분기점 *뒤*에 등록되어 admin JWT 강제).

- `index.ts:4` `import productCatalogRouter from "./product-catalog"`
- `index.ts:6` `import productGroupsRouter from "./product-groups"`
- `index.ts:7` `import productTypesRouter from "./product-types"`
- `index.ts:23` `import productsRouter from "./products"` (file name 은 `products` 이지만 **수용 라우트는 `/v1/contract-products/*`** — 사용자 혼동 risk)
- `index.ts:36` `import serviceCatalogRouter from "./service-catalog"`

**Auth 표** (INDEX.md 일치 검증): 5/5 = `requireAuth` (admin JWT) | partner-portal/guest auth 우회 없음 ✅.

**SuperAdmin role gate**: 4 mutator endpoint 에 한정 — `products.ts:132` (bulk-delete), `products.ts:153` (permanent DELETE), `service-catalog.ts:75` (bulk-delete), `service-catalog.ts:98` (permanent DELETE), `product-types.ts:60+82`, `product-groups.ts:60+82` (대칭). 총 **8 SuperAdmin gates** across 4 files. `product-catalog.ts` 단일 예외 — bulk-delete/permanent-delete 자체가 없음 (DELETE handler `L162-172` 직접 hard-delete, role gate 부재 — §3.1.E10 evidence).

### 1.3 Cross-domain dependencies

| Out-bound (이 도메인이 의존) | In-bound (이 도메인을 참조) |
|---|---|
| `productGroupsTable` (lookup, FK convention) | `bookings.ts`, `contracts.ts`, `contract-line-items.ts` (accommodation_id/product_id) |
| `productTypesTable` (lookup) | dashboard reports (read-only) |
| `spacesTable` (FK convention via `space_id`) | — |
| `accountsTable` (provider/source) | — |
| `promotionsTable` (FK convention via `promotion_id`) | — |
| `serviceCatalogTable` ↔ `accommodationServiceCatalogTable` ↔ `spaceServiceCatalogTable` (3-way cross) | — |

**0 `.references()` declared** (CF-002 carrier 일치) — 위 모든 의존 관계는 application-level integer 컬럼 + manual JOIN 으로 운영, DB-level RI 부재.

### 1.4 Severity / risk badges

도메인 risk **🟡 P1** (per INDEX.md row 45-49):

- 🪦 **CF-009** (revised): `product_catalog` TABLE = schema-only ghost (§1.5 별도 항)
- 🟠 **CF-016**: products.ts file ≠ `contract_products` table (Phase-2 migration friction)
- 🔴 **CF-008**: 5 of 5 files = **0 logAction** = `0/39 = 0%` audit coverage → **NEW domain-LOWEST** (ops-property 13.3% 보다 더 낮음)
- 🟠 **CF-001**: 11 `real` 컬럼 across 4 active tables (accommodation_catalog 7 + service_catalog 1 + accommodation_service_catalog 1 + space_service_catalog 1 + product_catalog ghost 4 = ghost 제외 11 active + 4 ghost) — booking/contract 도메인 으로 lossy precision 전파 carrier
- 🟠 **CF-017**: 0 of 5 files use Zod runtime validation → 5/5 = **100% gap** (booking.ts 와 정반대)
- 🟡 **CF-018**: 1 nested-mapping endpoint pair (`product-catalog.ts:228-265`) **올바른** composite WHERE 사용 ✅ (positive exemplar)
- 🟠 **CF-019**: products.ts `effective_weekly_rate` 컬럼 client-supplied 수용 (calculated-on-read but stored-on-write inconsistency) → §3.2.E2/E4 evidence
- 🟠 **CF-020.a**: `GET /:id` 4 of 5 라우트가 `deleted_at` 가드 누락 (products.ts:89, product-types.ts:23, product-groups.ts:23, service-catalog.ts:37) — soft-deleted record 가 ID 직접 접근으로 노출
- 🟠 **CF-021** sub-patterns: 2 distinct N+1 sites — products.ts:7-37 enrich() per-id for-loop SELECT (NOT `inArray`); product-catalog.ts:100-125 GET /:id 4-sequential SELECT (group/type/space/provider)

### 1.5 🪦 Schema-only ghost: `product_catalog` TABLE

> **Discovery context**: T002.1.6 "products vs contract_products" 정정 mini-task → `SCHEMA_FILE_TABLE_MAP §1.2` ground truth 확정. 본 도메인의 5 라우트 파일 **그 어느 것도** `productCatalogTable` 을 import 하지 않는다.

**Schema location**: `lib/db/src/schema/product_catalog.ts:3` — `export const productCatalogTable = pgTable("product_catalog", { ... })`.

**Wiring**: `lib/db/src/schema/index.ts` 에 re-export 됨 → Drizzle migration 시 DB 에 실제 테이블 생성됨. 그러나:
- **0 import** in `artifacts/api-server/src/routes/**`
- **0 import** in `artifacts/*-portal/**`
- **0 import** in `lib/**` outside `schema/`

**Inferred original intent (이 컬럼이 묶인 패턴)**: contract-products 같지만 weekly/billing 필드 부재 → 일회성 부가 상품 (e.g. parking, storage)을 위한 별도 카탈로그 가설. accommodation-catalog 가 모든 컬럼을 흡수하면서 본 테이블이 dead 된 것으로 추정 (accommodation_catalog `real` 컬럼 superset).

**4 `real` money columns (전수 enumeration, schema 와 1:1 대응)** — CF-001 carrier:
| # | Column | Schema line | Note |
|---|---|---|---|
| 1 | `price` | `product_catalog.ts:8` | 기본 단가 (보존 정밀도 유실) |
| 2 | `bond_amount` | `product_catalog.ts:18` | 보증금 |
| 3 | `admin_fee` | `product_catalog.ts:19` | 관리비 |
| 4 | `cleaning_fee` | `product_catalog.ts:20` | 청소비 |

**왜 위험한가 (정량)**: 이 4 컬럼이 *코드에서 read 되지 않음에도* `npm run db:push` / Drizzle migration 결과로 **prod DB 에 빈 테이블 형태로 존재**한다. 다음 위험 시나리오:
1. **CF-009 revival risk**: 미래 개발자가 "이미 있는 product_catalog 쓰면 되겠네" 하고 직접 SQL INSERT → 비공식 데이터 silo 생성, accommodation_catalog 와 분기.
2. **CF-001 silent carry**: 만약 누군가 본 테이블에 SELECT 코드를 뒤늦게 추가하면, 4 `real` 컬럼이 자동으로 lossy 전파 사슬에 합류 (현재는 dead → no harm, 활성화 시 harm).
3. **CF-016 confusion vector**: file name `product_catalog.ts` 가 `products.ts` (= contract_products) 와 시각적으로 매우 유사 → 미래 grep 으로 "products" 검색 시 양쪽 파일 모두 hit, 혼동 가속.

**권장 처분 (T004 financial-rules 후보)**:
- (a) **DROP TABLE** + schema 파일 + index re-export 모두 삭제 — 가장 깨끗하나 migration 1회 실행 필요.
- (b) **유지하되 schema 파일 상단 deprecation 주석 + 라우트 단 자동-flag CI rule** — 가시성 부여하지만 dead 잔존.
- (c) **현상 유지** — recommendation 없음 (CF-009 risk 그대로).

추천: (a) — 단, prod 데이터 0 row 확인 후 (현재 코드 상 INSERT 경로 0 → 데이터 없을 가능성 매우 높음).

---

## 2. Cross-Cutting Findings Summary (이 도메인 전체 매트릭스)

| Finding | Files affected | Endpoints affected | 비고 |
|---|---|---|---|
| **CF-001** `real` money carrier | 5/5 (read), 4/5 (write) | ~22/39 | accommodation_catalog 7 + service_catalog 1 + 2 mapping `custom_price` + product_catalog ghost 4 |
| **CF-008** logAction = 0 | 5/5 | **0/39 (0%)** | 5 파일 어디에도 `logAction` import 없음 — `grep -l logAction artifacts/api-server/src/routes/{product-catalog,products,product-types,product-groups,service-catalog}.ts` → 0 hit |
| **CF-009** dead schema | 0 route | n/a | `product_catalog` TABLE only (§1.5) |
| **CF-016** file/table name 불일치 | 1 (products.ts) | 10 | `products.ts` defines `contract_products` |
| **CF-017** Zod 부재 | 5/5 | 39/39 | `if (!name)` 류 string-truthy 검증만 (5 사이트) |
| **CF-018.SAFE** nested mapping IDOR | 1 positive (product-catalog.ts:228-265) | 2 endpoint (PUT + DELETE mapping) | composite WHERE `(mapId AND accommodation_id)` ✅ |
| **CF-019** write-orphan field | 1 (products.ts) | 2 (POST/PUT contract-products) | `effective_weekly_rate` client-supplied 수용 |
| **CF-020.a** GET /:id soft-delete leak | 4/5 | 4 endpoint | products.ts:89, product-types.ts:23, product-groups.ts:23, service-catalog.ts:37 |
| **CF-020.b** mutation revival | 0 | 0 | 본 도메인은 PUT 기본 deleted_at 보존 — leak 없음 |
| **CF-021.A** batched-not-N+1 | 1 (product-catalog.ts:35-67) | 1 (GET list) | `Promise.all` + `inArray` 6-batch ✅ positive |
| **CF-021.B** N+1 sequential single-row | 2 sites | 3 endpoint | (i) products.ts:7-37 enrich() per-id for-loop; (ii) product-catalog.ts:100-125 GET :id 4 SELECT chain |

**Net new evidence vs T002.2.b/c baseline**: CF-019 +1 carrier (effective_weekly_rate), CF-020.a +4 anchors, CF-021.B +2 sub-pattern instances, CF-008 갱신 0% (NEW LOWEST). **신규 CF: 0** (predicted; CF-019 만 expand).

---

## 3. Endpoint Catalogue

### 3.1 `product-catalog.ts` (11 endpoints) — Format A×2 + B×9

> **Table focus**: `accommodation_catalog` (메인), `accommodation_service_catalog` (nested mapping), `service_catalog` (join read).
> **File-level Meta**: Auth `requireAuth` (global) | $$ 7 `real` 컬럼 source | logAction 0/11 | CF-001/008/017/021.A/021.B/018.SAFE.

#### E1 · `GET /v1/accommodations` (L17-98) — **Format A** [list with 6-batch enrichment]

**Meta**: Auth `requireAuth` | $$ — read-only (price/weekly_rate/bond_amount/etc) | logAction ❌ | CF-021.A (positive), CF-001

**Behavior**:
- Filters (L19-31): `q` (ilike on name OR description), `product_group_id`, `product_type_id`, `promotion_id`, `is_active` (Active/Inactive 매핑).
- Pagination (L41-42): `limit=100` default, `offset=0`. **Limit 상한 없음** — 클라이언트가 `limit=999999` 가능 (CF-017 evidence).
- Main query L36-43 + count query L43 → `Promise.all` 병렬 ✅ — count 별도 round-trip, single-tx 보장 없음 (race window: list count vs row count 가 미세 분기 가능).
- Enrichment L46-67: 5 distinct in-array batches (groups/types/spaces/providers/promos) + 1 services join — 모두 `Promise.all` + `inArray(table.id, ids)` ✅ **N+1 회피 모범**.
- Service mapping L74-79: filter `is_mandatory === true` only — optional services는 packed_services 에서 제외 (UI 만 표기 의도로 추정).

**Risks / nuances**:
- (R1) L93 응답 envelope: `{ success, data, meta }` — 다른 list endpoint (e.g. `service-catalog.ts:26`) 와 일관 ✅.
- (R2) L24 `ilike(... item_description, ${q})` 가 `null` description row 에 대해 PostgreSQL 에서 `false` 평가 → false-negative 검색 가능, 그러나 명시적.
- (R3) L48 `r.space_id.filter(Boolean)` — `space_id=0` 도 falsy 로 제외 (정상; serial PK 는 1부터).

**Spot-check anchor (C1 후보)**: 6-batch enrichment 패턴 — 본 도메인 유일한 N+1 회피 모범, products.ts:7-37 와 대비.

---

#### E2 · `GET /v1/accommodations/:id` (L100-125) — **Format A** [single with N+1 sequential]

**Meta**: Auth `requireAuth` | $$ — read | logAction ❌ | CF-021.B (anchor), CF-020 (no leak: accommodation_catalog has no `deleted_at` column — vacuous)

**Behavior**:
- L103 main SELECT.
- L106-113: **4 sequential single-row SELECT** for group/type/space/provider — `await` 4번 직렬, `Promise.all` 미사용. 개별 쿼리 부하 작음 (PK eq) 이지만 RT 4× 누적.

**Risks**:
- (R1) `inArray` + `Promise.all` 패턴 (E1 가 입증) 으로 1 RT 가능 — 4× → 1× 개선 여지. **CF-021.B sub-pattern anchor** (per single endpoint, fixed 4× factor).
- (R2) accommodation_catalog 는 `deleted_at` 컬럼이 schema 에 없음 (`accommodation_catalog.ts:1-41` 전체 스캔 확인) → soft-delete 의미 무, hard-delete only (E10 참조). **CF-020 vacuous** (적용 불가).
- (R3) 응답 envelope 가 E1 (`{success,data,meta}`) 와 다름 — bare object spread (`...row, group_name, ...`). **API 일관성 깨짐** — frontend 는 분기 처리 필요.

**Spot-check anchor (C1)**: L106-113 4-line N+1 chain.

---

#### E3 · `POST /v1/accommodations` (L127-137) — Format B

`POST /api/v1/accommodations` | Auth `requireAuth` | $$ insert (7 real) | log ❌ | CF-001/017

L129 `{ name, price, product_group_id, ...rest }` destructure → L131 `db.insert(...).values({ name, price, product_group_id, ...rest })`. 즉 **client body 의 모든 필드를 row 에 직접 매핑** — Zod 부재 → unknown columns 는 Drizzle 가 silently drop 하지만 known columns (status, is_mandatory, gst_included) 도 client 가 임의 값 강제 가능. **CF-017 evidence**: validation = `if (!name)` 단 1줄. 응답 status 201 ✅.

#### E4 · `PUT /v1/accommodations/:id` (L139-149) — Format B

`PUT /api/v1/accommodations/:id` | Auth `requireAuth` | $$ update | log ❌ | CF-017/020.b

L142 `{ id: _id, created_at, ...updates }` — id/created_at 만 strip → updated_at, deleted_at, status 등 **모두 client 수정 가능**. 만약 `deleted_at` 을 client 가 명시하면 강제 soft-delete 가능 (보안 risk). 그러나 accommodation_catalog 는 `deleted_at` 컬럼 자체가 없으므로 본 risk 는 vacuous, **CF-020.b 적용 불가**. status 임의 전이는 가능 (state machine 부재).

#### E5 · `PATCH /v1/accommodations/:id/deactivate` (L151-160) — Format B

`PATCH /api/v1/accommodations/:id/deactivate` | Auth `requireAuth` | $$ status only | log ❌ | —

L154 `set({ status: "Inactive" })` only. 별도 state machine 없음 (booking/contract 와 달리 status 가 free string). 404 처리 ✅. 대칭 endpoint `PATCH /:id/activate` 부재 — E4 PUT 으로 status 변경 가능하므로 의도적 단방향 추정.

#### E6 · `DELETE /v1/accommodations/:id` (L162-172) — Format B

`DELETE /api/v1/accommodations/:id` | Auth `requireAuth` | $$ hard-delete | log ❌ | CF-015 carrier

L166 `db.delete(accommodationCatalogTable)` — **무조건 hard-delete**, soft-delete 옵션 부재. SuperAdmin role gate **없음** (products.ts E10 와 대비) → role 단순 `requireAuth` 만족 시 누구나 hard-delete 가능. **CF-008 audit log 부재 + CF-015 hard-delete + role gate 부재** 3중 risk = **본 파일 가장 위험한 endpoint**. (예: 회계 정산 후 product 삭제 → contract_line_items 의 product_id orphan, FK 부재로 DB 차단 안 됨).

#### E7 · `GET /v1/accommodations/:id/services` (L177-205) — Format B

`GET /api/v1/accommodations/:id/services` | Auth `requireAuth` | $$ join read (base_price, custom_price) | log ❌ | CF-001 (base_price source)

`accommodation_service_catalog` ↔ `service_catalog` innerJoin (L198) — base_price (real, service_catalog.ts:8) 가 본 endpoint 응답에 노출됨, 즉 **CF-001 source-side 노출** (read-only, no transformation). 12 select columns L182-195. orderBy L200 `(sort_order, name)`. 단일 join, N+1 없음 ✅.

#### E8 · `POST /v1/accommodations/:id/services` (L208-226) — Format B

`POST /api/v1/accommodations/:id/services` | Auth `requireAuth` | $$ custom_price (real) | log ❌ | CF-017/018.SAFE/021.B

- L216-217: pre-insert duplicate check (`accommodation_id AND service_id`) → 409 if exists. **2 round-trip** (SELECT + INSERT) — `db.transaction()` **부재** → race window: 동시 2 POST 가 양쪽 SELECT 통과 후 양쪽 INSERT → unique constraint 부재 시 **2 row 중복 생성**. 스키마 `accommodation_service_catalog.ts:1-15` 에 unique 제약 없음 → race 실현 가능. **CF-014 sub-pattern carrier (소규모)**.
- L220 `custom_price: custom_price ?? null` — `real` 컬럼 직접 저장 (CF-001).
- 414 if `service_id` 누락만 검증 (Zod 부재) — `is_mandatory: boolean = false`, `sort_order: number = 0` 은 client free → CF-017.

#### E9 · `PUT /v1/accommodations/:id/services/:mapId` (L229-249) — Format B [CF-018.SAFE positive]

`PUT /api/v1/accommodations/:id/services/:mapId` | Auth `requireAuth` | $$ update | log ❌ | **CF-018.SAFE** (positive exemplar)

L242 WHERE = `and(eq(map.id, mapId), eq(map.accommodation_id, accId))` — **composite scope 가드 ✅**. 즉 다른 accommodation 의 mapping 을 임의 mapId 로 수정 시도해도 0 row → 404. **본 도메인에서 IDOR-safe 패턴의 유일한 anchor** — CF-018 의 SAFE 분류 7건 중 하나에 대응.

#### E10 · `DELETE /v1/accommodations/:id/services/:mapId` (L252-265) — Format B [CF-018.SAFE]

`DELETE /api/v1/accommodations/:id/services/:mapId` | Auth `requireAuth` | $$ hard-delete map row | log ❌ | CF-018.SAFE

L258 동일 composite WHERE. mapping 은 hard-delete (mapping table 자체에 `deleted_at` 없음, 정상). E6 와 달리 SuperAdmin gate 부재는 mapping 의 일회성 특성으로 정당화 가능.

#### E11 · `GET /v1/lookup/products` (L269-303) — Format B

`GET /api/v1/lookup/products` | Auth `requireAuth` | $$ read 9 컬럼 | log ❌ | CF-001 (weekly_rate, price 노출)

선택자 (booking/contract UI)용 lite-projection. WHERE = `status='Active'` 강제 (L272). limit 100 hard-coded (L293) — paging 없음. 응답 `display: \`${name} (${billing_frequency})\`` UI label 합성 — **DB 의 application-layer 합성 의존 패턴** (frontend 가 동일 합성 가능하나 일관성 위해 server-side). **N+1 없음** (단일 SELECT) ✅.

---

### 3.2 `products.ts` (10 endpoints) — Format A×4 + B×6

> **Table focus**: `contract_products` (file misnamed; CF-016 carrier).
> **File-level Meta**: Auth `requireAuth` (global) | $$ — `weekly_rate/monthly_rate/effective_weekly_rate/bond_weeks/advance_weeks` (5 real) | logAction 0/10 | CF-001/008/016/017/019/020.a/021.B.

#### E1 · `enrich()` helper (L7-37) — **Format A** [N+1 anchor + CF-019 calc site]

**Not an endpoint** — but called by 6 of 10 endpoints (E2,E3,E5,E8,E9,E10). 본 헬퍼가 본 파일 risk 의 절반 이상.

**Meta**: 호출자 endpoint 의 Meta 를 따름 | $$ `effective_weekly_rate` 계산 anchor | log ❌ | **CF-021.B (anchor)**, **CF-019 (anchor)**

**Behavior**:
- L10-16: spaceIds for-loop — **각 sid 마다 별도 SELECT** (`for (const sid of spaceIds) { db.select(...).where(eq(spacesTable.id, sid)) }`). N개 unique space → N round-trip.
- L18-24: promoIds for-loop — 동일 패턴, M unique promotion → M round-trip.
- **정량 (worst case)**: GET list 가 limit=100 row 반환, 각각 unique space + unique promotion → 200 sequential queries per call. 동일 작업이 product-catalog.ts E1 (`Promise.all` + `inArray`) 으로 1 round-trip 가능.
- L26-36: per-row mapper. L29 `effective_weekly_rate = parseFloat((p.weekly_rate * (1 - disc / 100)).toFixed(2))` — **server-computed, response-only**.

**CF-019 evidence (write-orphan path)**:
- L29 enrich() 가 `effective_weekly_rate` 를 read time 에 계산.
- 그러나 E3 POST L67 `effective_weekly_rate: data.effective_weekly_rate ?? null` + E5 PUT L108 동일 — **client body 값을 그대로 DB 저장**.
- 결과: persisted `effective_weekly_rate` 가 `weekly_rate * (1 - promo.discount/100)` 와 일치한다는 보장 없음. 다음 GET 호출 시 enrich() 가 재계산해 응답함 → **DB 와 응답 silently 분기**, 사용자 프로필/감사 추적 시 혼란.
- 다른 곳 (booking.ts, contracts.ts) 가 `contract_products.effective_weekly_rate` 를 SELECT 한다면 **stale value 가 invoice/quote 에 반영** 될 risk → financial integrity carrier.

**Recommendation**: (i) POST/PUT 에서 effective_weekly_rate 입력 무시 + 자체 계산값 저장, 또는 (ii) 컬럼 자체를 generated/view 로 전환하고 row 에서 제거.

---

#### E2 · `GET /v1/contract-products` (L39-53) — **Format A**

**Meta**: Auth `requireAuth` | $$ enrich() 경유 (L51) | log ❌ | CF-020.a (positive guard ✅), CF-021.B (via enrich)

L41 `isNull(contractProductsTable.deleted_at)` 가드 ✅ — soft-delete leak 방지. 6 filter (q/status/product_type/space_id/promotion_id/term_type). orderBy name. **paging 없음** — 모든 row 반환 → 100k row 시 OOM risk. enrich() 호출 → CF-021.B carrier.

#### E3 · `POST /v1/contract-products` (L55-85) — **Format A** [CF-019 write site]

**Meta**: Auth `requireAuth` | $$ insert 5 real | log ❌ | **CF-017/019**

- L57-82: 22-column INSERT, 모든 값 `data.X ?? <default>` 패턴 — Zod 부재.
- **L67 `effective_weekly_rate: data.effective_weekly_rate ?? null`** ← **CF-019 write-orphan anchor**: client 가 임의 값 (예: 0, 음수, 정상값과 다른 값) 전송 가능, 검증 부재. enrich() L29 가 응답 시점에는 재계산하나 persisted value 분기.
- L83 `enrich([row])` → 응답에서는 재계산값 노출 → client 입장 silent overwrite, dev 가 인식 어려움.
- 404 처리 부재 (insert 실패 시 try/catch 없음 — express-async-handler 의존).

#### E4 · `GET /v1/contract-products/:id` (L87-93) — Format B [CF-020.a leak anchor]

`GET /api/v1/contract-products/:id` | Auth `requireAuth` | $$ enrich (real) | log ❌ | **CF-020.a (anchor)**, CF-021.B

L89 SELECT — **`isNull(deleted_at)` 가드 부재** → soft-deleted contract_product 가 ID 직접 접근으로 노출. archive 후 history reference 의도일 수 있으나 다른 GET (E2 list) 는 가드 → **불일치**. **CF-020.a evidence anchor**.

#### E5 · `PUT /v1/contract-products/:id` (L95-128) — **Format A**

**Meta**: Auth `requireAuth` | $$ update 5 real | log ❌ | **CF-017/019/020.b**

- L98-124: 22-column UPDATE, defaults 가 INSERT 와 다름 (예: `bond_weeks: data.bond_weeks ?? null` vs INSERT `?? 4`) — **silent default drift**. PUT 으로 partial update 시도 시 client 가 미명시한 컬럼이 null 로 덮어써짐 (PATCH semantics 아님, full PUT).
- L108 `effective_weekly_rate: data.effective_weekly_rate ?? null` — E3 와 동일 CF-019.
- `deleted_at` 컬럼은 명시 spread 에 없음 → **CF-020.b safe** (revival 불가) ✅.
- L125 `if (!row)` 404 — UPDATE returning 0 row 시 적절 ✅.

#### E6 · `POST /v1/contract-products/bulk-delete` (L130-146) — Format B

`POST /api/v1/contract-products/bulk-delete` | Auth `requireAuth` + **SuperAdmin** L132 | $$ — | log ❌ | CF-008/015

`{ ids, permanent }` 수용. permanent=true 시 hard-delete (L141), 아니면 `deleted_at + status='Archived'` (L143). SuperAdmin gate ✅. `numIds.filter(Boolean)` 로 0/NaN 제거 (L139). audit log 부재 (CF-008) — bulk 작업이 audit 없이 진행되는 가장 큰 risk.

#### E7 · `DELETE /v1/contract-products/:id` (L148-163) — Format B

`DELETE /api/v1/contract-products/:id` | Auth `requireAuth` (+ SuperAdmin if `?permanent=true`) | $$ — | log ❌ | CF-015

L151 `permanent = req.query.permanent === "true"` query param 으로 분기. permanent 시 SuperAdmin 가드 (L153) ✅, 아니면 일반 admin 도 soft-delete 가능. 204 응답.

#### E8 · `POST /v1/contract-products/:id/activate` (L165-171) — Format B

state-transition `Draft|Inactive|Archived → Active`. 단순 status set. enrich 후 응답. state machine 정의 부재 (어떤 status 에서든 activate 가능) — **CF state-machine carrier** (T002.5 후보).

#### E9 · `POST /v1/contract-products/:id/deactivate` (L173-179) — Format B

state-transition `→ Inactive`. E8 와 대칭.

#### E10 · `POST /v1/contract-products/:id/archive` (L181-187) — Format B

state-transition `→ Archived`. E8/E9 와 대칭. 단, E6 (bulk-delete soft) 가 `Archived` 로도 set 함 → 두 경로가 동일 상태 도달. 의도적 redundancy 인지 미상.

#### E11 · `GET /v1/lookup/contract-products` (L189-205) — Format B

`GET /api/v1/lookup/contract-products` | Auth `requireAuth` | $$ — | log ❌ | CF-020.a (no guard)

선택자 lite. WHERE 에 `isNull(deleted_at)` **없음** → 소프트삭제 row 도 lookup 결과 포함 가능. limit 30. display 합성 (L204).

---

### 3.3 `product-types.ts` (6 endpoints) — Format C (lookup CRUD)

> **Table**: `product_types` (id, name unique, description, deleted_at, ts).
> **File-level Meta**: Auth `requireAuth` | $$ — none (no money column) | log 0/6 | CF-008/017/020.a.

| # | Verb · Path · Lines | $$ | logAction | CF | Notes |
|---|---|---|---|---|---|
| E1 | `GET /v1/product-types` (L7-19) | — | ❌ | CF-020 ✅ guard L13 | `isNull(deleted_at)` ✅; q ilike; orderBy name |
| E2 | `GET /v1/product-types/:id` (L22-29) | — | ❌ | **CF-020.a leak** | `deleted_at` 가드 없음 — soft-deleted row 노출 |
| E3 | `POST /v1/product-types` (L32-41) | — | ❌ | CF-017 minimal | `if (!name)` only; 23505 unique 위반 → 409 ✅ |
| E4 | `PUT /v1/product-types/:id` (L44-55) | — | ❌ | CF-020.b ✅ | `id/created_at/deleted_at` strip → revival 불가 ✅; 23505 → 409 ✅ |
| E5 | `POST /v1/product-types/bulk-delete` (L58-72) | — | ❌ | SuperAdmin ✅; CF-008 | permanent → hard; else soft (`deleted_at`) |
| E6 | `DELETE /v1/product-types/:id` (L75-95) | — | ❌ | SuperAdmin if perm; CF-008 | soft default; 204 ✅ |

**Domain Notes**: pure lookup, money 영향 0. 단 booking/contract 가 `product_type_id` integer FK convention 으로 본 테이블 참조 (`bookings.ts`, `contracts.ts` — `references()` 부재). product_type hard-delete 시 orphan product 발생 가능.

---

### 3.4 `product-groups.ts` (6 endpoints) — Format C (lookup CRUD)

> **Table**: `product_groups` (id, name unique, display_order, deleted_at, ts).
> **File-level Meta**: Auth `requireAuth` | $$ — none | log 0/6 | CF-008/017/020.a.

| # | Verb · Path · Lines | $$ | logAction | CF | Notes |
|---|---|---|---|---|---|
| E1 | `GET /v1/product-groups` (L7-19) | — | ❌ | CF-020 ✅ guard L13 | `isNull(deleted_at)` ✅; orderBy `(display_order, name)` |
| E2 | `GET /v1/product-groups/:id` (L22-29) | — | ❌ | **CF-020.a leak** | guard 부재 |
| E3 | `POST /v1/product-groups` (L32-42) | — | ❌ | CF-017 minimal | `if (!name)`; 23505 → 409 |
| E4 | `PUT /v1/product-groups/:id` (L45-56) | — | ❌ | CF-020.b ✅ | `id/created_at/deleted_at` strip ✅ |
| E5 | `POST /v1/product-groups/bulk-delete` (L59-73) | — | ❌ | SuperAdmin ✅ | 패턴 동일 |
| E6 | `DELETE /v1/product-groups/:id` (L76-96) | — | ❌ | SuperAdmin if perm | 패턴 동일 |

**Symmetry note**: product-types.ts 와 99% 코드 중복 — Zod schema + 공통 router factory 로 추출 가능 (T004 architecture-rules 후보 incidental, 이미 ops-property 사례에 합류).

---

### 3.5 `service-catalog.ts` (6 endpoints) — Format A×3 + B×3 [CF-001 anchor]

> **Table**: `service_catalog` (CF-001 carrier — `base_price: real` `service_catalog.ts:8`).
> **File-level Meta**: Auth `requireAuth` | $$ `base_price` real source | log 0/6 | CF-001/008/017/020.a.

#### E1 · `GET /v1/services` (L8-31) — **Format A** [CF-001 anchor]

**Meta**: Auth `requireAuth` | $$ — `base_price` exposure | log ❌ | **CF-001 (anchor)**, CF-020 ✅

**Behavior**:
- L12 `isNull(serviceCatalogTable.deleted_at)` 가드 ✅
- 3 filter (q/service_type/status). limit/offset (L10).
- `Promise.all` count + rows L19-24 ✅ (E1 product-catalog 와 동일 envelope).
- 응답 `{ success, data, meta:{ total, limit, offset } }` ✅.

**CF-001 anchor**: `service_catalog.base_price: real("base_price")` `service_catalog.ts:8` — 본 도메인의 핵심 money carrier. data 응답에 base_price 포함 (전체 row spread). 다음 라우트로의 propagation:
- `product-catalog.ts:191 base_price: serviceCatalogTable.base_price` (E7 join read) → accommodation 응답에 노출
- contract/booking 가 `accommodation_service_catalog.custom_price ?? service_catalog.base_price` 식으로 결합할 가능성 (검증 필요 — T002.4 erd 단계).

#### E2 · `GET /v1/services/:id` (L34-43) — Format B [CF-020.a leak]

`GET /api/v1/services/:id` | Auth | $$ base_price exposure | log ❌ | **CF-020.a (anchor)**

L37 SELECT — **`isNull(deleted_at)` 가드 부재** → soft-deleted service 노출. E1 list 는 가드 → 불일치. **CF-020.a 4번째 anchor**.

#### E3 · `POST /v1/services` (L46-57) — Format B [CF-001 write]

L48 destructure `{ name, service_type, ...rest }` → L51 `db.insert(...).values({ name, service_type, ...rest })`. 두 컬럼 free-required (L49-50 `if (!name)/if (!service_type)`), 나머지 (base_price, billing_trigger, currency 등) 모두 client free → CF-017. 201 ✅.

#### E4 · `PUT /v1/services/:id` (L60-70) — Format B

L63 `{ id: _id, created_at, ...updates }` strip → updated_at, deleted_at, status 등 client 변경 가능. **CF-020.b 적용** — client 가 `deleted_at: null` 명시하면 soft-delete revival 가능. PUT 의 일반 패턴이지만 명시 strip 부재.

#### E5 · `POST /v1/services/bulk-delete` (L73-89) — **Format A** [SuperAdmin + CF-008 anchor]

**Meta**: Auth `requireAuth` + **SuperAdmin** L75 | $$ archive 처리 | log ❌ | **CF-008/015**

- L75 SuperAdmin role gate ✅ (RBAC 정상).
- L83-87 permanent vs soft 분기 — permanent 시 hard delete, else `set({ deleted_at, status: 'Archived' })`.
- **logAction 부재** — bulk 작업 (잠재적 다수 row 영향) 인데도 audit 추적 0. 본 도메인에서 가장 큰 audit risk (CF-008).
- L82 `numIds.filter(Boolean)` — 0/NaN 제거 ✅.

#### E6 · `DELETE /v1/services/:id` (L92-109) — **Format A**

**Meta**: Auth `requireAuth` (+ SuperAdmin if `?permanent=true`) | $$ — | log ❌ | CF-015

- L96 query param 기반 permanent 분기.
- L98-100 permanent 시 SuperAdmin 가드 ✅; 아니면 일반 admin soft-delete 가능.
- L103 soft: `set({ deleted_at, status: 'Archived' })` — `service_catalog` 가 자체 `deleted_at` (timestamp without tz, schema L23) 가짐, **CF-013 사이트** (deleted_at 컬럼이 timezone 없음 → 분산 server timezone 차이 시 cutoff 분기 risk).
- 204 응답 ✅.

---

## 4. Self-Check Matrix (39 endpoints × 7 audit dimensions = 273 cells)

> **Dimensions**: Auth | $$ Money | logAction (CF-008) | Validation (CF-017) | Soft-delete guard (CF-020.a) | IDOR scope (CF-018) | Transaction (CF-014). 값: ✅ / ❌ / N/A / 🟡 (부분).

| # | Endpoint | Auth | $$ | logAction | Validation | SoftDel | IDOR | Tx |
|---|---|---|---|---|---|---|---|---|
| **product-catalog.ts (11)** | | | | | | | | |
| 1 | GET /v1/accommodations | ✅ | read 7 real | ❌ | 🟡 truthy | N/A (no col) | N/A (list) | N/A |
| 2 | GET /v1/accommodations/:id | ✅ | read | ❌ | ❌ | N/A | N/A | N/A |
| 3 | POST /v1/accommodations | ✅ | write 7 real | ❌ | 🟡 if(!name) | N/A | N/A | N/A |
| 4 | PUT /v1/accommodations/:id | ✅ | write | ❌ | ❌ | N/A | ✅ pk eq | N/A |
| 5 | PATCH /v1/accommodations/:id/deactivate | ✅ | — | ❌ | ❌ | N/A | ✅ | N/A |
| 6 | DELETE /v1/accommodations/:id | ✅ | — | ❌ | 🟡 if(!id) | N/A (hard only) | ✅ | N/A |
| 7 | GET /v1/accommodations/:id/services | ✅ | read base_price | ❌ | 🟡 if(!accId) | N/A (mapping no col) | ✅ scope | N/A |
| 8 | POST /v1/accommodations/:id/services | ✅ | write custom_price | ❌ | 🟡 if(!service_id) | N/A | ✅ | ❌ (race) |
| 9 | PUT /v1/accommodations/:id/services/:mapId | ✅ | write | ❌ | ❌ | N/A | **✅ composite** | N/A |
| 10 | DELETE /v1/accommodations/:id/services/:mapId | ✅ | — | ❌ | ❌ | N/A | **✅ composite** | N/A |
| 11 | GET /v1/lookup/products | ✅ | read | ❌ | ❌ | N/A | N/A | N/A |
| **products.ts (10)** | | | | | | | | |
| 1 | GET /v1/contract-products | ✅ | read 5 real | ❌ | ❌ | ✅ L41 | N/A | N/A |
| 2 | POST /v1/contract-products | ✅ | write 5 real + CF-019 | ❌ | ❌ | N/A | N/A | N/A |
| 3 | GET /v1/contract-products/:id | ✅ | read | ❌ | ❌ | **❌ leak L89** | ✅ pk | N/A |
| 4 | PUT /v1/contract-products/:id | ✅ | write + CF-019 | ❌ | ❌ | ✅ b safe | ✅ pk | N/A |
| 5 | POST /v1/contract-products/bulk-delete | ✅ + SA | — | ❌ | 🟡 ids array | ✅ | N/A | N/A |
| 6 | DELETE /v1/contract-products/:id | ✅ (+SA if perm) | — | ❌ | ❌ | ✅ | ✅ | N/A |
| 7 | POST /v1/contract-products/:id/activate | ✅ | — | ❌ | ❌ | ❌ no guard | ✅ | N/A |
| 8 | POST /v1/contract-products/:id/deactivate | ✅ | — | ❌ | ❌ | ❌ no guard | ✅ | N/A |
| 9 | POST /v1/contract-products/:id/archive | ✅ | — | ❌ | ❌ | ❌ no guard | ✅ | N/A |
| 10 | GET /v1/lookup/contract-products | ✅ | read | ❌ | ❌ | **❌ no guard** | N/A | N/A |
| **product-types.ts (6)** | | | | | | | | |
| 1 | GET /v1/product-types | ✅ | — | ❌ | ❌ | ✅ L13 | N/A | N/A |
| 2 | GET /v1/product-types/:id | ✅ | — | ❌ | ❌ | **❌ leak L23** | ✅ pk | N/A |
| 3 | POST /v1/product-types | ✅ | — | ❌ | 🟡 if(!name) | N/A | N/A | N/A |
| 4 | PUT /v1/product-types/:id | ✅ | — | ❌ | ❌ | ✅ b safe | ✅ pk | N/A |
| 5 | POST /v1/product-types/bulk-delete | ✅ + SA | — | ❌ | 🟡 ids array | ✅ | N/A | N/A |
| 6 | DELETE /v1/product-types/:id | ✅ (+SA if perm) | — | ❌ | ❌ | ✅ | ✅ | N/A |
| **product-groups.ts (6)** | | | | | | | | |
| 1 | GET /v1/product-groups | ✅ | — | ❌ | ❌ | ✅ L13 | N/A | N/A |
| 2 | GET /v1/product-groups/:id | ✅ | — | ❌ | ❌ | **❌ leak L23** | ✅ pk | N/A |
| 3 | POST /v1/product-groups | ✅ | — | ❌ | 🟡 if(!name) | N/A | N/A | N/A |
| 4 | PUT /v1/product-groups/:id | ✅ | — | ❌ | ❌ | ✅ b safe | ✅ pk | N/A |
| 5 | POST /v1/product-groups/bulk-delete | ✅ + SA | — | ❌ | 🟡 ids array | ✅ | N/A | N/A |
| 6 | DELETE /v1/product-groups/:id | ✅ (+SA if perm) | — | ❌ | ❌ | ✅ | ✅ | N/A |
| **service-catalog.ts (6)** | | | | | | | | |
| 1 | GET /v1/services | ✅ | read base_price | ❌ | ❌ | ✅ L12 | N/A | N/A |
| 2 | GET /v1/services/:id | ✅ | read | ❌ | ❌ | **❌ leak L37** | ✅ pk | N/A |
| 3 | POST /v1/services | ✅ | write base_price | ❌ | 🟡 name+type | N/A | N/A | N/A |
| 4 | PUT /v1/services/:id | ✅ | write | ❌ | ❌ | 🟡 b ❌ revival 가능 | ✅ pk | N/A |
| 5 | POST /v1/services/bulk-delete | ✅ + SA | — | ❌ | 🟡 ids array | ✅ | N/A | N/A |
| 6 | DELETE /v1/services/:id | ✅ (+SA if perm) | — | ❌ | ❌ | ✅ | ✅ | N/A |

### 4.1 Column totals (39 endpoints)

| Dimension | ✅ | ❌ | 🟡 partial | N/A |
|---|---|---|---|---|
| **Auth** | 39 | 0 | 0 | 0 |
| **logAction** | 0 | **39** | 0 | 0 |
| **Validation (Zod)** | 0 | 18 | 11 truthy | 0 — note: 모든 endpoint 가 적어도 1 dim 에서 미흡 |
| **SoftDel guard (where applicable)** | 9 | **5 leak** + 1 revival | 0 | 24 (no col / hard-only) |
| **IDOR scope** | 19 (pk eq + 2 composite) | 0 | 0 | 20 (list / no scope) |
| **Tx** | 0 | 1 (E8 race) | 0 | 38 (no multi-mutation) |

**Compactified findings**: logAction 0/39 = **0%** (CF-008 NEW domain-LOWEST, 이전 ops-property 13.3% < ops-catalog 0%). SoftDel leak 5 (4 GET /:id + 1 lookup). IDOR composite 모범 2 (product-catalog.ts:242, :258 = CF-018.SAFE positive anchor).

---

## 5. Spot-Check Verification Log (R-REPO-1 mandatory)

### C1 — service-catalog.ts mutator chain (CF-008/017 anchor 검증)

**Claim**: 5 mutator endpoint (POST/PUT/bulk-delete/DELETE) 모두 logAction 0회, Zod 0회, deleted_at 가드/보호 일관 — 본 파일이 §2 의 0% audit 매트릭스 기여.

**Re-verification** (file:line 직접 재독):
- L46-57 POST: `if(!name)` `if(!service_type)` 단 2개 검증, `import { logAction }` 부재 (`grep -n logAction artifacts/api-server/src/routes/service-catalog.ts` → 0 hit) ✅
- L60-70 PUT: `{ id: _id, created_at, ...updates }` strip; deleted_at strip 부재 — revival 가능 ✅
- L73-89 bulk-delete: SuperAdmin gate L75 ✅; logAction 0회 ✅
- L92-109 DELETE: permanent 시 SA L98-100 ✅; logAction 0회 ✅
- import block L1-3: `Router/eq/ilike/and/sql/isNull/inArray/SQL/asc + db, serviceCatalogTable` — **logAction import 0** ✅

**Result**: ✅ 5/5 mutator confirmed; CF-008 0% 매트릭스 정확.

### C2 — service_catalog.base_price `real` cross-domain propagation (CF-001 anchor)

**Claim**: `service_catalog.base_price: real("base_price")` `service_catalog.ts:8` 가 본 파일 E1 응답 + `product-catalog.ts:191` join read 두 사이트에서 노출되며, 추가 propagation 사이트 부재.

**Re-verification**:
- Schema L8: `base_price: real("base_price"),` ✅ (`grep -n "base_price" lib/db/src/schema/service_catalog.ts` → L8 only)
- `grep -rn "base_price" artifacts/api-server/src/routes/` → `product-catalog.ts:191 base_price: serviceCatalogTable.base_price,` (E7 join select) ← **유일한 별도 read site**
- `service-catalog.ts:20` `db.select().from(serviceCatalogTable)...` (E1) — wildcard select, 응답에 base_price 포함 ✅
- 별도 mutator 사이트 (POST/PUT) 가 base_price 를 명시 set 하지 않음 (`...rest` spread). Zod 부재로 client free.
- contract.ts / booking.ts / invoice.ts 에 직접 `base_price` 참조 0 (검증: `grep -rn "base_price\|baseP" artifacts/api-server/src/routes/{contracts,bookings,invoices}.ts` → 0 hit) — 즉 본 도메인 outside 직접 propagation 부재.

**Result**: ✅ Claim 정확; **추가 발견**: base_price 가 contract/invoice 라우트에서 직접 참조되지 않음 = `accommodation_service_catalog.custom_price` 가 실질 단일 source 일 가능성, 향후 ERD 단계 (T002.4) 검증 필요. **CF-001 source-side 노출은 본 도메인 내에서 self-contained** (ops-property/booking 같은 cross-domain leak 가 아님).

### C3 — `product_catalog` TABLE schema-only ghost: 4 `real` 컬럼 외부 참조 0 (§1.5 검증)

**Claim**: `product_catalog.ts:8/18/19/20` 4 `real` 컬럼 (price/bond_amount/admin_fee/cleaning_fee) 모두 라우트 코드/portal/lib 어디에서도 참조되지 않음.

**Re-verification**:
- `grep -rn "productCatalogTable" artifacts/api-server/src/routes/` → 0 hit ✅
- `grep -rn "productCatalogTable" artifacts/` (5 portal + api-server 전체) → 0 hit ✅
- `grep -rn "from.*product_catalog\b" lib/` → 1 hit only = `lib/db/src/schema/index.ts` re-export (예상) ✅
- 4 컬럼 직접 참조 — `grep -rn "product_catalog\." lib/ artifacts/` 0 hit (drizzle dot-notation), `productCatalogTable.price` etc. 0 hit
- dev-migration.ts 에서 seed reference 검사: `grep -n "product_catalog\|productCatalogTable" artifacts/api-server/src/routes/dev-migration.ts` → 0 hit ✅

**Result**: ✅ Claim 100% 정확; **추가 자가 발견**: `lib/db/src/schema/index.ts` 의 re-export 로 인해 Drizzle migration 시 prod DB 에 빈 테이블이 생성되는 것이 *유일한* 코드-DB 영향. 라우트 단 import 0 → API 통한 생성/조회 경로 0 → 데이터 0 row 가설 강함. §1.5 (a) DROP 권장 정당화 강화.

---

## 6. R-REPO-5 incidentals — sub-task closeout

본 sub-task (T002.2.d) 작성 중 발견된 시키지 않은 패턴/오류:

1. **incidental-1**: `product-types.ts` 와 `product-groups.ts` 가 99% 코드 중복 (소속 컬럼 차이 2개: description vs display_order) — common router factory 추출 가능. **impact: 단순 메모** → T004 architecture-rules 또는 향후 refactor 후보로 이미 ops-property `lib-` 시리즈와 합류.
2. **incidental-2**: `product-catalog.ts:48 r.space_id.filter(Boolean)` 패턴 — `space_id=0` 도 falsy 로 제외되지만 schema 상 serial PK 는 1+ 보장 → 정상이나 명시 의도성 코멘트 부재. **impact: 단순 메모** → T004.
3. **incidental-3**: `products.ts:108` PUT 에서 `bond_weeks/advance_weeks/min_stay_weeks` defaults 가 `?? null` (E5) 인 반면 POST L70-72 는 `?? 4 / 2 / 1` (E3) — silent default drift, partial PUT 가 의미 있는 default 를 null 로 덮어쓸 risk. **impact: CF-017 expansion 후보** (validation 부재 evidence 추가 anchor) → 후속 audit pass 에 통합. 즉시 CF 변경은 불필요.
4. **incidental-4**: `accommodation_catalog` schema 자체에 `deleted_at` 컬럼 부재 → soft-delete 전혀 불가능, hard-delete only (E6). 대비 contract_products / service_catalog 는 deleted_at 보유 — **inconsistency**: 도메인 내부 soft-delete 정책 비균질. **impact: 단순 메모** → T002.5 state-machines 또는 T004 architecture-rules 후보 anchor.

**Net impact**: 4 incidental 모두 단순 메모 / CF-017 minor expansion 1건 → **신규 mini-task 분리 불필요** (R-REPO-5 (e) 단순 메모 분류). T002.2.d atomic commit 본 산출물에 포함, 후속 sub-task 자동 진행 안 함 (R-REPO-4 명시).

---

*end of `ops-catalog.md` — 39 endpoints documented, R-REPO-1/4/5/6/7 적용, T002.2.d sub-task 완료.*
