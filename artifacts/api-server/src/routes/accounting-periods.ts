import { Router, type IRouter } from "express";
import { and, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { db, accountingPeriodsTable, transactionsTable } from "@workspace/db";
import { logAction } from "../utils/auditLog";
import { periodStatus } from "../lib/billing/accountingPeriod";

// 회계기간 마감 (/finance/period-close) — FIN-001 제6·7조.
//
// 마감은 "그 달의 비용 귀속을 확정한다"는 선언이다. 선언한 뒤에 그 달로 거래를
// 심으면 확정한 숫자가 조용히 바뀌므로, 마감된 기간은 거래 라우트가 막는다
// (lib/billing/accountingPeriod.ts).
const router: IRouter = Router();
const ENTITY = "accounting_period";

const ymSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});

function parseYm(req: { params: Record<string, string> }) {
  return ymSchema.safeParse({ year: Number(req.params["year"]), month: Number(req.params["month"]) });
}

/** 그 달의 첫날/마지막날. 거래 건수를 세는 범위. */
function monthRange(year: number, month: number): [string, string] {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, "0");
  return [`${year}-${mm}-01`, `${year}-${mm}-${String(last).padStart(2, "0")}`];
}

async function upsertPeriod(year: number, month: number, patch: Record<string, unknown>) {
  const [existing] = await db
    .select()
    .from(accountingPeriodsTable)
    .where(and(eq(accountingPeriodsTable.year, year), eq(accountingPeriodsTable.month, month)))
    .limit(1);

  if (existing) {
    const [row] = await db
      .update(accountingPeriodsTable)
      .set({ ...patch, updated_at: new Date() })
      .where(eq(accountingPeriodsTable.id, existing.id))
      .returning();
    return row!;
  }
  const [row] = await db.insert(accountingPeriodsTable).values({ year, month, ...patch }).returning();
  return row!;
}

/**
 * 한 해 12개월의 마감 상태와, 각 달에 걸린 거래 건수·승인 대기 거래 건수.
 * 마감 버튼 옆에 "아직 승인 대기 3건"이 보여야 성급한 마감을 막는다.
 */
router.get("/v1/accounting-periods", async (req, res): Promise<void> => {
  try {
    const year = Number(req.query["year"]) || new Date().getFullYear();

    const rows = await db
      .select()
      .from(accountingPeriodsTable)
      .where(eq(accountingPeriodsTable.year, year));
    const byMonth = new Map(rows.map((r) => [r.month, r]));

    // 12개월치 집계를 한 번의 쿼리로 — 달마다 세면 12번 왕복한다.
    const [from, to] = [`${year}-01-01`, `${year}-12-31`];
    const counts = await db
      .select({
        month: sql<number>`cast(substring(${transactionsTable.txn_date} from 6 for 2) as int)`,
        total: sql<number>`count(*)::int`,
        // main 의 maker-checker 워크플로(0081)에서 승인을 기다리는 거래.
        // 이게 남은 채로 마감하면 그 거래는 영원히 그 달에 들어갈 수 없다.
        pending: sql<number>`count(*) filter (where ${transactionsTable.workflow_status} = 'submitted')::int`,
        unposted: sql<number>`count(*) filter (where ${transactionsTable.status} in ('draft','confirmed'))::int`,
      })
      .from(transactionsTable)
      .where(and(
        isNull(transactionsTable.deleted_at),
        gte(transactionsTable.txn_date, from),
        lte(transactionsTable.txn_date, to),
      ))
      .groupBy(sql`cast(substring(${transactionsTable.txn_date} from 6 for 2) as int)`);
    const countByMonth = new Map(counts.map((c) => [c.month, c]));

    const data = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const row = byMonth.get(month);
      const c = countByMonth.get(month);
      return {
        year,
        month,
        status: row?.status ?? "open",
        closed_at: row?.closed_at ?? null,
        reopened_at: row?.reopened_at ?? null,
        reopen_reason: row?.reopen_reason ?? null,
        locked_at: row?.locked_at ?? null,
        note: row?.note ?? null,
        transaction_count: c?.total ?? 0,
        pending_claims: c?.pending ?? 0,
        unposted_count: c?.unposted ?? 0,
      };
    });

    res.json({ success: true, data });
  } catch (err) {
    console.error("[GET /v1/accounting-periods]", err);
    res.status(500).json({ error: "Failed to load accounting periods" });
  }
});

