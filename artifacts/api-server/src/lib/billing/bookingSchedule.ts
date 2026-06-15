// Auto-create a recurring rent schedule for a confirmed general/short-term
// booking, mirroring the homestay placement flow (lib/homestay/rentSchedule.ts).
// The schedule starts as 'PendingApproval' so the recurring-invoice cron skips
// it until an admin approves — see the approval gate in recurringInvoices.ts.
//
// Only recurring-style stays get a schedule: a positive weekly rate AND either a
// mid/long-term contract or a stay of at least 4 weeks. Short one-off stays are
// billed up front, not on a recurring track, so they return null.
//
// Money columns are numeric → strings.
import { and, eq, isNull } from "drizzle-orm";
import { db, recurringSchedulesTable, bookingsTable } from "@workspace/db";

/**
 * Create (idempotently) the weekly-rent recurring schedule for a general
 * booking. Returns the schedule id, or null when there's nothing to schedule
 * (booking missing, no billing account, not a recurring-style stay). Best-effort:
 * the caller wraps this so it never blocks booking confirmation.
 */
export async function createBookingRecurringSchedule(bookingId: number): Promise<number | null> {
  const [booking] = await db
    .select()
    .from(bookingsTable)
    .where(eq(bookingsTable.id, bookingId))
    .limit(1);
  if (!booking || booking.account_id == null) return null;

  const weekly = Number(booking.agreed_weekly_rate);
  if (!(weekly > 0)) return null;

  // Only recurring-style stays: mid/long-term contract, or a stay of ≥4 weeks.
  const term = booking.contract_term;
  const stayWeeks = Number(booking.stay_weeks);
  const isRecurringStay =
    term === "mid_term" || term === "long_term" || stayWeeks >= 4;
  if (!isRecurringStay) return null;

  // Idempotent: one active Rent schedule per booking.
  const [existing] = await db
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
  if (existing) return existing.id;

  const start = booking.check_in_date || new Date().toISOString().slice(0, 10);

  const [row] = await db
    .insert(recurringSchedulesTable)
    .values({
      booking_id: bookingId,
      account_id: booking.account_id,
      schedule_type: "Rent",
      frequency: "Weekly",
      amount: String(weekly),
      currency: booking.currency || "AUD",
      start_date: start,
      next_due_date: start,
      billing_mode: "incremental",
      approval_status: "PendingApproval",
      is_active: true,
    })
    .returning({ id: recurringSchedulesTable.id });

  return row!.id;
}
