// 통합(단체) 청구 — 여러 공간을 임차한 법인 세입자용 월 1회 합산 청구서.
//
// 재원산업처럼 한 계정(accounts)이 여러 호실을 임차하는 경우, 호실마다 인보이스를
// 따로 받는 대신 매월 지정한 날짜에 그 계정의 모든 공간 임대료를 한 장으로 묶어
// 청구하고 한 번에 납부한다.
//
// 데이터 모델 — 부모 1 + 자식 N
//   자식(공간별 인보이스)  invoice_kind='standard', contract_id 있음
//     · 계약 단위이므로 GL 전기와 파트너·집주인 정산(payout)의 정본이다.
//     · 통합 청구서에 묶이면 parent_invoice_id 가 채워지고 개별 납부 대상에서 빠진다.
//   부모(통합 청구서)      invoice_kind='consolidated', contract_id 없음
//     · 세입자가 실제로 납부하는 문서. 금액 = 자식 합계.
//     · 매출·미수 집계에서는 반드시 제외한다(자식과 이중 계상). excludeConsolidated() 참고.
//
// 일할계산(프로라타) 이월
//   지난달 중간에 입주한 계약은 지난달 임대료가 아직 청구된 적이 없다. 이번 달
//   통합 청구서에 "지난달 일할분 + 이번 달 전액"을 함께 실어 청구하고, 해당 줄에
//   어느 호실의 어느 기간분인지 메모를 남긴다.
//   예) 월세 30만 · 지난달 15일 거주 → 지난달 15만 + 이번 달 30만 = 45만
//
// 멱등(idempotent) — 같은 (계정, 월)로 다시 돌려도 기존 청구서를 다시 계산해 덮어쓸
// 뿐 중복 발행하지 않는다. 최선노력(best-effort): 한 계정이 실패해도 나머지는 계속한다.
import { and, eq, gte, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import {
  db,
  accountsTable,
  contractsTable,
  invoicesTable,
  invoiceLineItemsTable,
  spacesTable,
} from "@workspace/db";
import { DEFAULT_CURRENCY } from "../currency";

const pad = (n: number) => String(n).padStart(2, "0");
const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const round2 = (n: number) => Math.round(n * 100) / 100;

/** 청구 기준일을 그 달의 마지막 날로 클램프한다(31일 기준 → 2월은 말일). */
function dayOfMonth(year: number, month: number, day: number): string {
  const last = daysInMonth(year, month);
  return `${year}-${pad(month)}-${pad(Math.min(Math.max(day, 1), last))}`;
}

/**
 * 일할계산 금액의 절사 규칙.
 * 소수점 없는 통화(KRW·JPY)는 기존 임대료 납입 청구서 양식과 같이 1,000단위 절사한다
 * (월세 350,000 · 7일/31일 → 79,032 → ₩79,000). 그 외 통화는 소수 2자리 반올림.
 */
export function roundProrata(amount: number, currency: string): number {
  if (currency === "KRW" || currency === "JPY") return Math.floor(amount / 1000) * 1000;
  return round2(amount);
}

/** invoices 집계에서 통합 청구서(부모)를 빼는 조건 — 자식과 이중 계상 방지. */
export function excludeConsolidated() {
  return ne(invoicesTable.invoice_kind, "consolidated");
}

type LineDraft = {
  label: string;
  description: string | null;
  space_id: number | null;
  contract_id: number;
  period_start: string;
  period_end: string;
  amount: number;
};

export type ConsolidatedResult = {
  accounts: number;
  invoices: number;
  children: number;
  prorated: number;
  skipped: number;
};

/**
 * 대상 월(기본: 이번 달)의 통합 청구서를 생성/갱신한다.
 * `accountId`를 주면 그 계정만(관리자 화면의 "이번 달 생성" 버튼) 처리한다.
 */
export async function generateConsolidatedInvoices(
  opts: { year?: number; month?: number; accountId?: number } = {},
): Promise<ConsolidatedResult> {
  const now = new Date();
  const year = opts.year ?? now.getUTCFullYear();
  const month = opts.month ?? now.getUTCMonth() + 1;

  const conditions = [
    isNull(accountsTable.deleted_at),
    eq(accountsTable.consolidated_billing_enabled, true),
  ];
  if (opts.accountId) conditions.push(eq(accountsTable.id, opts.accountId));
  const accounts = await db.select().from(accountsTable).where(and(...conditions));

  const result: ConsolidatedResult = { accounts: 0, invoices: 0, children: 0, prorated: 0, skipped: 0 };
  for (const account of accounts) {
    try {
      const one = await generateForAccount(account, year, month);
      result.accounts++;
      if (one.created) result.invoices++;
      result.children += one.children;
      result.prorated += one.prorated;
      result.skipped += one.skipped;
    } catch (err) {
      result.skipped++;
      console.error(`[consolidated] account #${account.id} failed`, err);
    }
  }
  return result;
}

async function generateForAccount(
  account: typeof accountsTable.$inferSelect,
  year: number,
  month: number,
): Promise<{ created: boolean; children: number; prorated: number; skipped: number }> {
  const period = `${year}-${pad(month)}`;
  const monthStart = `${year}-${pad(month)}-01`;
  const monthEnd = dayOfMonth(year, month, 31);
  const dueDate = dayOfMonth(year, month, account.consolidated_billing_day ?? 1);

  // 지난달 — 중간 입주분 이월 계산용
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevStart = `${prevYear}-${pad(prevMonth)}-01`;
  const prevEnd = dayOfMonth(prevYear, prevMonth, 31);
  const prevDays = daysInMonth(prevYear, prevMonth);

  const leases = await db.select().from(contractsTable).where(and(
    isNull(contractsTable.deleted_at),
    eq(contractsTable.tenant_account_id, account.id),
    eq(contractsTable.status, "Active"),
    sql`${contractsTable.monthly_rent} > 0`,
    or(isNull(contractsTable.start_date), lte(contractsTable.start_date, monthEnd)),
    or(isNull(contractsTable.end_date), gte(contractsTable.end_date, monthStart)),
  ));
  if (leases.length === 0) return { created: false, children: 0, prorated: 0, skipped: 0 };

  // 통합 청구서의 통화는 첫 계약을 따른다. 통화가 다른 계약은 한 장에 섞을 수 없으므로
  // 건너뛰고(각자 공간별 인보이스로 남는다) 결과에 skipped 로 보고한다.
  const currency = leases[0].currency || DEFAULT_CURRENCY;

  const spaceIds = [...new Set(leases.map(l => l.space_id).filter(Boolean))] as number[];
  const spaceNames: Record<number, string> = {};
  if (spaceIds.length > 0) {
    const rows = await db.select({ id: spacesTable.id, name: spacesTable.name })
      .from(spacesTable).where(inArray(spacesTable.id, spaceIds));
    for (const s of rows) spaceNames[s.id] = s.name;
  }

  let children = 0;
  let prorated = 0;
  let skipped = 0;
  const parentLines: LineDraft[] = [];
  const childIds: number[] = [];

  for (const lease of leases) {
    if ((lease.currency || DEFAULT_CURRENCY) !== currency) { skipped++; continue; }

    const rent = Number(lease.monthly_rent ?? 0);
    const unit = lease.space_id ? (spaceNames[lease.space_id] ?? `#${lease.space_id}`) : lease.contract_ref;
    const lines: LineDraft[] = [];

    // ① 지난달 중간 입주분 이월(일할계산). 지난달분이 이미 청구된 계약은 건너뛴다.
    if (account.consolidated_prorate_enabled
      && lease.start_date
      && lease.start_date > prevStart
      && lease.start_date <= prevEnd
      && !(await hasInvoiceInMonth(lease.id, prevStart, prevEnd))) {
      const startDay = Number(lease.start_date.slice(8, 10));
      const usedDays = prevDays - startDay + 1;
      const amount = roundProrata(rent * usedDays / prevDays, currency);
      if (amount > 0) {
        lines.push({
          label: `${unit} — ${prevYear}년 ${prevMonth}월 임대료(일할계산)`,
          description: `이월 청구 · ${lease.start_date} ~ ${prevEnd} · 사용일수 ${usedDays}일 / 전체일수 ${prevDays}일`,
          space_id: lease.space_id ?? null,
          contract_id: lease.id,
          period_start: lease.start_date,
          period_end: prevEnd,
          amount,
        });
        prorated++;
      }
    }

    // ② 이번 달 임대료. 이번 달 중간에 시작하는 계약은 아직 온전한 한 달이 아니므로
    //    이번 달에는 싣지 않고, 다음 달 청구서에 ①의 이월 일할분으로 들어간다.
    const startsThisMonth = !!lease.start_date && lease.start_date > monthStart;
    if (!startsThisMonth && rent > 0) {
      lines.push({
        label: `${unit} — ${year}년 ${month}월 임대료`,
        description: null,
        space_id: lease.space_id ?? null,
        contract_id: lease.id,
        period_start: monthStart,
        period_end: monthEnd,
        amount: round2(rent),
      });
    }

    if (lines.length === 0) { skipped++; continue; }

    const childId = await upsertChildInvoice({
      lease, account, lines, currency, period, dueDate, monthStart, monthEnd, unit,
    });
    childIds.push(childId);
    children++;
    parentLines.push(...lines);
  }

  if (parentLines.length === 0) return { created: false, children: 0, prorated, skipped };

  const total = round2(parentLines.reduce((s, l) => s + l.amount, 0));
  const parentRef = `CINV-${account.id}-${year}${pad(month)}`;
  const description = `${year}년 ${month}월 통합 임대료 청구 (${children}개 공간)`;

  const [existingParent] = await db.select({ id: invoicesTable.id, status: invoicesTable.status })
    .from(invoicesTable).where(eq(invoicesTable.invoice_ref, parentRef)).limit(1);

  let parentId: number;
  let created = false;
  if (existingParent) {
    parentId = existingParent.id;
    // 이미 납부·무효 처리된 청구서는 다시 계산하지 않는다.
    if (["Paid", "Void", "Archived"].includes(existingParent.status)) {
      return { created: false, children, prorated, skipped };
    }
    await db.update(invoicesTable).set({
      amount: String(total), currency, due_date: dueDate, description,
      billing_period: period, invoice_kind: "consolidated", updated_at: new Date(),
    }).where(eq(invoicesTable.id, parentId));
    await db.delete(invoiceLineItemsTable).where(eq(invoiceLineItemsTable.invoice_id, parentId));
  } else {
    const [row] = await db.insert(invoicesTable).values({
      invoice_ref: parentRef,
      account_id: account.id,
      invoice_kind: "consolidated",
      billing_period: period,
      amount: String(total),
      currency,
      status: "Sent",
      due_date: dueDate,
      description,
    }).returning({ id: invoicesTable.id });
    parentId = row.id;
    created = true;
  }
  await insertLines(parentId, parentLines);

  // 자식들을 이 청구서에 묶는다(개별 납부 대상에서 빠지고 포털에서 내역으로 표시).
  if (childIds.length > 0) {
    await db.update(invoicesTable)
      .set({ parent_invoice_id: parentId, updated_at: new Date() })
      .where(inArray(invoicesTable.id, childIds));
  }

  return { created, children, prorated, skipped };
}

/** 해당 계약에 그 달로 납기가 잡힌 인보이스가 이미 있는가(이월 중복 방지). */
async function hasInvoiceInMonth(contractId: number, from: string, to: string): Promise<boolean> {
  const [row] = await db.select({ id: invoicesTable.id }).from(invoicesTable).where(and(
    eq(invoicesTable.contract_id, contractId),
    isNull(invoicesTable.deleted_at),
    gte(invoicesTable.due_date, from),
    lte(invoicesTable.due_date, to),
  )).limit(1);
  return !!row;
}

/**
 * 공간별(계약별) 인보이스를 만들거나 갱신한다. 이미 그 달 인보이스가 있으면
 * (월세 크론이 먼저 만들었거나 이관 데이터) 새로 만들지 않고 그 행을 재사용한다.
 */
async function upsertChildInvoice(args: {
  lease: typeof contractsTable.$inferSelect;
  account: typeof accountsTable.$inferSelect;
  lines: LineDraft[];
  currency: string;
  period: string;
  dueDate: string;
  monthStart: string;
  monthEnd: string;
  unit: string;
}): Promise<number> {
  const { lease, account, lines, currency, period, dueDate, monthStart, monthEnd, unit } = args;
  const total = round2(lines.reduce((s, l) => s + l.amount, 0));
  const [y, m] = period.split("-");
  const description = `${Number(y)}년 ${Number(m)}월 임대료 (${unit})`;
  // 일할 이월분이 실린 달은 그 사실을 인보이스 메모에 남긴다 — 세입자·관리자 양쪽에서
  // "왜 이번 달만 금액이 다른가"를 청구서에서 바로 확인할 수 있어야 한다.
  const carried = lines.filter(l => l.period_start < monthStart);
  const notes = carried.length > 0
    ? carried.map(l => `${l.label}: ${l.description ?? ""}`).join("\n")
    : null;

  const [existing] = await db.select({ id: invoicesTable.id, status: invoicesTable.status })
    .from(invoicesTable).where(and(
      eq(invoicesTable.contract_id, lease.id),
      isNull(invoicesTable.deleted_at),
      gte(invoicesTable.due_date, monthStart),
      lte(invoicesTable.due_date, monthEnd),
    )).limit(1);

  let invoiceId: number;
  if (existing) {
    invoiceId = existing.id;
    if (!["Paid", "Void", "Archived"].includes(existing.status)) {
      await db.update(invoicesTable).set({
        account_id: account.id, amount: String(total), currency, due_date: dueDate,
        description, notes, billing_period: period, updated_at: new Date(),
      }).where(eq(invoicesTable.id, invoiceId));
      await db.delete(invoiceLineItemsTable).where(eq(invoiceLineItemsTable.invoice_id, invoiceId));
      await insertLines(invoiceId, lines);
    }
  } else {
    const [row] = await db.insert(invoicesTable).values({
      invoice_ref: `RENT-${lease.id}-${period.replace("-", "")}`,
      contract_id: lease.id,
      account_id: account.id,
      invoice_kind: "standard",
      billing_period: period,
      amount: String(total),
      currency,
      status: "Sent",
      due_date: dueDate,
      description,
      notes,
    }).returning({ id: invoicesTable.id });
    invoiceId = row.id;
    await insertLines(invoiceId, lines);
  }
  return invoiceId;
}

async function insertLines(invoiceId: number, lines: LineDraft[]): Promise<void> {
  if (lines.length === 0) return;
  await db.insert(invoiceLineItemsTable).values(lines.map((l, idx) => ({
    invoice_id: invoiceId,
    label: l.label,
    description: l.description,
    line_type: "revenue",
    charge_kind: "rent",
    space_id: l.space_id,
    contract_id: l.contract_id,
    period_start: l.period_start,
    period_end: l.period_end,
    quantity: "1",
    unit_amount: String(l.amount),
    total_amount: String(l.amount),
    sort_order: idx,
  })));
}

/** 통합 청구 계정 id 집합 — 월세 크론이 이 계정들을 건너뛰게 하는 데 쓴다. */
export async function consolidatedAccountIds(): Promise<Set<number>> {
  const rows = await db.select({ id: accountsTable.id }).from(accountsTable)
    .where(and(isNull(accountsTable.deleted_at), eq(accountsTable.consolidated_billing_enabled, true)));
  return new Set(rows.map(r => r.id));
}
