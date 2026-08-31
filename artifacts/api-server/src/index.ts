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
import { generateLeaseRentInvoices } from "./lib/billing/leaseRentInvoices";
import { sendRentDunning, sendRentDueNotices } from "./lib/billing/rentDunning";
import { generateConsolidatedInvoices } from "./lib/billing/consolidatedInvoices";
import { checkWorkOrderSla } from "./lib/dispatch/workOrderDispatch";
import { runCampaignSends } from "./lib/marketing/worker";

// Structured, greppable failure record for scheduled jobs. Every cron catch
// handler goes through this so one grep for `cron_failure` (or a log query on
// event=cron_failure) surfaces every silently failing job. Logging only — no
// email/webhook fan-out, so a repeatedly failing cron can never spam anyone.
function cronFailure(job: string): (err: unknown) => void {
  return (err) => logger.error({ err, cron: job, event: "cron_failure" }, `Cron job failed: ${job}`);
}

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
      const email = process.env["SEED_ADMIN_EMAIL"] ?? "admin@millionstay.com";
      const password = process.env["SEED_ADMIN_PASSWORD"];
      // Never bootstrap with a predictable built-in password (H-902). Require an
      // explicit SEED_ADMIN_PASSWORD; otherwise skip and let an operator run the
      // seed-admin CLI (which prints a generated password).
      if (!password) {
        logger.warn(
          "No users exist and SEED_ADMIN_PASSWORD is not set — skipping admin auto-creation. " +
            "Set SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD (or run scripts/seed-admin.ts, which prints a generated password) to bootstrap the first Super Admin.",
        );
        return;
      }
      const password_hash = await bcrypt.hash(password, 12);
      await db.insert(usersTable).values({
        email,
        password_hash,
        // Canonical name — must match a row in `roles`. "Super Admin" (with a
    // space) is a different string and silently fails every SuperAdmin gate.
    role: "SuperAdmin",
        first_name: "Million",
        last_name: "Stay",
        is_active: true,
        force_password_change: true,
      });
      logger.info({ email }, "Default admin user created (password change required on first login)");
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
      .catch(cronFailure("exchange-rate-sync"));
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
    .catch(cronFailure("ical-import"));
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
      .catch(cronFailure("retention-purge"));
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
    // Gate on the per-tenant homestay module toggle — the same switch
    // routes/integrations.ts reads. integration_settings rows are loaded into
    // process.env at boot (loadSettingsFromDb) and re-applied on every admin
    // save (setIntegrationSetting), so this sync read sees runtime changes
    // without a DB call. Defaults ON when unset (only an explicit "false"
    // disables), so behaviour is unchanged for existing instances.
    if (process.env["HOMESTAY_MODULE_ENABLED"] === "false") {
      logger.info({ cron: "homestay-rent-billing" }, "Cron homestay rent billing skipped — HOMESTAY_MODULE_ENABLED=false");
      return;
    }
    generateRentCharges()
      .then((r) => logger.info({ ...r }, "Cron homestay rent billing"))
      .catch(cronFailure("homestay-rent-billing"));
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
      .catch(cronFailure("recurring-invoices"));
  },
  { timezone: "Australia/Sydney" },
);

// Korean monthly-lease rent — daily at 03:00 Sydney. Creates the current month's
// rent invoice for every Active contract carrying 월세 + 납입일 (no booking needed),
// then flags every past-due unpaid invoice as Overdue so the 미납 dashboard and the
// contract's 월세 입금 tab stay current. Idempotent (one invoice per contract-month);
// self-gates on LEASE_RENT_INVOICES_ENABLED, off by default.
cron.schedule(
  "0 3 * * *",
  () => {
    generateLeaseRentInvoices()
      .then((r) => { if (r.enabled) logger.info({ ...r }, "Cron lease rent billing"); })
      .catch(cronFailure("lease-rent-invoices"));
  },
  { timezone: "Australia/Sydney" },
);

// 연체 독촉 — 매일 09:30 Seoul. 인보이스 생성(03:00)보다 늦게 돌려 그날 새로 Overdue 가
// 된 건까지 포함한다. 오전에 보내는 이유는 밤에 오는 독촉이 불쾌하기 때문이고,
// 광고가 아니라 거래성이라 야간 금지 규정 대상은 아니지만 그래도 업무시간에 보낸다.
// DUNNING_ENABLED=true 인 테넌트에서만 실제로 발송한다(기본 꺼짐).
cron.schedule(
  "30 9 * * *",
  () => {
    sendRentDunning()
      .then((r) => {
        if (!r.enabled) return;
        logger.info({ ...r }, "Cron rent dunning");
        // 연락 수단이 없는 건은 조용히 넘어가면 영원히 통보가 안 된다 — 눈에 띄게 남긴다.
        if (r.noContact > 0) logger.warn({ noContact: r.noContact }, "연체 건 중 연락 수단 없음");
      })
      .catch(cronFailure("rent-dunning"));
  },
  { timezone: "Asia/Seoul" },
);

// 납부 기한 사전 안내 — 매일 09:00 Seoul, 독촉(09:30)보다 먼저.
// 밀린 뒤 독촉하는 것보다 기한 전에 알리는 편이 낫다 — 대부분 잊어서 밀린다.
cron.schedule(
  "0 9 * * *",
  () => {
    sendRentDueNotices()
      .then((r) => { if (r.enabled) logger.info({ ...r }, "Cron rent due notice"); })
      .catch(cronFailure("rent-due-notices"));
  },
  { timezone: "Asia/Seoul" },
);

// 통합(단체) 청구 — 매일 03:10 Sydney. 통합 청구를 켠 계정마다 그 달의 공간별
// 인보이스를 만들고 한 장의 통합 청구서로 묶는다(지난달 중간 입주분은 일할계산해
// 이월). 계정별 토글이 스위치이므로 별도 전역 설정은 없다. 멱등이라 같은 달에
// 다시 돌아도 금액만 재계산할 뿐 중복 발행하지 않는다.
cron.schedule(
  "10 3 * * *",
  () => {
    generateConsolidatedInvoices()
      .then((r) => { if (r.accounts) logger.info({ ...r }, "Cron consolidated invoicing"); })
      .catch(cronFailure("consolidated-invoicing"));
  },
  { timezone: "Australia/Sydney" },
);

// Work-order SLA watchdog (Phase 3): every 10 minutes, flag dispatched work
// orders the partner has not acknowledged past their SLA deadline as breached and
// escalate to admin. Idempotent (only touches sla_status='pending_ack' rows).
// Marketing campaign sends — every 5 minutes. The worker self-gates on
// MARKETING_ENABLED (off by default, so a new instance never starts mailing by
// surprise) and enforces each campaign's send window itself, which is why this
// registers a plain interval rather than a business-hours schedule: a recipient
// reached outside the window is deferred, not dropped.
cron.schedule("*/5 * * * *", () => {
  runCampaignSends()
    .then((r) => { if (r.enabled && (r.sent || r.failed || r.deferred)) logger.info({ ...r }, "Cron marketing campaign sends"); })
    .catch(cronFailure("marketing-campaign-sends"));
});

cron.schedule("*/10 * * * *", () => {
  checkWorkOrderSla()
    .then((r) => { if (r.breached) logger.warn({ ...r }, "Cron work-order SLA breaches"); })
    .catch(cronFailure("work-order-sla"));
});

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
