---
status: live
domain: 디자인
last_verified: 2026-09-08
---

# SEO · GEO 최적화

공개 콘텐츠를 **검색엔진(SEO)** 과 **생성형 AI 엔진(GEO)** 양쪽에 맞추는 레이어와,
그것을 운영하는 관리자 화면(**CMS → SEO · GEO**, `/cms/seo`)에 대한 문서입니다.

GEO는 Generative Engine Optimization, 곧 ChatGPT·Perplexity·Gemini·Google AI
Overviews 같은 답변 엔진이 우리 페이지를 **인용하게 만드는 일**입니다. 검색 순위와는
목표가 다릅니다. 순위는 링크를 걸게 하는 것이고, 인용은 문장을 그대로 가져다 쓰게 하는
것입니다. 그래서 배점도 GEO 쪽이 가장 무겁습니다.

## 왜 이 구조인가

세 가지 원칙이 설계를 지배합니다.

1. **채점은 순수 함수다.** `lib/seo/scoring.ts`는 DB도 네트워크도 건드리지 않습니다.
   라이브 크롤이 아니라 우리가 **저장해 둔 메타데이터**를 채점합니다. 직원이 답을 알고
   싶은 질문은 "이 페이지가 필요한 걸 갖췄나"이고, 그건 우리 데이터만으로 판단됩니다.
2. **구조물은 AI가 만들지 않는다.** JSON-LD, `robots.txt`, `llms.txt`, `sitemap.xml`,
   `<head>`는 전부 `lib/seo/builders.ts`의 결정적 함수가 조립합니다. 깨진 JSON-LD는
   없느니만 못하고, 언어 모델은 형식을 보장하지 못합니다.
3. **AI는 산문만, 그것도 초안만.** 메타 설명·AI 인용용 요약·FAQ 세 가지뿐이며,
   `seo_audits.generated_json`에 담겨 사람이 **승인**을 누르기 전까지 사이트에 나가지
   않습니다. 호출이 실패해도 예외를 던지지 않고 빈 결과를 돌려줍니다.

여기에 하나 더: **감사는 라이브 SEO를 바꾸지 않습니다.** 점검은 측정이고, 측정이 대상을
바꾸면 안 됩니다. 점검 한 번은 새 버전 한 줄을 남길 뿐입니다.

## 점수 체계 (100점, 8개 항목)

| 항목 | 만점 | 무엇을 보나 |
| --- | --- | --- |
| meta | 20 | 제목·설명·canonical·OG 제목/설명/이미지 |
| schema | 16 | JSON-LD 유무, FAQ 스키마 |
| **geo** | **22** | 자기완결적 요약, 질문·답변 세 쌍 이상 |
| content | 14 | 본문 분량, 소제목, 목록 |
| signals | 8 | 발행 여부, 90일 내 수정, 다국어 |
| robots | 8 | 색인 허용, AI 크롤러 명시 |
| llms | 6 | 큐레이트된 `llms.txt` |
| brand | 6 | Organization 스키마, 제목의 브랜드명 |

미충족 항목은 `{code, label, severity, category}` 형태의 **갭**으로 남고 심각도 순으로
정렬됩니다. 화면의 갭 문구는 `seo.gap_<code>` 번역 키를 씁니다.

### 시스템이 이미 해주는 일에는 감점하지 않는다

세 가지는 저장된 값이 없어도 렌더러가 알아서 채웁니다. 그것을 "없음"으로 감점하면
고칠 수 없는 항목으로 점수만 깎입니다.

| 항목 | 규칙 |
| --- | --- |
| 대표 주소 | 직접 지정 2점, 사이트 주소로 자동 생성 1점, 사이트 주소조차 없으면 0점 |
| 구조화 데이터 | 직접 작성 8점, 자동 생성 4점 |
| 공유 이미지 | 지정한 이미지가 없으면 **본문 첫 이미지**를 씁니다(게스트 웹이 하던 것과 동일) |

**발행 여부는 화면에 실제로 나가는 기준으로 판단합니다.** `blocks` 페이지는 번역이
발행돼야 라이브이지만, `legacy` 페이지는 옛 콘텐츠로 그려지므로 번역 행의 상태와
무관합니다. 이걸 구분하지 않아 메트하임 11개 페이지가 목록에는 "Published"로 보이면서
"발행되지 않음" 감점을 받고 있었습니다.

