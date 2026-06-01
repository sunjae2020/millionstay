/**
 * Channel API outbound push (Stage 4).
 *
 * Builds availability ranges (from space_availability + bookings + contracts,
 * via the Stage 1 calendar aggregator) and rate rows (from space_rate_calendar)
 * and hands them to the channel adapter. With the mock adapter these are
 * no-ops that record a channel_sync_logs row; real adapters will perform the
 * certified API calls.
 */
import { and, asc, eq, gte, lte } from "drizzle-orm";
import {
  db,
  channelsTable,
  channelListingsTable,
  channelAccountsTable,
  channelSyncLogsTable,
  spaceRateCalendarTable,
} from "@workspace/db";
import { getAdapter, type AvailabilityRange, type PushContext, type RateRow } from "./adapter.js";
import { getSpaceCalendarEvents } from "../spaceCalendar.js";

interface ListingRow {
  id: number;
  channel_id: number | null;
  space_id: number;
  external_listing_id: string | null;
  channel_account_id: number | null;
}

async function buildContext(listing: ListingRow): Promise<PushContext> {
  const [channel] = listing.channel_id
    ? await db.select({ code: channelsTable.code }).from(channelsTable).where(eq(channelsTable.id, listing.channel_id))
    : [undefined];
  const [account] = listing.channel_account_id
    ? await db
        .select({ credentials_ref: channelAccountsTable.credentials_ref })
        .from(channelAccountsTable)
        .where(eq(channelAccountsTable.id, listing.channel_account_id))
    : [undefined];
  return {
    channelCode: channel?.code ?? "mock",
    externalListingId: listing.external_listing_id,
    credentialsRef: account?.credentials_ref ?? null,
  };
}

async function loadListing(listingId: number): Promise<ListingRow | undefined> {
  const [row] = await db
    .select({
      id: channelListingsTable.id,
      channel_id: channelListingsTable.channel_id,
      space_id: channelListingsTable.space_id,
      external_listing_id: channelListingsTable.external_listing_id,
      channel_account_id: channelListingsTable.channel_account_id,
    })
    .from(channelListingsTable)
    .where(eq(channelListingsTable.id, listingId));
  return row;
}

async function logExport(listing: ListingRow, syncType: "availability" | "rates", ok: boolean, count: number, message?: string) {
  await db
    .update(channelListingsTable)
    .set({ last_export_at: new Date(), last_sync_status: ok ? "success" : "failed" })
    .where(eq(channelListingsTable.id, listing.id))
    .catch(() => {});
  await db
    .insert(channelSyncLogsTable)
    .values({
      channel_listing_id: listing.id,
      channel_id: listing.channel_id,
      direction: "export",
      sync_type: syncType,
      status: ok ? "success" : "failed",
      items_processed: count,
      items_failed: ok ? 0 : 1,
      error_message: ok ? null : message ?? null,
      finished_at: new Date(),
    })
    .catch(() => {});
}

export async function pushAvailabilityForListing(listingId: number): Promise<{ ok: boolean; message?: string; ranges: number }> {
  const listing = await loadListing(listingId);
  if (!listing) throw new Error("listing not found");

  const events = await getSpaceCalendarEvents(listing.space_id);
  const ranges: AvailabilityRange[] = events.map((e) => ({ start: e.start, endExclusive: e.endExclusive }));

  const ctx = await buildContext(listing);
  const res = await getAdapter(ctx.channelCode).pushAvailability(ctx, ranges);
  await logExport(listing, "availability", res.ok, ranges.length, res.message);
  return { ...res, ranges: ranges.length };
}

export async function pushRatesForListing(listingId: number): Promise<{ ok: boolean; message?: string; rates: number }> {
  const listing = await loadListing(listingId);
  if (!listing) throw new Error("listing not found");

  const today = new Date().toISOString().slice(0, 10);
  const rows = await db
    .select()
    .from(spaceRateCalendarTable)
    .where(and(eq(spaceRateCalendarTable.space_id, listing.space_id), gte(spaceRateCalendarTable.date, today)))
    .orderBy(asc(spaceRateCalendarTable.date));

  const rates: RateRow[] = rows.map((r) => ({
    date: String(r.date),
    rate: r.rate != null ? Number(r.rate) : null,
    currency: r.currency,
    minStay: r.min_stay,
    maxStay: r.max_stay,
    closedToArrival: r.closed_to_arrival,
    closedToDeparture: r.closed_to_departure,
  }));

  const ctx = await buildContext(listing);
  const res = await getAdapter(ctx.channelCode).pushRates(ctx, rates);
  await logExport(listing, "rates", res.ok, rates.length, res.message);
  return { ...res, rates: rates.length };
}
