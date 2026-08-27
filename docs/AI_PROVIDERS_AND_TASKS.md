---
status: live
domain: 인프라
last_verified: 2026-08-27
---

# AI 프로바이더 · 작업 레지스트리 · 사용량 미터

플랫폼의 AI 호출을 벤더 3사(Anthropic / Kimi / Gemini)에 작업 단위로 나눠 쓰기
위한 구조와, 그 결과를 계측하는 미터의 운영 문서.

관리 화면: **Settings → AI · 사용량** (`/settings/ai`).
키만 빠르게 바꾸려면 Settings → Integrations 의 🤖 카드에서도 된다.

## 왜 이 구조인가

기존에는 `ANTHROPIC_API_KEY` 하나에 `CHAT_MODEL` 상수 하나였다. 그래서
"CS 자동번역을 싼 모델로 내릴 수 있나"라는 질문에 답하려면 15개 호출 지점을
직접 grep해야 했고, "지난달 AI에 얼마 썼나"는 벤더 청구서 말고는 알 방법이 없었다.

지금은 세 가지가 코드에 명시돼 있다.

| 정본 | 파일 | 답하는 질문 |
| --- | --- | --- |
| 프로바이더 레지스트리 | `artifacts/api-server/src/lib/ai/providers.ts` | 어떤 벤더를, 어떤 키로, 무슨 기능까지 쓸 수 있나 |
| 작업 레지스트리 | `artifacts/api-server/src/lib/ai/tasks.ts` | 어떤 작업이 어떤 모델을 쓰고, 옮겨도 되나 |
| 사용량 미터 | `lib/db/src/schema/ai_usage_events.ts` | 얼마나, 얼마에, 얼마나 자주 |

모든 호출은 `lib/ai/client.ts`의 `getAiClient(taskId)` 한 곳을 통과한다. 호출부는
Anthropic SDK 모양(`messages.create` / `messages.stream`)을 그대로 유지하므로,
**작업을 다른 벤더로 옮기는 것은 env 변경이지 코드 변경이 아니다.**

## AI 작업 전체 목록

| 작업 ID | 하는 일 | 기본 모델 | env 레버 | 필요 기능 | 이전 |
| --- | --- | --- | --- | --- | --- |
| `chat` | 공개 챗 어시스턴트 | `claude-sonnet-4-6` | `CHAT_MODEL` | 툴 호출, 스트리밍 | 검증 후 |
| `cs_translate` | CS 메시지 자동번역 | `claude-haiku-4-5-20251001` | `CS_TRANSLATE_MODEL` | — | 가능 |
| `i18n_translate` | 어드민 UI 문자열 번역·검수 | `claude-sonnet-4-6` | `I18N_TRANSLATE_MODEL` | — | 가능 |
| `cms_translate` | CMS 페이지 블록 번역 | `claude-sonnet-4-6` | `CMS_TRANSLATE_MODEL` | — | 가능 |
| `content_translate` | 매물·공간 콘텐츠 번역 | `claude-sonnet-4-6` | `CONTENT_TRANSLATE_MODEL` | — | 가능 |
| `business_card_ocr` | 명함 OCR | `claude-sonnet-4-6` | `BUSINESS_CARD_OCR_MODEL` | 이미지 | 검증 후 |
| `id_document_ocr` | 신분증 판독(사진 추출) | `claude-sonnet-4-6` | `ID_DOC_OCR_MODEL` | 이미지 | **유지** |
| `document_intake` | 서류 인박스 판독·분류 | `claude-opus-5` | `DOCUMENT_INTAKE_MODEL` | 이미지, PDF | **유지** |
| `website_enrich` | 계정 웹사이트 자동채움 | `claude-sonnet-4-6` | `WEBSITE_ENRICH_MODEL` | — | 가능 |
| `match_rationale` | 홈스테이 매칭 사유 | `claude-sonnet-4-6` | `MATCH_RATIONALE_MODEL` | — | 가능 |

`CHAT_MODEL`은 자기 env가 비어 있는 작업들의 **폴백**이기도 하다(표의 `fallbackEnvKey`).
레지스트리 도입 전 동작을 그대로 보존하기 위한 것으로, `CHAT_MODEL` 하나를 바꾸면
`i18n`·`cms`·`content`·`ocr`·`enrich`·`rationale` 6개가 함께 움직인다는 뜻이다.
작업 하나만 옮기려면 **그 작업의 env 키**를 쓸 것.

