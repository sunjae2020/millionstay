---
status: live
domain: 인프라
last_verified: 2026-09-15
---

# 솔루션 지원 (Solution Support)

관리자 → **도움말 → 솔루션 지원** (`/help/support`).

우리 직원이 **솔루션 공급사(Edubee)** 에 문의를 올리는 창구다. `/cs/tickets`
(고객 → 우리)의 거울상이며, 두 화면을 섞지 않는다.

## 동작 원리

문의는 **우리 DB에 먼저 저장하고, 공급사에는 그다음에 밀어 넣는다.** 공급사가
내려가 있어도 직원이 쓴 내용은 남아야 하기 때문이다. 전송 결과는 티켓마다
`push_status` 로 남고 목록·상세에 배지로 보인다.

| push_status | 의미 |
| ----------- | ---- |
| `sent`   | 공급사가 접수함 |
| `queued` | 아직 전송 전 |
| `failed` | 전송 실패 — 사유는 `push_error`, 상세에서 **다시 보내기** |

## 공급사 수신부 (연결 대상)

```
POST {SOLUTION_SUPPORT_URL}/platform-support/ingest
헤더  x-ingest-token: {SOLUTION_SUPPORT_TOKEN}
본문  { product, externalRef, subject, description, category, priority,
        language, links[], attachments[], requesterOrg, requesterName, requesterEmail }
```

공급사 인박스: <https://app.edubee.co/admin/superadmin/support>

핵심은 **`externalRef` = 우리 `ticket_ref`(`SS-2026-00001`)** 라는 점이다.
공급사는 `(product, external_ref)` 로 중복을 제거하므로, 같은 ref로 다시 밀면
새 티켓이 아니라 **기존 스레드에 메시지가 덧붙는다.** 후속 메시지 전송과 실패
재시도가 모두 이 성질에 기대고 있다.

## 환경변수 (api-server)

| 변수 | 기본값 | 설명 |
| ---- | ------ | ---- |
| `SOLUTION_SUPPORT_TOKEN` | (없음) | 공급사와 공유하는 비밀값. **없으면 전송 자체가 꺼진다** — 저장만 되고 화면에 경고 배너가 뜬다. |
| `SOLUTION_SUPPORT_URL` | `https://app.edubee.co/api` | 공급사 API 베이스 |
| `SOLUTION_SUPPORT_PRODUCT` | `millionstay` | 공급사 인박스에 찍히는 제품 키. `edubee`는 거부된다(공급사 자기 테넌트 키). Metheim 인스턴스는 `metheim`. |
| `SOLUTION_SUPPORT_ORG` | 설정 → 조직의 상호 | 공급사 인박스 Tenant 칸에 보일 이름 |
| `SUPPORT_ORGANIZE_MODEL` | `CHAT_MODEL` → Haiku | "AI로 정리" 버튼이 쓰는 모델 (`lib/ai/tasks.ts`의 `support_organize`) |

## 아직 없는 것 — 공급사 답신 수신

공급사 수신부는 **밀어넣기 전용**이다. 외부 제품이 스레드를 **읽을** 엔드포인트가
없어서, 공급사 답변이 자동으로 돌아오지 않는다. 그래서 상세 화면에 "솔루션 팀에서
받은 답변 기록하기" 체크박스를 두었다(직원이 메일로 받은 답을 옮겨 적으면
`sender_type='solution'` 로컬 메시지로 남는다). 공급사 쪽에 pull 채널이 생기면
이 체크박스는 걷어낸다.

## 구성 파일

| 층 | 경로 |
| -- | ---- |
| 스키마 | [lib/db/src/schema/solution_support.ts](../lib/db/src/schema/solution_support.ts) |
| 마이그레이션 | [lib/db/drizzle/0093_solution_support.sql](../lib/db/drizzle/0093_solution_support.sql) |
| 연합 클라이언트 | [artifacts/api-server/src/lib/support/solutionDesk.ts](../artifacts/api-server/src/lib/support/solutionDesk.ts) |
| API | [artifacts/api-server/src/routes/solution-support.ts](../artifacts/api-server/src/routes/solution-support.ts) |
| 화면 | [artifacts/property-admin/src/pages/help/SolutionSupport.tsx](../artifacts/property-admin/src/pages/help/SolutionSupport.tsx) |
