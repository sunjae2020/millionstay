import { Router, type IRouter } from "express";
import multer from "multer";
import { and, desc, eq, inArray, isNull, sql, type SQL, asc } from "drizzle-orm";
import { parseListPage, parseSortParams, buildOrderBy, type SortMap } from "../utils/pagination.js";
import { z } from "zod";
import {
  db,
  transactionsTable,
  paymentSchedulesTable,
  contractsTable,
  invoicesTable,
  accountsTable,
  contactsTable,
  bankAccountsTable,
  chartOfAccountsTable,
  spacesTable,
  journalLinesTable,
} from "@workspace/db";
import { DEFAULT_CURRENCY } from "../lib/currency";
import { logAction } from "../utils/auditLog";
import { deletedFilter, makeBulkDelete, makeBulkRestore } from "../lib/softDelete";
import { postTransaction } from "../lib/billing/gl";
import { resolveAccountingScope, accountingScopeSql } from "../lib/accounting/scope";
import { resolveClassFromOwner } from "../lib/accounting/classOf";
import { stampBaseAmount } from "../lib/billing/baseAmount";
import { getAiClient, isTaskConfigured } from "../lib/ai/client";
import { extractReceipt } from "../lib/billing/receiptOcr";
import { contractPayoutTermsTable } from "@workspace/db";
import { buildReceiptHtml } from "../lib/documents/receiptDocument";
import { type InvoiceDocInput } from "../lib/documents/invoiceDocument";
import { resolveCompanyInfo } from "../lib/documents/companyInfo";
import { resolveTemplateBody } from "../lib/documents/templateEngine";
import { normalizeLang } from "../lib/documents/i18n";
import { resolveDocFileName } from "../lib/documents/docFileName";
import { sendPdf } from "./invoices";
import {
  generateContractSchedule,
  recalcSchedulePaid,
} from "../lib/billing/paymentSchedule";

// 거래 원장(/finance/transactions) + 계약 결제 일정.
//
// 인보이스가 "받을 돈", journal_entries 가 "회계 기록"이라면 여기는 **실제로
// 움직인 돈**이다. 모든 거래는 계약 결제 일정의 한 회차를 가리킬 수 있고,
// 확정되는 순간 그 회차의 입금액·상태가 다시 계산된다.
const router: IRouter = Router();
const ENTITY = "transaction";

const round2 = (n: number): number => Math.round(n * 100) / 100;

async function nextTxnRef(): Promise<string> {
  const year = new Date().getFullYear();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(transactionsTable)
    .where(sql`${transactionsTable.txn_ref} LIKE ${`TXN-${year}-%`}`);
  return `TXN-${year}-${String((row?.n ?? 0) + 1).padStart(5, "0")}`;
}

// ── 조회 보강 ───────────────────────────────────────────────────────────────
// 리스트가 참조 이름을 보여주려면 계약·청구서·거래처·통장 이름이 필요하다.
// 행마다 조회하면 N+1 로 리스트가 멎으므로 반드시 inArray 로 한 번에 모은다.
type TxnRow = typeof transactionsTable.$inferSelect;

async function enrichTransactions(rows: TxnRow[]) {
  if (rows.length === 0) return [];
  const ids = <T>(vals: (T | null)[]) => [...new Set(vals.filter((v): v is T => v != null))];

  const parentIds = rows.map((r) => r.id);
  const legCounts = parentIds.length
    ? await db.select({
        parent: transactionsTable.parent_transaction_id,
        n: sql<number>`count(*)::int`,
      }).from(transactionsTable).where(and(
        inArray(transactionsTable.parent_transaction_id, parentIds),
        isNull(transactionsTable.deleted_at),
      )).groupBy(transactionsTable.parent_transaction_id)
    : [];
  const legCountMap = new Map(legCounts.map((r) => [r.parent, r.n]));

  const contractIds = ids(rows.map((r) => r.contract_id));
  const invoiceIds = ids(rows.map((r) => r.invoice_id));
  const accountIds = ids(rows.map((r) => r.account_id));
  const contactIds = ids(rows.map((r) => r.contact_id));
  const bankIds = ids([...rows.map((r) => r.bank_account_id), ...rows.map((r) => r.counter_bank_account_id)]);
  const scheduleIds = ids(rows.map((r) => r.payment_schedule_id));
  const spaceIds = ids(rows.map((r) => r.space_id));
  const glCodes = ids(rows.map((r) => r.gl_account_code));

  const [contracts, invoices, accounts, contacts, banks, schedules, spaces, glAccounts] = await Promise.all([
    contractIds.length
      ? db.select({ id: contractsTable.id, ref: contractsTable.contract_ref }).from(contractsTable).where(inArray(contractsTable.id, contractIds))
      : [],
    invoiceIds.length
      ? db.select({ id: invoicesTable.id, ref: invoicesTable.invoice_ref }).from(invoicesTable).where(inArray(invoicesTable.id, invoiceIds))
      : [],
    accountIds.length
      ? db.select({ id: accountsTable.id, name: accountsTable.name }).from(accountsTable).where(inArray(accountsTable.id, accountIds))
      : [],
    contactIds.length
      ? db.select({ id: contactsTable.id, first: contactsTable.first_name, last: contactsTable.last_name }).from(contactsTable).where(inArray(contactsTable.id, contactIds))
      : [],
    bankIds.length
      ? db.select({ id: bankAccountsTable.id, name: bankAccountsTable.name }).from(bankAccountsTable).where(inArray(bankAccountsTable.id, bankIds))
      : [],
    scheduleIds.length
      ? db.select({
          id: paymentSchedulesTable.id,
          kind: paymentSchedulesTable.kind,
          label: paymentSchedulesTable.label,
          period: paymentSchedulesTable.period,
          due_date: paymentSchedulesTable.due_date,
        }).from(paymentSchedulesTable).where(inArray(paymentSchedulesTable.id, scheduleIds))
      : [],
    spaceIds.length
      ? db.select({ id: spacesTable.id, name: spacesTable.name }).from(spacesTable).where(inArray(spacesTable.id, spaceIds))
      : [],
    glCodes.length
      ? db.select({ code: chartOfAccountsTable.code, name: chartOfAccountsTable.name }).from(chartOfAccountsTable).where(inArray(chartOfAccountsTable.code, glCodes))
      : [],
  ]);

  const contractMap = new Map(contracts.map((c) => [c.id, c.ref]));
  const invoiceMap = new Map(invoices.map((i) => [i.id, i.ref]));
  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));
  const contactMap = new Map(contacts.map((c) => [c.id, [c.last, c.first].filter(Boolean).join(" ").trim()]));
  const bankMap = new Map(banks.map((b) => [b.id, b.name]));
  const scheduleMap = new Map(schedules.map((s) => [s.id, s]));
  const spaceMap = new Map(spaces.map((s) => [s.id, s.name]));
  const glMap = new Map(glAccounts.map((g) => [g.code, g.name]));

  return rows.map((r) => {
    const sch = r.payment_schedule_id != null ? scheduleMap.get(r.payment_schedule_id) : undefined;
    return {
      ...r,
      amount: Number(r.amount ?? 0),
      tax_amount: Number(r.tax_amount ?? 0),
      contract_ref: r.contract_id != null ? contractMap.get(r.contract_id) ?? null : null,
      invoice_ref: r.invoice_id != null ? invoiceMap.get(r.invoice_id) ?? null : null,
      account_name: r.account_id != null ? accountMap.get(r.account_id) ?? null : null,
      contact_name: r.contact_id != null ? contactMap.get(r.contact_id) ?? null : null,
      bank_account_name: r.bank_account_id != null ? bankMap.get(r.bank_account_id) ?? null : null,
      counter_bank_account_name: r.counter_bank_account_id != null ? bankMap.get(r.counter_bank_account_id) ?? null : null,
      space_name: r.space_id != null ? spaceMap.get(r.space_id) ?? null : null,
      gl_account_name: r.gl_account_code ? glMap.get(r.gl_account_code) ?? null : null,
      // 어느 회차를 정산한 건인지 — 리스트에서 바로 읽히도록 풀어 준다.
      schedule_kind: sch?.kind ?? null,
      schedule_label: sch?.label ?? null,
      schedule_period: sch?.period ?? null,
      schedule_due_date: sch?.due_date ?? null,
      // 레거시 행(NULL)은 draft 로 읽는다 — 승인 도입 전에 만들어진 거래다.
      workflow_status: r.workflow_status ?? "draft",
      base_amount: r.base_amount != null ? Number(r.base_amount) : null,
      split_leg_count: legCountMap.get(r.id) ?? 0,
      // 거래처 표시용 단일 문자열: 계정 → 연락처 → 자유 입력 순.
      counterparty_display:
        (r.account_id != null ? accountMap.get(r.account_id) : null)
        ?? (r.contact_id != null ? contactMap.get(r.contact_id) : null)
        ?? r.counterparty_name
        ?? null,
    };
  });
}

