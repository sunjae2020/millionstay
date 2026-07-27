import { Router, type IRouter } from "express";
import { eq, ilike, asc, and } from "drizzle-orm";
import { db, rentalFeeSchedulesTable } from "@workspace/db";
import { deletedFilter, makeBulkDelete, makeBulkRestore } from "../lib/softDelete";

const router: IRouter = Router();

// Default rate card (임대 수수료 기준표) — the fee grid the operations manual runs on.
// Base amounts are pre-tax (간이과세/원천징수 applied via the rate columns). Seeded on
// request; a no-op for type_labels that already exist so it's safe to re-run.
const DEFAULT_SCHEDULES: Array<{
  type_label: string; brokerage_fee: number; self_fee: number; working_fee: number;
}> = [
  { type_label: "A,B", brokerage_fee: 300000, self_fee: 200000, working_fee: 350000 },
  { type_label: "C", brokerage_fee: 400000, self_fee: 250000, working_fee: 400000 },
  { type_label: "D", brokerage_fee: 450000, self_fee: 250000, working_fee: 425000 },
  { type_label: "E", brokerage_fee: 500000, self_fee: 300000, working_fee: 500000 },
];

router.get("/v1/rental-fee-schedules", async (req, res): Promise<void> => {
  try {
    const { q, status } = req.query as Record<string, string>;
    const rows = await db
      .select()
      .from(rentalFeeSchedulesTable)
      .where(
        and(
          deletedFilter(rentalFeeSchedulesTable.deleted_at, req),
          q ? ilike(rentalFeeSchedulesTable.type_label, `%${q}%`) : undefined,
          status ? eq(rentalFeeSchedulesTable.status, status) : undefined,
        ),
      )
      .orderBy(asc(rentalFeeSchedulesTable.sort_order), asc(rentalFeeSchedulesTable.id));
    res.json({ success: true, data: rows, meta: { total: rows.length } });
  } catch {
    res.status(500).json({ error: "Failed to list rental fee schedules" });
  }
});

router.get("/v1/rental-fee-schedules/:id", async (req, res): Promise<void> => {
  try {
    const [row] = await db.select().from(rentalFeeSchedulesTable).where(eq(rentalFeeSchedulesTable.id, Number(req.params.id)));
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch {
    res.status(500).json({ error: "Failed to get rental fee schedule" });
  }
});

const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

router.post("/v1/rental-fee-schedules", async (req, res): Promise<void> => {
  try {
    const b = req.body ?? {};
    if (!b.type_label || !String(b.type_label).trim()) { res.status(400).json({ error: "type_label is required" }); return; }
    const [row] = await db.insert(rentalFeeSchedulesTable).values({
      type_label: String(b.type_label).trim(),
      brokerage_fee: num(b.brokerage_fee),
      self_fee: num(b.self_fee),
      working_fee: num(b.working_fee),
      brokerage_surcharge_rate: num(b.brokerage_surcharge_rate, 4),
      self_withholding_rate: num(b.self_withholding_rate, 3.3),
      currency: b.currency ? String(b.currency) : "KRW",
      sort_order: num(b.sort_order),
      note: b.note ? String(b.note) : "",
      status: b.status ? String(b.status) : "Active",
    }).returning();
    res.status(201).json(row);
  } catch {
    res.status(500).json({ error: "Failed to create rental fee schedule" });
  }
});

router.put("/v1/rental-fee-schedules/:id", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { id: _id, created_at, deleted_at, ...raw } = req.body ?? {};
    const updates: Record<string, unknown> = {};
    if (raw.type_label !== undefined) updates.type_label = String(raw.type_label).trim();
    for (const k of ["brokerage_fee", "self_fee", "working_fee", "brokerage_surcharge_rate", "self_withholding_rate", "sort_order"]) {
      if (raw[k] !== undefined) updates[k] = num(raw[k]);
    }
    if (raw.currency !== undefined) updates.currency = String(raw.currency);
    if (raw.note !== undefined) updates.note = String(raw.note);
    if (raw.status !== undefined) updates.status = String(raw.status);
    const [row] = await db.update(rentalFeeSchedulesTable).set(updates).where(eq(rentalFeeSchedulesTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch {
    res.status(500).json({ error: "Failed to update rental fee schedule" });
  }
});

// Seed the default 임대 수수료 기준표 (A,B / C / D / E). Skips type_labels already present.
router.post("/v1/rental-fee-schedules/seed-defaults", async (_req, res): Promise<void> => {
  try {
    const existing = await db.select({ type_label: rentalFeeSchedulesTable.type_label }).from(rentalFeeSchedulesTable);
    const have = new Set(existing.map((r) => r.type_label));
    const toInsert = DEFAULT_SCHEDULES.filter((s) => !have.has(s.type_label)).map((s, i) => ({
      type_label: s.type_label,
      brokerage_fee: s.brokerage_fee,
      self_fee: s.self_fee,
      working_fee: s.working_fee,
      sort_order: (have.size + i) * 10,
    }));
    if (toInsert.length) await db.insert(rentalFeeSchedulesTable).values(toInsert);
    res.json({ success: true, inserted: toInsert.length });
  } catch {
    res.status(500).json({ error: "Failed to seed rental fee schedules" });
  }
});

const softDelete = {
  table: rentalFeeSchedulesTable,
  idColumn: rentalFeeSchedulesTable.id,
};

router.post("/v1/rental-fee-schedules/bulk-delete", makeBulkDelete(softDelete));
router.post("/v1/rental-fee-schedules/bulk-restore", makeBulkRestore(softDelete));

router.delete("/v1/rental-fee-schedules/:id", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const currentUser = (req as any).user;
    const permanent = req.query.permanent === "true";
    if (permanent) {
      if (currentUser?.role !== "SuperAdmin") {
        res.status(403).json({ error: "Only SuperAdmin can permanently delete records" }); return;
      }
      const [row] = await db.delete(rentalFeeSchedulesTable).where(eq(rentalFeeSchedulesTable.id, id)).returning();
      if (!row) { res.status(404).json({ error: "Not found" }); return; }
    } else {
      const [row] = await db.update(rentalFeeSchedulesTable)
        .set({ deleted_at: new Date() })
        .where(eq(rentalFeeSchedulesTable.id, id)).returning();
      if (!row) { res.status(404).json({ error: "Not found" }); return; }
    }
    res.status(204).end();
  } catch {
    res.status(500).json({ error: "Failed to delete rental fee schedule" });
  }
});

export default router;
