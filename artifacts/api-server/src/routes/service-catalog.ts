import { Router, type IRouter } from "express";
import { eq, ilike, and, sql, SQL, asc } from "drizzle-orm";
import { db, serviceCatalogTable } from "@workspace/db";

const router: IRouter = Router();

/* ── GET /v1/services ──────────────────────────────────── */
router.get("/v1/services", async (req, res): Promise<void> => {
  try {
    const { q, service_type, status, limit = "100", offset = "0" } = req.query as Record<string, string>;

    const conditions: SQL[] = [];
    if (q) conditions.push(ilike(serviceCatalogTable.name, `%${q}%`));
    if (service_type) conditions.push(eq(serviceCatalogTable.service_type, service_type));
    if (status) conditions.push(eq(serviceCatalogTable.status, status));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ count }]] = await Promise.all([
      db.select().from(serviceCatalogTable).where(where)
        .orderBy(asc(serviceCatalogTable.sort_order), asc(serviceCatalogTable.name))
        .limit(Number(limit)).offset(Number(offset)),
      db.select({ count: sql<number>`count(*)::int` }).from(serviceCatalogTable).where(where),
    ]);

    res.json({ success: true, data: rows, meta: { total: count, limit: Number(limit), offset: Number(offset) } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to list services" });
  }
});

/* ── GET /v1/services/:id ──────────────────────────────── */
router.get("/v1/services/:id", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const [row] = await db.select().from(serviceCatalogTable).where(eq(serviceCatalogTable.id, id));
    if (!row) { res.status(404).json({ error: "Service not found" }); return; }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed to get service" });
  }
});

/* ── POST /v1/services ─────────────────────────────────── */
router.post("/v1/services", async (req, res): Promise<void> => {
  try {
    const { name, service_type, ...rest } = req.body;
    if (!name) { res.status(400).json({ error: "name is required" }); return; }
    if (!service_type) { res.status(400).json({ error: "service_type is required" }); return; }
    const [row] = await db.insert(serviceCatalogTable).values({ name, service_type, ...rest }).returning();
    res.status(201).json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create service" });
  }
});

/* ── PUT /v1/services/:id ──────────────────────────────── */
router.put("/v1/services/:id", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const { id: _id, created_at, ...updates } = req.body;
    const [row] = await db.update(serviceCatalogTable).set(updates).where(eq(serviceCatalogTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: "Failed to update service" });
  }
});

/* ── DELETE /v1/services/:id ───────────────────────────── */
router.delete("/v1/services/:id", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    await db.update(serviceCatalogTable).set({ status: "Archived" }).where(eq(serviceCatalogTable.id, id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to archive service" });
  }
});

export default router;
