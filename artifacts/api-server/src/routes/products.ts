import { Router } from "express";
import { db, contractProductsTable, spacesTable } from "@workspace/db";
import { eq, ilike, and } from "drizzle-orm";

const router = Router();

async function withSpaceName(products: (typeof contractProductsTable.$inferSelect)[]) {
  if (products.length === 0) return [];
  const spaceIds = [...new Set(products.map(p => p.space_id).filter(Boolean))] as number[];
  const spaceMap: Record<number, string> = {};
  for (const sid of spaceIds) {
    const rows = await db.select({ id: spacesTable.id, name: spacesTable.name })
      .from(spacesTable).where(eq(spacesTable.id, sid));
    for (const s of rows) spaceMap[s.id] = s.name;
  }
  return products.map(p => ({ ...p, space_name: p.space_id ? (spaceMap[p.space_id] ?? null) : null }));
}

router.get("/v1/contract-products", async (req, res): Promise<void> => {
  const { q, status, product_type, space_id } = req.query as Record<string, string>;
  const conditions = [];
  if (q) conditions.push(ilike(contractProductsTable.name, `%${q}%`));
  if (status) conditions.push(eq(contractProductsTable.status, status));
  if (product_type) conditions.push(eq(contractProductsTable.product_type, product_type));
  if (space_id) conditions.push(eq(contractProductsTable.space_id, Number(space_id)));
  const rows = await db.select().from(contractProductsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(contractProductsTable.name);
  const result = await withSpaceName(rows);
  res.json(result);
});

router.post("/v1/contract-products", async (req, res): Promise<void> => {
  const data = req.body;
  const [row] = await db.insert(contractProductsTable).values({
    name: data.name,
    description: data.description ?? null,
    product_type: data.product_type ?? "Room",
    status: data.status ?? "Draft",
    space_id: data.space_id ?? null,
    weekly_rate: data.weekly_rate ?? null,
    monthly_rate: data.monthly_rate ?? null,
    currency: data.currency ?? "AUD",
    bond_weeks: data.bond_weeks ?? 4,
    advance_weeks: data.advance_weeks ?? 2,
    min_stay_weeks: data.min_stay_weeks ?? 1,
    max_stay_weeks: data.max_stay_weeks ?? null,
    includes_wifi: data.includes_wifi ?? false,
    includes_parking: data.includes_parking ?? false,
    includes_utilities: data.includes_utilities ?? false,
    includes_meals: data.includes_meals ?? false,
    includes_laundry: data.includes_laundry ?? false,
    includes_cleaning: data.includes_cleaning ?? false,
    extra_inclusions: data.extra_inclusions ?? null,
    notes: data.notes ?? null,
  }).returning();
  const [result] = await withSpaceName([row]);
  res.status(201).json(result);
});

router.get("/v1/contract-products/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(contractProductsTable).where(eq(contractProductsTable.id, id));
  if (!row) { res.status(404).json({ error: "NOT_FOUND" }); return; }
  const [result] = await withSpaceName([row]);
  res.json(result);
});

router.put("/v1/contract-products/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const data = req.body;
  const [row] = await db.update(contractProductsTable).set({
    name: data.name,
    description: data.description ?? null,
    product_type: data.product_type,
    space_id: data.space_id ?? null,
    weekly_rate: data.weekly_rate ?? null,
    monthly_rate: data.monthly_rate ?? null,
    currency: data.currency,
    bond_weeks: data.bond_weeks ?? null,
    advance_weeks: data.advance_weeks ?? null,
    min_stay_weeks: data.min_stay_weeks ?? null,
    max_stay_weeks: data.max_stay_weeks ?? null,
    includes_wifi: data.includes_wifi ?? false,
    includes_parking: data.includes_parking ?? false,
    includes_utilities: data.includes_utilities ?? false,
    includes_meals: data.includes_meals ?? false,
    includes_laundry: data.includes_laundry ?? false,
    includes_cleaning: data.includes_cleaning ?? false,
    extra_inclusions: data.extra_inclusions ?? null,
    notes: data.notes ?? null,
  }).where(eq(contractProductsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "NOT_FOUND" }); return; }
  const [result] = await withSpaceName([row]);
  res.json(result);
});

router.delete("/v1/contract-products/:id", async (req, res): Promise<void> => {
  await db.delete(contractProductsTable).where(eq(contractProductsTable.id, Number(req.params.id)));
  res.status(204).send();
});

router.post("/v1/contract-products/:id/activate", async (req, res): Promise<void> => {
  const [row] = await db.update(contractProductsTable).set({ status: "Active" })
    .where(eq(contractProductsTable.id, Number(req.params.id))).returning();
  if (!row) { res.status(404).json({ error: "NOT_FOUND" }); return; }
  const [result] = await withSpaceName([row]);
  res.json(result);
});

router.post("/v1/contract-products/:id/deactivate", async (req, res): Promise<void> => {
  const [row] = await db.update(contractProductsTable).set({ status: "Inactive" })
    .where(eq(contractProductsTable.id, Number(req.params.id))).returning();
  if (!row) { res.status(404).json({ error: "NOT_FOUND" }); return; }
  const [result] = await withSpaceName([row]);
  res.json(result);
});

router.post("/v1/contract-products/:id/archive", async (req, res): Promise<void> => {
  const [row] = await db.update(contractProductsTable).set({ status: "Archived" })
    .where(eq(contractProductsTable.id, Number(req.params.id))).returning();
  if (!row) { res.status(404).json({ error: "NOT_FOUND" }); return; }
  const [result] = await withSpaceName([row]);
  res.json(result);
});

router.get("/v1/lookup/contract-products", async (req, res): Promise<void> => {
  const { q } = req.query as Record<string, string>;
  const conditions = [];
  if (q) conditions.push(ilike(contractProductsTable.name, `%${q}%`));
  const rows = await db.select({ id: contractProductsTable.id, name: contractProductsTable.name, product_type: contractProductsTable.product_type })
    .from(contractProductsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(contractProductsTable.name)
    .limit(20);
  res.json(rows.map(r => ({ id: r.id, display: `${r.name} (${r.product_type})` })));
});

export default router;
