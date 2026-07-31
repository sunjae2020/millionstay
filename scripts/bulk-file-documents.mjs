#!/usr/bin/env node
/**
 * Bulk-file a folder of existing paperwork into Document Intake.
 *
 *   node scripts/bulk-file-documents.mjs <folder> [options]
 *
 * Two passes, and the first one writes nothing to the database:
 *
 *   1. Upload + read (default). Every file is uploaded, parked, and read by the
 *      server. Nothing is filed against a contract. When the reads finish, the
 *      proposed mapping is written to a CSV for you to eyeball.
 *   2. Apply (--apply <csv>). Files each row of that CSV onto the record named
 *      in it — including rows you corrected by hand.
 *
 * The split exists because a wrong guess is expensive to undo: an identity scan
 * filed on a contract inherits a 7-year retention instead of 30 days. Reading a
 * CSV takes a few minutes; unpicking a few hundred mis-filed documents does not.
 *
 * Options:
 *   --api <base-url>   API to talk to (default: the Metheim production API)
 *   --out <path>       Where to write the mapping CSV (default: ./intake-mapping.csv)
 *   --apply <path>     Skip uploading; file the rows in this CSV
 *   --confident-only   With --apply, skip any row the matcher was unsure about
 *   --batch <size>     Files per upload request (default 20)
 *
 * Credentials are prompted for (password hidden) — nothing is stored or logged.
 */
import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

const DEFAULT_API = "https://metheim-api-production.up.railway.app";
const DEFAULT_OUT = "intake-mapping.csv";
const DEFAULT_BATCH = 20;

/** Extensions worth uploading. Everything else in the folder is left alone. */
const DOCUMENT_EXTS = new Set([
  ".pdf", ".jpg", ".jpeg", ".png", ".webp", ".gif", ".tif", ".tiff",
  ".heic", ".doc", ".docx", ".xls", ".xlsx", ".hwp",
]);

/** How long to wait for the server's background reads before giving up. */
const SCAN_TIMEOUT_MS = 30 * 60 * 1000;
const POLL_INTERVAL_MS = 5000;

const CSV_COLUMNS = [
  "intake_id", "file_name", "status", "detected_doc_type", "confidence",
  "suggested_entity_type", "suggested_entity_id", "match_score", "match_reason",
  "party_name", "unit_label", "start_date", "end_date", "scan_error",
];

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (!hidden) {
      rl.question(question, (a) => { rl.close(); resolve(a.trim()); });
      return;
    }
    // Hidden input: mute the echo while the password is typed.
    const onData = (char) => {
      if (["\n", "\r", ""].includes(char.toString())) process.stdin.removeListener("data", onData);
      else process.stdout.write("\x1b[2K\x1b[200D" + question + "*".repeat(rl.line.length));
    };
    process.stdin.on("data", onData);
    rl.question(question, (a) => { rl.close(); process.stdout.write("\n"); resolve(a.trim()); });
  });
}

async function login(api) {
  const email = await ask("Admin email: ");
  const password = await ask("Password: ", { hidden: true });
  const res = await fetch(`${api}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Login failed (${res.status}): ${await res.text()}`);
  }
  const body = await res.json();
  if (!body?.token) throw new Error(`Login failed: ${body?.error ?? "no token returned"}`);
  console.log(`Signed in as ${body.user?.email} (${body.user?.role})`);
  return body.token;
}

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Minimal RFC 4180 reader — enough for a file this script wrote and a human edited. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const header = rows.shift();
  return rows
    .filter((r) => r.some((v) => v.trim()))
    .map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

async function collectFiles(folder) {
  const entries = await readdir(folder, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    const full = path.join(folder, e.name);
    // Recurse: existing paperwork is usually already sorted into per-unit or
    // per-year folders, and that structure is the point.
    if (e.isDirectory()) { out.push(...(await collectFiles(full))); continue; }
    if (!e.isFile() || e.name.startsWith(".")) continue;
    if (!DOCUMENT_EXTS.has(path.extname(e.name).toLowerCase())) continue;
    out.push(full);
  }
  return out;
}

async function uploadBatch(api, token, files) {
  const form = new FormData();
  for (const file of files) {
    const buf = await readFile(file);
    form.append("files", new Blob([buf]), path.basename(file));
  }
  const res = await fetch(`${api}/api/v1/document-intake`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status}): ${await res.text()}`);
  return res.json();
}

async function fetchBatch(api, token, batchId) {
  const res = await fetch(`${api}/api/v1/document-intake?status=_all&batch_id=${batchId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`List failed (${res.status}): ${await res.text()}`);
  return res.json();
}

