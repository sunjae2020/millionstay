#!/usr/bin/env node
/**
 * Repair document filenames that were stored as latin1 mojibake.
 *
 * Busboy hands multipart filenames back as latin1, so Korean names landed in
 * the documents table as "á á ¦á …". The upload path now decodes them, but rows
 * uploaded before that fix still carry the broken text. Re-reads the stored
 * string as UTF-8 and normalises to NFC, exactly as the upload path does.
 *
 *   node artifacts/api-server/scripts/repair-document-filenames.mjs           # dry run
 *   node artifacts/api-server/scripts/repair-document-filenames.mjs --apply
 *   node artifacts/api-server/scripts/repair-document-filenames.mjs --apply --env .env.metheim
 *
 * A name that does not round-trip cleanly is left alone, so running twice is
 * harmless and an already-correct name is never mangled.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const envIdx = args.indexOf("--env");
// Env files are resolved against the api-server package, not the caller's cwd,
// so the same command works from anywhere in the monorepo.
const envFile = path.resolve(import.meta.dirname, "..", envIdx >= 0 ? args[envIdx + 1] : ".env");

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const text = readFileSync(envFile, "utf8");
  const line = text.split("\n").find((l) => l.startsWith("DATABASE_URL="));
  if (!line) throw new Error(`DATABASE_URL not found in ${envFile}`);
  return line.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
}

/** Mojibake iff the string re-decodes to something different and valid. */
function repair(name) {
  const fixed = Buffer.from(name, "latin1").toString("utf8").normalize("NFC");
  if (fixed === name) return null;
  if (fixed.includes("�")) return null; // not latin1-encoded UTF-8 after all
  return fixed;
}

const client = new pg.Client({ connectionString: databaseUrl() });
await client.connect();

const { rows } = await client.query(
  "select id, file_name from documents where deleted_at is null order by created_at desc",
);

let changed = 0;
for (const row of rows) {
  const fixed = repair(row.file_name);
  if (!fixed) continue;
  changed++;
  console.log(`${row.file_name}\n  -> ${fixed}`);
  if (apply) {
    await client.query("update documents set file_name = $1, updated_at = now() where id = $2", [
      fixed,
      row.id,
    ]);
  }
}

console.log(
  `\n${changed}/${rows.length} row(s) ${apply ? "repaired" : "would be repaired (dry run — pass --apply)"}.`,
);
await client.end();
