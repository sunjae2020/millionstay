import { Router, type IRouter } from "express";
import { eq, ilike, and, sql, SQL } from "drizzle-orm";
import { db, contractTypesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/v1/contract-types", async (req, res): Promise<void> => {
  try {
    const { q, is_active } = req.query as Record<string, string>;
    const conditions: SQL[] = [];
    if (q) conditions.push(ilike(contractTypesTable.name, `%${q}%`));
    if (is_active === "true") conditions.push(eq(contractTypesTable.is_active, true));
    if (is_active === "false") conditions.push(eq(contractTypesTable.is_active, false));

    const rows = await db
      .select()
      .from(contractTypesTable)
      .where(conditions.length ? and(...conditions) : undefined)
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

export default router;
