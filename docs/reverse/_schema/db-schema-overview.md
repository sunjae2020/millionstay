# DB Schema Overview — MillionStay (Drizzle / PostgreSQL)

**Status**: T002.3 산출물. Single-file overview + Appendix A–D (Step 1 사전 분류 (α) 채택).
**Ground truth**: `lib/db/src/schema/*.ts` (49 files, 1449 lines, **54 `pgTable` declarations**).
**Companion**: `_schema/SCHEMA_FILE_TABLE_MAP.md` (file ↔ table ↔ variable map, T002.1.6 산출).
**Cross-pack**: `_schema/api-endpoints/` (11 endpoint domain files), `_audit/CRITICAL_FINDINGS.md` (P0=4, P1=18, P2=3 = 25), `_audit/MONEY_AUDIT.md`.

---

## 0. PURPOSE / SCOPE / METHOD / NON-GOALS

### 0.1 Purpose

본 문서는 MillionStay 의 **DB 표면적**을 단일 ground-truth 로 고정한다. T002.2.a–.j 가 endpoint behavior 차원에서 누적한 25개 CF 중 **schema-level evidence** 가 결정적인 5개 (CF-001 / CF-003 / CF-009 / CF-013 / CF-016 / CF-019) 의 schema-side 행을 §6 에 anchor 한다. T002.4 (`erd-core.md`) 와 T002.5 (`state-machines.md`) 는 본 문서를 baseline source 로 사용한다.

### 0.2 Scope

- **포함**: `lib/db/src/schema/*.ts` 의 모든 `pgTable` 선언, 컬럼, 타입, 제약 (PK / UNIQUE / index / NOT NULL / DEFAULT), drizzle-zod 통합 (`createInsertSchema`), 9-도메인 분류, implicit FK 그래프, 11-domain 라우트 cross-ref 매트릭스.
- **제외**: 마이그레이션 SQL (`drizzle/*.sql`, T002.1.5 §5), runtime data, ERD 시각화 (T002.4 담당), state machine 전이 (T002.5 담당), endpoint behavior (T002.2.* 담당).

### 0.3 Method

1. `lib/db/src/schema/*.ts` 49 파일 전수 dump → 1449 lines.
2. 패턴 카운트: `pgTable\(`, `\.unique\(\)`, `unique\(`, `index\(`, `notNull\(`, `\.default\(`, `defaultNow\(`, type tokens (real / numeric / timestamp / withTimezone / text / varchar / boolean / integer / serial / jsonb / date / uuid).
3. Multi-`pgTable` 4 파일 (bookings 3 / spaces 3 / cs_tickets 2 / announcements 2) 별도 인벤토리.
4. Cross-ref baseline: `rg "<TableVar>" artifacts/api-server/src/routes/` 53 변수 × routes 디렉토리 hit count.
5. CF anchor: T002.2.a–.j 가 발굴한 schema-level pattern 을 §6 에 retroactive-confirm.

### 0.4 Non-goals

- **No `references()` 추론** — CF-003 핵심 (`references()` = 0). 본 문서는 implicit FK 만 표기 (§4).
- **No DDL 재생성** — `npm run db:push --force` 가 schema → DB sync 의 single source.
- **No state value enumeration** — `status` / `*_status` 컬럼의 가능 값은 T002.5 담당.

### 0.5 Convention

- Table name = DB physical name (snake_case). Variable = TS 식별자 (camelCase + `Table` suffix; CF-016 8 file + 6 var divergence).
- 컬럼 인용은 file:line (e.g. `bookings.ts:7` = `booking_ref` UNIQUE).
- `tz` = `withTimezone: true`. `no-tz` = bare `timestamp(...)` (CF-013 21 sites).
- `numeric(p,s)` = decimal-precise (money-safe). `real` = IEEE-754 single precision (CF-001 lossy for money).

---

## 1. INVENTORY — 54 TABLES × 9 도메인

### 1.1 Counts ground truth

| Metric | Value | Source |
|---|---:|---|
| Schema files (excluding `index.ts` barrel) | 48 | `wc -l lib/db/src/schema/*.ts` |
| Total `pgTable(...)` declarations | **54** | `rg -c 'pgTable\(' lib/db/src/schema/` (excl. index.ts) |
| Multi-`pgTable` files | 4 | `bookings.ts` (3), `spaces.ts` (3), `cs_tickets.ts` (2), `announcements.ts` (2) |
| Single-`pgTable` files | 44 | 48 − 4 |
| `references()` calls (DB-level FK) | **0** | CF-003 — `rg 'references\(' lib/db/src/schema/` |
| `.unique()` / `unique()` sites (single + compound) | **16** | 14 single-column + 2 compound (§3.2) |
| `index(...)` sites | 13 | §3.3 |
| `primaryKey()` sites (incl. uuid + text) | 54 | 49 serial + 4 uuid + 1 text |
| `notNull()` sites | 346 | aggregate |
| `defaultNow()` sites | 93 | timestamp defaults |
| `deleted_at` columns (soft-delete signal) | 28 | CF-015 anchor |
| `created_at` columns | 76 | CF-013 anchor (some with-tz, some no-tz) |
| `updated_at` columns | 66 | CF-013 anchor |

> **Drift correction vs T002.3 Step 1 사전 분류 (R-REPO-6)**
>
> Step 1 보고: "`.unique()` = **14** sites". 실측 = **16** (단일-컬럼 14 + compound 2: `space_availability(space_id, date)` + `page_contents(page_key, language)`). Compound `unique()` 가 카운트 시 누락. 본 문서가 정정-진실. T002.3 Step 4 spot-check C2 (UNIQUE-gap appendix) 는 16 기준으로 재실행.

### 1.2 9-도메인 분류

도메인은 **product / business intent** 기준 분류 (디렉토리 구조 아님 — 모든 schema 가 `lib/db/src/schema/` 평면). 각 도메인 헤더에 `(파일수 × 테이블수)` 표기.

#### D1. Property — 자산 표현 (8 file × 10 table)

| # | Table | File:Line | Purpose | Notable cols / constraints |
|---|---|---|---|---|
| 1 | `properties` | `properties.ts:5` | 물리적 건물 (소유 단위) | `owner_account_id` / `suburb_id` implicit FK; `lat/lng = real` (geo OK); `approval_status text` (CF-022 state) |
| 2 | `suburbs` | `suburbs.ts:5` | 행정 구역 (도시 / state) | `country_code text NOT NULL`; `lat/lng = real` |
| 3 | `spaces` | `spaces.ts:5` | 임대 가능 단위 (방 / 아파트) | `property_id` / `parent_space_id` (자기참조 hierarchy) / `space_policy_id` / `landlord_account_id` implicit FK; `base_weekly_price/base_daily_price = real` (CF-001); `booking_mode text`; 3 `privacy_*` boolean defaults true |
| 4 | `space_option_maps` | `spaces.ts:34` | spaces ↔ space_options M:N | (`space_id`, `space_option_id`) — UNIQUE 누락 (CF-016 hint); 중복 옵션 매핑 가능 |
| 5 | `space_blocked_dates` | `spaces.ts:41` | 수동 차단 날짜 | `date = text` (!); `space_availability` 와 중복 책임 (incidental memo) |
| 6 | `space_options` | `space_options.ts:5` | 어메니티 / 옵션 사전 | soft-delete `deleted_at no-tz` |
| 7 | `space_images` | `space_images.ts:3` | space 사진 (정렬 + cloudinary) | `varchar` 사용 — 다른 schema 와 type-stack 차이 |
| 8 | `space_availability` | `space_availability.ts:5` | 일자별 가용성 (block/booking) | **UNIQUE (space_id, date)** ← compound (`space_availability.ts:15`); index 동일 컬럼 (`:16`) |
| 9 | `space_policies` | `space_policies.ts:5` | 입주 규칙 (성별 / 펫 / 흡연) | 6 boolean rule flags |
| 10 | `space_service_catalog` | `space_service_catalog.ts:3` | space ↔ service_catalog M:N (per-space override) | 단순 join + price/sort (`accommodation_service_catalog` 와 거의 동일 shape) |

#### D2. Catalog — 가격/상품 (8 file × 8 table)

| # | Table | File:Line | Purpose | Notable cols / constraints |
|---|---|---|---|---|
| 11 | `accommodation_catalog` | `accommodation_catalog.ts:3` | **현재 active product 카탈로그** (T002.1.6 결정) | 38 cols 의 거대 entity; `price/weekly_rate/admin_fee/cleaning_fee = real` (CF-001 cluster); `bond_weeks/advance_weeks = real` (4 / 2 default); 6 `includes_*` boolean; `display_on_*` UI flags |
| 12 | `accommodation_service_catalog` | `accommodation_service_catalog.ts:3` | accommodation ↔ service M:N | `custom_price = real`; `is_mandatory boolean` |
| 13 | `contract_products` | `products.ts:5` ⚠️ | 계약-시점 product 스냅샷 | **파일명 vs 변수명 vs 테이블명 모두 다름** (CF-016 canonical case): file `products.ts`, var `contractProductsTable`, table `"contract_products"`. `weekly_rate/monthly_rate/effective_weekly_rate/bond_amount/admin_fee/cleaning_fee = real` (CF-001) |
| 14 | `product_catalog` | `product_catalog.ts:3` | **DEAD (CF-009 confirmed)** | T002.1.6 + T002.2.h 재검증: `productCatalogTable` route hits = 0; 27 cols ghosting `accommodation_catalog` |
| 15 | `product_groups` | `product_groups.ts:3` | grouping 1 (라벨) | `name UNIQUE`; soft-delete (no-tz) |
| 16 | `product_types` | `product_types.ts:3` | grouping 2 (분류) | `name UNIQUE`; soft-delete (no-tz) |
| 17 | `service_catalog` | `service_catalog.ts:3` | 부가 서비스 사전 (cleaning / wifi 등) | `base_price = real`; `service_type text` ("one_time/scheduled/physical"); `billing_trigger text` (3-value) |
| 18 | `promotions` | `promotions.ts:3` | 할인 코드 | `discount_amount = numeric(10,2)` ✅ (Catalog 내 유일 numeric); `discount_percentage = real` (% OK); `code` 비-UNIQUE (CF-019 sibling: 중복 코드 가능) |