// ── 목록 ────────────────────────────────────────────────────────────────────
/** 정렬 허용 컬럼 — TransactionList 의 SORTABLE_KEYS 와 1:1. */
const TRANSACTION_SORT: SortMap = {
  txn_ref: transactionsTable.txn_ref,
  txn_date: transactionsTable.txn_date,
  txn_type: transactionsTable.txn_type,
  counterparty_display: transactionsTable.counterparty_name,
  amount: sql`${transactionsTable.amount}::numeric`,
  status: transactionsTable.status,
  gl_account_code: transactionsTable.gl_account_code,
  created_at: transactionsTable.created_at,
  updated_at: transactionsTable.updated_at,
  contract_ref: sql`(select c.contract_ref from contracts c where c.id = ${transactionsTable.contract_id})`,
  invoice_ref: sql`(select i.invoice_ref from invoices i where i.id = ${transactionsTable.invoice_id})`,
  bank_account_name: sql`(select ba.name from bank_accounts ba where ba.id = ${transactionsTable.bank_account_id})`,
};

router.get("/v1/transactions", async (req, res): Promise<void> => {
  try {
    const q = String(req.query.q ?? "").trim();
    const conditions: SQL[] = [deletedFilter(transactionsTable.deleted_at, req)];

    const type = String(req.query.txn_type ?? "").trim();
    if (type) conditions.push(eq(transactionsTable.txn_type, type));

    const wf = String(req.query.workflow_status ?? "").trim();
    if (wf === "draft") {
      // 레거시 NULL 행도 draft 로 잡아준다.
      conditions.push(sql`(${transactionsTable.workflow_status} = 'draft' OR ${transactionsTable.workflow_status} IS NULL)`);
    } else if (wf === "not_paid") {
      conditions.push(sql`${transactionsTable.workflow_status} IS DISTINCT FROM 'paid'`);
    } else if (wf) {
      conditions.push(eq(transactionsTable.workflow_status, wf));
    }

    // ── 은행 원장 버킷 (QuickBooks 식) ────────────────────────────────────
    // 통장을 훑는 사람이 알고 싶은 것은 하나다: "아직 손 안 댄 게 뭐냐".
    //   review      분류 대기 — 원장에 아직 안 올라간 건
    //   categorised 분류 완료 — 분개가 붙은 건
    //   excluded    제외 — 취소된 건(통장엔 찍혔지만 장부에서 뺀 것)
    // bucket 은 status 필터를 이긴다 — excluded 탭은 기본 목록이 숨기는 void 를
    // 일부러 보여줘야 하기 때문이다.
    const bucket = String(req.query.bucket ?? "").trim();
    const status = String(req.query.status ?? "").trim();
    if (bucket === "excluded") {
      conditions.push(eq(transactionsTable.status, "void"));
    } else if (bucket === "categorised") {
      conditions.push(sql`${transactionsTable.status} <> 'void'`);
      conditions.push(sql`${transactionsTable.journal_entry_id} IS NOT NULL`);
    } else if (bucket === "review") {
      conditions.push(sql`${transactionsTable.status} <> 'void'`);
      conditions.push(sql`${transactionsTable.journal_entry_id} IS NULL`);
    } else if (status) {
      // 취소(void)된 거래는 명시적으로 찾을 때만 보인다 — 기본 목록에 섞이면
      // 합계를 눈으로 검산할 수 없다.
      conditions.push(eq(transactionsTable.status, status));
    } else {
      conditions.push(sql`${transactionsTable.status} <> 'void'`);
    }

    const contractId = Number(req.query.contract_id);
    if (Number.isFinite(contractId) && contractId > 0) conditions.push(eq(transactionsTable.contract_id, contractId));
    const invoiceId = Number(req.query.invoice_id);
    if (Number.isFinite(invoiceId) && invoiceId > 0) conditions.push(eq(transactionsTable.invoice_id, invoiceId));
    const scheduleId = Number(req.query.payment_schedule_id);
    if (Number.isFinite(scheduleId) && scheduleId > 0) conditions.push(eq(transactionsTable.payment_schedule_id, scheduleId));
    // 통장 스코프. "unassigned" 는 통장이 아직 지정되지 않은 건 — 대사에서 가장
    // 먼저 손봐야 하는 부류라 따로 고를 수 있어야 한다.
    const bankRaw = String(req.query.bank_account_id ?? "").trim();
    const bankAccountId = Number(bankRaw);
    if (bankRaw === "unassigned") conditions.push(sql`${transactionsTable.bank_account_id} IS NULL`);
    else if (Number.isFinite(bankAccountId) && bankAccountId > 0) conditions.push(eq(transactionsTable.bank_account_id, bankAccountId));
    const accountId = Number(req.query.account_id);
    if (Number.isFinite(accountId) && accountId > 0) conditions.push(eq(transactionsTable.account_id, accountId));

    const from = String(req.query.from ?? "").trim();
    if (from) conditions.push(sql`${transactionsTable.txn_date} >= ${from}`);
    const to = String(req.query.to ?? "").trim();
    if (to) conditions.push(sql`${transactionsTable.txn_date} <= ${to}`);

    // 분할 자식은 기본적으로 접는다 — 원본과 자식이 나란히 서면 같은 돈이 두 번
    // 있는 것처럼 보인다. 검색 중이거나 명시적으로 요청하면 펼친다(자식을 이름으로
    // 찾을 수 있어야 한다).
    if (!q && req.query.include_legs !== "1") {
      conditions.push(sql`${transactionsTable.parent_transaction_id} IS NULL`);
    }

    if (q) {
      const like = `%${q}%`;
      conditions.push(sql`(
        ${transactionsTable.txn_ref} ILIKE ${like}
        OR ${transactionsTable.description} ILIKE ${like}
        OR ${transactionsTable.counterparty_name} ILIKE ${like}
        OR ${transactionsTable.bank_reference} ILIKE ${like}
      )`);
    }

    // 서버 페이지네이션. 예전에는 `limit(500)` 하드 상한이었는데, 501번째 거래부터는
    // 화면에서 아예 사라진다 — 운영 몇 달이면 닿는 수치라 실질적인 데이터 유실이었다.
    // page/limit(기존) 과 limit/offset(useServerList) 을 모두 받는다. 페이징
    // 파라미터가 아예 없으면 종전대로 100건 — 전량 반환은 원장 규모상 위험하다.
    // HQ/지점/팀 접근 범위. 게이트가 꺼져 있으면 undefined 라 아무 영향이 없다.
    const scope = await resolveAccountingScope(req);
    const scopeSql = accountingScopeSql(
      scope,
      sql`${transactionsTable.branch_id}`,
      sql`${transactionsTable.team_id}`,
      sql`${transactionsTable.id}`,
      "transaction",
    );
    if (scopeSql) conditions.push(scopeSql);

    const { limit, offset, page } = parseListPage(req.query, {
      defaultLimit: 100, maxLimit: 500, unpagedLimit: 100,
    });
    const sort = parseSortParams(req.query, TRANSACTION_SORT);
    const where = and(...conditions);

    // 요약과 총건수는 **페이지가 아니라 필터 전체**를 대상으로 집계한다. 페이지 합계를
    // 총액처럼 보여주면 "이번 달 수입"을 잘못 읽게 된다. 확정·전기된 거래만 센다.
    const [rows, [agg]] = await Promise.all([
      db.select()
        .from(transactionsTable)
        .where(where)
        .orderBy(...buildOrderBy(TRANSACTION_SORT, sort, transactionsTable.id,
          [desc(transactionsTable.txn_date), desc(transactionsTable.id)]))
        .limit(limit)
        .offset(offset),
      db.select({
        total: sql<number>`count(*)::int`,
        // ⚠️ 유보(retained) leg 은 집계에서 뺀다. 원본 입금이 이미 그 돈을 세었고,
        // 유보는 "그 중 얼마가 우리 몫인가"를 설명하는 배분일 뿐 은행을 다시
        // 오간 돈이 아니다. 넣으면 100만 받고 120만 벌었다고 나온다.
        income: sql<string>`COALESCE(SUM(CASE WHEN ${transactionsTable.txn_type} = 'income' AND ${transactionsTable.status} IN ('confirmed','posted') AND ${transactionsTable.split_role} IS DISTINCT FROM 'retained' THEN ${transactionsTable.amount} ELSE 0 END), 0)`,
        expense: sql<string>`COALESCE(SUM(CASE WHEN ${transactionsTable.txn_type} = 'expense' AND ${transactionsTable.status} IN ('confirmed','posted') THEN ${transactionsTable.amount} ELSE 0 END), 0)`,
      }).from(transactionsTable).where(where),
    ]);

    const data = await enrichTransactions(rows);
    const income = round2(Number(agg?.income ?? 0));
    const expense = round2(Number(agg?.expense ?? 0));

    res.setHeader("X-Total-Count", String(agg?.total ?? 0));
    res.json({
      success: true,
      data,
      meta: {
        total: agg?.total ?? 0,
        page,
        limit,
        pages: Math.max(1, Math.ceil((agg?.total ?? 0) / limit)),
        income,
        expense,
        net: round2(income - expense),
      },
    });
  } catch (err) {
    console.error("[GET /v1/transactions]", err);
    res.status(500).json({ error: "Failed to list transactions" });
  }
});

