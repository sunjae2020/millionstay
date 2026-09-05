import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  fixedAssetsTable,
  transactionsTable,
  spacesTable,
  usersTable,
  chartOfAccountsTable,
} from "@workspace/db";
import { logAction } from "../utils/auditLog";
import { deletedFilter, makeBulkDelete, makeBulkRestore } from "../lib/softDelete";
import { formatPersonName } from "../lib/nameFormat";
import { depreciationAsOf, nextAssetNo } from "../lib/billing/fixedAssets";

// 자산대장 (/finance/fixed-assets) — FIN-001 제11조.
//
// 대부분의 행은 손으로 만들지 않는다. 지출결의가 승인될 때 자산 계정이나 자본적
// 지출로 표시된 건이 초안(draft)으로 떨어지고, 사람이 내용연수·설치 장소·관리
// 책임자를 채워 확정(active)한다.
const router: IRouter = Router();
const ENTITY = "fixed_asset";

type AssetRow = typeof fixedAssetsTable.$inferSelect;

async function enrichAssets(rows: AssetRow[], asOf: Date) {
  if (rows.length === 0) return [];
  const ids = <T>(vals: (T | null)[]) => [...new Set(vals.filter((v): v is T => v != null))];

  const spaceIds = ids(rows.map((r) => r.space_id));
  const userIds = ids(rows.map((r) => r.custodian_user_id));
  const txnIds = ids(rows.map((r) => r.source_transaction_id));
  const codes = ids(rows.map((r) => r.account_code));

  const [spaces, users, txns, accounts] = await Promise.all([
    spaceIds.length
      ? db.select({ id: spacesTable.id, name: spacesTable.name }).from(spacesTable).where(inArray(spacesTable.id, spaceIds))
      : Promise.resolve([]),
    userIds.length
      ? db.select({ id: usersTable.id, first_name: usersTable.first_name, last_name: usersTable.last_name })
          .from(usersTable).where(inArray(usersTable.id, userIds))
      : Promise.resolve([]),
    txnIds.length
      ? db.select({ id: transactionsTable.id, txn_ref: transactionsTable.txn_ref })
          .from(transactionsTable).where(inArray(transactionsTable.id, txnIds))
      : Promise.resolve([]),
    codes.length
      ? db.select({ code: chartOfAccountsTable.code, name: chartOfAccountsTable.name })
          .from(chartOfAccountsTable).where(inArray(chartOfAccountsTable.code, codes))
      : Promise.resolve([]),
  ]);

  const spaceName = new Map(spaces.map((s) => [s.id, s.name]));
  const userName = new Map(users.map((u) => [u.id, formatPersonName(u.first_name, u.last_name)]));
  const txnRef = new Map(txns.map((t) => [t.id, t.txn_ref]));
  const accountName = new Map(accounts.map((a) => [a.code, a.name]));

  return rows.map((r) => {
    const dep = depreciationAsOf(r, asOf);
    return {
      ...r,
      acquisition_cost: Number(r.acquisition_cost),
      residual_value: Number(r.residual_value),
      space_name: r.space_id != null ? spaceName.get(r.space_id) ?? null : null,
      custodian_name: r.custodian_user_id != null ? userName.get(r.custodian_user_id) ?? null : null,
      source_txn_ref: r.source_transaction_id != null ? txnRef.get(r.source_transaction_id) ?? null : null,
      account_name: r.account_code ? accountName.get(r.account_code) ?? null : null,
      // 장부가액은 저장하지 않고 읽는 시점에 센다 — 기준일이 바뀌면 값도 바뀐다.
      monthly_depreciation: dep.monthlyAmount,
      elapsed_months: dep.elapsedMonths,
      accumulated_depreciation: dep.accumulated,
      book_value: dep.bookValue,
      fully_depreciated: dep.fullyDepreciated,
    };
  });
}

router.get("/v1/fixed-assets", async (req, res): Promise<void> => {
  try {
    const status = req.query["status"] ? String(req.query["status"]) : null;
    const asOfRaw = req.query["as_of"] ? String(req.query["as_of"]) : null;
    const asOf = asOfRaw && !Number.isNaN(Date.parse(asOfRaw)) ? new Date(asOfRaw) : new Date();

    const where = [deletedFilter(fixedAssetsTable.deleted_at, req)];
    if (status) where.push(eq(fixedAssetsTable.status, status));

    const rows = await db
      .select()
      .from(fixedAssetsTable)
      .where(and(...where))
      .orderBy(desc(fixedAssetsTable.acquired_on), desc(fixedAssetsTable.id))
      .limit(1000);

    const data = await enrichAssets(rows, asOf);
    const round2 = (n: number) => Math.round(n * 100) / 100;
    const active = data.filter((d) => d.status !== "disposed");
    res.json({
      success: true,
      data,
      meta: {
        total: data.length,
        draft: data.filter((d) => d.status === "draft").length,
        active: data.filter((d) => d.status === "active").length,
        acquisition_total: round2(active.reduce((s, d) => s + d.acquisition_cost, 0)),
        book_value_total: round2(active.reduce((s, d) => s + d.book_value, 0)),
        as_of: asOf.toISOString().slice(0, 10),
      },
    });
  } catch (err) {
    console.error("[GET /v1/fixed-assets]", err);
    res.status(500).json({ error: "Failed to list fixed assets" });
  }
});

