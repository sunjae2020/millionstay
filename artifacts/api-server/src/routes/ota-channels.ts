import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import { and, eq, asc, desc, gte, lte, inArray, or, isNull, isNotNull } from "drizzle-orm";
import {
  db,
  spacesTable,
  channelsTable,
  channelListingsTable,
  channelSyncLogsTable,
  spaceAvailabilityTable,
  bookingsTable,
  contractsTable,
  channelAccountsTable,
  channelReservationsTable,
  spaceRateCalendarTable,
} from "@workspace/db";
import { logAction } from "../utils/auditLog.js";
import { syncChannelListingImport } from "../lib/icalImport.js";
import { addDays } from "../lib/ical.js";
import { pushAvailabilityForListing, pushRatesForListing } from "../lib/channels/push.js";

/**
 * OTA channel integration — Stage 1 (iCal export) admin endpoints.
 *
 * Manages the per-space secret token that authorizes the public outbound
 * availability feed served at
 *   GET /api/v1/public/spaces/:id/calendar/:token.ics
 *
 * Mounted under the main router (behind requireAuth).
 */
const router: IRouter = Router();

/** Resolve the public base URL for building absolute feed links. */
function publicBaseUrl(req: { protocol: string; get: (h: string) => string | undefined }): string {
  const fromEnv = process.env.PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const host = req.get("host") ?? "localhost";
  return `${req.protocol}://${host}`;
}

function feedUrl(req: any, spaceId: number, token: string): string {
  return `${publicBaseUrl(req)}/api/v1/public/spaces/${spaceId}/calendar/${token}.ics`;
}

/* ───────────────────────────────────────────────────────
   GET /api/v1/spaces/:id/calendar-feed
   Returns the current iCal export feed status for a space.
──────────────────────────────────────────────────────── */
router.get("/v1/spaces/:id/calendar-feed", async (req, res): Promise<void> => {
  const spaceId = Number(req.params.id);
  if (!spaceId) { res.status(400).json({ error: "Invalid space id" }); return; }

  const [space] = await db
    .select({ id: spacesTable.id, ical_export_token: spacesTable.ical_export_token })
    .from(spacesTable)
    .where(eq(spacesTable.id, spaceId));

  if (!space) { res.status(404).json({ error: "Space not found" }); return; }

  const hasToken = !!space.ical_export_token;
  res.json({
    success: true,
    data: {
      space_id: spaceId,
      has_token: hasToken,
      feed_url: hasToken ? feedUrl(req, spaceId, space.ical_export_token!) : null,
    },
  });
});

/* ───────────────────────────────────────────────────────
   POST /api/v1/spaces/:id/calendar-feed/token
   Generate (or rotate) the secret token and return the feed URL.
   Rotating invalidates the previous URL.
──────────────────────────────────────────────────────── */
router.post("/v1/spaces/:id/calendar-feed/token", async (req, res): Promise<void> => {
  const spaceId = Number(req.params.id);
  if (!spaceId) { res.status(400).json({ error: "Invalid space id" }); return; }

  const [space] = await db
    .select({ id: spacesTable.id })
    .from(spacesTable)
    .where(eq(spacesTable.id, spaceId));

  if (!space) { res.status(404).json({ error: "Space not found" }); return; }

  const token = randomBytes(24).toString("base64url"); // ~32 url-safe chars
  await db.update(spacesTable).set({ ical_export_token: token }).where(eq(spacesTable.id, spaceId));

  await logAction({ entityType: "space", entityId: spaceId, action: "UPDATE", newValue: { ical_export_token: "rotated" } });

  res.status(201).json({
    success: true,
    data: { space_id: spaceId, feed_url: feedUrl(req, spaceId, token) },
  });
});

/* ───────────────────────────────────────────────────────
   DELETE /api/v1/spaces/:id/calendar-feed/token
   Revoke the export feed (clears the token; existing URL stops working).
──────────────────────────────────────────────────────── */
router.delete("/v1/spaces/:id/calendar-feed/token", async (req, res): Promise<void> => {
  const spaceId = Number(req.params.id);
  if (!spaceId) { res.status(400).json({ error: "Invalid space id" }); return; }

  const [space] = await db
    .select({ id: spacesTable.id })
    .from(spacesTable)
    .where(eq(spacesTable.id, spaceId));

  if (!space) { res.status(404).json({ error: "Space not found" }); return; }

  await db.update(spacesTable).set({ ical_export_token: null }).where(eq(spacesTable.id, spaceId));
  await logAction({ entityType: "space", entityId: spaceId, action: "UPDATE", newValue: { ical_export_token: "revoked" } });

  res.json({ success: true });
});

