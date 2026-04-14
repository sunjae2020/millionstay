import { Router } from "express";
import { db, contractProductsTable, spacesTable, promotionsTable } from "@workspace/db";
import { eq, ilike, and, isNull, inArray } from "drizzle-orm";

const router = Router();

async function enrich(products: (typeof contractProductsTable.$inferSelect)[]) {
  if (products.length === 0) return [];

  const spaceIds = [...new Set(products.map(p => p.space_id).filter(Boolean))] as number[];
  const spaceMap: Record<number, string> = {};
  for (const sid of spaceIds) {
    const rows = await db.select({ id: spacesTable.id, name: spacesTable.name })
      .from(spacesTable).where(eq(spacesTable.id, sid));
    for (const s of rows) spaceMap[s.id] = s.name;
  }

  const promoIds = [...new Set(products.map(p => p.promotion_id).filter(Boolean))] as number[];
  const promoMap: Record<number, { name: string; discount_percentage: number | null }> = {};
  for (const pid of promoIds) {
    const rows = await db.select({ id: promotionsTable.id, name: promotionsTable.name, discount_percentage: promotionsTable.discount_percentage })
      .from(promotionsTable).where(eq(promotionsTable.id, pid));
    for (const p of rows) promoMap[p.id] = { name: p.name, discount_percentage: p.discount_percentage };
  }

  return products.map(p => {
    const promo = p.promotion_id ? promoMap[p.promotion_id] : null;
    const disc = promo?.discount_percentage ?? 0;
    const effective_weekly_rate = p.weekly_rate != null ? parseFloat((p.weekly_rate * (1 - disc / 100)).toFixed(2)) : null;
    return {
      ...p,
      space_name: p.space_id ? (spaceMap[p.space_id] ?? null) : null,
      promotion_name: promo ? promo.name : null,
      effective_weekly_rate,
    };
  });
}

router.get("/v1/contract-products", async (req, res): Promise<void> => {
  const { q, status, product_type, space_id, promotion_id, term_type } = req.query as Record<string, string>;
  const conditions: any[] = [isNull(contractProductsTable.deleted_at)];
  if (q) conditions.push(ilike(contractProductsTable.name, `%${q}%`));
  if (status) conditions.push(eq(contractProductsTable.status, status));
  if (product_type) conditions.push(eq(contractProductsTable.product_type, product_type));
  if (space_id) conditions.push(eq(contractProductsTable.space_id, Number(space_id)));
  if (promotion_id) conditions.push(eq(contractProductsTable.promotion_id, Number(promotion_id)));
  if (term_type) conditions.push(eq(contractProductsTable.term_type, term_type));
  const rows = await db.select().from(contractProductsTable)
    .where(and(...conditions))
    .orderBy(contractProductsTable.name);
  const result = await enrich(rows);
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
    promotion_id: data.promotion_id ?? null,
    term_type: data.term_type ?? null,
    weekly_rate: data.weekly_rate ?? null,
    monthly_rate: data.monthly_rate ?? null,
    effective_weekly_rate: data.effective_weekly_rate ?? null,
    currency: data.currency ?? "AUD",
    billing_frequency: data.billing_frequency ?? null,
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
  const [result] = await enrich([row]);
  res.status(201).json(result);
});

router.get("/v1/contract-products/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const [row] = await db.select().from(contractProductsTable).where(eq(contractProductsTable.id, id));
  if (!row) { res.status(404).json({ error: "NOT_FOUND" }); return; }
  const [result] = await enrich([row]);
  res.json(result);
});

