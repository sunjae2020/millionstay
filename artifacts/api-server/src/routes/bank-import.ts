import { Router, type IRouter } from "express";
import multer from "multer";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db, bankAccountsTable, chartOfAccountsTable, transactionsTable, paymentSchedulesTable,
} from "@workspace/db";
import { BANK_PROFILES } from "../lib/banking/profiles";
import { parseStatement } from "../lib/banking/parse";
import { matchStatement, type MatchedRow } from "../lib/banking/match";
import { resolveCompanyInfo } from "../lib/documents/companyInfo";
import { generateContractSchedule, recalcSchedulePaid } from "../lib/billing/paymentSchedule";
import { postInvoicePaid } from "../lib/billing/gl";
import { generateSettlementsForInvoice } from "../lib/billing/payout";
import { linkInvoiceToSchedule } from "../lib/billing/scheduleLink";
import { invoicesTable } from "@workspace/db";
import { stampBaseAmount } from "../lib/billing/baseAmount";
import { resolveClassFromOwner } from "../lib/accounting/classOf";
import { logAction } from "../utils/auditLog";
import { DEFAULT_CURRENCY } from "../lib/currency";

// 은행 명세서 가져오기 — 붙여넣기 / 파일 / Google 링크.
//
// 흐름은 반드시 두 단계다: **미리보기(preview) → 확인 → 확정(commit)**.
// 회계 데이터를 한 번에 수십 건 밀어 넣는 일이라, 사람이 중복과 애매한 매칭을 보고
// 내린 판단이 그대로 반영되어야 한다.

/**
 * 통장 적요에 우리 회사가 어떤 모습으로 찍히는지의 변형들.
 *
 * 실제 사례: 회사명은 "(주)HK건설자산관리" 인데 적요에는 "주식회사에이치케이" 로
 * 찍힌다. 은행 적요는 길이 제한 때문에 잘리고, **로마자를 한글로 음역**하며,
 * 법인격 표기도 제각각이다. 그래서 이름 하나만 비교하면 자사 이체를 놓치고,
 * 놓치면 그 돈이 임대 수입으로 잡혀 매출이 부푼다.
 */
const ROMAN_TO_HANGUL: Record<string, string> = {
  A: "에이", B: "비", C: "씨", D: "디", E: "이", F: "에프", G: "지", H: "에이치",
  I: "아이", J: "제이", K: "케이", L: "엘", M: "엠", N: "엔", O: "오", P: "피",
  Q: "큐", R: "알", S: "에스", T: "티", U: "유", V: "브이", W: "더블유", X: "엑스",
  Y: "와이", Z: "지",
};

export function ownNameVariants(names: Array<string | null | undefined>): string[] {
  const out = new Set<string>();
  for (const raw of names) {
    if (!raw) continue;
    const base = raw.trim();
    const noEntity = base.replace(/\(주\)|㈜|주식회사|유한회사/g, "").trim();
    for (const v of [base, noEntity, base.replace(/\(주\)|㈜/g, "주식회사")]) {
      if (v) out.add(v);
    }
    // 로마자 구간을 한글로 읽어 준다: "HK건설자산관리" → "에이치케이건설자산관리"
    const say = (run: string) =>
      run.toUpperCase().split("").map((ch) => ROMAN_TO_HANGUL[ch] ?? ch).join("");
    const romanised = noEntity.replace(/[A-Za-z]+/g, say);
    if (romanised !== noEntity) {
      out.add(romanised);
      out.add(`주식회사${romanised}`);
    }
    // ⚠️ 적요는 길이 제한으로 **잘린다** — 실제로 "(주)HK건설자산관리" 가
    // "주식회사에이치케이" 로 찍힌다. 그래서 로마자 약칭만 읽은 형태도 넣는다.
    for (const run of noEntity.match(/[A-Za-z]{2,}/g) ?? []) {
      const spoken = say(run);
      if (spoken.length >= 3) { out.add(spoken); out.add(`주식회사${spoken}`); }
    }
  }
  return [...out].filter((s) => s.length >= 3);
}

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

