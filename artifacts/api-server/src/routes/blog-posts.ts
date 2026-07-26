import { Router, type IRouter } from "express";
import { eq, ilike, and, isNull, inArray, desc, SQL } from "drizzle-orm";
import { db, blogPostsTable } from "@workspace/db";
import { deletedFilter, makeBulkDelete, makeBulkRestore } from "../lib/softDelete";
import * as z from "zod/v4";

const ListBlogPostsQuery = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  category: z.string().optional(),
});

const CreateBlogPostBody = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  excerpt: z.string().optional().nullable(),
  content: z.string().optional().nullable(),
  cover_image_url: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  author: z.string().optional().nullable(),
  status: z.string().optional().default("Draft"),
  published_at: z.string().optional().nullable(),
  seo_title: z.string().optional().nullable(),
  seo_description: z.string().optional().nullable(),
  seo_keywords: z.string().optional().nullable(),
});

const UpdateBlogPostBody = z.object({
  title: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  excerpt: z.string().optional().nullable(),
  content: z.string().optional().nullable(),
  cover_image_url: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  author: z.string().optional().nullable(),
  status: z.string().optional(),
  published_at: z.string().optional().nullable(),
  seo_title: z.string().optional().nullable(),
  seo_description: z.string().optional().nullable(),
  seo_keywords: z.string().optional().nullable(),
  translations: z.record(z.string(), z.any()).optional().nullable(),
});
const IdParams = z.object({ id: z.coerce.number().int() });

const router: IRouter = Router();

router.get("/v1/blog-posts", async (req, res): Promise<void> => {
  const parsed = ListBlogPostsQuery.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { search, status, category } = parsed.data;
  const conditions: SQL[] = [deletedFilter(blogPostsTable.deleted_at, req)];
  if (status) conditions.push(eq(blogPostsTable.status, status));
  if (category) conditions.push(eq(blogPostsTable.category, category));
  if (search) conditions.push(ilike(blogPostsTable.title, `%${search}%`));
  const rows = await db.select().from(blogPostsTable)
    .where(and(...conditions))
    .orderBy(desc(blogPostsTable.created_at));
  res.json({ data: rows });
});

router.post("/v1/blog-posts", async (req, res): Promise<void> => {
  const parsed = CreateBlogPostBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const data = {
    ...parsed.data,
    published_at: parsed.data.published_at ? new Date(parsed.data.published_at) : null,
  };
  try {
    const [row] = await db.insert(blogPostsTable).values(data).returning();
    res.status(201).json(row);
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ error: "Slug already exists. Please use a unique slug." });
    } else {
      res.status(500).json({ error: "Failed to create blog post" });
    }
  }
});

router.get("/v1/blog-posts/:id", async (req, res): Promise<void> => {
  const parsed = IdParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.id, parsed.data.id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.put("/v1/blog-posts/:id", async (req, res): Promise<void> => {
  const paramsParsed = IdParams.safeParse(req.params);
  if (!paramsParsed.success) { res.status(400).json({ error: paramsParsed.error.message }); return; }
  const bodyParsed = UpdateBlogPostBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const data: any = { ...bodyParsed.data, updated_at: new Date() };
  if (data.published_at) data.published_at = new Date(data.published_at);
  try {
    const [row] = await db.update(blogPostsTable)
      .set(data)
      .where(eq(blogPostsTable.id, paramsParsed.data.id))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ error: "Slug already exists. Please use a unique slug." });
    } else {
      res.status(500).json({ error: "Failed to update blog post" });
    }
  }
});

const blogPostsSoftDelete = {
  table: blogPostsTable,
  idColumn: blogPostsTable.id,
  statusKey: "status",
  archivedStatus: "Archived",
  restoredStatus: "Active",
};

router.post("/v1/blog-posts/bulk-delete", makeBulkDelete(blogPostsSoftDelete));
router.post("/v1/blog-posts/bulk-restore", makeBulkRestore(blogPostsSoftDelete));

router.delete("/v1/blog-posts/:id", async (req, res): Promise<void> => {
  const parsed = IdParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const currentUser = (req as any).user;
  const permanent = req.query.permanent === "true";
  if (permanent) {
    if (currentUser?.role !== "SuperAdmin") {
      res.status(403).json({ error: "Only SuperAdmin can permanently delete records" }); return;
    }
    await db.delete(blogPostsTable).where(eq(blogPostsTable.id, parsed.data.id));
  } else {
    await db.update(blogPostsTable).set({ deleted_at: new Date(), status: "Archived", updated_at: new Date() }).where(eq(blogPostsTable.id, parsed.data.id));
  }
  res.status(204).end();
});

export default router;