**브랜드명은 표기가 여럿입니다.** 사이트 이름은 `Metheim`인데 한국어 제목은
`메트하임`이라고 씁니다. 별칭을 설정에 넣어 두면 어느 쪽이든 인정합니다.

**필드로 그려지는 페이지는 그 필드를 구조로 셉니다.** 매물 세대에는 소제목이나
목록을 넣을 본문 필드가 아예 없습니다. 그런데 상세 화면은 제목과 사양 목록(면적·방
수·가격)을 컬럼에서 만들어 보여 줍니다. 산문만 세면 가질 수 없는 형태를 못 갖췄다고
깎게 되므로, 그런 엔티티는 `structuredHeadings`/`structuredLists`로 실제 화면 구조를
전달합니다.

빈 초안은 9점에서 출발합니다(자동 생성 스키마 4점 + 색인 허용 5점). 이 수치는
[artifacts/api-server/tests/seo.test.ts](../artifacts/api-server/tests/seo.test.ts)가
회귀로 고정하고 있습니다. 배점을 바꾸면 그 테스트가 먼저 깨집니다.

### 길이를 재는 방법 — 영어 기준을 그대로 쓰면 한국어가 손해를 본다

배점의 길이 기준(제목 30~60, 설명 120~165, 본문 600단어)은 전부 **영어 글쓰기
관행**에서 왔습니다. 이 숫자를 한국어에 그대로 들이대면 잘 쓴 페이지가 전부
"너무 짧음"으로 찍힙니다. 실제로 첫 배포 직후 메트하임 18개 페이지가 **전부**
제목·설명 길이에서 실패했습니다. 두 가지로 갈라서 해결했습니다.

**제목·설명은 표시 폭(display width)으로 잽니다.** 검색 결과는 글자 수가 아니라
픽셀 폭으로 잘립니다. 한글·한자 한 글자는 라틴 두 글자만큼의 자리를 차지하므로
한글 26자 제목은 폭 52 — 제목이 가져야 할 딱 그 길이입니다. 글자 수로 재면 30자
미만이라 미달로 찍혔습니다.

**본문·요약 분량은 영어 단어 환산으로 잽니다.** 한국어 어절은 명사에 조사가 붙어
영어 한 단어보다 많은 것을 말합니다. 그래서 어절은 1.5, 한자·가나는 글자당 0.6을
곱해 "같은 내용을 영어로 쓰면 몇 단어인가"로 환산합니다. 상수는
`scoring.ts` 상단에 있고 테스트가 고정합니다.

**길이 미달과 초과는 심각도가 다릅니다.** 초과는 검색 결과에서 실제로 잘려 나가므로
보통, 미달은 주어진 자리를 덜 쓴 것이라 낮음입니다.

## 데이터 모델

마이그레이션 [0090_seo_geo_optimisation.sql](../lib/db/drizzle/0090_seo_geo_optimisation.sql)
— 전부 `IF NOT EXISTS`, 추가만 하고 기존 값은 건드리지 않습니다.

**기본 행**(`cms_pages`, `blog_posts`, `sale_listings`): `canonical_url`,
`robots_directives`, `json_ld`, `geo_answer_summary`, `geo_faq`.

**로케일 행**(`cms_page_translations`, `cms_post_translations`): `og_title`,
`og_description`, `seo_image_url`, `geo_answer_summary`, `json_ld`.

읽기 규칙은 CMS의 다른 필드와 같습니다 — **번역값 ?? 기본값**.

**`seo_audits`** — `(site_key, entity_type, entity_id, locale, version)` 유니크.
버전은 엔티티×로케일 단위로 1씩 올라갑니다. `drift_json`은 직전 버전 대비
`{scoreDelta, added, resolved}`입니다.

**사이트 기본값**은 `cms_site_settings.seo_defaults`(0037에서 이미 있던 컬럼, 이 기능이
처음으로 읽습니다)에 들어갑니다.

```jsonc
{
  "organizationSchema": { "name": "…", "url": "…", "address": { … } },
  "robotsExtra": "Disallow: /admin",
  "llmsTxtIntro": "여수 원도심 269세대 도시형 주거…",
  "defaultCanonicalBase": "https://metheim-web.vercel.app",
  "crawlerFilesDisabled": false
}
```

