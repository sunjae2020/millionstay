---
status: live
domain: 인프라
last_verified: 2026-09-05
---

# 시스템 로그 · 활동 분석

관리자 화면 **설정 → 시스템 로그**(`/settings/system-log`)와 **설정 → 활동 분석**
(`/settings/activity-analytics`)의 정본 설명이다. Edubee CRM 의 activity-logs /
activity-analytics 를 참고해 이 저장소의 규약(공용 DataTable, 서버 정렬·페이징,
지점·팀 조직도)에 맞춰 새로 지었다.

## 두 개의 원장

| 원장 | 무엇이 들어가나 | 어디서 쓰나 |
| --- | --- | --- |
| `system_log` | 생성·수정·삭제(CUD). 전·후 값(`old_value`/`new_value`)이 함께 남는다 | `utils/auditLog.ts` 의 `logAction()` — 이미 200곳 넘게 호출된다 |
| `user_activity_log` | 값이 바뀌지 않는 행위: 로그인·로그아웃·로그인 실패, 열람·다운로드, 내보내기, AI·OCR 호출, 서류 발행, 메일 발송, 대량 반입 | `middlewares/activityLogger.ts` + `routes/auth.ts` |

둘을 나눈 이유는 하나다. CUD 는 무엇이 어떻게 바뀌었는지가 중요하고, 나머지는
누가 무엇을 봤는지가 중요하다. 한 테이블에 섞으면 컬럼의 절반이 항상 비어 있다.
화면에서는 SQL `UNION ALL` 로 하나의 피드로 합쳐 보여 준다.

## "누가" 는 요청 컨텍스트가 채운다

`logAction()` 호출부는 214곳인데 절반이 `actorId` 를 넘기지 않아 `system_log` 의 행위자가
비어 있었다(2026-09-05 기준 MillionStay 309행 중 47행, Metheim 440행 중 203행만 보유).
호출부를 전부 고치는 대신 **요청 컨텍스트**(`lib/requestContext.ts`, `AsyncLocalStorage`)를
두고 인증 미들웨어가 행위자와 IP 를 한 번 심는다. `logAction` 은 인자가 없을 때 그 값을 쓴다.

- 호출부가 명시한 `actorId` / `actorEmail` / `ipAddress` 가 **항상 우선**한다.
- 관리자(`requireAuth`)만 `actor_id` 에 들어간다 — 파트너·게스트 id 는 다른 테이블이라
  섞으면 안 된다. 이들은 `actor_type` 이 `Partner` / `Guest`, 외부 API 키는 `ApiClient`,
  요청 밖(크론·스크립트)은 종전대로 `System` 이다.
- 앞으로 새로 생기는 호출부도 자동으로 채워진다. 사람이 매번 기억해야 하는 규칙은
  결국 지켜지지 않는다.

이미 쌓인 과거 행은 정보가 없어 채울 수 없다 — 적용 시점부터 이름이 남는다.

## 무엇을 남기고 무엇을 안 남기나

`activityLogger` 는 **규칙에 걸리는 경로만** 남긴다(`TRACKED` 배열). 모든 GET 을
남기면 하루 수십만 행이 쌓이고 정작 봐야 할 행위가 묻힌다. 본문(검색어·프롬프트)은
저장하지 않고 길이 + 해시만 남긴다.

적재는 응답이 끝난 뒤(`res.on("finish")`) 비동기로 이뤄진다. 로그 INSERT 가 실패해도
사용자 요청은 이미 성공으로 끝나 있다.

## API (`routes/system-logs.ts`)

전부 `/api/v1/system-logs` 아래이고 **Admin·SuperAdmin 전용**이다(`requireLogAdmin`).
Viewer 는 403 — 로그에는 다른 직원의 행적과 IP 가 들어 있다.

| 엔드포인트 | 하는 일 |
| --- | --- |
| `GET /` | 합산 피드. `?source=audit\|activity&action=&resource_type=&actor_id=&branch_id=&team_id=&q=&from=&to=` + 공용 `limit/offset/sort/dir`. 총 건수는 `X-Total-Count` |
| `GET /summary` | 일자별·액션별·사용자별·대상별 집계 |
| `GET /work-hours` | 사용자·일자별 첫 활동 ~ 마지막 활동, 간격(시간), 건수 |
| `GET /by-team` · `GET /by-branch` | 팀·지점별 일자 집계 |
| `GET /facets` | 필터 드롭다운 값(사용자·지점·팀·액션·대상) |

정렬 키는 화이트리스트다: `logged_at`(기본), `action`, `actor_email`,
`resource_type`, `source`. 피드의 시각은 `logged_at` 으로 내보낸다 — 행에
`created_at` 이 보이면 공용 DataTable 이 "생성일" 감사 컬럼을 맨 뒤에 자동으로
덧붙여 같은 값이 두 번 나오기 때문이다.

CSV 내보내기는 공용 DataTable 이 서버 전량 조회로 처리하므로 전용 엔드포인트가 없다.

## "근무시간"이 아니다

활동 분석의 **활동 구간**은 첫 기록과 마지막 기록의 간격이다. 근태 기록이 아니고,
전화·현장 업무처럼 시스템에 흔적이 남지 않는 일은 잡히지 않는다. 화면 하단에도
같은 문구를 띄워 둔다 — 평가 지표로 오해되면 로그를 남기지 않으려는 행동을 부른다.

## 배포 시 할 일

마이그레이션 `lib/db/drizzle/0085_user_activity_log.sql` 은 **추가 전용**
(`CREATE TABLE IF NOT EXISTS` + 인덱스)이며, 적용 전에는 활동 로그 쪽이 비어 있어
피드에 CUD 이력만 나온다. 각 인스턴스(MillionStay · Metheim) DB 에 따로 적용한다.
