import { and, eq } from "drizzle-orm";
import { db, accountingPeriodsTable, type PeriodStatus } from "@workspace/db";

// 회계기간 마감 가드 — FIN-001 제6·7조.
//
// 규정의 표를 그대로 옮기면 이렇다.
//
//   해당 월 마감 전                     허용   기안자
//   마감 후 ~ 부가세 신고 전            조건부 경영지원 책임자(마감 해제 후)
//   부가세 신고 완료 · 결산 확정 후     금지   —
//
// 여기서 막는 것은 **마감된 기간에 새 사실을 심는 것**이지 소급 입력 자체가
// 아니다. 발생주의에서 비용은 지출일에 귀속되므로, 열린 기간이면 몇 달 전
// 날짜로 입력하는 것이 정상이다.

export type PeriodCheck =
  | { ok: true; status: PeriodStatus }
  | { ok: false; status: Exclude<PeriodStatus, "open">; year: number; month: number };

/** "YYYY-MM-DD" 에서 연·월을 뽑는다. 형식이 어긋나면 null. */
export function yearMonthOf(isoDate: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})/.exec(isoDate);
  if (!m) return null;
  return { year: Number(m[1]), month: Number(m[2]) };
}

/**
 * 행이 없는 달은 open 이다 — 마감은 명시적 행위이지 기본값이 아니다. 그래야 이
 * 기능을 켜기 전에 쌓인 거래가 소급해서 막히지 않는다.
 */
export async function periodStatus(year: number, month: number): Promise<PeriodStatus> {
  const [row] = await db
    .select({ status: accountingPeriodsTable.status })
    .from(accountingPeriodsTable)
    .where(and(eq(accountingPeriodsTable.year, year), eq(accountingPeriodsTable.month, month)))
    .limit(1);
  return (row?.status as PeriodStatus | undefined) ?? "open";
}

/** 이 날짜로 거래를 만들거나 고칠 수 있는가. */
export async function checkPeriodOpen(isoDate: string | null | undefined): Promise<PeriodCheck> {
  if (!isoDate) return { ok: true, status: "open" };
  const ym = yearMonthOf(isoDate);
  if (!ym) return { ok: true, status: "open" };
  const status = await periodStatus(ym.year, ym.month);
  if (status === "open") return { ok: true, status };
  return { ok: false, status, year: ym.year, month: ym.month };
}

/** 라우트에서 그대로 쓸 수 있는 한국어 사유. */
export function periodBlockMessage(check: Extract<PeriodCheck, { ok: false }>): string {
  const ym = `${check.year}년 ${check.month}월`;
  return check.status === "locked"
    ? `${ym}은 부가세 신고·결산이 확정되어 수정할 수 없습니다. 당월 비용으로 처리하세요.`
    : `${ym}은 마감되었습니다. 경영지원의 마감 해제 후 입력할 수 있습니다.`;
}

/**
 * 거래 한 건이 기간 제약에 걸리는지 확인하고, 걸리면 응답까지 끝낸다.
 * 라우트에서 `if (await guardPeriod(res, date)) return;` 로 쓴다.
 */
export async function guardPeriod(
  res: { status: (n: number) => { json: (b: unknown) => void } },
  ...dates: (string | null | undefined)[]
): Promise<boolean> {
  for (const d of dates) {
    const check = await checkPeriodOpen(d);
    if (!check.ok) {
      res.status(409).json({ error: periodBlockMessage(check), period: { year: check.year, month: check.month, status: check.status } });
      return true;
    }
  }
  return false;
}
