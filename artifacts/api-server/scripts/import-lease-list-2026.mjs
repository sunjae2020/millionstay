/**
 * import-lease-list-2026.mjs
 *
 * One-off (idempotent) migration of the Metheim 여수 "2026년 임대리스트" spreadsheet
 * into the real tables:
 *
 *   contacts                 성함(성/이름 분리) · 연락처 · 한국 주소
 *   accounts                 세입자(Tenant) 계정, 법인은 상위 계정으로 재사용
 *   contracts                계약서 구분/계약금/잔금/보증금/월세/납입일/입주일/퇴거일/비고
 *   contract_related_costs   입주청소 · 임대수수료 · 부동산수수료
 *   invoices                 2026년 월별 월세 입금 현황 (월 1건)
 *   spaces.status            계약 있는 세대 → 임대 / 퇴거 완료 → 공실
 *
 * Runs against the Metheim DB only. Default is DRY RUN — nothing is written and a
 * full report is printed; pass --commit to apply inside a single transaction.
 *
 * Usage:
 *   DATABASE_URL=<metheim> node scripts/import-lease-list-2026.mjs \
 *     --csv "~/Downloads/2026년 임대리스트.xlsx - 임대리스트(2026) (1).csv" \
 *     [--commit] [--cleanup-tests] [--purge-demo] [--report <path>]
 *
 * Flags:
 *   --commit         apply (otherwise dry run)
 *   --cleanup-tests  soft-delete the pre-existing TEST/샘플 tenant data
 *   --purge-demo     also soft-delete the demo agent/host portal sample rows
 *                    (SMP-CT-*, 데모 * accounts) — off by default because the
 *                    partner-portal demo logins depend on them
 *
 * PII: 성명/연락처/주소 are personal data. Imported rows are flagged
 * manual_input=true, the source CSV is never committed to the repo, and this
 * script prints no full phone numbers in its summary output.
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { splitKoreanName, looksLikeOrganisation } from "./lib/korean-name.mjs";

const { Pool } = pg;

// ── CLI ──────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n, d = null) => {
  const i = argv.indexOf(n);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const COMMIT = flag("--commit");
const CLEANUP_TESTS = flag("--cleanup-tests");
const PURGE_DEMO = flag("--purge-demo");
const CSV_PATH = (opt("--csv") || "").replace(/^~/, process.env.HOME || "~");
const REPORT_PATH = opt("--report");
const CURRENCY = "KRW";
const YEAR = 2026;

if (!CSV_PATH || !fs.existsSync(CSV_PATH)) {
  console.error(`CSV not found: ${CSV_PATH || "(missing --csv)"}`);
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required (Metheim DB).");
  process.exit(1);
}

// ── CSV parsing (RFC4180, quoted fields may contain newlines) ─────────────────
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\r") { /* skip */ }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// Column indexes (see the sheet header; row 0 = group header, row 1 = sub header).
const C = {
  no: 0, contractDate: 1, name: 2, type: 3, unit: 4, phone: 5, address: 6,
  category: 7, downDate: 8, down: 9, balDate: 10, bal: 11, bond: 12,
  rent: 13, rentDue: 14, moveIn: 15, moveOut: 16,
  cleaning: 17,
  leaseFeeDate: 18, leaseFeePayee: 19, leaseFeeAmt: 20,
  agencyFeeDate: 21, agencyFeePayee: 22, agencyFeeAmt: 23,
  total: 24, note: 25,
  month1: 26, // …month12 = 37
};

// ── Value parsing helpers ────────────────────────────────────────────────────
const clean = (v) => String(v ?? "").replace(/ /g, " ").trim();

/** "₩10,000,000" | "신탁사\n3,000,000" → 10000000 | 3000000 (+ leftover note) */
function parseMoney(raw) {
  const s = clean(raw);
  if (!s || s === "-") return { amount: null, note: "" };
  const nums = s.match(/[\d,]{3,}/g);
  if (!nums) return { amount: null, note: s };
  const amount = Number(nums[nums.length - 1].replace(/,/g, ""));
  const note = s.replace(/[\d,₩\s]+/g, " ").replace(/\s+/g, " ").trim();
  return { amount: Number.isFinite(amount) ? amount : null, note };
}

