/**
 * export-seed.mjs
 * Generates seed-migration.sql from the current DEV database.
 * Run automatically as part of `pnpm run build`.
 *
 * Only runs when DATABASE_URL points to a non-production host
 * (i.e. the local/dev Postgres, not the production DB).
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(__dirname, '../src/seed-migration.sql');

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.warn('[export-seed] DATABASE_URL not set — skipping seed export');
  process.exit(0);
}

// Skip if pointing at Neon (production) to avoid overwriting seed with prod data
if (dbUrl.includes('neon.tech') || dbUrl.includes('neondb')) {
  console.log('[export-seed] Production DB detected — skipping seed export');
  process.exit(0);
}

console.log('[export-seed] Exporting seed data from dev DB...');

let dump;
try {
  dump = execSync(
    `pg_dump "${dbUrl}" --data-only --no-owner --no-acl --column-inserts --rows-per-insert=9999`,
    { encoding: 'utf8', maxBuffer: 100 * 1024 * 1024 }
  );
} catch (e) {
  console.error('[export-seed] pg_dump failed:', e.message);
  process.exit(1);
}

const linesOut = [];
let inInsert = false;
let buf = [];

for (const line of dump.split('\n')) {
  const s = line.trimEnd();
  if (!inInsert) {
    if (s.startsWith('INSERT INTO')) {
      inInsert = true;
      buf = [s];
      if (s.endsWith(';')) {
        linesOut.push(buf.join('\n'));
        buf = [];
        inInsert = false;
      }
    } else if (s.startsWith('SELECT pg_catalog.setval')) {
      linesOut.push(s);
    }
  } else {
    buf.push(s);
    if (s.endsWith(';')) {
      linesOut.push(buf.join('\n'));
      buf = [];
      inInsert = false;
    }
  }
}

const sqlOut = linesOut.join('\n') + '\n';
fs.writeFileSync(outPath, sqlOut);

const inserts = linesOut.filter(l => l.startsWith('INSERT INTO')).length;
const setvals = linesOut.filter(l => l.startsWith('SELECT pg_catalog.setval')).length;
console.log(`[export-seed] Done: ${inserts} INSERT + ${setvals} SETVAL statements, ${sqlOut.length} bytes`);
