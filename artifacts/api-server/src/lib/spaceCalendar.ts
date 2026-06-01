/**
 * Aggregates everything that makes a space unavailable into a single list of
 * iCal events for the outbound OTA feed. Sources:
 *   1. Active bookings        (check-in → check-out, exclusive)
 *   2. Signed/Active contracts (long-term tenancies)
 *   3. Manual availability blocks in space_availability (is_available = false)
 *
 * space_availability is the single source of truth for the calendar; bookings
 * and contracts are included directly so the feed is correct even if a block
 * row was never materialised for them.
 */
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { db, bookingsTable, contractsTable, spaceAvailabilityTable } from "@workspace/db";
import { addDays, mergeConsecutiveDates, type ICalEvent } from "./ical.js";

// When a long-term contract has no end date, block this many days forward so an
// occupied unit can't be double-booked through the OTA.
const OPEN_CONTRACT_HORIZON_DAYS = 730;

export async function getSpaceCalendarEvents(spaceId: number): Promise<ICalEvent[]> {
  const [bookings, contracts, manualBlocks] = await Promise.all([
    db
      .select({
        id: bookingsTable.id,
        booking_ref: bookingsTable.booking_ref,
        check_in_date: bookingsTable.check_in_date,
        check_out_date: bookingsTable.check_out_date,
      })
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.space_id, spaceId),
          eq(bookingsTable.status, "Active"),
          inArray(bookingsTable.booking_status, ["Confirmed", "Pending", "Active"]),
          isNotNull(bookingsTable.check_in_date),
          isNotNull(bookingsTable.check_out_date),
        ),
      ),
    db
      .select({
        id: contractsTable.id,
        start_date: contractsTable.start_date,
        end_date: contractsTable.end_date,
      })
      .from(contractsTable)
      .where(
        and(
          eq(contractsTable.space_id, spaceId),
          inArray(contractsTable.status, ["Signed", "Active"]),
          isNotNull(contractsTable.start_date),
        ),
      ),
    db
      .select({ date: spaceAvailabilityTable.date })
      .from(spaceAvailabilityTable)
      .where(
        and(
          eq(spaceAvailabilityTable.space_id, spaceId),
          eq(spaceAvailabilityTable.is_available, false),
        ),
      ),
  ]);

  const events: ICalEvent[] = [];

  for (const b of bookings) {
    // check_out_date is exclusive — exactly what an all-day DTEND wants.
    events.push({
      uid: `booking-${b.id}@millionstay`,
      start: b.check_in_date!,
      endExclusive: b.check_out_date!,
      summary: `Booked (${b.booking_ref})`,
    });
  }

  for (const c of contracts) {
    const start = c.start_date!;
    // Contract end_date is the move-out day (inclusive) → block through it.
    const endExclusive = c.end_date
      ? addDays(c.end_date, 1)
      : addDays(start, OPEN_CONTRACT_HORIZON_DAYS);
    events.push({
      uid: `contract-${c.id}@millionstay`,
      start,
      endExclusive,
      summary: "Contracted",
    });
  }

  const ranges = mergeConsecutiveDates(manualBlocks.map((r) => String(r.date)));
  for (const r of ranges) {
    events.push({
      uid: `block-${spaceId}-${r.start.replace(/-/g, "")}@millionstay`,
      start: r.start,
      endExclusive: r.endExclusive,
      summary: "Blocked",
    });
  }

  return events;
}