/* ═══════════════════════════════════════════════════════
   Channel listings — inbound iCal import (Stage 2)
══════════════════════════════════════════════════════════ */

/* GET /api/v1/channels — supported channels for dropdowns. */
router.get("/v1/channels", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(channelsTable)
    .where(eq(channelsTable.enabled, true))
    .orderBy(asc(channelsTable.sort_order), asc(channelsTable.id));
  res.json({ success: true, data: rows });
});

/* GET /api/v1/channel-listings — ALL listings across every space (admin overview). */
router.get("/v1/channel-listings", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: channelListingsTable.id,
      space_id: channelListingsTable.space_id,
      space_name: spacesTable.name,
      channel_id: channelListingsTable.channel_id,
      channel_code: channelsTable.code,
      channel_name: channelsTable.name,
      external_listing_id: channelListingsTable.external_listing_id,
      listing_url: channelListingsTable.listing_url,
      ical_import_url: channelListingsTable.ical_import_url,
      sync_enabled: channelListingsTable.sync_enabled,
      sync_availability: channelListingsTable.sync_availability,
      last_import_at: channelListingsTable.last_import_at,
      last_export_at: channelListingsTable.last_export_at,
      last_sync_status: channelListingsTable.last_sync_status,
      status: channelListingsTable.status,
    })
    .from(channelListingsTable)
    .leftJoin(channelsTable, eq(channelListingsTable.channel_id, channelsTable.id))
    .leftJoin(spacesTable, eq(channelListingsTable.space_id, spacesTable.id))
    .orderBy(asc(channelListingsTable.space_id), asc(channelListingsTable.id));
  res.json({ success: true, data: rows });
});

/* GET /api/v1/spaces/:id/channel-listings — listings mapped to a space. */
router.get("/v1/spaces/:id/channel-listings", async (req, res): Promise<void> => {
  const spaceId = Number(req.params.id);
  if (!spaceId) { res.status(400).json({ error: "Invalid space id" }); return; }

  const rows = await db
    .select({
      id: channelListingsTable.id,
      channel_id: channelListingsTable.channel_id,
      channel_code: channelsTable.code,
      channel_name: channelsTable.name,
      external_listing_id: channelListingsTable.external_listing_id,
      listing_url: channelListingsTable.listing_url,
      ical_import_url: channelListingsTable.ical_import_url,
      sync_enabled: channelListingsTable.sync_enabled,
      sync_availability: channelListingsTable.sync_availability,
      last_import_at: channelListingsTable.last_import_at,
      last_export_at: channelListingsTable.last_export_at,
      last_sync_status: channelListingsTable.last_sync_status,
      status: channelListingsTable.status,
    })
    .from(channelListingsTable)
    .leftJoin(channelsTable, eq(channelListingsTable.channel_id, channelsTable.id))
    .where(eq(channelListingsTable.space_id, spaceId))
    .orderBy(asc(channelListingsTable.id));
  res.json({ success: true, data: rows });
});

/* POST /api/v1/spaces/:id/channel-listings — map a space to an external listing. */
router.post("/v1/spaces/:id/channel-listings", async (req, res): Promise<void> => {
  const spaceId = Number(req.params.id);
  if (!spaceId) { res.status(400).json({ error: "Invalid space id" }); return; }

  const b = req.body ?? {};
  const channelId = Number(b.channel_id);
  if (!channelId) { res.status(400).json({ error: "channel_id is required" }); return; }

  const [space] = await db.select({ id: spacesTable.id }).from(spacesTable).where(eq(spacesTable.id, spaceId));
  if (!space) { res.status(404).json({ error: "Space not found" }); return; }

  const [channel] = await db.select({ id: channelsTable.id }).from(channelsTable).where(eq(channelsTable.id, channelId));
  if (!channel) { res.status(400).json({ error: "Unknown channel_id" }); return; }

  try {
    const [row] = await db
      .insert(channelListingsTable)
      .values({
        channel_id: channelId,
        space_id: spaceId,
        external_listing_id: b.external_listing_id ? String(b.external_listing_id) : null,
        listing_url: b.listing_url ? String(b.listing_url) : null,
        ical_import_url: b.ical_import_url ? String(b.ical_import_url) : null,
      })
      .returning();
    await logAction({ entityType: "space", entityId: spaceId, action: "CREATE", newValue: { channel_listing: row.id } });
    res.status(201).json({ success: true, data: row });
  } catch (e) {
    // unique(space_id, channel_id) violation → already mapped
    res.status(409).json({ error: "This space is already mapped to that channel" });
  }
});

