# 웹사이트 CMS — 블록 기반 페이지 빌더 구현 계획

> 상태: **계획 / 승인 대기**. 코드 미작성.
> 목적: 지금의 "페이지별 고정 필드 폼(page_contents)" CMS를 **블록 트리(UI Blocks) 기반 다중 사이트·다국어 페이지 빌더**로 교체하고,
> 좌측 네비의 흩어진 콘텐츠 메뉴를 **CMS 서브메뉴 하나**로 통합한다.
> 원안은 Edubee CRM 용으로 작성된 문서이며, 이 문서는 그것을 **MillionStay 모노레포 실제 구조에 맞게 변형**한 것이다.

---

## 0. 확정 사항 (2026-08-01, 사용자 결정)

| 갈림길 | 결정 | 결과 |
|---|---|---|
| 본문 편집 모델 | **블록 트리 전면 도입** | `cms_pages` / `cms_page_translations` / `cms_block_templates` 신설. 로케일별 `body_json.blocks[]`. 기존 `page_contents` 는 마이그레이션 후 폴백으로 병행 유지. |
| 대상 사이트 | **www + homestay + Metheim dev-site + 블로그 전부** | 사이트 구분자 `site_key` 를 1급 컬럼으로 도입 (기존 `homestay-` / `dev-` page_key 접두사 관례를 대체). |
| 회사정보 · 디자인 가이드 | **CMS 전용 화면 신규 제작** | 데이터는 기존 SSOT(company_info blob / branding_settings)를 공유하되, CMS 문맥의 별도 편집 화면을 만든다. |
| 산출 단위 | **계획서 먼저** | 이 문서. 승인 후 Phase 0 부터 착수. |

---

## 1. 현재 상태 (실측)

### 1.1 페이지 CMS
- 저장: [`page_contents`](../../lib/db/src/schema/page_contents.ts) — `page_key + language` 유니크, `content jsonb`, `seo_title/description/keywords`.
- API: [`page-contents.ts`](../../artifacts/api-server/src/routes/page-contents.ts) — pageKey/language CRUD + Cloudinary `upload-image`.
- 어드민: [`WebsiteContentList.tsx`](../../artifacts/property-admin/src/pages/content/WebsiteContentList.tsx) (사이트/페이지 카드 목록, 정의가 **소스 하드코딩**) + [`WebsiteContentDetail.tsx`](../../artifacts/property-admin/src/pages/content/WebsiteContentDetail.tsx) (984줄, `PAGE_FIELDS` 로 **페이지마다 고정 필드 목록**을 박아둠 — `hero_title`, `feature_1_title` …).
- 게스트: [`usePageContent.ts`](../../artifacts/million-stay-web/src/lib/usePageContent.ts) 훅으로 **하드코딩된 React 섹션 위에 문구만 오버레이**. 페이지 키 19종 (`dev-*` 13, `homestay-*` 6, www 계열 6).

> 한계: 새 섹션을 넣으려면 개발자가 `PAGE_FIELDS` 와 React 컴포넌트를 동시에 고쳐야 한다. 순서 변경·섹션 추가·삭제가 운영자 손에 없다.

### 1.2 블로그
- [`blog_posts`](../../lib/db/src/schema/blog_posts.ts): `content text`(HTML 단일 덩어리), `translations jsonb`, `cover_image_url`, `category text`, SEO 3필드, `deleted_at`.
- [`blog_categories`](../../lib/db/src/schema/blog_categories.ts), 라우트 2개, 어드민 화면 3개(`BlogList` 206줄 / `BlogDetail` 681줄 / `BlogCategories` 183줄) — **좌측 네비에 별도 2개 메뉴로 분리**되어 있음.

### 1.3 미디어
- DB 테이블 **없음**. [`media.ts`](../../artifacts/api-server/src/routes/media.ts) 가 Cloudinary 를 직접 조회. 폴더 allowlist = `content / spaces / listings / branding` (민감 폴더 의도적 제외).
- `MediaPickerDialog` 는 이미 존재하고 `WebsiteContentDetail` 에서 사용 중.
- 없는 것: 폴더 트리, alt 텍스트, 태그, 검색, 사용처 추적.

