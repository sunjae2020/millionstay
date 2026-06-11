# Owner Landing Sites — 오너별 독립 랜딩 페이지

> 상태: 제안 / 구현 진행 중
> 작성: 2026-06-11
> 관련 앱: `million-stay-web`, `owner-portal`, `api-server`, `lib/db`

## 1. 목표

각 숙소주(owner)에게 **본인 숙소만 노출·검색되는 독립 랜딩 페이지**를
`{slug}.millionstay.com` 서브도메인으로 제공한다. 랜딩은 **원페이지(single
page)** 형태이며, 오너는 owner-portal에서 브랜딩·소개 콘텐츠와 숙소 설명을
직접 편집하고 **즉시 발행**한다.

### 확정된 설계 결정 (사용자 승인)

| 결정 항목 | 선택 |
|---|---|
| 랜딩 렌더링 방식 | **기존 `million-stay-web`(Vite SPA) 재사용** + 와일드카드 서브도메인 분기 (빠른 출시) |
| 콘텐츠 발행 | **즉시 발행** (관리자 승인 단계 없음) |
| slug 지정 | **오너가 직접 입력** (형식·중복·예약어 검증) |

## 2. 현황 (기준 코드)

- `million-stay-web`은 Vite SPA(Wouter). 이미 hostname 기반 분기 존재
  ([App.tsx](../../artifacts/million-stay-web/src/App.tsx) — `admin.millionstay.com` → `/admin`).
  공개 검색은 `GET /api/v1/public/spaces`
  ([public.ts:78](../../artifacts/api-server/src/routes/public.ts)).
- `owner-portal`은 **읽기 전용** 4개 페이지(Dashboard/Properties/Bookings/Revenue).
  설정·편집·콘텐츠 페이지 없음.
- `api-server`의 `/api/v1/owner/*`는 전부 GET. `requireOwnerAuth`가 `account_id`로
  테넌트 격리 ([requirePartnerAuth.ts:135](../../artifacts/api-server/src/middlewares/requirePartnerAuth.ts)).
- 데이터 모델: `accounts`(owner) → `properties`(`owner_account_id`) → `spaces`
  → `accommodation_catalog`/`space_images`. **slug·subdomain·랜딩 콘텐츠 필드 없음.**

### 핵심 격차

1. `GET /public/spaces`는 `owner_account_id`/`property_id` 필터 불가 → "본인 숙소만 검색" 불가.
2. owner-portal·`/v1/owner/*`가 전부 읽기 전용 → 콘텐츠 편집 불가.
3. 서브도메인·slug·랜딩 콘텐츠를 담을 데이터 모델 없음.

## 3. 아키텍처

```
*.millionstay.com ──(Vercel 와일드카드 도메인 + SSL)──▶ million-stay-web
   부팅 시 hostname 파싱:
     예약어(admin·www·app·api·owner·agent·host…) → 기존 동작
     그 외 slug → <OwnerLanding slug/> 원페이지 렌더
   SEO 보완: react-helmet 동적 <title>/meta/OG (+ 선택적 Vercel 프리렌더)
```

검색 격리는 신규 컬럼 없이 기존 `properties.owner_account_id`를 사용한다.

## 4. 데이터 모델 — 신규 `owner_sites` (account 1:1)

```
id, account_id(unique FK→accounts.id),
slug(unique, indexed) — 서브도메인 라벨,
status('published' 기본 — 즉시 발행 / 'draft'),
logo_url, primary_color, hero_image_url,
content JSONB — 다국어: { en:{hero_title,hero_subtitle,about,contact_email,contact_phone,...}, ko:{...} },
seo_title, seo_description, og_image_url,
custom_domain(nullable — 향후),
deleted_at, created_at, updated_at
```

- **slug 검증**: `^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$` (3–32자, 소문자·숫자·하이픈,
  앞뒤 하이픈 금지) + DB unique + 예약어 블록리스트.
- 마이그레이션은 기존 컨벤션대로 멱등 SQL: `lib/db/drizzle/manual_owner_sites.sql`.

## 5. API

### 공개 (인증 불필요, `public.ts`)