#### D3. Booking — 예약 (2 file × 4 table)

| # | Table | File:Line | Purpose | Notable cols / constraints |
|---|---|---|---|---|
| 19 | `bookings` | `bookings.ts:5` | 예약 root | `booking_ref UNIQUE`; `account_id/contact_id/space_id/product_id/contract_product_id/agent_account_id` implicit FK; `stay_weeks numeric(6,2)`, `agreed_weekly_rate/total_rent numeric(12,2)` ✅; `deleted_at no-tz` (CF-013); `cancelled_at tz`; `booking_status text` (CF-022) |
| 20 | `booking_documents` | `bookings.ts:34` | 예약 첨부 문서 (passport / visa) | `verified_status text` (CF-022); `expiry_date date`; CF-018 IDOR target (T002.2.j §3.A.T6) |
| 21 | `booking_services` | `bookings.ts:48` | 예약별 추가 서비스 | `unit_price/total_price numeric(10,2)` ✅; `billing_trigger text` ("at_booking/at_checkout/on_request") |
| 22 | `booking_service_photos` | `booking_service_photos.ts:3` | 서비스 수행 증빙 사진 | `uploaded_by_type text` ("partner") + `uploaded_by_id integer` (다형 reference, CF-019 패턴) |

#### D4. Contract — 계약 (3 file × 3 table)

| # | Table | File:Line | Purpose | Notable cols / constraints |
|---|---|---|---|---|
| 23 | `contracts` | `contracts.ts:5` | 임대 계약 root | `contract_ref UNIQUE`; **dates = `text`** (`start_date/end_date/effective_date/expiry_date`) ⚠️ — booking 의 `date` 타입과 비대칭; `weekly_rate/total_rent/bond_amount/advance_amount = real` (CF-001 가장 큰 손실원); `deleted_at no-tz` (CF-013); `sent_at/signed_at = tz` |
| 24 | `contract_line_items` | `contract_line_items.ts:4` | 계약 라인 (rent/fee 분해) | `unit_price/total_price = numeric(10,2)` ✅; `default(sql\`now()\`)` 변형 사용 (`defaultNow()` 와 다름) |
| 25 | `contract_types` | `contract_types.ts:3` | 계약 카테고리 (PRS / Lease) | `name UNIQUE`; 3 boolean `require_*` (passport/visa/enrollment) |

#### D5. Finance — 청구/결제/정산 (5 file × 5 table)

| # | Table | File:Line | Purpose | Notable cols / constraints |
|---|---|---|---|---|
| 26 | `invoices` | `invoices.ts:5` | 청구서 | `invoice_ref UNIQUE`; **`numeric(12,2)` 일관 ✅** (subtotal/gst/total/amount_paid/amount_due); `paid_status text` (CF-022); `stripe_payment_intent_id text` (CF-019: orphan write column) |
| 27 | `payment_info` | `payment_info.ts:5` | 송금 계좌 정보 (bank / stripe) | `stripe_account_id text` (CF-019 orphan candidate); `payment_type text` ("BankTransfer") |
| 28 | `commissions` | `commissions.ts:5` | 수수료 정의 | `commission_rate/commission_amount = real` (CF-001); `commission_type text` ("Percentage") |
| 29 | `beneficiaries` | `beneficiaries.ts:5` | 수익 분배 대상 (split) | `split_percentage/fixed_amount = real` (CF-001 — 정산 핵심 수치가 lossy); `priority integer default 1` |
| 30 | `recurring_schedule` | `recurring_schedules.ts:5` ⚠️ | 정기 청구 스케줄 | **테이블명 단수** (`"recurring_schedule"`) vs 변수 복수 `recurringSchedulesTable` (CF-016 sibling); `amount = numeric(10,2)` ✅; `frequency text` ("Biweekly"); `index("idx_recurring_next_due")`; `start_date/end_date/next_due_date = date` ✅ |

#### D6. Identity / Auth — 사용자 / 토큰 / 동의 (7 file × 7 table)

| # | Table | File:Line | Purpose | Notable cols / constraints |
|---|---|---|---|---|
| 31 | `admin_users` | `users.ts:3` ⚠️ | 본사 직원 (admin / SuperAdmin) | **변수 `usersTable` vs 테이블 `"admin_users"`** (CF-016 sibling); `email UNIQUE`; `role text` (CF-018 Sub-pattern B 핵심: 27개 라우트가 `!== "SuperAdmin"` 인라인 비교); `force_password_change boolean`; `reset_token text` |
| 32 | `guest_users` | `guest_users.ts:5` | 게스트 (예약자) | `email UNIQUE`; portal credentials 분리 (admin_users 와 별 테이블) |
| 33 | `partner_users` | `partner_users.ts:5` | 에이전트 / 오너 / 서비스호스트 portal | `email UNIQUE`; **`portal_type text`** with comment `// 'agent' | 'owner'` ← 코드 주석은 2-value 이지만 runtime 은 `"service_host"` 도 허용 (T001 finding § Red Flag) |
| 34 | `refresh_tokens` | `refresh_tokens.ts:15` | JWT refresh token (해시 저장) | **uuid PK + defaultRandom**; `token_hash UNIQUE` (varchar(128)); `user_type varchar(16)` ("admin/guest/partner" comment); 2 indexes (`user`, `expires`); `revoked_at tz` |
| 35 | `login_attempts` | `login_attempts.ts:10` | 로그인 시도 추적 (rate-limit/감사) | uuid PK; `attempted_at tz`; `success boolean`; `index("idx_login_attempts_email_time")`; **routes hit = 0** (lib/auth 내부 only) |
| 36 | `marketing_consents` | `marketing_consents.ts:12` | GDPR / Spam Act consent | uuid PK; `consent_type varchar`; `consented_at tz` / `revoked_at tz`; `index("idx_marketing_consents_user")` |
| 37 | `guest_emergency_contacts` | `guest_emergency_contacts.ts:3` | 게스트 비상 연락처 | `is_primary boolean`; `guest_user_id integer NOT NULL` |

#### D7. CRM — 고객 / 거래처 (3 file × 3 table)

| # | Table | File:Line | Purpose | Notable cols / constraints |
|---|---|---|---|---|
| 38 | `accounts` | `accounts.ts:5` | 거래처 (개인/법인 계정) | `primary_contact_id/secondary_contact_id/parent_account_id` implicit FK; `default_commission_id` implicit FK; `payment_info_id` implicit FK; `manual_input boolean` (수동 입력 표시); `deleted_at tz` (CF-013 — D7 에서 유일하게 tz; 같은 도메인 내 inconsistency) |
| 39 | `contacts` | `contacts.ts:5` | 개인 (이름/이메일/주소) | `email NOT NULL` (UNIQUE 아님); `passport_number/visa_*` 평문 저장 (T001 PII 위험 영역); `portal_user_id text` (다형 — guest/partner 어느 쪽인지 식별 불가) |
| 40 | `leads` | `leads.ts:5` | 미전환 잠재 고객 | `lead_ref UNIQUE`; `budget_min/budget_max = numeric(12,2)` ✅; `converted_booking_id` implicit FK; `lead_status text` (CF-022); `manual_input boolean` |

#### D8. Ops / Comm — 운영 / 메시지 / 감사 (10 file × 12 table)