> 스크립트 `scripts/translate-{db-lang,app-locale,page-contents}.mjs`는 서버를 거치지
> 않고 벤더 REST를 직접 호출하므로 레지스트리 밖이다. 미터에도 안 잡힌다. 옮기려면
> 각 스크립트의 `TRANSLATE_MODEL`을 따로 손봐야 한다.
> `scripts/translate-content.mjs`는 여전히 `gpt-4o`(OpenAI)를 가리키는 사문화된 경로다.

## 엔진 추가 (관리자가 직접)

빌트인 3사 외의 엔진은 **재배포 없이** 관리자가 등록한다.
Settings → AI · 사용량 → **엔진 추가**.

쓸 수 있는 곳:
- **두 번째 Claude 계정** — 와이어 `Anthropic 호환`, 베이스 URL 비움(Anthropic 기본값 사용)
- **별도 Gemini 키** — 와이어 `OpenAI 호환`, 베이스 URL `https://generativelanguage.googleapis.com/v1beta/openai`
- **그 밖의 엔진**(DeepSeek·Qwen·자체 호스팅 vLLM 등) — 두 와이어 포맷 중 맞는 쪽 + 베이스 URL

입력 항목:

| 항목 | 뜻 |
| --- | --- |
| 엔진 ID | 소문자·숫자·하이픈. 모델 참조의 접두사가 된다 (`claude-au/claude-opus-5`) |
| 와이어 포맷 | `Anthropic 호환` = Anthropic SDK 그대로. `OpenAI 호환` = 어댑터 경유 |
| 베이스 URL | OpenAI 호환은 **필수**(기본 엔드포인트가 없다). Anthropic 호환은 비우면 Anthropic 기본값 |
| 모델명 접두사 | 접두사로 시작하는 맨 모델명을 이 엔진으로 해석. 비워도 `엔진ID/모델`로 항상 지정 가능 |
| 지원 기능 | **실제로 확인한 것만** 켠다. 빌트인과 같은 게이트가 걸린다 |

저장 위치 — 로스터는 `integration_settings.AI_CUSTOM_PROVIDERS`(JSON 1행),
키와 베이스 URL은 id에서 파생된 **별도 설정**(`AI_KEY_<ID>`, `AI_BASE_URL_<ID>`)에 들어간다.
로스터 blob 안에 키가 섞이지 않게 하기 위함이다. 관리자가 env 이름을 타이핑할 일은 없다.

삭제는 **그 엔진을 쓰는 작업이 없을 때만** 된다(409로 거절). 지우면 키·베이스 URL도 함께 지운다.
빌트인 3사는 삭제할 수 없고, 빌트인 id를 커스텀으로 덮어쓸 수도 없다.

> 커스텀 엔진은 `pricing.ts` 단가표에 없으므로 미터에서 비용이 0으로 잡힌다.
> `AI_PRICE_OVERRIDES={"deepseek/deepseek-chat":{"input":0.27,"output":1.1}}`로 등록하면 계산된다.

## 프로바이더 기능 매트릭스

`supports`는 문서가 아니라 **게이트**다. 작업이 요구하는 기능이 없는 프로바이더에
배정하면 `getAiClient()`가 호출 전에 던지고, 어드민의 모델 변경도 400으로 거절된다.

빌트인 3사는 아래와 같다. 커스텀 엔진의 열은 등록할 때 관리자가 켠 값 그대로다.

| | Anthropic | Kimi (Moonshot) | Gemini |
| --- | --- | --- | --- |
| 와이어 포맷 | 네이티브 | Anthropic 호환 | OpenAI 호환(어댑터) |
| 이미지 | ✅ | ❌ 미검증 | ✅ |
| PDF `document` 블록 | ✅ | ❌ | ❌ |
| 툴 호출 | ✅ | ❌ 미검증 | ❌ |
| 스트리밍 | ✅ | ❌ 미검증 | ❌ |
| 프롬프트 캐시 | ✅ | ❌ | ❌ |

Kimi/Gemini 열은 **보수적으로 시작**한다. 확인되지 않은 기능은 전부 `false`인데,
거짓 음성은 env 한 줄 비용이고 거짓 양성은 서류 오분류 비용이기 때문이다.
실제 엔드포인트로 왕복 확인한 뒤 아래로 넓힌다(재배포 불필요):

