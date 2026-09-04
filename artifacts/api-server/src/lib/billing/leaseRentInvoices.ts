// Lease rent automation for Korean-style monthly leases (계약 기반 월세 청구).
//
// The recurring_schedule table requires a booking; Korean lease contracts are
// booked straight onto `contracts` (월세 + 월세 납입일), so this generator runs off
// the contract itself:
//
//   1. For every Active contract with monthly_rent and rent_due_day, make sure the
//      current month's rent invoice exists (one per contract per month).
//   2. Flag any unpaid invoice whose due date has passed as Overdue, which is what
//      the 미납 dashboard and the contract's 월세 입금 tab read.
//
// Idempotent: an invoice is only created when no invoice for that contract already
// falls due in that month, so re-running (or a restart) never double-bills.
// Best-effort — never throws to the caller.
import { and, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { db, contractsTable, invoicesTable, spacesTable, integrationSettings } from "@workspace/db";
import { DEFAULT_CURRENCY } from "../currency";
import { linkInvoiceToSchedule } from "./scheduleLink";
import { consolidatedAccountIds } from "./consolidatedInvoices";
import { billingTodayIso, todayInBillingTz } from "./billingDate";

/** Settings key (also an integrations ALLOWED_KEY) toggling this cron. */
export const LEASE_RENT_INVOICES_ENABLED_KEY = "LEASE_RENT_INVOICES_ENABLED";

export async function isLeaseRentInvoicesEnabled(): Promise<boolean> {
  const env = process.env[LEASE_RENT_INVOICES_ENABLED_KEY];
  if (env === "true") return true;
  if (env === "false") return false;
  try {
    const [row] = await db.select().from(integrationSettings)
      .where(eq(integrationSettings.key, LEASE_RENT_INVOICES_ENABLED_KEY)).limit(1);
    return row?.value === "true";
  } catch {
    return false;
  }
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Clamp a due day to the month's length (31일 납입 → 2월은 말일). */
function dueDateFor(year: number, month: number, day: number): string {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad(month)}-${pad(Math.min(Math.max(day, 1), last))}`;
}

export type LeaseRentResult = {
  enabled: boolean;
  created: number;
  overdue: number;
  skipped: number;
  /**
   * "이미 청구됨" 가드에 걸려 건너뛰었지만, 막은 인보이스가 월세처럼 보이지 않는 건
   * (보증금·청소비 등). 0 이 아니면 그 달 월세가 조용히 빠졌을 수 있다 — WARN 로그의
   * 계약·인보이스를 확인해야 한다.
   */
  suspiciousSkips: number;
};

/**
 * Generate the rent invoice for a given month (defaults to the current month) for
 * every Active lease, then re-flag overdue invoices.
 */
export async function generateLeaseRentInvoices(opts: { year?: number; month?: number; force?: boolean } = {}): Promise<LeaseRentResult> {
  const enabled = opts.force === true || (await isLeaseRentInvoicesEnabled());
  if (!enabled) return { enabled: false, created: 0, overdue: 0, skipped: 0, suspiciousSkips: 0 };

  // 기준 시간대(BILLING_TIMEZONE, 기본 시드니)의 오늘로 대상 월을 잡는다. UTC 로 읽으면
  // 시드니 새벽 크론이 매월 1일에 아직 지난달을 보고 새 달 월세를 하루 늦게 만든다.
  const today = todayInBillingTz();
  const year = opts.year ?? today.year;
  const month = opts.month ?? today.month;
  const monthStart = `${year}-${pad(month)}-01`;
  const monthEnd = dueDateFor(year, month, 31);

  let created = 0;
  let skipped = 0;
  let suspiciousSkips = 0;

  const leases = await db.select({
    id: contractsTable.id,
    ref: contractsTable.contract_ref,
    account_id: contractsTable.tenant_account_id,
    space_id: contractsTable.space_id,
    monthly_rent: contractsTable.monthly_rent,
    actual_monthly_rent: contractsTable.actual_monthly_rent,
    rent_due_day: contractsTable.rent_due_day,
    currency: contractsTable.currency,
    start_date: contractsTable.start_date,
    end_date: contractsTable.end_date,
  })
    .from(contractsTable)
    .where(and(
      isNull(contractsTable.deleted_at),
      eq(contractsTable.status, "Active"),
      sql`coalesce(${contractsTable.actual_monthly_rent}, ${contractsTable.monthly_rent}) > 0`,
      or(isNull(contractsTable.start_date), lte(contractsTable.start_date, monthEnd)),
      or(isNull(contractsTable.end_date), gte(contractsTable.end_date, monthStart)),
    ));

  // 통합 청구 계정의 계약은 통합 청구서 생성기가 (일할 이월분까지 함께) 만든다.
  // 여기서 먼저 만들어버리면 청구 기준일·이월 계산이 어긋나므로 건너뛴다.
  const consolidated = await consolidatedAccountIds();

  for (const lease of leases) {
    if (lease.account_id && consolidated.has(lease.account_id)) { skipped++; continue; }
    const dueDate = dueDateFor(year, month, lease.rent_due_day ?? 1);

    // The month may only partially overlap the lease (a lease ending 2026-08-05
    // with rent due on the 6th owes nothing for August). Bill only when the due
    // date itself falls inside the tenancy.
    if (lease.start_date && dueDate < lease.start_date) { skipped++; continue; }
    if (lease.end_date && dueDate > lease.end_date) { skipped++; continue; }

    // Already billed for this month? (covers both migrated and generated refs)
    //
    // ⚠️ This guard is deliberately BROAD — any invoice due in the month blocks the
    // rent invoice, even a deposit or cleaning bill. Narrowing it would double-bill
    // migrated data, so we DON'T. Instead, when the blocking invoice doesn't look
    // like rent, we log a WARN and count it so ops can spot silently skipped rent.
    const [existing] = await db.select({
      id: invoicesTable.id,
      ref: invoicesTable.invoice_ref,
      kind: invoicesTable.invoice_kind,
      description: invoicesTable.description,
    })
      .from(invoicesTable)
      .where(and(
        eq(invoicesTable.contract_id, lease.id),
        isNull(invoicesTable.deleted_at),
        gte(invoicesTable.due_date, monthStart),
        lte(invoicesTable.due_date, monthEnd),
      ))
      .limit(1);
    if (existing) {
      const ref = existing.ref ?? "";
      const desc = existing.description ?? "";
      const looksLikeRent =
        ref.startsWith("RENT-") ||           // this generator / consolidated child
        ref.startsWith("CINV-") ||           // consolidated parent
        existing.kind === "consolidated" ||
        desc.includes("월세") ||
        desc.includes("임대료") ||
        /rent/i.test(desc);
      if (!looksLikeRent) {
        suspiciousSkips++;
        console.warn(
          `[leaseRent] contract #${lease.id} (${lease.ref}): skipping ${year}-${pad(month)} rent — `
          + `blocked by non-rent-looking invoice ${ref || `#${existing.id}`} ("${desc}"). `
          + `Rent for this month may never be billed; verify and bill manually if needed.`,
        );
      }
      skipped++;
      continue;
    }

    let unitName: string | null = null;
    if (lease.space_id) {
      const [space] = await db.select({ name: spacesTable.name }).from(spacesTable)
        .where(eq(spacesTable.id, lease.space_id)).limit(1);
      unitName = space?.name ?? null;
    }

    const [rentInvoice] = await db.insert(invoicesTable).values({
      invoice_ref: `RENT-${lease.id}-${year}${pad(month)}`,
      contract_id: lease.id,
      account_id: lease.account_id ?? null,
      // 실 차임(월세)이 입력돼 있으면 그 금액으로, 없으면 계약서상의 차임으로 청구한다.
      amount: String(lease.actual_monthly_rent ?? lease.monthly_rent ?? 0),
      currency: lease.currency || DEFAULT_CURRENCY,
      status: "Sent",
      due_date: dueDate,
      description: `${year}년 ${month}월 월세${unitName ? ` (${unitName})` : ""}`,
      // 대상 월을 남겨야 결제 일정의 그 달 회차와 맞출 수 있다.
      billing_period: `${year}-${pad(month)}`,
    }).returning();
    // 생성한 청구서를 그 달의 회차에 박는다("청구했다"). 회차가 아직 없으면
    // (계약에서 일정을 안 뽑았으면) 조용히 지나간다 — 청구 자체는 이미 끝났다.
    if (rentInvoice) void linkInvoiceToSchedule(rentInvoice.id);
    created++;
  }

  // Anything unpaid past its due date is overdue — this is the 미납 signal the
  // dashboard and the contract rent tab surface. Cutoff uses the billing timezone,
  // not UTC — otherwise flagging lags a day for tenants east of UTC.
  const todayIso = billingTodayIso();
  const overdueRows = await db.update(invoicesTable)
    .set({ status: "Overdue", updated_at: new Date() })
    .where(and(
      isNull(invoicesTable.deleted_at),
      sql`${invoicesTable.status} in ('Sent','Draft')`,
      sql`${invoicesTable.due_date} < ${todayIso}`,
    ))
    .returning({ id: invoicesTable.id });

  return { enabled: true, created, overdue: overdueRows.length, skipped, suspiciousSkips };
}
