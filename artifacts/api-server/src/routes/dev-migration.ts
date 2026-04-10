import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = Router();

const MIGRATION_SECRET = "MS_MIGRATE_2026_PROD";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

router.post("/run-migration", async (req, res) => {
  const secret = req.headers["x-migration-secret"];
  if (secret !== MIGRATION_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const sqlFilePath = path.resolve(__dirname, "seed-migration.sql");
    if (!fs.existsSync(sqlFilePath)) {
      return res.status(404).json({ error: "Migration SQL file not found" });
    }

    const rawSql = fs.readFileSync(sqlFilePath, "utf-8");

    const statements = rawSql
      .split(/;\s*\n/)
      .map((s) => s.trim())
      .filter(
        (s) =>
          s.length > 0 &&
          !s.startsWith("--") &&
          !s.startsWith("\\")
      );

    let executed = 0;
    let errors: string[] = [];

    await db.transaction(async (tx) => {
      await tx.execute(sql.raw(`SET CONSTRAINTS ALL DEFERRED`));

      await tx.execute(
        sql.raw(`TRUNCATE TABLE
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
        RESTART IDENTITY CASCADE`)
      );

      for (const stmt of statements) {
        if (
          stmt.startsWith("SET ") ||
          stmt.startsWith("SELECT pg_catalog.set_config") ||
          stmt.startsWith("INSERT INTO")
        ) {
          try {
            await tx.execute(sql.raw(stmt));
            executed++;
          } catch (err: any) {
            errors.push(`${stmt.slice(0, 60)}... => ${err.message}`);
          }
        } else if (stmt.startsWith("SELECT pg_catalog.setval")) {
          try {
            await tx.execute(sql.raw(stmt));
            executed++;
          } catch (err: any) {
            errors.push(`setval error: ${err.message}`);
          }
        }
      }
    });

    return res.json({
      success: true,
      executed,
      errors,
      message: `Migration complete. ${executed} statements executed. ${errors.length} errors.`,
    });
  } catch (err: any) {
    console.error("Migration failed:", err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
