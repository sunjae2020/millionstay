#!/usr/bin/env node
/**
 * Download every image out of a PUBLIC ("anyone with the link") Google Drive
 * folder into a local directory, keeping the original filenames.
 *
 * The Drive API connector cannot enumerate freshly-created folders (its search
 * index lags), so this scrapes the folder's public HTML listing instead — the
 * same page a logged-out browser sees. It therefore only works while the folder
 * is link-shared; a private folder renders an empty listing and the script says
 * so rather than silently downloading nothing.
 *
 *   node scripts/fetch-drive-folder.mjs <folder-url-or-id> <out-dir>
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0 Safari/537.36";

function folderIdOf(arg) {
  const m = arg.match(/[-\w]{25,}/);
  if (!m) throw new Error(`Could not find a folder id in "${arg}"`);
  return m[0];
}

/** Scrape `name -> fileId` for every shared image in the folder listing. */
export function parseListing(html) {
  const out = [];
  const seen = new Set();
  const re = /aria-label="([^"]+?) Image Shared"[^>]*?ssk='[^']*?:([-\w]{20,})/g;
  for (const m of html.matchAll(re)) {
    const name = m[1];
    // The ssk carries the file id with a "-<n>-<n>" view suffix; strip it.
    const id = m[2].replace(/-\d+-\d+$/, "");
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ name, id });
  }
  return out;
}

async function main() {
  const [folderArg, outDir] = process.argv.slice(2);
  if (!folderArg || !outDir) {
    console.error("Usage: node scripts/fetch-drive-folder.mjs <folder-url-or-id> <out-dir>");
    process.exit(1);
  }
  const folderId = folderIdOf(folderArg);

  const res = await fetch(`https://drive.google.com/drive/folders/${folderId}`, {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) throw new Error(`Folder page returned HTTP ${res.status}`);
  const files = parseListing(await res.text());

  if (files.length === 0) {
    console.error(
      `No images found in folder ${folderId}.\n` +
        `Most likely it is not link-shared: open it in Drive and set\n` +
        `  Share -> General access -> "Anyone with the link" (Viewer)\n` +
        `then run this again.`,
    );
    process.exit(2);
  }

  await mkdir(outDir, { recursive: true });
  console.log(`${files.length} image(s) in folder ${folderId}`);

  let ok = 0;
  for (const [i, f] of files.entries()) {
    const dest = path.join(outDir, f.name);
    const dl = await fetch(`https://drive.google.com/uc?export=download&id=${f.id}`, {
      headers: { "User-Agent": UA },
    });
    if (!dl.ok) {
      console.error(`  [${i + 1}/${files.length}] ${f.name} — HTTP ${dl.status}, skipped`);
      continue;
    }
    const buf = Buffer.from(await dl.arrayBuffer());
    // A permission wall comes back as HTML, not an image — catch it rather than
    // writing a 60 KB "Sign in" page out as a .jpg.
    if (buf.subarray(0, 15).toString("latin1").trimStart().startsWith("<")) {
      console.error(`  [${i + 1}/${files.length}] ${f.name} — got HTML (not public?), skipped`);
      continue;
    }
    await writeFile(dest, buf);
    ok++;
    console.log(`  [${i + 1}/${files.length}] ${f.name} (${(buf.length / 1024).toFixed(0)} KB)`);
  }
  console.log(`\nDownloaded ${ok}/${files.length} into ${outDir}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