| Method | Path | 설명 |
|---|---|---|
| GET | `/v1/public/sites/:slug` | 사이트 설정(브랜딩·콘텐츠·SEO) + 발행 여부 |
| GET | `/v1/public/sites/:slug/spaces` | 기존 `public/spaces` 로직 재사용 + 해당 owner account로 스코프 (본인 숙소만) |
| GET | `/v1/public/spaces/:id` | 상세 — 기존 엔드포인트 재사용 |
| POST | `/v1/public/sites/:slug/inquiry` | 문의 폼 → lead 저장 + 오너 알림 |

### 오너 (인증, `owner-portal.ts`, 신규 쓰기)

| Method | Path | 설명 |
|---|---|---|
| GET | `/v1/owner/site` | 내 사이트 설정 조회 (없으면 기본값 반환) |
| PUT | `/v1/owner/site` | 브랜딩·콘텐츠·slug·SEO 저장 (즉시 반영) |
| GET | `/v1/owner/site/slug-available?slug=` | slug 중복/형식/예약어 검사 |
| PATCH | `/v1/owner/properties/:id` | 숙소 소개(description) 편집 (소유 검증) |
| PATCH | `/v1/owner/spaces/:id` | 공간 설명·이름 편집 (소유 검증) |

이미지 업로드(로고·히어로)는 기존 Cloudinary 파이프라인 재사용.

## 6. 랜딩 페이지 (원페이지 구성)

단일 스크롤, i18next 다국어:

1. **Hero** — 로고·타이틀·서브타이틀·배경 이미지·CTA
2. **숙소 소개** — 오너 편집 콘텐츠(about)
3. **검색 바** — 본인 숙소로 한정된 날짜/타입/가격 필터
4. **매물 그리드** — 본인 spaces만 → 상세 모달/예약 플로우
5. **편의시설·하이라이트**
6. **갤러리**
7. **문의 폼** — 오너에게 직접
8. **Footer** — "Powered by MillionStay"

## 7. 오너 포털 (owner-portal)

- 신규 "내 사이트" 메뉴: 브랜딩(로고·색)·히어로·소개글·연락처·SEO·slug 편집
  + 라이브 미리보기 + 발행 토글.
- Property/Spaces 인라인 편집(읽기전용 → 쓰기).

## 8. 추가 제안 (후순위)

1. **직접 예약 = 수수료 0 인센티브** — 랜딩 → 예약 플로우, "direct" 채널 귀속.
2. **리드 캡처/알림** — 문의 폼 DB 저장 + 오너 대시보드 노출 + 이메일.
3. **사이트 분석** — 조회수·문의수·전환을 오너 대시보드에.
4. **테마 프리셋** — 코딩 없이 고르는 색상·레이아웃 템플릿.
5. **공유 자산** — 랜딩 URL QR·OG 이미지 자동 생성.
6. **커스텀 도메인**(향후) — Vercel Domains API 자동화.

## 9. 로드맵

- **P1** `owner_sites` 마이그레이션 + slug 스코프 검색 API + 오너 쓰기 엔드포인트
- **P2** owner-portal "내 사이트" + 콘텐츠 편집 UI
- **P3** million-stay-web 와일드카드 분기 + 원페이지 + DNS/SSL
- **P4** 추가기능 (리드·분석·테마)

## 10. 배포 메모

- DB 마이그레이션 `manual_owner_sites.sql` — **2026-06-11 프로덕션 Supabase에 적용 완료**
  (Supabase Management API `POST /v1/projects/{ref}/database/query`로 실행; 직접 psql은
  `db.<ref>.supabase.co:5432` 연결 거부됨). `owner_sites` 테이블 + `leads.owner_account_id`
  존재 확인.
- `million-stay-web`: main 머지 시 Vercel 자동 배포. **와일드카드 도메인
  `*.millionstay.com`을 Vercel 프로젝트에 추가**해야 서브도메인이 동작 (← 남은 작업).
- `owner-portal`: 수동 빌드/배포 패턴 확인 필요.
- `api-server`: main 머지 시 Railway 자동 배포. (Cloudinary 업로드는 Railway에
  `CLOUDINARY_*` 환경변수가 설정돼 있어야 동작.)
</content>
</invoke>
