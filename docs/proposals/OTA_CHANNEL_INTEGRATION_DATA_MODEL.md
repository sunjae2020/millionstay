# 제안서 — OTA 채널 연동 데이터 모델 (0단계)

> 대상: Airbnb · Booking.com · Hotels.com(Expedia) 등 외부 숙소 예약 채널 연동
> 범위: **0단계 = 데이터 모델 상세 설계 / 테이블 스키마 초안**
> 작성일: 2026-06-01

---

## 1. 배경 및 목적

MillionStay의 객실(`spaces`)을 외부 OTA에 노출하고, 양쪽의 **가용성·요금·예약**을 동기화하는 채널 매니저(Channel Manager) 기능의 토대를 마련한다. 이 문서는 코드 구현에 앞서 **데이터 모델만** 확정하기 위한 설계 초안이다.

핵심 원칙:

- 기존 `space_availability`를 **가용성 단일 원천(SSOT)** 으로 삼고, OTA는 그 위에 출처(source)만 추가한다.
- iCal 기반(1~3단계)은 신규 테이블 일부만으로 동작 가능하도록 설계한다.
- Channel API(4단계) 확장 시 **스키마 변경 없이** 같은 테이블을 재사용한다.

---

## 2. 현황 분석 — 이미 있는 것 vs 새로 만들 것

### 2.1 이미 존재하는 자산 (재사용)

| 자산 | 위치 | 역할 |
|------|------|------|
| `space_availability` | `lib/db/src/schema/space_availability.ts` | 일별 가용성 캘린더 (SSOT 후보) |
| `bookings.booking_source` | `bookings.ts:12` | 예약 출처 라벨 (사람이 읽는 용도로 유지) |
| `spaces.ical_import_url` | `spaces.ts:19` | 단일 iCal 가져오기 URL (→ 1:N 테이블로 대체 예정) |
| `integration_settings` | `integration_settings.ts` | 전역 key/value (전역 토글에만 사용) |
| `guest_users` | `guest_users.ts` | OTA 게스트 매핑 대상 |
| `node-cron` | api-server | 주기적 iCal 가져오기 스케줄러 |

### 2.2 빠져 있는 것 (신규 개발 대상)

1. 지원 채널 카탈로그 (`channels`)
2. 채널 연결/인증 계정 (`channel_accounts`)
3. **객실 ↔ 외부 리스팅 매핑** (`channel_listings`) — 핵심
4. OTA 예약 ↔ 내부 예약 매핑/원본 보관 (`channel_reservations`)
5. 동기화 운영 로그 (`channel_sync_logs`)
6. 가용성 출처 구분 (기존 `space_availability` 확장)
7. (선택, 4단계용) 날짜별 요금 캘린더 (`space_rate_calendar`)

---

## 3. 제안 데이터 모델 개요

```
channels (지원 OTA 카탈로그)
   └─< channel_accounts (호스트 계정/인증 단위)
          └─< channel_listings (space ↔ 외부 listing 매핑)   ◀── 핵심
                 ├─< channel_reservations ── booking_id ─▶ bookings
                 └─< channel_sync_logs

space_availability  (+source, +channel_listing_id, +external_uid)  ◀── 확장
spaces              (+ical_export_token)                            ◀── 확장
space_rate_calendar (선택 — 4단계 Channel API용)
```

**관계 규칙**

- 한 `space`는 여러 채널에 등록될 수 있다 → `channel_listings`는 (space_id, channel_id) 다대다 해소 테이블.
- 모든 외부 차단/예약은 최종적으로 `space_availability`에 한 줄로 귀결된다 (이중예약 방지의 단일 지점).
- 기존 코드처럼 **DB 레벨 FK 제약은 두지 않고** `integer` 컬럼 + 인덱스로 표현한다(현 컨벤션 유지). 무결성은 애플리케이션 계층에서 보장.

---

## 4. 테이블 스키마 초안 (Drizzle)

> 파일 배치: 각 테이블은 `lib/db/src/schema/channels.ts` 한 파일에 모으거나, 도메인별로 분리 가능. 아래는 단일 파일 기준 초안이며 모두 기존 컨벤션(`serial` PK, `snake_case`, `withTimezone`, `createInsertSchema` + 타입 export, 배열형 인덱스 콜백)을 따른다.

### 4.1 `channels` — 지원 채널 카탈로그

