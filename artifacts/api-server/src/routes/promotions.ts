import { Router, type IRouter } from "express";
import { eq, ilike, and, isNull, inArray, SQL } from "drizzle-orm";
import { db, promotionsTable, accommodationCatalogTable, serviceCatalogTable } from "@workspace/db";
import { deletedFilter, makeBulkDelete, makeBulkRestore } from "../lib/softDelete";
import * as z from "zod/v4";

const ListPromotionsQueryParams = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  promotion_type: z.string().optional(),
});

const CreatePromotionBody = z.object({
  name: z.string(),
  code: z.string().optional().nullable(),
  term_type: z.string().optional().nullable(),
  promotion_type: z.string().optional().nullable(),
  discount_percentage: z.coerce.number().optional().nullable(),
  discount_amount: z.coerce.number().optional().nullable(),
  free_nights: z.coerce.number().int().optional().nullable(),
  min_stay_weeks: z.coerce.number().int().optional().nullable(),
  max_stay_weeks: z.coerce.number().int().optional().nullable(),
  min_stay_nights: z.coerce.number().int().optional().nullable(),
  billing_frequency: z.string().optional().nullable(),
  max_uses: z.coerce.number().int().optional().nullable(),
  max_uses_per_account: z.coerce.number().int().optional().nullable(),
  applicable_to: z.string().optional().nullable(),
  valid_from: z.string().optional().nullable(),
  valid_to: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  status: z.string().optional().default("Draft"),
});

const GetPromotionParams = z.object({ id: z.coerce.number().int() });
const UpdatePromotionParams = z.object({ id: z.coerce.number().int() });
const UpdatePromotionBody = CreatePromotionBody.partial();
const DeletePromotionParams = z.object({ id: z.coerce.number().int() });

import { keywordCondition } from "../lib/listSearch";
const router: IRouter = Router();