router.get("/v1/bank-import/banks", async (_req, res): Promise<void> => {
  const accounts = await db.select({
    id: bankAccountsTable.id, name: bankAccountsTable.name,
    bank_name: bankAccountsTable.bank_name, currency: bankAccountsTable.currency,
  }).from(bankAccountsTable).where(isNull(bankAccountsTable.deleted_at)).orderBy(asc(bankAccountsTable.id));

  const coa = await db.select({
    code: chartOfAccountsTable.code, name: chartOfAccountsTable.name, type: chartOfAccountsTable.account_type,
  }).from(chartOfAccountsTable).where(and(
    eq(chartOfAccountsTable.is_active, true), isNull(chartOfAccountsTable.deleted_at),
  )).orderBy(asc(chartOfAccountsTable.code));

  res.json({
    success: true,
    data: {
      banks: BANK_PROFILES.map((p) => ({ id: p.id, label: p.label, notes: p.notes ?? null })),
      bank_accounts: accounts,
      chart_of_accounts: coa,
    },
  });
});

/**
 * Google Drive/Sheets 링크에서 CSV 를 받아온다.
 *
 * ⚠️ 서버는 **사용자의 비공개 Drive 를 읽을 수 없다.** 서버에 Google 자격증명이
 * 없기 때문이다. 비공개 파일이면 Google 이 CSV 대신 로그인 HTML 을 돌려주는데,
 * 그걸 그대로 파싱하면 "헤더를 못 찾았다"는 엉뚱한 오류가 난다. 그래서 HTML 이
 * 오면 **무엇을 해야 하는지** 알려주는 메시지로 바꿔 준다.
 */
async function fetchFromGoogle(url: string): Promise<string> {
  const idMatch =
    /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/.exec(url) ??
    /\/file\/d\/([a-zA-Z0-9_-]+)/.exec(url) ??
    /[?&]id=([a-zA-Z0-9_-]+)/.exec(url);
  if (!idMatch) throw new Error("Google 문서 링크가 아닙니다. 스프레드시트 또는 파일 링크를 붙여넣어 주세요.");
  const id = idMatch[1]!;
  const gid = /[#&?]gid=(\d+)/.exec(url)?.[1];

  // 스프레드시트는 CSV 내보내기, 업로드된 파일은 직접 다운로드.
  const candidates = url.includes("/spreadsheets/")
    ? [`https://docs.google.com/spreadsheets/d/${id}/export?format=csv${gid ? `&gid=${gid}` : ""}`]
    : [
        `https://drive.google.com/uc?export=download&id=${id}`,
        `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`,
      ];

  let lastStatus = 0;
  for (const c of candidates) {
    const r = await fetch(c, { redirect: "follow", signal: AbortSignal.timeout(20_000) });
    lastStatus = r.status;
    const ct = (r.headers.get("content-type") ?? "").toLowerCase();
    const body = await r.text();
    // 로그인·권한 화면이 오면 HTML 이다.
    if (r.ok && !ct.includes("text/html") && body.trim()) return body;
    if (r.ok && ct.includes("text/html")) {
      throw new Error(
        "이 링크는 비공개 파일입니다. 서버에는 Google 계정이 연결돼 있지 않아 비공개 문서를 열 수 없습니다.\n\n" +
          "해결 방법 두 가지 중 하나를 택하세요.\n" +
          "① Google에서 파일 → 공유 → '링크가 있는 모든 사용자'로 바꾼 뒤 다시 시도\n" +
          "② 파일을 CSV/XLSX로 내려받아 아래 '파일 올리기'로 첨부 (권장 — 공개 전환이 필요 없습니다)",
      );
    }
  }
  throw new Error(`Google에서 파일을 받지 못했습니다 (HTTP ${lastStatus}). 파일을 직접 올려 주세요.`);
}

const PreviewBody = z.object({
  bank: z.string().default("auto"),
  bank_account_id: z.number().int().positive().nullish(),
  csv_text: z.string().optional(),
  source_url: z.string().url().optional(),
});

router.post("/v1/bank-import/preview", upload.single("file"), async (req, res): Promise<void> => {
  // multipart 로 오면 필드가 문자열이라 숫자·불리언을 되돌려 놓는다.
  const raw = { ...req.body } as Record<string, unknown>;
  if (typeof raw.bank_account_id === "string") raw.bank_account_id = raw.bank_account_id ? Number(raw.bank_account_id) : null;
  const parsed = PreviewBody.safeParse(raw);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const b = parsed.data;
  const file = (req as unknown as { file?: Express.Multer.File }).file;

  let text = "";
  try {
    if (file) text = file.buffer.toString("utf8");
    else if (b.csv_text?.trim()) text = b.csv_text;
    else if (b.source_url) text = await fetchFromGoogle(b.source_url);
    else { res.status(400).json({ error: "파일, 붙여넣기, 링크 중 하나는 있어야 합니다." }); return; }
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "원본을 읽지 못했습니다." });
    return;
  }

  try {
    const parsedRows = parseStatement(text, b.bank);
    const company = await resolveCompanyInfo("ko").catch(() => null);
    const ownNames = ownNameVariants([company?.legalName, company?.tradingName]);

    const coa = await db.select({ code: chartOfAccountsTable.code })
      .from(chartOfAccountsTable).where(isNull(chartOfAccountsTable.deleted_at));
    const has = (c: string) => coa.some((x) => x.code === c);

    const rows = await matchStatement(parsedRows.rows, {
      ownNames,
      bankAccountId: b.bank_account_id ?? null,
      defaultIncomeCode: has("4000") ? "4000" : null,
      depositCode: has("2100") ? "2100" : null,
    });

    const sum = (f: (r: MatchedRow) => boolean) =>
      rows.filter(f).reduce((s, r) => s + (r.deposit || r.withdrawal), 0);

    res.json({
      success: true,
      data: {
        rows,
        meta: {
          header_line: parsedRows.header_line,
          skipped: parsedRows.skipped,
          warnings: parsedRows.warnings,
          total: rows.length,
          duplicates: rows.filter((r) => r.duplicate_of).length,
          review: rows.filter((r) => r.confidence === "review").length,
          deposit_total: sum((r) => r.deposit > 0),
          withdrawal_total: sum((r) => r.withdrawal > 0),
          period: rows.length ? { from: rows[rows.length - 1]!.txn_date, to: rows[0]!.txn_date } : null,
        },
      },
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "명세서를 읽지 못했습니다." });
  }
});