/**
 * 은행 원장 요약 — 통장별 버킷 건수와 잔액 대사.
 *
 * 통장을 훑는 사람의 질문은 둘이다. "아직 분류 안 한 게 몇 건이냐"와 "장부가
 * 통장이랑 맞냐". 전자는 버킷 배지로, 후자는 원장 현금잔액 대 명세서 잔액의
 * 차이로 답한다.
 *
 * ⚠️ `/:id` 보다 먼저 등록해야 한다 — 뒤에 두면 "bank-summary" 가 id 로 잡힌다.
 */
router.get("/v1/transactions/bank-summary", async (req, res): Promise<void> => {
  try {
    const accounts = await db.select().from(bankAccountsTable)
      .where(isNull(bankAccountsTable.deleted_at))
      .orderBy(bankAccountsTable.id);

    // 통장별 버킷 건수 + 순증감. 계좌 수만큼 쿼리를 돌리면 N+1 이므로 한 번에 모은다.
    const perAccount = await db.select({
      bank_account_id: transactionsTable.bank_account_id,
      review: sql<number>`COUNT(*) FILTER (WHERE ${transactionsTable.journal_entry_id} IS NULL AND ${transactionsTable.status} <> 'void')::int`,
      categorised: sql<number>`COUNT(*) FILTER (WHERE ${transactionsTable.journal_entry_id} IS NOT NULL AND ${transactionsTable.status} <> 'void')::int`,
      excluded: sql<number>`COUNT(*) FILTER (WHERE ${transactionsTable.status} = 'void')::int`,
      // 확정된 돈만 센다. 유보 leg 은 원본이 이미 센 돈의 배분이라 뺀다.
      net: sql<string>`COALESCE(SUM(CASE
        WHEN ${transactionsTable.status} NOT IN ('confirmed','posted') THEN 0
        WHEN ${transactionsTable.split_role} = 'retained' THEN 0
        WHEN ${transactionsTable.txn_type} = 'income' THEN ${transactionsTable.amount}
        WHEN ${transactionsTable.txn_type} = 'expense' THEN -${transactionsTable.amount}
        ELSE 0 END), 0)`,
    }).from(transactionsTable)
      .where(isNull(transactionsTable.deleted_at))
      .groupBy(transactionsTable.bank_account_id);

    const byAccount = new Map(perAccount.map((r) => [r.bank_account_id, r]));

    // 원장 현금잔액은 계정과목 코드별로 한 번에 계산한다.
    const glByCode = await db.select({
      code: journalLinesTable.account_code,
      balance: sql<string>`COALESCE(SUM(${journalLinesTable.debit} - ${journalLinesTable.credit}), 0)`,
    }).from(journalLinesTable).groupBy(journalLinesTable.account_code);
    const glMap = new Map(glByCode.map((r) => [r.code, round2(Number(r.balance ?? 0))]));

    // ⚠️ 원장 잔액은 **계정과목(1000 현금) 단위**이지 통장 단위가 아니다. 두 통장이
    // 같은 코드를 쓰면 둘 다 같은 잔액을 보여주고, 그 차이는 아무 뜻이 없다. 그럴
    // 때는 차이를 계산하지 않고 공유 사실을 알린다 — "일치/불일치"를 잘못 말하는
    // 것이 침묵보다 나쁘다. (계정과목을 통장마다 따로 두면 대사가 살아난다.)
    const codeUsage = new Map<string, number>();
    for (const a of accounts) codeUsage.set(a.gl_account_code, (codeUsage.get(a.gl_account_code) ?? 0) + 1);

    const data = accounts.map((a) => {
      const b = byAccount.get(a.id);
      const glBalance = glMap.get(a.gl_account_code) ?? 0;
      const glShared = (codeUsage.get(a.gl_account_code) ?? 0) > 1;
      const statement = a.statement_balance != null ? round2(Number(a.statement_balance)) : null;
      return {
        gl_shared: glShared,
        id: a.id,
        name: a.name,
        bank_name: a.bank_name,
        currency: a.currency,
        gl_account_code: a.gl_account_code,
        review_count: b?.review ?? 0,
        categorised_count: b?.categorised ?? 0,
        excluded_count: b?.excluded ?? 0,
        net_movement: round2(Number(b?.net ?? 0)),
        gl_balance: glBalance,
        statement_balance: statement,
        // 명세서 잔액이 없거나 계정과목을 공유하면 "맞다/틀리다"를 말할 수 없다.
        // 0 으로 두면 맞는 것처럼 보이므로 null 을 그대로 흘린다.
        difference: statement != null && !glShared ? round2(statement - glBalance) : null,
      };
    });

    // 통장이 지정되지 않은 건 — 대사에서 가장 먼저 손봐야 하는 부류다.
    const un = byAccount.get(null);
    res.json({
      success: true,
      data,
      unassigned: {
        review_count: un?.review ?? 0,
        categorised_count: un?.categorised ?? 0,
        excluded_count: un?.excluded ?? 0,
      },
    });
  } catch (err) {
    console.error("[GET /v1/transactions/bank-summary]", err);
    res.status(500).json({ error: "Failed to build bank summary" });
  }
});

router.get("/v1/transactions/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const scope = await resolveAccountingScope(req);
  const scopeSql = accountingScopeSql(
    scope,
    sql`${transactionsTable.branch_id}`,
    sql`${transactionsTable.team_id}`,
    sql`${transactionsTable.id}`,
    "transaction",
  );
  // 목록에서 숨기고 상세는 열어 두면 접근 통제가 아니다 — id 만 바꾸면 다 보인다.
  const [row] = await db.select().from(transactionsTable)
    .where(scopeSql ? and(eq(transactionsTable.id, id), scopeSql) : eq(transactionsTable.id, id))
    .limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const [data] = await enrichTransactions([row]);
  res.json({ success: true, data });
});

// ── 생성 / 수정 ─────────────────────────────────────────────────────────────
const TxnBody = z.object({
  txn_type: z.enum(["income", "expense", "transfer"]).default("income"),
  txn_date: z.string().min(8),
  amount: z.number(),
  currency: z.string().default(DEFAULT_CURRENCY),
  tax_amount: z.number().optional(),
  contract_id: z.number().int().positive().nullish(),
  invoice_id: z.number().int().positive().nullish(),
  payment_schedule_id: z.number().int().positive().nullish(),
  work_order_id: z.number().int().positive().nullish(),
  space_id: z.number().int().positive().nullish(),
  account_id: z.number().int().positive().nullish(),
  contact_id: z.number().int().positive().nullish(),
  counterparty_name: z.string().nullish(),
  bank_account_id: z.number().int().positive().nullish(),
  counter_bank_account_id: z.number().int().positive().nullish(),
  payment_info_id: z.number().int().positive().nullish(),
  payment_method: z.string().nullish(),
  gl_account_code: z.string().nullish(),
  description: z.string().nullish(),
  bank_reference: z.string().nullish(),
  notes: z.string().nullish(),
  status: z.enum(["draft", "confirmed", "posted", "void"]).optional(),
});

/**
 * 결제 일정을 지정했으면 계약·청구서를 그 회차에서 물려받는다. 사람이 세 칸을
 * 따로 고르다 어긋나면 "3월 월세로 받았는데 계약은 다른 것"이 되어버린다.
 */
async function inheritFromSchedule(body: z.infer<typeof TxnBody>) {
  if (!body.payment_schedule_id) return body;
  const [sch] = await db.select().from(paymentSchedulesTable)
    .where(eq(paymentSchedulesTable.id, body.payment_schedule_id)).limit(1);
  if (!sch) return body;
  // 방향이 어긋난 연결은 조용히 끊는다. 지출을 "받을 돈" 회차에 붙이면 미납이
  // 줄어든 것처럼 보이고, 그 오류는 정산 단계까지 아무도 눈치채지 못한다.
  const wants = body.txn_type === "expense" ? "ap" : body.txn_type === "income" ? "ar" : null;
  if (wants && sch.direction !== wants) {
    return { ...body, payment_schedule_id: null };
  }
  return {
    ...body,
    contract_id: sch.contract_id,
    invoice_id: body.invoice_id ?? sch.invoice_id ?? null,
    currency: body.currency || sch.currency,
  };
}

function txnValues(b: z.infer<typeof TxnBody>) {
  return {
    txn_type: b.txn_type,
    txn_date: b.txn_date.slice(0, 10),
    amount: String(round2(Math.abs(b.amount))),
    currency: (b.currency || DEFAULT_CURRENCY).toUpperCase(),
    tax_amount: String(round2(b.tax_amount ?? 0)),
    contract_id: b.contract_id ?? null,
    invoice_id: b.invoice_id ?? null,
    payment_schedule_id: b.payment_schedule_id ?? null,
    work_order_id: b.work_order_id ?? null,
    space_id: b.space_id ?? null,
    account_id: b.account_id ?? null,
    contact_id: b.contact_id ?? null,
    counterparty_name: b.counterparty_name ?? null,
    bank_account_id: b.bank_account_id ?? null,
    counter_bank_account_id: b.counter_bank_account_id ?? null,
    payment_info_id: b.payment_info_id ?? null,
    payment_method: b.payment_method ?? null,
    gl_account_code: b.gl_account_code ?? null,
    description: b.description ?? null,
    bank_reference: b.bank_reference ?? null,
    notes: b.notes ?? null,
  };
}

