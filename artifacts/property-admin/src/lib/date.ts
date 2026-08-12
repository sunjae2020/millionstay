import { format as fnsFormat, parseISO, isValid } from "date-fns";
import { loadTheme } from "./theme";

/**
 * App-wide date formatting.
 *
 * The display pattern is driven by the admin Design setting
 * (Settings → Design → Format → Date format), persisted in the theme
 * localStorage blob. Every screen should format dates through `formatDate` /
 * `formatDateTime` so a single setting governs the whole app instead of each
 * page hardcoding `toLocaleDateString()` (which silently follows the browser
 * locale and produces MM/DD/YYYY on US machines).
 *
 * Per the agreed convention: the DATE portion follows the setting; the TIME
 * portion (when shown) is always appended as 24-hour HH:mm.
 */

// Maps the human-facing options in Design.tsx to date-fns patterns.
const PATTERN_MAP: Record<string, string> = {
  "DD/MM/YYYY": "dd/MM/yyyy",
  "MM/DD/YYYY": "MM/dd/yyyy",
  "YYYY-MM-DD": "yyyy-MM-dd",
  "YYYY/MM/DD": "yyyy/MM/dd",
  "D MMM YYYY": "d MMM yyyy",
};

const DEFAULT_PATTERN = "dd/MM/yyyy"; // DD/MM/YYYY — the app default

export function getDatePattern(): string {
  const setting = loadTheme().date_format;
  return (setting && PATTERN_MAP[setting]) || DEFAULT_PATTERN;
}

/** Human-facing label for the configured pattern (e.g. "DD/MM/YYYY") — used as input placeholders. */
export function getDatePlaceholder(): string {
  const setting = loadTheme().date_format;
  return (setting && PATTERN_MAP[setting] ? setting : "DD/MM/YYYY");
}

type DateInput = string | number | Date | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value == null || value === "") return null;
  let d: Date;
  if (value instanceof Date) {
    d = value;
  } else if (typeof value === "number") {
    d = new Date(value);
  } else {
    // Prefer ISO parsing; fall back to the Date constructor for other strings.
    d = parseISO(value);
    if (!isValid(d)) d = new Date(value);
  }
  return isValid(d) ? d : null;
}

/** Format a date value using the configured app date pattern. */
export function formatDate(value: DateInput, fallback = "—"): string {
  const d = toDate(value);
  return d ? fnsFormat(d, getDatePattern()) : fallback;
}

/** Format a date + 24-hour time (e.g. "13/06/2026 14:30"). */
export function formatDateTime(value: DateInput, fallback = "—"): string {
  const d = toDate(value);
  return d ? fnsFormat(d, `${getDatePattern()} HH:mm`) : fallback;
}

/**
 * Calendar length of a stay, as years + months + days.
 *
 * Counted the way a lease reads it: check-in 2026-03-15 → check-out 2027-05-20
 * is "1년 2개월 5일", not 432 nights. Months are walked calendar-wise (so a
 * 28-day February counts as one month), and the day remainder borrows from the
 * month before the check-out month. `nights` is kept alongside because billing
 * still prorates per night.
 */
export function stayDuration(checkIn?: string | null, checkOut?: string | null) {
  if (!checkIn || !checkOut) return null;
  const cin = new Date(`${checkIn}T00:00:00`);
  const cout = new Date(`${checkOut}T00:00:00`);
  if (isNaN(cin.getTime()) || isNaN(cout.getTime()) || cout < cin) return null;

  let years = cout.getFullYear() - cin.getFullYear();
  let months = cout.getMonth() - cin.getMonth();
  let days = cout.getDate() - cin.getDate();
  if (days < 0) {
    months -= 1;
    // Days in the month preceding the check-out month.
    days += new Date(cout.getFullYear(), cout.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  const nights = Math.round((cout.getTime() - cin.getTime()) / 86_400_000);
  return { years, months, days, nights };
}

/** "1년 2개월 5일" — omits zero units, but never returns an empty string. */
export function formatStayDuration(
  d: { years: number; months: number; days: number } | null | undefined,
  labels: { year: string; month: string; day: string } = { year: "년", month: "개월", day: "일" },
): string {
  if (!d) return "";
  const parts: string[] = [];
  if (d.years) parts.push(`${d.years}${labels.year}`);
  if (d.months) parts.push(`${d.months}${labels.month}`);
  if (d.days || !parts.length) parts.push(`${d.days}${labels.day}`);
  return parts.join(" ");
}
