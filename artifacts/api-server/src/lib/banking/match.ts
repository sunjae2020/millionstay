// 명세서 한 줄 → 계약·청구서 자동 매칭.
//
// 원칙: **확실하지 않으면 매칭하지 않는다.** 엉뚱한 계약에 입금을 붙이면 그 오류는
// 정산까지 아무도 눈치채지 못한다. 미매칭으로 남겨 사람이 고르게 하는 편이 낫다.
// 그래서 모든 제안에 confidence 를 달아 화면이 "확실 / 확인 필요"를 구분해 보여준다.
import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";
import {
  db, contractsTable, invoicesTable, spacesTable, accountsTable, transactionsTable,
} from "@workspace/db";
import type { StatementRow } from "./parse";

export type MatchKind =
  | "invoice" | "deposit" | "multi_rent" | "rent_no_invoice"
  | "contract_only" | "internal" | "unmatched";

export interface MatchedRow extends StatementRow {
  /** 화면에서 행을 지목하는 임시 키(커밋 때 그대로 돌아온다). */
  key: string;
  kind: MatchKind;
  confidence: "certain" | "review";
  reason: string;
  contract_id: number | null;
  contract_ref: string | null;
  unit_name: string | null;
  tenant_name: string | null;
  invoice_id: number | null;
  invoice_ref: string | null;
  invoice_amount: number | null;
  /** 제안 계정과목 — 사람이 바꿀 수 있다. */
  gl_account_code: string | null;
  txn_type: "income" | "expense" | "transfer";
  /** 이미 올라온 거래로 보이는가. */
  duplicate_of: string | null;
}

const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFKC").replace(/[\s()（）]/g, "");

function unitOf(memo: string): string | null {
  const m = /(\d{3,4})\s*호/.exec(memo) ?? /(?<!\d)(\d{3,4})(?!\d)/.exec(memo);
  return m ? `${m[1]}호` : null;
}

/** 같은 호실에 계약이 여럿이면(과거·신규) 그 기간에 유효한 것을 고른다. */
function pickCurrent<T extends { status: string | null; start: string | null; end: string | null; id: number }>(
  list: T[], onDate: string,
): T | null {
  const live = list.filter((c) => (!c.start || c.start <= onDate) && (!c.end || c.end >= onDate));
  const pool = live.length ? live : list;
  const rank: Record<string, number> = { Active: 0, Signed: 1, Completed: 9 };
  return pool.sort((a, b) => (rank[a.status ?? ""] ?? 5) - (rank[b.status ?? ""] ?? 5) || b.id - a.id)[0] ?? null;
}

export interface MatchOptions {
  /** 우리 회사 자신을 가리키는 적요(자사 계좌 간 이체). 수입으로 잡으면 매출이 부푼다. */
  ownNames: string[];
  bankAccountId: number | null;
  /** 수입 기본 계정과목. 인스턴스 COA 에 맞춰 라우트가 넣어 준다. */
  defaultIncomeCode: string | null;
  depositCode: string | null;
}

