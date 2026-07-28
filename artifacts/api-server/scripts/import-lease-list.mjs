/**
 * import-lease-list.mjs
 *
 * Idempotent migration of a Metheim 여수 "임대리스트" spreadsheet (any year) into
 * the real tables:
 *
 *   contacts                 성함(성/이름 분리) · 연락처 · 한국 주소
 *   accounts                 세입자(Tenant) 계정, 법인은 상위 계정으로 재사용
 *   contracts                계약서 구분/계약금/잔금/보증금/월세/납입일/입주일/퇴거일/비고
 *   contract_related_costs   입주청소 · 임대수수료 · 부동산수수료
 *   invoices                 해당 연도 월별 월세 입금 현황 (월 1건)
 *   spaces.status            계약 있는 세대 → 임대 / 최종 퇴거 → 공실
 *
 * NEVER DUPLICATES. Older sheets (2023/2024/2025) list tenants and leases that a
 * later sheet already brought in, so every row is matched to what exists first:
 *   - contact  → 성/이름 + 휴대폰 (없으면 성/이름) 일치 시 기존 연락처를 보강
 *   - account  → 같은 이름의 기존 계정을 재사용 (SpaceOwner 등 타입 무관)
 *   - contract → 같은 호실 + 같은 입주일이면 같은 계약으로 보고 빈 값만 채움
 *   - costs    → 같은 (계약·항목·송금일·금액) 행은 다시 넣지 않음
 *   - invoices → 계약당 월 1건, 이미 있으면 건너뜀
 * So a lease running 2024→2026 stays ONE contract no matter how many sheets it
 * appears in, and re-running the same sheet changes nothing.
 *
 * Columns are resolved by HEADER TEXT (with aliases), not by position, so a year
 * whose sheet has extra/missing/reordered columns still imports.
 *
 * Runs against one tenant DB. Default is DRY RUN — nothing is written and a full
 * report is printed; pass --commit to apply inside a single transaction.
 *
 * Usage:
 *   DATABASE_URL=<db> node scripts/import-lease-list.mjs \
 *     --csv "~/Downloads/2025년 임대리스트.csv" [--year 2025] \
 *     [--commit] [--cleanup-tests] [--purge-demo] [--report <path>]
 *
 * Flags:
 *   --year N         ledger year for the monthly rent columns (default: parsed
 *                    from the "YYYY년 월세 입금 현황" header, else current year)
 *   --commit         apply (otherwise dry run)
 *   --cleanup-tests  soft-delete the pre-existing TEST/샘플 tenant data + their invoices
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
const YEAR_OPT = opt("--year") ? Number(opt("--year")) : null;

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

// ── Column resolution by header text ─────────────────────────────────────────
// Sheets differ year to year (extra columns, renamed headers, reordered blocks),
// so columns are found by their header wording instead of a fixed index. Row 0 is
// the group header, row 1 the sub header (입금일/성함/입금액, 1월…12월).
const HEADER_ALIASES = {
  no: ["NO", "번호", "연번"],
  contractDate: ["계약일", "계약체결일"],
  name: ["성함", "성명", "이름", "임차인", "세입자"],
  type: ["TYPE", "타입", "유형"],
  unit: ["호수", "호실", "세대"],
  phone: ["연락처", "전화번호", "휴대폰", "핸드폰"],
  address: ["주소", "주소지"],
  category: ["계약서 구분", "계약구분", "계약 구분"],
  downDate: ["계약금입금일", "계약금 입금일"],
  down: ["계약금"],
  balDate: ["잔금입금일", "잔금 입금일"],
  bal: ["잔금"],
  bond: ["보증금"],
  rent: ["월세", "임대료", "월임대료"],
  rentDue: ["월세 납입일", "월세납입일", "납입일", "납부일"],
  moveIn: ["입주일", "입주"],
  moveOut: ["퇴거일", "퇴거", "만료일"],
  cleaning: ["입주청소", "입주 청소"],
  leaseFee: ["임대수수료 입금", "임대수수료", "임대 수수료"],
  agencyFee: ["부동산 수수료 입금", "부동산수수료", "부동산 수수료", "중개수수료"],
  total: ["합  계", "합계", "총계"],
  note: ["비  고", "비고", "특이사항"],
  monthly: ["월세 입금 현황", "월세입금현황", "입금 현황"],
};

const norm = (v) => String(v ?? "").replace(/\s+/g, " ").trim();

/** Locate every column this importer understands; throws when a must-have is missing. */
function resolveColumns(groupRow, subRow) {
  const find = (aliases) => {
    for (let i = 0; i < groupRow.length; i++) {
      const h = norm(groupRow[i]);
      if (!h) continue;
      if (aliases.some((a) => h === a || h.replace(/\s/g, "") === a.replace(/\s/g, ""))) return i;
    }
    return -1;
  };
  const C = {};
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) C[key] = find(aliases);

  // Fee blocks span three sub-columns: 입금일 / 성함 / 입금액.
  const feeTriple = (startIdx) => {
    if (startIdx < 0) return { date: -1, payee: -1, amount: -1 };
    const at = (label, from) => {
      for (let i = from; i < Math.min(from + 4, subRow.length); i++) {
        const sub = norm(subRow[i]).replace(/\s/g, "");
        if (sub === label) return i;
      }
      return -1;
    };
    return {
      date: at("입금일", startIdx),
      payee: at("성함", startIdx),
      amount: at("입금액", startIdx),
    };
  };
  C.leaseFeeCols = feeTriple(C.leaseFee);
  C.agencyFeeCols = feeTriple(C.agencyFee);

  // Monthly rent block: sub headers 1월…12월 after the group header.
  C.months = {};
  const monthStart = C.monthly >= 0 ? C.monthly : 0;
  for (let i = monthStart; i < subRow.length; i++) {
    const m = norm(subRow[i]).match(/^(\d{1,2})\s*월$/);
    if (m) {
      const n = Number(m[1]);
      if (n >= 1 && n <= 12 && C.months[n] === undefined) C.months[n] = i;
    }
  }

  const missing = ["name", "unit"].filter((k) => C[k] < 0);
  if (missing.length) {
    throw new Error(`필수 컬럼을 찾지 못했습니다: ${missing.join(", ")} — 헤더 별칭(HEADER_ALIASES)에 추가하세요`);
  }
  return C;
}