```ts
import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// 지원하는 외부 예약 채널의 마스터 목록. 관리자 포털에서 활성/비활성 토글.
export const channelsTable = pgTable("channels", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),        // "airbnb" | "booking_com" | "expedia" | "direct"
  name: text("name").notNull(),                  // 표시 이름: "Airbnb"
  // 채널이 지원하는 연동 방식 (UI/로직 분기에 사용)
  supports_ical: boolean("supports_ical").notNull().default(true),
  supports_api: boolean("supports_api").notNull().default(false),
  logo_url: text("logo_url"),
  enabled: boolean("enabled").notNull().default(true),
  sort_order: integer("sort_order").notNull().default(0),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertChannelSchema = createInsertSchema(channelsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertChannel = z.infer<typeof insertChannelSchema>;
export type Channel = typeof channelsTable.$inferSelect;
```

초기 시드: `airbnb`, `booking_com`, `expedia`(Hotels.com 모회사), `direct`(자사 직접예약 가상 채널).

### 4.2 `channel_accounts` — 채널 연결/인증 단위

```ts
// 채널 + 호스트 계정 단위의 연결. iCal 단계에선 인증정보가 거의 불필요하며,
// Channel API(4단계)에서 토큰/시크릿을 채운다. 시크릿은 평문 저장 금지(§7 참고).
export const channelAccountsTable = pgTable("channel_accounts", {
  id: serial("id").primaryKey(),
  channel_id: integer("channel_id").notNull(),
  // 이 연결이 속한 소유자 범위 (기존 accounts 테이블의 landlord/owner)
  owner_account_id: integer("owner_account_id"),
  label: text("label").notNull(),                  // "Airbnb - 김호스트 계정"
  // 인증 방식별 자격증명 (암호화/시크릿매니저 참조 토큰을 저장; 평문 금지)
  auth_type: text("auth_type").notNull().default("ical"), // "ical" | "oauth" | "api_key"
  credentials_ref: text("credentials_ref"),        // 시크릿 매니저 키 또는 암호화 페이로드 참조
  external_account_id: text("external_account_id"), // OTA 측 호스트/계정 ID
  status: text("status").notNull().default("Active"), // Active | Disabled | Error
  last_error: text("last_error"),
  connected_at: timestamp("connected_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  index("idx_channel_accounts_channel").on(t.channel_id),
  index("idx_channel_accounts_owner").on(t.owner_account_id),
]);
```

> **iCal MVP 참고:** 1~2단계에서는 `channel_accounts`가 필수는 아니다. iCal URL 자체가 비밀 URL이므로 `channel_listings`만으로 동작 가능. 다만 향후 일관성을 위해 채널당 1개의 기본 계정 행을 만들어 두는 것을 권장.

### 4.3 `channel_listings` — 객실 ↔ 외부 리스팅 매핑 (핵심)

```ts
// 우리 space 하나가 특정 채널에서 어떤 리스팅/객실 ID로 노출되는지의 매핑.
// (space_id, channel_id) 조합당 1행. 동기화의 모든 단위가 여기에 매달린다.
export const channelListingsTable = pgTable("channel_listings", {
  id: serial("id").primaryKey(),
  channel_id: integer("channel_id").notNull(),
  channel_account_id: integer("channel_account_id"),
  space_id: integer("space_id").notNull(),
  // 외부 식별자
  external_listing_id: text("external_listing_id"),  // OTA 리스팅 ID
  external_room_id: text("external_room_id"),        // 객실 타입/룸 ID (Booking.com 등)
  listing_url: text("listing_url"),
  // iCal 양방향
  ical_import_url: text("ical_import_url"),           // OTA → 우리 (가져오기)
  ical_export_enabled: boolean("ical_export_enabled").notNull().default(true), // 우리 → OTA 노출 여부
  // 동기화 토글 (방향/대상별)
  sync_enabled: boolean("sync_enabled").notNull().default(true),
  sync_availability: boolean("sync_availability").notNull().default(true),
  sync_rates: boolean("sync_rates").notNull().default(false),  // 4단계에서 활성
  // 상태/추적
  last_import_at: timestamp("last_import_at", { withTimezone: true }),
  last_export_at: timestamp("last_export_at", { withTimezone: true }),
  last_sync_status: text("last_sync_status"),        // success | partial | failed
  status: text("status").notNull().default("Active"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  unique("channel_listings_space_channel_uq").on(t.space_id, t.channel_id),
  index("idx_channel_listings_space").on(t.space_id),
  index("idx_channel_listings_channel").on(t.channel_id),
]);
```

### 4.4 `channel_reservations` — OTA 예약 수신/매핑