router.get("/v1/promotions", async (req, res): Promise<void> => {
  const parsed = ListPromotionsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { search, status, promotion_type } = parsed.data;
  const conditions: SQL[] = [deletedFilter(promotionsTable.deleted_at, req)];
  if (status) conditions.push(eq(promotionsTable.status, status));
  if (promotion_type) conditions.push(eq(promotionsTable.promotion_type, promotion_type));
  // 프로모션 코드로 찾는 경우가 많다.
  if (search) conditions.push(keywordCondition(search, [promotionsTable.name, promotionsTable.code, promotionsTable.description]));
  const rows = await db.select().from(promotionsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(promotionsTable.name);
  res.json(rows);
});

router.post("/v1/promotions", async (req, res): Promise<void> => {
  const parsed = CreatePromotionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const d = parsed.data;
  const [row] = await db.insert(promotionsTable).values({
    ...d,
    // numeric(10,2) column — Drizzle expects a string
    discount_amount: d.discount_amount != null ? String(d.discount_amount) : d.discount_amount,
    // notNull columns with DB defaults — the generated zod allows null; coerce to undefined to use the default
    term_type: d.term_type ?? undefined,
    promotion_type: d.promotion_type ?? undefined,
    status: d.status ?? undefined,
  }).returning();
  res.status(201).json(row);
});

router.get("/v1/promotions/:id", async (req, res): Promise<void> => {
  const parsed = GetPromotionParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.select().from(promotionsTable).where(eq(promotionsTable.id, parsed.data.id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.put("/v1/promotions/:id", async (req, res): Promise<void> => {
  const paramsParsed = UpdatePromotionParams.safeParse(req.params);
  if (!paramsParsed.success) { res.status(400).json({ error: paramsParsed.error.message }); return; }
  const bodyParsed = UpdatePromotionBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const b = bodyParsed.data;
  const [row] = await db.update(promotionsTable)
    .set({
      ...b,
      // numeric(10,2) column — Drizzle expects a string
      discount_amount: b.discount_amount != null ? String(b.discount_amount) : b.discount_amount,
      // notNull columns — coerce null to undefined so an explicit null can't violate the constraint
      term_type: b.term_type ?? undefined,
      promotion_type: b.promotion_type ?? undefined,
      status: b.status ?? undefined,
      updated_at: new Date(),
    })
    .where(eq(promotionsTable.id, paramsParsed.data.id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

const promotionsSoftDelete = {
  table: promotionsTable,
  idColumn: promotionsTable.id,
  statusKey: "status",
  archivedStatus: "Archived",
  restoredStatus: "Active",
};

router.post("/v1/promotions/bulk-delete", makeBulkDelete(promotionsSoftDelete));
router.post("/v1/promotions/bulk-restore", makeBulkRestore(promotionsSoftDelete));

router.delete("/v1/promotions/:id", async (req, res): Promise<void> => {
  const parsed = DeletePromotionParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const currentUser = (req as any).user;
  const permanent = req.query.permanent === "true";
  if (permanent) {
    if (currentUser?.role !== "SuperAdmin") {
      res.status(403).json({ error: "Only SuperAdmin can permanently delete records" }); return;
    }
    await db.delete(promotionsTable).where(eq(promotionsTable.id, parsed.data.id));
  } else {
    await db.update(promotionsTable).set({ deleted_at: new Date(), status: "Archived" }).where(eq(promotionsTable.id, parsed.data.id));
  }
  res.status(204).end();
});

/* GET /v1/promotions/:id/associated-products
   Returns accommodation + service products that have this promotion_id */
router.get("/v1/promotions/:id/associated-products", async (req, res): Promise<void> => {
  const parsed = GetPromotionParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const promoId = parsed.data.id;
  try {
    const [accommodations, services] = await Promise.all([
      db.select({
        id: accommodationCatalogTable.id,
        name: accommodationCatalogTable.name,
        status: accommodationCatalogTable.status,
        price: accommodationCatalogTable.price,
        currency: accommodationCatalogTable.currency,
        min_contract_period: accommodationCatalogTable.min_contract_period,
        min_contract_period_unit: accommodationCatalogTable.min_contract_period_unit,
      })
        .from(accommodationCatalogTable)
        .where(eq(accommodationCatalogTable.promotion_id, promoId))
        .orderBy(accommodationCatalogTable.name),
      db.select({
        id: serviceCatalogTable.id,
        name: serviceCatalogTable.name,
        status: serviceCatalogTable.status,
        base_price: serviceCatalogTable.base_price,
        currency: serviceCatalogTable.currency,
        service_type: serviceCatalogTable.service_type,
      })
        .from(serviceCatalogTable)
        .where(eq(serviceCatalogTable.promotion_id, promoId))
        .orderBy(serviceCatalogTable.name),
    ]);
    res.json({ success: true, data: { accommodations, services } });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch associated products" });
  }
});

router.get("/v1/lookup/promotions", async (req, res): Promise<void> => {
  const { q, term_type } = req.query as Record<string, string>;
  const conditions: SQL[] = [];
  if (q) conditions.push(ilike(promotionsTable.name, `%${q}%`));
  if (term_type) conditions.push(eq(promotionsTable.term_type, term_type));
  const rows = await db.select({
    id: promotionsTable.id,
    name: promotionsTable.name,
    term_type: promotionsTable.term_type,
    discount_percentage: promotionsTable.discount_percentage,
    valid_from: promotionsTable.valid_from,
    valid_to: promotionsTable.valid_to,
  })
    .from(promotionsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(promotionsTable.name)
    .limit(30);
  res.json(rows.map(r => ({
    id: r.id,
    display: `${r.name}${r.term_type ? ` [${r.term_type}]` : ""}${r.discount_percentage ? ` ${r.discount_percentage}%` : ""}`,
    valid_from: r.valid_from,
    valid_to: r.valid_to,
  })));
});

export default router;