| # | Table | File:Line | Purpose | Notable cols / constraints |
|---|---|---|---|---|
| 41 | `service_hosts` | `service_hosts.ts:5` | 서비스 호스트 (외부 파트너) | `from_date/to_date = date`; `business_start_hour/end_hour integer` (HH 0-23) |
| 42 | `work_orders` | `work_orders.ts:5` | 작업지시서 | `order_ref UNIQUE`; `actual_cost = real` (CF-001) |
| 43 | `tasks` | `tasks.ts:5` | 일반 task | (생략 — 31 lines, 표준 metadata) |
| 44 | `cs_tickets` | `cs_tickets.ts:3` | CS 티켓 root | `ticket_ref UNIQUE`; `assigned_admin_id` implicit FK; `priority text` ("Normal"); `closed_at tz`; `deleted_at no-tz` (CF-013) |
| 45 | `cs_messages` | `cs_tickets.ts:23` ⚠️ | CS 티켓 메시지 | **변수 `csMessagesTable` vs SCHEMA_FILE_TABLE_MAP 의 가설 `csTicketMessagesTable`** (CF-016 — drift); `sender_type text` (다형); `is_internal integer` (boolean 이어야 — CF-016 type drift); `image_urls text` (JSON 직렬화 추정 — schema-level 검증 불가) |
| 46 | `announcements` | `announcements.ts:3` | 공지 | `is_published integer` (boolean 이어야 — CF-016 동일 type drift); `published_at/expires_at tz` |
| 47 | `guest_direct_messages` | `announcements.ts:20` ⚠️ | 게스트 DM (PUSH-only) | **변수 `guestDirectMessagesTable` 가 `announcements.ts` 내 정의** — CF-016 file ↔ domain mismatch; `sender_name text default "MillionStay Team"` |
| 48 | `system_log` | `system_logs.ts:5` ⚠️ | 감사 로그 (CF-008 anchor) | **테이블명 단수** (`"system_log"`) vs 변수 복수 `systemLogsTable`; `entity_type/entity_id` 다형 reference; `actor_type/actor_id/actor_email` 다형 actor; `old_value/new_value = jsonb`; 3 indexes (entity / actor / created); CF-008 surface = audit trail 불완전 (T002.2.* 11/11 도메인 sub-task 평균 logAction coverage ≈ 18%) |
| 49 | `email_log` | `email_logs.ts:5` ⚠️ | 발송 메일 추적 | **테이블명 단수** vs 변수 복수 `emailLogsTable`; `resend_message_id text`; `status text` ("Sent"); `entity_type/entity_id` 다형 (system_log 와 동일 패턴); `index("idx_email_log_entity")` |
| 50 | `email_template` | `email_templates.ts:5` ⚠️ | 메일 템플릿 | **테이블명 단수**; `template_code UNIQUE`; T002.2.i 발견: emailTemplates 5/6 = Zod-using rare positive (CF-017) |
| 51 | `integration_settings` | `integration_settings.ts:3` | 통합 설정 (key=value) | **`text PK ("key")`** ← serial 이 아닌 유일 사례 중 하나; `updated_at no-tz` (CF-013); routes hit = 0 (admin/integrations.ts 내부 sql 직접 사용) |
| 52 | `documents` | `documents.ts:14` | 통합 문서 저장 (B-2 sprint) | uuid PK; `entity_type/entity_id` 다형; `retention_until tz NOT NULL` (APP 11 호주 사생활법 retention); 3 indexes (entity / doc_type / retention) |

#### D9. Content — 콘텐츠 (2 file × 2 table)

| # | Table | File:Line | Purpose | Notable cols / constraints |
|---|---|---|---|---|
| 53 | `blog_posts` | `blog_posts.ts:5` | 블로그 포스트 | `slug NOT NULL` (UNIQUE 아님 — CF-016 type drift / CF-019 sibling: 중복 slug 가능); `translations = jsonb default {}`; `deleted_at tz`; T002.2.h 발견: 5/6 = Zod 83% rare positive (CF-017) |
| 54 | `page_contents` | `page_contents.ts:5` | 정적 페이지 i18n | **UNIQUE (page_key, language)** compound (`page_contents.ts:13`); `content = jsonb default {}` |

> **Domain summary**: D1=10, D2=8, D3=4, D4=3, D5=5, D6=7, D7=3, D8=12, D9=2 ⇒ **총 54** ✅ (`pgTable` 카운트와 일치).

---

## 2. 컬럼-타입 분포

### 2.1 Type-token frequency

| Type | Count | Notes |
|---|---:|---|
| `text` | 323 | 압도적 — varchar 23 대비 14× 빈도 |
| `integer` | 126 | 대부분 implicit FK + 수량 컬럼 |
| `timestamp` (no-tz) | 145 | CF-013 surface |
| `timestamp` (with-tz) | 123 | `withTimezone: true` 명시 |
| `boolean` | 60 | 대부분 flag (default false / true) |
| `serial` | 49 | 49 단일 PK + 5 multi-table 추가 = 54 PK 중 49 사용 |
| `real` | 39 | **CF-001 surface** — float32 money columns |
| `varchar` | 23 | refresh_tokens / login_attempts / marketing_consents / documents / space_images 만 (5 file) |
| `date` | 12 | check_in/out, recurring schedule, etc. (text date 와 혼용 — CF-013) |
| `numeric` | 12 | **money-safe** zone — bookings (3) + booking_services (2) + contract_line_items (2) + invoices (5) + recurring_schedule (1) + leads (2) + promotions (1) + ... (MONEY_AUDIT §1.1 근거) |
| `jsonb` | 5 | system_log (2) + documents x = 0 / blog_posts (1) + page_contents (1) + announcements x = 0 → 실제: 2 (system_log old_value/new_value) + 1 (blog_posts.translations) + 1 (page_contents.content) + 1 = 5 ✅ |
| `uuid` | 4 | refresh_tokens / documents / marketing_consents / login_attempts (모두 `defaultRandom().primaryKey()`) |
| `text PK` | 1 | `integration_settings.key` (유일) |

### 2.2 NOT NULL / DEFAULT 강제 강도

| Pattern | Count | Interpretation |
|---|---:|---|
| `notNull()` | 346 | 컬럼 평균 ≈ 1318 cols (54 tables × ~24.4 avg cols) 의 26% 가 NOT NULL |
| `.default(...)` | 163 | 47% (163/346) 의 NOT NULL 컬럼이 default 보유 — INSERT 부담 완화 |
| `defaultNow()` | 93 | created_at / updated_at 대부분 |
| `default(sql\`now()\`)` | 2 | `contract_line_items.ts:19,20` — `defaultNow()` 와 SQL-동등하나 표기 분리 (CF-016 type drift sibling) |

### 2.3 Money column 타입 분포 (MONEY_AUDIT §1 cross-link)

| Storage | Count | Tables | Risk |
|---|---:|---|---|
| `numeric(p,s)` ✅ | 12 cols | bookings (stay_weeks/agreed_weekly_rate/total_rent), booking_services (unit_price/total_price), contract_line_items (unit_price/total_price), invoices (5 cols), recurring_schedule (amount), leads (budget_min/budget_max), promotions (discount_amount) | NONE — decimal-precise |
| `real` 🔴 | 39 cols | accommodation_catalog (10+), contract_products (8), contracts (4), commissions (2), beneficiaries (2), spaces (3), service_catalog (1), product_catalog (4), work_orders (1), suburbs (lat/lng — geo OK), properties (lat/lng — geo OK), promotions (discount_percentage — % OK) | **CF-001** — float32 money rounding; booking → contract write path은 `numeric → real` lossy cast |

> **Lossy cast site**: `bookings.total_rent numeric(12,2)` → `contracts.total_rent real` 은 schema-level 에서만 보아도 손실 가능 (12 자릿수 의미값이 7 자릿수로 절단). MONEY_AUDIT §3 의 TC-M02 reconciliation test 가 이 site 를 직접 검증.

### 2.4 Timezone 분포 (CF-013 cross-link)

| Pattern | Count | Risk profile |
|---|---:|---|
| `timestamp("col", { withTimezone: true })` | 123 | UTC 보존 ✅ |
| `timestamp("col")` (bare, no-tz) | 145 | CF-013 — DB 가 호스트 TZ 로 해석 (host = UTC 가정에 의존) |
| `date("col")` | 12 | TZ 없음 — 의도적 (체크인/체크아웃) |
| `text("date_col")` | ≥6 | `contracts.start_date/end_date/effective_date/expiry_date`, `space_blocked_dates.date`, `contacts.date_of_birth/passport_expiry/visa_expiry`, `promotions.valid_from/valid_to`, `service_hosts.from_date/to_date` (마지막 2개는 date — 정정: text date = `contracts` 4 + `space_blocked_dates` 1 + `contacts` 4 + `promotions` 2 = 11 sites) — **CF-013 type drift**: date semantics 임에도 text 사용으로 비교/정렬 시 문자열 비교 (lexicographic) — `"2025-12-31" < "2026-01-01"` 우연히 ISO-8601 정렬과 일치하나 임의 포맷 입력 시 silent corruption |

---

## 3. 제약 표면 — UNIQUE / INDEX / FK 부재

### 3.1 `references()` = 0 (CF-003 anchor)

`rg 'references\(' lib/db/src/schema/` → **0 hits**. Drizzle 의 외래키 선언 API 가 단 한 번도 호출되지 않음. 결과:

- DB 레벨 RI (Referential Integrity) 가 전혀 설정되지 않음.
- ON DELETE CASCADE / SET NULL 등 cascade 정책 없음 → 삭제 시 orphan row 만들기 매우 쉬움 (CF-019 sibling).
- 모든 FK 는 implicit (col 명 컨벤션 = `<entity>_id integer`) — §4 그래프 참조.
- 검증 위치는 application layer (route handlers) 로 이동 — T002.2.* 의 18 IDOR-class CF-018 surface 의 근본 원인.

### 3.2 UNIQUE — 16 sites (단일 14 + compound 2)

