import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, blogCategoriesTable } from "@workspace/db";
import * as z from "zod/v4";

// Admin-managed blog category list. Mounted under the authenticated /api/v1
// space (see routes/index.ts → app.ts requireAuth). The public read counterpart
// lives in routes/public.ts.

const CreateBody = z.object({
  name: z.string().min(1).max(60),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
});
const UpdateBody = z.object({
  name: z.string().min(1).max(60).optional(),
  sort_order: z.number().int().optional(),
  is_active: z.boolean().optional(),
});
const IdParams = z.object({ id: z.coerce.number().int() });

const router: IRouter = Router();

router.get("/v1/blog-categories", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(blogCategoriesTable)
    .orderBy(asc(blogCategoriesTable.sort_order), asc(blogCategoriesTable.name));
  res.json({ data: rows });
});

router.post("/v1/blog-categories", async (req, res): Promise<void> => {
  const parsed = CreateBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  try {
    const [row] = await db.insert(blogCategoriesTable).values(parsed.data).returning();
    res.status(201).json(row);
  } catch (err: any) {
    if (err?.code === "23505") { res.status(409).json({ error: "A category with that name already exists." }); return; }
    res.status(500).json({ error: "Failed to create category" });
  }
});

router.put("/v1/blog-categories/:id", async (req, res): Promise<void> => {
  const p = IdParams.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  const b = UpdateBody.safeParse(req.body);
  if (!b.success) { res.status(400).json({ error: b.error.message }); return; }
  try {
    const [row] = await db
      .update(blogCategoriesTable)
      .set({ ...b.data, updated_at: new Date() })
      .where(eq(blogCategoriesTable.id, p.data.id))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch (err: any) {
    if (err?.code === "23505") { res.status(409).json({ error: "A category with that name already exists." }); return; }
    res.status(500).json({ error: "Failed to update category" });
  }
});

router.delete("/v1/blog-categories/:id", async (req, res): Promise<void> => {
  const p = IdParams.safeParse(req.params);
  if (!p.success) { res.status(400).json({ error: p.error.message }); return; }
  await db.delete(blogCategoriesTable).where(eq(blogCategoriesTable.id, p.data.id));
  res.status(204).end();
});

export default router;
