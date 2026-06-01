/**
 * Channel API reservation ingestion (Stage 4).
 *
 * Takes a raw OTA payload (webhook or poll), normalizes it via the channel's
 * adapter, persists each reservation to channel_reservations (the audit/raw
 * landing table), and maps confirmed reservations to internal bookings.
 * Cancellations flip the linked booking to Cancelled so the date frees up
 * everywhere (search, export feed, unified calendar).
 *
 * Idempotent: channel_reservations is keyed on (channel_id,
 * external_reservation_id) and bookings on a deterministic booking_ref, so
 * re-delivery of the same webhook is a no-op update.
 */
import { and, eq } from "drizzle-orm";
import {
  db,
  channelsTable,
  channelListingsTable,
  channelReservationsTable,
  channelSyncLogsTable,
  bookingsTable,
} from "@workspace/db";
import { getAdapter } from "./adapter.js";
import { logger } from "../logger";

export interface IngestResult {
  received: number;
  mapped: number;
  cancelled: number;
  unmatched: number;
  errors: number;
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const n = Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86_400_000);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export async function ingestReservations(channelCode: string, payload: unknown): Promise<IngestResult> {
  const adapter = getAdapter(channelCode);
  const [channel] = await db.select().from(channelsTable).where(eq(channelsTable.code, channelCode));
  if (!channel) throw new Error(`unknown channel: ${channelCode}`);

  const reservations = adapter.parseReservations(payload);
  const result: IngestResult = { received: reservations.length, mapped: 0, cancelled: 0, unmatched: 0, errors: 0 };

  for (const r of reservations) {
    try {
      // Resolve the listing (and therefore the space) for this reservation.
      let listing: { id: number; space_id: number } | undefined;
      if (r.externalListingId) {
        [listing] = await db
          .select({ id: channelListingsTable.id, space_id: channelListingsTable.space_id })
          .from(channelListingsTable)
          .where(and(eq(channelListingsTable.channel_id, channel.id), eq(channelListingsTable.external_listing_id, r.externalListingId)));
      }
      if (!listing) {
        // Fall back to the sole listing for this channel, if unambiguous.
        const ls = await db
          .select({ id: channelListingsTable.id, space_id: channelListingsTable.space_id })
          .from(channelListingsTable)
          .where(eq(channelListingsTable.channel_id, channel.id));
        if (ls.length === 1) listing = ls[0];
      }
      const spaceId = listing?.space_id ?? null;
      const cancelled = r.status === "cancelled";
      const reservationStatus = cancelled ? "Cancelled" : spaceId ? "Mapped" : "Received";

      // 1. Upsert the raw reservation record.
      const [cr] = await db
        .insert(channelReservationsTable)
        .values({
          channel_id: channel.id,
          channel_listing_id: listing?.id ?? null,
          external_reservation_id: r.externalReservationId,
          space_id: spaceId,
          guest_name: r.guestName ?? null,
          guest_email: r.guestEmail ?? null,
          check_in_date: r.checkIn,
          check_out_date: r.checkOut,
          num_guests: r.numGuests ?? null,
          total_amount: r.totalAmount != null ? String(r.totalAmount) : null,
          currency: r.currency ?? null,
          channel_status: r.channelStatus ?? null,
          reservation_status: reservationStatus,
          raw_payload: r.raw,
        })
        .onConflictDoUpdate({
          target: [channelReservationsTable.channel_id, channelReservationsTable.external_reservation_id],
          set: {
            channel_listing_id: listing?.id ?? null,
            space_id: spaceId,
            guest_name: r.guestName ?? null,
            guest_email: r.guestEmail ?? null,
            check_in_date: r.checkIn,
            check_out_date: r.checkOut,
            num_guests: r.numGuests ?? null,
            total_amount: r.totalAmount != null ? String(r.totalAmount) : null,
            currency: r.currency ?? null,
            channel_status: r.channelStatus ?? null,
            reservation_status: reservationStatus,
            raw_payload: r.raw,
          },
        })
        .returning();

      if (!spaceId) {
        result.unmatched++;
        continue;
      }

      const bookingRef = `OTA-${channelCode}-${r.externalReservationId}`;

      if (cancelled) {
        // Cancel the linked booking (frees the dates everywhere).
        await db
          .update(bookingsTable)
          .set({ booking_status: "Cancelled", cancellation_reason: "OTA cancellation", cancelled_at: new Date() })
          .where(eq(bookingsTable.booking_ref, bookingRef));
        result.cancelled++;
        continue;
      }

      // 2. Map to an internal booking (create or update).
      const [booking] = await db
        .insert(bookingsTable)
        .values({
          booking_ref: bookingRef,
          name: r.guestName ?? null,
          booking_status: "Confirmed",
          booking_source: channel.name,
          customer_notes: r.guestEmail ?? null,
          space_id: spaceId,
          check_in_date: r.checkIn,
          check_out_date: r.checkOut,
          stay_nights: nightsBetween(r.checkIn, r.checkOut),
          num_guests: r.numGuests ?? 1,
          total_rent: r.totalAmount != null ? String(r.totalAmount) : null,
          currency: r.currency ?? "AUD",
          status: "Active",
        })
        .onConflictDoUpdate({
          target: bookingsTable.booking_ref,
          set: {
            name: r.guestName ?? null,
            booking_status: "Confirmed",
            customer_notes: r.guestEmail ?? null,
            check_in_date: r.checkIn,
            check_out_date: r.checkOut,
            stay_nights: nightsBetween(r.checkIn, r.checkOut),
            num_guests: r.numGuests ?? 1,
            total_rent: r.totalAmount != null ? String(r.totalAmount) : null,
            currency: r.currency ?? "AUD",
            cancelled_at: null,
            cancellation_reason: null,
          },
        })
        .returning();

      // 3. Link the reservation to its booking.
      await db
        .update(channelReservationsTable)
        .set({ booking_id: booking.id, reservation_status: "Mapped" })
        .where(eq(channelReservationsTable.id, cr.id));

      result.mapped++;
    } catch (e) {
      result.errors++;
      logger.error({ err: e, channelCode, ext: r.externalReservationId }, "reservation ingest failed");
    }
  }

  await db
    .insert(channelSyncLogsTable)
    .values({
      channel_id: channel.id,
      direction: "import",
      sync_type: "reservations",
      status: result.errors > 0 ? (result.mapped + result.cancelled > 0 ? "partial" : "failed") : "success",
      items_processed: result.mapped + result.cancelled,
      items_failed: result.errors,
      error_message: result.errors > 0 ? `${result.errors} reservation(s) failed` : null,
      finished_at: new Date(),
    })
    .catch(() => {});

  logger.info({ channelCode, ...result }, "channel reservation ingest");
  return result;
}