/** "25.01.31" | "2026.02.05" → "2025-01-31" | "2026-02-05" (+ leftover note) */
function parseDate(raw) {
  const s = clean(raw);
  if (!s || s === "-") return { date: null, note: "" };
  const m = s.match(/(\d{4}|\d{2})\.(\d{1,2})\.(\d{1,2})/);
  if (!m) return { date: null, note: s };
  const yy = m[1].length === 4 ? Number(m[1]) : 2000 + Number(m[1]);
  const date = `${yy}-${String(Number(m[2])).padStart(2, "0")}-${String(Number(m[3])).padStart(2, "0")}`;
  const note = s.replace(m[0], " ").replace(/\s+/g, " ").trim();
  return { date, note };
}

/** "매달 6일" | "메월 25일" | "26.02.21\n26.03.30" → 6 | 25 | null */
function parseDueDay(raw) {
  const s = clean(raw);
  const m = s.match(/(\d{1,2})\s*일/);
  if (!m) return { day: null, note: s && s !== "-" ? s : "" };
  const day = Number(m[1]);
  return { day: day >= 1 && day <= 31 ? day : null, note: "" };
}

// ── Korean address parsing ───────────────────────────────────────────────────
const PROVINCE_ALIASES = {
  "전남": "전라남도", "전북": "전라북도", "경남": "경상남도", "경북": "경상북도",
  "충남": "충청남도", "충북": "충청북도", "경기": "경기도", "강원": "강원특별자치도",
  "제주": "제주특별자치도", "서울": "서울특별시", "부산": "부산광역시",
  "대구": "대구광역시", "인천": "인천광역시", "광주": "광주광역시",
  "대전": "대전광역시", "울산": "울산광역시", "세종": "세종특별자치시",
  // observed typo in the source sheet
  "인청광역시": "인천광역시",
};
const PROVINCE_FULL = new Set([
  "서울특별시", "부산광역시", "대구광역시", "인천광역시", "광주광역시", "대전광역시",
  "울산광역시", "세종특별자치시", "경기도", "강원도", "강원특별자치도", "충청북도",
  "충청남도", "전라북도", "전북특별자치도", "전라남도", "경상북도", "경상남도",
  "제주특별자치도", "제주도",
]);

/** "전남 여수시 충무1길 2-2,4층(충무동)" → {state, suburb, line1, country} */
function parseKoreanAddress(raw) {
  const s = clean(raw).replace(/\s+/g, " ");
  if (!s) return { address_line1: "", suburb: "", state: "", postcode: "", country: "KR" };
  const tokens = s.split(" ");
  let state = "", idx = 0;
  const head = tokens[0] ?? "";
  if (PROVINCE_FULL.has(head)) { state = head; idx = 1; }
  else if (PROVINCE_ALIASES[head]) { state = PROVINCE_ALIASES[head]; idx = 1; }

  let suburb = "";
  // 시/군/구 — 여수시, 장흥군, 덕진구… a metro province may carry 시 + 구 (e.g. 고양시 일산서구)
  const parts = [];
  while (idx < tokens.length && /(시|군|구)$/.test(tokens[idx]) && parts.length < 2) {
    parts.push(tokens[idx]); idx++;
    if (parts.length === 1 && !/시$/.test(parts[0])) break;
  }
  suburb = parts.join(" ");
  const address_line1 = tokens.slice(idx).join(" ");
  return { address_line1, suburb, state, postcode: "", country: "KR" };
}

// ── 성함 → 법인/개인 분해 ────────────────────────────────────────────────────
const TITLE_SUFFIX = /\s*(사원|주임|대리|과장|차장|부장|이사|대표|원장|목사|사장|팀장|실장)\s*$/;

/** @returns {{ org: string|null, persons: string[] }} */
function parseNameCell(raw) {
  const cell = clean(raw);
  if (!cell) return { org: null, persons: [] };
  const lines = cell.split("\n").map((l) => clean(l)).filter(Boolean)
    .map((l) => l.replace(/\(.*?\)/g, "").replace(TITLE_SUFFIX, "").trim())
    .filter(Boolean);

  const isPerson = (s) => !looksLikeOrganisation(s) && /^[가-힣]{2,4}$|^[A-Z][A-Za-z]*( [A-Za-z]+)+$/.test(s);

  // Single line that mixes org + person: "여수가온병원 이경록"
  if (lines.length === 1 && lines[0].includes(" ")) {
    const t = lines[0].split(" ");
    const tail = t[t.length - 1];
    const head = t.slice(0, -1).join(" ");
    if (looksLikeOrganisation(head) && isPerson(tail)) return { org: head, persons: [tail] };
  }

  const org = lines.find((l) => looksLikeOrganisation(l)) || null;
  const persons = lines.filter((l) => l !== org && isPerson(l));
  if (!org && persons.length === 0) return { org: lines[0] ?? null, persons: [] };
  return { org, persons };
}

