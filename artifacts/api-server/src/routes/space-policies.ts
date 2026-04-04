import { Router, type IRouter } from "express";
import { eq, ilike, SQL } from "drizzle-orm";
import { db, spacePoliciesTable } from "@workspace/db";
import {
  ListSpacePoliciesQueryParams,
  CreateSpacePolicyBody,
  GetSpacePolicyParams,
  GetSpacePolicyResponse,
  UpdateSpacePolicyParams,
  UpdateSpacePolicyBody,
  UpdateSpacePolicyResponse,
  DeleteSpacePolicyParams,
  ListSpacePoliciesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/v1/space-policies", async (req, res): Promise<void> => {
  const parsed = ListSpacePoliciesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { search } = parsed.data;

  const condition: SQL | undefined = search
    ? ilike(spacePoliciesTable.name, `%${search}%`)
    : undefined;

  const policies = await db
    .select()
    .from(spacePoliciesTable)
    .where(condition)
    .orderBy(spacePoliciesTable.created_at);

  res.json(ListSpacePoliciesResponse.parse(policies));
});

router.post("/v1/space-policies", async (req, res): Promise<void> => {
  const parsed = CreateSpacePolicyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [policy] = await db.insert(spacePoliciesTable).values(parsed.data).returning();
  res.status(201).json(GetSpacePolicyResponse.parse(policy));
});

router.get("/v1/space-policies/:id", async (req, res): Promise<void> => {
  const params = GetSpacePolicyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [policy] = await db
    .select()
    .from(spacePoliciesTable)
    .where(eq(spacePoliciesTable.id, params.data.id));

  if (!policy) {
    res.status(404).json({ error: "Space policy not found" });
    return;
  }

  res.json(GetSpacePolicyResponse.parse(policy));
});

router.put("/v1/space-policies/:id", async (req, res): Promise<void> => {
  const params = UpdateSpacePolicyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateSpacePolicyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [policy] = await db
    .update(spacePoliciesTable)
    .set({ ...parsed.data, updated_at: new Date() })
    .where(eq(spacePoliciesTable.id, params.data.id))
    .returning();

  if (!policy) {
    res.status(404).json({ error: "Space policy not found" });
    return;
  }

  res.json(UpdateSpacePolicyResponse.parse(policy));
});

router.delete("/v1/space-policies/:id", async (req, res): Promise<void> => {
  const params = DeleteSpacePolicyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [policy] = await db
    .delete(spacePoliciesTable)
    .where(eq(spacePoliciesTable.id, params.data.id))
    .returning();

  if (!policy) {
    res.status(404).json({ error: "Space policy not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
