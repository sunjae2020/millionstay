// Unify homestay monthly rent onto the Booking/invoice billing track.
//
// On activation we create a recurring_schedule for the placement's booking so
// the existing recurring-invoice cron (generateRecurringInvoices) bills monthly
// rent as booking invoices — the same engine used for non-homestay long stays.
// The legacy per-placement charge cron (generateRentCharges) is guarded to SKIP
// any placement whose booking already has an active schedule, so rent is billed
// by exactly one track (no double-billing).
//
// Money columns are numeric → strings.
import { and, eq, isNull } from "drizzle-orm";
import {
  db,
  recurringSchedulesTable,
  homestayPlacementsTable,
  bookingsTable,
} from "@workspace/db";
import { getHomestayBillingSettings } from "./billingSettings.js";

/** Map a billing cycle length (weeks) to a recurring frequency. */
function frequencyFromWeeks(weeks: number): "Weekly" | "Biweekly" | "Monthly" {
  if (weeks <= 1) return "Weekly";
  if (weeks === 2) return "Biweekly";
  return "Monthly"; // 4-weekly (default) and longer → monthly cadence
}

/**
 * Create (idempotently) the monthly-rent recurring schedule for a placement's
 * booking. Returns the schedule id, or null when there's nothing to schedule
 * (no booking, no monthly fee, or a schedule already exists). Best-effort:
 * callers wrap this so it never blocks activation.
 */
export async function createRentScheduleForPlacement(placementId: number): Promise<number | null> {
  const [placement] = await db
    .select()
    .from(homestayPlacementsTable)
    .where(eq(homestayPlacementsTable.id, placementId))
    .limit(1);
  if (!placement || placement.booking_id == null) return null;

  const monthly = Number(placement.monthly_fee);
  if (!(monthly > 0)) return null;

  // Idempotent: one active Rent schedule per booking.
  const [existing] = await db
    .select({ id: recurringSchedulesTable.id })
    .from(recurringSchedulesTable)
    .where(
      and(
        eq(recurringSchedulesTable.booking_id, placement.booking_id),
        eq(recurringSchedulesTable.schedule_type, "Rent"),
        eq(recurringSchedulesTable.is_active, true),
        isNull(recurringSchedulesTable.deleted_at),
      ),
    )
    .limit(1);
  if (existing) return existing.id;

  // Billing account = the booking's guest account.
  const [booking] = await db
    .select({ account_id: bookingsTable.account_id })
    .from(bookingsTable)
    .where(eq(bookingsTable.id, placement.booking_id))
    .limit(1);
  const accountId = booking?.account_id ?? null;
  if (accountId == null) return null; // recurring_schedule.account_id is NOT NULL

  const settings = await getHomestayBillingSettings();
  const cycleWeeks = placement.billing_cycle_weeks || settings.cycle_weeks || 4;
  const frequency = frequencyFromWeeks(cycleWeeks);

  // First cycle anchors on the placement's next_billing_date (set at activation),
  // else move-in, else today.
  const start =
    placement.next_billing_date ||
    placement.move_in_date ||
    new Date().toISOString().slice(0, 10);

  const [row] = await db
    .insert(recurringSchedulesTable)
    .values({
      booking_id: placement.booking_id,
      account_id: accountId,
      schedule_type: "Rent",
      frequency,
      amount: String(monthly),
      currency: placement.currency || "AUD",
      start_date: start,
      next_due_date: start,
      billing_mode: "incremental",
      approval_status: "PendingApproval",
      is_active: true,
    })
    .returning({ id: recurringSchedulesTable.id });

  return row!.id;
}

/**
 * True when a placement's monthly rent is handled by a booking recurring
 * schedule (so the legacy per-placement charge cron must skip it).
 */
export async function hasActiveRentSchedule(bookingId: number | null): Promise<boolean> {
  if (bookingId == null) return false;
  const [row] = await db
    .select({ id: recurringSchedulesTable.id })
    .from(recurringSchedulesTable)
    .where(
      and(
        eq(recurringSchedulesTable.booking_id, bookingId),
        eq(recurringSchedulesTable.schedule_type, "Rent"),
        eq(recurringSchedulesTable.is_active, true),
        isNull(recurringSchedulesTable.deleted_at),
      ),
    )
    .limit(1);
  return !!row;
}
