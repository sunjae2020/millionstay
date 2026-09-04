---
status: live
domain: 청구
last_verified: 2026-09-04
---

# 거래 원장 Phase 0–5 실행 계획

`0079` 로 들어간 거래 원장(`transactions`) + 계약 결제 일정(`payment_schedules`)은
"기록하고 회차에 붙이고 전기한다"는 뼈대만 있다. Edubee CRM 의 거래 모듈
(`accounting-transactions.ts` 3,739줄 / 41 엔드포인트)과 대조해 빠진 것을 채운다.

## 확정한 설계 결정

중간에 멈추지 않기 위해 판단이 갈릴 만한 지점을 미리 못 박는다.

1. **AR 상계.** 거래에 `invoice_id` 가 있고 그 청구서에 `invoice_issued:<id>` 분개가
   있으면, 전기는 매출(4000)이 아니라 **미수금(1100)을 상계**한다. 발행 분개가 없으면
   지금처럼 매출로 간다(`postInvoicePaid` 와 같은 규칙). 이게 없으면 매출이 두 번 잡힌다.
2. **AP 는 회차의 `direction` 으로 표현한다.** Edubee 처럼 한 행에 AR·AP 를 겹쳐 넣지
   않는다. `direction = 'ar' | 'ap'` 한 컬럼이면 부분납 로직(`paid_amount`)이 양쪽에
   그대로 재사용된다. 겹쳐 넣으면 컬럼이 두 배가 되고 부분납 계산이 갈라진다.
3. **영수증은 인보이스 파생 구조를 그대로 쓴다.** MillionStay 에는 `receipts` 테이블이
   없고 영수증은 `GET /v1/invoices/:id/receipt/pdf` 로 렌더된다. 거래 영수증도 같은
   `buildReceiptHtml` 을 태우고 `DocumentPreviewDialog` 로 연다(문서 규약).
   새 테이블을 만들지 않는다.
4. **페이지네이션은 서버가 한다.** `page`/`limit`(기본 100). 요약 타일은 **페이지가 아니라
   필터 전체**를 서버에서 집계한다 — 페이지 합계를 총액처럼 보여주면 오독을 부른다.
   DataTable 은 `defaultPageSize={limit}` 로 두어 이중 페이징을 막는다.
5. **승인 워크플로는 기존 역할을 쓴다.** 새 역할 체계를 만들지 않는다.
   `draft → submitted → posted → confirmed → paid` (+`rejected`/`void`).
   SuperAdmin/Admin 이 확정·전기·지급, Viewer 는 이미 requireAuth 에서 쓰기가 막힌다.
6. **AI 는 반드시 작업 레지스트리 경유.** `lib/ai/tasks.ts` 에 행을 추가하고
   `getAiClient("<task_id>")` 로만 호출한다(CLAUDE.md 규약).
7. **마이그레이션은 additive-only**, 번호는 푸시 직전 `origin/main` 기준으로 다시 확인한다
   (동시 세션이 번호를 채가는 일이 실제로 있었다).

## 단계

| Phase | 내용 | 마이그레이션 |
|---|---|---|
| 0 | AR/AP 상계 · 서버 페이지네이션 | 없음 |
| 1 | 회차 `direction`(AR/AP) · settle-lines · 미납/미지급 보드 | 0080 |
| 2 | 인보이스 결제 ↔ 거래 양방향 · 월세 청구서 → 회차 연결 | 없음 |
| 3 | 거래 영수증 발행 + 문서 미리보기 | 없음 |
| 4 | 전용 상세 페이지 + 승인 워크플로 | 0081 |
| 5 | 분할 배분 · 기준통화 스탬프 · AI 보조 | 0082 |

각 Phase 끝에서 **`pnpm typecheck` + 각 앱 build + 부팅 스모크**를 통과해야 다음으로 간다.
Phase 0–1, 2–3, 4–5 를 묶어 세 번에 나눠 배포한다(배포마다 CI + 프로덕션 헬스 확인).

## 하지 않는 것

멀티테넌트 SaaS 인프라(테넌트 스키마 분리, HQ/지점/팀 Class 스코프, 위임 권한, Xero 동기화)는
Edubee 코드의 큰 부분이지만 MillionStay 는 인스턴스 분리 방식이라 옮기지 않는다.
호주 GST 도 한국 부가세로 이미 다르게 처리돼 있다.
