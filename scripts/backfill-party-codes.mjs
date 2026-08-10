#!/usr/bin/env node
/**
 * 고객 ID 백필 — 이미 등록된 계정·연락처에 번호를 매긴다.
 *
 *     PARTY_CODE_PREFIX=MH DATABASE_URL=… node scripts/backfill-party-codes.mjs [--dry]
 *
 * 번호는 **최초 등록 연월** 안에서 등록 순서대로 나간다. 그래서 한 번 돌린 뒤
 * 다시 돌려도 이미 번호가 있는 레코드는 건너뛰고 새로 들어온 것만 이어 붙는다 —
 * 과거 번호가 재배치되지 않는다.
 *
 * 유형(C 개인 / B 기업)은 api-server의 `accountPartyType()`과 같은 규칙이다:
 * 사업자등록번호가 있거나 계정 유형이 Agent/Partner/ServiceHost면 B.
 */
import pg from "pg";

const { Client } = pg;
const DRY = process.argv.includes("--dry");
const PREFIX = (process.env.PARTY_CODE_PREFIX || "MS").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2).padEnd(2, "X");
const TZ = process.env.DOC_TZ || process.env.TZ || "Asia/Seoul";
const B2B = new Set(["Agent", "Partner", "ServiceHost"]);
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function serialLabel(seq) {
  if (seq < 999) return String(seq + 1).padStart(3, "0");
  const k = seq - 999;
  if (k < LETTERS.length * 99) {
    return `${LETTERS[Math.floor(k / 99)]}${String((k % 99) + 1).padStart(2, "0")}`;
  }
  return `Z99-${seq + 1}`;
}

function periodOf(value) {
  const d = value ? new Date(value) : new Date();
  const safe = Number.isNaN(d.getTime()) ? new Date() : d;
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(safe);
  return `${iso.slice(2, 4)}${iso.slice(5, 7)}`;
}

// Supabase의 풀러 URL은 `sslmode=require`를 달고 오는데, pg는 접속 문자열의
// sslmode를 ssl 옵션보다 우선해서 자체 서명 체인을 거부한다. 파라미터를 떼고
// 원격이면 검증 없이 TLS를 쓴다 — 로컬 개발 DB는 평문 그대로.
const RAW_URL = process.env.DATABASE_URL || "";
const CONN = RAW_URL.replace(/[?&]sslmode=[^&]*/g, "").replace(/\?$/, "");
const IS_LOCAL = /@(localhost|127\.0\.0\.1)/.test(CONN);

const db = new Client({
  connectionString: CONN,
  ssl: IS_LOCAL ? undefined : { rejectUnauthorized: false },
});

await db.connect();

// 이미 나간 번호. 연월·유형별 다음 자리를 여기서 이어받는다.
const taken = new Map(); // `${period}|${type}` → 최대 seq
const { rows: existing } = await db.query(
  `SELECT period, party_type, max(seq) AS max_seq FROM party_codes WHERE prefix = $1 GROUP BY period, party_type`,
  [PREFIX],
);
for (const r of existing) taken.set(`${r.period}|${r.party_type}`, Number(r.max_seq));

const { rows: accounts } = await db.query(`
  SELECT a.id, a.account_type, a.biz_registration_no, a.created_at
    FROM accounts a
    LEFT JOIN party_codes p ON p.entity_type = 'account' AND p.entity_id = a.id
   WHERE p.id IS NULL AND a.deleted_at IS NULL
   ORDER BY a.created_at, a.id
`);
const { rows: contacts } = await db.query(`
  SELECT c.id, c.created_at
    FROM contacts c
    LEFT JOIN party_codes p ON p.entity_type = 'contact' AND p.entity_id = c.id
   WHERE p.id IS NULL AND c.deleted_at IS NULL
   ORDER BY c.created_at, c.id
`);

const pending = [
  ...accounts.map((a) => ({
    entity_type: "account",
    entity_id: a.id,
    period: periodOf(a.created_at),
    party_type: a.biz_registration_no?.trim() || B2B.has(a.account_type) ? "B" : "C",
  })),
  ...contacts.map((c) => ({
    entity_type: "contact",
    entity_id: c.id,
    period: periodOf(c.created_at),
    // 연락처는 사람 — 언제나 개인(C).
    party_type: "C",
  })),
].sort((x, y) => (x.period === y.period ? x.entity_id - y.entity_id : x.period.localeCompare(y.period)));

let written = 0;
for (const row of pending) {
  const key = `${row.period}|${row.party_type}`;
  const seq = (taken.has(key) ? taken.get(key) + 1 : 0);
  taken.set(key, seq);
  const code = `${PREFIX}${row.period}${row.party_type}${serialLabel(seq)}`;
  if (DRY) {
    console.log(`${code}  ${row.entity_type}#${row.entity_id}`);
    continue;
  }
  await db.query(
    `INSERT INTO party_codes (entity_type, entity_id, code, prefix, period, party_type, seq)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT DO NOTHING`,
    [row.entity_type, row.entity_id, code, PREFIX, row.period, row.party_type, seq],
  );
  written++;
}

console.log(
  `${DRY ? "[dry] " : ""}prefix=${PREFIX} accounts=${accounts.length} contacts=${contacts.length} written=${DRY ? 0 : written}`,
);
await db.end();