router.post("/v1/transactions", async (req, res): Promise<void> => {
  const parsed = TxnBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  try {
    const b = await inheritFromSchedule(parsed.data);
    const userId = (req as any).user?.id ?? null;
    const fx = await stampBaseAmount(round2(Math.abs(b.amount)), b.currency || DEFAULT_CURRENCY, b.txn_date);
    // 귀속을 만들 때 한 번 박는다 — 담당자가 부서를 옮겨도 과거 장부는 그대로다.
    const cls = await resolveClassFromOwner(userId);
    const [row] = await db.insert(transactionsTable).values({
      ...txnValues(b),
      ...fx,
      ...cls,
      owner_user_id: userId,
      txn_ref: await nextTxnRef(),
      status: b.status ?? "draft",
      confirmed_at: b.status === "confirmed" || b.status === "posted" ? new Date() : null,
      confirmed_by: b.status === "confirmed" || b.status === "posted" ? userId : null,
      created_by: userId,
    }).returning();

    if (row?.payment_schedule_id) await recalcSchedulePaid([row.payment_schedule_id]);
    void logAction({ entityType: ENTITY, entityId: row!.id, action: "CREATE", newValue: { txn_ref: row!.txn_ref, amount: row!.amount } });
    const [data] = await enrichTransactions([row!]);
    res.status(201).json({ success: true, data });
  } catch (err) {
    console.error("[POST /v1/transactions]", err);
    res.status(500).json({ error: "Failed to create transaction" });
  }
});

router.put("/v1/transactions/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = TxnBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [before] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).limit(1);
  if (!before) { res.status(404).json({ error: "Not found" }); return; }
  // 전기가 끝난 거래는 금액·날짜를 바꿀 수 없다. 원장과 어긋나기 때문에 취소
  // (void) 후 다시 입력하는 것이 유일한 정정 경로다.
  if (before.status === "posted" && (parsed.data.amount != null || parsed.data.txn_date != null)) {
    res.status(409).json({ error: "Posted transactions cannot change amount or date — void and re-enter" });
    return;
  }

  const merged = { ...before, ...parsed.data, amount: parsed.data.amount ?? Number(before.amount) } as z.infer<typeof TxnBody>;
  const b = await inheritFromSchedule(merged);
  const userId = (req as any).user?.id ?? null;
  const nextStatus = parsed.data.status ?? before.status;
  const becameSettled = (nextStatus === "confirmed" || nextStatus === "posted")
    && before.status !== "confirmed" && before.status !== "posted";

  // 금액·통화·날짜가 바뀌면 환산액도 다시 박는다(전기 후에는 금액 변경 자체가 막혀 있다).
  const fx = await stampBaseAmount(round2(Math.abs(Number(b.amount))), b.currency || DEFAULT_CURRENCY, b.txn_date);
  const [row] = await db.update(transactionsTable).set({
    ...txnValues(b),
    ...fx,
    status: nextStatus,
    ...(becameSettled ? { confirmed_at: new Date(), confirmed_by: userId } : {}),
    updated_at: new Date(),
  }).where(eq(transactionsTable.id, id)).returning();

  // 회차를 옮겼으면 옛 회차와 새 회차를 모두 다시 계산한다.
  await recalcSchedulePaid([before.payment_schedule_id, row?.payment_schedule_id].filter((n): n is number => n != null));
  void logAction({ entityType: ENTITY, entityId: id, action: "UPDATE", newValue: parsed.data });
  const [data] = await enrichTransactions([row!]);
  res.json({ success: true, data });
});

// ── 상태 전이 ───────────────────────────────────────────────────────────────

/** 실제 입출금 확인. 이 순간부터 결제 일정과 집계에 반영된다. */
router.post("/v1/transactions/:id/confirm", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  if (row.status === "void") { res.status(409).json({ error: "Voided transaction cannot be confirmed" }); return; }
  const [updated] = await db.update(transactionsTable).set({
    status: row.status === "posted" ? "posted" : "confirmed",
    // 결재 단계도 함께 민다. 두 축을 따로 관리하게 두면 반드시 어긋난다.
    workflow_status: row.workflow_status === "paid" ? "paid" : "confirmed",
    confirmed_at: row.confirmed_at ?? new Date(),
    confirmed_by: row.confirmed_by ?? ((req as any).user?.id ?? null),
    updated_at: new Date(),
  }).where(eq(transactionsTable.id, id)).returning();
  if (updated?.payment_schedule_id) await recalcSchedulePaid([updated.payment_schedule_id]);
  void logAction({ entityType: ENTITY, entityId: id, action: "UPDATE", newValue: { status: "confirmed" } });
  const [data] = await enrichTransactions([updated!]);
  res.json({ success: true, data });
});

/** GL 전기. 멱등이므로 두 번 눌러도 분개는 하나다. */
router.post("/v1/transactions/:id/post", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  if (row.status === "void") { res.status(409).json({ error: "Voided transaction cannot be posted" }); return; }
  // 이미 분개를 들고 있으면 다시 전기하지 않는다. 인보이스 수납이 만든 거래는
  // `invoice_paid:<id>` 분개를 물려받는데, 여기서 또 전기하면 posting_key 가
  // 달라(`transaction:<id>`) 멱등 가드를 빠져나가고 같은 돈이 두 번 기록된다.
  if (row.journal_entry_id) {
    const [data] = await enrichTransactions([row]);
    res.json({ success: true, data, already_posted: true });
    return;
  }
  // 유보 leg 은 은행을 오간 돈이 아니라 배분 설명이다. 전기하면 Dr 현금 이 또
  // 찍혀 현금이 실제보다 많아진다 — 원본 입금이 이미 그 현금을 잡았다.
  if (row.split_role === "retained") {
    res.status(409).json({
      error: "A retained leg is an allocation, not a cash movement — the source transaction already posts the cash",
    });
    return;
  }
  // 거래처가 없으면 원장에서 "누구와의 거래인지" 영원히 알 수 없다.
  if (!row.account_id && !row.contact_id && !row.counterparty_name?.trim()) {
    res.status(400).json({ error: "A counterparty (account, contact or name) is required before posting" });
    return;
  }

  let glName: string | null = null;
  if (row.gl_account_code) {
    const [acct] = await db.select({ name: chartOfAccountsTable.name })
      .from(chartOfAccountsTable).where(eq(chartOfAccountsTable.code, row.gl_account_code)).limit(1);
    glName = acct?.name ?? null;
  }

  const entry = await postTransaction({
    id: row.id,
    txnType: row.txn_type,
    amount: Number(row.amount ?? 0),
    taxAmount: Number(row.tax_amount ?? 0),
    // 청구서에 붙은 입금이면 매출이 아니라 미수금을 상계한다(이중 계상 방지).
    invoiceId: row.invoice_id,
    currency: row.currency,
    txnDate: row.txn_date,
    glAccountCode: row.gl_account_code,
    glAccountName: glName,
    description: row.description ?? `${row.txn_ref} ${row.txn_type}`,
  });
  if (!entry) { res.status(500).json({ error: "Failed to post journal entry" }); return; }

  const [updated] = await db.update(transactionsTable).set({
    status: "posted",
    workflow_status: row.workflow_status === "paid" ? "paid" : "posted",
    journal_entry_id: entry.id,
    posted_at: new Date(),
    posted_by: (req as any).user?.id ?? null,
    confirmed_at: row.confirmed_at ?? new Date(),
    updated_at: new Date(),
  }).where(eq(transactionsTable.id, id)).returning();

  if (updated?.payment_schedule_id) await recalcSchedulePaid([updated.payment_schedule_id]);
  void logAction({ entityType: ENTITY, entityId: id, action: "UPDATE", newValue: { status: "posted", journal_entry_id: entry.id } });
  const [data] = await enrichTransactions([updated!]);
  res.json({ success: true, data });
});

/**
 * 취소. 분개는 지우지 않는다 — 이미 전기된 원장을 되돌리는 것은 역분개의 일이고,
 * 여기서는 거래를 집계에서 빼고 결제 일정을 다시 계산하는 데까지만 한다.
 */
