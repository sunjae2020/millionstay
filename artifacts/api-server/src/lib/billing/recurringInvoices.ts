// Recurring rent — incremental invoice automation for regular long-term
// contracts. A daily cron calls generateRecurringInvoices(): for each active
// recurring_schedule opted into incremental billing (billing_mode='incremental')
// whose next_due_date is due, it creates ONE "Sent" invoice for that cycle and
// advances next_due_date by the schedule frequency. Legacy schedules (billing_mode
// NULL) are left untouched — their invoices are pre-generated up front at
// activation. Best-effort: never throws to the caller. Mirrors the homestay
// rent automation in lib/homestay/monthlyBilling.ts.
import { and, desc, eq, isNull, like, lte, sql } from "drizzle-orm";
import { DEFAULT_CURRENCY } from "../currency";
import {
  db,
  recurringSchedulesTable,
  invoicesTable,
  contractsTable,
  spacesTable,
  propertiesTable,
  integrationSettings,
} from "@workspace/db";
import { getRateToAud } from "../rateSnapshot.js";

/** Settings key (also an integrations ALLOWED_KEY) toggling the recurring cron. */
export const RECURRING_INVOICES_ENABLED_KEY = "RECURRING_INVOICES_ENABLED";

/**
 * Whether automated recurring invoicing is enabled. App-controlled: a process.env
 * override wins (explicit "true"/"false"), otherwise the integration_settings flag
 * decides (default off). Read fresh each run so a toggle in the admin takes effect
 * on the next cron tick with no redeploy. Mirrors the #49 ops-email pattern.
 */
export async function isRecurringInvoicesEnabled(): Promise<boolean> {
  const env = process.env[RECURRING_INVOICES_ENABLED_KEY];
  if (env === "true") return true;
  if (env === "false") return false;
  try {
    const [row] = await db.select().from(integrationSettings)
      .where(eq(integrationSettings.key, RECURRING_INVOICES_ENABLED_KEY)).limit(1);
    return row?.value === "true";
  } catch {
    return false;
  }
}

/** Today in Sydney (YYYY-MM-DD), matching the cron timezone. */
function sydneyToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(new Date());
}

function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function addMonths(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCMonth(base.getUTCMonth() + n);
  return base.toISOString().slice(0, 10);
}

/** Advance a YYYY-MM-DD date by one cycle of the given frequency. */
function nextCycle(ymd: string, frequency: string): string {
  if (frequency === "Weekly") return addDays(ymd, 7);
  if (frequency === "Biweekly") return addDays(ymd, 14);
  return addMonths(ymd, 1); // Monthly (default)
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function periodLabel(frequency: string, ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (frequency === "Monthly") return `${MONTHS[m - 1]} ${y}`;
  return `${String(d).padStart(2, "0")} ${MONTHS[m - 1]} ${y}`;
}

/** Next invoice ref for the current year (max existing + 1). */
async function nextInvoiceRef(): Promise<string> {
  const year = new Date().getFullYear();
  const [last] = await db.select({ ref: invoicesTable.invoice_ref }).from(invoicesTable)
    .where(like(invoicesTable.invoice_ref, `MS-INV-${year}-%`))
    .orderBy(desc(invoicesTable.id)).limit(1);
  let counter = 0;
  if (last?.ref) {
    const n = parseInt(last.ref.split("-").pop() ?? "0", 10);
    counter = Number.isNaN(n) ? 0 : n;
  }
  return `MS-INV-${year}-${String(counter + 1).padStart(5, "0")}`;
}

export interface RecurringBillingResult { enabled: boolean; scanned: number; created: number; skipped: number; ended: number; errors: number }

export async function generateRecurringInvoices(): Promise<RecurringBillingResult> {
  const today = sydneyToday();
  const result: RecurringBillingResult = { enabled: true, scanned: 0, created: 0, skipped: 0, ended: 0, errors: 0 };

  // App-controlled gate (integration_settings, env override). Off → no-op.
  if (!(await isRecurringInvoicesEnabled())) {
    result.enabled = false;
    return result;
  }

  const due = await db.select().from(recurringSchedulesTable)
    .where(and(
      eq(recurringSchedulesTable.billing_mode, "incremental"),
      eq(recurringSchedulesTable.is_active, true),
      eq(recurringSchedulesTable.approval_status, "Approved"),
      isNull(recurringSchedulesTable.deleted_at),
      lte(recurringSchedulesTable.next_due_date, today),
      sql`${recurringSchedulesTable.amount} > 0`,
    ));
  result.scanned = due.length;

  // Resolve a location label per contract (cached within this run).
  const locationCache = new Map<number, string>();
  async function locationLabel(contractId: number | null): Promise<string> {
    if (!contractId) return "";
    if (locationCache.has(contractId)) return locationCache.get(contractId)!;
    let label = "";
    const [contract] = await db.select({ space_id: contractsTable.space_id }).from(contractsTable).where(eq(contractsTable.id, contractId));
    if (contract?.space_id) {
      const [space] = await db.select().from(spacesTable).where(eq(spacesTable.id, contract.space_id));
      if (space) {
        label = space.name ?? "";
        if (space.property_id) {
          const [prop] = await db.select({ address: propertiesTable.address }).from(propertiesTable).where(eq(propertiesTable.id, space.property_id));
          if (prop?.address) label = `${prop.address}${space.name ? `, ${space.name}` : ""}`;
        }
      }
    }
    locationCache.set(contractId, label);
    return label;
  }

  for (const s of due) {
    try {
      const periodStart = s.next_due_date;
      // Past the term end → stop billing this schedule.
      if (s.end_date && periodStart > s.end_date) {
        await db.update(recurringSchedulesTable).set({ is_active: false, updated_at: new Date() }).where(eq(recurringSchedulesTable.id, s.id));
        result.ended++;
        continue;
      }

      const freq = s.frequency || "Monthly";
      const nextDate = nextCycle(periodStart, freq);
      const loc = await locationLabel(s.contract_id);
      const description = `${s.schedule_type} — ${periodLabel(freq, periodStart)}${loc ? ` | ${loc}` : ""}`;

      // Idempotent: skip the insert if an invoice for this contract+period+desc exists.
      const dupConds = [
        eq(invoicesTable.due_date, periodStart),
        eq(invoicesTable.description, description),
      ];
      if (s.contract_id) dupConds.push(eq(invoicesTable.contract_id, s.contract_id));
      const [dup] = await db.select({ id: invoicesTable.id }).from(invoicesTable).where(and(...dupConds)).limit(1);

      if (!dup) {
        const invoice_ref = await nextInvoiceRef();
        await db.insert(invoicesTable).values({
          invoice_ref,
          booking_id: s.booking_id || null,
          contract_id: s.contract_id ?? null,
          account_id: s.account_id || null,
          amount: String(s.amount),
          currency: s.currency || DEFAULT_CURRENCY,
          exchange_rate_to_aud: await getRateToAud(s.currency || DEFAULT_CURRENCY),
          status: "Sent",
          due_date: periodStart,
          description,
        });
        result.created++;
      } else {
        result.skipped++;
      }

      await db.update(recurringSchedulesTable)
        .set({ next_due_date: nextDate, last_generated_at: new Date(), updated_at: new Date() })
        .where(eq(recurringSchedulesTable.id, s.id));
    } catch (err) {
      console.error(`[recurringInvoices] schedule ${s.id} failed:`, err);
      result.errors++;
    }
  }
  return result;
}
