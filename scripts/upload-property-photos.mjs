#!/usr/bin/env node
/**
 * Upload a folder of photos to a property's or a space's Photos tab.
 *
 *   node scripts/upload-property-photos.mjs <folder> --property 1
 *   node scripts/upload-property-photos.mjs <folder> --space 106
 *   node scripts/upload-property-photos.mjs <folder> --space 106 --space 279
 *
 * Repeating --space uploads the same folder to several spaces, which is how a
 * unit's photos also land on its type master (e.g. 910호 + C타입).
 *
 * Credentials are prompted for (password hidden) — nothing is stored or logged.
 * Photos are appended; nothing already on the target is replaced or removed.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

const DEFAULT_API = "https://metheim-api-production.up.railway.app";

const MIME = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".gif": "image/gif", ".heic": "image/heic",
};

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (!hidden) {
      rl.question(question, (a) => { rl.close(); resolve(a.trim()); });
      return;
    }
    const onData = (char) => {
      if (["\n", "\r", ""].includes(char.toString())) process.stdin.removeListener("data", onData);
      else process.stdout.write("\x1b[2K\x1b[200D" + question + "*".repeat(rl.line.length));
    };
    process.stdin.on("data", onData);
    rl.question(question, (a) => { rl.close(); process.stdout.write("\n"); resolve(a.trim()); });
  });
}

function collectFlag(args, flag) {
  const out = [];
  args.forEach((a, i) => { if (a === flag) out.push(Number(args[i + 1])); });
  return out.filter((n) => Number.isInteger(n) && n > 0);
}

async function main() {
  const args = process.argv.slice(2);
  const folder = args.find((a) => !a.startsWith("--") && !/^\d+$/.test(a));
  const apiIdx = args.indexOf("--api");
  const api = (apiIdx >= 0 ? args[apiIdx + 1] : DEFAULT_API).replace(/\/$/, "");
  const properties = collectFlag(args, "--property");
  const spaces = collectFlag(args, "--space");

  if (!folder || (properties.length === 0 && spaces.length === 0)) {
    console.error("Usage: node scripts/upload-property-photos.mjs <folder> [--property <id>]... [--space <id>]... [--api <url>]");
    process.exit(1);
  }

  const files = (await readdir(folder, { withFileTypes: true }))
    .filter((e) => e.isFile() && MIME[path.extname(e.name).toLowerCase()])
    .map((e) => e.name)
    .sort();
  if (!files.length) {
    console.error(`No image files in ${folder}`);
    process.exit(1);
  }

  const targets = [
    ...properties.map((id) => ({ kind: "property", id, url: `${api}/api/v1/properties/${id}/images` })),
    ...spaces.map((id) => ({ kind: "space", id, url: `${api}/api/v1/spaces/${id}/images` })),
  ];

  console.log(`\nAPI: ${api}`);
  console.log(`${files.length} photo(s) from ${folder}`);
  console.log(`Targets: ${targets.map((t) => `${t.kind} ${t.id}`).join(", ")}\n`);

  const email = await ask("Admin email: ");
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

  // Read once, POST the same bytes to every target.
  const blobs = [];
  for (const name of files) {
    const buf = await readFile(path.join(folder, name));
    blobs.push({ name, buf, type: MIME[path.extname(name).toLowerCase()] });
  }

  let failed = 0;
  for (const target of targets) {
    console.log(`\n-> ${target.kind} ${target.id}`);
    // One file per request: a 40-photo multipart body is large enough that a
    // single network hiccup would lose the whole batch.
    for (const [i, f] of blobs.entries()) {
      const form = new FormData();
      form.append("images", new Blob([f.buf], { type: f.type }), f.name);
      const res = await fetch(target.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${login.token}` },
        body: form,
      });
      if (res.ok) {
        console.log(`   [${i + 1}/${blobs.length}] ${f.name}`);
      } else {
        const body = await res.text().catch(() => "");
        console.log(`   [${i + 1}/${blobs.length}] FAILED ${f.name} — ${res.status} ${body.slice(0, 160)}`);
        failed++;
      }
    }
  }

  const total = blobs.length * targets.length;
  console.log(`\n${total - failed}/${total} uploaded.`);
  if (failed) process.exit(1);
}

main().catch((err) => { console.error(err); process.exit(1); });