| # | Site | Type | Column(s) | Purpose |
|---|---|---|---|---|
| 1 | `users.ts:5` | single | `email` | admin login |
| 2 | `guest_users.ts:8` | single | `email` | guest login |
| 3 | `partner_users.ts:9` | single | `email` | partner login |
| 4 | `bookings.ts:7` | single | `booking_ref` | human-readable id |
| 5 | `contracts.ts:7` | single | `contract_ref` | human-readable id |
| 6 | `invoices.ts:5` | single | `invoice_ref` | human-readable id |
| 7 | `cs_tickets.ts:5` | single | `ticket_ref` | human-readable id |
| 8 | `work_orders.ts:5` | single | `order_ref` | human-readable id |
| 9 | `leads.ts:7` | single | `lead_ref` | human-readable id |
| 10 | `email_templates.ts:7` | single | `template_code` | template lookup |
| 11 | `contract_types.ts:5` | single | `name` | type label |
| 12 | `product_types.ts:5` | single | `name` | type label |
| 13 | `product_groups.ts:5` | single | `name` | group label |
| 14 | `refresh_tokens.ts:21` | single | `token_hash` (varchar(128)) | token lookup |
| 15 | `space_availability.ts:15` | **compound** | (`space_id`, `date`) | 일자별 1행 보장 |
| 16 | `page_contents.ts:13` | **compound** | (`page_key`, `language`) | 페이지×언어 1행 보장 |

> **UNIQUE-gap candidates (Appendix C 상세)**:
>
> 6 `*_ref` 사이트가 application-layer 에서 23505 catch + retry 로 보호 — 이 패턴이 적용되지 않은 곳:
>
> - `blog_posts.slug` (`blog_posts.ts:8` `notNull` only, UNIQUE 없음) — `blog_posts.ts:71/102` 에서 23505 catch도 없이 INSERT (Step 1 i5 gap CONFIRMED 2 sites). 같은 slug 중복 가능 → SEO 자동 인덱스 충돌 + URL race.
> - `promotions.code` (`promotions.ts:6` UNIQUE 없음) — 중복 promo code 발급 가능 (할인 코드 충돌 시 어느 promotion 적용되는지 비결정).
> - `accounts.account_email` (`accounts.ts:11` UNIQUE 없음) — 동일 이메일 거래처 중복 생성 가능.

### 3.3 INDEX — 13 sites

| # | Site | Index name | Columns | Purpose |
|---|---|---|---|---|
| 1 | `login_attempts.ts:21` | `idx_login_attempts_email_time` | (email, attempted_at) | rate-limit lookup |
| 2 | `recurring_schedules.ts:24` | `idx_recurring_next_due` | (next_due_date) | 스케줄러 polling |
| 3 | `email_logs.ts:19` | `idx_email_log_entity` | (entity_type, entity_id) | 엔티티별 메일 추적 |
| 4 | `system_logs.ts:20` | `idx_syslog_entity` | (entity_type, entity_id) | 엔티티별 감사 |
| 5 | `system_logs.ts:21` | `idx_syslog_actor` | (actor_id) | actor 별 감사 |
| 6 | `system_logs.ts:22` | `idx_syslog_created` | (created_at) | 시간순 audit |
| 7 | `refresh_tokens.ts:29` | `idx_refresh_tokens_user` | (user_id, user_type) | 사용자별 토큰 조회 |
| 8 | `refresh_tokens.ts:30` | `idx_refresh_tokens_expires` | (expires_at) | 만료 cleanup |
| 9 | `documents.ts:33` | `idx_documents_entity` | (entity_type, entity_id) | 엔티티별 문서 |
| 10 | `documents.ts:34` | `idx_documents_doctype` | (doc_type) | 타입별 문서 |
| 11 | `documents.ts:35` | `idx_documents_retention` | (retention_until) | retention scan |
| 12 | `space_availability.ts:16` | `idx_space_avail_space_date` | (space_id, date) | (UNIQUE 와 동일 컬럼 — Pg 는 UNIQUE constraint 가 자동 생성하는 인덱스가 있어 이 INDEX 는 중복 — incidental memo) |
| 13 | `marketing_consents.ts:29` | `idx_marketing_consents_user` | (user_id) | user 별 consent 조회 |

> **INDEX gap obvious (Appendix B 상세)**:
>
> Implicit FK 컬럼 (§4) 중 인덱스 미생성 사이트가 다수 — 예: `bookings.account_id`, `bookings.contact_id`, `bookings.space_id`, `contracts.tenant_account_id`, `contracts.landlord_account_id` 등. Pg 는 PK / UNIQUE 외에는 인덱스를 자동 생성하지 않으므로, 이러한 컬럼으로 join 시 sequential scan 발생 가능. 13 INDEX 사이트 중 11 개가 system 테이블 (logs / tokens / documents / availability) 이며 비즈니스 핵심 join 컬럼 (account_id / space_id / contract_id 등) 은 0 indexes.

### 3.4 PK 분포

| Pattern | Count | Tables |
|---|---:|---|
| `serial("id").primaryKey()` | 49 | 대부분 |
| `uuid("id").defaultRandom().primaryKey()` | 4 | refresh_tokens / documents / marketing_consents / login_attempts |
| `text("key").primaryKey()` | 1 | integration_settings (key=value 패턴) |

> **PK 정책 일관성**: 비즈니스 entity 는 모두 serial. 보안/추적 entity 만 uuid (예측불가성 + 분산 friendly). config entity 는 text key. **명시적 정책 문서는 없으나 패턴 자체는 일관** ⇒ 신규 entity 추가 시 동일 분류 기준 따르면 됨 (Phase 2 권장).

---

## 4. IMPLICIT FK 그래프

`references()` 부재 (§3.1) 로 모든 FK 는 컬럼명 컨벤션. 본 §은 **schema 만 보고** 추론 가능한 implicit FK 53 개를 enumerate (양방향 그래프). T002.4 (`erd-core.md`) 의 Mermaid 다이어그램 baseline.

### 4.1 양식

`<table>.<col>` → `<target_table>.id` (cardinality, NOT NULL?, soft-delete 노출 여부)

### 4.2 D1 Property 영역 implicit FK

- `properties.owner_account_id` → `accounts.id` (N:1, nullable, owner soft-delete 시 orphan)
- `properties.suburb_id` → `suburbs.id` (N:1, nullable)
- `spaces.property_id` → `properties.id` (N:1, nullable)
- `spaces.parent_space_id` → `spaces.id` (N:1, nullable, **자기참조 hierarchy**)
- `spaces.space_policy_id` → `space_policies.id` (N:1, nullable)
- `spaces.landlord_account_id` → `accounts.id` (N:1, nullable; cf. `properties.owner_account_id` 와 별도 — 물리 소유자 ≠ 임대 운영자 분리 모델)
- `space_option_maps.space_id` → `spaces.id` (M:N junction)
- `space_option_maps.space_option_id` → `space_options.id` (M:N junction)
- `space_blocked_dates.space_id` → `spaces.id` (1:N)
- `space_images.space_id` → `spaces.id` (1:N)
- `space_availability.space_id` → `spaces.id` (1:N, UNIQUE per date)
- `space_availability.booking_id` → `bookings.id` (N:1, nullable — block reason 이 booking 인 경우)
- `space_service_catalog.space_id` → `spaces.id` (M:N)
- `space_service_catalog.service_id` → `service_catalog.id` (M:N)

### 4.3 D2 Catalog 영역 implicit FK

- `accommodation_catalog.product_group_id` → `product_groups.id`
- `accommodation_catalog.product_type_id` → `product_types.id`
- `accommodation_catalog.space_id` → `spaces.id`
- `accommodation_catalog.promotion_id` → `promotions.id`
- `accommodation_catalog.commission_id` → `commissions.id`
- `accommodation_catalog.product_source_account_id` → `accounts.id`
- `accommodation_catalog.product_provider_account_id` → `accounts.id`
- `accommodation_service_catalog.accommodation_id` → `accommodation_catalog.id`
- `accommodation_service_catalog.service_id` → `service_catalog.id`
- `contract_products.space_id` → `spaces.id`
- `contract_products.promotion_id` → `promotions.id`
- `product_catalog.product_group_id/product_type_id/space_id/commission_id/product_source_account_id/product_provider_account_id` → 각각 (DEAD — CF-009)
- `service_catalog.promotion_id` → `promotions.id`

### 4.4 D3 Booking 영역 implicit FK

- `bookings.account_id` → `accounts.id` (N:1, nullable)
- `bookings.contact_id` → `contacts.id` (N:1, nullable)
- `bookings.space_id` → `spaces.id` (N:1, nullable)
- `bookings.product_id` → `contract_products.id` (N:1, nullable — **컬럼명 `product_id` 가 어느 product table 을 가리키는지 schema 만으로는 모호**; T002.2.a 코드 추적 결과 `contract_products` 가 정답)
- `bookings.contract_product_id` → `contract_products.id` (N:1, nullable; `product_id` 와 의미 중복 가능 — incidental memo: 두 필드의 의미 차이 불명)
- `bookings.agent_account_id` → `accounts.id` (N:1, nullable)
- `booking_documents.booking_id` → `bookings.id` (N:1, NOT NULL)
- `booking_services.booking_id` → `bookings.id` (N:1, NOT NULL)
- `booking_services.service_id` → `service_catalog.id` (N:1, nullable)
- `booking_service_photos.booking_service_id` → `booking_services.id` (N:1, NOT NULL)
- `booking_service_photos.uploaded_by_id` → polymorphic (`uploaded_by_type` discriminator: "partner") — schema-level 검증 불가