```
AI_CAPABILITY_OVERRIDES={"kimi":{"tools":true,"streaming":true,"vision":true}}
```

Gemini의 PDF는 어댑터가 번역하지 않으므로 override 대상이 아니다 —
`document` 블록을 받으면 어댑터가 명시적으로 던진다.

## 사용량 미터

`ai_usage_events` 테이블에 API 호출 1건당 1행. 실패도 `ok = false`로 남긴다
(죽은 키와 "안 쓰는 중"을 구별해야 하므로).

- 프롬프트·응답 **본문은 저장하지 않는다.** 본문은 각 기능 테이블에 각자의 보존기간
  규칙 아래 이미 있고, 여기 복사하면 관리되지 않는 고객정보 사본이 하나 더 생긴다.
- `cost_usd`는 `lib/ai/pricing.ts` 단가표 기준 **추정치**다. 청구액 정본은 벤더 청구서.
  단가가 바뀌면 `AI_PRICE_OVERRIDES={"kimi/kimi-k2":{"input":0.6,"output":2.5}}`로 즉시 교정.
- 기록 실패는 삼킨다. 미터가 번역을 실패시키는 일은 없어야 한다.

조회: `GET /api/v1/ai/usage?days=30` → 총계 + 작업별/프로바이더별/모델별/일자별.

## AI 최적화 방안

미터가 붙기 전이라 아래 1·2번은 **구조적으로 확실한 것**이고, 3번 이후는 미터
한 달치를 본 뒤 판단할 것.

### 1. Sonnet 기본값 6개를 내린다 (가장 큰 즉효)

`chat`을 제외한 6개 작업이 `CHAT_MODEL` 폴백을 타고 Sonnet($3/$15 per Mtok)에
올라가 있다. 그중 번역 4종은 결과물을 사람이 검수한 뒤 출고하고, `enrich`·
`rationale`은 승인 팝업을 거친다. Haiku($1/$5)만으로도 입력 기준 1/3이고,
Kimi로 내리면 더 낮다.

권장 순서 — 한 번에 하나씩, 미터로 확인하며:

1. `CS_TRANSLATE_MODEL` (이미 Haiku, 물량 1위 → Kimi A/B 후보)
2. `I18N_TRANSLATE_MODEL`, `CONTENT_TRANSLATE_MODEL` (검수 있음)
3. `CMS_TRANSLATE_MODEL`, `WEBSITE_ENRICH_MODEL`, `MATCH_RATIONALE_MODEL` (물량 적음)

### 1-b. 신분증 판독은 비용 문제가 아니다

`id_document_ocr`은 여권·주민등록증을 읽어 증명사진을 잘라내고 **일반정보만** 옮긴다
(번호류는 프롬프트로 거부하고 출력에서 한 번 더 세척한다). 신분증을 어느 벤더에
보낼지는 단가가 아니라 **데이터 처리 약관**의 문제이므로, 약관이 확인된 곳에 둔다.

### 2. `document_intake`의 레버는 모델이 아니라 호출 횟수다

Opus는 단가 최상위(입력 $15)지만 여기서 내릴 수 없다 — 판독 결과가 파일의
**보존기간**을 정한다. 오분류 1건이 7년 계약서에 30일 파기 시계를 건다.
비용을 줄이려면 값을 낮추지 말고 **부르는 횟수**를 줄인다: 이미 분류된 파일 재판독
차단, 인박스 중복 업로드 병합, 파일명으로 확정 가능한 유형의 선분류.

### 3. 프롬프트 캐시는 벤더를 옮기면 사라진다

`cache_control: ephemeral`이 8개 파일 13곳에 있고, 지금은 Anthropic만 이를 인정한다.
정적 시스템 프롬프트가 긴 작업(번역 4종, intake, ocr)에서 캐시 히트는 입력 단가를
1/10로 떨어뜨린다. **Kimi 단가가 Sonnet보다 싸도, 캐시 히트율이 높은 작업에서는
실질 비용이 역전될 수 있다.** 미터의 `cache_read_tokens` 컬럼이 이걸 판단하는 근거다 —
옮기기 전에 그 작업의 캐시 읽기 비중을 먼저 볼 것.

