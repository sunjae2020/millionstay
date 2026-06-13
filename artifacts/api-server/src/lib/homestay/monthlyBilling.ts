// Homestay rent — per-cycle automation. A daily cron calls
// generateRentCharges(): for each Active placement whose next_billing_date is due
// (within the lead window), it creates a PENDING `monthly` homestay_placement_payments
// charge using the effective method (per-placement override → global settings) and
// advances next_billing_date by the cycle length. It does NOT collect/send — ops
// send each pending charge from the admin (card link / bank details). Best-effort.
import { and, eq, isNull, lte, sql } from "drizzle-orm";
import {
  db,
  homestayPlacementsTable,
  homestayPlacementPaymentsTable,
  paymentInfoTable,
} from "@workspace/db";
import { getHomestayBillingSettings } from "./billingSettings.js";

/** Today in Sydney (YYYY-MM-DD), matching the cron timezone. */
function sydneyToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(new Date());
}

/** Add `days` to a YYYY-MM-DD string. */
function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export interface RentBillingResult { scanned: number; created: number; skipped: number; errors: number }

export async function generateRentCharges(): Promise<RentBillingResult> {
  const settings = await getHomestayBillingSettings();
  const today = sydneyToday();
  const threshold = addDays(today, settings.lead_days); // generate up to lead_days early
  const result: RentBillingResult = { scanned: 0, created: 0, skipped: 0, errors: 0 };

  const due = await db.select().from(homestayPlacementsTable)
    .where(and(
      eq(homestayPlacementsTable.status, "Active"),
      isNull(homestayPlacementsTable.deleted_at),
      lte(homestayPlacementsTable.next_billing_date, threshold),
      sql`${homestayPlacementsTable.monthly_fee} > 0`,
    ));
  result.scanned = due.length;

  // Resolve an active bank account once (for bank_transfer charges).
  const [bank] = await db.select().from(paymentInfoTable)
    .where(and(eq(paymentInfoTable.payment_type, "BankTransfer"), eq(paymentInfoTable.status, "Active"), isNull(paymentInfoTable.deleted_at)))
    .limit(1);

  for (const pl of due) {
    try {
      const periodStart = pl.next_billing_date!;
      const cycleWeeks = pl.billing_cycle_weeks || settings.cycle_weeks;
      const periodEnd = addDays(periodStart, cycleWeeks * 7);

      // Idempotent: skip if a charge for this exact period already exists.
      const [dup] = await db.select({ id: homestayPlacementPaymentsTable.id }).from(homestayPlacementPaymentsTable)
        .where(and(
          eq(homestayPlacementPaymentsTable.placement_id, pl.id),
          eq(homestayPlacementPaymentsTable.kind, "monthly"),
          eq(homestayPlacementPaymentsTable.period_start, periodStart),
        )).limit(1);
      if (dup) {
        await db.update(homestayPlacementsTable).set({ next_billing_date: periodEnd, updated_at: new Date() }).where(eq(homestayPlacementsTable.id, pl.id));
        result.skipped++;
        continue;
      }

      const method = pl.billing_method || settings.default_method;
      const base = Number(pl.monthly_fee);
      const surcharge = method === "card" ? Math.round(base * (settings.surcharge_pct / 100) * 100) / 100 : 0;
      const total = Math.round((base + surcharge) * 100) / 100;
      const currency = pl.currency || "AUD";

      await db.insert(homestayPlacementPaymentsTable).values({
        placement_id: pl.id, kind: "monthly", method, status: "pending",
        base_amount: String(base), surcharge_amount: String(surcharge), amount: String(total), currency,
        payment_info_id: method === "bank_transfer" ? (bank?.id ?? null) : null,
        period_start: periodStart, period_end: periodEnd,
      });

      await db.update(homestayPlacementsTable).set({ next_billing_date: periodEnd, updated_at: new Date() }).where(eq(homestayPlacementsTable.id, pl.id));
      result.created++;
    } catch (err) {
      console.error(`[rentBilling] placement ${pl.id} failed:`, err);
      result.errors++;
    }
  }
  return result;
}
