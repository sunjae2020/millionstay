/**
 * Minimal, dependency-free iCalendar (RFC 5545) parser for inbound OTA feeds.
 *
 * We only care about VEVENT busy/blocked ranges (Airbnb, Booking.com and
 * Expedia all export availability as all-day VEVENTs). Returns each event as a
 * [start, endExclusive) date range. For all-day (VALUE=DATE) events DTEND is
 * already exclusive per the spec; date-time events are reduced to their date.
 */

export interface ParsedEvent {
  uid: string;
  start: string; // "YYYY-MM-DD" inclusive
  endExclusive: string; // "YYYY-MM-DD" exclusive
}

/** Unfold per RFC 5545 §3.1: a CRLF followed by space/tab continues the line. */
function unfoldLines(text: string): string[] {
  const raw = text.split(/\r\n|\n|\r/);
  const out: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

/** Extract "YYYY-MM-DD" from a DATE ("20260601") or DATE-TIME ("20260601T..."). */
function parseDateValue(value: string): string | null {
  const m = value.trim().match(/(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/** Add days to a "YYYY-MM-DD" string (UTC, DST-safe). */
function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function parseIcal(text: string): ParsedEvent[] {
  const lines = unfoldLines(text);
  const events: ParsedEvent[] = [];

  let inEvent = false;
  let uid: string | null = null;
  let start: string | null = null;
  let end: string | null = null;

  const flush = () => {
    if (start) {
      // Fallbacks: missing/!valid DTEND → single day; ensure exclusive end > start.
      let endExclusive = end ?? addDays(start, 1);
      if (endExclusive <= start) endExclusive = addDays(start, 1);
      events.push({ uid: uid ?? `${start}_${endExclusive}`, start, endExclusive });
    }
    uid = start = end = null;
  };

  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper === "BEGIN:VEVENT") {
      inEvent = true;
      uid = start = end = null;
      continue;
    }
    if (upper === "END:VEVENT") {
      if (inEvent) flush();
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;

    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const namePart = line.slice(0, colon); // may include ;params
    const value = line.slice(colon + 1);
    const prop = namePart.split(";")[0].toUpperCase();

    if (prop === "UID") uid = value.trim();
    else if (prop === "DTSTART") start = parseDateValue(value);
    else if (prop === "DTEND") end = parseDateValue(value);
  }

  return events;
}
