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
};

/**
 * Generate the rent invoice for a given month (defaults to the current month) for
 * every Active lease, then re-flag overdue invoices.
 */
export async function generateLeaseRentInvoices(opts: { year?: number; month?: number; force?: boolean } = {}): Promise<LeaseRentResult> {
  const enabled = opts.force === true || (await isLeaseRentInvoicesEnabled());
  if (!enabled) return { enabled: false, created: 0, overdue: 0, skipped: 0 };

  const now = new Date();
  const year = opts.year ?? now.getUTCFullYear();
  const month = opts.month ?? now.getUTCMonth() + 1;
  const monthStart = `${year}-${pad(month)}-01`;
  const monthEnd = dueDateFor(year, month, 31);

  let created = 0;
  let skipped = 0;

  const leases = await db.select({
    id: contractsTable.id,
    ref: contractsTable.contract_ref,
    account_id: contractsTable.tenant_account_id,
    space_id: contractsTable.space_id,
    monthly_rent: contractsTable.monthly_rent,
    rent_due_day: contractsTable.rent_due_day,
    currency: contractsTable.currency,
    start_date: contractsTable.start_date,
    end_date: contractsTable.end_date,
  })
    .from(contractsTable)
    .where(and(
      isNull(contractsTable.deleted_at),
      eq(contractsTable.status, "Active"),
      sql`${contractsTable.monthly_rent} > 0`,
      or(isNull(contractsTable.start_date), lte(contractsTable.start_date, monthEnd)),
      or(isNull(contractsTable.end_date), gte(contractsTable.end_date, monthStart)),
    ));

  for (const lease of leases) {
    const dueDate = dueDateFor(year, month, lease.rent_due_day ?? 1);

    // Already billed for this month? (covers both migrated and generated refs)
    const [existing] = await db.select({ id: invoicesTable.id })
      .from(invoicesTable)
      .where(and(
        eq(invoicesTable.contract_id, lease.id),
        isNull(invoicesTable.deleted_at),
        gte(invoicesTable.due_date, monthStart),
        lte(invoicesTable.due_date, monthEnd),
      ))
      .limit(1);
    if (existing) { skipped++; continue; }

    let unitName: string | null = null;
    if (lease.space_id) {
      const [space] = await db.select({ name: spacesTable.name }).from(spacesTable)
        .where(eq(spacesTable.id, lease.space_id)).limit(1);
      unitName = space?.name ?? null;
    }

    await db.insert(invoicesTable).values({
      invoice_ref: `RENT-${lease.id}-${year}${pad(month)}`,
      contract_id: lease.id,
      account_id: lease.account_id ?? null,
      amount: String(lease.monthly_rent ?? 0),
      currency: lease.currency || DEFAULT_CURRENCY,
      status: "Sent",
      due_date: dueDate,
      description: `${year}년 ${month}월 월세${unitName ? ` (${unitName})` : ""}`,
    });
    created++;
  }

  // Anything unpaid past its due date is overdue — this is the 미납 signal the
  // dashboard and the contract rent tab surface.
  const today = new Date().toISOString().slice(0, 10);
  const overdueRows = await db.update(invoicesTable)
    .set({ status: "Overdue", updated_at: new Date() })
    .where(and(
      isNull(invoicesTable.deleted_at),
      sql`${invoicesTable.status} in ('Sent','Draft')`,
      sql`${invoicesTable.due_date} < ${today}`,
    ))
    .returning({ id: invoicesTable.id });

  return { enabled: true, created, overdue: overdueRows.length, skipped };
}
