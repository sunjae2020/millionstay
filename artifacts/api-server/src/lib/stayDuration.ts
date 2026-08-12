/**
 * Calendar length of a stay, as years + months + days.
 *
 * Counted the way a lease reads it: check-in 2026-03-15 → check-out 2027-05-20
 * is "1년 2개월 5일", not 432 nights. Months are walked calendar-wise (so a
 * 28-day February counts as one month), and the day remainder borrows from the
 * month before the check-out month. `nights` is kept alongside because billing
 * still prorates per night.
 *
 * Mirrors `stayDuration` in property-admin/src/lib/date.ts — keep the two in
 * sync so the server-rendered value and the live value the booking form shows
 * while you pick dates never disagree.
 */
export interface StayDuration {
  years: number;
  months: number;
  days: number;
  nights: number;
}

export function stayDuration(
  checkIn?: string | null,
  checkOut?: string | null,
): StayDuration | null {
  if (!checkIn || !checkOut) return null;
  const cin = new Date(`${checkIn}T00:00:00Z`);
  const cout = new Date(`${checkOut}T00:00:00Z`);
  if (isNaN(cin.getTime()) || isNaN(cout.getTime()) || cout < cin) return null;

  let years = cout.getUTCFullYear() - cin.getUTCFullYear();
  let months = cout.getUTCMonth() - cin.getUTCMonth();
  let days = cout.getUTCDate() - cin.getUTCDate();
  if (days < 0) {
    months -= 1;
    // Days in the month preceding the check-out month.
    days += new Date(Date.UTC(cout.getUTCFullYear(), cout.getUTCMonth(), 0)).getUTCDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  const nights = Math.round((cout.getTime() - cin.getTime()) / 86_400_000);
  return { years, months, days, nights };
}

/** "1년 2개월 5일" — omits zero units, but never returns an empty string. */
export function formatStayDurationKo(d: StayDuration | null | undefined): string {
  if (!d) return "";
  const parts: string[] = [];
  if (d.years) parts.push(`${d.years}년`);
  if (d.months) parts.push(`${d.months}개월`);
  if (d.days || !parts.length) parts.push(`${d.days}일`);
  return parts.join(" ");
}
