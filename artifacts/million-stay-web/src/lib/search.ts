/**
 * Client-side list filtering, matched to the server's `searchAny` semantics
 * (api-server/src/lib/searchFilter.ts): case-insensitive and blind to
 * whitespace/punctuation, so "홍 길동" finds "홍길동" and "010-1234-5678"
 * finds "01012345678".
 *
 * Use for lists that filter rows already in memory. Lists that query the API
 * pass `search`/`q` and get the same behaviour server-side.
 */
const NOISE = /[\s().,·/-]/g;

function norm(v: unknown): string {
  return String(v ?? "").toLowerCase().replace(NOISE, "");
}

/** True when `query` is empty or matches any of `fields`. */
export function matchesQuery(query: string | undefined | null, ...fields: unknown[]): boolean {
  const needle = norm(query);
  if (!needle) return true;
  return fields.some((f) => norm(f).includes(needle));
}