const CommitRow = z.object({
  txn_date: z.string().min(8),
  amount: z.number().positive(),
  txn_type: z.enum(["income", "expense", "transfer"]),
  memo: z.string().default(""),
  description: z.string().nullish(),
  contract_id: z.number().int().positive().nullish(),
  invoice_id: z.number().int().positive().nullish(),
  gl_account_code: z.string().nullish(),
  kind: z.string().default("unmatched"),
  reason: z.string().nullish(),
});

const CommitBody = z.object({
  bank_account_id: z.number().int().positive().nullish(),
  bank: z.string().default("auto"),
  /** 청구서에 붙은 건을 수납 처리까지 할 것인가. */
  settle_invoices: z.boolean().default(true),
  rows: z.array(CommitRow).min(1),
});

router.post("/v1/bank-import/commit", async (req, res): Promise<void> => {
  const parsed = CommitBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const b = parsed.data;
  const userId = (req as unknown as { user?: { id?: number } })?.user?.id ?? null;
  const cls = await resolveClassFromOwner(userId);

  // 회차가 없으면 붙일 대상이 없다. 관련 계약의 일정을 먼저 만들어 둔다(멱등).
  const contractIds = [...new Set(b.rows.map((r) => r.contract_id).filter((n): n is number => !!n))];
  let schedulesCreated = 0;
  for (const cid of contractIds) {
    try { schedulesCreated += (await generateContractSchedule(cid)).created; } catch { /* 일정 실패가 임포트를 막지 않는다 */ }
  }

  const year = new Date().getFullYear();
  const [seq] = await db.select({ n: sql<number>`count(*)::int` }).from(transactionsTable)
    .where(sql`${transactionsTable.txn_ref} LIKE ${`TXN-${year}-%`}`);
  let next = (seq?.n ?? 0) + 1;

  const created: number[] = [];
  const failed: Array<{ memo: string; error: string }> = [];
  const touchedSchedules: number[] = [];
  let settled = 0;

  for (const r of b.rows) {
    try {
      const fx = await stampBaseAmount(r.amount, DEFAULT_CURRENCY, r.txn_date);
      // 회차 연결 — 청구서가 붙었으면 그 회차, 보증금이면 미납 보증금 회차.
      let scheduleId: number | null = null;
      if (r.contract_id) {
        const sch = await db.select().from(paymentSchedulesTable).where(and(
          eq(paymentSchedulesTable.contract_id, r.contract_id),
          isNull(paymentSchedulesTable.deleted_at),
        ));
        const byInvoice = r.invoice_id ? sch.find((s) => s.invoice_id === r.invoice_id) : undefined;
        const byKind = r.kind === "deposit"
          ? sch.find((s) => s.kind === "deposit" && s.status !== "paid")
          : sch.find((s) => s.kind === "rent" && s.period === r.txn_date.slice(0, 7) && s.status !== "paid");
        scheduleId = (byInvoice ?? byKind)?.id ?? null;
      }

      const [row] = await db.insert(transactionsTable).values({
        txn_ref: `TXN-${year}-${String(next++).padStart(5, "0")}`,
        txn_type: r.txn_type,
        txn_date: r.txn_date.slice(0, 10),
        amount: String(r.amount),
        currency: DEFAULT_CURRENCY,
        ...fx,
        ...cls,
        owner_user_id: userId,
        contract_id: r.contract_id ?? null,
        invoice_id: r.invoice_id ?? null,
        payment_schedule_id: scheduleId,
        bank_account_id: b.bank_account_id ?? null,
        gl_account_code: r.gl_account_code ?? null,
        payment_method: "bank_transfer",
        bank_reference: r.memo,
        description: r.description ?? r.memo,
        notes: `[은행 명세서 가져오기] ${r.reason ?? ""}`.trim(),
        status: "confirmed",
        confirmed_at: new Date(),
        confirmed_by: userId,
        created_by: userId,
      }).returning();
      if (row) {
        created.push(row.id);
        if (scheduleId) touchedSchedules.push(scheduleId);

        // 청구서 수납 처리. 이걸 안 하면 통장에 돈이 들어왔는데 청구서는 계속
        // 미납으로 남아, 미납 목록과 실제가 어긋난다.
        //
        // ⚠️ 분개는 postInvoicePaid 로 **한 번만** 올린다(Dr 현금 / Cr 미수금).
        // 방금 만든 거래에도 그 분개 id 를 물려줘야 화면에서 다시 전기 버튼이
        // 뜨지 않고, /post 를 눌러도 같은 돈이 두 번 기록되지 않는다.
        if (b.settle_invoices && r.invoice_id) {
          try {
            const [inv] = await db.update(invoicesTable).set({
              status: "Paid", payment_method: "BankTransfer",
              paid_at: new Date(`${r.txn_date}T00:00:00.000Z`), updated_at: new Date(),
            }).where(and(
              eq(invoicesTable.id, r.invoice_id),
              inArray(invoicesTable.status, ["Sent", "Draft", "Overdue", "Unpaid"]),
            )).returning();

            if (inv) {
              settled++;
              const entry = await postInvoicePaid({
                id: inv.id, amount: Number(inv.amount), currency: inv.currency,
                tax: Number(inv.tax_amount ?? 0), paidAt: `${r.txn_date}T00:00:00.000Z`,
              });
              void generateSettlementsForInvoice(inv.id);
              const sid = await linkInvoiceToSchedule(inv.id);
              if (sid) touchedSchedules.push(sid);
              await db.update(transactionsTable).set({
                status: entry ? "posted" : "confirmed",
                journal_entry_id: entry?.id ?? null,
                posted_at: entry ? new Date() : null,
                payment_schedule_id: scheduleId ?? sid ?? null,
                updated_at: new Date(),
              }).where(eq(transactionsTable.id, row.id));
            }
          } catch (err) {
            // 수납 처리 실패가 거래 등록을 되돌리면 안 된다 — 돈은 이미 들어왔다.
            console.error("[bank-import settle]", err);
          }
        }
      }
    } catch (err) {
      failed.push({ memo: r.memo, error: err instanceof Error ? err.message.slice(0, 160) : "실패" });
    }
  }

  if (touchedSchedules.length) await recalcSchedulePaid(touchedSchedules);
  void logAction({ entityType: "transaction", entityId: 0, action: "CREATE",
    newValue: { bank_import: created.length, failed: failed.length, bank: b.bank } });

  res.json({
    success: true,
    data: {
      created: created.length, settled, failed,
      schedules_created: schedulesCreated, transaction_ids: created,
    },
  });
});

export default router;
