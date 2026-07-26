import { Router, type IRouter } from "express";
import { eq, ilike, asc, isNull, inArray, and } from "drizzle-orm";
import { db, productTypesTable } from "@workspace/db";
import { deletedFilter, makeBulkDelete, makeBulkRestore } from "../lib/softDelete";

const router: IRouter = Router();

router.get("/v1/product-types", async (req, res): Promise<void> => {
  try {
    const { q } = req.query as Record<string, string>;
    const rows = await db
      .select()
      .from(productTypesTable)
      .where(and(deletedFilter(productTypesTable.deleted_at, req), q ? ilike(productTypesTable.name, `%${q}%`) : undefined))
      .orderBy(asc(productTypesTable.name));
    res.json({ success: true, data: rows, meta: { total: rows.length } });
  } catch {
    res.status(500).json({ error: "Failed to list product types" });
  }
});

router.get("/v1/product-types/:id", async (req, res): Promise<void> => {
  try {
    const [row] = await db.select().from(productTypesTable).where(eq(productTypesTable.id, Number(req.params.id)));
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch {
    res.status(500).json({ error: "Failed to get product type" });
  }
});

router.post("/v1/product-types", async (req, res): Promise<void> => {
  try {
    const { name, description } = req.body;
    if (!name) { res.status(400).json({ error: "name is required" }); return; }
    const [row] = await db.insert(productTypesTable).values({ name, description }).returning();
    res.status(201).json(row);
  } catch (err: any) {
    if (err?.code === "23505") { res.status(409).json({ error: "Name already exists" }); return; }
    res.status(500).json({ error: "Failed to create product type" });
  }
});

router.put("/v1/product-types/:id", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { id: _id, created_at, deleted_at, ...updates } = req.body;
    const [row] = await db.update(productTypesTable).set(updates).where(eq(productTypesTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch (err: any) {
    if (err?.code === "23505") { res.status(409).json({ error: "Name already exists" }); return; }
    res.status(500).json({ error: "Failed to update product type" });
  }
});

const productTypesSoftDelete = {
  table: productTypesTable,
  idColumn: productTypesTable.id,
};

router.post("/v1/product-types/bulk-delete", makeBulkDelete(productTypesSoftDelete));
router.post("/v1/product-types/bulk-restore", makeBulkRestore(productTypesSoftDelete));

router.delete("/v1/product-types/:id", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const currentUser = (req as any).user;
    const permanent = req.query.permanent === "true";
    if (permanent) {
      if (currentUser?.role !== "SuperAdmin") {
        res.status(403).json({ error: "Only SuperAdmin can permanently delete records" }); return;
      }
      const [row] = await db.delete(productTypesTable).where(eq(productTypesTable.id, id)).returning();
      if (!row) { res.status(404).json({ error: "Not found" }); return; }
    } else {
      const [row] = await db.update(productTypesTable)
        .set({ deleted_at: new Date() })
        .where(eq(productTypesTable.id, id)).returning();
      if (!row) { res.status(404).json({ error: "Not found" }); return; }
    }
    res.status(204).end();
  } catch {
    res.status(500).json({ error: "Failed to delete product type" });
  }
});

export default router;