관리자 화면은 **설정 → SEO 기본값**(`/settings/seo-defaults`)입니다. 회사 스키마는
raw JSON-LD 대신 일반 입력란으로 받습니다 — 직원이 schema.org를 손으로 쓸 이유가
없고, 붙여넣은 덩어리의 오타는 크롤러가 걸릴 때까지 보이지 않습니다. 폼에 없는
키는 저장할 때 보존되므로 다른 경로로 넣은 값이 조용히 사라지지 않습니다.
"회사정보에서 가져오기"는 조직 설정(회사 정보 정본)에서 빈 칸만 채웁니다.

`llmsTxtIntro`가 비어 있으면 llms 6점은 들어오지 않습니다. 의도한 것입니다. 전체 페이지
목록은 `sitemap.xml`이 이미 하는 일이고, `llms.txt`의 값어치는 **사람이 골랐다는 데**
있습니다.

## 감사 단위와 사이트 축

대시보드 한 행 = **엔티티 하나 @ 사이트 기본 로케일**입니다. 페이지×언어로 쪼개면
행이 여섯 배가 되고, 정작 답해야 할 질문("이 페이지 상태가 어떤가")은 흐려집니다.

엔티티 종류는 셋입니다.

| 종류 | 테이블 | 공개 경로 | 사이트 소속 |
| --- | --- | --- | --- |
| `page` | `cms_pages` | `/{slug}` | `site_key` |
| `blog` | `blog_posts` | `/blog/{slug}` | `site_key` |
| `listing` | `sale_listings` | `/buy/{id}` | 인스턴스의 **주 사이트** |

`sale_listings`에는 `site_key` 컬럼이 없습니다. 컬럼을 새로 만들어 기본값을 찍으면 어느
한 인스턴스에서는 반드시 틀린 값이 들어갑니다(MillionStay는 `www`, Metheim은 `dev`).
그래서 **활성 사이트 중 `sort_order`가 가장 낮은 사이트**를 주 사이트로 보고 매물을
거기에 붙입니다. 두 인스턴스 모두에서 맞고, 마이그레이션도 데이터 판단도 필요 없습니다.

## 크롤러가 실제로 받는 것

게스트 웹은 자바스크립트를 실행해야 화면이 그려지는 SPA입니다. 구글은 어느 정도
실행해 주지만 **AI 크롤러 대부분은 실행하지 않습니다.** 그래서 네 가지를 API가 직접
서빙합니다.

| 경로 | 내용 |
| --- | --- |
| `/robots.txt` | AI 크롤러 27종을 이름으로 허용 + `User-agent: *` + Sitemap 줄 |
| `/llms.txt` | 사람이 고른 마크다운 색인. 각 항목의 설명은 그 페이지의 GEO 요약 |
| `/sitemap.xml` | 발행된 페이지·글·매물 + `xhtml:link` 언어 대체 링크 |
| `/seo/head` | 크롤러 UA일 때 제목·OG·JSON-LD·요약·FAQ가 담긴 무자바스크립트 HTML |
| `/seo/meta` | 같은 내용을 JSON으로. 빌드 단계가 정적 HTML에 구워 넣을 때 씁니다 |
| `/seo/routes` | 이 사이트가 발행하는 경로 목록(slug → 공개 주소 변환 적용) |

### 정적 페이지는 왜 빌드 때 굽는가

Vercel은 **리라이트보다 파일시스템을 먼저** 확인합니다. 그래서 프리렌더로
`index.html`이 생긴 경로(CMS 페이지 12개)는 크롤러 UA 리라이트가 절대 잡지
못합니다. 파일이 없는 경로(`/buy/5`, `/blog/…`)에서만 리라이트가 이깁니다.

정적 경로는 대신 [scripts/prerender-share-meta.mjs](../scripts/prerender-share-meta.mjs)가
빌드 후 `/seo/meta`를 불러 canonical·hreflang·JSON-LD를 문서에 직접 넣습니다.
사실 이쪽이 더 낫습니다. 정적이라 캐시되고, UA 목록에 없는 크롤러에게도 통합니다.
인용 대상 문장(GEO 요약)은 JSON-LD의 `abstract`와 FAQPage 항목으로 들어갑니다 —
본문에 심으면 사람에게 잠깐 보였다 사라지는 깜빡임이 생깁니다.

