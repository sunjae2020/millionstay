import { Router, type IRouter } from "express";
import { eq, ilike, and, SQL } from "drizzle-orm";
import { db, promotionsTable } from "@workspace/db";
import {
  ListPromotionsQueryParams,
  CreatePromotionBody,
  GetPromotionParams,
  UpdatePromotionParams,
  UpdatePromotionBody,
  DeletePromotionParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/v1/promotions", async (req, res): Promise<void> => {
  const parsed = ListPromotionsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { search, status, promotion_type } = parsed.data;
  const conditions: SQL[] = [];
  if (status) conditions.push(eq(promotionsTable.status, status));
  if (promotion_type) conditions.push(eq(promotionsTable.promotion_type, promotion_type));
  if (search) conditions.push(ilike(promotionsTable.name, `%${search}%`));
  const rows = await db.select().from(promotionsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(promotionsTable.name);
  res.json(rows);
});

router.post("/v1/promotions", async (req, res): Promise<void> => {
  const parsed = CreatePromotionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(promotionsTable).values(parsed.data).returning();
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
  const [row] = await db.update(promotionsTable)
    .set({ ...bodyParsed.data, updated_at: new Date() })
    .where(eq(promotionsTable.id, paramsParsed.data.id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/v1/promotions/:id", async (req, res): Promise<void> => {
  const parsed = DeletePromotionParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  await db.delete(promotionsTable).where(eq(promotionsTable.id, parsed.data.id));
  res.status(204).end();
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
  })
    .from(promotionsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(promotionsTable.name)
    .limit(30);
  res.json(rows.map(r => ({
    id: r.id,
    display: `${r.name}${r.term_type ? ` [${r.term_type}]` : ""}${r.discount_percentage ? ` ${r.discount_percentage}%` : ""}`,
  })));
});

export default router;
