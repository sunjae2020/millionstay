import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  numeric,
  date,
  jsonb,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * OTA Channel Integration — Stage 0 data model
 *
 * Tables that let MillionStay spaces be published to and synced with external
 * booking channels (Airbnb, Booking.com, Hotels.com/Expedia, …).
 *
 * Design notes:
 *  - `space_availability` is the single source of truth (SSOT) for the calendar.
 *    Channel imports write blocks there with a `source`/`external_uid` so that
 *    re-syncs are idempotent. These tables sit *around* that calendar.
 *  - Following the existing house style, foreign keys are plain `integer`
 *    columns (no DB-level FK constraints); integrity is enforced in the app.
 *  - iCal MVP (Stages 1–3) only needs `channels`, `channel_listings`,
 *    `channel_sync_logs`. `channel_accounts`, `channel_reservations` and
 *    `space_rate_calendar` come online with the Channel API (Stage 4) but are
 *    defined now to avoid later schema churn.
 *
 * See: docs/proposals/OTA_CHANNEL_INTEGRATION_DATA_MODEL.md
 */

// ---------------------------------------------------------------------------
// channels — master list of supported external booking channels
// ---------------------------------------------------------------------------
export const channelsTable = pgTable("channels", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(), // "airbnb" | "booking_com" | "expedia" | "direct"
  name: text("name").notNull(), // display name, e.g. "Airbnb"
  // Which connectivity methods this channel supports (drives UI/logic branching)
  supports_ical: boolean("supports_ical").notNull().default(true),
  supports_api: boolean("supports_api").notNull().default(false),
  logo_url: text("logo_url"),
  enabled: boolean("enabled").notNull().default(true),
  sort_order: integer("sort_order").notNull().default(0),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// ---------------------------------------------------------------------------
// channel_accounts — a connection / credential unit per channel + owner scope
// ---------------------------------------------------------------------------
export const channelAccountsTable = pgTable(
  "channel_accounts",
  {
    id: serial("id").primaryKey(),
    channel_id: integer("channel_id").notNull(),
    // Owner scope (existing accounts table — landlord/owner). Null = platform-wide.
    owner_account_id: integer("owner_account_id"),
    label: text("label").notNull(), // "Airbnb - Host Kim"
    // Credentials are NEVER stored in plaintext. `credentials_ref` points at a
    // secret-manager key or holds an app-encrypted payload. iCal needs none.
    auth_type: text("auth_type").notNull().default("ical"), // "ical" | "oauth" | "api_key"
    credentials_ref: text("credentials_ref"),
    external_account_id: text("external_account_id"), // OTA-side host/account id
    status: text("status").notNull().default("Active"), // Active | Disabled | Error
    last_error: text("last_error"),
    connected_at: timestamp("connected_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("idx_channel_accounts_channel").on(t.channel_id),
    index("idx_channel_accounts_owner").on(t.owner_account_id),
  ],
);

// ---------------------------------------------------------------------------
// channel_listings — mapping of one space to its external listing on a channel
// (the heart of the integration; everything hangs off this row)
// ---------------------------------------------------------------------------
export const channelListingsTable = pgTable(
  "channel_listings",
  {
    id: serial("id").primaryKey(),
    channel_id: integer("channel_id").notNull(),
    channel_account_id: integer("channel_account_id"),
    space_id: integer("space_id").notNull(),
    // External identifiers
    external_listing_id: text("external_listing_id"),
    external_room_id: text("external_room_id"),
    listing_url: text("listing_url"),
    // iCal — bidirectional
    ical_import_url: text("ical_import_url"), // OTA -> us (pull)
    ical_export_enabled: boolean("ical_export_enabled").notNull().default(true), // us -> OTA
    // Sync toggles (by direction/target)
    sync_enabled: boolean("sync_enabled").notNull().default(true),
    sync_availability: boolean("sync_availability").notNull().default(true),
    sync_rates: boolean("sync_rates").notNull().default(false), // enabled at Stage 4
    // Status / tracking
    last_import_at: timestamp("last_import_at", { withTimezone: true }),
    last_export_at: timestamp("last_export_at", { withTimezone: true }),
    last_sync_status: text("last_sync_status"), // success | partial | failed
    status: text("status").notNull().default("Active"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    unique("channel_listings_space_channel_uq").on(t.space_id, t.channel_id),
    index("idx_channel_listings_space").on(t.space_id),
    index("idx_channel_listings_channel").on(t.channel_id),
  ],
);

// ---------------------------------------------------------------------------
// channel_reservations — OTA reservation ingestion + mapping to internal bookings
// ---------------------------------------------------------------------------
export const channelReservationsTable = pgTable(
  "channel_reservations",
  {
    id: serial("id").primaryKey(),
    channel_id: integer("channel_id").notNull(),
    channel_listing_id: integer("channel_listing_id").notNull(),
    external_reservation_id: text("external_reservation_id").notNull(), // OTA reservation no.
    booking_id: integer("booking_id"), // matched internal booking (null = unmatched)
    space_id: integer("space_id"),
    // Guest / stay snapshot held before a booking row is created
    guest_name: text("guest_name"),
    guest_email: text("guest_email"),
    check_in_date: date("check_in_date"),
    check_out_date: date("check_out_date"),
    num_guests: integer("num_guests"),
    total_amount: numeric("total_amount", { precision: 12, scale: 2 }),
    currency: text("currency"),
    channel_status: text("channel_status"), // raw OTA-side status
    reservation_status: text("reservation_status").notNull().default("Received"), // Received | Mapped | Cancelled | Error
    raw_payload: jsonb("raw_payload"), // original payload kept for audit/reprocess
    received_at: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    unique("channel_reservations_ext_uq").on(t.channel_id, t.external_reservation_id),
    index("idx_channel_reservations_booking").on(t.booking_id),
    index("idx_channel_reservations_listing").on(t.channel_listing_id),
  ],
);

// ---------------------------------------------------------------------------
// channel_sync_logs — operational log of every sync attempt
// ---------------------------------------------------------------------------
export const channelSyncLogsTable = pgTable(
  "channel_sync_logs",
  {
    id: serial("id").primaryKey(),
    channel_listing_id: integer("channel_listing_id"),
    channel_id: integer("channel_id"),
    direction: text("direction").notNull(), // import | export
    sync_type: text("sync_type").notNull(), // availability | rates | reservations
    status: text("status").notNull(), // success | partial | failed
    items_processed: integer("items_processed").notNull().default(0),
    items_failed: integer("items_failed").notNull().default(0),
    error_message: text("error_message"),
    started_at: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finished_at: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_channel_sync_logs_listing").on(t.channel_listing_id),
    index("idx_channel_sync_logs_started").on(t.started_at),
  ],
);

// ---------------------------------------------------------------------------
// space_rate_calendar — per-date rate / stay restrictions (Stage 4, Channel API)
// iCal cannot carry rates, so this stays empty until API sync; falls back to
// spaces.base_daily_price when a date has no row.
// ---------------------------------------------------------------------------
export const spaceRateCalendarTable = pgTable(
  "space_rate_calendar",
  {
    id: serial("id").primaryKey(),
    space_id: integer("space_id").notNull(),
    date: date("date").notNull(),
    rate: numeric("rate", { precision: 12, scale: 2 }),
    currency: text("currency").notNull().default("AUD"),
    min_stay: integer("min_stay"),
    max_stay: integer("max_stay"),
    closed_to_arrival: boolean("closed_to_arrival").notNull().default(false),
    closed_to_departure: boolean("closed_to_departure").notNull().default(false),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    unique("space_rate_calendar_uq").on(t.space_id, t.date),
    index("idx_space_rate_calendar_space_date").on(t.space_id, t.date),
  ],
);

// ---------------------------------------------------------------------------
// Insert schemas + types
// ---------------------------------------------------------------------------
export const insertChannelSchema = createInsertSchema(channelsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertChannel = z.infer<typeof insertChannelSchema>;
export type Channel = typeof channelsTable.$inferSelect;

export const insertChannelAccountSchema = createInsertSchema(channelAccountsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertChannelAccount = z.infer<typeof insertChannelAccountSchema>;
export type ChannelAccount = typeof channelAccountsTable.$inferSelect;

export const insertChannelListingSchema = createInsertSchema(channelListingsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertChannelListing = z.infer<typeof insertChannelListingSchema>;
export type ChannelListing = typeof channelListingsTable.$inferSelect;

export const insertChannelReservationSchema = createInsertSchema(channelReservationsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertChannelReservation = z.infer<typeof insertChannelReservationSchema>;
export type ChannelReservation = typeof channelReservationsTable.$inferSelect;

export const insertChannelSyncLogSchema = createInsertSchema(channelSyncLogsTable).omit({
  id: true,
});
export type InsertChannelSyncLog = z.infer<typeof insertChannelSyncLogSchema>;
export type ChannelSyncLog = typeof channelSyncLogsTable.$inferSelect;

export const insertSpaceRateCalendarSchema = createInsertSchema(spaceRateCalendarTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertSpaceRateCalendar = z.infer<typeof insertSpaceRateCalendarSchema>;
export type SpaceRateCalendar = typeof spaceRateCalendarTable.$inferSelect;
