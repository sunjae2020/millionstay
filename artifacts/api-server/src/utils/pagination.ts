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

export function pageMeta(total: number, p: Pick<PageParams, "limit" | "offset" | "page">) {
  return { total, limit: p.limit, offset: p.offset, page: p.page };
}

/** Paginate an already-materialised array (use only when DB-level paging isn't practical). */
export function paginateArray<T>(items: T[], p: Pick<PageParams, "limit" | "offset">): T[] {
  return items.slice(p.offset, p.offset + p.limit);
}
