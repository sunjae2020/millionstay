import { Router, type IRouter } from "express";
import { eq, ilike, asc } from "drizzle-orm";
import { db, productGroupsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/v1/product-groups", async (req, res): Promise<void> => {
  try {
    const { q } = req.query as Record<string, string>;
    const rows = await db
      .select()
      .from(productGroupsTable)
      .where(q ? ilike(productGroupsTable.name, `%${q}%`) : undefined)
      .orderBy(asc(productGroupsTable.display_order), asc(productGroupsTable.name));
    res.json({ success: true, data: rows, meta: { total: rows.length } });
  } catch {
    res.status(500).json({ error: "Failed to list product groups" });
  }
});

router.get("/v1/product-groups/:id", async (req, res): Promise<void> => {
  try {
    const [row] = await db.select().from(productGroupsTable).where(eq(productGroupsTable.id, Number(req.params.id)));
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch {
    res.status(500).json({ error: "Failed to get product group" });
  }
});

router.post("/v1/product-groups", async (req, res): Promise<void> => {
  try {
    const { name, display_order } = req.body;
    if (!name) { res.status(400).json({ error: "name is required" }); return; }
    const [row] = await db.insert(productGroupsTable).values({ name, display_order: display_order ?? 0 }).returning();
    res.status(201).json(row);
  } catch (err: any) {
    if (err?.code === "23505") { res.status(409).json({ error: "Name already exists" }); return; }
    res.status(500).json({ error: "Failed to create product group" });
  }
});

router.put("/v1/product-groups/:id", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { id: _id, created_at, ...updates } = req.body;
    const [row] = await db.update(productGroupsTable).set(updates).where(eq(productGroupsTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch (err: any) {
    if (err?.code === "23505") { res.status(409).json({ error: "Name already exists" }); return; }
    res.status(500).json({ error: "Failed to update product group" });
  }
});

router.delete("/v1/product-groups/:id", async (req, res): Promise<void> => {
  try {
    const [row] = await db.delete(productGroupsTable).where(eq(productGroupsTable.id, Number(req.params.id))).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete product group" });
  }
});

export default router;
