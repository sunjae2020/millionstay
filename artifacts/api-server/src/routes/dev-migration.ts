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
      return res.status(404).json({ error: "seed-migration.sql not found" });
    }

    const rawSql = fs.readFileSync(sqlFilePath, "utf-8");
    const statements = rawSql
      .split(/;\s*\n/)
      .map((s) => s.trim())
      .filter((s) =>
        s.length > 0 &&
        (s.startsWith("INSERT INTO") || s.startsWith("SELECT pg_catalog.setval"))
      );

    let executed = 0;
    const errors: string[] = [];

    await db.transaction(async (tx) => {
      await tx.execute(sql.raw(`TRUNCATE TABLE
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
        const sp = `sp_mig_${i}`;
        try {
          await tx.execute(sql.raw(`SAVEPOINT ${sp}`));
          await tx.execute(sql.raw(stmt));
          executed++;
        } catch (err: any) {
          try { await tx.execute(sql.raw(`ROLLBACK TO SAVEPOINT ${sp}`)); } catch {}
          errors.push(`[${i}] ${stmt.slice(0, 60)}... => ${err?.message ?? "unknown"}`);
        }
      }
    });

    return res.json({
      success: true,
      executed,
      errorCount: errors.length,
      errors: errors.slice(0, 20),
      message: `Migration complete. ${executed} executed, ${errors.length} errors.`,
    });
  } catch (err: any) {
    console.error("Migration failed:", err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
