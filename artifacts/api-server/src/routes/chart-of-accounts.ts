import { Router, type IRouter } from "express";
import { eq, ilike, asc, or, and } from "drizzle-orm";
import { keywordCondition } from "../lib/listSearch";
import { db, chartOfAccountsTable } from "@workspace/db";
import { deletedFilter, makeBulkDelete, makeBulkRestore } from "../lib/softDelete";

const router: IRouter = Router();

const ACCOUNT_TYPES = ["asset", "liability", "equity", "revenue", "expense"];

// Default Korean real-estate chart of accounts (계정과목). Seeded on request from
// the admin when the tenant has no accounts yet. Codes align with the auto-posting
// GL (journal.ts): 1000 현금, 2100 임대보증금, 2200 미지급금, 4000 임대수익, 5100 지급수수료.
const DEFAULT_COA: Array<{ code: string; name: string; account_type: string; parent_code?: string }> = [
  // 자산 Assets
  { code: "1000", name: "현금및현금성자산", account_type: "asset" },
  { code: "1010", name: "현금", account_type: "asset", parent_code: "1000" },
  { code: "1020", name: "보통예금", account_type: "asset", parent_code: "1000" },
  { code: "1100", name: "매출채권", account_type: "asset" },
  { code: "1110", name: "임대료 미수금", account_type: "asset", parent_code: "1100" },
  { code: "1120", name: "관리비 미수금", account_type: "asset", parent_code: "1100" },
  { code: "1200", name: "선급금", account_type: "asset" },
  { code: "1500", name: "유형자산", account_type: "asset" },
  { code: "1510", name: "건물", account_type: "asset", parent_code: "1500" },
  { code: "1520", name: "토지", account_type: "asset", parent_code: "1500" },
  { code: "1530", name: "비품", account_type: "asset", parent_code: "1500" },
  { code: "1590", name: "감가상각누계액", account_type: "asset", parent_code: "1500" },
  // 부채 Liabilities
  { code: "2000", name: "매입채무", account_type: "liability" },
  { code: "2100", name: "임대보증금", account_type: "liability" },
  { code: "2200", name: "미지급금", account_type: "liability" },
  { code: "2300", name: "선수금", account_type: "liability" },
  { code: "2310", name: "선수임대료", account_type: "liability", parent_code: "2300" },
  { code: "2400", name: "예수금", account_type: "liability" },
  { code: "2410", name: "부가세예수금", account_type: "liability", parent_code: "2400" },
  // 자본 Equity
  { code: "3000", name: "자본금", account_type: "equity" },
  { code: "3100", name: "이익잉여금", account_type: "equity" },
  // 수익 Revenue
  { code: "4000", name: "임대수익", account_type: "revenue" },
  { code: "4100", name: "분양·매매수익", account_type: "revenue" },
  { code: "4200", name: "관리수수료수익", account_type: "revenue" },
  { code: "4300", name: "부가서비스수익", account_type: "revenue" },
  { code: "4900", name: "기타수익", account_type: "revenue" },
  // 비용 Expense
  { code: "5000", name: "매출원가", account_type: "expense" },
  { code: "5100", name: "지급수수료", account_type: "expense" },
  { code: "5200", name: "급여", account_type: "expense" },
  { code: "5300", name: "임차료", account_type: "expense" },
  { code: "5400", name: "수도광열비", account_type: "expense" },
  { code: "5500", name: "수선비", account_type: "expense" },
  { code: "5600", name: "청소비", account_type: "expense" },
  { code: "5700", name: "광고선전비", account_type: "expense" },
  { code: "5800", name: "감가상각비", account_type: "expense" },
  { code: "5900", name: "세금과공과", account_type: "expense" },
];

router.get("/v1/chart-of-accounts", async (req, res): Promise<void> => {
  try {
    const { q, account_type } = req.query as Record<string, string>;
    const rows = await db
      .select()
      .from(chartOfAccountsTable)
      .where(
        and(
          deletedFilter(chartOfAccountsTable.deleted_at, req),
          q ? keywordCondition(q, [chartOfAccountsTable.code, chartOfAccountsTable.name, chartOfAccountsTable.account_type, chartOfAccountsTable.description]) : undefined,
          account_type ? eq(chartOfAccountsTable.account_type, account_type) : undefined,
        ),
      )
      .orderBy(asc(chartOfAccountsTable.sort_order), asc(chartOfAccountsTable.code));
    res.json({ success: true, data: rows, meta: { total: rows.length } });
  } catch {
    res.status(500).json({ error: "Failed to list chart of accounts" });
  }
});