/** "010-5910-2807\n(병원장님 번호)\n010-2381-2002\n(한동석)" → phones + label note */
function parsePhones(raw) {
  const s = clean(raw);
  if (!s) return { mobile: null, office: null, note: "" };
  const nums = s.match(/0\d{1,2}-?\d{3,4}-?\d{4}/g) || [];
  const mobile = nums.find((n) => n.startsWith("010")) || null;
  const office = nums.find((n) => !n.startsWith("010")) || null;
  const extras = nums.filter((n) => n !== mobile && n !== office);
  const labels = s.includes("(") || extras.length ? s.replace(/\n/g, " ") : "";
  return { mobile, office, note: labels };
}

// ── Monthly rent cell → invoice intent ───────────────────────────────────────
/**
 * "13일" → paid on 2026-MM-13
 * "13일\n(1,800,000 입금)\n(5월달+6월달 월세)" → paid, explicit amount
 * "7월달 월세 미납" → overdue
 * "8월달 월세 → 보증금에서 차감" → paid, method 보증금 차감
 * "-" / "" → no ledger entry for that month
 */
function parseMonthCell(raw, month, monthlyRent) {
  const s = clean(raw);
  if (!s || s === "-") return null;
  const dayMatch = s.match(/^(\d{1,2})\s*일/) || s.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  const amtMatch = s.match(/([\d,]{5,})\s*(원|입금|한화)?/);
  const explicitAmount = amtMatch ? Number(amtMatch[1].replace(/,/g, "")) : null;

  if (/미납/.test(s)) {
    return { status: "Overdue", paid_day: null, amount: monthlyRent, method: null, note: s };
  }
  if (/보증금에서\s*차감|보증금\s*차감/.test(s)) {
    return { status: "Paid", paid_day: null, amount: monthlyRent, method: "보증금 차감", note: s };
  }
  if (dayMatch) {
    const day = Number(dayMatch[dayMatch.length - 1]);
    return {
      status: "Paid",
      paid_day: day >= 1 && day <= 31 ? day : null,
      amount: explicitAmount && explicitAmount > 0 ? explicitAmount : monthlyRent,
      method: null,
      note: s,
    };
  }
  return { status: "Paid", paid_day: null, amount: explicitAmount ?? monthlyRent, method: null, note: s };
}

// ── Load + normalise the sheet ───────────────────────────────────────────────
const raw = fs.readFileSync(CSV_PATH, "utf8");
const allRows = parseCsv(raw);
const bodyRows = allRows.slice(2).filter((r) => r.some((c) => clean(c)));

const seen = new Set();
const rowsIn = [];
const duplicates = [];
for (const r of bodyRows) {
  const key = r.map(clean).join("");
  if (seen.has(key)) { duplicates.push({ name: clean(r[C.name]), unit: clean(r[C.unit]) }); continue; }
  seen.add(key);
  rowsIn.push(r);
}