/** Wait until no item in the batch is still `pending`. */
async function waitForScans(api, token, batchIds) {
  const startedAt = Date.now();
  for (;;) {
    const items = (await Promise.all(batchIds.map((b) => fetchBatch(api, token, b)))).flat();
    const pending = items.filter((i) => i.status === "pending").length;
    if (!pending) return items;
    if (Date.now() - startedAt > SCAN_TIMEOUT_MS) {
      console.warn(`\n! Timed out with ${pending} file(s) still being read — they stay parked in the admin queue.`);
      return items;
    }
    process.stdout.write(`\r  reading… ${items.length - pending}/${items.length}`);
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

async function runUploadPass(api, token, folder, outPath, batchSize) {
  const files = await collectFiles(folder);
  if (!files.length) { console.error(`No documents found under ${folder}`); process.exit(1); }
  console.log(`Found ${files.length} document(s) under ${folder}`);

  const batchIds = [];
  for (let i = 0; i < files.length; i += batchSize) {
    const chunk = files.slice(i, i + batchSize);
    const body = await uploadBatch(api, token, chunk);
    batchIds.push(body.batch_id);
    console.log(`  uploaded ${Math.min(i + chunk.length, files.length)}/${files.length}` +
      (body.failed?.length ? ` (${body.failed.length} failed)` : ""));
    for (const f of body.failed ?? []) console.warn(`  ! ${f.file_name}: ${f.error}`);
  }

  console.log("Waiting for the server to read them…");
  const items = await waitForScans(api, token, batchIds);
  process.stdout.write("\r");

  const lines = [CSV_COLUMNS.join(",")];
  for (const it of items) {
    const x = it.extracted ?? {};
    lines.push([
      it.id, it.file_name, it.status, it.detected_doc_type ?? "", it.confidence ?? "",
      it.suggested_entity_type ?? "", it.suggested_entity_id ?? "", it.match_score ?? "",
      it.match_reason ?? "", x.party_name ?? "", x.unit_label ?? "", x.start_date ?? "",
      x.end_date ?? "", it.scan_error ?? "",
    ].map(csvEscape).join(","));
  }
  await writeFile(outPath, lines.join("\n") + "\n", "utf8");

  const ready = items.filter((i) => i.status === "scanned").length;
  const review = items.filter((i) => i.status === "review").length;
  const failed = items.filter((i) => i.status === "failed").length;
  console.log(`\nWrote ${outPath}`);
  console.log(`  ${ready} confidently matched · ${review} need review · ${failed} could not be read`);
  console.log(`\nCheck the CSV, correct the suggested_entity_* columns where needed, then:`);
  console.log(`  node scripts/bulk-file-documents.mjs --apply ${outPath}`);
  console.log(`Nothing has been filed against a record yet — every file is parked in Documents → Bulk intake.`);
}

async function runApplyPass(api, token, csvPath, confidentOnly) {
  const rows = parseCsv(await readFile(csvPath, "utf8"));
  if (!rows.length) { console.error(`${csvPath} has no rows`); process.exit(1); }

  let filed = 0, skipped = 0, failed = 0;
  for (const row of rows) {
    const entityType = row.suggested_entity_type;
    const entityId = Number(row.suggested_entity_id);
    const docType = row.detected_doc_type;

    if (row.status === "filed") { skipped++; continue; }
    if (!entityType || !Number.isInteger(entityId) || entityId <= 0) {
      console.warn(`  skip ${row.file_name}: no record chosen`); skipped++; continue;
    }
    if (confidentOnly && row.status !== "scanned") {
      console.warn(`  skip ${row.file_name}: needs review`); skipped++; continue;
    }

    const res = await fetch(`${api}/api/v1/document-intake/${row.intake_id}/confirm`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ entity_type: entityType, entity_id: entityId, doc_type: docType || "other" }),
    });
    if (res.ok) { filed++; }
    else {
      failed++;
      const err = await res.text();
      console.warn(`  ! ${row.file_name}: ${res.status} ${err}`);
    }
  }
  console.log(`\nFiled ${filed}, skipped ${skipped}, failed ${failed}.`);
  if (skipped || failed) console.log("Skipped and failed rows are still parked in Documents → Bulk intake.");
}

async function main() {
  const args = process.argv.slice(2);
  // Flags that take a value, so their argument is not mistaken for the folder.
  const VALUE_FLAGS = new Set(["--api", "--out", "--apply", "--batch"]);
  const flag = (name, fallback = null) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
  };
  const positional = args.filter((a, i) => !a.startsWith("--") && !VALUE_FLAGS.has(args[i - 1]));

  const api = flag("api", DEFAULT_API).replace(/\/$/, "");
  const applyCsv = flag("apply");
  const outPath = flag("out", DEFAULT_OUT);
  const batchSize = Number(flag("batch", DEFAULT_BATCH)) || DEFAULT_BATCH;
  const confidentOnly = args.includes("--confident-only");
  const folder = positional[0];

  if (!applyCsv && !folder) {
    console.error("Usage: node scripts/bulk-file-documents.mjs <folder> [--api <url>] [--out <csv>] [--batch <n>]");
    console.error("       node scripts/bulk-file-documents.mjs --apply <csv> [--api <url>] [--confident-only]");
    process.exit(1);
  }
  if (folder && !applyCsv) {
    const s = await stat(folder).catch(() => null);
    if (!s?.isDirectory()) { console.error(`${folder} is not a folder`); process.exit(1); }
  }

  console.log(`API: ${api}`);
  const token = await login(api);

  if (applyCsv) await runApplyPass(api, token, applyCsv, confidentOnly);
  else await runUploadPass(api, token, folder, outPath, batchSize);
}

main().catch((err) => {
  console.error(`\n${err.message}`);
  process.exit(1);
});