/** 특정 날짜가 입력 가능한지 — 화면이 날짜 입력 옆에 바로 보여 줄 수 있게. */
router.get("/v1/accounting-periods/status", async (req, res): Promise<void> => {
  const date = String(req.query["date"] ?? "");
  const m = /^(\d{4})-(\d{2})/.exec(date);
  if (!m) { res.status(400).json({ error: "date=YYYY-MM-DD is required" }); return; }
  const status = await periodStatus(Number(m[1]), Number(m[2]));
  res.json({ success: true, data: { year: Number(m[1]), month: Number(m[2]), status, editable: status === "open" } });
});

router.post("/v1/accounting-periods/:year/:month/close", async (req, res): Promise<void> => {
  const parsed = parseYm(req as never);
  if (!parsed.success) { res.status(400).json({ error: "Invalid year/month" }); return; }
  const { year, month } = parsed.data;
  const userId = (req as any).user?.id ?? null;

  const current = await periodStatus(year, month);
  if (current === "locked") { res.status(409).json({ error: "이미 확정된 기간입니다" }); return; }

  const row = await upsertPeriod(year, month, {
    status: "closed",
    closed_at: new Date(),
    closed_by: userId,
    note: typeof req.body?.note === "string" ? req.body.note : null,
  });
  void logAction({ entityType: ENTITY, entityId: row.id, action: "UPDATE", newValue: { year, month, status: "closed" } });
  res.json({ success: true, data: row });
});

/**
 * 마감 해제. 규정이 "조건부"로 둔 구간이라 **사유를 반드시 남긴다** — 사유 없는
 * 해제가 가능하면 마감은 잠금이 아니라 형식이 된다.
 */
router.post("/v1/accounting-periods/:year/:month/reopen", async (req, res): Promise<void> => {
  const parsed = parseYm(req as never);
  if (!parsed.success) { res.status(400).json({ error: "Invalid year/month" }); return; }
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (!reason) { res.status(400).json({ error: "마감 해제 사유를 입력하세요" }); return; }

  const { year, month } = parsed.data;
  const current = await periodStatus(year, month);
  if (current === "locked") {
    res.status(409).json({ error: "부가세 신고·결산이 확정된 기간은 해제할 수 없습니다. 당월 비용으로 처리하거나 수정신고로 정정하세요" });
    return;
  }
  if (current === "open") { res.status(409).json({ error: "이미 열린 기간입니다" }); return; }

  const row = await upsertPeriod(year, month, {
    status: "open",
    reopened_at: new Date(),
    reopened_by: (req as any).user?.id ?? null,
    reopen_reason: reason,
  });
  void logAction({ entityType: ENTITY, entityId: row.id, action: "UPDATE", newValue: { year, month, status: "open", reason } });
  res.json({ success: true, data: row });
});

/** 부가세 신고·결산 확정. 되돌리는 경로는 두지 않는다 — 규정 제7조의 세 번째 구간. */
router.post("/v1/accounting-periods/:year/:month/lock", async (req, res): Promise<void> => {
  const parsed = parseYm(req as never);
  if (!parsed.success) { res.status(400).json({ error: "Invalid year/month" }); return; }
  const { year, month } = parsed.data;

  const current = await periodStatus(year, month);
  if (current === "locked") { res.status(409).json({ error: "이미 확정된 기간입니다" }); return; }
  if (current === "open") { res.status(409).json({ error: "먼저 마감한 뒤에 확정할 수 있습니다" }); return; }

  const row = await upsertPeriod(year, month, {
    status: "locked",
    locked_at: new Date(),
    locked_by: (req as any).user?.id ?? null,
    note: typeof req.body?.note === "string" ? req.body.note : null,
  });
  void logAction({ entityType: ENTITY, entityId: row.id, action: "UPDATE", newValue: { year, month, status: "locked" } });
  res.json({ success: true, data: row });
});

export default router;
