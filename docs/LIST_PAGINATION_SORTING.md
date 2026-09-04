---
status: live
domain: 인프라
last_verified: 2026-09-05
---

# 리스트 서버 정렬 · 서버 페이징 규약

관리자 리스트는 원래 **전량을 받아 브라우저에서 정렬·페이지 분할**했다. 서버가
조용히 잘라 보내는 엔드포인트(홈스테이 3종·서비스·거래 등)에서는 "로드된 앞부분만
정렬"되어 날짜 정렬이 사실상 틀린 결과를 보여줬다. 이 문서는 그 자리를 대체하는
공용 규약이다.

## 계약(Contract)

```
요청  GET /api/v1/<resource>?limit=25&offset=50&sort=<컬럼키>&dir=asc|desc&<필터…>
응답  기존 스키마 그대로(배열 또는 { success, data, meta })
      총 건수는 헤더 X-Total-Count (+ X-Page-Limit / X-Page-Offset)
```

- **총 건수를 헤더로 보내는 이유**: 배열로 응답하던 엔드포인트를 봉투로 바꾸면
  orval 생성 타입과 모든 소비자가 깨진다. 헤더는 `app.ts` 의 CORS
  `exposedHeaders` 에 등록되어 있어야 브라우저가 읽을 수 있다.
- **`limit`/`offset`/`page` 를 하나도 안 보내면 예전처럼 전량을 반환한다**
  (`parseListPage`). 같은 엔드포인트를 상세 탭·대시보드 집계·선택 드롭다운이
  전량 전제로 쓰기 때문에, 페이징 도입이 그 자리를 25건으로 잘라선 안 된다.

## 서버 (`artifacts/api-server/src/utils/pagination.ts`)

```ts
const CONTRACT_SORT: SortMap = {            // 프런트 컬럼 키 = 이 맵의 키
  contract_ref: contractsTable.contract_ref,
  tenant_name: sql`(select a.name from accounts a where a.id = ${contractsTable.tenant_account_id})`,
};

const { limit, offset, page } = parseListPage(req.query);
const sort = parseSortParams(req.query, CONTRACT_SORT);
const [rows, [{ count }]] = await Promise.all([
  db.select().from(contractsTable).where(where)
    .orderBy(...buildOrderBy(CONTRACT_SORT, sort, contractsTable.id))
    .limit(limit).offset(offset),
  db.select({ count: sql<number>`count(*)::int` }).from(contractsTable).where(where),
]);
sendList(res, await enrichContracts(rows), count ?? 0, { limit, offset, page });
```

- 정렬 키는 **화이트리스트(SortMap)** 만 허용한다. 임의 컬럼 정렬은 인덱스가 없거나
  주입 표면이 된다. 목록에 없는 키는 조용히 기본 정렬로 떨어진다.
- `buildOrderBy` 는 항상 tiebreak(보통 `id`)를 덧붙인다 — 없으면 동률 행이
  페이지 경계에서 중복/누락된다.
- **필터는 전부 SQL 로 내려야 한다.** enrich 후 배열을 거르면 "현재 페이지 안에서만"
  거르는 꼴이 된다(예약 목록 검색·임대 유형, 공간 상위필터를 이 이유로 옮겼다).
- 집계 타일(거래의 수입·지출)도 페이지 행이 아니라 SQL 합계로 낸다.
- 필터 선택지가 목록 행에서 파생되던 화면은 별도 facets 엔드포인트를 쓴다
  (`/v1/contracts/facets`, `/v1/spaces/facets`).

## 프런트 (`components/ui/data-table/useServerList.ts`)

```tsx
const SORTABLE_KEYS = ["contract_ref", "tenant_name", "start_date", "amount", "status", "created_at"];

const { rows, total, isLoading, server, invalidate } = useServerList<Contract>(
  "/api/v1/contracts",
  { filters, sortableKeys: SORTABLE_KEYS, defaultSort: { key: "created_at", dir: "desc" } },
);

<DataTable ... data={rows} server={server} />
```

- `server` prop 이 있으면 DataTable 은 받은 행을 **현재 페이지**로 보고 클라이언트
  정렬·자르기를 하지 않는다. `sortableKeys` 에 없는 컬럼 헤더는 정렬 불가로 렌더된다 —
  한 페이지만 정렬해 틀린 순서를 보여주느니 못 누르게 하는 편이 낫다.
- `sortableKeys` 는 서버 SortMap 과 **1:1로 맞춰야 한다**(둘 다 주석으로 서로를 가리킨다).
- CSV 내보내기는 선택이 없으면 `fetchAll()` 로 필터·정렬 그대로 전량을 다시 받아 쓴다.
- 쿼리 키는 `[<API 경로>, <쿼리스트링>]` 이라 orval 의 `getListXQueryKey()`
  (= `["/api/v1/x", …]`) 무효화가 그대로 먹는다. 레거시 키(`["services"]` 등)를 쓰는
  화면은 API 경로 키도 함께 무효화해야 한다.

## 이관 현황 (2026-09-05)

| 이관 완료 | 계약 · 청구서 · 공간 · 연락처 · 계정 · 예약 · 작업지시 · 프로퍼티 · 서비스 · 거래 · 홈스테이(신청/학생요청/배정) |
| --------- | --- |
| 미이관    | 설정·마스터성 소규모 리스트(상품유형·계약유형·서브번·번역 등)와 견적·영수증·리드·업무 등. 전량 반환 엔드포인트라 정렬은 정확하며, 데이터가 커지는 순서대로 같은 레시피로 옮기면 된다. |
