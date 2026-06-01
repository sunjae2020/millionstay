/**
 * Inbound OTA calendar sync (Stage 2).
 *
 * For each channel_listing with an ical_import_url, fetch the remote .ics,
 * parse blocked date ranges, and reflect them into space_availability as
 * source='ical' blocks. Idempotent:
 *   - Re-running produces the same rows (upsert keyed on (space_id, date)).
 *   - Dates the OTA no longer reports are cleared (stale-block deletion).
 *   - Manual / booking blocks are never clobbered (setWhere source='ical').
 *
 * space_availability remains the single source of truth; the Stage 1 export
 * feed re-publishes these blocks, so a block imported from Airbnb is also
 * surfaced to Booking.com etc. — preventing cross-channel double bookings.
 */
import { and, eq, notInArray } from "drizzle-orm";
import { db, channelListingsTable, channelSyncLogsTable, spaceAvailabilityTable } from "@workspace/db";
import { addDays } from "./ical.js";
import { parseIcal } from "./icalParse.js";
import { logger } from "./logger";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_DAYS_PER_EVENT = 1100; // ~3 years guard against malformed ranges

export interface ListingImportResult {
  listingId: number;
  status: "success" | "failed";
  processed: number;
  error?: string;
}

interface ImportableListing {
  id: number;
  space_id: number;
  channel_id: number | null;
  ical_import_url: string | null;
}

/** Expand a [start, endExclusive) range into individual "YYYY-MM-DD" dates. */
function expandDates(start: string, endExclusive: string): string[] {
  const out: string[] = [];
  let d = start;
  let n = 0;
  while (d < endExclusive && n < MAX_DAYS_PER_EVENT) {
    out.push(d);
    d = addDays(d, 1);
    n++;
  }
  return out;
}

/** Sync a single channel listing's inbound iCal feed into space_availability. */
export async function syncChannelListingImport(listing: ImportableListing): Promise<ListingImportResult> {
  const startedAt = new Date();
  let processed = 0;
  let status: "success" | "failed" = "success";
  let error: string | undefined;

  try {
    if (!listing.ical_import_url) throw new Error("no ical_import_url");

    const res = await fetch(listing.ical_import_url, {
      headers: { "User-Agent": "millionstay/ical-import", Accept: "text/calendar, text/plain, */*" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`provider HTTP ${res.status}`);

    const text = await res.text();
    const events = parseIcal(text);

    // date -> composite external_uid (stable across re-imports; keeps the
    // (channel_listing_id, external_uid) constraint satisfied per row).
    const dateUid = new Map<string, string>();
    for (const ev of events) {
      for (const d of expandDates(ev.start, ev.endExclusive)) {
        if (!dateUid.has(d)) dateUid.set(d, `${ev.uid}#${d}`);
      }
    }
    const dates = [...dateUid.keys()];

    await db.transaction(async (tx) => {
      // 1. Clear stale ical blocks for this listing (dates the OTA dropped).
      const staleFilter = dates.length
        ? and(
            eq(spaceAvailabilityTable.channel_listing_id, listing.id),
            eq(spaceAvailabilityTable.source, "ical"),
            notInArray(spaceAvailabilityTable.date, dates),
          )
        : and(
            eq(spaceAvailabilityTable.channel_listing_id, listing.id),
            eq(spaceAvailabilityTable.source, "ical"),
          );
      await tx.delete(spaceAvailabilityTable).where(staleFilter);

      // 2. Upsert current blocks. setWhere ensures we never overwrite a
      //    manual/booking block that already owns the date.
      for (const [date, uid] of dateUid) {
        await tx
          .insert(spaceAvailabilityTable)
          .values({
            space_id: listing.space_id,
            date,
            is_available: false,
            block_reason: "OTA import",
            source: "ical",
            channel_listing_id: listing.id,
            external_uid: uid,
          })
          .onConflictDoUpdate({
            target: [spaceAvailabilityTable.space_id, spaceAvailabilityTable.date],
            set: {
              is_available: false,
              block_reason: "OTA import",
              source: "ical",
              channel_listing_id: listing.id,
              external_uid: uid,
            },
            setWhere: eq(spaceAvailabilityTable.source, "ical"),
          });
        processed++;
      }
    });
  } catch (e) {
    status = "failed";
    error = e instanceof Error ? e.message : String(e);
  }

  // Update listing tracking + write an audit log row (best-effort).
  await db
    .update(channelListingsTable)
    .set({ last_import_at: startedAt, last_sync_status: status })
    .where(eq(channelListingsTable.id, listing.id))
    .catch(() => {});

  await db
    .insert(channelSyncLogsTable)
    .values({
      channel_listing_id: listing.id,
      channel_id: listing.channel_id ?? null,
      direction: "import",
      sync_type: "availability",
      status,
      items_processed: processed,
      items_failed: status === "failed" ? 1 : 0,
      error_message: error ?? null,
      started_at: startedAt,
      finished_at: new Date(),
    })
    .catch(() => {});

  return { listingId: listing.id, status, processed, error };
}

export interface SyncAllResult {
  total: number;
  ok: number;
  failed: number;
  results: ListingImportResult[];
}

/** Sync every enabled listing that has an inbound iCal URL. */
export async function syncAllChannelImports(): Promise<SyncAllResult> {
  const listings = await db
    .select({
      id: channelListingsTable.id,
      space_id: channelListingsTable.space_id,
      channel_id: channelListingsTable.channel_id,
      ical_import_url: channelListingsTable.ical_import_url,
    })
    .from(channelListingsTable)
    .where(
      and(
        eq(channelListingsTable.sync_enabled, true),
        eq(channelListingsTable.sync_availability, true),
        eq(channelListingsTable.status, "Active"),
      ),
    );

  const importable = listings.filter((l) => !!l.ical_import_url);
  const results: ListingImportResult[] = [];
  // Sequential to keep DB load low and stay polite to OTA endpoints.
  for (const l of importable) {
    results.push(await syncChannelListingImport(l));
  }

  const ok = results.filter((r) => r.status === "success").length;
  const failed = results.length - ok;
  logger.info({ total: results.length, ok, failed }, "iCal import sync run");
  return { total: results.length, ok, failed, results };
}