/* PATCH /api/v1/channel-listings/:listingId — update url / toggles / status. */
router.patch("/v1/channel-listings/:listingId", async (req, res): Promise<void> => {
  const listingId = Number(req.params.listingId);
  if (!listingId) { res.status(400).json({ error: "Invalid listing id" }); return; }

  const b = req.body ?? {};
  const patch: Record<string, unknown> = {};
  if ("ical_import_url" in b) patch.ical_import_url = b.ical_import_url ? String(b.ical_import_url) : null;
  if ("listing_url" in b) patch.listing_url = b.listing_url ? String(b.listing_url) : null;
  if ("external_listing_id" in b) patch.external_listing_id = b.external_listing_id ? String(b.external_listing_id) : null;
  if ("sync_enabled" in b) patch.sync_enabled = !!b.sync_enabled;
  if ("sync_availability" in b) patch.sync_availability = !!b.sync_availability;
  if ("status" in b) patch.status = String(b.status);
  if (Object.keys(patch).length === 0) { res.status(400).json({ error: "No updatable fields provided" }); return; }

  const [row] = await db.update(channelListingsTable).set(patch).where(eq(channelListingsTable.id, listingId)).returning();
  if (!row) { res.status(404).json({ error: "Listing not found" }); return; }
  res.json({ success: true, data: row });
});

/* DELETE /api/v1/channel-listings/:listingId — unmap + clear its imported blocks. */
router.delete("/v1/channel-listings/:listingId", async (req, res): Promise<void> => {
  const listingId = Number(req.params.listingId);
  if (!listingId) { res.status(400).json({ error: "Invalid listing id" }); return; }

  await db.transaction(async (tx) => {
    // Remove only the ical blocks this listing created; manual blocks stay.
    await tx
      .delete(spaceAvailabilityTable)
      .where(and(eq(spaceAvailabilityTable.channel_listing_id, listingId), eq(spaceAvailabilityTable.source, "ical")));
    await tx.delete(channelListingsTable).where(eq(channelListingsTable.id, listingId));
  });
  res.json({ success: true });
});

/* POST /api/v1/channel-listings/:listingId/import — trigger a sync now. */
router.post("/v1/channel-listings/:listingId/import", async (req, res): Promise<void> => {
  const listingId = Number(req.params.listingId);
  if (!listingId) { res.status(400).json({ error: "Invalid listing id" }); return; }

  const [listing] = await db
    .select({
      id: channelListingsTable.id,
      space_id: channelListingsTable.space_id,
      channel_id: channelListingsTable.channel_id,
      ical_import_url: channelListingsTable.ical_import_url,
    })
    .from(channelListingsTable)
    .where(eq(channelListingsTable.id, listingId));

  if (!listing) { res.status(404).json({ error: "Listing not found" }); return; }
  if (!listing.ical_import_url) { res.status(400).json({ error: "Listing has no ical_import_url" }); return; }

  const result = await syncChannelListingImport(listing);
  res.status(result.status === "success" ? 200 : 502).json({ success: result.status === "success", data: result });
});

/* ───────────────────────────────────────────────────────
   GET /api/v1/spaces/:id/channel-calendar?from=&to=
   Unified read view: per-date status with source/channel
   attribution across manual blocks, OTA imports, bookings
   and contracts, plus a double-booking conflict flag.
──────────────────────────────────────────────────────── */
const ACTIVE_BOOKING_STATUSES = ["Confirmed", "Pending", "Active"];

