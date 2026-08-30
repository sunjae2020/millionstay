/**
 * 청구 달력의 기준 시간대 — 모든 청구 크론이 공유하는 단일 소스.
 *
 * 크론이 도는 서버는 UTC 라서 `new Date()`의 UTC 날짜를 그대로 쓰면 "매월 1일에
 * 발행" 같은 날짜 조건이 하루 어긋난다(시드니 03:00 = 전날 17:00 UTC — 매월 1일의
 * UTC 달은 아직 지난달이다). 테넌트의 실제 영업 시간대로 오늘 날짜를 읽는다 —
 * Metheim 은 `BILLING_TIMEZONE=Asia/Seoul`, MillionStay 는 미설정(기본 시드니).
 *
 * 기존 consolidatedInvoices.ts 의 헬퍼를 승격한 것 — 동작은 그대로다.
 */
export const BILLING_TZ = process.env.BILLING_TIMEZONE || "Australia/Sydney";

/** 기준 시간대의 오늘 날짜(연·월·일). */
export function todayInBillingTz(): { year: number; month: number; day: number } {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: BILLING_TZ })
    .format(new Date()).split("-").map(Number);
  return { year: y, month: m, day: d };
}

/** 기준 시간대의 오늘 날짜(YYYY-MM-DD). */
export function billingTodayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BILLING_TZ }).format(new Date());
}
