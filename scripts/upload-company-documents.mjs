#!/usr/bin/env node
/**
 * Upload company paperwork into Settings -> Organisation -> Company documents.
 *
 * Point it at a folder of files; it logs in as an admin, maps each filename to
 * a doc_type and uploads it under its original filename. Files whose name it
 * does not recognise go up as "other" rather than being skipped, so nothing is
 * silently left behind.
 *
 *   node scripts/upload-company-documents.mjs <folder> [--api <base-url>]
 *
 * Credentials are prompted for (password hidden) — nothing is stored or logged.
 * Only SuperAdmin/Admin may upload; any other role is rejected by the server.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

const DEFAULT_API = "https://metheim-api-production.up.railway.app";

// Filename fragment -> doc_type. First match wins, so put specific before general.
const TYPE_RULES = [
  [/통장/, "bank_passbook"],
  [/사업자등록증/, "business_registration"],
  [/등기사항|등기부/, "corporate_register"],
  [/인감/, "seal_certificate"],
  [/임대사업자/, "rental_business_registration"],
  [/신분증|주민등록/, "representative_id"],
];

function docTypeFor(name) {
  for (const [rx, type] of TYPE_RULES) if (rx.test(name)) return type;
  return "other";
}

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

async function main() {
  const args = process.argv.slice(2);
  const folder = args.find((a) => !a.startsWith("--"));
  const apiIdx = args.indexOf("--api");
  const api = (apiIdx >= 0 ? args[apiIdx + 1] : DEFAULT_API).replace(/\/$/, "");
  if (!folder) {
    console.error("Usage: node scripts/upload-company-documents.mjs <folder> [--api <base-url>]");
    process.exit(1);
  }

  const entries = (await readdir(folder, { withFileTypes: true }))
    .filter((e) => e.isFile() && !e.name.startsWith("."))
    .map((e) => e.name)
    .sort();
  if (!entries.length) {
    console.error(`No files in ${folder}`);
    process.exit(1);
  }

  console.log(`\nAPI: ${api}`);
  console.log(`${entries.length} file(s) to upload:\n`);
  for (const name of entries) console.log(`  ${name}  ->  ${docTypeFor(name)}`);

  const email = await ask("\nAdmin email: ");
  const password = await ask("Password: ", { hidden: true });

  const loginRes = await fetch(`${api}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const login = await loginRes.json().catch(() => null);
  if (!loginRes.ok || !login?.token) {
    console.error(`Login failed: ${login?.error ?? loginRes.status}`);
    process.exit(1);
  }
  console.log(`\nSigned in as ${login.user.email} (${login.user.role})`);

  let ok = 0;
  const failed = [];
  for (const name of entries) {
    const buf = await readFile(path.join(folder, name));
    const form = new FormData();
    form.append("file", new Blob([buf], { type: "application/pdf" }), name);
    form.append("doc_type", docTypeFor(name));
    const res = await fetch(`${api}/api/v1/company-info/documents`, {
      method: "POST",
      headers: { Authorization: `Bearer ${login.token}` },
      body: form,
    });
    if (res.ok) {
      console.log(`  uploaded  ${name}`);
      ok++;
    } else {
      const body = await res.text().catch(() => "");
      console.log(`  FAILED    ${name} — ${res.status} ${body.slice(0, 160)}`);
      failed.push(name);
    }
  }

  console.log(`\n${ok}/${entries.length} uploaded.`);
  if (failed.length) {
    console.log(`Failed: ${failed.join(", ")}`);
    process.exit(1);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
