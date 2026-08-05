import { Router, type IRouter } from "express";
import { eq, ilike, asc, and, isNull, inArray } from "drizzle-orm";
import { keywordCondition } from "../lib/listSearch";
import { db, rentalFeeSchedulesTable, contractsTable, contractRelatedCostsTable, spacesTable, accountsTable } from "@workspace/db";
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
          q ? keywordCondition(q, [rentalFeeSchedulesTable.type_label, rentalFeeSchedulesTable.note]) : undefined,
          status ? eq(rentalFeeSchedulesTable.status, status) : undefined,
        ),
      )
      .orderBy(asc(rentalFeeSchedulesTable.sort_order), asc(rentalFeeSchedulesTable.id));
    res.json({ success: true, data: rows, meta: { total: rows.length } });
  } catch {
    res.status(500).json({ error: "Failed to list rental fee schedules" });
  }
});

/**
 * 임대 수수료 대사 — rate card (config) vs what was actually paid on each contract
 * (contract_related_costs). Per contract we compare the sum of 임대수수료 +
 * 부동산수수료 against the schedule row whose type_label covers the unit's type,
 * so operations can see over/under payments at a glance.
 */
router.get("/v1/rental-fee-schedules/reconciliation", async (req, res): Promise<void> => {
  const { basis } = req.query as Record<string, string>;
  // Which rate-card column the actual amount is measured against.
  const column: "brokerage" | "self" | "working" =
    basis === "self" ? "self" : basis === "working" ? "working" : "brokerage";

  const schedules = await db.select().from(rentalFeeSchedulesTable)
    .where(and(isNull(rentalFeeSchedulesTable.deleted_at), eq(rentalFeeSchedulesTable.status, "Active")))
    .orderBy(asc(rentalFeeSchedulesTable.sort_order));

  // "A,B" covers both A and A-1 style labels — match on the leading letter.
  const scheduleFor = (typeName: string | null) => {
    if (!typeName) return null;
    const letter = (typeName.match(/^[A-Za-z]+/) ?? [""])[0].toUpperCase();
    if (!letter) return null;
    return schedules.find((s) => s.type_label.split(/[,\s]+/).some((l) => l.trim().toUpperCase() === letter)) ?? null;
  };

  const contracts = await db.select({
    id: contractsTable.id,
    contract_ref: contractsTable.contract_ref,
    status: contractsTable.status,
    start_date: contractsTable.start_date,
    tenant_name: accountsTable.name,
    unit_name: spacesTable.name,
    unit_type: spacesTable.custom_type_name,
    currency: contractsTable.currency,
  })
    .from(contractsTable)
    .leftJoin(accountsTable, eq(accountsTable.id, contractsTable.tenant_account_id))
    .leftJoin(spacesTable, eq(spacesTable.id, contractsTable.space_id))
    .where(isNull(contractsTable.deleted_at));

  const costs = contracts.length
    ? await db.select().from(contractRelatedCostsTable)
        .where(inArray(contractRelatedCostsTable.contract_id, contracts.map((c) => c.id)))
    : [];
  const costsByContract = new Map<number, typeof costs>();
  for (const c of costs) {
    const list = costsByContract.get(c.contract_id) ?? [];
    list.push(c);
    costsByContract.set(c.contract_id, list);
  }

  const rows = contracts.map((c) => {
    const list = costsByContract.get(c.id) ?? [];
    const lease = list.filter((x) => x.cost_type === "임대수수료").reduce((s, x) => s + Number(x.amount ?? 0), 0);
    const agency = list.filter((x) => x.cost_type === "부동산수수료").reduce((s, x) => s + Number(x.amount ?? 0), 0);
    const sched = scheduleFor(c.unit_type);
    const expected = sched
      ? column === "brokerage" ? sched.brokerage_fee * (1 + sched.brokerage_surcharge_rate / 100)
        : column === "self" ? sched.self_fee * (1 - sched.self_withholding_rate / 100)
        : sched.working_fee
      : null;
    const actual = lease + agency;
    return {
      contract_id: c.id, contract_ref: c.contract_ref, status: c.status, start_date: c.start_date,
      tenant_name: c.tenant_name, unit_name: c.unit_name, unit_type: c.unit_type,
      currency: c.currency, type_label: sched?.type_label ?? null,
      expected: expected == null ? null : Math.round(expected),
      lease_fee: lease, agency_fee: agency, actual,
      diff: expected == null ? null : Math.round(actual - expected),
    };
  }).filter((r) => r.actual > 0 || r.expected != null);

  res.json({
    basis: column,
    total_expected: rows.reduce((s, r) => s + (r.expected ?? 0), 0),
    total_actual: rows.reduce((s, r) => s + r.actual, 0),
    mismatched: rows.filter((r) => r.diff != null && r.diff !== 0).length,
    unmatched_type: rows.filter((r) => r.expected == null).length,
    data: rows.sort((a, b) => Math.abs(b.diff ?? 0) - Math.abs(a.diff ?? 0)),
  });
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