주의할 점 셋:

- **호스트는 쿼리 파라미터로 넘깁니다.** CDN을 한 번 거치면 원래 Host가 남는다는 보장이
  없습니다. 리라이트가 `?site=<site_key>`를 박아 보냅니다.
- **`X-Robots-Tag`를 명시적으로 덮어씁니다.** 앱은 모든 응답에 `noindex, nofollow`를
  기본으로 답니다(관리자 화면 보호). 그대로 두면 크롤러에게 주는 파일이 스스로
  "무시하라"고 말하게 됩니다. 이 네 경로는 `all`로 덮어씁니다.
- **정적 파일이 리라이트를 이깁니다.** 그래서
  `artifacts/million-stay-web/public/robots.txt`를 삭제했습니다. 테넌트마다 도메인이
  다르므로 Sitemap 줄이 정적 파일에 박혀 있으면 어느 한쪽은 틀립니다.

### 배선 위치가 두 곳인 이유

- MillionStay 게스트 웹: [artifacts/million-stay-web/vercel.json](../artifacts/million-stay-web/vercel.json) — Vercel Git 연동이 이 파일을 씁니다.
- Metheim 게스트 웹: [scripts/redeploy-tenant-frontends.sh](../scripts/redeploy-tenant-frontends.sh) — 프리빌트 업로드라 리포의 `vercel.json`을 **쓰지 않고** 스크립트가 즉석에서 만듭니다.

둘 중 하나만 고치면 한쪽 테넌트에서 조용히 동작하지 않습니다.

### slug와 공개 주소는 같지 않다

메트하임 사이트는 페르소나 페이지를 대상 이름으로 서비스합니다(`/for-resident`).
그 페이지를 채우는 CMS 페이지의 slug는 `resident`입니다. `stayplan`은 `/stay-plan`,
`manage`는 `/management`입니다. slug를 그대로 URL로 publish하면 사이트맵에 not-found
화면이 뜨는 주소가 실립니다 — 사이트맵이 없는 것보다 나쁩니다.

변환표의 정본은 [lib/seo/publicRoutes.ts](../artifacts/api-server/src/lib/seo/publicRoutes.ts)
하나입니다. 프리렌더 스크립트는 자기 사본을 두지 않고 `/seo/routes`로 받아 갑니다
(API 호출이 실패하면 스크립트 안의 폴백 맵을 씁니다). 이 표가 맞춰야 할 대상은
게스트 웹의 `DevRouter.tsx`입니다.

## 관리자 화면

**CMS → SEO · GEO** (`/cms/seo`). 위쪽에 사이트 전환기, 평균 점수, 전체 점검 버튼이
있고, 그 아래 사이트 전체에 걸리는 항목(AI 크롤러 규칙·llms.txt 안내문·회사 스키마·사이트
주소)이 배지로 붙습니다. 이 넷은 개별 페이지가 아무리 잘 써도 사이트 전체 점수의 천장을
낮추므로 표 밖 위쪽에 둡니다.

표는 **나쁜 것부터** 정렬됩니다: 한 번도 점검 안 한 것 → 낮은 점수 → 중요 갭이 많은 것.
보고서가 아니라 작업 대기열입니다.

행의 새로고침 아이콘은 점검 + AI 초안을, 상단의 전체 점검은 **점검만** 합니다. 사이트
전체에 초안을 만드는 건 실제 비용이라 명시적으로 요청해야 합니다.

자세히 보기에는 항목별 점수 막대, 승인 대기 중인 AI 초안, 갭 목록, 버전 이력이 있습니다.

## 자동 점검

야간 크론 `runSeoGeoAudit` — 매일 02:40 UTC. **점검만** 합니다. AI 초안도, 승인도
없습니다. 매일 밤 모델 비용을 쓰거나 발행된 문구를 조용히 고쳐 쓰는 잡을 나중에 발견하는
것은 좋은 일이 아닙니다. 이 잡의 산출물은 엔티티별 점수 한 줄이고, 그 덕분에 다음 날
아침 drift 값이 의미를 갖습니다.

## API

관리자(스태프 인증 필요):

