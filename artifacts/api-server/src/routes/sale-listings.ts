import { Router, type IRouter } from "express";
import multer from "multer";
import { eq, and, isNull, desc, asc, SQL } from "drizzle-orm";
import { db, saleListingsTable } from "@workspace/db";
import * as z from "zod/v4";
import { isCloudinaryConfigured, uploadToCloudinary, cldFolder } from "../utils/cloudinary";

// Admin CRUD for 분양/판매 listings shown on the development ("MetHeim") /buy
// board. Mounted under /api/v1 behind requireAuth (see app.ts), so every route
// here is admin-authenticated. Public read + inquiry live in public.ts.

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// numeric columns are strings in Drizzle — coerce writes with String(), reject NaN.
const numericField = z.union([z.number(), z.string()]).optional().nullable();
function toNumericString(v: unknown): string | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : null;
}

const ListingBody = z.object({
  category: z.enum(["presale", "sale"]).optional(),
  status: z.enum(["available", "reserved", "sold"]).optional(),
  cover_image: z.string().optional().nullable(),
  gallery: z.array(z.string()).optional(),
  area_m2: numericField,
  bedrooms: z.union([z.number(), z.string()]).optional().nullable(),
  bathrooms: z.union([z.number(), z.string()]).optional().nullable(),
  price_amount: numericField,
  sort_order: z.union([z.number(), z.string()]).optional(),
  published: z.boolean().optional(),
  translations: z.record(z.string(), z.any()).optional(),
});
const IdParams = z.object({ id: z.coerce.number().int() });

function toInt(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : (Number.isFinite(n) ? Math.trunc(n) : null);
}

// Map a validated body onto column values (only keys present are written).
function toColumns(data: z.infer<typeof ListingBody>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (data.category !== undefined) out.category = data.category;
  if (data.status !== undefined) out.status = data.status;
  if (data.cover_image !== undefined) out.cover_image = data.cover_image || null;
  if (data.gallery !== undefined) out.gallery = data.gallery;
  if (data.area_m2 !== undefined) out.area_m2 = toNumericString(data.area_m2);
  if (data.bedrooms !== undefined) out.bedrooms = toInt(data.bedrooms);
  if (data.bathrooms !== undefined) out.bathrooms = toInt(data.bathrooms);
  if (data.price_amount !== undefined) out.price_amount = toNumericString(data.price_amount);
  if (data.sort_order !== undefined) out.sort_order = toInt(data.sort_order) ?? 0;
  if (data.published !== undefined) out.published = data.published;
  if (data.translations !== undefined) out.translations = data.translations;
  return out;
}

const ListQuery = z.object({
  category: z.string().optional(),
  status: z.string().optional(),
  published: z.string().optional(),
});

router.get("/v1/sale-listings", async (req, res): Promise<void> => {
  const parsed = ListQuery.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { category, status, published } = parsed.data;
  const conditions: SQL[] = [isNull(saleListingsTable.deleted_at)];
  if (category) conditions.push(eq(saleListingsTable.category, category));
  if (status) conditions.push(eq(saleListingsTable.status, status));
  if (published === "true") conditions.push(eq(saleListingsTable.published, true));
  const rows = await db.select().from(saleListingsTable)
    .where(and(...conditions))
    .orderBy(asc(saleListingsTable.sort_order), desc(saleListingsTable.created_at));
  res.json({ data: rows });
});

router.get("/v1/sale-listings/:id", async (req, res): Promise<void> => {
  const parsed = IdParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.select().from(saleListingsTable).where(eq(saleListingsTable.id, parsed.data.id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.post("/v1/sale-listings", async (req, res): Promise<void> => {
  const parsed = ListingBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  try {
    const [row] = await db.insert(saleListingsTable).values(toColumns(parsed.data)).returning();
    res.status(201).json(row);
  } catch {
    res.status(500).json({ error: "Failed to create listing" });
  }
});

router.put("/v1/sale-listings/:id", async (req, res): Promise<void> => {
  const paramsParsed = IdParams.safeParse(req.params);
  if (!paramsParsed.success) { res.status(400).json({ error: paramsParsed.error.message }); return; }
  const bodyParsed = ListingBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  try {
    const [row] = await db.update(saleListingsTable)
      .set({ ...toColumns(bodyParsed.data), updated_at: new Date() })
      .where(eq(saleListingsTable.id, paramsParsed.data.id))
      .returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch {
    res.status(500).json({ error: "Failed to update listing" });
  }
});

router.delete("/v1/sale-listings/:id", async (req, res): Promise<void> => {
  const parsed = IdParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const currentUser = (req as any).user;
  const permanent = req.query.permanent === "true";
  if (permanent) {
    if (currentUser?.role !== "SuperAdmin") {
      res.status(403).json({ error: "Only SuperAdmin can permanently delete records" }); return;
    }
    await db.delete(saleListingsTable).where(eq(saleListingsTable.id, parsed.data.id));
  } else {
    await db.update(saleListingsTable)
      .set({ deleted_at: new Date(), published: false, updated_at: new Date() })
      .where(eq(saleListingsTable.id, parsed.data.id));
  }
  res.status(204).end();
});

// Image upload for listing cover / gallery. Returns { url } (Cloudinary secure
// URL when configured, else a base64 data URL). The admin stores the URL(s) in
// the listing's cover_image / gallery columns via the PUT above.
router.post("/v1/sale-listings/images", (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) { res.status(400).json({ error: `Upload error: ${err.message}` }); return; }
    next();
  });
}, async (req, res): Promise<void> => {
  const files = (req.files as Express.Multer.File[]) ?? [];
  if (files.length === 0) { res.status(400).json({ error: "No files provided" }); return; }
  const urls: string[] = [];
  for (const file of files) {
    if (isCloudinaryConfigured()) {
      const uploaded = await uploadToCloudinary(file.buffer, { folder: cldFolder("listings") });
      urls.push(uploaded.secure_url);
    } else {
      urls.push(`data:${file.mimetype};base64,${file.buffer.toString("base64")}`);
    }
  }
  res.status(201).json({ success: true, urls, url: urls[0] });
});

export default router;
