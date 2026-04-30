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
    const appliedHash = (metaRows[0] as any)?.value ?? null;

    if (appliedHash === seedHash) {
      logger.info({ seedHash: seedHash.slice(0, 12) }, "Seed unchanged — skipping auto-migration");
      return;
    }

    logger.info(
      { appliedHash: appliedHash?.slice(0, 12) ?? "none", newHash: seedHash.slice(0, 12) },
      "Seed changed — running full sync from dev DB..."
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