router.get("/v1/spaces/:id/channel-calendar", async (req, res): Promise<void> => {
  const spaceId = Number(req.params.id);
  if (!spaceId) { res.status(400).json({ error: "Invalid space id" }); return; }

  const today = new Date().toISOString().slice(0, 10);
  const from = String(req.query.from ?? today);
  let to = String(req.query.to ?? addDays(from, 60));
  // Guard against runaway ranges.
  if (to > addDays(from, 400)) to = addDays(from, 400);
  if (to < from) to = from;

  const listings = await db
    .select({ id: channelListingsTable.id, channel_id: channelListingsTable.channel_id, channel_name: channelsTable.name })
    .from(channelListingsTable)
    .leftJoin(channelsTable, eq(channelListingsTable.channel_id, channelsTable.id))
    .where(eq(channelListingsTable.space_id, spaceId));
  const listingChannel = new Map(listings.map((l) => [l.id, l.channel_name]));

  const [blocks, bookings, contracts] = await Promise.all([
    db
      .select({
        date: spaceAvailabilityTable.date,
        source: spaceAvailabilityTable.source,
        channel_listing_id: spaceAvailabilityTable.channel_listing_id,
        block_reason: spaceAvailabilityTable.block_reason,
      })
      .from(spaceAvailabilityTable)
      .where(and(
        eq(spaceAvailabilityTable.space_id, spaceId),
        eq(spaceAvailabilityTable.is_available, false),
        gte(spaceAvailabilityTable.date, from),
        lte(spaceAvailabilityTable.date, to),
      )),
    db
      .select({
        id: bookingsTable.id,
        booking_ref: bookingsTable.booking_ref,
        booking_source: bookingsTable.booking_source,
        check_in_date: bookingsTable.check_in_date,
        check_out_date: bookingsTable.check_out_date,
      })
      .from(bookingsTable)
      .where(and(
        eq(bookingsTable.space_id, spaceId),
        eq(bookingsTable.status, "Active"),
        inArray(bookingsTable.booking_status, ACTIVE_BOOKING_STATUSES),
        isNotNull(bookingsTable.check_in_date),
        isNotNull(bookingsTable.check_out_date),
        lte(bookingsTable.check_in_date, to),
        gte(bookingsTable.check_out_date, from),
      )),
    db
      .select({ id: contractsTable.id, start_date: contractsTable.start_date, end_date: contractsTable.end_date })
      .from(contractsTable)
      .where(and(
        eq(contractsTable.space_id, spaceId),
        inArray(contractsTable.status, ["Signed", "Active"]),
        isNotNull(contractsTable.start_date),
        lte(contractsTable.start_date, to),
        or(isNull(contractsTable.end_date), gte(contractsTable.end_date, from)),
      )),
  ]);

  const blockByDate = new Map(blocks.map((b) => [String(b.date), b]));

  const days: Array<{
    date: string;
    status: "available" | "blocked" | "booked" | "contracted";
    source: string | null;
    channel_name: string | null;
    booking_ref: string | null;
    block_reason: string | null;
    conflict: boolean;
  }> = [];
  const summary = { available: 0, blocked: 0, booked: 0, contracted: 0, conflicts: 0 };

  for (let d = from; d <= to; d = addDays(d, 1)) {
    // checkout date is exclusive; contract end_date is inclusive
    const bk = bookings.filter((b) => b.check_in_date! <= d && d < b.check_out_date!);
    const ct = contracts.filter((c) => c.start_date! <= d && (!c.end_date || d <= c.end_date));
    const blk = blockByDate.get(d);
    const otaBlock = !!blk && (blk.source === "ical" || blk.source === "channel_api");
    // Double-booking risk: an internal booking plus an OTA-reported block, or
    // two overlapping internal bookings. Manual blocks are intentional, not conflicts.
    const conflict = bk.length >= 2 || (bk.length >= 1 && otaBlock);

    let status: "available" | "blocked" | "booked" | "contracted" = "available";
    let source: string | null = null;
    let channel_name: string | null = null;
    let booking_ref: string | null = null;

    if (bk.length > 0) {
      status = "booked";
      source = bk[0].booking_source ?? "Direct";
      booking_ref = bk[0].booking_ref;
    } else if (ct.length > 0) {
      status = "contracted";
    } else if (blk) {
      status = "blocked";
      source = blk.source;
      channel_name = blk.channel_listing_id ? listingChannel.get(blk.channel_listing_id) ?? null : null;
    }

    days.push({ date: d, status, source, channel_name, booking_ref, block_reason: blk?.block_reason ?? null, conflict });
    summary[status]++;
    if (conflict) summary.conflicts++;
  }

  res.json({
    success: true,
    data: {
      space_id: spaceId,
      from,
      to,
      channels: listings.map((l) => ({ listing_id: l.id, channel_id: l.channel_id, channel_name: l.channel_name })),
      days,
      summary,
    },
  });
});