const records = rowsIn.map((r, i) => {
  const seq = i + 1;
  const nameCell = clean(r[C.name]);
  const { org, persons } = parseNameCell(nameCell);
  const phones = parsePhones(r[C.phone]);
  const addr = parseKoreanAddress(r[C.address]);
  const contractDate = parseDate(r[C.contractDate]);
  const down = parseMoney(r[C.down]);
  const downDate = parseDate(r[C.downDate]);
  const bal = parseMoney(r[C.bal]);
  const balDate = parseDate(r[C.balDate]);
  const bond = parseMoney(r[C.bond]);
  const rent = parseMoney(r[C.rent]);
  const due = parseDueDay(r[C.rentDue]);
  const moveIn = parseDate(r[C.moveIn]);
  const moveOut = parseDate(r[C.moveOut]);
  const flagCol = clean(r[C.no]);

  const noteParts = [];
  const bizNote = clean(r[C.note]);
  if (bizNote) noteParts.push(bizNote);
  if (moveOut.note) noteParts.push(`퇴거일 원문: ${moveOut.note}`);
  if (downDate.note) noteParts.push(`계약금 입금일 원문: ${downDate.note}`);
  if (balDate.note) noteParts.push(`잔금 입금일 원문: ${balDate.note}`);
  if (moveIn.note) noteParts.push(`입주일 원문: ${moveIn.note}`);
  if (bond.note) noteParts.push(`보증금 비고: ${bond.note}`);
  if (due.note) noteParts.push(`월세 납입일 원문: ${due.note}`);
  if (phones.note && /[가-힣(]/.test(phones.note)) noteParts.push(`연락처 원문: ${phones.note}`);
  noteParts.push(`[원본 임대리스트 NO ${flagCol || seq}]`);

  const costs = [];
  const cleaning = clean(r[C.cleaning]);
  if (cleaning) {
    const m = parseMoney(cleaning);
    const isX = /^X$/i.test(cleaning);
    costs.push({
      cost_type: "입주청소",
      remitted_on: null,
      payee_name: "",
      amount: m.amount ?? 0,
      note: isX ? "미실시(X)" : cleaning.replace(/\n/g, " "),
      skip: isX,
    });
  }
  const leaseAmt = parseMoney(r[C.leaseFeeAmt]);
  if (leaseAmt.amount || clean(r[C.leaseFeePayee])) {
    costs.push({
      cost_type: "임대수수료",
      remitted_on: parseDate(r[C.leaseFeeDate]).date,
      payee_name: clean(r[C.leaseFeePayee]).replace(/\n/g, " / "),
      amount: leaseAmt.amount ?? 0,
      note: "",
    });
  }
  const agencyAmt = parseMoney(r[C.agencyFeeAmt]);
  if (agencyAmt.amount || clean(r[C.agencyFeePayee])) {
    costs.push({
      cost_type: "부동산수수료",
      remitted_on: parseDate(r[C.agencyFeeDate]).date,
      payee_name: clean(r[C.agencyFeePayee]).replace(/\n/g, " / "),
      amount: agencyAmt.amount ?? 0,
      note: "",
    });
  }

  const months = [];
  for (let m = 1; m <= 12; m++) {
    const cell = r[C.month1 + (m - 1)];
    const parsed = parseMonthCell(cell, m, rent.amount ?? 0);
    if (parsed) months.push({ month: m, ...parsed });
  }

  return {
    seq,
    ref: `MH-L-2026-${String(seq).padStart(4, "0")}`,
    sourceNo: flagCol,
    vacated: flagCol === "퇴거",
    nameCell, org, persons,
    phones, addr,
    unit: clean(r[C.unit]),
    typeLabel: clean(r[C.type]),
    category: clean(r[C.category]) || null,
    contract_date: contractDate.date,
    down_payment: down.amount, down_payment_date: downDate.date,
    balance_amount: bal.amount, balance_date: balDate.date,
    bond_amount: bond.amount,
    monthly_rent: rent.amount,
    rent_due_day: due.day,
    start_date: moveIn.date,
    end_date: moveOut.date,
    auto_renew: /자동연장/.test(clean(r[C.moveOut])),
    notes: noteParts.join("\n"),
    costs,
    months,
  };
});


// ── Derived per-record fields (account name, 성/이름, status, 재계약 체인) ────
const today = new Date().toISOString().slice(0, 10);
const ordered = [...records].sort((a, b) => String(a.start_date).localeCompare(String(b.start_date)));
const priorBySpaceUnit = new Map();
for (const rec of ordered) {
  const p1 = splitKoreanName(rec.persons[0] ?? "");
  const p2 = splitKoreanName(rec.persons[1] ?? "");
  rec.p1 = rec.persons[0] ? p1 : { first_name: "", last_name: "" };
  rec.p2 = rec.persons[1] ? p2 : { first_name: "", last_name: "" };
  rec.account_name = rec.org || rec.persons[0] || rec.nameCell.split("\n")[0].trim();
  rec.ended = Boolean(rec.vacated || (rec.end_date && rec.end_date < today));
  rec.status = rec.ended ? "Completed" : "Active";
  const prior = priorBySpaceUnit.get(rec.unit);
  if (prior) rec.notes = `${rec.notes}\n선행 계약: ${prior}`;
  priorBySpaceUnit.set(rec.unit, rec.ref);
}
// Latest contract per unit decides the space status (임대 / 공실).
const unitFinal = new Map();
for (const rec of ordered) unitFinal.set(rec.unit, rec.ended ? "공실" : "임대");

// ── SQL generation (one round trip — the Seoul pooler makes per-row round
//    trips punishingly slow, so the whole migration runs server-side) ─────────
const q = (v) => (v === null || v === undefined || v === "" ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
const n = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? "NULL" : String(Number(v)));
const b = (v) => (v ? "true" : "false");

const impRows = records.map((r) => `(${[
  r.seq, q(r.ref), q(r.unit), q(r.account_name), q(r.org), q(r.p1.first_name), q(r.p1.last_name),
  q(r.p2.first_name), q(r.p2.last_name), q(r.phones.mobile), q(r.phones.office),
  q(/[가-힣(]/.test(r.phones.note) ? `연락처 원문: ${r.phones.note.replace(/\n/g, " ")}` : ""),
  q(r.addr.address_line1), q(r.addr.suburb), q(r.addr.state), q(r.addr.country),
  q(r.category), n(r.down_payment), q(r.down_payment_date), n(r.balance_amount), q(r.balance_date),
  n(r.bond_amount), n(r.monthly_rent), n(r.rent_due_day), q(r.start_date), q(r.end_date),
  q(r.status), q(r.notes), b(r.ended),
].join(",")})`).join(",\n");

const costRows = records.flatMap((r) => r.costs.map((c) => `(${[
  q(r.ref), q(c.cost_type), q(c.remitted_on), q(c.payee_name ?? ""), n(c.amount ?? 0), q(c.note ?? ""),
].join(",")})`)).join(",\n");

const monthRows = records.flatMap((r) => r.months.map((m) => {
  const mm = String(m.month).padStart(2, "0");
  const dueDay = Math.min(r.rent_due_day ?? m.paid_day ?? 1, 28);
  return `(${[
    q(r.ref), m.month, q(`MH-R-${YEAR}-${mm}-${String(r.seq).padStart(4, "0")}`),
    n(m.amount ?? 0), q(m.status),
    q(`${YEAR}-${mm}-${String(dueDay).padStart(2, "0")}`),
    q(m.paid_day ? `${YEAR}-${mm}-${String(m.paid_day).padStart(2, "0")}` : null),
    q(m.method), q(`${YEAR}년 ${m.month}월 월세 (${r.unit}호)`), q(m.note),
  ].join(",")})`;
})).join(",\n");

const unitRows = [...unitFinal.entries()].map(([unit, st]) => `(${q(unit)},${q(st)})`).join(",\n");

const cleanupSql = CLEANUP_TESTS ? `
-- 0. pre-existing TEST/샘플 데이터 소프트 삭제
UPDATE contracts SET deleted_at = now(), updated_at = now()
 WHERE deleted_at IS NULL AND (contract_ref LIKE 'MS-C-%' OR contract_ref LIKE 'MH-CT-%'${PURGE_DEMO ? " OR contract_ref LIKE 'SMP-CT-%'" : ""});
UPDATE accounts SET deleted_at = now(), updated_at = now()
 WHERE deleted_at IS NULL AND (name LIKE 'TEST-%'${PURGE_DEMO ? " OR name LIKE '데모 %'" : ""});
UPDATE contacts SET deleted_at = now(), updated_at = now()
 WHERE deleted_at IS NULL AND email LIKE '%@example.com';
` : "";

const sql = `
BEGIN;
${cleanupSql}
CREATE TEMP TABLE imp (
  seq int, ref text, unit text, account_name text, org text,
  p1_first text, p1_last text, p2_first text, p2_last text,
  mobile text, office text, phone_note text,
  addr1 text, suburb text, state text, country text,
  category text, down_payment numeric, down_payment_date text,
  balance_amount numeric, balance_date text, bond_amount numeric,
  monthly_rent numeric, rent_due_day int, start_date text, end_date text,
  status text, notes text, ended boolean
) ON COMMIT DROP;
INSERT INTO imp VALUES
${impRows};

CREATE TEMP TABLE imp_cost (ref text, cost_type text, remitted_on text, payee text, amount numeric, note text) ON COMMIT DROP;
${costRows ? `INSERT INTO imp_cost VALUES\n${costRows};` : ""}

CREATE TEMP TABLE imp_month (
  ref text, month int, invoice_ref text, amount numeric, status text,
  due_date text, paid_on text, method text, descr text, note text
) ON COMMIT DROP;
${monthRows ? `INSERT INTO imp_month VALUES\n${monthRows};` : ""}

CREATE TEMP TABLE imp_unit (unit text, next_status text) ON COMMIT DROP;
INSERT INTO imp_unit VALUES
${unitRows};

-- unmapped 호수 (must be empty)
CREATE TEMP TABLE unmapped AS
SELECT i.unit, i.account_name FROM imp i
 WHERE NOT EXISTS (SELECT 1 FROM spaces s WHERE s.name = i.unit || '호' AND s.parent_space_id IS NOT NULL AND s.deleted_at IS NULL);

-- 1. contacts (성/이름 분리, 한국 주소, email 없음 → NULL)
WITH src AS (
  SELECT p1_first f, p1_last l, mobile, office, phone_note, addr1, suburb, state, country FROM imp WHERE p1_first <> ''
  UNION ALL
  SELECT p2_first, p2_last, mobile, office, phone_note, addr1, suburb, state, country FROM imp WHERE p2_first <> ''
), dedup AS (
  SELECT DISTINCT ON (f, l, COALESCE(mobile,'')) * FROM src ORDER BY f, l, COALESCE(mobile,'')
)
INSERT INTO contacts
  (first_name, last_name, email, mobile_number, office_number, address_line1, suburb, state,
   postcode, country, description, manual_input, status)
SELECT d.f, d.l, NULL, d.mobile, d.office, NULLIF(d.addr1,''), NULLIF(d.suburb,''), NULLIF(d.state,''),
       NULL, d.country, NULLIF(d.phone_note,''), true, 'Active'
FROM dedup d
WHERE NOT EXISTS (
  SELECT 1 FROM contacts c WHERE c.deleted_at IS NULL AND c.first_name = d.f AND c.last_name = d.l
    AND COALESCE(c.mobile_number,'') = COALESCE(d.mobile,'')
);

-- 2. accounts (세입자; 법인/기관은 상위 계정으로 1개만, 기존 동명 계정은 재사용)
INSERT INTO accounts
  (name, account_type, default_currency, phone1, phone2, address_line1, address_suburb,
   address_state, address_country, description, manual_input, status)
SELECT DISTINCT ON (i.account_name)
  i.account_name, 'Tenant', 'KRW', i.mobile, i.office, NULLIF(i.addr1,''), NULLIF(i.suburb,''),
  NULLIF(i.state,''), i.country,
  CASE WHEN COALESCE(i.org,'') <> '' THEN '법인/기관 세입자 (2026 임대리스트 이관)'
       ELSE '세입자 (2026 임대리스트 이관)' END,
  true, 'Active'
FROM imp i
WHERE NOT EXISTS (SELECT 1 FROM accounts a WHERE a.deleted_at IS NULL AND a.name = i.account_name)
ORDER BY i.account_name, i.seq;

-- 계정 ↔ 연락처 연결 + 주소/전화 백필 (기존 계정은 빈 값만 채움)
UPDATE accounts a SET
  primary_contact_id = COALESCE(a.primary_contact_id, c.id),
  phone1 = COALESCE(a.phone1, i.mobile), phone2 = COALESCE(a.phone2, i.office),
  address_line1 = COALESCE(NULLIF(a.address_line1,''), NULLIF(i.addr1,'')),
  address_suburb = COALESCE(NULLIF(a.address_suburb,''), NULLIF(i.suburb,'')),
  address_state = COALESCE(NULLIF(a.address_state,''), NULLIF(i.state,'')),
  address_country = COALESCE(NULLIF(a.address_country,''), i.country),
  default_currency = 'KRW', updated_at = now()
FROM (SELECT DISTINCT ON (account_name) * FROM imp ORDER BY account_name, seq) i
LEFT JOIN contacts c ON c.deleted_at IS NULL AND c.first_name = i.p1_first AND c.last_name = i.p1_last
  AND COALESCE(c.mobile_number,'') = COALESCE(i.mobile,'') AND i.p1_first <> ''
WHERE a.deleted_at IS NULL AND a.name = i.account_name;

UPDATE accounts a SET secondary_contact_id = c.id, updated_at = now()
FROM (SELECT DISTINCT ON (account_name) * FROM imp WHERE p2_first <> '' ORDER BY account_name, seq) i
JOIN contacts c ON c.deleted_at IS NULL AND c.first_name = i.p2_first AND c.last_name = i.p2_last
  AND COALESCE(c.mobile_number,'') = COALESCE(i.mobile,'')
WHERE a.deleted_at IS NULL AND a.name = i.account_name AND a.secondary_contact_id IS NULL;

-- 3. contracts (계약서 구분/계약금/잔금/보증금/월세/납입일/입주일/퇴거일/비고)
INSERT INTO contracts
  (contract_ref, tenant_account_id, landlord_account_id, space_id, contract_category,
   down_payment, down_payment_date, balance_amount, balance_date, bond_amount,
   monthly_rent, rent_due_day, start_date, end_date, status, notes, currency)
SELECT i.ref,
       (SELECT a.id FROM accounts a WHERE a.deleted_at IS NULL AND a.name = i.account_name ORDER BY a.id LIMIT 1),
       s.landlord_account_id, s.id, i.category,
       i.down_payment, i.down_payment_date, i.balance_amount, i.balance_date, i.bond_amount,
       i.monthly_rent, i.rent_due_day, i.start_date, i.end_date, i.status, i.notes, '${CURRENCY}'
FROM imp i
JOIN spaces s ON s.name = i.unit || '호' AND s.parent_space_id IS NOT NULL AND s.deleted_at IS NULL
ON CONFLICT (contract_ref) DO UPDATE SET
  tenant_account_id = EXCLUDED.tenant_account_id,
  landlord_account_id = COALESCE(contracts.landlord_account_id, EXCLUDED.landlord_account_id),
  space_id = EXCLUDED.space_id, contract_category = EXCLUDED.contract_category,
  down_payment = EXCLUDED.down_payment, down_payment_date = EXCLUDED.down_payment_date,
  balance_amount = EXCLUDED.balance_amount, balance_date = EXCLUDED.balance_date,
  bond_amount = EXCLUDED.bond_amount, monthly_rent = EXCLUDED.monthly_rent,
  rent_due_day = EXCLUDED.rent_due_day, start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date, status = EXCLUDED.status, notes = EXCLUDED.notes,
  currency = EXCLUDED.currency, deleted_at = NULL, updated_at = now();

-- 4. contract_related_costs (입주청소 / 임대수수료 / 부동산수수료)
DELETE FROM contract_related_costs rc
 USING contracts c JOIN imp i ON i.ref = c.contract_ref
 WHERE rc.contract_id = c.id;
INSERT INTO contract_related_costs (contract_id, cost_type, remitted_on, payee_name, amount, currency, note, status)
SELECT c.id, m.cost_type, m.remitted_on, COALESCE(m.payee,''), COALESCE(m.amount,0), '${CURRENCY}', COALESCE(m.note,''), 'Active'
FROM imp_cost m JOIN contracts c ON c.contract_ref = m.ref;

-- 5. 2026년 월세 입금 현황 → invoices (월 1건)
DELETE FROM invoices inv
 USING contracts c JOIN imp i ON i.ref = c.contract_ref
 WHERE inv.contract_id = c.id AND inv.invoice_ref LIKE 'MH-R-${YEAR}-%';
INSERT INTO invoices
  (invoice_ref, contract_id, account_id, amount, currency, status, due_date, paid_at,
   payment_method, description, notes)
SELECT m.invoice_ref, c.id, c.tenant_account_id, m.amount, '${CURRENCY}', m.status,
       m.due_date, NULLIF(m.paid_on,'')::timestamptz, m.method, m.descr, m.note
FROM imp_month m JOIN contracts c ON c.contract_ref = m.ref;

-- 6. spaces.status 동기화 (진행 계약 → 임대 / 최종 퇴거 → 공실)
UPDATE spaces s SET status = u.next_status, updated_at = now()
FROM imp_unit u
WHERE s.name = u.unit || '호' AND s.parent_space_id IS NOT NULL AND s.deleted_at IS NULL
  AND s.status IS DISTINCT FROM u.next_status;

-- ── report ───────────────────────────────────────────────────────────────────
SELECT 'REPORT' AS marker,
  (SELECT count(*) FROM imp) AS rows_in_scope,
  (SELECT count(*) FROM unmapped) AS unmapped_units,
  (SELECT count(*) FROM contacts WHERE deleted_at IS NULL) AS contacts_total,
  (SELECT count(*) FROM contacts WHERE deleted_at IS NULL AND manual_input) AS contacts_imported,
  (SELECT count(*) FROM accounts WHERE deleted_at IS NULL AND account_type = 'Tenant') AS tenant_accounts,
  (SELECT count(*) FROM contracts WHERE deleted_at IS NULL AND contract_ref LIKE 'MH-L-${YEAR}-%') AS contracts_imported,
  (SELECT count(*) FROM contracts WHERE deleted_at IS NULL) AS contracts_total,
  (SELECT count(*) FROM contract_related_costs) AS related_costs,
  (SELECT count(*) FROM invoices WHERE invoice_ref LIKE 'MH-R-${YEAR}-%') AS invoices_2026,
  (SELECT count(*) FROM spaces WHERE status = '임대' AND parent_space_id IS NOT NULL) AS spaces_rented,
  (SELECT count(*) FROM spaces WHERE status = '공실' AND parent_space_id IS NOT NULL) AS spaces_vacant;

SELECT 'COSTS' AS marker, cost_type, count(*) AS rows, sum(amount)::bigint AS total
  FROM contract_related_costs GROUP BY cost_type ORDER BY cost_type;

SELECT 'INVOICES' AS marker, status, count(*) AS rows, sum(amount)::bigint AS total
  FROM invoices WHERE invoice_ref LIKE 'MH-R-${YEAR}-%' GROUP BY status ORDER BY status;

SELECT 'SAMPLE' AS marker, c.contract_ref, s.name AS unit, a.name AS tenant, c.contract_category,
       c.bond_amount::bigint, c.monthly_rent::bigint, c.rent_due_day, c.start_date, c.end_date, c.status
  FROM contracts c JOIN spaces s ON s.id = c.space_id LEFT JOIN accounts a ON a.id = c.tenant_account_id
 WHERE c.contract_ref LIKE 'MH-L-${YEAR}-%' ORDER BY c.contract_ref LIMIT 8;

SELECT 'CONTACTS' AS marker, last_name, first_name, mobile_number, state, suburb, address_line1
  FROM contacts WHERE deleted_at IS NULL AND manual_input ORDER BY id LIMIT 10;

SELECT 'UNMAPPED' AS marker, * FROM unmapped;

${COMMIT ? "COMMIT;" : "ROLLBACK;"}
`;

// ── Execute ──────────────────────────────────────────────────────────────────
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL.replace(/[?&](pgbouncer|uselibpqcompat|sslnegotiation|sslmode)=[^&]*/g, ""),
  ssl: { rejectUnauthorized: false },
  max: 1,
});

