import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiFetch";
import type { DataTableServer } from "./types";

/**
 * 서버 정렬 + 서버 페이징 리스트 훅.
 *
 * 규약(artifacts/api-server/src/utils/pagination.ts 와 짝):
 *   요청  `?limit=&offset=&sort=<컬럼키>&dir=asc|desc` + 페이지 자체 필터
 *   응답  배열 그대로(총 건수는 `X-Total-Count` 헤더) 또는 `{ data, meta.total }`
 *
 * 정렬 가능 컬럼은 서버 화이트리스트와 같아야 한다(`sortableKeys`). 목록에 없는
 * 컬럼은 DataTable 이 헤더를 정렬 불가로 렌더한다 — 한 페이지만 정렬해서 "틀린
 * 정렬"을 보여주느니 정렬 못 하는 편이 낫다.
 */
export interface ServerListOptions {
  /** 서버가 정렬할 수 있는 컬럼 키(라우트의 SORTABLE 맵과 일치시킬 것). */
  sortableKeys: string[];
  defaultSort?: { key: string; dir?: "asc" | "desc" };
  defaultPageSize?: number;
  /** 페이지 필터. 값이 비면 쿼리에서 빠지고, 바뀌면 1페이지로 되돌아간다. */
  filters?: Record<string, string | number | boolean | undefined | null>;
  enabled?: boolean;
  /** CSV 내려받기용 전량 조회 상한(서버 maxLimit 과 맞춰 둔다). */
  exportLimit?: number;
}

export interface ServerListResult<T> {
  rows: T[];
  total: number;
  /** 봉투 응답(`{ data, meta }`)의 meta 그대로 — 합계 타일 같은 부가 집계용. */
  meta: Record<string, unknown> | undefined;
  isLoading: boolean;
  isFetching: boolean;
  /** DataTable 에 그대로 넘기는 서버 모드 서술자. */
  server: DataTableServer<T>;
  /** 목록 무효화(변경 저장 후 호출). */
  invalidate: () => void;
  queryKey: unknown[];
}

function buildQuery(
  filters: ServerListOptions["filters"],
  extra: Record<string, string | number | undefined>,
): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filters ?? {})) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    p.set(k, String(v));
  }
  for (const [k, v] of Object.entries(extra)) {
    if (v === undefined || v === "") continue;
    p.set(k, String(v));
  }
  return p.toString();
}

async function fetchList<T>(
  path: string,
  qs: string,
): Promise<{ rows: T[]; total: number; meta: Record<string, unknown> | undefined }> {
  const res = await apiFetch(qs ? `${path}?${qs}` : path);
  if (!res.ok) throw new Error(await res.text().catch(() => "Request failed"));
  const headerTotal = Number(res.headers.get("X-Total-Count"));
  const body = await res.json();
  // 배열 응답 · `{ success, data, meta }` 봉투 두 형태를 모두 받는다.
  const rows: T[] = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
  const metaTotal = Number(body?.meta?.total);
  const total = Number.isFinite(headerTotal)
    ? headerTotal
    : Number.isFinite(metaTotal)
      ? metaTotal
      : rows.length;
  return { rows, total, meta: body?.meta };
}

export function useServerList<T>(path: string, opts: ServerListOptions): ServerListResult<T> {
  const {
    sortableKeys,
    defaultSort,
    defaultPageSize = 25,
    filters,
    enabled = true,
    exportLimit = 5000,
  } = opts;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [sortKey, setSortKey] = useState<string | null>(defaultSort?.key ?? null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(defaultSort?.dir ?? "asc");

  // 필터가 바뀌면 현재 페이지가 존재하지 않을 수 있다 → 1페이지로.
  const filterSig = JSON.stringify(filters ?? {});
  const prevSig = useRef(filterSig);
  useEffect(() => {
    if (prevSig.current !== filterSig) {
      prevSig.current = filterSig;
      setPage(1);
    }
  }, [filterSig]);

  const qs = useMemo(
    () =>
      buildQuery(filters, {
        limit: pageSize,
        offset: (page - 1) * pageSize,
        sort: sortKey ?? undefined,
        dir: sortKey ? sortDir : undefined,
      }),
    // filters 는 매 렌더 새 객체일 수 있어 시그니처로 고정한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filterSig, page, pageSize, sortKey, sortDir],
  );

  const queryKey = useMemo(() => [path, qs], [path, qs]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey,
    queryFn: () => fetchList<T>(path, qs),
    enabled,
    placeholderData: keepPreviousData,
  });

  const qc = useQueryClient();
  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: [path] });
  }, [qc, path]);

  const total = data?.total ?? 0;

  // 같은 컬럼을 다시 누르면 방향만 뒤집고, 다른 컬럼이면 오름차순부터.
  // (setState 업데이터 안에서 다른 setState 를 부르면 StrictMode 이중 호출 때
  //  방향이 두 번 뒤집힌다 — 그래서 현재 값을 직접 읽어 분기한다.)
  const onSort = useCallback(
    (key: string) => {
      setPage(1);
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("asc");
      }
    },
    [sortKey],
  );

  const fetchAll = useCallback(async () => {
    const allQs = buildQuery(filters, {
      limit: Math.min(Math.max(total, 1), exportLimit),
      offset: 0,
      sort: sortKey ?? undefined,
      dir: sortKey ? sortDir : undefined,
    });
    const { rows } = await fetchList<T>(path, allQs);
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, filterSig, total, sortKey, sortDir, exportLimit]);

  const server: DataTableServer<T> = useMemo(
    () => ({
      total,
      page,
      pageSize,
      sortKey,
      sortDir,
      sortableKeys,
      onPage: setPage,
      onPageSize: (n: number) => {
        setPageSize(n);
        setPage(1);
      },
      onSort,
      fetchAll,
    }),
    [total, page, pageSize, sortKey, sortDir, sortableKeys, onSort, fetchAll],
  );

  return {
    rows: data?.rows ?? [],
    total,
    meta: data?.meta,
    isLoading,
    isFetching,
    server,
    invalidate,
    queryKey,
  };
}
