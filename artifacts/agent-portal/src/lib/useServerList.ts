/**
 * useServerList — server-side paginated + searchable list fetching.
 *
 * Expects the standard list envelope: `{ success, data: T[], meta: { total } }`.
 * Manages page / pageSize state, debounces the search term, and resets to page 1
 * whenever the search or any extra filter param changes.
 */
import { useEffect, useMemo, useState } from "react";
import { apiGet } from "./api";

interface ListMeta {
  total?: number;
}
interface ListResponse<T> {
  success?: boolean;
  data: T[];
  meta?: ListMeta;
}

export interface UseServerListResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  loading: boolean;
  error: string;
  setPage: (p: number) => void;
  setPageSize: (n: number) => void;
  refetch: () => void;
}

export function useServerList<T>(
  basePath: string,
  opts?: {
    search?: string;
    pageSize?: number;
    params?: Record<string, string | number | undefined>;
    debounceMs?: number;
  },
): UseServerListResult<T> {
  const { search = "", pageSize: initialPageSize = 25, params, debounceMs = 300 } = opts ?? {};

  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadTick, setReloadTick] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  // Debounce the search term so we don't fire a request per keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), debounceMs);
    return () => clearTimeout(id);
  }, [search, debounceMs]);

  const paramsKey = useMemo(() => JSON.stringify(params ?? {}), [params]);

  // Any filter change returns to the first page.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, paramsKey, pageSize]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const sp = new URLSearchParams();
    sp.set("limit", String(pageSize));
    sp.set("offset", String((page - 1) * pageSize));
    if (debouncedSearch) sp.set("q", debouncedSearch);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
      }
    }
    apiGet<ListResponse<T>>(`${basePath}?${sp.toString()}`)
      .then((d) => {
        if (cancelled) return;
        setItems(d.data ?? []);
        setTotal(d.meta?.total ?? d.data?.length ?? 0);
        setError("");
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basePath, page, pageSize, debouncedSearch, paramsKey, reloadTick]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    items,
    total,
    page: Math.min(page, totalPages),
    pageSize,
    totalPages,
    loading,
    error,
    setPage,
    setPageSize: (n: number) => setPageSizeState(n),
    refetch: () => setReloadTick((t) => t + 1),
  };
}