### 1.4 네비게이션
[`Layout.tsx:194-199`](../../artifacts/property-admin/src/components/Layout.tsx#L194-L199) — `content` 그룹에 blog / blog-categories / listings / pages / media / page-translations **6개 평면 나열**.

### 1.5 재사용 가능한 자산
- 공용 `DataTable` (컬럼 리사이즈·순서·숨김 DB 저장, 체크박스 벌크 소프트/영구 삭제, 보관함 뷰) — 첨부 스크린샷의 리스트 UX와 사실상 동일한 기능 세트를 이미 보유.
- `translations jsonb` + AI 번역 패턴 — [`content-translations.ts`](../../artifacts/api-server/src/routes/content-translations.ts) (`{ [lang]: { field: value, _source: "machine"|"human" } }`, 폴백 `[lang → ko → en → base]`).
- `MediaPickerDialog`, Cloudinary 업로드 유틸(`cldFolder`), 소프트 삭제 헬퍼, `branding_settings` 런타임 토큰, `@workspace/design-tokens`.

---

## 2. 원안(Edubee) 대비 변형 포인트

| 원안 | MillionStay 적용 | 이유 |
|---|---|---|
| 모든 테이블 `organisation_id` 로 org 스코프 | **`organisation_id` 없음. 대신 `site_key`** | MillionStay 는 화이트라벨 분리를 **배포 단위**로 한다 (인스턴스마다 DB 분리, `branding_settings` 싱글턴 선례). 한 인스턴스 안에서 나뉘는 축은 org 가 아니라 **사이트**(www / homestay / dev). |
| `staticDb` / `TENANT_TABLES` / `publicOrgSchemaContext` | 해당 없음 — 단일 `db` + 기존 `requireAuth` 게이트 | 스키마 분리 개념 자체가 이 레포에 없음. |
| Sanity → Postgres 마이그레이션 | **`page_contents` → 블록 트리 마이그레이션** | 외부 CMS 가 아니라 자체 jsonb 오버레이가 원본. |
| gateway 라는 별도 렌더러 앱 | **million-stay-web 안의 `<BlockRenderer>`** + 사이트별 라우트 | 게이트웨이 앱 없음. 기존 하드코딩 섹션과 블록 렌더러가 **한 앱에서 공존**해야 함. |
| `cms_site_settings` 가 coming-soon/도메인까지 흡수 | 디자인 토큰·네비·SEO 기본값만. 도메인/로고는 `branding_settings` 유지 | 이미 운영 중인 런타임 브랜딩을 흔들지 않는다. |
| 로케일 = en/ko/ja/zh/zh-TW/th/vi | **사이트별 로케일 세트 고정**: www = en·ja·ko·th·vi·zh / homestay·파트너 = en·ja·ko·th·zh (vi 없음) / dev(Metheim) = 6종 | CLAUDE.md i18n 규약 + `WebsiteContentList` 의 실제 `WWW_LANGS`/`HS_LANGS`. |

---

## 3. 데이터 모델

신규 스키마 파일 `lib/db/src/schema/cms.ts`, 마이그레이션 **`0037_cms_block_builder.sql`** (다음 번호). 추가 전용(additive-only), [DB_MIGRATION_CONVENTION](../DB_MIGRATION_CONVENTION.md) 준수. 양 DB(Primary + Metheim Seoul) 적용.

### 3.1 `cms_sites` — 사이트 레지스트리 (하드코딩 상수 대체)
```
id            serial PK
site_key      text UNIQUE NOT NULL     -- 'www' | 'homestay' | 'dev'
label         text NOT NULL            -- '게스트 사이트', '홈스테이', 'Metheim'
host          text                     -- 미리보기/캐노니컬 URL 베이스
locales       text[] NOT NULL          -- ['en','ko','ja','th','vi','zh']
default_locale text NOT NULL DEFAULT 'en'
is_active     boolean NOT NULL DEFAULT true
sort_order    int
created_at, updated_at
```
> `WebsiteContentList.tsx` 의 `SITES`/`WWW_PAGES`/`HS_PAGES` 하드코딩을 DB 로 승격. 사이트 추가가 코드 변경 없이 가능해진다.

### 3.2 `cms_pages` — 페이지 1행
```
id             serial PK
site_key       text NOT NULL            -- FK → cms_sites.site_key
slug           text NOT NULL            -- '' 또는 'home' = 홈
legacy_page_key text                    -- 'homestay-home' 등, page_contents 연결용
title          text                     -- 내부 관리 라벨
template_key   text                     -- 어느 스타터 템플릿에서 생성됐는지
render_mode    text NOT NULL DEFAULT 'legacy'  -- 'legacy' | 'blocks'   ★공존 스위치
status         text NOT NULL DEFAULT 'Draft'   -- Draft | Published
is_home        boolean DEFAULT false
nav_hidden     boolean DEFAULT false
sort_order     int
seo_title, seo_description, seo_keywords, seo_image_url
published_at   timestamptz
deleted_at     timestamptz              -- 소프트 삭제 (보관함 뷰 페어링)
created_at, updated_at
UNIQUE (site_key, slug) WHERE deleted_at IS NULL
```
**`render_mode` 가 이 계획의 안전장치다.** `legacy` 면 게스트 앱은 지금처럼 하드코딩 섹션 + `usePageContent` 오버레이로 그리고, `blocks` 로 전환된 페이지만 `<BlockRenderer>` 가 그린다. 페이지 단위로 하나씩 넘길 수 있어 대규모 회귀 위험이 없다.

### 3.3 `cms_page_translations` — (페이지 × 로케일) 1행
```
id          serial PK
page_id     int NOT NULL → cms_pages.id ON DELETE CASCADE
locale      text NOT NULL
title       text
seo_title, seo_description, seo_keywords
body_json   jsonb NOT NULL DEFAULT '{"blocks":[]}'
status      text NOT NULL DEFAULT 'Draft'   -- 로케일별 발행
source      text                            -- 'human' | 'machine'  (AI 번역 추적)
translated_at timestamptz
created_at, updated_at
UNIQUE (page_id, locale)
```
> 첨부 스크린샷의 "You are editing **English** version" + 우측 언어 링크 목록과 정확히 같은 모델. `document_template_translations` 선례와 동일 구조.

### 3.4 `cms_block_templates` — UI Blocks 레지스트리
```
id                serial PK
type              text NOT NULL          -- 'hero-banner' | 'brands' | ...
site_key          text NULL              -- NULL = 전 사이트 공용 기본, 값 = 사이트 전용 프리셋
name              text NOT NULL
description       text
category          text                   -- Layout | Content | Media | Marketing | Form | Data
default_props     jsonb NOT NULL
preview_image_url text
is_active         boolean DEFAULT true
sort_order        int
deleted_at        timestamptz
created_at, updated_at
UNIQUE (type, site_key) WHERE deleted_at IS NULL
```
해석 규칙: `site_key` 일치 프리셋 우선 → 없으면 공용 기본. "UI Blocks 추가" 모달과 "블록 템플릿 관리" 화면이 이 테이블 하나를 본다.

### 3.5 `cms_site_settings` — 사이트별 설정 + 디자인 토큰
```
id             serial PK
site_key       text NOT NULL UNIQUE
design_tokens  jsonb   -- { palette:{primary,accent,ink,surface,muted}, fontPair, radiusScale, spacingScale, headingScale }
nav_header     jsonb   -- [{label, href|pageId, children:[]}]
nav_footer     jsonb
seo_defaults   jsonb   -- { titleSuffix, ogImage, robots }
analytics      jsonb
created_at, updated_at
```
**가드레일**: 블록 `style` 은 **토큰 역할명과 스케일 단계**만 참조한다. 원시 hex/px 를 블록에 저장하지 않는다 → 페이지·언어가 늘어도 시각적 통일성이 유지된다. 로고/파비콘/브랜드색 런타임 값은 기존 `branding_settings` 가 계속 SSOT.

### 3.6 블로그 확장 (기존 테이블 유지 + 추가)
```
blog_posts  + site_key text DEFAULT 'www'
            + render_mode text DEFAULT 'legacy'   -- 'legacy'(content HTML) | 'blocks'
            + body_json jsonb                     -- 블록 트리 (기본 로케일)
            + cover_image_alt text
cms_post_translations (신규)  -- 포스트 × 로케일 (cms_page_translations 와 동일 컬럼)
```
> `blog_posts.translations jsonb` 는 짧은 필드(title/excerpt)용으로 남기고, **본문 블록 트리는 행 단위 테이블**로 뺀다. 로케일 6종 × 블록 트리를 한 jsonb 에 넣으면 행이 비대해지고 부분 갱신 충돌이 난다.

### 3.7 미디어 (신규 인덱스 테이블)
```
media_assets (신규)
  id serial PK, public_id text UNIQUE, url text, folder text, format text,
  width int, height int, bytes int, alt_text text, tags text[],
  uploaded_by int, deleted_at, created_at, updated_at
media_folders (신규)
  id serial PK, parent_id int NULL, name text, path text UNIQUE, sort_order int, created_at, updated_at
```
Cloudinary 가 여전히 바이트의 원본이고, 이 테이블은 **검색·alt·태그·폴더 트리를 위한 색인**이다. 최초 동기화 스크립트로 기존 자산을 백필한다. 폴더 allowlist(민감 폴더 제외) 규칙은 그대로 유지.

---

## 4. 블록 모델 (SSOT 1개, 어드민 ⇄ API ⇄ 게스트 공유)

`lib/cms/` 신규 워크스페이스 패키지 `@workspace/cms-blocks`:

```ts
export type Block = {
  id: string;                       // 안정 uuid — DnD·번역 매핑 키
  type: BlockType;
  props: Record<string, unknown>;   // 콘텐츠 + 설정 (이미지는 {assetId,url,alt})
  style?: BlockStyle;               // 가드레일 — 토큰 역할 + 스케일 단계만
  children?: Block[];               // 컨테이너 블록 중첩
  hidden?: boolean;
};

export type BlockStyle = {
  bg?: "transparent" | "surface" | "primary" | "accent" | "ink";
  spacingTop?: 0 | 1 | 2 | 3 | 4;
  spacingBottom?: 0 | 1 | 2 | 3 | 4;
  align?: "left" | "center" | "right";
  width?: "contained" | "full";
};

export function normaliseBlocks(input: unknown): Block[];   // 미등록 type·잘못된 style 제거
export function collectTextProps(blocks: Block[]): TextRef[]; // AI 번역 대상 추출
export function applyTextProps(blocks: Block[], refs: TextRef[]): Block[];
export const BLOCK_REGISTRY: Record<BlockType, BlockSpec>;   // 필드 스키마 + i18n 대상 + 미디어 필드
```

`normaliseBlocks()` 가 스키마 드리프트에 대한 방어선이다. 어드민이 저장할 때, API 가 받을 때, 게스트가 그릴 때 **세 지점 모두 통과**시킨다.

### 4.1 블록 카탈로그 (첨부 사이트의 Botble 세트를 MillionStay 맥락으로)

| 분류 | 블록 |
|---|---|
| 레이아웃/히어로 | `section`(컨테이너), `hero-banner`, `hero-slider`, `simple-slider` |
| 콘텐츠 | `about-us`, `content-featured`, `feature-list`, `quote`, `steps`, `statistics`, `rich-text`, `custom-html` |
| 상품/서비스 | `services`, `service-categories`, `pricing`, `faqs`, `programs` |
| 신뢰 | `brands`, `testimonials`, `team` |
| 미디어 | `gallery`, `video`, `youtube` |
| 마케팅/폼 | `cta-banner`, `newsletter`, `contact-block`, `contact-form`, `enquiry-form`, `google-maps`, `blog-posts` |
| 데이터 연동 | `space-listings`(공실/임대 목록), `sale-listings`(분양·판매), `blog-posts` |

**데이터 연동 블록**은 props 에 필터 조건만 저장하고 실제 행은 기존 공개 API(`/api/public/*`)에서 라이브로 읽는다. 나머지는 props 에 콘텐츠를 직접 담는다.

---

## 5. 게스트 렌더러 (million-stay-web)

- `<BlockRenderer blocks={...} tokens={...} />` — `block.type → 컴포넌트` 레지스트리로 트리 순회, `style` 은 토큰 CSS 변수로 변환.
- 라우팅: 기존 하드코딩 라우트는 그대로. `render_mode='blocks'` 인 페이지만 `/:slug` 동적 라우트가 잡아 블록 트리로 렌더.
- 로케일: 현재 i18n 언어 → 해당 `cms_page_translations` 조회 → 없으면 `default_locale` 폴백(`[lang → ko → en]`, 기존 규약과 동일).
- dev-site 는 `DevLayout` 헤더/푸터 안에서 렌더 ([DEV_SITE_SHARED_SHELL](../DEV_SITE_SHARED_SHELL.md) 규칙 유지).
- 미리보기: `/preview/:pageId?locale=&token=` — 어드민 iframe 라이브 프리뷰용, 서명 토큰 필요, `noindex`.

---

## 6. 어드민 UX (property-admin)

### 6.1 좌측 네비 재편 — CMS 서브메뉴 통합
```
CMS
 ├ 페이지            /cms/pages
 ├ 블로그            /cms/blog          (탭: 글 | 카테고리)
 ├ 판매 매물          /cms/listings
 ├ 회사정보          /cms/company
 ├ 미디어 센터        /cms/media
 ├ 디자인 가이드      /cms/design
 └ UI 블록 관리      /cms/blocks
```
- 기존 `/content/*` 경로는 **리다이렉트로 보존**(북마크·i18n 키 깨짐 방지).
- 분양·판매 매물은 CMS 안의 독립 메뉴로 유지한다(`/cms/listings`).
- `/content/page-translations` 는 페이지 상세의 **언어 탭에 흡수**되고 메뉴에서 사라진다.

### 6.2 페이지 리스트 (`/cms/pages`) — 첨부 스크린샷 1 대응
공용 `DataTable` 사용. 컬럼: 체크박스 / ID / 이름(링크) / 사이트 / 템플릿 / 상태 / 언어 진행도 / 수정일 / 작업(편집·삭제).
벌크 액션(발행·비공개·소프트 삭제·복원), 필터(사이트·상태·템플릿), 검색, 페이지 크기, 보관함 뷰 — 전부 기존 DataTable 기능으로 커버.

### 6.3 페이지 상세 = 빌더 (`/cms/pages/:id`) — 첨부 스크린샷 2 대응
```
┌ "현재 English 버전을 편집 중입니다" 배너 ─────────────────┬ 발행 패널 ─────┐
│ 탭: 본문 | SEO | 이미지 | 설정 | 변경 이력                │ 저장 / 저장&닫기 │
│                                                          ├ 언어 ──────────┤
│ [+ UI 블록 추가]  [미리보기]                              │ 🇰🇷 한국어 ↗    │
│ ┌ 블록 캔버스 (DnD 정렬·중첩·숨김) ───────────────┐        │ 🇯🇵 日本語 ↗    │
│ │ ▤ Hero Banner        [편집][복제][숨김][삭제]  │        │ 🇹🇭 ไทย ↗      │
│ │ ▤ Brands                                      │        │ 🇻🇳 🇨🇳 …       │
│ │ ▤ About Us Information                        │        ├ 상태 ──────────┤
│ └───────────────────────────────────────────────┘        │ 발행됨 ▾        │
│                                                          ├ 템플릿 ────────┤
│                                                          ├ 대표 이미지 ───┤
└──────────────────────────────────────────────────────────┴────────────────┘
```
- **블록 편집 폼**은 `BLOCK_REGISTRY` 의 필드 스키마로 자동 생성(텍스트/리치텍스트/이미지/링크/반복 아이템).
- **스타일 패널**은 가드레일: 배경 = 토큰 역할 선택, 여백 = 0~4 단계, 정렬, 폭. 자유 hex/px 입력 없음.
- **이미지 필드**는 전부 `MediaPickerDialog` 경유(직접 URL 입력은 보조 수단).
- **AI 번역**: 기준 로케일 트리 복제 → 텍스트 props 만 추출·번역·재삽입 → `source='machine'` 로 표시, 사람이 검수하면 `human`.

### 6.4 블로그 (`/cms/blog`) — 탭 구조
- 탭 **글**: DataTable 리스트(제목·카테고리·상태·발행일·언어 진행도) + 상세는 **페이지 상세와 동일한 빌더**(블록 본문 + 이미지 + 다국어 + SEO).
- 탭 **카테고리**: 기존 `BlogCategories` 를 탭으로 이식.
- 기존 HTML 본문 글은 `render_mode='legacy'` 로 남고, 상세에서 "블록으로 변환" 버튼 → HTML 을 `rich-text` 블록 1개로 감싸 전환.

### 6.5 회사정보 (`/cms/company`) — 신규
공개 사이트에 노출되는 회사 정보를 CMS 문맥에서 편집. 데이터 SSOT 는 기존 `company_info` blob([company-info.ts](../../artifacts/api-server/src/routes/company-info.ts), Settings→Organisation)을 **그대로 공유**하고, CMS 화면은 (a) 공개 표기용 필드(상호·대표·사업자번호·주소·연락처·SNS·영업시간), (b) **로케일별 표기**, (c) 푸터/약관/개인정보 페이지에서의 사용처 미리보기를 제공한다. 저장은 같은 API 로 나간다 — 값이 두 벌 생기지 않는다.

### 6.6 미디어 센터 (`/cms/media`) — 확장
좌측 폴더 트리(중첩·이동) / 우측 그리드(무한 스크롤) / 상세 패널(alt·태그·크기·사용처) / 업로드 드롭존 / 검색·태그 필터. `MediaPickerDialog` 는 같은 컴포넌트를 다이얼로그 모드로 재사용.

### 6.7 디자인 가이드 (`/cms/design`) — 신규
사이트별 `design_tokens` 편집기: 큐레이션된 팔레트 역할(primary/accent/ink/surface/muted) + 폰트 페어 목록 + 라운드/여백/제목 스케일. 실시간 프리뷰(블록 샘플 렌더)와 "스타터 템플릿 적용". **Settings→Design(branding_settings)은 어드민/전역 브랜드**, 여기는 **공개 사이트 페이지 렌더 토큰** — 역할을 문서에 명시하고 화면 상단에 안내 배너로 구분한다.

---

## 7. 백엔드 API

신규 `artifacts/api-server/src/routes/cms.ts`, `/api/v1` 전역 `requireAuth` 뒤에 마운트. Zod 검증은 `@workspace/api-zod` 에 스키마 추가.

```
GET    /v1/cms/sites                          사이트 목록 + 로케일
GET    /v1/cms/pages?site=&status=&q=         리스트 (서버 페이징)
POST   /v1/cms/pages                          생성 (slug 서버 파생)
GET    /v1/cms/pages/:id                      상세 + 로케일별 상태 요약
PUT    /v1/cms/pages/:id                      메타/SEO/상태
DELETE /v1/cms/pages/:id                      소프트 삭제  (+ /restore, /purge)
POST   /v1/cms/pages/reorder                  정렬
GET    /v1/cms/pages/:id/translations/:locale 본문 로드
PUT    /v1/cms/pages/:id/translations/:locale 본문 저장 (normalise 후)
POST   /v1/cms/pages/:id/translate            AI 번역 (from=base, to=[locales])
POST   /v1/cms/pages/:id/publish               (locale 지정 가능)

GET/POST/PUT/DELETE  /v1/cms/blocks           블록 템플릿 CRUD
GET/PUT              /v1/cms/site-settings/:siteKey   토큰·네비·SEO 기본값
GET/POST/PUT/DELETE  /v1/cms/media...         (기존 /v1/media 확장: 폴더 트리·alt·태그)

공개(무인증):
GET /api/public/cms/pages/:siteKey/:slug?lang=   발행본만, 폴백 규칙 적용
GET /api/public/cms/nav/:siteKey?lang=
GET /api/public/cms/posts?site=&category=&lang=
```
- **N+1 금지**: 리스트에서 로케일 상태를 붙일 때 `inArray` 배치 조회 ([list_endpoint_n1_fix] 교훈).
- **캐시**: 공개 엔드포인트는 발행본만 캐시 가능, 미발행/폴백 응답은 `no-store`.

---

## 8. 데이터 마이그레이션 (`page_contents` → 블록)

`scripts/migrate-page-contents-to-blocks.mjs` — 기본 dry-run, `--apply` 필요, **멱등**.

1. `WebsiteContentList` 의 `SITES`/페이지 정의를 `cms_sites` + `cms_pages`(render_mode='legacy') 로 시드. `legacy_page_key` 채움.
2. 각 `page_contents(page_key, language)` 행 → 해당 페이지의 `cms_page_translations` 생성.
3. `PAGE_FIELDS` 의 필드 그룹(hero_* / feature_N_* / stat_* / cta_*)을 규칙 기반으로 블록으로 접는다:
   `hero_title+hero_subtitle+hero_cta_*` → `hero-banner` 1개, `feature_N_*` 반복 → `feature-list` 1개, `stat_*` → `statistics`, `cta_*` → `cta-banner`. 매핑되지 않은 잔여 키는 `rich-text` 블록에 보존(**손실 없음**이 원칙).
4. 검증 리포트 출력(페이지·로케일별 필드 수 → 블록 수, 미매핑 키 목록).
5. 사람이 눈으로 확인한 페이지만 `render_mode='blocks'` 로 승격. 롤백 = 컬럼 되돌리기 한 줄.

`page_contents` 는 **삭제하지 않는다.** 전 페이지 승격 + 안정화 확인 후 별도 회차에서 정리.

---

## 9. 단계별 진행 (각 단계 독립 배포·검증 가능)

| Phase | 내용 | 완료 판정 |
|---|---|---|
| **0. 기반** | `0037` 마이그레이션(양 DB) + `@workspace/cms-blocks` SSOT + 코어 블록 6종(section/hero-banner/rich-text/feature-list/gallery/cta-banner) + `normaliseBlocks` + 블록 템플릿 시드 | `pnpm typecheck` green, 시드 확인 |
| **1. 네비·리스트 재편** | CMS 서브메뉴 통합, `/cms/*` 라우트 + 기존 경로 리다이렉트, 페이지 리스트 DataTable, 블로그 탭(글/카테고리) 통합, i18n 키 6로케일 | 어드민에서 목록 CRUD 동작, 구 링크 정상 리다이렉트 |
| **2. 페이지 빌더** | 블록 캔버스(DnD·중첩·숨김·복제), 자동 생성 편집 폼, 가드레일 스타일 패널, 저장/발행, iframe 라이브 프리뷰 | 새 페이지를 블록만으로 만들어 프리뷰까지 |
| **3. 게스트 렌더러** | `<BlockRenderer>` + `/:slug` 동적 라우트 + `render_mode` 스위치 + dev-site/homestay 셸 연결 | 파일럿 1페이지(`dev-about` 권장)를 blocks 로 승격해 실서비스 확인 |
| **4. 다국어** | 언어 탭, 로케일별 발행, AI 전체 트리 번역 + `_source` 검수 표시 | 한 페이지를 6로케일 발행 |
| **5. 블로그 블록화** | 포스트 상세를 빌더로, `cms_post_translations`, HTML→블록 변환 버튼, 공개 블로그 렌더 | 신규 글 1건 블록 작성 + 다국어 발행 |
| **6. 미디어 센터** | `media_assets`/`media_folders` + 백필 + 폴더 트리 UI + alt/태그/검색 + 피커 연동 | 기존 자산 전부 색인, 피커에서 검색 동작 |
| **7. 회사정보 · 디자인 가이드** | CMS 회사정보 편집기(로케일별) + 디자인 토큰 편집기 + 스타터 템플릿 | 푸터/약관 페이지가 CMS 값으로 렌더 |
| **8. 전체 카탈로그 · 이관 완료** | 잔여 블록 ~20종, UI 블록 관리 화면, 전 페이지 blocks 승격, `WebsiteContentDetail`/`PageTranslations` 폐기 | 19개 page_key 전부 승격, 구 화면 제거 |

Phase 0–3 이 최소 실사용 묶음(= 블록으로 만든 페이지가 실제 사이트에 뜬다). 4 이후는 순서 조정 가능.

---

## 10. 레포 규약 준수 체크리스트

- **i18n**: 신규 어드민 라벨은 property-admin 지원 로케일 전부에 동시 추가. 게스트 신규 문구는 사이트별 로케일 세트 준수(www 6종 / homestay·파트너 5종, vi 제외).
- **크로스 프로덕트**: 블록·페이지는 Homestay/단기/장기 구분 없이 공용. 상품 종속 블록은 `context_type` props 로 분기, 별도 블록으로 포크하지 않는다.
- **마이그레이션**: `0037` 단일 번호, additive-only, `manual_*.sql` 신설 금지, **Primary + Metheim Seoul 양 DB 적용**.
- **문서 미리보기 규약**: CMS 가 생성/노출하는 PDF·리포트는 `DocumentPreviewDialog` 경유(직접 다운로드 링크 금지).
- **리스트 규약**: 공용 `DataTable` + 소프트 삭제 + 보관함 뷰 페어링 + 서버 페이징.
- **배포 위험**: 브랜치에서 `railway up` 으로 올린 테넌트 기능은 main 푸시 시 소멸 — 이 작업은 **반드시 main 머지 경로**로 배포한다. Metheim 프론트엔드는 현재 CI 가 main 푸시 시 자동 배포.
- **개인정보**: 미디어 폴더 allowlist(민감 폴더 제외) 유지. 블록에 사람 사진/신분 자료를 담는 경로를 새로 열지 않는다.

---

## 11. 착수 전 확인 사항 — 전부 확정됨 (2026-08-01)

1. **파일럿 페이지** → `dev-about` (Metheim 소개). 확정.
2. **블로그 사이트 귀속** → **`site_key` 로 분리.** 사이트별로 블로그를 독립 운영한다. 카테고리도 사이트에 귀속(`blog_categories.site_key`).
3. **분양·판매 매물** → **CMS 안에 독립 메뉴로 유지** (`/cms/listings`). 밖으로 빼지 않는다.
4. **디자인 토큰 확정자** → 승인자 없음. **어드민이 `site_key`(테넌트)별로 직접 관리**한다. `/cms/design` 이 사이트 선택기를 갖고 `cms_site_settings.design_tokens` 를 사이트마다 편집.
5. **커스텀 HTML 블록** → **스크립트 금지 + 태그 화이트리스트.** 서버 저장 시 sanitise, 클라이언트 렌더 시 한 번 더.
