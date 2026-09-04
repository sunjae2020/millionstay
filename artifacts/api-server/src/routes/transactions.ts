import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
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
} from "@workspace/db";
import { DEFAULT_CURRENCY } from "../lib/currency";
import { logAction } from "../utils/auditLog";
import { deletedFilter, makeBulkDelete, makeBulkRestore } from "../lib/softDelete";
import { postTransaction } from "../lib/billing/gl";
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
router.get("/v1/transactions", async (req, res): Promise<void> => {
  try {
    const q = String(req.query.q ?? "").trim();
    const conditions: SQL[] = [deletedFilter(transactionsTable.deleted_at, req)];

    const type = String(req.query.txn_type ?? "").trim();
    if (type) conditions.push(eq(transactionsTable.txn_type, type));

    const status = String(req.query.status ?? "").trim();
    // 취소(void)된 거래는 명시적으로 찾을 때만 보인다 — 기본 목록에 섞이면
    // 합계를 눈으로 검산할 수 없다.
    if (status) conditions.push(eq(transactionsTable.status, status));
    else conditions.push(sql`${transactionsTable.status} <> 'void'`);

    const contractId = Number(req.query.contract_id);
    if (Number.isFinite(contractId) && contractId > 0) conditions.push(eq(transactionsTable.contract_id, contractId));
    const invoiceId = Number(req.query.invoice_id);
    if (Number.isFinite(invoiceId) && invoiceId > 0) conditions.push(eq(transactionsTable.invoice_id, invoiceId));
    const scheduleId = Number(req.query.payment_schedule_id);
    if (Number.isFinite(scheduleId) && scheduleId > 0) conditions.push(eq(transactionsTable.payment_schedule_id, scheduleId));
    const bankAccountId = Number(req.query.bank_account_id);
    if (Number.isFinite(bankAccountId) && bankAccountId > 0) conditions.push(eq(transactionsTable.bank_account_id, bankAccountId));
    const accountId = Number(req.query.account_id);
    if (Number.isFinite(accountId) && accountId > 0) conditions.push(eq(transactionsTable.account_id, accountId));

    const from = String(req.query.from ?? "").trim();
    if (from) conditions.push(sql`${transactionsTable.txn_date} >= ${from}`);
    const to = String(req.query.to ?? "").trim();
    if (to) conditions.push(sql`${transactionsTable.txn_date} <= ${to}`);

    if (q) {
      const like = `%${q}%`;
      conditions.push(sql`(
        ${transactionsTable.txn_ref} ILIKE ${like}
        OR ${transactionsTable.description} ILIKE ${like}
        OR ${transactionsTable.counterparty_name} ILIKE ${like}
        OR ${transactionsTable.bank_reference} ILIKE ${like}
      )`);
    }

    const rows = await db
      .select()
      .from(transactionsTable)
      .where(and(...conditions))
      .orderBy(desc(transactionsTable.txn_date), desc(transactionsTable.id))
      .limit(500);

    const data = await enrichTransactions(rows);
    // 화면 상단 요약. 취소·초안을 뺀 확정 거래만 센다.
    const settled = data.filter((r) => r.status === "confirmed" || r.status === "posted");
    const sum = (t: string) => round2(settled.filter((r) => r.txn_type === t).reduce((s, r) => s + r.amount, 0));
    const income = sum("income");
    const expense = sum("expense");

    res.json({
      success: true,
      data,
      meta: { total: data.length, income, expense, net: round2(income - expense) },
    });
  } catch (err) {
    console.error("[GET /v1/transactions]", err);
    res.status(500).json({ error: "Failed to list transactions" });
  }
});

router.get("/v1/transactions/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [row] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).limit(1);
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
    const [row] = await db.insert(transactionsTable).values({
      ...txnValues(b),
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

  const [row] = await db.update(transactionsTable).set({
    ...txnValues(b),
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
    currency: row.currency,
    txnDate: row.txn_date,
    glAccountCode: row.gl_account_code,
    glAccountName: glName,
    description: row.description ?? `${row.txn_ref} ${row.txn_type}`,
  });
  if (!entry) { res.status(500).json({ error: "Failed to post journal entry" }); return; }

  const [updated] = await db.update(transactionsTable).set({
    status: "posted",
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
    voided_at: new Date(),
    void_reason: reason,
    updated_at: new Date(),
  }).where(eq(transactionsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  if (row.payment_schedule_id) await recalcSchedulePaid([row.payment_schedule_id]);
  void logAction({ entityType: ENTITY, entityId: id, action: "UPDATE", newValue: { status: "void", reason } });
  res.json({ success: true, data: row });
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
  kind: z.enum(["deposit", "down_payment", "interim_payment", "balance", "rent", "advance", "other"]).default("other"),
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
      total: round2(data.reduce((s, r) => s + r.amount, 0)),
      paid: round2(data.reduce((s, r) => s + r.paid_amount, 0)),
      outstanding: round2(data.reduce((s, r) => s + r.outstanding, 0)),
    },
  });
});

export default router;
