import { Router, type IRouter } from "express";
import { eq, ilike, and, isNull, inArray, SQL } from "drizzle-orm";
import { db, spaceOptionsTable } from "@workspace/db";
import { deletedFilter, makeBulkDelete, makeBulkRestore } from "../lib/softDelete";
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

import { keywordCondition } from "../lib/listSearch";
const router: IRouter = Router();

router.get("/v1/space-options", async (req, res): Promise<void> => {
  const parsed = ListSpaceOptionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { search, category } = parsed.data;

  const conditions: SQL[] = [deletedFilter(spaceOptionsTable.deleted_at, req)];
  if (search) conditions.push(keywordCondition(search, [spaceOptionsTable.name, spaceOptionsTable.display_name]));
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

const spaceOptionsSoftDelete = {
  table: spaceOptionsTable,
  idColumn: spaceOptionsTable.id,
  statusKey: "status",
  archivedStatus: "Archived",
  restoredStatus: "Active",
};

router.post("/v1/space-options/bulk-delete", makeBulkDelete(spaceOptionsSoftDelete));
router.post("/v1/space-options/bulk-restore", makeBulkRestore(spaceOptionsSoftDelete));

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
