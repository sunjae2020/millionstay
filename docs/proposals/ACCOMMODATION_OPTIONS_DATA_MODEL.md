# 숙소 옵션 데이터 모델 — 단기 숙소 분류 & 부가 서비스

> 단기(Short-stay) 숙소 상품의 **분류 체계**와 **부가 서비스 카탈로그**를 정의하고,
> DB 스키마 · 관리자 화면 · 다국어(i18n)까지 일관되게 연결하기 위한 기획 문서.
>
> 상태: 1차 구현 완료 (스키마 / API / 관리자 페이지 / i18n) · 작성일 2026-06-11

---

## 1. 개요

숙소 상품은 두 가지 축으로 분류되며, 그 위에 선택적으로 **부가 서비스**가 결합됩니다.

```
숙소 상품 (Accommodation)
├── ① 기간·계약 (contract_term) ─── 단기 / 중기 / 장기
└── ② 룸 형태 (room_type) ──────── 룸 쉐어 / 하우스 쉐어 / 전체 렌트 / 홈스테이
                                      └── 홈스테이 전용
                                            ├── 식사 (meal_plan)  : 미제공 / 부분 제공 / 풀보드
                                            └── 연령 (guest_age)  : 성인 / 미성년자

부가 서비스 (addon_services) ─── 공항 픽업 / 공항 드롭 / 초기 정착 / 린넨 추가 / 선불폰 …
```

- **①②③ 중 ①②(+홈스테이 옵션)** 는 닫힌 집합 → **Postgres enum** 으로 모델링.
- **부가 서비스** 는 가격이 붙고 추후 항목이 늘어나는 열린 집합 → **테이블(catalog)** 로 모델링.

---

## 2. 분류 정의 (Enums)

### 2-1. 계약 기간 `contract_term`

| value | 한국어 | 기간 | 계약 특징 |
|-------|--------|------|-----------|
| `short_term` | 단기 | 1박 ~ 4주 | 일/주 단위, 보증금 적거나 없음, 가구·옵션 완비 |
| `mid_term` | 중기 | 1개월 ~ 6개월 | 월 단위 계약, 가구 포함, 유연한 입·퇴실 |
| `long_term` | 장기 | 6개월 ~ 1년 이상 | 정식 임대차, 보증금·약정 기간, 가구 미포함 가능 |

### 2-2. 룸 형태 `room_type`

| value | 한국어 | 공유 범위 | 설명 |
|-------|--------|-----------|------|
| `room_share` | 룸 쉐어 | 같은 방 공유 | 한 방을 2명 이상이 함께 사용 |
| `house_share` | 하우스 쉐어 | 방 개별, 공용공간 공유 | 개인 방 + 거실·주방·욕실 공유 |
| `entire_place` | 전체 렌트 | 공유 없음 | 집·유닛 전체 단독 사용 |
| `homestay` | 홈스테이 | 호스트와 함께 (**독방 기본**) | 현지 가정 입주, 식사·연령 옵션 선택 |

### 2-3. 식사 옵션 `meal_plan` *(홈스테이 전용)*

| value | 한국어 | 주중(월~금) | 주말·공휴일 |
|-------|--------|-------------|--------------|
| `none` | 미제공 | — | — |
| `partial_board` | 부분 제공 | 2끼 (아침, 저녁) | 3끼 (아침, 점심, 저녁) |
| `full_board` | 풀보드 | 3끼 | 3끼 (주 7일 3끼) |

### 2-4. 연령 옵션 `guest_age` *(홈스테이 전용)*

| value | 한국어 | 대상 |
|-------|--------|------|
| `adult` | 성인 | 만 18세 초과 |
| `minor` | 미성년자 (Under 18) | 만 18세 이하 |

> **규칙:** `meal_plan` / `guest_age` 는 `room_type = 'homestay'` 일 때만 의미를 가지며,
> 그 외 룸 형태에서는 `NULL` 로 유지한다. (관리자 폼에서도 홈스테이 선택 시에만 노출)

---

## 3. 부가 서비스 (Add-on Services, 테이블)

표준 시드 5종 (관리자에서 추가/수정 가능):

| code | 이름 | category | unit | 설명 |
|------|------|----------|------|------|
| `airport_pickup` | 공항 픽업 | transport | per_trip | 공항 → 숙소 이동 |
| `airport_dropoff` | 공항 드롭 | transport | per_trip | 숙소 → 공항 이동 |
| `initial_settlement` | 초기 정착 지원 | living | per_booking | 은행 계좌·교통카드 등 도착 초기 지원 |
| `extra_linen` | 린넨 추가 | supplies | per_item | 침구·수건 등 추가 제공 |
| `prepaid_sim` | 선불폰 (SIM) | telecom | per_item | 현지 유심/선불폰 제공 |

- **category**: `transport` / `living` / `supplies` / `telecom` / `other`
- **unit**: `per_booking` / `per_trip` / `per_week` / `per_item` / `per_month`