router.post("/v1/transactions/:id/void", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const reason = typeof req.body?.reason === "string" ? req.body.reason : null;
  const [row] = await db.update(transactionsTable).set({
    status: "void",
    workflow_status: "void",
    voided_at: new Date(),
    void_reason: reason,
    updated_at: new Date(),
  }).where(eq(transactionsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  if (row.payment_schedule_id) await recalcSchedulePaid([row.payment_schedule_id]);
  void logAction({ entityType: ENTITY, entityId: id, action: "UPDATE", newValue: { status: "void", reason } });
  res.json({ success: true, data: row });
});

// ── 승인 워크플로 ───────────────────────────────────────────────────────────
// draft → submitted → posted → confirmed → paid (+ rejected).
// `status`(회계적 사실)와는 별도 축이다 — 결제 일정 집계는 계속 status 만 읽는다.
//
// 만든 사람과 승인하는 사람을 가르는 것이 목적이므로, 제출은 누구나 하되
// 반려·지급은 관리자만 한다. 읽기 전용 Viewer 는 requireAuth 가 이미 막는다.

function isAdmin(req: import("express").Request): boolean {
  const role = (req as unknown as { user?: { role?: string } })?.user?.role;
  return role === "SuperAdmin" || role === "Admin";
}

/** 결재 올림. 초안·반려 상태에서만 올릴 수 있다. */
router.post("/v1/transactions/:id/submit", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  const wf = row.workflow_status ?? "draft";
  if (wf !== "draft" && wf !== "rejected") {
    res.status(409).json({ error: `Cannot submit from "${wf}"` }); return;
  }
  const [updated] = await db.update(transactionsTable).set({
    workflow_status: "submitted",
    submitted_by: (req as any).user?.id ?? null,
    submitted_at: new Date(),
    // 다시 올리는 것이므로 이전 반려 사유는 지운다 — 남겨두면 승인 화면에서
    // 방금 고친 건이 여전히 반려된 것처럼 읽힌다.
    rejected_by: null, rejected_at: null, rejection_reason: null,
    updated_at: new Date(),
  }).where(eq(transactionsTable.id, id)).returning();
  void logAction({ entityType: ENTITY, entityId: id, action: "UPDATE", newValue: { workflow_status: "submitted" } });
  const [data] = await enrichTransactions([updated!]);
  res.json({ success: true, data });
});

/** 반려. 사유는 필수다 — 사유 없는 반려는 다시 올릴 때 무엇을 고쳐야 할지 알 수 없다. */
router.post("/v1/transactions/:id/reject", async (req, res): Promise<void> => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Only an admin can reject" }); return; }
  const id = Number(req.params.id);
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (!reason) { res.status(400).json({ error: "A rejection reason is required" }); return; }
  const [updated] = await db.update(transactionsTable).set({
    workflow_status: "rejected",
    rejected_by: (req as any).user?.id ?? null,
    rejected_at: new Date(),
    rejection_reason: reason,
    updated_at: new Date(),
  }).where(eq(transactionsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  void logAction({ entityType: ENTITY, entityId: id, action: "UPDATE", newValue: { workflow_status: "rejected", reason } });
  const [data] = await enrichTransactions([updated!]);
  res.json({ success: true, data });
});

/**
 * 지급 완료(송금함). 지출의 마지막 단계이고 관리자만 누른다.
 * 전기까지 끝난 건에만 허용한다 — 원장에 없는 돈을 "보냈다"고 표시할 수는 없다.
 */
router.post("/v1/transactions/:id/mark-paid", async (req, res): Promise<void> => {
  if (!isAdmin(req)) { res.status(403).json({ error: "Only an admin can mark a transaction paid" }); return; }
  const id = Number(req.params.id);
  const [row] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  if (row.status !== "posted") {
    res.status(409).json({ error: "Post the transaction to the ledger before marking it paid" }); return;
  }
  const [updated] = await db.update(transactionsTable).set({
    workflow_status: "paid",
    paid_by: (req as any).user?.id ?? null,
    paid_at: new Date(),
    updated_at: new Date(),
  }).where(eq(transactionsTable.id, id)).returning();
  void logAction({ entityType: ENTITY, entityId: id, action: "UPDATE", newValue: { workflow_status: "paid" } });
  const [data] = await enrichTransactions([updated!]);
  res.json({ success: true, data });
});

// ── AI 보조 ─────────────────────────────────────────────────────────────────
// 계정과목 제안과 중복 감지. 둘 다 **사람이 확정하기 전 단계의 힌트**다 —
// 제안이 틀려도 전기 전에 사람이 고치고, 원장은 불균형 분개를 어차피 거부한다.
// AI 호출은 반드시 작업 레지스트리 경유(lib/ai/tasks.ts 의 transaction_categorise).

/**
 * 적요·거래처로 계정과목을 제안한다. 계정과목 표를 그대로 보여주고 그 중에서
 * 고르게 하므로, 표에 없는 코드를 지어내면 버리고 null 을 준다.
 */
router.post("/v1/transactions/:id/suggest", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!isTaskConfigured("transaction_categorise")) {
    res.status(503).json({ error: "AI is not configured for this instance" });
    return;
  }
  const [row] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }

  const accounts = await db.select({
    code: chartOfAccountsTable.code,
    name: chartOfAccountsTable.name,
    type: chartOfAccountsTable.account_type,
  }).from(chartOfAccountsTable).where(and(
    eq(chartOfAccountsTable.is_active, true),
    isNull(chartOfAccountsTable.deleted_at),
    // 수입이면 수익 계정, 지출이면 비용 계정만 후보로 준다 — 방향이 뻔한데
    // 전체를 보여주면 엉뚱한 쪽을 고를 여지만 넓어진다.
    row.txn_type === "income"
      ? sql`${chartOfAccountsTable.account_type} IN ('revenue','liability')`
      : sql`${chartOfAccountsTable.account_type} IN ('expense','asset')`,
  )).orderBy(chartOfAccountsTable.code);
  if (accounts.length === 0) { res.json({ success: true, suggestion: null }); return; }

  const [enriched] = await enrichTransactions([row]);
  const catalogue = accounts.map((a) => `${a.code} ${a.name} (${a.type})`).join("\n");
  const prompt = [
    "You are helping a Korean property-management back office categorise one bank transaction.",
    "Pick the SINGLE best account code from the catalogue. If nothing fits well, return null.",
    "",
    "Catalogue:",
    catalogue,
    "",
    "Transaction:",
    `  direction: ${row.txn_type}`,
    `  amount: ${row.amount} ${row.currency}`,
    `  counterparty: ${enriched?.counterparty_display ?? "(unknown)"}`,
    `  memo: ${row.description ?? "(none)"}`,
    `  bank reference: ${row.bank_reference ?? "(none)"}`,
    `  contract: ${enriched?.contract_ref ?? "(none)"}`,
    "",
    'Reply with JSON only: {"code": "<code or null>", "confidence": 0.0-1.0, "reason": "<one short sentence>"}',
  ].join("\n");

  try {
    const ai = getAiClient("transaction_categorise");
    const msg = await ai.messages.create({
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });
    const text = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("").trim();
    const json = /\{[\s\S]*\}/.exec(text)?.[0];
    const parsed = json ? JSON.parse(json) as { code?: string | null; confidence?: number; reason?: string } : null;
    // 표에 없는 코드는 버린다 — 모델이 그럴듯한 코드를 지어내는 것이 가장 흔한 실패다.
    const valid = parsed?.code && accounts.some((a) => a.code === parsed.code) ? parsed.code : null;
    res.json({
      success: true,
      suggestion: valid
        ? { code: valid, name: accounts.find((a) => a.code === valid)?.name ?? null, confidence: parsed?.confidence ?? null, reason: parsed?.reason ?? null }
        : null,
    });
  } catch (err) {
    console.error("[POST /v1/transactions/:id/suggest]", err);
    res.status(502).json({ error: "Suggestion failed" });
  }
});

/**
 * 중복 입력 감지. AI 없이 결정적으로 판단한다 — 같은 날·같은 금액·같은 거래처면
 * 중복이고, 그건 규칙으로 충분하다. 모델을 부르면 비용만 들고 답이 흔들린다.
 */
router.get("/v1/transactions/:id/duplicates", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }

  const rows = await db.select().from(transactionsTable).where(and(
    sql`${transactionsTable.id} <> ${id}`,
    isNull(transactionsTable.deleted_at),
    sql`${transactionsTable.status} <> 'void'`,
    eq(transactionsTable.txn_date, row.txn_date),
    eq(transactionsTable.txn_type, row.txn_type),
    sql`${transactionsTable.amount} = ${row.amount}`,
    row.account_id != null
      ? eq(transactionsTable.account_id, row.account_id)
      : row.counterparty_name
        ? eq(transactionsTable.counterparty_name, row.counterparty_name)
        : sql`true`,
  )).limit(10);

  res.json({ success: true, data: await enrichTransactions(rows) });
});

// ── 영수증 판독 ─────────────────────────────────────────────────────────────
// 종이 영수증을 손으로 옮겨 적는 일이 거래 입력의 대부분이고, 그 과정에서 날짜와
// 금액이 가장 자주 틀린다. 읽어서 **폼을 채워 주기만** 한다 — 저장은 사람이 한다.
// 파일은 메모리에서만 다루고 저장하지 않는다: 영수증에는 카드번호 일부·사업자
// 정보가 찍혀 있어, 보관할 이유가 없는 이미지를 남기지 않는 것이 안전하다.

const receiptUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
});

router.post("/v1/transactions/extract-receipt", receiptUpload.single("file"), async (req, res): Promise<void> => {
  if (!isTaskConfigured("transaction_receipt_ocr")) {
    res.status(503).json({ error: "AI is not configured for this instance" });
    return;
  }
  const file = (req as unknown as { file?: Express.Multer.File }).file;
  if (!file) { res.status(400).json({ error: "A receipt file is required" }); return; }

  const mime = file.mimetype.toLowerCase();
  if (!mime.startsWith("image/") && mime !== "application/pdf") {
    res.status(400).json({ error: "Upload an image or a PDF" });
    return;
  }

  try {
    const draft = await extractReceipt({ buffer: file.buffer, mimetype: mime });
    res.json({ success: true, data: draft });
  } catch (err) {
    console.error("[POST /v1/transactions/extract-receipt]", err);
    res.status(502).json({ error: "Could not read the receipt" });
  }
});

