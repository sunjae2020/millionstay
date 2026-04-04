import { Router, type IRouter } from "express";
import { eq, ilike, and, SQL } from "drizzle-orm";
import { db, commissionsTable } from "@workspace/db";
import {
  ListCommissionsQueryParams,
  CreateCommissionBody,
  GetCommissionParams,
  UpdateCommissionParams,
  UpdateCommissionBody,
  DeleteCommissionParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/v1/commissions", async (req, res): Promise<void> => {
  const parsed = ListCommissionsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { search, status } = parsed.data;
  const conditions: SQL[] = [];
  if (status) conditions.push(eq(commissionsTable.status, status));
  if (search) conditions.push(ilike(commissionsTable.name, `%${search}%`));
  const rows = await db.select().from(commissionsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(commissionsTable.name);
  res.json(rows);
});

router.post("/v1/commissions", async (req, res): Promise<void> => {
  const parsed = CreateCommissionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(commissionsTable).values(parsed.data).returning();
  res.status(201).json(row);
});

router.get("/v1/commissions/:id", async (req, res): Promise<void> => {
  const parsed = GetCommissionParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.select().from(commissionsTable).where(eq(commissionsTable.id, parsed.data.id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.put("/v1/commissions/:id", async (req, res): Promise<void> => {
  const paramsParsed = UpdateCommissionParams.safeParse(req.params);
  if (!paramsParsed.success) { res.status(400).json({ error: paramsParsed.error.message }); return; }
  const bodyParsed = UpdateCommissionBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const [row] = await db.update(commissionsTable)
    .set({ ...bodyParsed.data, updated_at: new Date() })
    .where(eq(commissionsTable.id, paramsParsed.data.id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.delete("/v1/commissions/:id", async (req, res): Promise<void> => {
  const parsed = DeleteCommissionParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  await db.delete(commissionsTable).where(eq(commissionsTable.id, parsed.data.id));
  res.status(204).end();
});

export default router;