/* GET /api/v1/channel-listings/:listingId/sync-logs — recent sync history. */
router.get("/v1/channel-listings/:listingId/sync-logs", async (req, res): Promise<void> => {
  const listingId = Number(req.params.listingId);
  if (!listingId) { res.status(400).json({ error: "Invalid listing id" }); return; }
  const rows = await db
    .select()
    .from(channelSyncLogsTable)
    .where(eq(channelSyncLogsTable.channel_listing_id, listingId))
    .orderBy(desc(channelSyncLogsTable.started_at))
    .limit(20);
  res.json({ success: true, data: rows });
});

/* ═══════════════════════════════════════════════════════
   Channel API framework (Stage 4)
══════════════════════════════════════════════════════════ */

/* GET /api/v1/channels/:channelId/accounts — connection/credential records. */
router.get("/v1/channels/:channelId/accounts", async (req, res): Promise<void> => {
  const channelId = Number(req.params.channelId);
  if (!channelId) { res.status(400).json({ error: "Invalid channel id" }); return; }
  const rows = await db
    .select({
      id: channelAccountsTable.id,
      channel_id: channelAccountsTable.channel_id,
      label: channelAccountsTable.label,
      auth_type: channelAccountsTable.auth_type,
      external_account_id: channelAccountsTable.external_account_id,
      status: channelAccountsTable.status,
      connected_at: channelAccountsTable.connected_at,
    }) // credentials_ref intentionally omitted from the response
    .from(channelAccountsTable)
    .where(eq(channelAccountsTable.channel_id, channelId))
    .orderBy(asc(channelAccountsTable.id));
  res.json({ success: true, data: rows });
});

/* POST /api/v1/channel-accounts — create a connection/credential record. */
router.post("/v1/channel-accounts", async (req, res): Promise<void> => {
  const b = req.body ?? {};
  const channelId = Number(b.channel_id);
  if (!channelId || !b.label) { res.status(400).json({ error: "channel_id and label are required" }); return; }

  const [channel] = await db.select({ id: channelsTable.id }).from(channelsTable).where(eq(channelsTable.id, channelId));
  if (!channel) { res.status(400).json({ error: "Unknown channel_id" }); return; }

  const [row] = await db
    .insert(channelAccountsTable)
    .values({
      channel_id: channelId,
      owner_account_id: b.owner_account_id ? Number(b.owner_account_id) : null,
      label: String(b.label),
      auth_type: b.auth_type ? String(b.auth_type) : "webhook",
      credentials_ref: b.credentials_ref ? String(b.credentials_ref) : null,
      external_account_id: b.external_account_id ? String(b.external_account_id) : null,
      connected_at: new Date(),
    })
    .returning({ id: channelAccountsTable.id, channel_id: channelAccountsTable.channel_id, label: channelAccountsTable.label, auth_type: channelAccountsTable.auth_type, status: channelAccountsTable.status });
  res.status(201).json({ success: true, data: row });
});

/* DELETE /api/v1/channel-accounts/:id */
router.delete("/v1/channel-accounts/:id", async (req, res): Promise<void> => {
  const accountId = Number(req.params.id);
  if (!accountId) { res.status(400).json({ error: "Invalid account id" }); return; }
  await db.delete(channelAccountsTable).where(eq(channelAccountsTable.id, accountId));
  res.json({ success: true });
});

/* GET /api/v1/spaces/:id/rate-calendar?from=&to= — per-date rates & restrictions. */
router.get("/v1/spaces/:id/rate-calendar", async (req, res): Promise<void> => {
  const spaceId = Number(req.params.id);
  if (!spaceId) { res.status(400).json({ error: "Invalid space id" }); return; }
  const today = new Date().toISOString().slice(0, 10);
  const from = String(req.query.from ?? today);
  let to = String(req.query.to ?? addDays(from, 60));
  if (to > addDays(from, 400)) to = addDays(from, 400);

  const rows = await db
    .select()
    .from(spaceRateCalendarTable)
    .where(and(eq(spaceRateCalendarTable.space_id, spaceId), gte(spaceRateCalendarTable.date, from), lte(spaceRateCalendarTable.date, to)))
    .orderBy(asc(spaceRateCalendarTable.date));
  res.json({ success: true, data: rows });
});

