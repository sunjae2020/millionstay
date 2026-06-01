-- OTA Channel Integration — Stage 0 data model
-- Additive migration: new channel_* tables + space_availability / spaces extensions.
-- Idempotent (IF NOT EXISTS / guarded constraints). Safe to re-run.
-- See: docs/proposals/OTA_CHANNEL_INTEGRATION_DATA_MODEL.md

BEGIN;

-- ---------------------------------------------------------------------------
-- channels
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS channels (
  id            serial PRIMARY KEY,
  code          text NOT NULL,
  name          text NOT NULL,
  supports_ical boolean NOT NULL DEFAULT true,
  supports_api  boolean NOT NULL DEFAULT false,
  logo_url      text,
  enabled       boolean NOT NULL DEFAULT true,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT channels_code_unique UNIQUE (code)
);

-- ---------------------------------------------------------------------------
-- channel_accounts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS channel_accounts (
  id                  serial PRIMARY KEY,
  channel_id          integer NOT NULL,
  owner_account_id    integer,
  label               text NOT NULL,
  auth_type           text NOT NULL DEFAULT 'ical',
  credentials_ref     text,
  external_account_id text,
  status              text NOT NULL DEFAULT 'Active',
  last_error          text,
  connected_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_channel_accounts_channel ON channel_accounts (channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_accounts_owner ON channel_accounts (owner_account_id);

-- ---------------------------------------------------------------------------
-- channel_listings  (space <-> external listing mapping; the heart)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS channel_listings (
  id                  serial PRIMARY KEY,
  channel_id          integer NOT NULL,
  channel_account_id  integer,
  space_id            integer NOT NULL,
  external_listing_id text,
  external_room_id    text,
  listing_url         text,
  ical_import_url     text,
  ical_export_enabled boolean NOT NULL DEFAULT true,
  sync_enabled        boolean NOT NULL DEFAULT true,
  sync_availability   boolean NOT NULL DEFAULT true,
  sync_rates          boolean NOT NULL DEFAULT false,
  last_import_at      timestamptz,
  last_export_at      timestamptz,
  last_sync_status    text,
  status              text NOT NULL DEFAULT 'Active',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT channel_listings_space_channel_uq UNIQUE (space_id, channel_id)
);
CREATE INDEX IF NOT EXISTS idx_channel_listings_space ON channel_listings (space_id);
CREATE INDEX IF NOT EXISTS idx_channel_listings_channel ON channel_listings (channel_id);

-- ---------------------------------------------------------------------------
-- channel_reservations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS channel_reservations (
  id                      serial PRIMARY KEY,
  channel_id              integer NOT NULL,
  channel_listing_id      integer NOT NULL,
  external_reservation_id text NOT NULL,
  booking_id              integer,
  space_id                integer,
  guest_name              text,
  guest_email             text,
  check_in_date           date,
  check_out_date          date,
  num_guests              integer,
  total_amount            numeric(12, 2),
  currency                text,
  channel_status          text,
  reservation_status      text NOT NULL DEFAULT 'Received',
  raw_payload             jsonb,
  received_at             timestamptz NOT NULL DEFAULT now(),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT channel_reservations_ext_uq UNIQUE (channel_id, external_reservation_id)
);
CREATE INDEX IF NOT EXISTS idx_channel_reservations_booking ON channel_reservations (booking_id);
CREATE INDEX IF NOT EXISTS idx_channel_reservations_listing ON channel_reservations (channel_listing_id);

-- ---------------------------------------------------------------------------
-- channel_sync_logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS channel_sync_logs (
  id                 serial PRIMARY KEY,
  channel_listing_id integer,
  channel_id         integer,
  direction          text NOT NULL,
  sync_type          text NOT NULL,
  status             text NOT NULL,
  items_processed    integer NOT NULL DEFAULT 0,
  items_failed       integer NOT NULL DEFAULT 0,
  error_message      text,
  started_at         timestamptz NOT NULL DEFAULT now(),
  finished_at        timestamptz
);
CREATE INDEX IF NOT EXISTS idx_channel_sync_logs_listing ON channel_sync_logs (channel_listing_id);
CREATE INDEX IF NOT EXISTS idx_channel_sync_logs_started ON channel_sync_logs (started_at);

-- ---------------------------------------------------------------------------
-- space_rate_calendar  (Stage 4, Channel API rate sync)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS space_rate_calendar (
  id                  serial PRIMARY KEY,
  space_id            integer NOT NULL,
  date                date NOT NULL,
  rate                numeric(12, 2),
  currency            text NOT NULL DEFAULT 'AUD',
  min_stay            integer,
  max_stay            integer,
  closed_to_arrival   boolean NOT NULL DEFAULT false,
  closed_to_departure boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT space_rate_calendar_uq UNIQUE (space_id, date)
);
CREATE INDEX IF NOT EXISTS idx_space_rate_calendar_space_date ON space_rate_calendar (space_id, date);

-- ---------------------------------------------------------------------------
-- space_availability extensions (SSOT source attribution)
-- ---------------------------------------------------------------------------
ALTER TABLE space_availability ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';
ALTER TABLE space_availability ADD COLUMN IF NOT EXISTS channel_listing_id integer;
ALTER TABLE space_availability ADD COLUMN IF NOT EXISTS external_uid text;
CREATE INDEX IF NOT EXISTS idx_space_avail_source ON space_availability (space_id, source);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'space_avail_external_uid_uq') THEN
    ALTER TABLE space_availability
      ADD CONSTRAINT space_avail_external_uid_uq UNIQUE (channel_listing_id, external_uid);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- spaces extension (outbound iCal feed token)
-- ---------------------------------------------------------------------------
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS ical_export_token text;

-- ---------------------------------------------------------------------------
-- seed supported channels
-- ---------------------------------------------------------------------------
INSERT INTO channels (code, name, supports_ical, supports_api, sort_order) VALUES
  ('airbnb',      'Airbnb',          true, false, 1),
  ('booking_com', 'Booking.com',     true, false, 2),
  ('expedia',     'Expedia / Hotels.com', true, false, 3),
  ('direct',      'Direct',          true, false, 0)
ON CONFLICT (code) DO NOTHING;

COMMIT;
