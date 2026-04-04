import { Router, type IRouter } from "express";
import { eq, ilike, and, or, SQL } from "drizzle-orm";
import { db, suburbsTable } from "@workspace/db";
import {
  ListSuburbsQueryParams,
  CreateSuburbBody,
  GetSuburbParams,
  GetSuburbResponse,
  UpdateSuburbParams,
  UpdateSuburbBody,
  UpdateSuburbResponse,
  DeleteSuburbParams,
  ListSuburbsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/v1/suburbs", async (req, res): Promise<void> => {
  const parsed = ListSuburbsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { country_code, state, search } = parsed.data;

  const conditions: SQL[] = [];
  if (country_code) conditions.push(eq(suburbsTable.country_code, country_code));
  if (state) conditions.push(eq(suburbsTable.state, state));
  if (search) {
    conditions.push(
      or(
        ilike(suburbsTable.name, `%${search}%`),
        ilike(suburbsTable.area_name, `%${search}%`)
      ) as SQL
    );
  }

  const suburbs = await db
    .select()
    .from(suburbsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(suburbsTable.created_at);

  res.json(ListSuburbsResponse.parse(suburbs));
});

router.post("/v1/suburbs", async (req, res): Promise<void> => {
  const parsed = CreateSuburbBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [suburb] = await db.insert(suburbsTable).values(parsed.data).returning();
  res.status(201).json(GetSuburbResponse.parse(suburb));
});

router.get("/v1/suburbs/:id", async (req, res): Promise<void> => {
  const params = GetSuburbParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [suburb] = await db
    .select()
    .from(suburbsTable)
    .where(eq(suburbsTable.id, params.data.id));

  if (!suburb) {
    res.status(404).json({ error: "Suburb not found" });
    return;
  }

  res.json(GetSuburbResponse.parse(suburb));
});

router.put("/v1/suburbs/:id", async (req, res): Promise<void> => {
  const params = UpdateSuburbParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateSuburbBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [suburb] = await db
    .update(suburbsTable)
    .set({ ...parsed.data, updated_at: new Date() })
    .where(eq(suburbsTable.id, params.data.id))
    .returning();

  if (!suburb) {
    res.status(404).json({ error: "Suburb not found" });
    return;
  }

  res.json(UpdateSuburbResponse.parse(suburb));
});

router.delete("/v1/suburbs/:id", async (req, res): Promise<void> => {
  const params = DeleteSuburbParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [suburb] = await db
    .delete(suburbsTable)
    .where(eq(suburbsTable.id, params.data.id))
    .returning();

  if (!suburb) {
    res.status(404).json({ error: "Suburb not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