/* PUT /api/v1/spaces/:id/rate-calendar — upsert a batch of per-date rates. */
router.put("/v1/spaces/:id/rate-calendar", async (req, res): Promise<void> => {
  const spaceId = Number(req.params.id);
  if (!spaceId) { res.status(400).json({ error: "Invalid space id" }); return; }
  const rates = Array.isArray(req.body?.rates) ? req.body.rates : [];
  if (rates.length === 0) { res.status(400).json({ error: "rates[] is required" }); return; }

  let count = 0;
  for (const r of rates) {
    if (!r?.date) continue;
    await db
      .insert(spaceRateCalendarTable)
      .values({
        space_id: spaceId,
        date: String(r.date),
        rate: r.rate != null ? String(r.rate) : null,
        currency: r.currency ? String(r.currency) : "AUD",
        min_stay: r.min_stay != null ? Number(r.min_stay) : null,
        max_stay: r.max_stay != null ? Number(r.max_stay) : null,
        closed_to_arrival: !!r.closed_to_arrival,
        closed_to_departure: !!r.closed_to_departure,
      })
      .onConflictDoUpdate({
        target: [spaceRateCalendarTable.space_id, spaceRateCalendarTable.date],
        set: {
          rate: r.rate != null ? String(r.rate) : null,
          currency: r.currency ? String(r.currency) : "AUD",
          min_stay: r.min_stay != null ? Number(r.min_stay) : null,
          max_stay: r.max_stay != null ? Number(r.max_stay) : null,
          closed_to_arrival: !!r.closed_to_arrival,
          closed_to_departure: !!r.closed_to_departure,
        },
      });
    count++;
  }
  res.json({ success: true, data: { upserted: count } });
});

/* POST /api/v1/channel-listings/:listingId/push-availability — push to channel (mock). */
router.post("/v1/channel-listings/:listingId/push-availability", async (req, res): Promise<void> => {
  const listingId = Number(req.params.listingId);
  if (!listingId) { res.status(400).json({ error: "Invalid listing id" }); return; }
  try {
    const result = await pushAvailabilityForListing(listingId);
    res.status(result.ok ? 200 : 502).json({ success: result.ok, data: result });
  } catch (e) {
    res.status(404).json({ error: e instanceof Error ? e.message : "push failed" });
  }
});

/* POST /api/v1/channel-listings/:listingId/push-rates — push to channel (mock). */
router.post("/v1/channel-listings/:listingId/push-rates", async (req, res): Promise<void> => {
  const listingId = Number(req.params.listingId);
  if (!listingId) { res.status(400).json({ error: "Invalid listing id" }); return; }
  try {
    const result = await pushRatesForListing(listingId);
    res.status(result.ok ? 200 : 502).json({ success: result.ok, data: result });
  } catch (e) {
    res.status(404).json({ error: e instanceof Error ? e.message : "push failed" });
  }
});

/* GET /api/v1/spaces/:id/channel-reservations — ingested OTA reservations. */
router.get("/v1/spaces/:id/channel-reservations", async (req, res): Promise<void> => {
  const spaceId = Number(req.params.id);
  if (!spaceId) { res.status(400).json({ error: "Invalid space id" }); return; }
  const rows = await db
    .select({
      id: channelReservationsTable.id,
      channel_id: channelReservationsTable.channel_id,
      external_reservation_id: channelReservationsTable.external_reservation_id,
      booking_id: channelReservationsTable.booking_id,
      guest_name: channelReservationsTable.guest_name,
      check_in_date: channelReservationsTable.check_in_date,
      check_out_date: channelReservationsTable.check_out_date,
      total_amount: channelReservationsTable.total_amount,
      currency: channelReservationsTable.currency,
      reservation_status: channelReservationsTable.reservation_status,
      received_at: channelReservationsTable.received_at,
    })
    .from(channelReservationsTable)
    .where(eq(channelReservationsTable.space_id, spaceId))
    .orderBy(desc(channelReservationsTable.received_at))
    .limit(100);
  res.json({ success: true, data: rows });
});

export default router;