```ts
// OTA에서 들어온 예약의 원본 + 우리 bookings와의 매핑.
// iCal 단계: 예약 상세가 없으므로 가용성 차단으로만 처리(이 테이블은 비어 있을 수 있음).
// API 단계: 게스트/금액 등 상세를 받아 bookings를 자동 생성하고 booking_id로 연결.
export const channelReservationsTable = pgTable("channel_reservations", {
  id: serial("id").primaryKey(),
  channel_id: integer("channel_id").notNull(),
  channel_listing_id: integer("channel_listing_id").notNull(),
  external_reservation_id: text("external_reservation_id").notNull(), // OTA 예약번호
  booking_id: integer("booking_id"),                 // 매칭된 내부 예약 (없으면 미매칭)
  space_id: integer("space_id"),
  // 게스트/일정 스냅샷 (bookings 생성 전 임시 보관)
  guest_name: text("guest_name"),
  guest_email: text("guest_email"),
  check_in_date: date("check_in_date"),
  check_out_date: date("check_out_date"),
  num_guests: integer("num_guests"),
  total_amount: numeric("total_amount", { precision: 12, scale: 2 }),
  currency: text("currency"),
  channel_status: text("channel_status"),            // OTA 측 상태 원문
  reservation_status: text("reservation_status").notNull().default("Received"), // Received | Mapped | Cancelled | Error
  raw_payload: jsonb("raw_payload"),                 // 원본 페이로드 보존(감사/재처리용)
  received_at: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  unique("channel_reservations_ext_uq").on(t.channel_id, t.external_reservation_id),
  index("idx_channel_reservations_booking").on(t.booking_id),
  index("idx_channel_reservations_listing").on(t.channel_listing_id),
]);
```

> import 필요 추가: `date`, `numeric`, `jsonb`.

### 4.5 `channel_sync_logs` — 동기화 운영 로그

```ts
// 모든 동기화 시도의 감사/디버깅 로그. 대시보드·알림·재시도의 근거.
export const channelSyncLogsTable = pgTable("channel_sync_logs", {
  id: serial("id").primaryKey(),
  channel_listing_id: integer("channel_listing_id"),
  channel_id: integer("channel_id"),
  direction: text("direction").notNull(),            // import | export
  sync_type: text("sync_type").notNull(),            // availability | rates | reservations
  status: text("status").notNull(),                  // success | partial | failed
  items_processed: integer("items_processed").notNull().default(0),
  items_failed: integer("items_failed").notNull().default(0),
  error_message: text("error_message"),
  started_at: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finished_at: timestamp("finished_at", { withTimezone: true }),
}, (t) => [
  index("idx_channel_sync_logs_listing").on(t.channel_listing_id),
  index("idx_channel_sync_logs_started").on(t.started_at),
]);
```

---

## 5. 기존 테이블 확장

### 5.1 `space_availability` 확장 (출처 구분 — 멱등 동기화의 핵심)

iCal/API에서 들어온 차단을 재동기화할 때 **중복 없이 갱신·삭제**하려면 출처와 외부 UID가 필요하다.

```ts
// 기존 컬럼에 추가:
  source: text("source").notNull().default("manual"),        // manual | booking | ical | channel_api
  channel_listing_id: integer("channel_listing_id"),         // 채널발 차단의 출처 리스팅
  external_uid: text("external_uid"),                         // iCal VEVENT UID 또는 외부 예약 ID
```

추가 인덱스:

```ts
  index("idx_space_avail_source").on(table.space_id, table.source),
  unique("space_avail_external_uid_uq").on(table.channel_listing_id, table.external_uid),
```

> 효과: iCal 재가져오기 시 `(channel_listing_id, external_uid)` 기준 upsert → 사라진 외부 예약의 차단을 안전하게 해제 가능.

### 5.2 `spaces` 확장 (아웃바운드 iCal 피드 토큰)

우리가 내보내는 `.ics` 피드는 채널과 무관하게 **객실당 동일 내용**이므로 토큰은 space 레벨이 적합하다.

```ts
  ical_export_token: text("ical_export_token"),  // 추측 불가능한 비밀 토큰. /public/spaces/:id/calendar/:token.ics
```

> 기존 `ical_import_url`(단일 컬럼)은 **deprecated** 처리하고 신규 데이터는 `channel_listings.ical_import_url`로 이전. 즉시 삭제하지 않고 마이그레이션 후 제거.

### 5.3 `space_blocked_dates` 정리 권고

`space_availability`와 기능이 중복된다. **`space_availability`를 SSOT로 통일**하고 `space_blocked_dates`는 (a) 데이터 이관 후 폐기하거나 (b) "관리자 수동 차단"의 입력 채널로만 두되 결과는 `space_availability`에 반영. → §9 결정 사항.

---

## 6. (선택) `space_rate_calendar` — 4단계 Channel API용