// ── 분할 제안 ───────────────────────────────────────────────────────────────
/**
 * 이 입금을 어떻게 나눌지 제안한다.
 *
 * 계약의 정산 조건(`contract_payout_terms`)이 이미 산수를 갖고 있으므로 **계산은
 * 서버가 한다** — 모델에 금액을 맡기면 반올림이 흔들리고 합계가 원본을 넘긴다.
 * 조건이 없을 때만 모델에게 상대방·비율을 물어보고, 그 결과도 서버가 다시 잘라낸다.
 */
router.post("/v1/transactions/:id/split-suggest", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  if (row.txn_type !== "income") { res.status(400).json({ error: "Only an incoming transaction is split" }); return; }

  const total = round2(Number(row.amount ?? 0));
  const legs: Array<{ amount: number; role: "disbursement" | "retained"; counterparty_name: string | null; description: string | null; basis: string }> = [];

  // 1순위: 계약 정산 조건. 있으면 이것이 정답이고 모델을 부를 이유가 없다.
  if (row.contract_id) {
    const terms = await db.select().from(contractPayoutTermsTable).where(and(
      eq(contractPayoutTermsTable.contract_id, row.contract_id),
      eq(contractPayoutTermsTable.status, "Active"),
      isNull(contractPayoutTermsTable.deleted_at),
    ));
    for (const t of terms) {
      const amount = t.basis === "percent_of_rent" && t.rate != null
        ? round2(total * (Number(t.rate) / 100))
        : round2(Number(t.amount ?? 0));
      if (amount > 0) {
        legs.push({
          amount,
          role: "disbursement",
          counterparty_name: t.payee_name || null,
          description: t.party_type === "landlord" ? "집주인 정산" : "파트너 정산",
          basis: t.basis === "percent_of_rent" ? `${Number(t.rate)}%` : "fixed",
        });
      }
    }
  }

  // 2순위: 조건이 없으면 모델에게 물어본다. 금액은 여전히 서버가 다듬는다.
  if (legs.length === 0 && isTaskConfigured("transaction_split_suggest")) {
    try {
      const [enriched] = await enrichTransactions([row]);
      const ai = getAiClient("transaction_split_suggest");
      const msg = await ai.messages.create({
        max_tokens: 500,
        messages: [{
          role: "user",
          content: [
            "A Korean property manager received one payment and must fan it out to the parties it belongs to.",
            "Typically most of a rent receipt goes to the property owner and a management fee is retained.",
            "",
            `amount: ${total} ${row.currency}`,
            `memo: ${row.description ?? "(none)"}`,
            `payer: ${enriched?.counterparty_display ?? "(unknown)"}`,
            `contract: ${enriched?.contract_ref ?? "(none)"}`,
            "",
            'Reply with JSON only: {"legs":[{"percent":<0-100>,"role":"disbursement"|"retained","counterparty_name":"...","description":"..."}]}',
            "Percentages must not exceed 100 in total.",
          ].join("\n"),
        }],
      });
      const text = msg.content.map((c) => (c.type === "text" ? c.text : "")).join("");
      const json = /\{[\s\S]*\}/.exec(text)?.[0];
      const parsed = json ? JSON.parse(json) as { legs?: Array<Record<string, unknown>> } : null;
      for (const l of parsed?.legs ?? []) {
        const pct = Number(l.percent);
        if (!Number.isFinite(pct) || pct <= 0) continue;
        legs.push({
          amount: round2(total * (pct / 100)),
          role: l.role === "retained" ? "retained" : "disbursement",
          counterparty_name: typeof l.counterparty_name === "string" ? l.counterparty_name : null,
          description: typeof l.description === "string" ? l.description : null,
          basis: `${pct}% (AI)`,
        });
      }
    } catch (err) {
      console.error("[split-suggest ai]", err);
    }
  }

  // 서버가 마지막으로 잘라낸다. 합계가 원본을 넘으면 제안 자체가 무의미하고,
  // 사람이 그대로 저장하면 /split 이 어차피 거부한다 — 그 전에 맞춰 준다.
  let used = round2(legs.reduce((s, l) => s + l.amount, 0));
  if (used > total) {
    const scale = total / used;
    for (const l of legs) l.amount = round2(l.amount * scale);
    used = round2(legs.reduce((s, l) => s + l.amount, 0));
  }
  // 남는 금액은 우리 몫(유보)이다. 남겨두면 사람이 매번 같은 계산을 반복한다.
  const remainder = round2(total - used);
  if (remainder > 0) {
    legs.push({
      amount: remainder,
      role: "retained",
      counterparty_name: null,
      description: "관리 수수료(잔여)",
      basis: "remainder",
    });
  }

  res.json({ success: true, data: { total, currency: row.currency, legs } });
});

// ── 분할 배분 ───────────────────────────────────────────────────────────────
// 입금 한 건이 여러 지출로 갈라지는 흐름 — 월세를 받아 집주인에게 넘기고 수수료를
// 뗀다. 지금까지는 세 건의 무관한 거래로 남아 "이 송금이 어느 입금에서 나왔나"에
// 답이 없었다.
//
// 원본(source)은 **금액을 바꾸지 않는다.** 받은 돈은 받은 돈이다. 자식들이 그 돈이
// 어디로 갔는지 설명할 뿐이고, 합계가 원본을 넘지 못하게 막는다.

const SplitBody = z.object({
  legs: z.array(z.object({
    amount: z.number().positive(),
    /** 'disbursement' 밖으로 나간 돈 | 'retained' 우리가 가진 몫 */
    role: z.enum(["disbursement", "retained"]).default("disbursement"),
    account_id: z.number().int().positive().nullish(),
    counterparty_name: z.string().nullish(),
    payment_schedule_id: z.number().int().positive().nullish(),
    gl_account_code: z.string().nullish(),
    description: z.string().nullish(),
  })).min(1),
});

router.post("/v1/transactions/:id/split", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const parsed = SplitBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [parent] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).limit(1);
  if (!parent) { res.status(404).json({ error: "Not found" }); return; }
  if (parent.parent_transaction_id) { res.status(409).json({ error: "A split leg cannot itself be split" }); return; }
  if (parent.status === "void") { res.status(409).json({ error: "Voided transaction cannot be split" }); return; }

  const legs = parsed.data.legs;
  const total = round2(legs.reduce((s, l) => s + l.amount, 0));
  const parentAmount = round2(Number(parent.amount ?? 0));
  // 받은 것보다 많이 나눌 수는 없다. 남는 금액은 유보로 두면 되므로 부족은 허용한다.
  if (total > parentAmount + 0.001) {
    res.status(400).json({ error: `Legs total ${total} exceeds the source amount ${parentAmount}` });
    return;
  }

  const existing = await db.select({ id: transactionsTable.id })
    .from(transactionsTable)
    .where(and(eq(transactionsTable.parent_transaction_id, id), isNull(transactionsTable.deleted_at)))
    .limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Already split — unsplit first" });
    return;
  }

  const userId = (req as any).user?.id ?? null;
  const created: number[] = [];
  for (const leg of legs) {
    const fx = await stampBaseAmount(round2(leg.amount), parent.currency, parent.txn_date);
    const [child] = await db.insert(transactionsTable).values({
      txn_ref: await nextTxnRef(),
      // 유보는 회사 안에 남는 돈이라 지출이 아니다 — 지출로 잡으면 비용이 부풀고
      // 순액이 실제보다 작아 보인다.
      txn_type: leg.role === "retained" ? "income" : "expense",
      txn_date: parent.txn_date,
      amount: String(round2(leg.amount)),
      currency: parent.currency,
      ...fx,
      contract_id: parent.contract_id,
      space_id: parent.space_id,
      parent_transaction_id: id,
      split_role: leg.role,
      payment_schedule_id: leg.payment_schedule_id ?? null,
      account_id: leg.account_id ?? null,
      counterparty_name: leg.counterparty_name ?? null,
      gl_account_code: leg.gl_account_code ?? null,
      bank_account_id: parent.bank_account_id,
      description: leg.description ?? parent.description,
      status: "draft",
      created_by: userId,
    }).returning();
    if (child) created.push(child.id);
  }

  await db.update(transactionsTable).set({ split_role: "source", updated_at: new Date() })
    .where(eq(transactionsTable.id, id));

  const scheduleIds = legs.map((l) => l.payment_schedule_id).filter((n): n is number => n != null);
  if (scheduleIds.length) await recalcSchedulePaid(scheduleIds);
  void logAction({ entityType: ENTITY, entityId: id, action: "UPDATE", newValue: { split: created.length } });
  res.status(201).json({ success: true, created: created.length, ids: created });
});