const AssetBody = z.object({
  name: z.string().trim().min(1),
  account_code: z.string().nullable().optional(),
  acquired_on: z.string(),
  acquisition_cost: z.union([z.number(), z.string()]),
  currency: z.string().optional(),
  residual_value: z.union([z.number(), z.string()]).optional(),
  useful_life_years: z.number().int().min(0).max(100).optional(),
  depreciation_method: z.enum(["straight_line", "declining_balance"]).optional(),
  space_id: z.number().int().nullable().optional(),
  property_id: z.number().int().nullable().optional(),
  custodian_user_id: z.number().int().nullable().optional(),
  location_note: z.string().nullable().optional(),
  source_transaction_id: z.number().int().nullable().optional(),
  status: z.enum(["draft", "active", "disposed"]).optional(),
  disposed_on: z.string().nullable().optional(),
  disposal_note: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

function assetValues(b: z.infer<typeof AssetBody>) {
  return {
    name: b.name,
    account_code: b.account_code ?? null,
    acquired_on: b.acquired_on,
    // numeric 컬럼은 문자열로 넣는다(Drizzle 규약).
    acquisition_cost: String(b.acquisition_cost),
    ...(b.currency ? { currency: b.currency } : {}),
    ...(b.residual_value != null ? { residual_value: String(b.residual_value) } : {}),
    ...(b.useful_life_years != null ? { useful_life_years: b.useful_life_years } : {}),
    ...(b.depreciation_method ? { depreciation_method: b.depreciation_method } : {}),
    space_id: b.space_id ?? null,
    property_id: b.property_id ?? null,
    custodian_user_id: b.custodian_user_id ?? null,
    location_note: b.location_note ?? null,
    source_transaction_id: b.source_transaction_id ?? null,
    ...(b.status ? { status: b.status } : {}),
    disposed_on: b.disposed_on ?? null,
    disposal_note: b.disposal_note ?? null,
    notes: b.notes ?? null,
  };
}

router.post("/v1/fixed-assets", async (req, res): Promise<void> => {
  const parsed = AssetBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  try {
    const [row] = await db.insert(fixedAssetsTable).values({
      ...assetValues(parsed.data),
      asset_no: await nextAssetNo(),
      created_by: (req as any).user?.id ?? null,
    }).returning();
    void logAction({ entityType: ENTITY, entityId: row!.id, action: "CREATE", newValue: { asset_no: row!.asset_no } });
    const [data] = await enrichAssets([row!], new Date());
    res.status(201).json({ success: true, data });
  } catch (err) {
    console.error("[POST /v1/fixed-assets]", err);
    res.status(500).json({ error: "Failed to create fixed asset" });
  }
});

router.put("/v1/fixed-assets/:id", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  const parsed = AssetBody.partial().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [before] = await db.select().from(fixedAssetsTable).where(eq(fixedAssetsTable.id, id)).limit(1);
  if (!before) { res.status(404).json({ error: "Not found" }); return; }

  const merged = { ...before, ...parsed.data } as z.infer<typeof AssetBody>;
  const [row] = await db.update(fixedAssetsTable)
    .set({ ...assetValues(merged), updated_at: new Date() })
    .where(eq(fixedAssetsTable.id, id))
    .returning();
  void logAction({ entityType: ENTITY, entityId: id, action: "UPDATE", newValue: parsed.data });
  const [data] = await enrichAssets([row!], new Date());
  res.json({ success: true, data });
});

const assetSoftDelete = { table: fixedAssetsTable, idColumn: fixedAssetsTable.id };
router.post("/v1/fixed-assets/bulk-delete", makeBulkDelete(assetSoftDelete));
router.post("/v1/fixed-assets/bulk-restore", makeBulkRestore(assetSoftDelete));

router.delete("/v1/fixed-assets/:id", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  const [row] = await db.update(fixedAssetsTable)
    .set({ deleted_at: new Date(), updated_at: new Date() })
    .where(and(eq(fixedAssetsTable.id, id), isNull(fixedAssetsTable.deleted_at)))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  void logAction({ entityType: ENTITY, entityId: id, action: "DELETE", newValue: { asset_no: row.asset_no } });
  res.json({ success: true });
});

export default router;
