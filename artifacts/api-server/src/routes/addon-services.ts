import { Router, type IRouter } from "express";
import { eq, ilike, asc, isNull, inArray, and } from "drizzle-orm";
import { db, addonServicesTable } from "@workspace/db";
import { deletedFilter, makeBulkDelete, makeBulkRestore } from "../lib/softDelete";

const router: IRouter = Router();

// Whitelist of columns the client may set, so we never trust the raw body.
function pickFields(body: any) {
  const out: Record<string, unknown> = {};
  for (const k of ["code", "name", "description", "category", "base_price", "currency", "unit", "is_active", "sort_order"]) {
    if (body[k] !== undefined) out[k] = body[k];
  }
  return out;
}

router.get("/v1/addon-services", async (req, res): Promise<void> => {
  try {
    const { q } = req.query as Record<string, string>;
    const rows = await db
      .select()
      .from(addonServicesTable)
      .where(and(deletedFilter(addonServicesTable.deleted_at, req), q ? ilike(addonServicesTable.name, `%${q}%`) : undefined))
      .orderBy(asc(addonServicesTable.sort_order), asc(addonServicesTable.name));
    res.json({ success: true, data: rows, meta: { total: rows.length } });
  } catch {
    res.status(500).json({ error: "Failed to list add-on services" });
  }
});

router.get("/v1/addon-services/:id", async (req, res): Promise<void> => {
  try {
    const [row] = await db.select().from(addonServicesTable).where(eq(addonServicesTable.id, Number(req.params.id)));
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch {
    res.status(500).json({ error: "Failed to get add-on service" });
  }
});

router.post("/v1/addon-services", async (req, res): Promise<void> => {
  try {
    const fields = pickFields(req.body);
    if (!fields.name) { res.status(400).json({ error: "name is required" }); return; }
    if (!fields.code) { res.status(400).json({ error: "code is required" }); return; }
    const [row] = await db.insert(addonServicesTable).values(fields as any).returning();
    res.status(201).json(row);
  } catch (err: any) {
    if (err?.code === "23505") { res.status(409).json({ error: "Code already exists" }); return; }
    res.status(500).json({ error: "Failed to create add-on service" });
  }
});

router.put("/v1/addon-services/:id", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const updates = pickFields(req.body);
    const [row] = await db.update(addonServicesTable).set(updates).where(eq(addonServicesTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch (err: any) {
    if (err?.code === "23505") { res.status(409).json({ error: "Code already exists" }); return; }
    res.status(500).json({ error: "Failed to update add-on service" });
  }
});

const addonServicesSoftDelete = {
  table: addonServicesTable,
  idColumn: addonServicesTable.id,
};

router.post("/v1/addon-services/bulk-delete", makeBulkDelete(addonServicesSoftDelete));
router.post("/v1/addon-services/bulk-restore", makeBulkRestore(addonServicesSoftDelete));

router.delete("/v1/addon-services/:id", async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const currentUser = (req as any).user;
    const permanent = req.query.permanent === "true";
    if (permanent) {
      if (currentUser?.role !== "SuperAdmin") {
        res.status(403).json({ error: "Only SuperAdmin can permanently delete records" }); return;
      }
      const [row] = await db.delete(addonServicesTable).where(eq(addonServicesTable.id, id)).returning();
      if (!row) { res.status(404).json({ error: "Not found" }); return; }
    } else {
      const [row] = await db.update(addonServicesTable)
        .set({ deleted_at: new Date() })
        .where(eq(addonServicesTable.id, id)).returning();
      if (!row) { res.status(404).json({ error: "Not found" }); return; }
    }
    res.status(204).end();
  } catch {
    res.status(500).json({ error: "Failed to delete add-on service" });
  }
});

export default router;