/** 원본의 자식 legs. 목록이 접힌 그룹을 펼칠 때 쓴다. */
router.get("/v1/transactions/:id/split-children", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const rows = await db.select().from(transactionsTable).where(and(
    eq(transactionsTable.parent_transaction_id, id),
    isNull(transactionsTable.deleted_at),
  )).orderBy(transactionsTable.id);
  res.json({ success: true, data: await enrichTransactions(rows) });
});

/** 분할 되돌리기. 이미 전기된 자식이 있으면 막는다 — 원장에 남은 것을 지울 수는 없다. */
router.post("/v1/transactions/:id/unsplit", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const children = await db.select().from(transactionsTable).where(and(
    eq(transactionsTable.parent_transaction_id, id),
    isNull(transactionsTable.deleted_at),
  ));
  const posted = children.filter((c) => c.journal_entry_id != null);
  if (posted.length > 0) {
    res.status(409).json({ error: `${posted.length} leg(s) already posted to the ledger — void them instead` });
    return;
  }
  const scheduleIds = children.map((c) => c.payment_schedule_id).filter((n): n is number => n != null);
  await db.delete(transactionsTable).where(eq(transactionsTable.parent_transaction_id, id));
  await db.update(transactionsTable).set({ split_role: null, updated_at: new Date() })
    .where(eq(transactionsTable.id, id));
  if (scheduleIds.length) await recalcSchedulePaid(scheduleIds);
  void logAction({ entityType: ENTITY, entityId: id, action: "UPDATE", newValue: { unsplit: children.length } });
  res.json({ success: true, removed: children.length });
});

// ── 삭제 ────────────────────────────────────────────────────────────────────
const txnSoftDelete = { table: transactionsTable, idColumn: transactionsTable.id };
router.post("/v1/transactions/bulk-delete", makeBulkDelete(txnSoftDelete));
router.post("/v1/transactions/bulk-restore", makeBulkRestore(txnSoftDelete));

router.delete("/v1/transactions/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.update(transactionsTable)
    .set({ deleted_at: new Date(), updated_at: new Date() })
    .where(and(eq(transactionsTable.id, id), isNull(transactionsTable.deleted_at)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  if (row.payment_schedule_id) await recalcSchedulePaid([row.payment_schedule_id]);
  void logAction({ entityType: ENTITY, entityId: id, action: "DELETE" });
  res.status(204).send();
});

// ── 영수증 ──────────────────────────────────────────────────────────────────
// 영수증은 인보이스가 이미 쓰는 `buildReceiptHtml` 을 그대로 태운다. 거래 전용
// 렌더러를 새로 만들면 회사 정보·도장·다국어·테마가 두 벌이 되고, 한쪽만 고쳐지는
// 날이 반드시 온다. 문서 규약대로 **미리보기 모달**로 열리며 별도 저장소 없이
// 요청 시점에 렌더한다(MillionStay 에는 receipts 테이블이 없다 — 영수증은 파생물이다).

/** 거래 한 건을 영수증 렌더러가 아는 모양으로 옮긴다. */
async function buildTransactionDocInput(id: number, lang: string): Promise<InvoiceDocInput | null> {
  const [row] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).limit(1);
  if (!row) return null;
  const [enriched] = await enrichTransactions([row]);
  if (!enriched) return null;

  // 청구서에 붙은 거래면 그 청구서 번호를 쓴다 — 세입자가 받은 청구서와 영수증의
  // 번호가 달라지면 대조할 수 없다. 청구서 없는 수납이면 거래번호가 곧 문서번호다.
  const ref = enriched.invoice_ref ?? enriched.txn_ref;
  const amount = Number(row.amount ?? 0);
  const tax = Number(row.tax_amount ?? 0);

  return {
    invoice_ref: ref,
    status: "Paid",
    amount: String(amount),
    currency: row.currency,
    due_date: null,
    paid_at: row.txn_date,
    payment_method: row.payment_method,
    description: row.description,
    notes: row.notes,
    created_at: row.created_at,
    tax_amount: String(tax),
    total_amount: String(round2(amount + tax)),
    account_id: row.account_id,
    account_name: enriched.counterparty_display,
    contract_ref: enriched.contract_ref,
  } as InvoiceDocInput;
}

/**
 * GET /v1/transactions/:id/receipt/pdf [?format=html]
 *
 * 확정되지 않은 거래에는 발행하지 않는다 — 초안이나 취소된 건으로 영수증이
 * 나가면 "냈다"는 증거가 잘못 만들어진다.
 */
router.get("/v1/transactions/:id/receipt/pdf", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [row] = await db.select({ status: transactionsTable.status, type: transactionsTable.txn_type })
    .from(transactionsTable).where(eq(transactionsTable.id, id)).limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  if (row.status !== "confirmed" && row.status !== "posted") {
    res.status(409).json({ error: "Receipt is only issued for a confirmed transaction" });
    return;
  }

  const asHtml = req.query.format === "html";
  const lang = normalizeLang(req.query.lang as string);
  const docInput = await buildTransactionDocInput(id, lang);
  if (!docInput) { res.status(404).json({ error: "Not found" }); return; }

  const terms = await resolveTemplateBody("pdf", "pdf.receipt", lang, { ref: docInput.invoice_ref });
  const html = buildReceiptHtml(docInput, await resolveCompanyInfo(lang), !asHtml, lang, terms);
  if (asHtml) { res.type("html").send(html); return; }

  const filename = await resolveDocFileName({
    kind: "receipt",
    entityType: "transaction",
    entityId: id,
    variant: "receipt",
    accountId: docInput.account_id ?? null,
    party: [docInput.account_name],
    org: [docInput.account_name],
    issueDate: docInput.paid_at ?? docInput.created_at,
  });
  await sendPdf(res, html, filename);
});

// ═══ 계약 결제 일정 ═════════════════════════════════════════════════════════

type ScheduleRow = typeof paymentSchedulesTable.$inferSelect;

async function enrichSchedules(rows: ScheduleRow[]) {
  if (rows.length === 0) return [];
  const invoiceIds = [...new Set(rows.map((r) => r.invoice_id).filter((n): n is number => n != null))];
  const scheduleIds = rows.map((r) => r.id);
  const [invoices, txns] = await Promise.all([
    invoiceIds.length
      ? db.select({ id: invoicesTable.id, ref: invoicesTable.invoice_ref, status: invoicesTable.status })
          .from(invoicesTable).where(inArray(invoicesTable.id, invoiceIds))
      : [],
    db.select({
      schedule_id: transactionsTable.payment_schedule_id,
      n: sql<number>`count(*)::int`,
    }).from(transactionsTable).where(and(
      inArray(transactionsTable.payment_schedule_id, scheduleIds),
      isNull(transactionsTable.deleted_at),
      inArray(transactionsTable.status, ["confirmed", "posted"]),
    )).groupBy(transactionsTable.payment_schedule_id),
  ]);
  const invoiceMap = new Map(invoices.map((i) => [i.id, i]));
  const txnCount = new Map(txns.map((t) => [t.schedule_id, t.n]));

  return rows.map((r) => {
    const amount = Number(r.amount ?? 0);
    const paid = Number(r.paid_amount ?? 0);
    const inv = r.invoice_id != null ? invoiceMap.get(r.invoice_id) : undefined;
    return {
      ...r,
      amount,
      paid_amount: paid,
      // 면제 회차는 미수로 잡지 않는다.
      outstanding: r.status === "waived" ? 0 : round2(Math.max(amount - paid, 0)),
      invoice_ref: inv?.ref ?? null,
      invoice_status: inv?.status ?? null,
      transaction_count: txnCount.get(r.id) ?? 0,
    };
  });
}

/**
 * 계약 컬럼에서 회차를 생성한다. 이미 있는 회차는 건드리지 않으므로 몇 번을
 * 눌러도 안전하다. `replace: true` 는 청구·입금이 붙지 않은 자동 생성 회차만
 * 갈아끼운다(계약 조건을 고친 뒤 다시 뽑을 때).
 *
 * ⚠️ 경로가 `/v1/contracts/:id/payment-schedule` 이 **아닌** 이유: 그 경로는
 * 이미 정기 청구 스케줄(recurring_schedules)이 쓰고 있다. 이름이 같다고 붙였다가는
 * 먼저 등록된 쪽이 가로채 엉뚱한 표를 돌려준다.
 */
router.post("/v1/payment-schedules/generate", async (req, res): Promise<void> => {
  const contractId = Number(req.body?.contract_id);
  if (!Number.isFinite(contractId) || contractId <= 0) {
    res.status(400).json({ error: "contract_id is required" });
    return;
  }
  const replace = req.body?.replace === true || req.query.replace === "1";
  try {
    const result = await generateContractSchedule(contractId, { replace });
    void logAction({ entityType: "payment_schedule", entityId: contractId, action: "CREATE", newValue: result });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error("[POST /v1/payment-schedules/generate]", err);
    res.status(500).json({ error: "Failed to generate payment schedule" });
  }
});

