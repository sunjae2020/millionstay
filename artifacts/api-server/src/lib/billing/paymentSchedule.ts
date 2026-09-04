// 계약 결제 일정 — 생성 · 재계산.
//
// contracts 의 낱개 결제 컬럼(계약금·중도금·잔금·보증금·월세)을 payment_schedules
// 행으로 펼치고, 거래(transactions)가 확정/취소될 때마다 회차별 입금액과 상태를
// 다시 계산한다. 회차가 행으로 존재해야 인보이스와 입금이 "몇 회차"를 가리킬 수
// 있다 — 그것이 이 모듈이 있는 이유다.
//
// 금액 컬럼은 numeric → 문자열. 읽을 때 Number(), 쓸 때 String().
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, contractsTable, paymentSchedulesTable, transactionsTable } from "@workspace/db";
import { DEFAULT_CURRENCY } from "../currency";

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** 안전한 YYYY-MM-DD 조립 — 그 달에 없는 날(2월 31일)은 말일로 접는다. */
function ymd(year: number, monthIdx0: number, day: number): string {
  const last = new Date(Date.UTC(year, monthIdx0 + 1, 0)).getUTCDate();
  const d = Math.min(Math.max(day, 1), last);
  return `${year}-${String(monthIdx0 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseYmd(value: string | null | undefined): { y: number; m: number; d: number } | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) };
}

export type ScheduleDraft = {
  kind: string;
  seq: number;
  period: string | null;
  period_start: string | null;
  period_end: string | null;
  due_date: string | null;
  amount: number;
};

/** 월세 회차를 무한히 만들지 않기 위한 상한(장기 계약 + 잘못된 종료일 방어). */
const MAX_RENT_PERIODS = 120;

/**
 * 계약 한 건의 결제 일정 초안을 만든다(DB 를 건드리지 않는 순수 함수).
 *
 * 일시금(보증금·계약금·중도금·잔금·선급금)은 금액이 0이거나 비어 있으면 아예
 * 만들지 않는다 — 0원짜리 회차는 미납 목록만 더럽힌다.
 */
export function buildScheduleDrafts(contract: typeof contractsTable.$inferSelect): ScheduleDraft[] {
  const drafts: ScheduleDraft[] = [];
  const start = parseYmd(contract.start_date);
  const end = parseYmd(contract.end_date);

  const oneOff = (kind: string, seq: number, amount: unknown, date: string | null | undefined) => {
    const n = Number(amount ?? 0);
    if (!Number.isFinite(n) || n <= 0) return;
    drafts.push({
      kind, seq, period: null, period_start: null, period_end: null,
      due_date: (date ?? contract.start_date ?? null)?.slice(0, 10) ?? null,
      amount: round2(n),
    });
  };

  oneOff("deposit", 0, contract.bond_amount, contract.down_payment_date ?? contract.start_date);
  oneOff("down_payment", 1, contract.down_payment, contract.down_payment_date);
  oneOff("interim_payment", 2, contract.interim_payment, contract.interim_payment_date);
  oneOff("balance", 3, contract.balance_amount, contract.balance_date);
  // 단기 요금형의 선급금. 장기 계약에는 보통 비어 있다.
  oneOff("advance", 4, contract.advance_amount, contract.start_date);

  // 월세 회차. 시작·종료일과 월세 금액이 모두 있어야 만든다. 납기일은
  // rent_due_day(없으면 시작일의 일자)를 그 달에 맞춰 접는다.
  const rent = Number(contract.monthly_rent ?? 0);
  if (rent > 0 && start && end) {
    const dueDay = contract.rent_due_day && contract.rent_due_day > 0 ? contract.rent_due_day : start.d;
    let y = start.y;
    let m = start.m;
    let seq = 10;
    for (let i = 0; i < MAX_RENT_PERIODS; i++) {
      // 종료월을 넘어서면 멈춘다(종료월 자체는 포함).
      if (y > end.y || (y === end.y && m > end.m)) break;
      const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      const periodStart = i === 0 ? contract.start_date!.slice(0, 10) : ymd(y, m, 1);
      const isLast = y === end.y && m === end.m;
      const periodEnd = isLast ? contract.end_date!.slice(0, 10) : ymd(y, m, lastDay);
      // 납기일이 그 회차 구간을 넘어가면 구간 마지막 날로 당긴다. 마지막 달이
      // 중간에 끝나는 계약(8/14 종료 + 25일 납기)에서 계약이 끝난 뒤 날짜가
      // 납기로 찍히는 것을 막는다.
      const due = ymd(y, m, dueDay);
      drafts.push({
        kind: "rent",
        seq: seq++,
        period: `${y}-${String(m + 1).padStart(2, "0")}`,
        period_start: periodStart,
        period_end: periodEnd,
        due_date: due > periodEnd ? periodEnd : due,
        amount: round2(rent),
      });
      m += 1;
      if (m > 11) { m = 0; y += 1; }
    }
  }

  return drafts;
}

export type GenerateResult = { created: number; skipped: number; total: number };

/**
 * 계약의 결제 일정을 생성한다(멱등).
 *
 * 이미 있는 회차는 **절대 덮어쓰지 않는다** — 청구서가 붙었거나 입금이 잡힌
 * 회차를 재생성이 날려버리면 그게 가장 큰 사고다. 같은 (kind, period) 가 이미
 * 있으면 건너뛰고, 없는 회차만 채운다. `replace: true` 를 주면 손대지 않은
 * 회차(청구·입금·수동 추가가 없는 auto 행)만 지우고 다시 만든다.
 */
export async function generateContractSchedule(
  contractId: number,
  opts: { replace?: boolean } = {},
): Promise<GenerateResult> {
  const [contract] = await db.select().from(contractsTable).where(eq(contractsTable.id, contractId)).limit(1);
  if (!contract) return { created: 0, skipped: 0, total: 0 };

  if (opts.replace) {
    // 청구서도 입금도 없는 자동 생성 행만 정리한다.
    await db.delete(paymentSchedulesTable).where(and(
      eq(paymentSchedulesTable.contract_id, contractId),
      eq(paymentSchedulesTable.source, "auto"),
      isNull(paymentSchedulesTable.invoice_id),
      sql`${paymentSchedulesTable.paid_amount} = 0`,
      sql`${paymentSchedulesTable.status} <> 'waived'`,
    ));
  }

  const existing = await db.select({
    kind: paymentSchedulesTable.kind,
    period: paymentSchedulesTable.period,
  }).from(paymentSchedulesTable).where(and(
    eq(paymentSchedulesTable.contract_id, contractId),
    isNull(paymentSchedulesTable.deleted_at),
  ));
  const seen = new Set(existing.map((r) => `${r.kind}|${r.period ?? ""}`));

  const drafts = buildScheduleDrafts(contract);
  const currency = contract.currency || DEFAULT_CURRENCY;
  const rows = drafts.filter((d) => !seen.has(`${d.kind}|${d.period ?? ""}`));

  if (rows.length > 0) {
    await db.insert(paymentSchedulesTable).values(rows.map((d) => ({
      contract_id: contractId,
      kind: d.kind,
      seq: d.seq,
      period: d.period,
      period_start: d.period_start,
      period_end: d.period_end,
      due_date: d.due_date,
      amount: String(d.amount),
      currency,
      source: "auto",
    }))).onConflictDoNothing();
  }

  return { created: rows.length, skipped: drafts.length - rows.length, total: drafts.length };
}

/**
 * 회차별 입금액과 상태를 거래 원장에서 다시 계산한다(정본 = transactions 합계).
 *
 * 수입(income)은 더하고 지출(expense, 환불)은 뺀다. draft/void 거래와 삭제된
 * 거래는 세지 않는다 — "입력만 해둔 건"이 완납으로 보이면 미납 관리가 무너진다.
 */
export async function recalcSchedulePaid(scheduleIds: number[]): Promise<void> {
  const ids = [...new Set(scheduleIds.filter((n) => Number.isFinite(n) && n > 0))];
  if (ids.length === 0) return;

  const sums = await db.select({
    schedule_id: transactionsTable.payment_schedule_id,
    paid: sql<string>`COALESCE(SUM(CASE WHEN ${transactionsTable.txn_type} = 'expense' THEN -${transactionsTable.amount} ELSE ${transactionsTable.amount} END), 0)`,
    last_at: sql<string | null>`MAX(${transactionsTable.txn_date})`,
  })
    .from(transactionsTable)
    .where(and(
      inArray(transactionsTable.payment_schedule_id, ids),
      isNull(transactionsTable.deleted_at),
      inArray(transactionsTable.status, ["confirmed", "posted"]),
    ))
    .groupBy(transactionsTable.payment_schedule_id);

  const paidById = new Map<number, { paid: number; last: string | null }>();
  for (const s of sums) {
    if (s.schedule_id == null) continue;
    paidById.set(s.schedule_id, { paid: round2(Number(s.paid ?? 0)), last: s.last_at ?? null });
  }

  const rows = await db.select().from(paymentSchedulesTable).where(inArray(paymentSchedulesTable.id, ids));
  for (const row of rows) {
    const hit = paidById.get(row.id) ?? { paid: 0, last: null };
    const amount = Number(row.amount ?? 0);
    // 면제(waived)는 사람이 지정한 상태다 — 입금 재계산이 덮어쓰지 않는다.
    const status = row.status === "waived"
      ? "waived"
      : hit.paid >= amount && amount > 0
        ? "paid"
        : hit.paid > 0
          ? "partial"
          : row.invoice_id
            ? "invoiced"
            : "pending";
    await db.update(paymentSchedulesTable).set({
      paid_amount: String(hit.paid),
      paid_at: status === "paid" && hit.last ? new Date(`${hit.last}T00:00:00Z`) : null,
      status,
      updated_at: new Date(),
    }).where(eq(paymentSchedulesTable.id, row.id));
  }
}

/** 인보이스가 붙거나 떨어질 때 그 회차의 상태만 다시 맞춘다. */
export async function recalcScheduleForInvoice(invoiceId: number): Promise<void> {
  const rows = await db.select({ id: paymentSchedulesTable.id })
    .from(paymentSchedulesTable)
    .where(eq(paymentSchedulesTable.invoice_id, invoiceId));
  await recalcSchedulePaid(rows.map((r) => r.id));
}