const sqlPath = REPORT_PATH ? REPORT_PATH.replace(/\.json$/, "") + ".sql" : null;
if (sqlPath) fs.writeFileSync(sqlPath, sql);

const report = {
  csv: path.basename(CSV_PATH),
  mode: COMMIT ? "COMMIT" : "DRY-RUN",
  cleanup_tests: CLEANUP_TESTS,
  purge_demo: PURGE_DEMO,
  duplicate_rows_dropped: duplicates,
  rows_in_scope: records.length,
  parsed: {
    tenant_accounts: new Set(records.map((r) => r.account_name)).size,
    org_accounts: [...new Set(records.filter((r) => r.org).map((r) => r.org))],
    persons: new Set(records.flatMap((r) => r.persons)).size,
    related_costs: records.reduce((s, r) => s + r.costs.length, 0),
    monthly_entries: records.reduce((s, r) => s + r.months.length, 0),
    completed: records.filter((r) => r.ended).length,
    active: records.filter((r) => !r.ended).length,
    auto_renew: records.filter((r) => r.auto_renew).length,
  },
  name_split_sample: [...new Set(records.flatMap((r) => r.persons))].slice(0, 10)
    .map((p) => ({ 성함: p, ...splitKoreanName(p) })),
  address_sample: records.slice(0, 5).map((r) => ({ 원본_주소: r.addr, 호수: r.unit })),
  db: {},
};

const client = await pool.connect();
try {
  const results = await client.query(sql);
  const arr = Array.isArray(results) ? results : [results];
  for (const res of arr) {
    const first = res.rows?.[0];
    if (!first || !first.marker) continue;
    const key = first.marker.toLowerCase();
    report.db[key] = res.rows.map(({ marker, ...rest }) => rest);
  }
} finally {
  client.release();
  await pool.end();
}

console.log(COMMIT ? "✅ COMMITTED" : "🧪 DRY RUN — rolled back, nothing written");
console.log(JSON.stringify(report, null, 2));
if (REPORT_PATH) {
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`report → ${REPORT_PATH}${sqlPath ? `\nsql    → ${sqlPath}` : ""}`);
}
