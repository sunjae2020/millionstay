import app from "./app";
import { logger } from "./lib/logger";
import { loadSettingsFromDb } from "./routes/integrations";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import fs from "fs";
import crypto from "crypto";
import cron from "node-cron";
import { SEED_FILE_PATH, importSeed } from "./lib/seedSync";
import { syncExchangeRates } from "./lib/exchangeRateSync";
import { syncAllChannelImports } from "./lib/icalImport";
import { purgeExpiredDocuments } from "./lib/retentionPurge";
import { generateRentCharges } from "./lib/homestay/monthlyBilling";
import { generateRecurringInvoices } from "./lib/billing/recurringInvoices";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function ensureAdminExists() {
  try {
    const [count] = await db.select({ n: sql<number>`count(*)` }).from(usersTable);
    if (Number(count?.n ?? 0) === 0) {
      const email = "admin@millionstay.com";
      const password = "MillionStay@2026!";
      const password_hash = await bcrypt.hash(password, 12);
      await db.insert(usersTable).values({
        email,
        password_hash,
        role: "Super Admin",
        first_name: "Million",
        last_name: "Stay",
        is_active: true,
        force_password_change: false,
      });
      logger.info({ email }, "Default admin user created");
    }
  } catch (err) {
    logger.error({ err }, "Failed to ensure admin user exists");
  }
}