const ScheduleBody = z.object({
  contract_id: z.number().int().positive(),
  direction: z.enum(["ar", "ap"]).default("ar"),
  counterparty_account_id: z.number().int().positive().nullish(),
  kind: z.enum(["deposit", "down_payment", "interim_payment", "balance", "rent", "advance", "owner_rent", "payout", "other"]).default("other"),
  seq: z.number().int().optional(),
  label: z.string().nullish(),
  period: z.string().nullish(),
  period_start: z.string().nullish(),
  period_end: z.string().nullish(),
  due_date: z.string().nullish(),
  amount: z.number(),
  currency: z.string().default(DEFAULT_CURRENCY),
  invoice_id: z.number().int().positive().nullish(),
  status: z.enum(["pending", "invoiced", "partial", "paid", "waived"]).optional(),
  notes: z.string().nullish(),
});

router.post("/v1/payment-schedules", async (req, res): Promise<void> => {
  const parsed = ScheduleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const b = parsed.data;
  try {
    const [row] = await db.insert(paymentSchedulesTable).values({
      contract_id: b.contract_id,
      direction: b.direction,
      counterparty_account_id: b.counterparty_account_id ?? null,
      kind: b.kind,
      seq: b.seq ?? 100,
      label: b.label ?? null,
      period: b.period ?? null,
      period_start: b.period_start ?? null,
      period_end: b.period_end ?? null,
      due_date: b.due_date ?? null,
      amount: String(round2(b.amount)),
      currency: (b.currency || DEFAULT_CURRENCY).toUpperCase(),
      invoice_id: b.invoice_id ?? null,
      status: b.status ?? (b.invoice_id ? "invoiced" : "pending"),
      source: "manual",
      notes: b.notes ?? null,
    }).returning();
    const [data] = await enrichSchedules([row!]);
    res.status(201).json({ success: true, data });
  } catch (err) {
    console.error("[POST /v1/payment-schedules]", err);
    res.status(500).json({ error: "Failed to create payment schedule row" });
  }
});

router.put("/v1/payment-schedules/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = ScheduleBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const b = parsed.data;
  const set: Record<string, unknown> = { updated_at: new Date() };
  if (b.kind != null) set.kind = b.kind;
  if (b.direction != null) set.direction = b.direction;
  if (b.counterparty_account_id !== undefined) set.counterparty_account_id = b.counterparty_account_id ?? null;
  if (b.seq != null) set.seq = b.seq;
  if (b.label !== undefined) set.label = b.label ?? null;
  if (b.period !== undefined) set.period = b.period ?? null;
  if (b.period_start !== undefined) set.period_start = b.period_start ?? null;
  if (b.period_end !== undefined) set.period_end = b.period_end ?? null;
  if (b.due_date !== undefined) set.due_date = b.due_date ?? null;
  if (b.amount != null) set.amount = String(round2(b.amount));
  if (b.currency != null) set.currency = b.currency.toUpperCase();
  if (b.invoice_id !== undefined) set.invoice_id = b.invoice_id ?? null;
  if (b.status != null) set.status = b.status;
  if (b.notes !== undefined) set.notes = b.notes ?? null;

  const [row] = await db.update(paymentSchedulesTable).set(set)
    .where(and(eq(paymentSchedulesTable.id, id), isNull(paymentSchedulesTable.deleted_at))).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  // 금액·청구서가 바뀌면 상태(부분납/완납)가 달라진다. 단, 방금 사람이 지정한
  // 상태는 존중한다.
  if (b.status == null) await recalcSchedulePaid([id]);
  const [fresh] = await db.select().from(paymentSchedulesTable).where(eq(paymentSchedulesTable.id, id)).limit(1);
  const [data] = await enrichSchedules([fresh!]);
  res.json({ success: true, data });
});

router.delete("/v1/payment-schedules/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  // 입금이 잡힌 회차는 지울 수 없다 — 거래가 가리키는 대상이 사라지면 그 돈이
  // 어느 회차 것이었는지 복구할 방법이 없다.
  const [row] = await db.select().from(paymentSchedulesTable).where(eq(paymentSchedulesTable.id, id)).limit(1);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  if (Number(row.paid_amount ?? 0) > 0) {
    res.status(409).json({ error: "Cannot delete a schedule row that has settled payments" });
    return;
  }
  await db.update(paymentSchedulesTable).set({ deleted_at: new Date(), updated_at: new Date() })
    .where(eq(paymentSchedulesTable.id, id));
  res.status(204).send();
});

/**
 * 이 계약에서 아직 정산되지 않은 회차를 방향별로 내려준다.
 *
 * 거래 입력 화면이 "이 입금(지출)이 어느 회차인가"를 고를 때 쓴다. 완납·면제된
 * 회차는 빼고, 납기 순으로 준다 — 대개 가장 오래된 미납부터 채우기 때문이다.
 */
router.get("/v1/contracts/:id/settle-lines", async (req, res): Promise<void> => {
  const contractId = Number(req.params.id);
  if (!Number.isFinite(contractId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const rows = await db.select().from(paymentSchedulesTable).where(and(
    eq(paymentSchedulesTable.contract_id, contractId),
    isNull(paymentSchedulesTable.deleted_at),
    sql`${paymentSchedulesTable.status} NOT IN ('paid', 'waived')`,
  )).orderBy(paymentSchedulesTable.due_date, paymentSchedulesTable.seq);

  const data = await enrichSchedules(rows);
  res.json({
    success: true,
    ar: data.filter((r) => r.direction === "ar"),
    ap: data.filter((r) => r.direction === "ap"),
    meta: {
      ar_outstanding: round2(data.filter((r) => r.direction === "ar").reduce((s, r) => s + r.outstanding, 0)),
      ap_outstanding: round2(data.filter((r) => r.direction === "ap").reduce((s, r) => s + r.outstanding, 0)),
    },
  });
});

/** 한 청구서가 정산하는 회차들. 청구서 상세가 결제 일정을 보여줄 때 쓴다. */
router.get("/v1/invoices/:id/payment-schedule", async (req, res): Promise<void> => {
  const invoiceId = Number(req.params.id);
  if (!Number.isFinite(invoiceId)) { res.status(400).json({ error: "Invalid id" }); return; }
  const rows = await db.select().from(paymentSchedulesTable).where(and(
    eq(paymentSchedulesTable.invoice_id, invoiceId),
    isNull(paymentSchedulesTable.deleted_at),
  )).orderBy(paymentSchedulesTable.seq, paymentSchedulesTable.id);
  res.json({ success: true, data: await enrichSchedules(rows) });
});

/**
 * 회차 목록 + 합계. `contract_id` 로 한 계약의 결제 일정 전체를(계약 상세 카드와
 * 거래 입력 팝업), `outstanding=1` 로 미납 회차만(미납 관리) 가져간다.
 */
router.get("/v1/payment-schedules", async (req, res): Promise<void> => {
  const conditions: SQL[] = [isNull(paymentSchedulesTable.deleted_at)];
  const contractId = Number(req.query.contract_id);
  const byContract = Number.isFinite(contractId) && contractId > 0;
  if (byContract) conditions.push(eq(paymentSchedulesTable.contract_id, contractId));
  const status = String(req.query.status ?? "").trim();
  if (status) conditions.push(eq(paymentSchedulesTable.status, status));
  const direction = String(req.query.direction ?? "").trim();
  if (direction === "ar" || direction === "ap") conditions.push(eq(paymentSchedulesTable.direction, direction));
  if (req.query.outstanding === "1") {
    conditions.push(sql`${paymentSchedulesTable.status} NOT IN ('paid', 'waived')`);
  }
  const from = String(req.query.from ?? "").trim();
  if (from) conditions.push(sql`${paymentSchedulesTable.due_date} >= ${from}`);
  const to = String(req.query.to ?? "").trim();
  if (to) conditions.push(sql`${paymentSchedulesTable.due_date} <= ${to}`);

  // 한 계약을 볼 때는 회차 순서(보증금 → 계약금 → … → 월세)가, 여러 계약을
  // 훑을 때는 납기일 순서가 읽기 좋다.
  const rows = await db.select().from(paymentSchedulesTable).where(and(...conditions))
    .orderBy(
      ...(byContract
        ? [paymentSchedulesTable.seq, paymentSchedulesTable.due_date, paymentSchedulesTable.id]
        : [paymentSchedulesTable.due_date, paymentSchedulesTable.seq]),
    )
    .limit(500);

  const data = await enrichSchedules(rows);
  res.json({
    success: true,
    data,
    meta: {
      count: data.length,
      total: round2(data.filter((r) => r.direction === "ar").reduce((s, r) => s + r.amount, 0)),
      paid: round2(data.filter((r) => r.direction === "ar").reduce((s, r) => s + r.paid_amount, 0)),
      outstanding: round2(data.filter((r) => r.direction === "ar").reduce((s, r) => s + r.outstanding, 0)),
      // 줄 돈은 받을 돈과 섞으면 안 된다 — 합치면 순액이 되어 어느 쪽도 못 읽는다.
      ap_total: round2(data.filter((r) => r.direction === "ap").reduce((s, r) => s + r.amount, 0)),
      ap_paid: round2(data.filter((r) => r.direction === "ap").reduce((s, r) => s + r.paid_amount, 0)),
      ap_outstanding: round2(data.filter((r) => r.direction === "ap").reduce((s, r) => s + r.outstanding, 0)),
    },
  });
});

export default router;