/** "2025년 월세 입금 현황" → 2025 */
function detectYear(groupRow, colIdx) {
  const cell = norm(groupRow[colIdx >= 0 ? colIdx : 0]);
  const m = cell.match(/(20\d{2})\s*년/);
  return m ? Number(m[1]) : null;
}

// ── Value parsing helpers ────────────────────────────────────────────────────
/** Read a cell by resolved column index; a column the sheet lacks reads as "". */
const cell = (row, idx) => (idx >= 0 && idx < row.length ? row[idx] : "");

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
const C = resolveColumns(allRows[0] ?? [], allRows[1] ?? []);
const YEAR = YEAR_OPT ?? detectYear(allRows[0] ?? [], C.monthly) ?? new Date().getFullYear();
const bodyRows = allRows.slice(2).filter((r) => r.some((c) => clean(c)));

const seen = new Set();
const rowsIn = [];
const duplicates = [];
for (const r of bodyRows) {
  const key = r.map(clean).join("");
  if (seen.has(key)) { duplicates.push({ name: clean(cell(r, C.name)), unit: clean(cell(r, C.unit)) }); continue; }
  seen.add(key);
  rowsIn.push(r);
}

const records = rowsIn.map((r, i) => {
  const seq = i + 1;
  const nameCell = clean(cell(r, C.name));
  const { org, persons } = parseNameCell(nameCell);
  const phones = parsePhones(cell(r, C.phone));
  const addr = parseKoreanAddress(cell(r, C.address));
  const contractDate = parseDate(cell(r, C.contractDate));
  const down = parseMoney(cell(r, C.down));
  const downDate = parseDate(cell(r, C.downDate));
  const bal = parseMoney(cell(r, C.bal));
  const balDate = parseDate(cell(r, C.balDate));
  const bond = parseMoney(cell(r, C.bond));
  const rent = parseMoney(cell(r, C.rent));
  const due = parseDueDay(cell(r, C.rentDue));
  const moveIn = parseDate(cell(r, C.moveIn));
  const moveOut = parseDate(cell(r, C.moveOut));
  const flagCol = clean(cell(r, C.no));

  const noteParts = [];
  const bizNote = clean(cell(r, C.note));
  if (bizNote) noteParts.push(bizNote);
  if (moveOut.note) noteParts.push(`퇴거일 원문: ${moveOut.note}`);
  if (downDate.note) noteParts.push(`계약금 입금일 원문: ${downDate.note}`);
  if (balDate.note) noteParts.push(`잔금 입금일 원문: ${balDate.note}`);
  if (moveIn.note) noteParts.push(`입주일 원문: ${moveIn.note}`);
  if (bond.note) noteParts.push(`보증금 비고: ${bond.note}`);
  if (due.note) noteParts.push(`월세 납입일 원문: ${due.note}`);
  if (phones.note && /[가-힣(]/.test(phones.note)) noteParts.push(`연락처 원문: ${phones.note}`);
  noteParts.push(`[${YEAR} 임대리스트 NO ${flagCol || seq}]`);

  const costs = [];
  const cleaning = clean(cell(r, C.cleaning));
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
  const leaseAmt = parseMoney(cell(r, C.leaseFeeCols.amount));
  if (leaseAmt.amount || clean(cell(r, C.leaseFeeCols.payee))) {
    costs.push({
      cost_type: "임대수수료",
      remitted_on: parseDate(cell(r, C.leaseFeeCols.date)).date,
      payee_name: clean(cell(r, C.leaseFeeCols.payee)).replace(/\n/g, " / "),
      amount: leaseAmt.amount ?? 0,
      note: "",
    });
  }
  const agencyAmt = parseMoney(cell(r, C.agencyFeeCols.amount));
  if (agencyAmt.amount || clean(cell(r, C.agencyFeeCols.payee))) {
    costs.push({
      cost_type: "부동산수수료",
      remitted_on: parseDate(cell(r, C.agencyFeeCols.date)).date,
      payee_name: clean(cell(r, C.agencyFeeCols.payee)).replace(/\n/g, " / "),
      amount: agencyAmt.amount ?? 0,
      note: "",
    });
  }

  const months = [];
  for (let m = 1; m <= 12; m++) {
    const monthIdx = C.months[m];
    if (monthIdx === undefined) continue;
    const parsed = parseMonthCell(cell(r, monthIdx), m, rent.amount ?? 0);
    if (parsed) months.push({ month: m, ...parsed });
  }

  return {
    seq,
    ref: `ROW-${String(seq).padStart(4, "0")}`, // sheet-row key; the DB ref is resolved by identity
    sourceNo: flagCol,
    vacated: flagCol === "퇴거",
    nameCell, org, persons,
    phones, addr,
    unit: clean(cell(r, C.unit)),
    typeLabel: clean(cell(r, C.type)),
    category: clean(cell(r, C.category)) || null,
    contract_date: contractDate.date,
    down_payment: down.amount, down_payment_date: downDate.date,
    balance_amount: bal.amount, balance_date: balDate.date,
    bond_amount: bond.amount,
    monthly_rent: rent.amount,
    rent_due_day: due.day,
    start_date: moveIn.date,
    end_date: moveOut.date,
    auto_renew: /자동연장/.test(clean(cell(r, C.moveOut))),
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
    q(r.ref), m.month, q(`MH-R-${YEAR}-${mm}-${r.unit}`),
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
-- Invoices hanging off a retired test contract would still count in the finance
-- dashboard, so retire them with their contract.
UPDATE invoices SET deleted_at = now(), updated_at = now()
 WHERE deleted_at IS NULL AND contract_id IN (SELECT id FROM contracts WHERE deleted_at IS NOT NULL);
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

-- 1. contacts — 기존 연락처를 먼저 찾고(성/이름 + 휴대폰, 한쪽 번호가 비었으면 이름만으로도
--    동일인으로 봄), 없을 때만 새로 만든다. 기존 행은 비어 있는 칸만 채운다.
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
  SELECT 1 FROM contacts c
   WHERE c.deleted_at IS NULL AND c.first_name = d.f AND c.last_name = d.l
     AND (COALESCE(c.mobile_number,'') = COALESCE(d.mobile,'')
       OR COALESCE(c.mobile_number,'') = '' OR COALESCE(d.mobile,'') = '')
);

-- 기존 연락처 보강 (덮어쓰지 않고 빈 칸만)
UPDATE contacts c SET
  mobile_number = COALESCE(c.mobile_number, i.mobile),
  office_number = COALESCE(c.office_number, i.office),
  address_line1 = COALESCE(NULLIF(c.address_line1,''), NULLIF(i.addr1,'')),
  suburb        = COALESCE(NULLIF(c.suburb,''), NULLIF(i.suburb,'')),
  state         = COALESCE(NULLIF(c.state,''), NULLIF(i.state,'')),
  country       = COALESCE(NULLIF(c.country,''), i.country),
  updated_at = now()
FROM imp i
WHERE c.deleted_at IS NULL AND i.p1_first <> ''
  AND c.first_name = i.p1_first AND c.last_name = i.p1_last
  AND (COALESCE(c.mobile_number,'') = COALESCE(i.mobile,'')
    OR COALESCE(c.mobile_number,'') = '' OR COALESCE(i.mobile,'') = '');

-- 2. accounts — 같은 이름의 기존 계정이 있으면 타입과 무관하게 재사용(건물주가 세입자인 경우 포함),
--    없을 때만 Tenant 계정을 만든다.
INSERT INTO accounts
  (name, account_type, default_currency, phone1, phone2, address_line1, address_suburb,
   address_state, address_country, description, manual_input, status)
SELECT DISTINCT ON (i.account_name)
  i.account_name, 'Tenant', '${CURRENCY}', i.mobile, i.office, NULLIF(i.addr1,''), NULLIF(i.suburb,''),
  NULLIF(i.state,''), i.country,
  CASE WHEN COALESCE(i.org,'') <> '' THEN '법인/기관 세입자 (${YEAR} 임대리스트 이관)'
       ELSE '세입자 (${YEAR} 임대리스트 이관)' END,
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
  default_currency = COALESCE(a.default_currency, '${CURRENCY}'), updated_at = now()
FROM (SELECT DISTINCT ON (account_name) * FROM imp ORDER BY account_name, seq) i
LEFT JOIN contacts c ON c.deleted_at IS NULL AND c.first_name = i.p1_first AND c.last_name = i.p1_last
  AND (COALESCE(c.mobile_number,'') = COALESCE(i.mobile,'') OR COALESCE(i.mobile,'') = '')
  AND i.p1_first <> ''
WHERE a.deleted_at IS NULL AND a.name = i.account_name;

UPDATE accounts a SET secondary_contact_id = c.id, updated_at = now()
FROM (SELECT DISTINCT ON (account_name) * FROM imp WHERE p2_first <> '' ORDER BY account_name, seq) i
JOIN contacts c ON c.deleted_at IS NULL AND c.first_name = i.p2_first AND c.last_name = i.p2_last
WHERE a.deleted_at IS NULL AND a.name = i.account_name AND a.secondary_contact_id IS NULL;

-- 3. contracts — 계약의 신원은 "호실 + 입주일". 이미 있으면 그 계약을 채우고,
--    없을 때만 새 계약을 만든다(다른 연도 시트에 같은 계약이 또 나와도 1건 유지).
ALTER TABLE imp ADD COLUMN space_id int;
ALTER TABLE imp ADD COLUMN existing_id int;
ALTER TABLE imp ADD COLUMN final_ref text;

UPDATE imp i SET space_id = s.id
  FROM spaces s
 WHERE s.name = i.unit || '호' AND s.parent_space_id IS NOT NULL AND s.deleted_at IS NULL;

UPDATE imp i SET existing_id = c.id, final_ref = c.contract_ref
  FROM contracts c
 WHERE c.deleted_at IS NULL AND c.space_id = i.space_id
   AND c.start_date IS NOT NULL AND i.start_date IS NOT NULL
   AND c.start_date = i.start_date;

-- 새 계약 ref 는 해당 연도 접두사에서 이어붙인다 (다른 연도 ref 와 충돌하지 않음)
WITH base AS (
  SELECT COALESCE(MAX(NULLIF(regexp_replace(contract_ref, '^MH-L-\d{4}-', ''), '')::int), 0) AS n
    FROM contracts
   WHERE contract_ref ~ '^MH-L-${YEAR}-\d+$'
), numbered AS (
  SELECT seq, row_number() OVER (ORDER BY seq) AS rn FROM imp WHERE existing_id IS NULL
)
UPDATE imp i SET final_ref = 'MH-L-${YEAR}-' || lpad(((SELECT n FROM base) + n.rn)::text, 4, '0')
  FROM numbered n WHERE i.seq = n.seq;

INSERT INTO contracts
  (contract_ref, tenant_account_id, landlord_account_id, space_id, contract_category,
   down_payment, down_payment_date, balance_amount, balance_date, bond_amount,
   monthly_rent, rent_due_day, start_date, end_date, status, notes, currency)
SELECT i.final_ref,
       (SELECT a.id FROM accounts a WHERE a.deleted_at IS NULL AND a.name = i.account_name ORDER BY a.id LIMIT 1),
       s.landlord_account_id, s.id, i.category,
       i.down_payment, i.down_payment_date, i.balance_amount, i.balance_date, i.bond_amount,
       i.monthly_rent, i.rent_due_day, i.start_date, i.end_date, i.status, i.notes, '${CURRENCY}'
FROM imp i
JOIN spaces s ON s.id = i.space_id
ON CONFLICT (contract_ref) DO UPDATE SET
  -- 시트에 값이 있으면 그 값을, 없으면 기존 값을 유지한다 (오래된 시트가 최신 값을 지우지 않도록)
  tenant_account_id = COALESCE(EXCLUDED.tenant_account_id, contracts.tenant_account_id),
  landlord_account_id = COALESCE(contracts.landlord_account_id, EXCLUDED.landlord_account_id),
  space_id = COALESCE(EXCLUDED.space_id, contracts.space_id),
  contract_category = COALESCE(EXCLUDED.contract_category, contracts.contract_category),
  down_payment = COALESCE(EXCLUDED.down_payment, contracts.down_payment),
  down_payment_date = COALESCE(EXCLUDED.down_payment_date, contracts.down_payment_date),
  balance_amount = COALESCE(EXCLUDED.balance_amount, contracts.balance_amount),
  balance_date = COALESCE(EXCLUDED.balance_date, contracts.balance_date),
  bond_amount = COALESCE(EXCLUDED.bond_amount, contracts.bond_amount),
  monthly_rent = COALESCE(EXCLUDED.monthly_rent, contracts.monthly_rent),
  rent_due_day = COALESCE(EXCLUDED.rent_due_day, contracts.rent_due_day),
  start_date = COALESCE(EXCLUDED.start_date, contracts.start_date),
  -- 종료일은 더 나중 값(연장)이 이긴다
  end_date = CASE
    WHEN contracts.end_date IS NULL OR EXCLUDED.end_date IS NULL THEN COALESCE(contracts.end_date, EXCLUDED.end_date)
    WHEN EXCLUDED.end_date > contracts.end_date THEN EXCLUDED.end_date ELSE contracts.end_date END,
  status = CASE WHEN contracts.status IN ('Draft') THEN EXCLUDED.status ELSE contracts.status END,
  notes = CASE
    WHEN COALESCE(contracts.notes,'') = '' THEN EXCLUDED.notes
    WHEN position('[${YEAR} 임대리스트' in contracts.notes) > 0 THEN contracts.notes
    ELSE contracts.notes || E'\n' || EXCLUDED.notes END,
  currency = COALESCE(contracts.currency, EXCLUDED.currency),
  updated_at = now();

UPDATE imp i SET existing_id = c.id FROM contracts c WHERE c.contract_ref = i.final_ref;

-- 4. contract_related_costs — 같은 (계약·항목·송금일·금액) 행은 다시 넣지 않는다
--    (다른 연도 시트에서 이미 들어온 비용을 지우거나 중복시키지 않음)
INSERT INTO contract_related_costs (contract_id, cost_type, remitted_on, payee_name, amount, currency, note, status)
SELECT i.existing_id, m.cost_type, m.remitted_on, COALESCE(m.payee,''), COALESCE(m.amount,0),
       '${CURRENCY}', COALESCE(m.note,''), 'Active'
FROM imp_cost m JOIN imp i ON i.ref = m.ref
WHERE i.existing_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM contract_related_costs rc
     WHERE rc.contract_id = i.existing_id AND rc.cost_type = m.cost_type
       AND COALESCE(rc.remitted_on,'') = COALESCE(m.remitted_on,'')
       AND rc.amount = COALESCE(m.amount,0));

-- 5. 월별 월세 입금 현황 → invoices (계약당 월 1건, 이미 있으면 건너뜀)
INSERT INTO invoices
  (invoice_ref, contract_id, account_id, amount, currency, status, due_date, paid_at,
   payment_method, description, notes)
SELECT m.invoice_ref, i.existing_id, c.tenant_account_id, m.amount, '${CURRENCY}', m.status,
       m.due_date, NULLIF(m.paid_on,'')::timestamptz, m.method, m.descr, m.note
FROM imp_month m
JOIN imp i ON i.ref = m.ref
JOIN contracts c ON c.id = i.existing_id
WHERE i.existing_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM invoices inv
     WHERE inv.contract_id = i.existing_id AND inv.deleted_at IS NULL
       AND substring(inv.due_date, 1, 7) = substring(m.due_date, 1, 7))
  AND NOT EXISTS (SELECT 1 FROM invoices inv2 WHERE inv2.invoice_ref = m.invoice_ref);

-- 6. spaces.status — 시트가 아니라 DB의 "가장 최근 계약"에서 다시 계산한다.
--    (과거 연도 시트를 넣어도 현재 입주 상태를 되돌리지 않음)
WITH latest AS (
  SELECT DISTINCT ON (c.space_id) c.space_id, c.status
    FROM contracts c
   WHERE c.deleted_at IS NULL AND c.space_id IN (SELECT space_id FROM imp WHERE space_id IS NOT NULL)
   ORDER BY c.space_id, c.start_date DESC NULLS LAST, c.id DESC
)
UPDATE spaces s SET status = CASE WHEN l.status = 'Active' THEN '임대' ELSE '공실' END, updated_at = now()
FROM latest l
WHERE s.id = l.space_id AND s.deleted_at IS NULL
  AND s.status IS DISTINCT FROM (CASE WHEN l.status = 'Active' THEN '임대' ELSE '공실' END)
  AND s.status IN ('임대','공실','Active','Inactive');

-- ── report ───────────────────────────────────────────────────────────────────
SELECT 'REPORT' AS marker,
  (SELECT count(*) FROM imp) AS rows_in_scope,
  (SELECT count(*) FROM unmapped) AS unmapped_units,
  (SELECT count(*) FROM contacts WHERE deleted_at IS NULL) AS contacts_total,
  (SELECT count(*) FROM contacts WHERE deleted_at IS NULL AND manual_input) AS contacts_imported,
  (SELECT count(*) FROM accounts WHERE deleted_at IS NULL AND account_type = 'Tenant') AS tenant_accounts,
  (SELECT count(*) FROM imp WHERE existing_id IS NOT NULL) AS contracts_linked,
  (SELECT count(*) FROM imp WHERE final_ref LIKE 'MH-L-${YEAR}-%' AND existing_id IS NOT NULL) AS contracts_this_year_ref,
  (SELECT count(*) FROM contracts WHERE deleted_at IS NULL) AS contracts_total,
  (SELECT count(*) FROM contract_related_costs) AS related_costs,
  (SELECT count(*) FROM invoices WHERE deleted_at IS NULL AND due_date LIKE '${YEAR}-%') AS invoices_year,
  (SELECT count(*) FROM spaces WHERE status = '임대' AND parent_space_id IS NOT NULL) AS spaces_rented,
  (SELECT count(*) FROM spaces WHERE status = '공실' AND parent_space_id IS NOT NULL) AS spaces_vacant;

SELECT 'COSTS' AS marker, cost_type, count(*) AS rows, sum(amount)::bigint AS total
  FROM contract_related_costs GROUP BY cost_type ORDER BY cost_type;

SELECT 'INVOICES' AS marker, status, count(*) AS rows, sum(amount)::bigint AS total
  FROM invoices WHERE deleted_at IS NULL AND due_date LIKE '${YEAR}-%' GROUP BY status ORDER BY status;

SELECT 'SAMPLE' AS marker, c.contract_ref, s.name AS unit, a.name AS tenant, c.contract_category,
       c.bond_amount::bigint, c.monthly_rent::bigint, c.rent_due_day, c.start_date, c.end_date, c.status
  FROM imp i JOIN contracts c ON c.id = i.existing_id
  JOIN spaces s ON s.id = c.space_id LEFT JOIN accounts a ON a.id = c.tenant_account_id
 ORDER BY i.seq LIMIT 8;

SELECT 'MATCHING' AS marker,
  (SELECT count(*) FROM imp WHERE existing_id IS NOT NULL AND final_ref NOT LIKE 'MH-L-${YEAR}-%') AS matched_existing_other_year,
  (SELECT count(*) FROM imp WHERE space_id IS NULL) AS unit_not_found,
  (SELECT count(*) FROM imp WHERE start_date IS NULL) AS no_move_in_date;

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
  year: YEAR,
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
