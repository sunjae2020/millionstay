import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, pageContentsTable } from "@workspace/db";
import * as z from "zod/v4";

const router: IRouter = Router();

const PageContentBody = z.object({
  content: z.record(z.string(), z.any()).optional(),
  seo_title: z.string().optional().nullable(),
  seo_description: z.string().optional().nullable(),
  seo_keywords: z.string().optional().nullable(),
});

// GET /api/v1/page-contents/:pageKey — get all languages for a page
router.get("/v1/page-contents/:pageKey", async (req, res): Promise<void> => {
  const { pageKey } = req.params;
  const rows = await db
    .select()
    .from(pageContentsTable)
    .where(eq(pageContentsTable.page_key, pageKey));
  res.json(rows);
});

// GET /api/v1/page-contents/:pageKey/:language — get one language
router.get("/v1/page-contents/:pageKey/:language", async (req, res): Promise<void> => {
  const { pageKey, language } = req.params;
  const [row] = await db
    .select()
    .from(pageContentsTable)
    .where(and(eq(pageContentsTable.page_key, pageKey), eq(pageContentsTable.language, language)));
  if (!row) {
    res.json({ page_key: pageKey, language, content: {}, seo_title: null, seo_description: null, seo_keywords: null });
    return;
  }
  res.json(row);
});

// PUT /api/v1/page-contents/:pageKey/:language — upsert
router.put("/v1/page-contents/:pageKey/:language", async (req, res): Promise<void> => {
  const { pageKey, language } = req.params;
  const parsed = PageContentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const data = parsed.data;

  const [existing] = await db
    .select({ id: pageContentsTable.id })
    .from(pageContentsTable)
    .where(and(eq(pageContentsTable.page_key, pageKey), eq(pageContentsTable.language, language)));

  if (existing) {
    const [updated] = await db
      .update(pageContentsTable)
      .set({ ...data, updated_at: new Date() })
      .where(eq(pageContentsTable.id, existing.id))
      .returning();
    res.json(updated);
  } else {
    const [created] = await db
      .insert(pageContentsTable)
      .values({ page_key: pageKey, language, ...data })
      .returning();
    res.json(created);
  }
});

export default router;
