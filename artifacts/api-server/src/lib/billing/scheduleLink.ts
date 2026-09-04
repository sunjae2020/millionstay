// 청구서 ↔ 결제 일정 ↔ 거래 원장을 잇는 배선.
//
// 세 표는 같은 사건의 세 얼굴이다. 결제 일정은 "받기로 한 것", 청구서는 "청구한
// 것", 거래는 "실제로 움직인 돈". 사람이 세 번 입력하게 두면 반드시 어긋나므로
// 여기서 자동으로 잇는다.
//
// 두 방향이 있다.
//   1) 청구서를 만들 때  → 그 달의 회차를 찾아 invoice_id 를 박는다("청구했다")
//   2) 청구서를 수납할 때 → 거래를 만들어 회차에 붙인다("들어왔다")
//
// ⚠️ 수납이 만드는 거래는 **분개를 새로 올리지 않는다.** 인보이스 수납 경로가
// 이미 postInvoicePaid 로 Dr 현금 / Cr 미수금 을 전기했기 때문에, 거래가 또
// 전기하면 같은 돈이 두 번 기록된다. 그래서 이미 올라간 분개의 id 를 그대로
// 물려주고 status='posted' 로 둔다 — 화면에서도 "전기됨"으로 보이고 다시 전기
// 버튼이 뜨지 않는다.
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import {
  db, invoicesTable, journalEntriesTable, paymentSchedulesTable, transactionsTable,
} from "@workspace/db";
import { recalcSchedulePaid } from "./paymentSchedule";

/** "YYYY-MM" — 청구 대상 월. billing_period 가 없으면 납기일에서 뽑는다. */
function periodOf(inv: { billing_period?: string | null; due_date?: string | null }): string | null {
  if (inv.billing_period) return inv.billing_period.slice(0, 7);
  if (inv.due_date) return inv.due_date.slice(0, 7);
  return null;
}

/**
 * 청구서에 대응하는 AR 회차를 찾는다.
 *
 * 월세는 (계약, 대상월)이 유일하므로 그걸로 맞춘다. 대상월이 없으면 금액이 같고
 * 아직 청구서가 안 붙은 회차 중 납기가 가장 이른 것을 고른다 — 대개 오래된
 * 미납부터 청구하기 때문이다. 확실하지 않으면 **아무것도 고르지 않는다**:
 * 엉뚱한 회차에 붙는 것이 안 붙는 것보다 훨씬 나쁘다(정산이 조용히 틀어진다).
 */
export async function findScheduleForInvoice(invoiceId: number): Promise<number | null> {
  try {
    const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, invoiceId)).limit(1);
    if (!inv?.contract_id) return null;

    // 이미 이 청구서를 가리키는 회차가 있으면 그것이 답이다.
    const [already] = await db.select({ id: paymentSchedulesTable.id })
      .from(paymentSchedulesTable)
      .where(and(eq(paymentSchedulesTable.invoice_id, invoiceId), isNull(paymentSchedulesTable.deleted_at)))
      .limit(1);
    if (already) return already.id;

    const period = periodOf(inv);
    const base = [
      eq(paymentSchedulesTable.contract_id, inv.contract_id),
      eq(paymentSchedulesTable.direction, "ar"),
      isNull(paymentSchedulesTable.deleted_at),
      isNull(paymentSchedulesTable.invoice_id),
      sql`${paymentSchedulesTable.status} NOT IN ('paid', 'waived')`,
    ];

    if (period) {
      const [byPeriod] = await db.select({ id: paymentSchedulesTable.id })
        .from(paymentSchedulesTable)
        .where(and(...base, eq(paymentSchedulesTable.kind, "rent"), eq(paymentSchedulesTable.period, period)))
        .limit(1);
      if (byPeriod) return byPeriod.id;
    }

    const amount = Number(inv.amount ?? 0);
    if (amount > 0) {
      const [byAmount] = await db.select({ id: paymentSchedulesTable.id })
        .from(paymentSchedulesTable)
        .where(and(...base, sql`${paymentSchedulesTable.amount} = ${String(amount)}`))
        .orderBy(asc(paymentSchedulesTable.due_date))
        .limit(2);
      // 후보가 둘 이상이면 고르지 않는다 — 찍어서 맞히는 것은 배선이 아니다.
      if (byAmount) {
        const dupes = await db.select({ id: paymentSchedulesTable.id })
          .from(paymentSchedulesTable)
          .where(and(...base, sql`${paymentSchedulesTable.amount} = ${String(amount)}`))
          .limit(2);
        if (dupes.length === 1) return byAmount.id;
      }
    }
    return null;
  } catch (err) {
    console.error("[findScheduleForInvoice]", err);
    return null;
  }
}