router.get("/v1/chart-of-accounts/:id", async (req, res): Promise<void> => {
  try {
    const [row] = await db.select().from(chartOfAccountsTable).where(eq(chartOfAccountsTable.id, Number(req.params.id)));
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch {
    res.status(500).json({ error: "Failed to get account" });
  }
});

router.post("/v1/chart-of-accounts", async (req, res): Promise<void> => {
  try {
    const { code, name, account_type, parent_code, description, is_active, sort_order } = req.body;
    if (!code || !name) { res.status(400).json({ error: "code and name are required" }); return; }
    if (account_type && !ACCOUNT_TYPES.includes(account_type)) { res.status(400).json({ error: "invalid account_type" }); return; }
    const [row] = await db.insert(chartOfAccountsTable).values({
      code: String(code).trim(),
      name: String(name).trim(),
      account_type: account_type ?? "asset",
      parent_code: parent_code || null,
      description: description || null,
      is_active: is_active ?? true,
      sort_order: sort_order ?? 0,
    }).returning();
    res.status(201).json(row);
  } catch (err: any) {
    if (err?.code === "23505") { res.status(409).json({ error: "Account code already exists" }); return; }
    res.status(500).json({ error: "Failed to create account" });
  }
});

router.put("/v1/chart-of-accounts/:id", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { id: _id, created_at, deleted_at, ...updates } = req.body;
    if (updates.account_type && !ACCOUNT_TYPES.includes(updates.account_type)) { res.status(400).json({ error: "invalid account_type" }); return; }
    const [row] = await db.update(chartOfAccountsTable).set(updates).where(eq(chartOfAccountsTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch (err: any) {
    if (err?.code === "23505") { res.status(409).json({ error: "Account code already exists" }); return; }
    res.status(500).json({ error: "Failed to update account" });
  }
});

// Seed a standard Korean real-estate COA. No-op for codes that already exist, so
// it is safe to call on a partially-populated tenant.
router.post("/v1/chart-of-accounts/seed-defaults", async (_req, res): Promise<void> => {
  try {
    const existing = await db.select({ code: chartOfAccountsTable.code }).from(chartOfAccountsTable);
    const have = new Set(existing.map((r) => r.code));
    const toInsert = DEFAULT_COA.filter((a) => !have.has(a.code)).map((a, i) => ({
      code: a.code,
      name: a.name,
      account_type: a.account_type,
      parent_code: a.parent_code ?? null,
      sort_order: (have.size + i) * 10,
    }));
    if (toInsert.length) await db.insert(chartOfAccountsTable).values(toInsert);
    res.json({ success: true, inserted: toInsert.length });
  } catch {
    res.status(500).json({ error: "Failed to seed chart of accounts" });
  }
});

const coaSoftDelete = {
  table: chartOfAccountsTable,
  idColumn: chartOfAccountsTable.id,
};

router.post("/v1/chart-of-accounts/bulk-delete", makeBulkDelete(coaSoftDelete));
router.post("/v1/chart-of-accounts/bulk-restore", makeBulkRestore(coaSoftDelete));

router.delete("/v1/chart-of-accounts/:id", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const currentUser = (req as any).user;
    const permanent = req.query.permanent === "true";
    if (permanent) {
      if (currentUser?.role !== "SuperAdmin") {
        res.status(403).json({ error: "Only SuperAdmin can permanently delete records" }); return;
      }
      const [row] = await db.delete(chartOfAccountsTable).where(eq(chartOfAccountsTable.id, id)).returning();
      if (!row) { res.status(404).json({ error: "Not found" }); return; }
    } else {
      const [row] = await db.update(chartOfAccountsTable)
        .set({ deleted_at: new Date() })
        .where(eq(chartOfAccountsTable.id, id)).returning();
      if (!row) { res.status(404).json({ error: "Not found" }); return; }
    }
    res.status(204).end();
  } catch {
    res.status(500).json({ error: "Failed to delete account" });
  }
});

export default router;
