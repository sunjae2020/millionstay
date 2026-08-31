/**
 * backfill-korean-name-split.mjs
 *
 * Existing contacts imported before the 성/이름 split convention often carry the
 * whole Korean 성함 in first_name with an empty last_name ("김민준" / ""). This
 * splits them using the same rule as the lease-list import (surname = first
 * syllable, 복성 exceptions honoured) so every contact stores 성 and 이름 apart.
 *
 * Safe to re-run: rows that already have a last_name are skipped, and non-Korean
 * names are never touched.
 *
 * Usage: DATABASE_URL=<db> node scripts/backfill-korean-name-split.mjs [--commit]
 */
import pg from "pg";
import { splitKoreanName } from "./lib/korean-name.mjs";
import { guardDbInstance } from "../../../scripts/lib/dbGuard.mjs";

const { Pool } = pg;
const COMMIT = process.argv.includes("--commit");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}
guardDbInstance();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL.replace(/[?&](pgbouncer|uselibpqcompat|sslnegotiation|sslmode)=[^&]*/g, ""),
  ssl: { rejectUnauthorized: false },
  max: 2,
});

const main = async () => {
  const client = await pool.connect();
  const changes = [];
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `select id, first_name, last_name from contacts
        where deleted_at is null and coalesce(last_name,'') = ''
          and first_name ~ '[가-힣]{2,}' order by id`
    );
    for (const r of rows) {
      const { last_name, first_name } = splitKoreanName(r.first_name);
      if (!last_name || !first_name) continue;
      changes.push({ id: r.id, from: r.first_name, last_name, first_name });
      await client.query(
        `update contacts set first_name = $2, last_name = $3, updated_at = now() where id = $1`,
        [r.id, first_name, last_name]
      );
    }
    await client.query(COMMIT ? "COMMIT" : "ROLLBACK");
  } finally {
    client.release();
    await pool.end();
  }
  console.log(COMMIT ? "✅ COMMITTED" : "🧪 DRY RUN (rolled back)");
  console.log(JSON.stringify({ updated: changes.length, changes }, null, 2));
};

main().catch((e) => { console.error(e); process.exit(1); });
