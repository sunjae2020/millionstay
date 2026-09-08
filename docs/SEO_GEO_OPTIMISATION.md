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

빈 초안은 9점에서 출발합니다(자동 생성 스키마 4점 + 색인 허용 5점). 이 수치는
[artifacts/api-server/tests/seo.test.ts](../artifacts/api-server/tests/seo.test.ts)가
회귀로 고정하고 있습니다. 배점을 바꾸면 그 테스트가 먼저 깨집니다.

### 단어 수를 세는 방법

중국어·일본어는 띄어쓰기가 없어 공백으로 자르면 문단 하나가 한 단어가 됩니다. 그래서
한자·가나는 **글자 수를 세어 절반**으로 환산하고, 띄어쓰기를 쓰는 한글과 라틴 문자는
어절·단어로 셉니다.

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

순수 함수(채점·drift·빌더) 22개 케이스. 빈 초안 9점, 완비 100점, 8개 항목 합 100,
GEO가 최대 가중, robots.txt의 크롤러 27종 전부 포함 등을 회귀로 잠급니다.

## 남은 일

- `sale_listings`와 `spaces`에는 slug가 없어 매물 주소가 `/buy/123` 형태입니다. 사람이
  읽는 slug를 붙이면 SEO에 유리하지만 컬럼 추가와 백필이 필요합니다.
- `spaces`(숙소 상세)는 아직 감사 대상이 아닙니다. 사이트 소속을 어떻게 정할지가
  매물과 같은 문제입니다.
- `cms_site_settings.analytics`는 여전히 아무도 읽지 않습니다. 검색 콘솔 인증 코드를
  둘 자리로 비어 있습니다.
