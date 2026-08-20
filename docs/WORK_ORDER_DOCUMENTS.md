---
status: live
domain: 문서발행
last_verified: 2026-08-20
---

# 작업지시서 · 하자 청구 명세서

작업지시(work_orders)에서 나오는 두 가지 문서. 둘 다 공용 미리보기 모달
(`DocumentPreviewDialog`)로 열리고, 새 탭 · 인쇄 · 다운로드를 그 안에서 한다 —
받는 사람이 정해진 문서가 아니라 메일 버튼(`onEmail`)은 달지 않는다.

| | 문서 | 범위 | 화면 |
|---|---|---|---|
| **A** | 작업지시서 | 작업지시 1건 | 작업지시 상세 → **작업지시서** |
| **B** | 임대청소 · 하자 청구 명세서 | 기간 안의 여러 건 | 작업지시 목록 → **청구 명세서** |

## A. 작업지시서

`GET /api/v1/work-orders/:id/document.pdf?lang=ko&format=html`

건물 · 호수 · 타입 · 층, 작업분류/상태, 접수·예정·완료일, 파트너 · 담당자 ·
입회자 · 출입 방법, 작업내용(작업명 · 내역 · 비고), 비용(작업비용 · 원천징수 ·
청구비용), 요청(before)/완료(after) 사진, 그리고 요청자 · 작업자 · 확인자 서명란.

파일명은 발행 문서 규칙을 따른다 — `resolveDocFileName({ kind: "work_order" })`
→ `1901-작업지시서_20260814`.

## B. 임대청소 · 하자 청구 명세서

```
GET  /api/v1/work-orders/billing-statement          # 건수·합계 (다이얼로그 요약용)
GET  /api/v1/work-orders/billing-statement.pdf      # 명세서 + 호수별 증빙 사진
POST /api/v1/work-orders/billing-statement/invoice  # 같은 조건으로 청구서 발행
```

필터: `from` `to` `property_id` `category`(콤마 다건) `status`
`withholding_pct` `photos_per_unit`(0=사진 없음, 최대 12) `bill_to`/`account_id`
`lang` `format=html`.

`category`는 분류표(`@workspace/api-zod`의 `WORK_ORDER_CATEGORIES`)의 canonical
값을 넘긴다. 서버가 `workOrderCategoryAliases()`로 옛 표기(`하자보수`)까지 함께
잡으므로 백필 전 데이터도 빠지지 않는다.

손으로 쓰던 "임대청소 & 하자 청구서" 시트가 원본이라 컬럼 순서를 바꾸지 않는다:
**순번 · 작업일자 · 호수 · 타입 · 작업분류 · 작업비용 · 청구비용 · 작업내용**.
표 아래에 호수별 사진이 증빙으로 붙어 회사에 그대로 보낼 수 있다.

파일명은 리포트 규칙 — `buildReportFileName({ reportType: "repair_billing" })`
→ `리포트-여수-하자청구명세-20260831_v1`.

## C. 명세서 → 청구서

`POST /api/v1/work-orders/billing-statement/invoice` — 다이얼로그의 **청구서 발행**.

명세서와 같은 필터를 그대로 받아 **명세서 한 줄 = 청구서 한 줄**로 발행한다
(`invoice_line_items`, `charge_kind="other"`). 줄마다 `work_order_id`와 `space_id`가
남아 종이·청구서·작업 사진이 줄 단위로 되짚어진다.

- **청구 대상**: `account_id`를 주면 그 계정, 없으면 대상 세대의 집주인
  (`spaces.landlord_account_id`). 집주인이 둘 이상이면 400 `MULTIPLE_OWNERS`로
  돌려주고 고르게 한다 — 조용히 아무나 고르면 엉뚱한 곳에 청구된다.
- **중복 방지**: 이미 살아 있는 청구서에 실린 작업지시는 건너뛰고 `skipped`로
  알린다. 요약 응답도 `billable_count`/`billable_amount`로 미리 보여 준다.
  무효(Void)·삭제된 청구서는 세지 않는다 — 취소분 때문에 재청구가 막히면 안 된다.
- **금액**: `amount`는 공급가액(=청구비용 합계). 기본 `tax_mode="none"`이고,
  과세로 끊어야 하면 `tax_mode="exclusive"`(`tax_rate` 기본 10)로 부른다.
- 발행 상태는 `Draft`다. 검토 후 기존 청구서 화면에서 발송·수납하면 GL·정산은
  기존 경로를 그대로 탄다.

## 계산 규칙 — 청구비용

`billedAmountOf()` 하나가 두 문서 모두를 계산한다. 우선순위는 이렇다.

1. `net_cost`(실지급액)가 있으면 그 값
2. 없고 `withholding_amount`가 있으면 `cost - withholding_amount`
3. 둘 다 없으면 호출자가 준 `withholding_pct`로 `cost × (1 - pct/100)`

**지금은 3번만 동작한다** — 작업지시에 실지급액·원천징수액 컬럼이 아직 없기
때문이다(청소/하자 원장 필드는 별도 브랜치에 있고 미머지). 그 컬럼이 붙으면
라우트에서 값을 넘기는 것만으로 1·2번이 살아난다. 3번이 적용된 명세서에는 그
사실이 각주로 찍힌다. 한국 원천징수 3.3%면 ₩100,000 → ₩96,700.

## 알아둘 것

- **타입(A~E)은 상위 공간 이름**이다. Metheim 여수는 타입을 상위 공간 8행으로
  두고 실제 세대가 `parent_space_id`로 매달려 있어, 세대 행에서 직접 읽으면 항상
  비어 있다 — [UNIT_INVENTORY](tenants/metheim/UNIT_INVENTORY.md).
- **작업일자**는 완료일 → 예정일 → 접수일 → 등록일 순으로 하나를 고른다. 완료일은
  timestamptz, 접수일·예정일은 날짜 텍스트라 한 SQL 조건으로 묶이지 않아 기간
  필터는 조회 후 코드에서 건다.
- `billing-statement*` 라우트는 `/v1/work-orders/:id`보다 **먼저** 등록해야 한다.
  세그먼트 수가 같아서 순서가 바뀌면 `:id`가 `billing-statement.pdf`를 먹는다.
- 월세용 통합(단체) 청구서 파이프라인에는 얹지 않는다. 그쪽은 계약 단위 자식
  인보이스를 요구하고 크론이 (계정, 월) 단위로 금액을 다시 계산해서, 하자 청구를
  넣으면 덮어써진다 ([CONSOLIDATED_INVOICING](CONSOLIDATED_INVOICING.md)).