export async function matchStatement(rows: StatementRow[], opts: MatchOptions): Promise<MatchedRow[]> {
  const dates = rows.map((r) => r.txn_date).sort();
  const from = dates[0]!, to = dates[dates.length - 1]!;

  const contracts = await db.select({
    id: contractsTable.id, ref: contractsTable.contract_ref,
    unit: spacesTable.name, tenant: accountsTable.name,
    rent: contractsTable.monthly_rent, bond: contractsTable.bond_amount,
    status: contractsTable.status, start: contractsTable.start_date, end: contractsTable.end_date,
  }).from(contractsTable)
    .leftJoin(spacesTable, eq(spacesTable.id, contractsTable.space_id))
    .leftJoin(accountsTable, eq(accountsTable.id, contractsTable.tenant_account_id))
    .where(isNull(contractsTable.deleted_at));

  // 명세서 기간과 겹치는 청구서. 범위를 좁혀야 엉뚱한 달에 붙지 않는다.
  const invoices = await db.select({
    id: invoicesTable.id, ref: invoicesTable.invoice_ref, contract_id: invoicesTable.contract_id,
    amount: invoicesTable.amount, status: invoicesTable.status, due: invoicesTable.due_date,
    unit: spacesTable.name, tenant: accountsTable.name,
  }).from(invoicesTable)
    .leftJoin(contractsTable, eq(contractsTable.id, invoicesTable.contract_id))
    .leftJoin(spacesTable, eq(spacesTable.id, contractsTable.space_id))
    .leftJoin(accountsTable, eq(accountsTable.id, invoicesTable.account_id))
    .where(and(
      isNull(invoicesTable.deleted_at),
      // 납기가 명세서 기간 ±40일 안. 선납·연체를 넉넉히 담되 무한정 넓히지 않는다.
      gte(invoicesTable.due_date, shift(from, -40)),
      lte(invoicesTable.due_date, shift(to, 40)),
    ));

  // 중복 감지 — 같은 통장·같은 날·같은 금액·같은 적요가 이미 있으면 재업로드다.
  const existing = await db.select({
    id: transactionsTable.id, ref: transactionsTable.txn_ref,
    date: transactionsTable.txn_date, amount: transactionsTable.amount,
    memo: transactionsTable.bank_reference,
  }).from(transactionsTable).where(and(
    isNull(transactionsTable.deleted_at),
    gte(transactionsTable.txn_date, from),
    lte(transactionsTable.txn_date, to),
  ));
  const dupKey = (d: string, a: number, m: string) => `${d}|${Math.round(a)}|${norm(m)}`;
  const dupMap = new Map(existing.map((e) => [dupKey(e.date, Number(e.amount), e.memo ?? ""), e.ref]));

  /**
   * 후보가 여럿이면 버리지 말고 **고른다.**
   *
   * 같은 호실·같은 금액의 월세 청구서는 달마다 나오므로, 조회 범위를 조금만 넓혀도
   * 후보가 3~4개가 된다. 예전 구현은 "정확히 하나일 때만" 매칭해서 그 경우를 전부
   * 버렸고, 결과적으로 청구서 연결이 0건이 됐다.
   *
   * 고르는 규칙은 실무를 따른다:
   *   1) 미납을 먼저 채운다(이미 낸 청구서에 또 붙이지 않는다)
   *   2) 그 중 납기가 가장 오래된 것부터 — 연체분을 먼저 메우는 것이 회계 관행이다
   *   3) 그래도 같으면 입금일에 가까운 것
   */
  const pickInvoice = <T extends { id: number; status: string | null; due?: string | null }>(
    cands: T[], onDate: string,
  ): T | null => {
    if (cands.length === 0) return null;
    if (cands.length === 1) return cands[0]!;
    const unpaid = cands.filter((c) => c.status !== "Paid");
    const pool = unpaid.length ? unpaid : cands;
    const dist = (d?: string | null) =>
      d ? Math.abs(new Date(`${d}T00:00:00Z`).getTime() - new Date(`${onDate}T00:00:00Z`).getTime()) : Number.MAX_SAFE_INTEGER;
    return pool.sort((a, b) => (a.due ?? "").localeCompare(b.due ?? "") || dist(a.due) - dist(b.due))[0]!;
  };

  const used = new Set<number>();
  const out: MatchedRow[] = [];

  rows.forEach((r, idx) => {
    const amt = r.deposit > 0 ? r.deposit : r.withdrawal;
    const isIn = r.deposit > 0;
    const nm = norm(r.memo);
    const unit = unitOf(r.memo);
    const byUnit = contracts.filter((c) => unit && c.unit === unit);
    const byName = contracts.filter((c) => c.tenant && norm(c.tenant) && (norm(c.tenant).includes(nm) || nm.includes(norm(c.tenant))));
    const cur = pickCurrent((byUnit.length ? byUnit : byName) as never[], r.txn_date) as unknown as typeof contracts[number] | null;

    const base: MatchedRow = {
      ...r, key: `r${idx}`, kind: "unmatched", confidence: "review", reason: "매칭 실패",
      contract_id: null, contract_ref: null, unit_name: unit, tenant_name: null,
      invoice_id: null, invoice_ref: null, invoice_amount: null,
      gl_account_code: isIn ? opts.defaultIncomeCode : null,
      txn_type: isIn ? "income" : "expense",
      duplicate_of: dupMap.get(dupKey(r.txn_date, amt, r.memo)) ?? null,
    };
    const withContract = (c: typeof contracts[number]) => ({
      contract_id: c.id, contract_ref: c.ref, unit_name: c.unit ?? unit, tenant_name: c.tenant ?? null,
    });

    // 자사 계좌 간 이체 — 임대 수입이 아니다.
    // 양방향으로 본다 — 적요가 잘려 회사명보다 짧은 경우가 흔하다.
    const isOwn = opts.ownNames.some((o) => {
      const on = norm(o);
      return on.length >= 3 && (nm.includes(on) || (nm.length >= 5 && on.includes(nm)));
    });
    if (isOwn) {
      out.push({ ...base, kind: "internal", confidence: "certain", txn_type: "transfer",
        gl_account_code: null, reason: "자사 계좌 간 이체 — 수입으로 잡지 않는다" });
      return;
    }
    if (!isIn) { out.push({ ...base, reason: "출금 — 계정과목을 지정하세요" }); return; }

    // 1) 보증금이 먼저다. 적요에 '보증금'이 있고 금액이 계약 보증금과 같으면 확정에 가깝다.
    if (/보증금/.test(r.memo)) {
      const exact = (byUnit.length ? byUnit : byName).filter((c) => Number(c.bond ?? 0) === amt);
      const t = exact.length ? (pickCurrent(exact as never[], r.txn_date) as typeof contracts[number] | null) : cur;
      if (t) {
        out.push({ ...base, ...withContract(t), kind: "deposit",
          confidence: Number(t.bond ?? 0) === amt ? "certain" : "review",
          gl_account_code: opts.depositCode,
          reason: Number(t.bond ?? 0) === amt
            ? `보증금 ${Number(t.bond).toLocaleString()} 일치`
            : `보증금으로 보이나 계약상 금액(${Number(t.bond ?? 0).toLocaleString()})과 다름` });
        return;
      }
    }
    // 2) 호실 + 금액이 정확히 맞는 청구서
    let cand = invoices.filter((i) => !used.has(i.id) && unit && i.unit === unit && Number(i.amount) === amt);
    let hit = pickInvoice(cand, r.txn_date);
    if (hit) {
      used.add(hit.id);
      const c = contracts.find((x) => x.id === hit!.contract_id);
      out.push({ ...base, ...(c ? withContract(c) : {}), kind: "invoice", confidence: "certain",
        invoice_id: hit.id, invoice_ref: hit.ref, invoice_amount: Number(hit.amount),
        reason: cand.length > 1
          ? `호실+금액 일치 (후보 ${cand.length}건 중 미납·최오래된 납기 ${hit.due ?? "-"})`
          : "호실+금액 일치" });
      return;
    }
    // 3) 임차인명 + 금액
    cand = invoices.filter((i) => !used.has(i.id) && i.tenant && nm.includes(norm(i.tenant)) && Number(i.amount) === amt);
    hit = pickInvoice(cand, r.txn_date);
    if (hit) {
      used.add(hit.id);
      const c = contracts.find((x) => x.id === hit!.contract_id);
      out.push({ ...base, ...(c ? withContract(c) : {}), kind: "invoice", confidence: "certain",
        invoice_id: hit.id, invoice_ref: hit.ref, invoice_amount: Number(hit.amount),
        reason: cand.length > 1
          ? `임차인명+금액 일치 (후보 ${cand.length}건 중 미납·최오래된 납기 ${hit.due ?? "-"})`
          : "임차인명+금액 일치" });
      return;
    }
    // 4) 월세의 정확한 배수 = 여러 달 선납
    const rent = Number(cur?.rent ?? 0);
    if (cur && rent > 0 && amt % rent === 0 && amt / rent > 1 && amt / rent <= 6) {
      out.push({ ...base, ...withContract(cur), kind: "multi_rent", confidence: "certain",
        reason: `월세 ${rent.toLocaleString()} × ${amt / rent}개월 선납` });
      return;
    }
    // 5) 적요에 '보증금'이 없어도 금액이 보증금과 같으면 의심한다
    if (cur && Number(cur.bond ?? 0) === amt && amt >= 1_000_000) {
      out.push({ ...base, ...withContract(cur), kind: "deposit", confidence: "review",
        gl_account_code: opts.depositCode,
        reason: `금액이 계약 보증금(${Number(cur.bond).toLocaleString()})과 일치 — 확인 필요` });
      return;
    }
    // 6) 월세와 일치하는데 청구서가 없다
    if (cur && rent === amt) {
      out.push({ ...base, ...withContract(cur), kind: "rent_no_invoice", confidence: "certain",
        reason: `월세 ${rent.toLocaleString()} 일치 — 해당 기간 청구서 없음` });
      return;
    }
    // 7) 계약만 특정
    if (cur) {
      out.push({ ...base, ...withContract(cur), kind: "contract_only", confidence: "review",
        reason: `계약은 확인(월세 ${rent.toLocaleString()} / 보증금 ${Number(cur.bond ?? 0).toLocaleString()}) — 항목 불명` });
      return;
    }
    out.push(base);
  });

  return out;
}

function shift(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
