import { Router, type IRouter } from "express";
import multer from "multer";
import { eq, and } from "drizzle-orm";
import { db, pageContentsTable } from "@workspace/db";
import * as z from "zod/v4";
import { isCloudinaryConfigured, uploadToCloudinary, cldFolder } from "../utils/cloudinary";

const router: IRouter = Router();

// In-memory multer for image uploads (this router is mounted after the global
// /api/v1 requireAuth guard, so uploads are already admin-authenticated).
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const PageContentBody = z.object({
  content: z.record(z.string(), z.any()).optional(),
  seo_title: z.string().optional().nullable(),
  seo_description: z.string().optional().nullable(),
  seo_keywords: z.string().optional().nullable(),
});

// POST /api/v1/page-contents/upload-image — upload a CMS image (hero slides,
// gallery, avatars, etc.) to Cloudinary and return its URL. The admin stores the
// returned URL in the relevant content field via the PUT above. Falls back to a
// base64 data URL when Cloudinary is not configured (local dev). Field: "image".
router.post("/v1/page-contents/upload-image", upload.single("image"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No file provided" });
    return;
  }
  try {
    if (isCloudinaryConfigured()) {
      const result = await uploadToCloudinary(req.file.buffer, { folder: cldFolder("content") });
      res.json({ success: true, url: result.secure_url });
      return;
    }
    const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    res.json({ success: true, url: dataUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    console.error("[page-contents/upload-image] upload failed:", message);
    res.status(500).json({ error: "Image upload failed" });
  }
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
