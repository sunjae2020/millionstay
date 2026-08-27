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
 * For a whole building at once, pass a manifest instead so one sign-in covers
 * every folder:
 *
 *   node scripts/upload-property-photos.mjs --manifest photos.json
 *
 *   [ { "folder": "…/910호", "spaces": [106, 279] },
 *     { "folder": "…/외관",  "properties": [1] } ]
 *
 * Credentials are prompted for (password hidden) — nothing is stored or logged.
 * To run unattended instead, supply an existing admin JWT and no password is
 * needed at all:
 *
 *   ADMIN_TOKEN=eyJ… node scripts/upload-property-photos.mjs --manifest photos.json
 *
 * (In the admin UI the token is localStorage's "ms_auth_token".)
 *
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

/** Read a job's folder and resolve its upload targets. */
async function buildJob({ folder, properties = [], spaces = [] }, api) {
  const files = (await readdir(folder, { withFileTypes: true }))
    .filter((e) => e.isFile() && MIME[path.extname(e.name).toLowerCase()])
    .map((e) => e.name)
    .sort();
  const targets = [
    ...properties.map((id) => ({ kind: "property", id, url: `${api}/api/v1/properties/${id}/images` })),
    ...spaces.map((id) => ({ kind: "space", id, url: `${api}/api/v1/spaces/${id}/images` })),
  ];
  return { folder, files, targets };
}

async function main() {
  const args = process.argv.slice(2);
  const apiIdx = args.indexOf("--api");
  const api = (apiIdx >= 0 ? args[apiIdx + 1] : DEFAULT_API).replace(/\/$/, "");
  const manIdx = args.indexOf("--manifest");

  let jobs;
  if (manIdx >= 0) {
    const spec = JSON.parse(await readFile(args[manIdx + 1], "utf8"));
    jobs = await Promise.all(spec.map((j) => buildJob(j, api)));
  } else {
    const folder = args.find((a) => !a.startsWith("--") && !/^\d+$/.test(a));
    const properties = collectFlag(args, "--property");
    const spaces = collectFlag(args, "--space");
    if (!folder || (properties.length === 0 && spaces.length === 0)) {
      console.error("Usage: node scripts/upload-property-photos.mjs <folder> [--property <id>]... [--space <id>]... [--api <url>]");
      console.error("   or: node scripts/upload-property-photos.mjs --manifest <file.json> [--api <url>]");
      process.exit(1);
    }
    jobs = [await buildJob({ folder, properties, spaces }, api)];
  }

  const empty = jobs.filter((j) => !j.files.length);
  for (const j of empty) console.error(`No image files in ${j.folder} — skipped`);
  jobs = jobs.filter((j) => j.files.length);
  if (!jobs.length) {
    console.error("Nothing to upload.");
    process.exit(1);
  }

  console.log(`\nAPI: ${api}`);
  let planned = 0;
  for (const j of jobs) {
    planned += j.files.length * j.targets.length;
    console.log(`  ${String(j.files.length).padStart(3)} photo(s)  ${path.basename(j.folder)}  ->  ${j.targets.map((t) => `${t.kind} ${t.id}`).join(", ")}`);
  }
  console.log(`  ${planned} upload(s) total\n`);

  // A token in the environment skips the password prompt, so the whole run can
  // be handed off unattended. Anything else falls back to an interactive login.
  let token = process.env.ADMIN_TOKEN?.trim();
  if (token) {
    const who = await fetch(`${api}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!who.ok) {
      console.error(`ADMIN_TOKEN rejected (${who.status}). It has probably expired — sign in to the admin again and copy a fresh one.`);
      process.exit(1);
    }
    const me = await who.json().catch(() => null);
    const u = me?.data ?? me?.user ?? me;
    console.log(`\nUsing ADMIN_TOKEN — ${u?.email ?? "?"} (${u?.role ?? "?"})`);
  } else {
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
    token = login.token;
    console.log(`\nSigned in as ${login.user.email} (${login.user.role})`);
  }

  let done = 0;
  let failed = 0;
  for (const job of jobs) {
    // Read once, POST the same bytes to every target of this folder.
    const blobs = [];
    for (const name of job.files) {
      const buf = await readFile(path.join(job.folder, name));
      blobs.push({ name, buf, type: MIME[path.extname(name).toLowerCase()] });
    }

    for (const target of job.targets) {
      console.log(`\n-> ${target.kind} ${target.id}  (${path.basename(job.folder)})`);
      // One file per request: a 40-photo multipart body is large enough that a
      // single network hiccup would lose the whole batch.
      for (const [i, f] of blobs.entries()) {
        const form = new FormData();
        form.append("images", new Blob([f.buf], { type: f.type }), f.name);
        const res = await fetch(target.url, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        if (res.ok) {
          done++;
          console.log(`   [${i + 1}/${blobs.length}] ${f.name}`);
        } else {
          const body = await res.text().catch(() => "");
          console.log(`   [${i + 1}/${blobs.length}] FAILED ${f.name} — ${res.status} ${body.slice(0, 160)}`);
          failed++;
        }
      }
    }
  }

  console.log(`\n${done}/${done + failed} uploaded.`);
  if (failed) process.exit(1);
}

main().catch((err) => { console.error(err); process.exit(1); });