---

## 4. DB 스키마

정의 위치: [`lib/db/src/schema/accommodation_options.ts`](../../lib/db/src/schema/accommodation_options.ts)
마이그레이션: [`lib/db/drizzle/manual_accommodation_options.sql`](../../lib/db/drizzle/manual_accommodation_options.sql) *(idempotent, 재실행 안전)*

### 4-1. Enums
`contract_term`, `room_type`, `meal_plan`, `guest_age` — Postgres `CREATE TYPE … AS ENUM`.

### 4-2. `accommodation_catalog` 확장 (추가 컬럼, 모두 nullable)
| 컬럼 | 타입 | 비고 |
|------|------|------|
| `contract_term` | enum | |
| `room_type` | enum | |
| `meal_plan` | enum | 홈스테이만 |
| `guest_age` | enum | 홈스테이만 |

### 4-3. `addon_services` (카탈로그)
`id, code(unique), name, description, category, base_price, currency, unit, is_active, sort_order, deleted_at, created_at, updated_at`

### 4-4. `accommodation_addons` (N:M 연결)
`id, accommodation_id, addon_service_id, price_override, is_included, sort_order, …`
→ 숙소별로 선택된 부가 서비스 + 가격 오버라이드 / 번들(무료 포함) 여부.

---

## 5. API (api-server)

라우트: [`artifacts/api-server/src/routes/addon-services.ts`](../../artifacts/api-server/src/routes/addon-services.ts)
(권한: 기존 admin auth 가드 하위. bulk-delete / permanent delete 는 SuperAdmin 한정 — `product-types` 패턴과 동일)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/v1/addon-services` | 목록 (검색 `?q=`) |
| GET | `/api/v1/addon-services/:id` | 단건 |
| POST | `/api/v1/addon-services` | 생성 (`code`,`name` 필수) |
| PUT | `/api/v1/addon-services/:id` | 수정 |
| DELETE | `/api/v1/addon-services/:id` | 소프트 삭제 (`?permanent=true` → SuperAdmin) |
| POST | `/api/v1/addon-services/bulk-delete` | 일괄 (SuperAdmin) |

> Enum 4종은 코드 레벨 상수(닫힌 집합)이므로 별도 CRUD API 없음 — 값은 i18n 라벨로만 노출.

---

## 6. 관리자 화면 (property-admin)

- **부가 서비스 관리 페이지**: [`pages/settings/sub/AddonServices.tsx`](../../artifacts/property-admin/src/pages/settings/sub/AddonServices.tsx)
  - 라우트 `/settings/addon-services`, Settings 허브 → *Reference Data* 카드로 진입.
- **상품 폼용 재사용 컴포넌트**: [`components/AccommodationOptionFields.tsx`](../../artifacts/property-admin/src/components/AccommodationOptionFields.tsx)
  - 계약기간 / 룸형태 셀렉트 (필수) + 홈스테이 선택 시 식사 / 연령 셀렉트 노출.
  - 숙소 상품 생성·수정 폼에 `<AccommodationOptionFields value=… onChange=… />` 로 삽입.
- **옵션 상수 단일 출처**: [`lib/accommodationOptions.ts`](../../artifacts/property-admin/src/lib/accommodationOptions.ts)
  - enum 값 ↔ i18n 키 매핑. DB enum 값과 **반드시 동일**하게 유지.

---

## 7. 다국어 (i18n)

5개 언어(en / ko / ja / zh / th) `translation.json` 에 추가:
- `nav.addon_services`
- `accommodation_options.*` — `field`, `contract_term`, `room_type`, `meal_plan`, `guest_age`, `addon_category`, `addon_unit` + 페이지 UI 문자열.

라벨은 모두 i18n 키로만 렌더링하며, enum **value 자체는 번역하지 않는다**(코드/DB 안정성).

---

## 8. 남은 작업 (Follow-up)

1. **숙소 상품 폼 실제 연결** — `AccommodationOptionFields` 를 Accommodation 상품 생성/수정 폼에 삽입하고 저장 payload에 4개 필드 매핑.
2. **`accommodation_addons` 연결 UI** — 숙소별 부가 서비스 다중 선택 + 가격 오버라이드/번들 토글.
3. **고객 사이트(millionstay-web) 노출** — 분류 필터(기간·룸형태)와 부가 서비스 표시.
4. **마이그레이션 적용** — 운영 DB에 `manual_accommodation_options.sql` 실행 (배포 시 1회).
5. **기존 `term_type` / `includes_meals` 정합성** — 신규 enum 컬럼으로 점진 이관 검토.

---

## 9. 조합 예시

- 단기 + 하우스 쉐어 + (공항 픽업, 선불폰)
- 장기 + 홈스테이(풀보드 · 미성년자) + (공항 픽업, 초기 정착)
- 중기 + 전체 렌트 + (린넨 추가)
