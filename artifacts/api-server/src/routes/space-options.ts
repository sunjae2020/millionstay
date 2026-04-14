import { Router, type IRouter } from "express";
import { eq, ilike, and, isNull, inArray, SQL } from "drizzle-orm";
import { db, spaceOptionsTable } from "@workspace/db";
import {
  ListSpaceOptionsQueryParams,
  CreateSpaceOptionBody,
  GetSpaceOptionParams,
  GetSpaceOptionResponse,
  UpdateSpaceOptionParams,
  UpdateSpaceOptionBody,
  UpdateSpaceOptionResponse,
  DeleteSpaceOptionParams,
  ListSpaceOptionsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/v1/space-options", async (req, res): Promise<void> => {
  const parsed = ListSpaceOptionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { search, category } = parsed.data;

  const conditions: SQL[] = [isNull(spaceOptionsTable.deleted_at)];
  if (search) conditions.push(ilike(spaceOptionsTable.name, `%${search}%`));
  if (category) conditions.push(eq(spaceOptionsTable.category, category));

  const options = await db
    .select()
    .from(spaceOptionsTable)
    .where(and(...conditions))
    .orderBy(spaceOptionsTable.created_at);

  res.json(ListSpaceOptionsResponse.parse(options));
});

router.post("/v1/space-options", async (req, res): Promise<void> => {
  const parsed = CreateSpaceOptionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [option] = await db.insert(spaceOptionsTable).values(parsed.data).returning();
  res.status(201).json(GetSpaceOptionResponse.parse(option));
});

router.get("/v1/space-options/:id", async (req, res): Promise<void> => {
  const params = GetSpaceOptionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [option] = await db
    .select()
    .from(spaceOptionsTable)
    .where(eq(spaceOptionsTable.id, params.data.id));

  if (!option) {
    res.status(404).json({ error: "Space option not found" });
    return;
  }

  res.json(GetSpaceOptionResponse.parse(option));
});

router.put("/v1/space-options/:id", async (req, res): Promise<void> => {
  const params = UpdateSpaceOptionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateSpaceOptionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [option] = await db
    .update(spaceOptionsTable)
    .set({ ...parsed.data, updated_at: new Date() })
    .where(eq(spaceOptionsTable.id, params.data.id))
    .returning();

  if (!option) {
    res.status(404).json({ error: "Space option not found" });
    return;
  }

  res.json(UpdateSpaceOptionResponse.parse(option));
});

router.post("/v1/space-options/bulk-delete", async (req, res): Promise<void> => {
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
    await db.delete(spaceOptionsTable).where(inArray(spaceOptionsTable.id, numIds));
  } else {
    await db.update(spaceOptionsTable).set({ deleted_at: new Date(), status: "Archived", updated_at: new Date() }).where(inArray(spaceOptionsTable.id, numIds));
  }
  res.json({ success: true, affected: numIds.length });
});

router.delete("/v1/space-options/:id", async (req, res): Promise<void> => {
  const params = DeleteSpaceOptionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const currentUser = (req as any).user;
  const permanent = req.query.permanent === "true";

  if (permanent) {
    if (currentUser?.role !== "SuperAdmin") {
      res.status(403).json({ error: "Only SuperAdmin can permanently delete records" }); return;
    }
    const [option] = await db.delete(spaceOptionsTable).where(eq(spaceOptionsTable.id, params.data.id)).returning();
    if (!option) { res.status(404).json({ error: "Space option not found" }); return; }
  } else {
    const [option] = await db.update(spaceOptionsTable)
      .set({ deleted_at: new Date(), status: "Archived", updated_at: new Date() })
      .where(eq(spaceOptionsTable.id, params.data.id))
      .returning();
    if (!option) { res.status(404).json({ error: "Space option not found" }); return; }
  }

  res.sendStatus(204);
});

export default router;
