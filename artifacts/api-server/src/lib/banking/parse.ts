// 은행 명세서 CSV/TSV 파싱.
//
// 은행이 내려주는 파일은 깔끔하지 않다 — 위쪽에 조회조건 몇 줄, 금액에 ₩와 콤마,
// 셀 안에 줄바꿈, BOM. 헤더 행을 **찾아서** 거기서부터 읽는다.
import { findProfile, type BankProfile } from "./profiles";

export interface StatementRow {
  txn_date: string;      // YYYY-MM-DD
  withdrawal: number;
  deposit: number;
  balance: number | null;
  memo: string;
}

export interface ParseResult {
  rows: StatementRow[];
  /** 헤더를 찾은 행 번호(1-base) — 화면에서 "이 줄부터 읽었다"를 보여준다. */
  header_line: number;
  /** 건너뛴 줄 수(조회조건·소계 등). */
  skipped: number;
  warnings: string[];
}

const norm = (s: string) => s.replace(/[\s"']/g, "").replace(/﻿/g, "");

/** 한 줄을 CSV 로 자른다. 따옴표 안의 콤마는 지킨다. */
function splitCsv(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++; }
      else q = !q;
    } else if (ch === delim && !q) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

/** "₩1,500,000" · "1,500,000원" · "-" → 숫자. 못 읽으면 0. */
function money(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  if (!cleaned || cleaned === "-") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

/** "2026-08-28" · "2026.08.28" · "2026/08/28 16:47" · "20260828" → YYYY-MM-DD. */
function isoDate(raw: string): string | null {
  const s = raw.trim();
  let m = /(\d{4})[-.\/](\d{1,2})[-.\/](\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;
  m = /^(\d{4})(\d{2})(\d{2})/.exec(s.replace(/\D/g, ""));
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

function pick(headers: string[], candidates: string[]): number {
  const h = headers.map(norm);
  for (const c of candidates) {
    const i = h.findIndex((x) => x.includes(norm(c)));
    if (i >= 0) return i;
  }
  return -1;
}

export function parseStatement(text: string, bankId: string): ParseResult {
  const profile: BankProfile = findProfile(bankId);
  const clean = text.replace(/\r\n?/g, "\n").replace(/^﻿/, "");
  const lines = clean.split("\n");
  // 탭이 콤마보다 많으면 TSV 다(엑셀에서 복사해 붙여넣으면 탭이 온다).
  const sample = lines.slice(0, 30).join("\n");
  const delim = (sample.match(/\t/g)?.length ?? 0) > (sample.match(/,/g)?.length ?? 0) ? "\t" : ",";

  // 헤더 행 찾기 — 날짜와 입금(또는 출금) 컬럼이 동시에 보이는 첫 줄.
  let headerIdx = -1, cols: string[] = [];
  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    const c = splitCsv(lines[i]!, delim);
    if (c.length < 3) continue;
    const d = pick(c, profile.headers.date);
    const dep = pick(c, profile.headers.deposit);
    const wd = pick(c, profile.headers.withdrawal);
    if (d >= 0 && (dep >= 0 || wd >= 0)) { headerIdx = i; cols = c; break; }
  }
  if (headerIdx < 0) {
    throw new Error(
      "명세서의 헤더 줄을 찾지 못했습니다. 은행을 다시 고르거나, 거래일자·입금·출금 컬럼이 포함된 원본을 올려 주세요.",
    );
  }

  const iDate = pick(cols, profile.headers.date);
  const iWd = pick(cols, profile.headers.withdrawal);
  const iDep = pick(cols, profile.headers.deposit);
  const iBal = pick(cols, profile.headers.balance);
  const iMemo = pick(cols, profile.headers.memo);
  const iExtra = profile.headers.extra ? pick(cols, profile.headers.extra) : -1;

  const warnings: string[] = [];
  if (iMemo < 0) warnings.push("적요 컬럼을 찾지 못했습니다 — 계약 자동 매칭이 크게 떨어집니다.");
  if (iWd < 0) warnings.push("출금 컬럼이 없습니다. 입금만 담긴 추출본이면 잔액 대사는 할 수 없습니다.");

  const rows: StatementRow[] = [];
  let skipped = 0;
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const raw = lines[i]!;
    if (!raw.trim()) { continue; }
    const c = splitCsv(raw, delim);
    const date = iDate >= 0 ? isoDate(c[iDate] ?? "") : null;
    if (!date) { skipped++; continue; }           // 합계·소계 줄
    const wd = iWd >= 0 ? money(c[iWd] ?? "") : 0;
    const dep = iDep >= 0 ? money(c[iDep] ?? "") : 0;
    if (wd === 0 && dep === 0) { skipped++; continue; }  // 금액 없는 줄
    // 보조 컬럼은 이름이 들어 있을 때만 붙인다. 거래점 코드("48000") 같은 순수
    // 숫자를 적요에 이어 붙이면 매칭에 잡음만 늘고, 중복 판정 키도 지저분해진다.
    const extra = iExtra >= 0 ? (c[iExtra] ?? "").trim() : "";
    const memoParts = [
      iMemo >= 0 ? (c[iMemo] ?? "").trim() : "",
      /^\d+$/.test(extra) ? "" : extra,
    ].filter(Boolean);
    rows.push({
      txn_date: date,
      withdrawal: wd,
      deposit: dep,
      balance: iBal >= 0 ? (money(c[iBal] ?? "") || null) : null,
      memo: memoParts.join(" ").trim(),
    });
  }

  if (rows.length === 0) throw new Error("읽을 수 있는 거래 줄이 없습니다. 파일을 확인해 주세요.");
  return { rows, header_line: headerIdx + 1, skipped, warnings };
}