iCal은 요금을 전송하지 못하므로 **1~3단계에는 불필요**하다. Channel API로 ARI(요금) 동기화를 시작하는 4단계에서 도입한다. 미리 설계만 둔다.

```ts
// 날짜별 요금/숙박제약. 비어 있으면 spaces.base_daily_price로 폴백.
export const spaceRateCalendarTable = pgTable("space_rate_calendar", {
  id: serial("id").primaryKey(),
  space_id: integer("space_id").notNull(),
  date: date("date").notNull(),
  rate: numeric("rate", { precision: 12, scale: 2 }),
  currency: text("currency").notNull().default("AUD"),
  min_stay: integer("min_stay"),
  max_stay: integer("max_stay"),
  closed_to_arrival: boolean("closed_to_arrival").notNull().default(false),
  closed_to_departure: boolean("closed_to_departure").notNull().default(false),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  unique("space_rate_calendar_uq").on(t.space_id, t.date),
  index("idx_space_rate_calendar_space_date").on(t.space_id, t.date),
]);
```

---

## 7. 보안 / 운영 고려사항

- **자격증명 평문 저장 금지.** 현 `integration_settings`는 Stripe 시크릿을 평문 보관 중인데, OTA 토큰은 `channel_accounts.credentials_ref`를 통해 (a) 환경변수/시크릿 매니저 참조 또는 (b) 애플리케이션 레벨 암호화 페이로드로 저장한다.
- **iCal export URL은 비밀 토큰 포함.** 열거(enumeration) 방지를 위해 `spaces.ical_export_token` 필수. 유출 시 토큰 회전.
- **멱등성.** 모든 import는 `external_uid` 기준 upsert. 동일 피드 반복 처리 시 부작용 없어야 함.
- **이중예약 경합.** 동기화는 `space_availability`의 `(space_id, date)` 유니크 제약에 의해 직렬화. 충돌 시 `channel_sync_logs`에 기록 + 알림.
- **레이트리밋/백오프.** OTA API 호출은 채널별 한도가 있으므로 `node-cron` 작업에 지터/백오프 적용.

---

## 8. 단계별 적용 매핑 (어느 테이블이 언제 필요한가)

| 개발 단계 | 필요 테이블 |
|-----------|-------------|
| 1단계 — iCal Export | `spaces.ical_export_token` (확장), `channels`(시드) |
| 2단계 — iCal Import | `channel_listings`, `space_availability` 확장, `channel_sync_logs` |
| 3단계 — 통합 캘린더 UI | (추가 테이블 없음 — 위 데이터 조회) |
| 4단계 — Channel API | `channel_accounts`, `channel_reservations`, `space_rate_calendar` |
| 5단계 — 운영 고도화 | (추가 테이블 없음 — `channel_sync_logs` 활용) |

→ **0단계 산출물로는 7개 테이블/확장 전체를 한 번에 정의**해 두고(스키마 변경 최소화), 단계별로 코드/UI만 붙인다.

---

## 9. 결정 사항 (확정 필요)

1. **파일 구성**: 신규 테이블을 단일 `channels.ts`로 묶을지, 도메인별(`channel_listings.ts` 등)로 나눌지.
2. **`space_blocked_dates` 처리**: SSOT 통일을 위해 폐기할지 / 입력 채널로 유지할지.
3. **PK 타입**: 기존 대다수가 `serial`. 최신 `documents`는 `uuid`. 신규 테이블은 일관성을 위해 **`serial` 권장** (FK가 모두 integer).
4. **마이그레이션 방식**: 현 워크플로우는 `drizzle-kit push`(스키마 우선). 0단계 확정 시 `pnpm --filter @.../db push`로 반영할지, `generate`로 마이그레이션 파일을 남길지.
5. **`channels` 시드 위치**: 기존 `lib/db/seed/` 패턴(translations-seed.sql) 따라 SQL 시드 추가 여부.

---

## 10. 요약

- 기존 `space_availability` 캘린더는 **견고한 토대** → 출처 컬럼 3개만 추가하면 OTA 동기화의 SSOT가 된다.
- 신규 5개 테이블(`channels`, `channel_accounts`, `channel_listings`, `channel_reservations`, `channel_sync_logs`)로 채널 매핑·예약 수신·운영 로그를 모두 커버.
- iCal 단계(1~3)는 `channel_listings` + `space_availability` 확장 + `ical_export_token`만으로 동작 → **빠른 MVP** 가능.
- Channel API(4단계)는 `channel_accounts`·`channel_reservations`·`space_rate_calendar`를 활성화 → **스키마 재변경 없이** 확장.
- 0단계에서 7개 테이블/확장을 한 번에 정의해 이후 단계의 스키마 변경을 최소화한다.