### 4. `i18n_translate`의 4호출 구조

`routes/translations.ts`는 배치 번역/검수 2종 + 키 단위 plain 폴백 2종으로 4개
호출 지점을 갖는다. 폴백은 배치 JSON이 깨질 때 키마다 한 번씩 도는데, 그때마다
시스템 프롬프트가 통째로 다시 나간다. 캐시가 이를 완화하지만, 폴백 발생률이
미터에서 높게 나오면 배치 크기를 줄이는 편이 싸다.

## Kimi 전환 A/B 절차

1. **키 등록** — Settings → AI · 사용량 → Kimi 카드에 `KIMI_API_KEY`.
   리전 엔드포인트를 쓰면 고급 설정에서 `KIMI_BASE_URL`도.
2. **왕복 확인** — 같은 카드의 테스트 칸에 모델명을 넣고 실행. 키·모델명·쿼터 중
   무엇이 틀렸는지 벤더 메시지가 그대로 나온다.
3. **기능 확인 후 게이트 완화** — 툴 호출·비전·스트리밍을 실제로 확인했다면
   `AI_CAPABILITY_OVERRIDES`로 넓힌다. 확인 전에는 넓히지 말 것.
4. **작업 1개만 전환** — 작업 표에서 `cs_translate`의 모델을 눌러
   `kimi/<model>`로. 되돌리려면 값을 비우면 기본값으로 복귀한다.
5. **미터 판독** — 7일 뒤 작업별 비용·평균 지연·실패 건수를 Anthropic 기간과 비교.
   품질은 미터가 답하지 않는다. CS 티켓의 번역 재요청 빈도로 본다.
6. **확대 또는 롤백** — 위 1번의 권장 순서대로 하나씩.

`chat`은 툴 호출 4종 + 스트리밍을 쓰므로 3번을 통과하기 전까지 게이트에 막힌다.
`document_intake`는 PDF 게이트에 영구적으로 막힌다 — 의도된 동작이다.

## 새 엔진 vs 새 AI 호출

- **엔진을 늘리는 것**은 어드민 작업이다. 코드도 배포도 필요 없다(위 "엔진 추가").
- **AI 호출 지점을 늘리는 것**은 코드 작업이다. 아래를 따른다.

## 새 AI 호출을 추가할 때

1. `lib/ai/tasks.ts`에 작업 행을 먼저 추가한다 — `needs`(실제로 쓰는 기능),
   `volume`, `movable`, `rationale`.
2. 호출부는 `getAiClient("<task_id>")`를 쓴다. `model`은 넘기지 않는다.
3. env 키는 `ALLOWED_KEYS`에 손으로 넣지 않는다 — `routes/integrations.ts`가
   두 레지스트리에서 파생한다.
4. 어드민 표기: `ai_ops.task.<id>` 키를 **6개 로케일 전부**에 추가
   (en·ko·ja·th·vi·zh).

## 관련 파일

- `artifacts/api-server/src/lib/ai/` — providers / tasks / client / gemini / pricing / usage
- `artifacts/api-server/src/routes/ai-ops.ts` — `/v1/ai/*`
- `artifacts/property-admin/src/pages/settings/sub/AiOps.tsx` — 관리 화면
- `lib/db/drizzle/0070_ai_usage_events.sql` — 미터 테이블 (두 인스턴스 모두 적용됨)

## API

| 메서드 | 경로 | 하는 일 |
| --- | --- | --- |
| GET | `/v1/ai/overview` | 프로바이더 로스터 + 작업 레지스트리(해석된 모델·게이트 상태 포함) |
| PUT | `/v1/ai/tasks/:id` | 작업의 모델 지정. 빈 값이면 기본값 복귀. 게이트 위반은 400 |
| POST | `/v1/ai/providers` | 커스텀 엔진 등록/수정(upsert). `api_key`를 함께 보내면 키까지 저장 |
| DELETE | `/v1/ai/providers/:id` | 커스텀 엔진 + 키 삭제. 사용 중이면 409 |
| POST | `/v1/ai/providers/:id/test` | 지정 모델로 1토큰 왕복 |
| GET | `/v1/ai/usage?days=30` | 미터 집계 |

전부 어드민 인증(`requireAuth`) 뒤에 있고, 키 **값**은 어떤 응답에도 실리지 않는다(마스크만).