router.put("/v1/contract-products/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const data = req.body;
  const [row] = await db.update(contractProductsTable).set({
    name: data.name,
    description: data.description ?? null,
    product_type: data.product_type,
    status: data.status ?? "Draft",
    space_id: data.space_id ?? null,
    promotion_id: data.promotion_id ?? null,
    term_type: data.term_type ?? null,
    weekly_rate: data.weekly_rate ?? null,
    monthly_rate: data.monthly_rate ?? null,
    effective_weekly_rate: data.effective_weekly_rate ?? null,
    currency: data.currency ?? "AUD",
    billing_frequency: data.billing_frequency ?? null,
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
    updated_at: new Date(),
  }).where(eq(contractProductsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "NOT_FOUND" }); return; }
  const [result] = await enrich([row]);
  res.json(result);
});

router.post("/v1/contract-products/bulk-delete", async (req, res): Promise<void> => {
  const currentUser = (req as any).user;
  if (currentUser?.role !== "SuperAdmin") {
    res.status(403).json({ error: "Only SuperAdmin can perform bulk delete" }); return;
  }
  const { ids, permanent } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "ids must be a non-empty array" }); return;
  }
  const numIds = ids.map(Number).filter(Boolean);
  if (permanent) {
    await db.delete(contractProductsTable).where(inArray(contractProductsTable.id, numIds));
  } else {
    await db.update(contractProductsTable).set({ deleted_at: new Date(), status: "Archived", updated_at: new Date() }).where(inArray(contractProductsTable.id, numIds));
  }
  res.json({ success: true, affected: numIds.length });
});

router.delete("/v1/contract-products/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const currentUser = (req as any).user;
  const permanent = req.query.permanent === "true";
  if (permanent) {
    if (currentUser?.role !== "SuperAdmin") {
      res.status(403).json({ error: "Only SuperAdmin can permanently delete records" }); return;
    }
    await db.delete(contractProductsTable).where(eq(contractProductsTable.id, id));
  } else {
    await db.update(contractProductsTable)
      .set({ deleted_at: new Date(), status: "Archived", updated_at: new Date() })
      .where(eq(contractProductsTable.id, id));
  }
  res.status(204).send();
});

router.post("/v1/contract-products/:id/activate", async (req, res): Promise<void> => {
  const [row] = await db.update(contractProductsTable).set({ status: "Active", updated_at: new Date() })
    .where(eq(contractProductsTable.id, Number(req.params.id))).returning();
  if (!row) { res.status(404).json({ error: "NOT_FOUND" }); return; }
  const [result] = await enrich([row]);
  res.json(result);
});

router.post("/v1/contract-products/:id/deactivate", async (req, res): Promise<void> => {
  const [row] = await db.update(contractProductsTable).set({ status: "Inactive", updated_at: new Date() })
    .where(eq(contractProductsTable.id, Number(req.params.id))).returning();
  if (!row) { res.status(404).json({ error: "NOT_FOUND" }); return; }
  const [result] = await enrich([row]);
  res.json(result);
});

router.post("/v1/contract-products/:id/archive", async (req, res): Promise<void> => {
  const [row] = await db.update(contractProductsTable).set({ status: "Archived", updated_at: new Date() })
    .where(eq(contractProductsTable.id, Number(req.params.id))).returning();
  if (!row) { res.status(404).json({ error: "NOT_FOUND" }); return; }
  const [result] = await enrich([row]);
  res.json(result);
});

router.get("/v1/lookup/contract-products", async (req, res): Promise<void> => {
  const { q, space_id } = req.query as Record<string, string>;
  const conditions = [];
  if (q) conditions.push(ilike(contractProductsTable.name, `%${q}%`));
  if (space_id) conditions.push(eq(contractProductsTable.space_id, Number(space_id)));
  const rows = await db.select({
    id: contractProductsTable.id,
    name: contractProductsTable.name,
    product_type: contractProductsTable.product_type,
    term_type: contractProductsTable.term_type,
  })
    .from(contractProductsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(contractProductsTable.name)
    .limit(30);
  res.json(rows.map(r => ({ id: r.id, display: `${r.name}${r.term_type ? ` [${r.term_type}]` : ''} (${r.product_type})` })));
});

export default router;