async function autoMigrateIfEmpty() {
  try {
    if (!fs.existsSync(SEED_FILE_PATH)) {
      logger.warn("seed-migration.sql not found — skipping auto-migration");
      return;
    }

    // Only auto-migrate in production — dev DB is managed manually
    if (process.env.NODE_ENV !== "production") return;

    // OPT-IN SAFETY GATE: importSeed() TRUNCATEs live tables (bookings,
    // contracts, invoices, channel_*) and restores the seed snapshot. Running
    // that automatically on boot would wipe real customer & OTA-ingested
    // bookings whenever the seed file changes. It is therefore disabled unless
    // an operator explicitly opts in. To provision a fresh DB, deploy once with
    // FORCE_SEED_MIGRATE=true, then unset it. For surgical syncs use the
    // reviewed /api/v1/admin/db-sync/import endpoint instead.
    if (process.env.FORCE_SEED_MIGRATE !== "true") {
      logger.warn(
        "Boot-time seed auto-migration is opt-in — skipping to protect live data. " +
          "Set FORCE_SEED_MIGRATE=true to provision a fresh DB.",
      );
      return;
    }

    const seedSql = fs.readFileSync(SEED_FILE_PATH, "utf-8");

    // Compute SHA-256 hash of the seed file to detect changes
    const seedHash = crypto.createHash("sha256").update(seedSql).digest("hex");

    // Ensure the meta table exists to track applied seed hash
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS _seed_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `));

    const metaRows = await db.execute(sql.raw(
      `SELECT value FROM _seed_meta WHERE key = 'seed_hash'`
    ));
    const appliedHash = (metaRows as any)[0]?.value ?? null;

    if (appliedHash === seedHash) {
      logger.info({ seedHash: seedHash.slice(0, 12) }, "Seed unchanged — skipping auto-migration");
      return;
    }

    logger.info(
      { appliedHash: appliedHash?.slice(0, 12) ?? "none", newHash: seedHash.slice(0, 12) },
      "FORCE_SEED_MIGRATE set — running full sync from seed..."
    );

    // Boot path tolerates partial failures: starting up with most data is
    // better than starting up empty. The HTTP /db-sync/import path runs
    // strict (allowPartial=false).
    const result = await importSeed({ allowPartial: true });

    // Record the applied hash so we don't re-apply on next restart
    await db.execute(sql.raw(`
      INSERT INTO _seed_meta (key, value, updated_at)
      VALUES ('seed_hash', '${seedHash}', NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `));

    logger.info(
      { executed: result.executed, errors: result.errors, total: result.total },
      "Auto-migration complete — production DB synced from dev",
    );
  } catch (err) {
    logger.error({ err }, "Auto-migration failed");
  }
}

// Load persisted integration settings from DB into process.env before starting
loadSettingsFromDb().catch(() => {});
ensureAdminExists().catch(() => {});
autoMigrateIfEmpty().catch(() => {});

// Exchange rate sync — daily at midnight Sydney time, plus a boot-time refresh.
// Only runs when at least one currency pair is registered (sync service skips otherwise).
syncExchangeRates()
  .then((r) => logger.info({ ok: r.ok, updated: r.updated.length, skipped: r.skipped.length }, "Boot-time exchange rate sync"))
  .catch((err) => logger.error({ err }, "Boot-time exchange rate sync failed"));

cron.schedule(
  "0 0 * * *",
  () => {
    syncExchangeRates()
      .then((r) => logger.info({ ok: r.ok, updated: r.updated.length, skipped: r.skipped.length }, "Cron exchange rate sync"))
      .catch((err) => logger.error({ err }, "Cron exchange rate sync failed"));
  },
  { timezone: "Australia/Sydney" },
);

// OTA inbound iCal import — hourly, plus a boot-time run. Pulls each channel
// listing's remote calendar into space_availability (source='ical').
syncAllChannelImports()
  .then((r) => logger.info({ total: r.total, ok: r.ok, failed: r.failed }, "Boot-time iCal import sync"))
  .catch((err) => logger.error({ err }, "Boot-time iCal import sync failed"));

cron.schedule("0 * * * *", () => {
  syncAllChannelImports()
    .then((r) => logger.info({ total: r.total, ok: r.ok, failed: r.failed }, "Cron iCal import sync"))
    .catch((err) => logger.error({ err }, "Cron iCal import sync failed"));
});

// Retention purge (APP 11.5) — daily at 03:15 Sydney. Physically destroys
// documents whose retention has elapsed or that were soft-deleted by a DSAR
// deletion request (Cloudinary asset + DB row). Boot-time run on startup too.
purgeExpiredDocuments()
  .then((r) => logger.info({ scanned: r.scanned, destroyed: r.destroyed, errors: r.errors }, "Boot-time retention purge"))
  .catch((err) => logger.error({ err }, "Boot-time retention purge failed"));

cron.schedule(
  "15 3 * * *",
  () => {
    purgeExpiredDocuments()
      .then((r) => logger.info({ scanned: r.scanned, destroyed: r.destroyed, errors: r.errors }, "Cron retention purge"))
      .catch((err) => logger.error({ err }, "Cron retention purge failed"));
  },
  { timezone: "Australia/Sydney" },
);

// Homestay rent — daily at 02:00 Sydney. Generates a PENDING per-cycle charge for
// each Active placement whose next_billing_date is due (within the lead window);
// ops send/collect each from the admin. No boot-time run (would risk duplicate
// charges on restart; the per-period guard also protects against this).
cron.schedule(
  "0 2 * * *",
  () => {
    generateRentCharges()
      .then((r) => logger.info({ ...r }, "Cron homestay rent billing"))
      .catch((err) => logger.error({ err }, "Cron homestay rent billing failed"));
  },
  { timezone: "Australia/Sydney" },
);

// Recurring rent for regular long-term contracts — daily at 02:30 Sydney.
// Generates one "Sent" invoice per due cycle for schedules opted into incremental
// billing (billing_mode='incremental'); legacy pre-generated contracts are
// untouched. The cron is always registered; generateRecurringInvoices() self-gates
// on the RECURRING_INVOICES_ENABLED setting (integration_settings, env override) at
// run time, so ops can toggle it from the admin with no redeploy. Off by default.
// No boot-time run (avoids duplicate charges on restart).
cron.schedule(
  "30 2 * * *",
  () => {
    generateRecurringInvoices()
      .then((r) => logger.info({ ...r }, "Cron recurring invoice billing"))
      .catch((err) => logger.error({ err }, "Cron recurring invoice billing failed"));
  },
  { timezone: "Australia/Sydney" },
);

const server = app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port, env: process.env["NODE_ENV"] ?? "development" }, "Server listening");
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down");
  process.exit(0);
});