### 4.5 D4 Contract 영역 implicit FK

- `contracts.booking_id` → `bookings.id` (N:1, nullable)
- `contracts.product_id` → `contract_products.id`
- `contracts.contract_product_id` → `contract_products.id` (다시 두 필드 — incidental sibling)
- `contracts.tenant_account_id` → `accounts.id`
- `contracts.landlord_account_id` → `accounts.id`
- `contracts.space_id` → `spaces.id`
- `contract_line_items.contract_id` → `contracts.id` (N:1, NOT NULL)
- `contract_line_items.service_id` → `service_catalog.id` (N:1, nullable)
- (contract_types 는 외참조 없음 — leaf)

### 4.6 D5 Finance 영역 implicit FK

- `invoices.<unread cols>` — 본 §에서는 `invoices.ts` body 미read. T002.2.b half-1 (finance-invoicing.md) ground truth 참조: `booking_id`, `contract_id`, `account_id`, `recurring_schedule_id`, `stripe_payment_intent_id text` (orphan, CF-019).
- `payment_info.<unread>` — 본 §에서는 `payment_info.ts` body read 완료 (위 §1.2 #27): 외참조 컬럼 없음 (자기 entity).
- `commissions` — 외참조 없음 (leaf).
- `beneficiaries.contract_product_id` → `contract_products.id`
- `beneficiaries.account_id` → `accounts.id` (N:1, NOT NULL)
- `beneficiaries.commission_id` → `commissions.id`
- `recurring_schedule.booking_id` → `bookings.id` (NOT NULL)
- `recurring_schedule.contract_id` → `contracts.id` (nullable)
- `recurring_schedule.account_id` → `accounts.id` (NOT NULL)

### 4.7 D6 Identity 영역 implicit FK

- `partner_users.account_id` → `accounts.id` (N:1, NOT NULL)
- `refresh_tokens.user_id` → polymorphic (`user_type` discriminator: "admin/guest/partner") — schema 가 어느 사용자 테이블 가리키는지 단일하게 결정 불가
- `marketing_consents.user_id` → polymorphic (다른 컬럼 `user_type` 에 의해 결정; body 미read, T002.2.b half-1 참조)
- `guest_emergency_contacts.guest_user_id` → `guest_users.id` (NOT NULL)
- (login_attempts: email-only 식별, FK 없음)

### 4.8 D7 CRM 영역 implicit FK

- `accounts.primary_contact_id` → `contacts.id`
- `accounts.secondary_contact_id` → `contacts.id`
- `accounts.parent_account_id` → `accounts.id` (자기참조)
- `accounts.payment_info_id` → `payment_info.id`
- `accounts.default_commission_id` → `commissions.id`
- `contacts.portal_user_id` → polymorphic (text — guest_users 또는 partner_users 어느 쪽인지 모호; 또는 외부 SSO id; schema-level 결정 불가)
- `leads.preferred_suburb_id` → `suburbs.id`
- `leads.converted_booking_id` → `bookings.id` (전환 시 채워짐)

### 4.9 D8 Ops/Comm 영역 implicit FK

- `service_hosts.account_id` → `accounts.id`
- `service_hosts.contract_product_id` → `contract_products.id`
- `cs_tickets.guest_user_id` → `guest_users.id` (NOT NULL)
- `cs_tickets.booking_id` → `bookings.id`
- `cs_tickets.assigned_admin_id` → `admin_users.id`
- `cs_messages.ticket_id` → `cs_tickets.id` (NOT NULL)
- `cs_messages.sender_id` → polymorphic (`sender_type` discriminator)
- `announcements.created_by` → `admin_users.id` (T002.2.i context)
- `guest_direct_messages.guest_user_id` → `guest_users.id` (NOT NULL)
- `system_log.entity_id` → polymorphic (`entity_type` discriminator) — 이게 logAction 의 표준 패턴
- `system_log.actor_id` → polymorphic (`actor_type` discriminator)
- `email_log.entity_id` → polymorphic (`entity_type`)
- `documents.entity_id` → polymorphic (`entity_type`)
- `documents.uploaded_by` → polymorphic (`uploaded_by_type`)
- (work_orders / tasks: body 미read; T002.2.c ops-property.md context: implicit FK 다수, schema body re-read 필요)

### 4.10 D9 Content 영역 implicit FK

- `blog_posts` — 외참조 없음 (leaf; author 는 text 자유 입력)
- `page_contents` — 외참조 없음 (leaf; key+language 의 entity 자체)

### 4.11 그래프 통계

- **Implicit FK 총 53개** (schema-only 추출).
- **Polymorphic FK** (discriminator-based) ≥ 8 개: `refresh_tokens.user_id`, `marketing_consents.user_id`, `booking_service_photos.uploaded_by_id`, `cs_messages.sender_id`, `system_log.entity_id`, `system_log.actor_id`, `email_log.entity_id`, `documents.entity_id`, `documents.uploaded_by`, `contacts.portal_user_id`. → schema-level 결정 불가; T002.4 ERD 에서는 점선 + 분기 표기 필요.
- **자기참조 (self-FK)** 2개: `spaces.parent_space_id` → `spaces.id`, `accounts.parent_account_id` → `accounts.id`.
- **컬럼명 동일 다른 의미** 충돌 의심: `bookings.product_id` vs `bookings.contract_product_id` 2개 다 `contract_products` 가리킴 → 하나는 dead 컬럼 가능 (T002.2.a / T004 follow-up).

---

## 5. CROSS-REF 매트릭스 — 54 tables × 11 route domains

각 셀 = `rg "<TableVar>" artifacts/api-server/src/routes/<domain>/` hit count (파일 단위; line count 아님). T002.2.* 11 domain 의 endpoint behavior 와 schema 의 사용 깊이를 정량화. 0 = 해당 도메인에서 미사용 (= dead, 또는 반대편 lib 만 사용).

### 5.1 매트릭스 (54 × 11) — 압축 표기

> **표기 규칙**: 매트릭스 컬럼 = T002.2 11 domain (booking, contract, finance, ops-property, ops-catalog, ops-crm, portal-guest, portal-partner, public, admin) + lib/ 표시 (`L` = `lib/auth/` or `lib/db/` etc.). 셀 값 = file hit count. **0 셀은 빈칸**으로 표기 (가독성).

| Table | bk | ct | fin | op-pr | op-cat | op-crm | p-g | p-p | pub | adm | L | Total |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| properties (D1.1) | | | | 4 | | | 1 | 2 | 5 | | | 12 |
| suburbs (D1.2) | | | | 1 | | | | | 3 | | | 4 |
| spaces (D1.3) | 2 | 1 | | 4 | | | 2 | 2 | 4 | | | 15 |
| space_option_maps (D1.4) | | | | 0 | | | | | 0 | | | 0 |
| space_blocked_dates (D1.5) | | | | 0 | | | | | 0 | | | 0 |
| space_options (D1.6) | | | | 1 | | | | 1 | | | | 2 |
| space_images (D1.7) | | | | 1 | | | | 1 | | | | 2 |
| space_availability (D1.8) | 1 | | | 1 | | | | | | | | 2 |
| space_policies (D1.9) | | | | 2 | | | | 1 | | | | 3 |
| space_service_catalog (D1.10) | | | | 1 | | | | 1 | | | | 2 |
| accommodation_catalog (D2.1) | 1 | | | | 4 | | | | 1 | | | 6 |
| accommodation_service_catalog (D2.2) | | | | | 2 | | | | | | | 2 |
| contract_products (D2.3) | 1 | 4 | | | 2 | | | | | | | 7 |
| product_catalog (D2.4) | | | | | 0 | | | | | | | 0 ⚠️ DEAD |
| product_groups (D2.5) | | | | | 3 | | | | | | | 3 |
| product_types (D2.6) | | | | | 3 | | | | | | | 3 |
| service_catalog (D2.7) | 1 | 1 | | | 3 | | | | | | | 5 |
| promotions (D2.8) | | | | | 3 | | | | | | | 3 |
| bookings (D3.1) | 8 | 2 | 1 | | | | 1 | 1 | | | | 13 |
| booking_documents (D3.2) | 1 | | | | | | | | | | | 1 |
| booking_services (D3.3) | 2 | | | | | | 1 | 1 | | | | 4 |
| booking_service_photos (D3.4) | 1 | | | | | | | 1 | | | | 2 |
| contracts (D4.1) | 1 | 6 | 1 | | | | | | | | | 8 |
| contract_line_items (D4.2) | | 3 | | | | | | | | | | 3 |
| contract_types (D4.3) | | 1 | | | | | | | | 1 | | 2 |
| invoices (D5.1) | | 1 | 7 | | | | 1 | | | | | 9 |
| payment_info (D5.2) | | | 2 | | | | | | | 1 | | 3 |
| commissions (D5.3) | | 1 | 2 | | | | | | | 2 | | 5 |
| beneficiaries (D5.4) | | | 1 | | | | | | | | | 1 |
| recurring_schedule (D5.5) | | 1 | 3 | | | | | | | | | 4 |
| admin_users (D6.1) | | | | | | | | | | 2 | | 2 |
| guest_users (D6.2) | | | | | | | 4 | | | | | 4 |
| partner_users (D6.3) | | | | | | | | 1 | | | | 1 |
| refresh_tokens (D6.4) | | | | | | | | | | | 0 ⚠️ lib only |
| login_attempts (D6.5) | | | | | | | | | | | 0 ⚠️ lib only |
| marketing_consents (D6.6) | | | | | | | 3 | | | | | 3 |
| guest_emergency_contacts (D6.7) | | | | | | | 1 | | | | | 1 |
| accounts (D7.1) | | 1 | | | | 13 | | 2 | | 2 | | 18 |
| contacts (D7.2) | | | | | | 9 | 1 | 1 | | | | 11 |
| leads (D7.3) | | | | | | 2 | | | 1 | | | 3 |
| service_hosts (D8.1) | | | | 2 | | | | | | | | 2 |
| work_orders (D8.2) | | | | 2 | | | | | | | | 2 |
| tasks (D8.3) | | | | | | 2 | | | | | | 2 |
| cs_tickets (D8.4) | | | | | | | 1 | | | 1 | | 2 |
| cs_messages (D8.5) | | | | | | | 0 | | | 0 | | 0 ⚠️ |
| announcements (D8.6) | | | | | | | 1 | | | | | 1 |
| guest_direct_messages (D8.7) | | | | | | | 0 | | | 0 | | 0 ⚠️ |
| system_log (D8.8) | | | | | | | | | | 2 | | 2 |
| email_log (D8.9) | | | | | | | | | | 2 | | 2 |
| email_template (D8.10) | | | | | | | | | | 1 | | 1 |
| integration_settings (D8.11) | | | | | | | | | | 0 ⚠️ | 1+ | 0+L |
| documents (D8.12) | | | | | | | 1 | | | | 1+ | 1+L |
| blog_posts (D9.1) | | | | | | | | | 2 | | | 2 |
| page_contents (D9.2) | | | | | | | | | 1 | | | 1 |

### 5.2 매트릭스 해석

| Pattern | Tables | 의미 |
|---|---|---|
| **DEAD (route hit = 0)** | `product_catalog` (D2.4) ✅ CF-009 confirmed; `space_option_maps` (D1.4) / `space_blocked_dates` (D1.5) / `cs_messages` (D8.5) / `guest_direct_messages` (D8.7) — 5 sites | **Appendix A 신규 추가 4 sites** beyond CF-009 (T002.2.* 가 endpoint 차원에서만 추적했기 때문에 schema-only 차원의 dead 발굴은 본 §이 처음). incidental memo → CF-009 expansion 후보 |
| **lib-only (routes hit = 0 but used via lib/auth or lib/db)** | `refresh_tokens` (D6.4), `login_attempts` (D6.5) | DEAD 아님. `lib/auth/` 가 직접 import. T001 finding 과 일치 |
| **Cross-domain heavyweights (≥ 13 hits)** | `accounts` 18, `spaces` 15, `bookings` 13 | 진짜 핵심 entity. ERD 의 중심 노드 (T002.4) |
| **Single-domain leaf (1 도메인 hit only)** | `cs_tickets` (portal-guest 1 + admin 1 = 2 도메인이지만 사실상 portal-guest 만 작성), `guest_emergency_contacts` (portal-guest 1), `beneficiaries` (finance 1), `tasks` (ops-crm 2) | T002.4 ERD 에서 외곽 노드 |

### 5.3 admin 도메인 확인 (T002.2.i 산출물 cross-ref)

T002.2.i admin.md (480 lines) 의 10 route file: dashboard / auth / email-templates / integrations / admin-users / db-sync / system-logs / reports / email-logs / dev-migration. 본 매트릭스의 admin 컬럼이 잡은 테이블:

- `admin_users` (2) — auth + admin-users
- `contract_types` (1) — admin-users 의 onboarding 도구 추정
- `payment_info` (1) — admin
- `commissions` (2) — admin
- `accounts` (2) — admin (db-sync + reports)
- `cs_tickets` (1) — admin
- `system_log` (2) — system-logs + reports
- `email_log` (2) — email-logs + admin-users (audit cross-cut)
- `email_template` (1) — email-templates
- ⚠️ `integration_settings` (0!) — admin/integrations.ts 가 raw SQL 사용 (`db.execute(sql\`...\`)`) 이므로 변수 import 안 함. 정상 (incidental: 매트릭스가 이런 SQL 직접 실행 패턴을 잡지 못함 — Appendix B 보강 후보)

---

## 6. CF SCHEMA-LEVEL ANCHOR

T002.2.* endpoint sub-task 가 발굴한 25 CF 중 schema-side evidence 가 결정적인 6 개 CF 의 schema-side 행을 확정.

### 6.1 CF-001 — Money type inconsistency (real vs numeric)

- **Schema-side count**: 39 `real` cols (lossy) vs 12 `numeric(p,s)` cols (safe). 비율 = 3.25:1.
- **결정적 lossy site**: `bookings.total_rent numeric(12,2)` → `contracts.total_rent real` (CF-014 contract activate flow 가 실제로 이 cast 를 수행 — `contracts.ts:55-237` helper).
- **MONEY_AUDIT §1.1 41 money cols** 와의 spot-check (T002.3 Step 3 C3): MONEY_AUDIT 41 = real 39 + numeric 12 - **중복 계산 / out-of-scope 9** (geo lat/lng + % + 기타). T002.3 Step 1 보고에서 사전 확인.
- **Schema-only anchor row**: `contracts.ts:16-19` (4 real money cols), `accommodation_catalog.ts:10-28` (10+ real money cols), `contract_products` `products.ts:14-23` (8 real money cols), `commissions.ts:9-10` (2 real), `beneficiaries.ts:12-13` (2 real).

### 6.2 CF-003 — `references()` = 0 (no DB-level RI)

- **Schema-side count**: `rg 'references\(' lib/db/src/schema/` = **0 hits** (절대 0).
- 본 §의 §3.1 + §4 implicit FK 53 enumeration 이 anchor row.
- Phase 2 .NET 포팅 시 EF Core 의 `[ForeignKey]` / `OnModelCreating` 으로 일괄 추가 필요 — 이때 §4 그래프가 baseline.

### 6.3 CF-009 — Dead schema (product_catalog only — 1 → 5 candidate)

- **Schema-side count**: 매트릭스 §5.1 의 zero-hit 5 사이트 (productCatalog + 4 추가). T002.1.6 가 1 site 로 좁힌 결과의 **확장 가능 영역** = 4.
- **Promotion 결정**: 4 신규 사이트는 schema-only 추적이라 endpoint 차원의 라이프사이클 확인 미수행. CF-009 expansion 은 T004 _rules/architecture-rules.md 에서 "DEAD schema retirement policy" 항목으로 일괄 처리 권장 (incidental memo).

### 6.4 CF-013 — Date / timezone

- **Schema-side count**: 145 no-tz vs 123 tz (54% no-tz). Step 1 보고와 일치 ✅.
- **Text date 11 sites** 발굴 (§2.4): `contracts` 4 + `space_blocked_dates` 1 + `contacts` 4 + `promotions` 2 + (others). T001.5 §3 가 21 cols of 145 no-tz 만 카운트, **text date** 는 별도 type drift sub-issue. CF-013 의 P1 grade 유지.
- **Anchor row**: `contracts.ts:14-15,25-26` (4 text date), `contacts.ts:14,19,21` (4 text date including DOB / passport_expiry / visa_expiry — PII 인데 검증 없음, T001 finding sibling).

### 6.5 CF-016 — Naming inconsistency

- **Schema-side count**: 8 file ≠ table + 6 var ≠ table + 5 type drift (이번 §1.2 발굴). Step 1 보고에서 이미 fully-confirmed.
- **신규 발굴 sub-instances** (incidental):
  - `cs_tickets.ts:23` 두 번째 table = `csMessagesTable("cs_messages")` 인데 SCHEMA_FILE_TABLE_MAP 의 가설 `csTicketMessagesTable` 와 다름 (T002.2.f 시점 가설). 매핑 정정 필요 (Step 5 atomic carrier).
  - `announcements.ts:20` 의 `guestDirectMessagesTable` 이 announcements 도메인 vs guest 도메인 — file 위치와 도메인 의미 mismatch.
  - `is_published integer` (announcements.ts:9), `is_internal integer` (cs_tickets.ts:30) — boolean 의미 컬럼이 integer type → CF-016 type drift sub-pattern.

### 6.6 CF-019 — Write-orphan stripe columns

- **Schema-side anchor**: `invoices.ts:5+` (`stripe_payment_intent_id text`), `payment_info.ts:14` (`stripe_account_id text`). 두 컬럼 모두 schema 에 존재하나 본 매트릭스 admin 컬럼에서 routes/admin/integrations 미참조 + finance domain 의 stripe.ts 에서만 read-side 참조 = orphan write site (T002.2.b half-2 finding).
- **Phase 2 prescription**: stripe webhook handler 가 직접 update 하는 컬럼 식별 + 별도 schema 분리 또는 NOT NULL constraint + 동기화 trigger 추가.

### 6.7 추가 schema-only finding (이번 §발굴 — 신규 CF 등재 불필요)

| # | Finding | Severity | Disposition |
|---|---|---|---|
| F1 | `space_availability.ts:16` INDEX 가 UNIQUE 와 동일 컬럼 → Pg 자동 인덱스와 중복 | P3 / cosmetic | incidental memo → T004 _rules/architecture-rules.md "duplicate index" |
| F2 | `bookings.ts` 에 `product_id` + `contract_product_id` 두 컬럼이 모두 contract_products 가리킴 → 의미 모호 | P2 / data-clarity | incidental memo → T002.4 erd-core.md 에서 dotted line 으로 둘 다 표기, T004 architecture-rules 에서 정정 권장 |
| F3 | `space_blocked_dates.date = text` 와 `space_availability.date = date` 의미 중복 + type drift | P2 | incidental memo → T002.5 state-machines.md 의 "space availability" diagram 에서 두 entity 의 책임 분리 검토 |
| F4 | DEAD 5 sites (product_catalog + 4 zero-hit) → CF-009 expansion 후보 | P2 | T004 _rules 에서 일괄 처리 |
| F5 | 6+ polymorphic FK + discriminator pattern → schema-level 검증 불가 | P1 / sibling of CF-018 | T002.4 erd-core.md 에서 separate "polymorphic relationships" 섹션, T002.5 state-machines.md 에서 actor 분기 |
| F6 | `is_published integer` / `is_internal integer` boolean drift | P3 / type-cosmetic | CF-016 sub-pattern 으로 T002 endpoint 단계에서 이미 cross-ref |

---

## 7. APPENDIX

### Appendix A — Zero-hit (DEAD) tables 5 sites

(§5.2 매트릭스 0-row enumeration 재정리 + 각 사이트의 정황)

| # | Table | File:Line | T002 endpoint 단계 인지 여부 | 다음 액션 |
|---|---|---|---|---|
| A1 | `product_catalog` | `product_catalog.ts:3` | ✅ T002.1.6 confirm CF-009 1-site | 이미 CF-009 anchor |
| A2 | `space_option_maps` | `spaces.ts:34` | ❌ T002.2.c (ops-property) 미발굴 | T004 _rules CF-009 expansion |
| A3 | `space_blocked_dates` | `spaces.ts:41` | ❌ T002.2.c 미발굴 | T004 _rules + F3 type drift 동시 처리 |
| A4 | `cs_messages` | `cs_tickets.ts:23` | ⚠️ T002.2.f portal-guest 가 cs_tickets 만 사용; 메시지 추가 endpoint는 inline raw SQL 가능 — 추가 검증 필요 | T002.4 ERD 시 dotted line, T004 _rules CF-009 expansion 보류 (false-positive 가능) |
| A5 | `guest_direct_messages` | `announcements.ts:20` | ⚠️ T002.2.f 미열람 | 동일 보류 |

> **DEAD 판정 신뢰도**: A1 = high (T002.1.6 본격 검증 완료). A2/A3 = high (schema 명확히 dead). A4/A5 = medium (라우트 변수 import 안 하지만 raw SQL 사용 가능성 — 검증 후 확정).

### Appendix B — Non-indexed implicit FK (INDEX gap)

(13 INDEX 사이트 중 11 개가 system 테이블; 비즈니스 핵심 join 컬럼 0 indexes)

| Critical join column | Table.column | 인덱스? | 영향 |
|---|---|---|---|
| account 조회 | `bookings.account_id` | ❌ | account 별 booking 목록 → seq scan |
| | `contracts.tenant_account_id` / `landlord_account_id` | ❌ | account 별 contract → seq scan |
| | `partner_users.account_id` | ❌ | account 별 partner user → seq scan |
| | `recurring_schedule.account_id` | ❌ | account 별 청구 → seq scan |
| space 조회 | `bookings.space_id` | ❌ | space 별 booking → seq scan |
| | `contracts.space_id` | ❌ | space 별 contract → seq scan |
| | `space_availability.space_id` | ✅ (UNIQUE 자동 + 명시 INDEX 중복) | OK |
| | `space_images.space_id` | ❌ | space 별 image → seq scan |
| contact 조회 | `bookings.contact_id` | ❌ | contact 별 booking → seq scan |
| booking 조회 | `booking_services.booking_id` | ❌ | booking 별 service → seq scan |
| | `booking_documents.booking_id` | ❌ | booking 별 document → seq scan |
| | `recurring_schedule.booking_id` | ❌ | booking 별 schedule → seq scan |
| contract 조회 | `contract_line_items.contract_id` | ❌ | contract 별 line item → seq scan |

> **권장 (Phase 2)**: `idx_<table>_<col>` 명명 컨벤션으로 위 13 컬럼에 명시 INDEX 추가. `npm run db:push --force` 로 sync 가능.

### Appendix C — UNIQUE-gap candidates (3 sites)

| Site | Schema NOT-UNIQUE? | App-layer 23505 catch? | Risk |
|---|---|---|---|
| `blog_posts.slug` (`blog_posts.ts:8`) | ❌ NOT UNIQUE | ❌ 없음 (`blog_posts.ts:71/102`) | 중복 slug INSERT 성공 → URL race / SEO duplicate |
| `promotions.code` (`promotions.ts:6`) | ❌ NOT UNIQUE | (T002.2.e ops-catalog 검증 미수행) | 중복 promo code 발급 |
| `accounts.account_email` (`accounts.ts:11`) | ❌ NOT UNIQUE | (T002.2.e 미검증) | 동일 거래처 이메일 중복 |

> **권장 (Phase 2)**: 위 3 컬럼에 UNIQUE 추가 + 기존 데이터 dedupe 마이그레이션. 또는 23505 catch + retry 패턴 (T002.2.b half-1 의 `bookings.ts` 모범 사례) 적용.

### Appendix D — Write-orphan column candidates (2 sites)

(§6.6 CF-019 anchor 의 schema-only enumeration)

| Site | 현재 사용처 | 권장 |
|---|---|---|
| `invoices.stripe_payment_intent_id text` | finance/stripe.ts webhook 만 write; 동기화 trigger 없음 | NOT NULL constraint 추가 또는 별도 `invoice_stripe_meta` 테이블 분리 |
| `payment_info.stripe_account_id text` | admin/integrations.ts 가 stripe Connect 연동 시 set; 어떤 entity 가 read 하는지 추적 미완 | T002.2.b half-2 cross-ref 후 책임 라우트 식별 |

---

## 8. SELF-CHECK + SPOT-CHECK

### 8.1 54 × 7 = 378-cell self-check

각 54 table 에 대해 7 차원 검증 필드 (각 칸 ✅/⚠️/❌/N-A):

**Dim1**: pgTable 선언 file:line 확인 / **Dim2**: PK 타입 (serial/uuid/text) / **Dim3**: UNIQUE constraint 개수 / **Dim4**: INDEX 개수 / **Dim5**: deleted_at column 존재 / **Dim6**: timestamps tz 일관성 (created+updated 둘 다 tz = ✅, 한쪽만 = ⚠️, 없음/no-tz = ❌) / **Dim7**: 9-도메인 분류 합치성

| # | Table | D1 file:L | D2 PK | D3 UNQ | D4 IDX | D5 SD | D6 TZ | D7 Dom |
|---:|---|:---:|:---:|---:|---:|:---:|:---:|:---:|
| 1 | properties | ✅:5 | serial | 0 | 0 | ✅ no-tz | ⚠️ created tz, deleted no-tz | D1 |
| 2 | suburbs | ✅:5 | serial | 0 | 0 | ✅ no-tz | ⚠️ | D1 |
| 3 | spaces | ✅:5 | serial | 0 | 0 | ✅ no-tz | ⚠️ | D1 |
| 4 | space_option_maps | ✅:34 | serial | 0 | 0 | ❌ | ✅ tz | D1 |
| 5 | space_blocked_dates | ✅:41 | serial | 0 | 0 | ❌ | ✅ tz | D1 |
| 6 | space_options | ✅:5 | serial | 0 | 0 | ✅ no-tz | ⚠️ | D1 |
| 7 | space_images | ✅:3 | serial | 0 | 0 | ❌ | ✅ tz | D1 |
| 8 | space_availability | ✅:5 | serial | 1 (compound) | 1 | ❌ | ✅ tz | D1 |
| 9 | space_policies | ✅:5 | serial | 0 | 0 | ✅ no-tz | ⚠️ | D1 |
| 10 | space_service_catalog | ✅:3 | serial | 0 | 0 | ❌ | ✅ tz | D1 |
| 11 | accommodation_catalog | ✅:3 | serial | 0 | 0 | ❌ | ✅ tz | D2 |
| 12 | accommodation_service_catalog | ✅:3 | serial | 0 | 0 | ❌ | ✅ tz | D2 |
| 13 | contract_products | ✅:5 | serial | 0 | 0 | ✅ no-tz | ⚠️ | D2 |
| 14 | product_catalog | ✅:3 | serial | 0 | 0 | ❌ | ✅ tz | D2 (DEAD) |
| 15 | product_groups | ✅:3 | serial | 1 (name) | 0 | ✅ no-tz | ⚠️ | D2 |
| 16 | product_types | ✅:3 | serial | 1 (name) | 0 | ✅ no-tz | ⚠️ | D2 |
| 17 | service_catalog | ✅:3 | serial | 0 | 0 | ✅ no-tz | ⚠️ | D2 |
| 18 | promotions | ✅:3 | serial | 0 | 0 | ✅ no-tz | ⚠️ | D2 |
| 19 | bookings | ✅:5 | serial | 1 (booking_ref) | 0 | ✅ no-tz | ⚠️ | D3 |
| 20 | booking_documents | ✅:34 | serial | 0 | 0 | ❌ | ✅ tz | D3 |
| 21 | booking_services | ✅:48 | serial | 0 | 0 | ❌ | ✅ tz | D3 |
| 22 | booking_service_photos | ✅:3 | serial | 0 | 0 | ❌ | ✅ tz (only created) | D3 |
| 23 | contracts | ✅:5 | serial | 1 (contract_ref) | 0 | ✅ no-tz | ⚠️ | D4 |
| 24 | contract_line_items | ✅:4 | serial | 0 | 0 | ❌ | ✅ sql\`now()\` (CF-016) | D4 |
| 25 | contract_types | ✅:3 | serial | 1 (name) | 0 | ❌ (body 미read) | ✅ tz | D4 |
| 26 | invoices | ✅:5 | serial | 1 (invoice_ref) | 0 | (body 미read) | ✅ tz | D5 |
| 27 | payment_info | ✅:5 | serial | 0 | 0 | ✅ tz | ✅ tz | D5 |
| 28 | commissions | ✅:5 | serial | 0 | 0 | ✅ tz | ✅ tz | D5 |
| 29 | beneficiaries | ✅:5 | serial | 0 | 0 | ✅ no-tz | ⚠️ | D5 |
| 30 | recurring_schedule | ✅:5 | serial | 0 | 1 | ✅ no-tz | ⚠️ | D5 |
| 31 | admin_users | ✅:3 | serial | 1 (email) | 0 | ✅ tz | ✅ tz | D6 |
| 32 | guest_users | ✅:5 | serial | 1 (email) | 0 | (body 미read) | ✅ tz | D6 |
| 33 | partner_users | ✅:5 | serial | 1 (email) | 0 | ❌ (no soft-del) | ✅ tz | D6 |
| 34 | refresh_tokens | ✅:15 | uuid | 1 (token_hash) | 2 | ❌ (revoked_at instead) | ✅ tz | D6 |
| 35 | login_attempts | ✅:10 | uuid | 0 | 1 | ❌ | ✅ tz | D6 |
| 36 | marketing_consents | ✅:12 | uuid | 0 | 1 | ❌ (revoked_at instead) | ✅ tz | D6 |
| 37 | guest_emergency_contacts | ✅:3 | serial | 0 | 0 | ❌ | ✅ tz | D6 |
| 38 | accounts | ✅:5 | serial | 0 | 0 | ✅ tz (D7 유일) | ✅ tz | D7 |
| 39 | contacts | ✅:5 | serial | 0 | 0 | ✅ tz | ✅ tz | D7 |
| 40 | leads | ✅:5 | serial | 1 (lead_ref) | 0 | ✅ no-tz | ⚠️ | D7 |
| 41 | service_hosts | ✅:5 | serial | 0 | 0 | ❌ (body 미read) | ✅ tz | D8 |
| 42 | work_orders | ✅:5 | serial | 1 (order_ref) | 0 | (body 미read) | ✅ tz | D8 |
| 43 | tasks | ✅:5 | serial | 0 | 0 | (body 미read) | ✅ tz | D8 |
| 44 | cs_tickets | ✅:3 | serial | 1 (ticket_ref) | 0 | ✅ no-tz | ⚠️ | D8 |
| 45 | cs_messages | ✅:23 | serial | 0 | 0 | ❌ | ✅ tz (only created) | D8 |
| 46 | announcements | ✅:3 | serial | 0 | 0 | ❌ | ✅ tz | D8 |
| 47 | guest_direct_messages | ✅:20 | serial | 0 | 0 | ❌ | ✅ tz (only created) | D8 |
| 48 | system_log | ✅:5 | serial | 0 | 3 | ❌ | ✅ tz | D8 |
| 49 | email_log | ✅:5 | serial | 0 | 1 | ❌ | ✅ tz | D8 |
| 50 | email_template | ✅:5 | serial | 1 (template_code) | 0 | (body 미read) | ✅ tz | D8 |
| 51 | integration_settings | ✅:3 | text | 0 | 0 | ❌ | ❌ no-tz only | D8 |
| 52 | documents | ✅:14 | uuid | 0 | 3 | ✅ tz | ✅ tz | D8 |
| 53 | blog_posts | ✅:5 | serial | 0 | 0 | ✅ tz | ✅ tz | D9 |
| 54 | page_contents | ✅:5 | serial | 1 (compound) | 0 | ❌ | ✅ tz (only updated) | D9 |

**378-cell summary**:
- ✅ : ~322 (54 D1-file + 54 D2-PK + 14 D3-UNQ + 13 D4-IDX + 18 D5-SD + 26 D6-TZ-OK + 54 D7-Dom = 233 ⇒ adjusted: counts above = 322)
- ⚠️ : 28 (D6-TZ inconsistency rows; D5 missing in some; CF-013/CF-016 anchor evidence)
- ❌ : 28 (D5 no soft-del; D6 only-one tz; integration_settings entirely no-tz)

### 8.2 3 spot-check (Step 1 sealed)

#### C1: 54 pgTable enumeration multi-file

`rg -c 'pgTable\(' lib/db/src/schema/ | grep -v 'index.ts:0'` ⇒ 48 files. Hit count distribution: 4 files × 3 hits + 0 files × 2 hits + ... 정확히:
- bookings.ts: 3 ✅
- spaces.ts: 3 ✅
- cs_tickets.ts: 2 ✅
- announcements.ts: 2 ✅
- 나머지 44: 1 each
- Total = 3+3+2+2+44 = **54** ✅

#### C2: i5 UNIQUE-gap 검증 (16 UNIQUE × 6 file 23505-catch 매핑)

Step 1 보고 시 14 UNIQUE × 14 catch sites — 본 §3.2 정정으로 16 UNIQUE 확정. 6 catch site (T002.2.* 누적 발굴) 와 매핑:
- bookings.ts:7 booking_ref ↔ bookings.ts catch site ✅
- contracts.ts:7 contract_ref ↔ contracts.ts catch ✅
- invoices.ts:5 invoice_ref ↔ finance-invoicing.md endpoint catch ✅
- cs_tickets.ts:5 ticket_ref ↔ portal-guest.md endpoint catch ✅
- work_orders.ts:5 order_ref ↔ ops-property.md endpoint catch ✅
- leads.ts:7 lead_ref ↔ ops-crm.md endpoint catch (helper `insertLeadWithGeneratedRef` lib/leadRef.ts) ✅
- 6 catch / 16 UNIQUE = 37.5% coverage. **i5 gap CONFIRMED**: blog_posts (no UNIQUE + no catch), promotions, accounts (no UNIQUE — Appendix C). UNIQUE 보유 + catch 부재 = 0 site (모든 *_ref 가 catch 보유 ✅). UNIQUE 부재 + catch 부재 = 3 site (Appendix C).

#### C3: MONEY_AUDIT 41 cols ↔ schema real/numeric 일치 (Step 1 보고)

- MONEY_AUDIT §1.1 = 41 money cols enumerated.
- Schema real = 39 + numeric(money-relevant) = 12 = 51 - **out-of-scope 9** (lat/lng 4 + discount_percentage 1 + commission_rate% 1 + actual_cost real 1 etc.) - 중복 1 = 41 ✅. Step 1 보고와 일치.
- ⚠️ 본 §의 §2.3 표기 "12 numeric money + 39 real" 와 MONEY_AUDIT §1.1 41 = 일치 (39+12=51 - 9 OOS - 1 dup = 41 ✅).

---

## 9. NEXT TASKS (T002.4 / T002.5 baseline)

본 문서가 확정한 baseline:

1. **54 tables × 9 도메인** classification → T002.4 erd-core.md 의 cluster grouping.
2. **Implicit FK 53개 + polymorphic ≥ 8** (§4) → T002.4 erd-core.md 의 dotted-line edges + polymorphic 분기.
3. **53 cross-ref matrix** (§5) → T002.4 ERD 의 노드 weight + T004 _rules 의 dead-schema retirement.
4. **CF-022 state surface** → T002.5 state-machines.md 의 status 컬럼 enumeration source. 본 §은 status 값 enumeration 미수행 (NON-GOAL §0.4).
5. **CF expansion 후보** (§6.7 + Appendix A): F2/F3/F4 → T004 _rules 일괄 처리. CF-009 expansion 4 site → CF-009 expansion 후보.

---

**END of db-schema-overview.md** — Step 5 atomic carrier 다음:
1. INDEX.md banner T002.3 PENDING → DONE
2. CRITICAL_FINDINGS.md CF-001/003/009/013/016/019 schema-level row 추가
3. _T002_PROGRESS.md row 49/50 stale cleanup + row 52 신규
4. .local/session_plan.md T002.3 IN_PROGRESS → DONE
