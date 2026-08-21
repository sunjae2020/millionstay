/**
 * App-wide date formatting.
 *
 * The display format is set per tenant via the build-time `VITE_DATE_FORMAT`
 * env var (e.g. Metheim = "YYYY/MM/DD"), mirroring how currency / price-unit are
 * configured. It matches the admin's Settings → Organisation → Date format so the
 * landing site, admin, portals and every generated document read identically.
 * Every screen should format dates through `formatDate` / `formatDateTime`
 * instead of `toLocaleDateString()` (which silently follows the browser locale).
 *
 * The DATE portion follows the setting; the TIME portion (when shown) is always
 * appended as 24-hour HH:mm.
 */

type DateInput = string | number | Date | null | undefined;

const KNOWN = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD", "YYYY/MM/DD", "D MMM YYYY"];

function resolvePattern(): string {
  const v = (import.meta.env.VITE_DATE_FORMAT as string | undefined)?.trim();
  return v && KNOWN.includes(v) ? v : "YYYY/MM/DD";
}

const PATTERN = resolvePattern();

function toDate(value: DateInput): Date | null {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** 표시 형식 라벨(예: "YYYY/MM/DD") — 날짜 입력칸의 placeholder 로 쓴다. */
export function getDatePlaceholder(): string {
  return PATTERN;
}

/** Format a date value using the configured tenant date format. */
export function formatDate(value: DateInput, fallback = "—"): string {
  const d = toDate(value);
  if (!d) return fallback;
  const Y = d.getFullYear();
  const M = d.getMonth() + 1;
  const D = d.getDate();
  switch (PATTERN) {
    case "MM/DD/YYYY": return `${pad2(M)}/${pad2(D)}/${Y}`;
    case "YYYY-MM-DD": return `${Y}-${pad2(M)}-${pad2(D)}`;
    case "YYYY/MM/DD": return `${Y}/${pad2(M)}/${pad2(D)}`;
    case "D MMM YYYY": return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    case "DD/MM/YYYY":
    default: return `${pad2(D)}/${pad2(M)}/${Y}`;
  }
}

/** Format a date + 24-hour time (e.g. "2026/06/13 14:30"). */
export function formatDateTime(value: DateInput, fallback = "—"): string {
  const d = toDate(value);
  if (!d) return fallback;
  return `${formatDate(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
