import { asc, desc, type SQL, type SQLWrapper } from "drizzle-orm";

/**
 * Shared server-side pagination helpers.
 *
 * Standard list-endpoint contract used across portals:
 *   - Request query: `?limit=&offset=` (preferred) or `?page=&limit=`, plus `?q=`/`?search=`.
 *   - Response: `{ success: true, data: T[], meta: { total, limit, offset, page } }`.
 *
 * Keep `limit` bounded so a malicious/buggy client cannot ask for the whole table.
 */

export interface PageParams {
  limit: number;
  offset: number;
  /** 1-based page number derived from offset/limit. */
  page: number;
  /** Trimmed free-text search term (`q` or `search`), empty string when absent. */
  q: string;
}

export function parsePageParams(
  query: Record<string, unknown>,
  opts?: { defaultLimit?: number; maxLimit?: number },
): PageParams {
  const maxLimit = opts?.maxLimit ?? 100;
  const defaultLimit = opts?.defaultLimit ?? 25;

  const rawLimit = Number(query.limit);
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.floor(rawLimit), maxLimit) : defaultLimit;

  let offset = 0;
  if (query.offset != null && query.offset !== "") {
    const o = Number(query.offset);
    offset = Number.isFinite(o) && o > 0 ? Math.floor(o) : 0;
  } else if (query.page != null && query.page !== "") {
    const p = Number(query.page);
    offset = Number.isFinite(p) && p > 1 ? (Math.floor(p) - 1) * limit : 0;
  }

  const page = Math.floor(offset / limit) + 1;

  const raw = query.q ?? query.search;
  const q = typeof raw === "string" ? raw.trim() : "";

  return { limit, offset, page, q };
}

/**
 * 리스트 엔드포인트용 페이지 파라미터 — **하위 호환 우선**.
 *
 * `limit`/`offset`/`page` 를 하나도 보내지 않은 요청은 예전처럼 **전량**을 받는다.
 * 같은 엔드포인트를 목록 화면 말고도(상세 탭, 대시보드 집계, 선택 드롭다운 등)
 * 전량 전제로 쓰는 자리가 많아서, 서버 페이징 도입이 그 자리를 조용히 25건으로
 * 잘라 버리면 안 되기 때문이다. 페이지를 원하는 화면(useServerList)은 항상
 * limit 을 보내므로 자연히 페이징 경로를 탄다.
 */
export function parseListPage(
  query: Record<string, unknown>,
  opts?: { defaultLimit?: number; maxLimit?: number; unpagedLimit?: number },
): PageParams & { paged: boolean } {
  const paged = ["limit", "offset", "page"].some((k) => query[k] != null && query[k] !== "");
  if (!paged) {
    // 전량 경로에도 폭주 방지용 상한은 둔다(사실상 어떤 테이블보다 크게).
    const limit = opts?.unpagedLimit ?? 20000;
    const raw = query.q ?? query.search;
    return { limit, offset: 0, page: 1, q: typeof raw === "string" ? raw.trim() : "", paged: false };
  }
  return { ...parsePageParams(query, { defaultLimit: opts?.defaultLimit ?? 25, maxLimit: opts?.maxLimit ?? 5000 }), paged: true };
}

export function pageMeta(total: number, p: Pick<PageParams, "limit" | "offset" | "page">) {
  return { total, limit: p.limit, offset: p.offset, page: p.page };
}

/** Paginate an already-materialised array (use only when DB-level paging isn't practical). */
export function paginateArray<T>(items: T[], p: Pick<PageParams, "limit" | "offset">): T[] {
  return items.slice(p.offset, p.offset + p.limit);
}


/* ------------------------------------------------------------------------- *
 * 서버 정렬(list sorting) 공용 규약
 *
 * 리스트 엔드포인트는 `?sort=<key>&dir=asc|desc` 를 받는다. `<key>` 는 라우트가
 * 선언한 화이트리스트(SortMap)에 있는 키만 허용한다 — 임의 컬럼 정렬은 인덱스가
 * 없거나 SQL 주입 표면이 되므로 절대 열지 않는다. 화이트리스트에 없는 키가 오면
 * 조용히 기본 정렬로 떨어진다(에러 아님: 프런트가 파생 컬럼을 눌렀을 뿐일 수 있다).
 *
 * 페이지 경계에서 행이 반복/누락되지 않도록 항상 tiebreak(보통 id)를 마지막
 * 정렬 키로 덧붙인다.
 * ------------------------------------------------------------------------- */

export type SortDir = "asc" | "desc";

/** 정렬 허용 컬럼 맵. 키는 프런트 컬럼 키, 값은 drizzle 컬럼 또는 SQL 식. */
export type SortMap = Record<string, SQLWrapper>;

export interface SortParams {
  /** 화이트리스트를 통과한 정렬 키(없으면 null → 기본 정렬). */
  sort: string | null;
  dir: SortDir;
}

export function parseSortParams(
  query: Record<string, unknown>,
  map: SortMap,
  opts?: { defaultKey?: string; defaultDir?: SortDir },
): SortParams {
  const rawSort = typeof query.sort === "string" ? query.sort.trim() : "";
  const key = rawSort && Object.prototype.hasOwnProperty.call(map, rawSort) ? rawSort : (opts?.defaultKey ?? null);

  const rawDir = typeof query.dir === "string" ? query.dir.trim().toLowerCase() : "";
  const dir: SortDir = rawDir === "asc" || rawDir === "desc" ? rawDir : (opts?.defaultDir ?? "asc");

  return { sort: key && Object.prototype.hasOwnProperty.call(map, key) ? key : null, dir };
}

/**
 * `.orderBy(...)` 에 그대로 펼쳐 넣을 정렬 식 배열.
 * 정렬 키가 없으면 `fallback` 을, 있으면 `[dir(col), tiebreak]` 를 돌려준다.
 */
export function buildOrderBy(
  map: SortMap,
  { sort, dir }: SortParams,
  tiebreak: SQLWrapper,
  fallback?: SQL[],
): SQL[] {
  if (!sort) return fallback ?? [asc(tiebreak)];
  const primary = dir === "desc" ? desc(map[sort]) : asc(map[sort]);
  return [primary, desc(tiebreak)];
}

/**
 * 리스트 응답 표준 송출.
 *
 * 기존 응답 스키마(배열 그대로 vs `{ success, data, meta }`)를 바꾸지 않으면서
 * 전체 건수를 실어 보내기 위해 총 건수는 **`X-Total-Count` 헤더**로 나간다.
 * (배열 응답 엔드포인트를 봉투로 바꾸면 orval 생성 타입·모든 소비자가 깨진다.)
 */
export function sendList<T>(
  res: { setHeader: (k: string, v: string) => void; json: (b: unknown) => unknown },
  rows: T[],
  total: number,
  p?: Pick<PageParams, "limit" | "offset" | "page">,
): void {
  res.setHeader("X-Total-Count", String(total));
  if (p) {
    res.setHeader("X-Page-Limit", String(p.limit));
    res.setHeader("X-Page-Offset", String(p.offset));
  }
  res.json(rows);
}
