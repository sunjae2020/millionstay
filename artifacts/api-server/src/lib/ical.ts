/**
 * Minimal, dependency-free iCalendar (RFC 5545) builder for the outbound OTA
 * availability feed. We only emit all-day VEVENTs (busy/blocked ranges), which
 * is all Airbnb / Booking.com / Expedia consume from an imported calendar.
 *
 * Note on DTEND: for all-day (VALUE=DATE) events DTEND is *exclusive*, so a
 * blocked range [2026-06-01 .. 2026-06-03) blocks Jun 1 and 2, leaving Jun 3
 * free — matching hotel check-out semantics.
 */

export interface ICalEvent {
  uid: string; // globally-stable identifier; OTAs upsert by this
  start: string; // inclusive start, "YYYY-MM-DD"
  endExclusive: string; // exclusive end, "YYYY-MM-DD"
  summary: string;
}

/** Add `n` days to a "YYYY-MM-DD" string (UTC, DST-safe). */
export function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" → "YYYYMMDD" (the DATE value format). */
function toICalDate(dateStr: string): string {
  return dateStr.replace(/-/g, "");
}

/** Format a Date as a UTC timestamp: "YYYYMMDDTHHMMSSZ". */
function toICalTimestamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/** Escape text per RFC 5545 §3.3.11. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold a content line to <=75 octets per RFC 5545 §3.1 (CRLF + space). */
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let rest = line;
  chunks.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length > 0) {
    chunks.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  return chunks.join("\r\n");
}

/**
 * Merge a list of individual "YYYY-MM-DD" dates into contiguous
 * [start, endExclusive) ranges. Input need not be sorted or unique.
 */
export function mergeConsecutiveDates(dates: string[]): Array<{ start: string; endExclusive: string }> {
  const sorted = [...new Set(dates)].sort();
  const ranges: Array<{ start: string; endExclusive: string }> = [];
  for (const date of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && last.endExclusive === date) {
      last.endExclusive = addDays(date, 1); // extend current run
    } else {
      ranges.push({ start: date, endExclusive: addDays(date, 1) });
    }
  }
  return ranges;
}

export interface BuildCalendarOptions {
  calendarName: string;
  prodId?: string;
  /** Stamp used for DTSTAMP; defaults to now. */
  now?: Date;
}

/** Build a complete VCALENDAR document (CRLF line endings). */
export function buildCalendar(events: ICalEvent[], opts: BuildCalendarOptions): string {
  const dtstamp = toICalTimestamp(opts.now ?? new Date());
  const prodId = opts.prodId ?? "-//MillionStay//Channel Calendar//EN";

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${prodId}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(opts.calendarName)}`,
  ];

  for (const ev of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeText(ev.uid)}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${toICalDate(ev.start)}`,
      `DTEND;VALUE=DATE:${toICalDate(ev.endExclusive)}`,
      `SUMMARY:${escapeText(ev.summary)}`,
      "TRANSP:OPAQUE",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
