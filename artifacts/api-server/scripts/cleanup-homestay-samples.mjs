/**
 * cleanup-homestay-samples.mjs
 *
 * Reverses seed-homestay-samples.mjs. SOFT-deletes the sample applications
 * (sets deleted_at), CANCELS their signing requests, and DEACTIVATES the sample
 * host logins/accounts. Never hard-deletes production rows.
 *
 * Sample rows are identified by the "SAMPLE" name prefix and the plus-addressed
 * test inbox ("+sample-" in the email).
 *
 * ⚠️  Runs against the REAL DB. Gated by --confirm.
 *
 * Usage:
 *   DATABASE_URL=... node scripts/cleanup-homestay-samples.mjs --confirm
 */
import pg from "pg";
import { guardDbInstance } from "../../../scripts/lib/dbGuard.mjs";

const { Pool } = pg;

if (!process.argv.includes("--confirm")) {
  console.error("Refusing to run without --confirm. This mutates the live DB.");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL must be set.");
  process.exit(1);
}
guardDbInstance();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("supabase.") ? { rejectUnauthorized: false } : undefined,
});

const SAMPLE_NAME = "SAMPLE%";
const SAMPLE_EMAIL = "%+sample-%";

async function run() {
  const c = await pool.connect();
  try {
    // 1) Soft-delete sample student requests + cancel their signing requests.
    const stu = await c.query(
      `UPDATE homestay_student_requests
         SET deleted_at = now(), updated_at = now()
       WHERE deleted_at IS NULL
         AND (student_first_name LIKE $1 OR student_email LIKE $2)
       RETURNING id`,
      [SAMPLE_NAME, SAMPLE_EMAIL],
    );
    const stuIds = stu.rows.map((r) => r.id);
    if (stuIds.length) {
      await c.query(
        `UPDATE contract_signing_requests SET status = 'cancelled', updated_at = now()
         WHERE context_type = 'student_app' AND context_id = ANY($1) AND status <> 'cancelled'`,
        [stuIds],
      );
    }
    console.log(`Student requests soft-deleted: ${stuIds.length}`);

    // 2) Soft-delete sample host applications + cancel their signing requests.
    const host = await c.query(
      `UPDATE homestay_host_applications
         SET deleted_at = now(), updated_at = now()
       WHERE deleted_at IS NULL
         AND (first_name LIKE $1 OR email LIKE $2)
       RETURNING id, account_id, partner_user_id`,
      [SAMPLE_NAME, SAMPLE_EMAIL],
    );
    const hostIds = host.rows.map((r) => r.id);
    const accountIds = host.rows.map((r) => r.account_id).filter(Boolean);
    const partnerIds = host.rows.map((r) => r.partner_user_id).filter(Boolean);
    if (hostIds.length) {
      await c.query(
        `UPDATE contract_signing_requests SET status = 'cancelled', updated_at = now()
         WHERE context_type = 'host_app' AND context_id = ANY($1) AND status <> 'cancelled'`,
        [hostIds],
      );
    }
    // 3) Deactivate the sample host logins + accounts (don't hard-delete).
    if (partnerIds.length) {
      await c.query(`UPDATE partner_users SET is_active = false WHERE id = ANY($1)`, [partnerIds]);
    }
    if (accountIds.length) {
      await c.query(`UPDATE accounts SET status = 'Inactive' WHERE id = ANY($1)`, [accountIds]);
    }
    console.log(`Host applications soft-deleted: ${hostIds.length} (accounts deactivated: ${accountIds.length})`);

    console.log("Cleanup complete.");
  } finally {
    c.release();
    await pool.end();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
