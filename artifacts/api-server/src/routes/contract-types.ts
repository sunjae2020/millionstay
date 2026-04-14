import { Router, type IRouter } from "express";
import { eq, ilike, and, sql, isNull, inArray, SQL } from "drizzle-orm";
import { db, contractTypesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/v1/contract-types", async (req, res): Promise<void> => {
  try {
    const { q, is_active } = req.query as Record<string, string>;
    const conditions: SQL[] = [isNull(contractTypesTable.deleted_at)];
    if (q) conditions.push(ilike(contractTypesTable.name, `%${q}%`));
    if (is_active === "true") conditions.push(eq(contractTypesTable.is_active, true));
    if (is_active === "false") conditions.push(eq(contractTypesTable.is_active, false));

    const rows = await db
      .select()
      .from(contractTypesTable)
      .where(and(...conditions))
      .orderBy(contractTypesTable.name);

    res.json({ success: true, data: rows, meta: { total: rows.length } });
  } catch (err) {
    res.status(500).json({ error: "Failed to list contract types" });
  }
});

router.get("/v1/contract-types/:id", async (req, res): Promise<void> => {
  try {
    const [row] = await db.select().from(contractTypesTable).where(eq(contractTypesTable.id, Number(req.params.id)));
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed to get contract type" });
  }
});

router.post("/v1/contract-types", async (req, res): Promise<void> => {
  try {
    const { name, description, contract_security, require_passport, require_visa, require_enrollment } = req.body;
    if (!name) { res.status(400).json({ error: "name is required" }); return; }
    const [row] = await db.insert(contractTypesTable).values({
      name, description, contract_security, require_passport, require_visa, require_enrollment,
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create contract type" });
  }
});

router.put("/v1/contract-types/:id", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { id: _id, created_at, ...updates } = req.body;
    const [row] = await db.update(contractTypesTable).set(updates).where(eq(contractTypesTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed to update contract type" });
  }
});

router.patch("/v1/contract-types/:id/deactivate", async (req, res): Promise<void> => {
  try {
    const [row] = await db.update(contractTypesTable).set({ is_active: false }).where(eq(contractTypesTable.id, Number(req.params.id))).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed to deactivate" });
  }
});

router.post("/v1/contract-types/bulk-delete", async (req, res): Promise<void> => {
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
    await db.delete(contractTypesTable).where(inArray(contractTypesTable.id, numIds));
  } else {
    await db.update(contractTypesTable).set({ deleted_at: new Date() }).where(inArray(contractTypesTable.id, numIds));
  }
  res.json({ success: true, affected: numIds.length });
});

router.delete("/v1/contract-types/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const currentUser = (req as any).user;
  const permanent = req.query.permanent === "true";
  if (permanent) {
    if (currentUser?.role !== "SuperAdmin") {
      res.status(403).json({ error: "Only SuperAdmin can permanently delete records" }); return;
    }
    await db.delete(contractTypesTable).where(eq(contractTypesTable.id, id));
  } else {
    await db.update(contractTypesTable).set({ deleted_at: new Date() }).where(eq(contractTypesTable.id, id));
  }
  res.status(204).end();
});

export default router;