/** 회차에 청구서를 박는다("청구했다"). 이미 다른 청구서가 붙어 있으면 건드리지 않는다. */
export async function linkInvoiceToSchedule(invoiceId: number): Promise<number | null> {
  const scheduleId = await findScheduleForInvoice(invoiceId);
  if (!scheduleId) return null;
  try {
    await db.update(paymentSchedulesTable)
      .set({ invoice_id: invoiceId, updated_at: new Date() })
      .where(and(eq(paymentSchedulesTable.id, scheduleId), isNull(paymentSchedulesTable.invoice_id)));
    await recalcSchedulePaid([scheduleId]);
    return scheduleId;
  } catch (err) {
    console.error("[linkInvoiceToSchedule]", err);
    return null;
  }
}

async function nextTxnRef(): Promise<string> {
  const year = new Date().getFullYear();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(transactionsTable)
    .where(sql`${transactionsTable.txn_ref} LIKE ${`TXN-${year}-%`}`);
  return `TXN-${year}-${String((row?.n ?? 0) + 1).padStart(5, "0")}`;
}

/**
 * 청구서 수납을 거래 원장에 남긴다("들어왔다").
 *
 * 멱등하다 — 같은 청구서로 두 번 수납 처리돼도 거래는 하나다. 분개는 새로 올리지
 * 않고 인보이스 수납 분개(`invoice_paid:<id>`)를 물려받는다(파일 상단 참고).
 * 전부 best-effort: 여기서 실패해도 수납은 이미 끝났고 되돌리면 안 된다.
 */
export async function recordInvoicePaymentTransaction(args: {
  invoiceId: number;
  amount: number;
  currency: string;
  paidAt: Date;
  paymentMethod?: string | null;
}): Promise<number | null> {
  try {
    const [dupe] = await db.select({ id: transactionsTable.id })
      .from(transactionsTable)
      .where(and(
        eq(transactionsTable.invoice_id, args.invoiceId),
        eq(transactionsTable.txn_type, "income"),
        isNull(transactionsTable.deleted_at),
        sql`${transactionsTable.status} <> 'void'`,
      ))
      .limit(1);
    if (dupe) return dupe.id;

    const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, args.invoiceId)).limit(1);
    if (!inv) return null;

    const scheduleId = await linkInvoiceToSchedule(args.invoiceId);

    // 이미 올라간 수납 분개를 물려받는다(이중 전기 방지).
    const [entry] = await db.select({ id: journalEntriesTable.id })
      .from(journalEntriesTable)
      .where(eq(journalEntriesTable.posting_key, `invoice_paid:${args.invoiceId}`))
      .limit(1);

    const [row] = await db.insert(transactionsTable).values({
      txn_ref: await nextTxnRef(),
      txn_type: "income",
      txn_date: args.paidAt.toISOString().slice(0, 10),
      amount: String(args.amount),
      currency: args.currency,
      tax_amount: String(Number(inv.tax_amount ?? 0)),
      contract_id: inv.contract_id,
      invoice_id: args.invoiceId,
      payment_schedule_id: scheduleId,
      account_id: inv.account_id,
      payment_info_id: inv.payment_info_id,
      payment_method: args.paymentMethod ?? null,
      description: inv.description ?? `${inv.invoice_ref} 수납`,
      // 분개가 이미 있으면 전기 완료로 둔다 — 없으면(전기 실패 등) 확정 상태로
      // 남겨 사람이 나중에 전기할 수 있게 한다.
      status: entry ? "posted" : "confirmed",
      journal_entry_id: entry?.id ?? null,
      posted_at: entry ? new Date() : null,
      confirmed_at: new Date(),
    }).returning();

    if (scheduleId) await recalcSchedulePaid([scheduleId]);
    return row?.id ?? null;
  } catch (err) {
    console.error("[recordInvoicePaymentTransaction]", err);
    return null;
  }
}
