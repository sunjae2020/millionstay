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
  "D MMM YYYY": "d MMM yyyy",
};

const DEFAULT_PATTERN = "dd/MM/yyyy"; // DD/MM/YYYY — the app default

export function getDatePattern(): string {
  const setting = loadTheme().date_format;
  return (setting && PATTERN_MAP[setting]) || DEFAULT_PATTERN;
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