| 메서드 | 경로 | 하는 일 |
| --- | --- | --- |
| GET | `/api/v1/seo/overview?site=` | 엔티티별 최신 감사 1행씩 |
| GET | `/api/v1/seo/:type/:id/history?site=` | 한 엔티티의 버전 이력 |
| POST | `/api/v1/seo/:type/:id/refresh` | 점검(+옵션 `generate`) |
| POST | `/api/v1/seo/refresh-all` | 전체 점검, 실패는 건별 리포트 |
| POST | `/api/v1/seo/:type/:id/apply` | 승인한 초안을 기본 행에 기록 후 재점검 |

## AI 작업 등록

`lib/ai/tasks.ts`의 `seo_geo_draft` 행을 거칩니다. 기본 모델은 haiku 계열이고 환경변수
`SEO_GEO_DRAFT_MODEL`로 갈아끼울 수 있습니다. 설정·사용량은 관리자 **설정 → AI · 사용량**에
자동으로 나타납니다. 자세한 규칙은 [AI_PROVIDERS_AND_TASKS.md](AI_PROVIDERS_AND_TASKS.md).

## 테스트

```bash
pnpm --filter @workspace/api-server test
```

순수 함수(채점·drift·빌더·경로 변환·길이 계산) 31개 케이스. 빈 초안 9점, 완비 100점, 8개 항목 합 100,
GEO가 최대 가중, robots.txt의 크롤러 27종 전부 포함 등을 회귀로 잠급니다.

## 콘텐츠를 채운 뒤 정적 페이지는 다시 배포해야 한다

GEO 요약과 FAQ를 DB에 넣어도 **프리렌더된 정적 페이지는 바뀌지 않습니다.** 그 페이지의
JSON-LD는 빌드 시점에 구워지기 때문입니다. 파일이 없는 경로(`/buy/5`, `/blog/…`)는
요청 때마다 API가 그리므로 즉시 반영됩니다.

콘텐츠를 채웠으면 게스트 웹을 다시 배포하세요. main 에 푸시하면 CI 가 해 주고,
급하면 격리된 워크트리에서 직접 돌립니다.

```bash
TENANT=metheim BUILD_ONLY=1 scripts/redeploy-tenant-frontends.sh web   # 먼저 확인
TENANT=metheim scripts/redeploy-tenant-frontends.sh web                # 배포
```

## 메트하임 초기 데이터 (2026-09-08)

사이트 기본값과 18개 엔티티(페이지 12·매물 6)의 GEO 요약·FAQ 69쌍을 채웠습니다.
문안은 각 페이지가 이미 담고 있던 사실만으로 작성했고, 금액·면적·주소·시행일은
DB 값을 그대로 옮겼습니다. 공개용 한글이라 `humanize-korean` 윤문을 거쳤으며
(세 묶음 모두 등급 A), 반영 전에 헤더 구조와 숫자 일치를 기계적으로 대조했습니다.

측정된 평균 점수:

| 시점 | 평균 |
| --- | --- |
| 채점 기준 수정 전 | 35 |
| 기준 수정 후 | 40 |
| 사이트 기본값까지 | 52 |
| GEO 문안까지 | 82 |
| 메타데이터 2차(대표 주소·구조화 데이터·공유 이미지·제목/설명 길이) | **페이지 93.7 · 매물 94.0** |

## 남은 일

- `sale_listings`와 `spaces`에는 slug가 없어 매물 주소가 `/buy/123` 형태입니다. 사람이
  읽는 slug를 붙이면 SEO에 유리하지만 컬럼 추가와 백필이 필요합니다.
- `spaces`(숙소 상세)는 아직 감사 대상이 아닙니다. 사이트 소속을 어떻게 정할지가
  매물과 같은 문제입니다.
- `cms_site_settings.analytics`는 여전히 아무도 읽지 않습니다. 검색 콘솔 인증 코드를
  둘 자리로 비어 있습니다.
- 입주자 안내(`/for-resident`) 페이지는 본문 블록이 하나도 없습니다. 요약은 사이트의
  다른 페이지가 밝힌 사실만으로 썼으니, 본문 자체를 채우는 편이 좋습니다.
- 페이지 대부분이 본문 250단어 미만입니다. 점수보다 인용 가능성 문제입니다 —
  답변 엔진은 인용할 문장이 있는 페이지를 고릅니다.
