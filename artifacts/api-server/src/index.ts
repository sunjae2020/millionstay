import app from "./app";
import { logger } from "./lib/logger";
import { loadSettingsFromDb } from "./routes/integrations";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

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
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const sqlFilePath = path.resolve(__dirname, "seed-migration.sql");
    if (!fs.existsSync(sqlFilePath)) {
      logger.warn("seed-migration.sql not found — skipping auto-migration");
      return;
    }

    // Only auto-migrate in production — dev DB is managed manually
    if (process.env.NODE_ENV !== "production") return;

    const seedSql = fs.readFileSync(sqlFilePath, "utf-8");

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

    // Only extract INSERT INTO and setval statements
    const statements = seedSql
      .split(/;\s*\n/)
      .map((s) => s.trim())
      .filter((s) =>
        s.length > 0 &&
        (s.startsWith("INSERT INTO") || s.startsWith("SELECT pg_catalog.setval"))
      );

    let executed = 0;
    let errors = 0;

    await db.transaction(async (tx) => {
      // TRUNCATE all data tables (complete list) — CASCADE handles FK order
      await tx.execute(sql.raw(`TRUNCATE TABLE
        page_contents, blog_posts, announcements,
        guest_direct_messages, guest_emergency_contacts,
        booking_services, contract_line_items,
        partner_users,
        suburbs, product_groups, product_types, contract_types, payment_info,
        contacts, accounts, leads, tasks,
        admin_users, guest_users,
        properties, spaces, space_options, space_policies,
        space_images, space_availability, space_blocked_dates, space_option_maps,
        service_catalog, accommodation_catalog, accommodation_service_catalog,
        space_service_catalog, promotions, beneficiaries, commissions,
        contracts, bookings, booking_documents, contract_products,
        invoices, recurring_schedule,
        integration_settings, email_template, email_log,
        service_hosts, system_log, work_orders,
        cs_tickets, cs_messages
        RESTART IDENTITY CASCADE`));

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        const sp = `sp_${i}`;
        try {
          await tx.execute(sql.raw(`SAVEPOINT ${sp}`));
          await tx.execute(sql.raw(stmt));
          executed++;
        } catch {
          try { await tx.execute(sql.raw(`ROLLBACK TO SAVEPOINT ${sp}`)); } catch {}
          errors++;
        }
      }
    });

    // Record the applied hash so we don't re-apply on next restart
    await db.execute(sql.raw(`
      INSERT INTO _seed_meta (key, value, updated_at)
      VALUES ('seed_hash', '${seedHash}', NOW())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `));

    logger.info({ executed, errors }, "Auto-migration complete — production DB synced from dev");
  } catch (err) {
    logger.error({ err }, "Auto-migration failed");
  }
}

// Load persisted integration settings from DB into process.env before starting
loadSettingsFromDb().catch(() => {});
ensureAdminExists().catch(() => {});
autoMigrateIfEmpty().catch(() => {});

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
