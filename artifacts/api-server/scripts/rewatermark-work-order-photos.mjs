#!/usr/bin/env node
/**
 * 이미 올라간 작업지시 사진에 워터마크를 (다시) 입힌다.
 *
 * 원장에 저장된 URL을 Cloudinary 워터마크 변환본으로 바꿔 쓰는 일이라 원본
 * 이미지는 건드리지 않는다. 워터마크 문구는 업로드 경로와 같은 규칙이다:
 *
 *   YYYY/MM/DD-매물/공간_사진설명      (날짜 = 그 사진을 올린 날)
 *
 * 이미 워터마크가 있는 URL도 안전하다 — public_id만 되짚어 변환을 새로 얹으므로
 * 몇 번을 돌려도 겹쳐 찍히지 않는다.
 *
 *   node artifacts/api-server/scripts/rewatermark-work-order-photos.mjs --unit 1714호
 *   node artifacts/api-server/scripts/rewatermark-work-order-photos.mjs --unit 1714호 --apply
 *   node artifacts/api-server/scripts/rewatermark-work-order-photos.mjs --order-ref MS-WO-2026-00015 --apply
 *   node ... --unit 1714호 --apply --env .env.metheim
 *
 * 인자가 없으면 전체 사진이 대상이라 `--all`을 명시해야 한다.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { v2 as cloudinary } from "cloudinary";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const envFile = path.resolve(import.meta.dirname, "..", flag("--env") ?? ".env");
const unit = flag("--unit");
const orderRef = flag("--order-ref");
if (!unit && !orderRef && !args.includes("--all")) {
  console.error("Pick a scope: --unit <호수> | --order-ref <MS-WO-…> | --all");
  process.exit(1);
}

function envValue(key) {
  if (process.env[key]) return process.env[key];
  const line = readFileSync(envFile, "utf8").split("\n").find((l) => l.startsWith(`${key}=`));
  if (!line) throw new Error(`${key} not found in ${envFile}`);
  return line.slice(key.length + 1).trim().replace(/^["']|["']$/g, "");
}

cloudinary.config({
  cloud_name: envValue("CLOUDINARY_CLOUD_NAME"),
  api_key: envValue("CLOUDINARY_API_KEY"),
  api_secret: envValue("CLOUDINARY_API_SECRET"),
});

const TZ = process.env.DOC_TZ || process.env.TZ || "Asia/Seoul";
const MAX_CAPTION = 60;

/** 매물명에서 괄호로 병기된 영문을 뗀다 (워터마크 표기 규칙). */
function shortPlaceName(name) {
  const m = String(name).match(/^(.*?)\s*[(（]([^()（）]*)[)）]\s*$/u);
  if (!m) return name;
  if (/[가-힣]/u.test(m[2] ?? "")) return name;
  return (m[1] ?? "").trim() || name;
}

function watermarkText({ property, unit: unitName, caption, when }) {
  const clean = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(when ?? new Date()).replace(/-/g, "/");
  const place = [clean(property) ? shortPlaceName(clean(property)) : "", clean(unitName)]
    .filter(Boolean).join("/");
  const note = clean(caption).slice(0, MAX_CAPTION);
  return `${date}${place ? `-${place}` : ""}${note ? `_${note}` : ""}`;
}

/** 워터마크 글자 크기 (src/lib/workOrders/photoWatermark.ts와 같은 값). */
const FONT_SIZE = 45;

function watermarkedUrl(asset, text) {
  const width = Number(asset.width) > 0 ? Number(asset.width) : 1600;
  const bandWidth = Math.round(width * 0.96);
  return cloudinary.url(asset.public_id, {
    secure: true,
    transformation: [
      {
        overlay: { font_family: "Arial", font_size: FONT_SIZE, font_weight: "bold", text_align: "center", text },
        color: "white", background: "rgb:00000099", crop: "fit", width: bandWidth,
      },
      { flags: "layer_apply", gravity: "south", y: Math.max(6, Math.round(width / 120)) },
    ],
    ...(asset.version ? { version: asset.version } : {}),
    ...(asset.format ? { format: asset.format } : {}),
  });
}

/** 저장된 URL(변환이 얹혀 있을 수 있다) → Cloudinary public_id. */
function publicIdOf(url) {
  const m = String(url).match(/\/(?:image|video)\/upload\/(?:.*?\/)?v\d+\/(.+?)(?:\.[^./?]+)?(?:\?.*)?$/);
  if (m) return m[1];
  // 버전이 없는 옛 URL도 받아 준다.
  const m2 = String(url).match(/\/(?:image|video)\/upload\/(?:.*\/)?([^/]+?)(?:\.[^./?]+)?(?:\?.*)?$/);
  return m2 ? m2[1] : null;
}

const client = new pg.Client({ connectionString: envValue("DATABASE_URL") });
await client.connect();

const where = [];
const params = [];
if (unit) { params.push(unit); where.push(`s.name = $${params.length}`); }
if (orderRef) { params.push(orderRef); where.push(`w.order_ref = $${params.length}`); }

const { rows } = await client.query(
  `SELECT p.id, p.url, p.caption, p.created_at, p.kind,
          w.order_ref, s.name AS unit_name,
          coalesce(prop.name, sprop.name) AS property_name
     FROM work_order_photos p
     JOIN work_orders w ON w.id = p.work_order_id
     LEFT JOIN spaces s ON s.id = w.space_id
     LEFT JOIN properties prop ON prop.id = w.property_id
     LEFT JOIN properties sprop ON sprop.id = s.property_id
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY p.id`,
  params,
);

console.log(`${rows.length} photo(s) in scope${apply ? "" : "  (dry run — pass --apply to write)"}`);

let changed = 0;
let skipped = 0;
for (const row of rows) {
  const publicId = publicIdOf(row.url);
  if (!publicId) { console.log(`  #${row.id} SKIP — public_id를 못 찾음: ${row.url}`); skipped++; continue; }

  let asset;
  try {
    asset = await cloudinary.api.resource(publicId);
  } catch (e) {
    console.log(`  #${row.id} SKIP — Cloudinary 조회 실패(${publicId}): ${e.message}`);
    skipped++;
    continue;
  }

  const text = watermarkText({
    property: row.property_name,
    unit: row.unit_name,
    caption: row.caption,
    when: row.created_at ? new Date(row.created_at) : new Date(),
  });
  const url = watermarkedUrl(
    { public_id: asset.public_id, width: asset.width, version: asset.version, format: asset.format },
    text,
  );
  if (url === row.url) { skipped++; continue; }

  console.log(`  #${row.id} ${row.order_ref} ${row.unit_name ?? "-"} [${row.kind}] → ${text}`);
  // 드라이런에서는 새 URL을 찍어 준다 — 눈으로 열어 보고 적용을 판단한다.
  if (!apply) console.log(`      ${url}`);
  if (apply) await client.query(`UPDATE work_order_photos SET url = $1 WHERE id = $2`, [url, row.id]);
  changed++;
}

console.log(`${apply ? "updated" : "would update"}: ${changed}, unchanged/skipped: ${skipped}`);
await client.end();
