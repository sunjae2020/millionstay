import { Router, type IRouter } from "express";
import multer from "multer";
import { eq } from "drizzle-orm";
import { db, brandingSettingsTable, BRANDING_SINGLETON_ID } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";
import { isCloudinaryConfigured, uploadToCloudinary, cldFolder } from "../utils/cloudinary";

// ---------------------------------------------------------------------------
// Branding settings — persistence behind the property-admin "Design & Branding"
// page. GET is PUBLIC (the login screen themes itself before auth); PUT and the
// image upload require admin auth (applied inline, since this router is mounted
// before the global /api/v1 requireAuth guard so GET stays open).
// ---------------------------------------------------------------------------

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Columns an admin may write. `id`/`updated_at` are managed by the DB.
const WRITABLE = [
  "brand_name",
  "primary_color",
  "secondary_color",
  "accent_color",
  "sidebar_theme",
  "logo_url",
  "logo_dark_url",
  "favicon_url",
  "favicon_dark_url",
  "custom_css",
  "dark_mode",
  "date_format",
  "currency",
  "currency_position",
] as const;

function pickBrandingFields(body: any): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of WRITABLE) {
    if (body[k] !== undefined) out[k] = body[k];
  }
  return out;
}

/* GET /api/v1/branding — the single global branding row (or null → client uses
   its build-time defaults). Public so unauthenticated pages can theme. */
router.get("/v1/branding", async (_req, res): Promise<void> => {
  try {
    const [row] = await db
      .select()
      .from(brandingSettingsTable)
      .where(eq(brandingSettingsTable.id, BRANDING_SINGLETON_ID))
      .limit(1);
    res.json({ success: true, data: row ?? null });
  } catch (err: any) {
    console.error("[branding] load failed:", err?.message, err);
    res.status(500).json({ error: "Failed to load branding" });
  }
});

/* PUT /api/v1/branding — upsert the single global branding row (admin only). */
router.put("/v1/branding", requireAuth, async (req, res): Promise<void> => {
  const fields = pickBrandingFields(req.body ?? {});
  if (!Object.keys(fields).length) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }
  try {
    const [row] = await db
      .insert(brandingSettingsTable)
      .values({ id: BRANDING_SINGLETON_ID, ...fields } as any)
      .onConflictDoUpdate({ target: brandingSettingsTable.id, set: fields })
      .returning();
    res.json({ success: true, data: row });
  } catch (err: any) {
    console.error("[branding] save failed:", err?.message, err);
    res.status(500).json({ error: "Failed to save branding" });
  }
});

/* POST /api/v1/branding/upload-image — logo/favicon → Cloudinary, returns URL.
   Falls back to an inline data URL when Cloudinary is not configured (local dev),
   mirroring space-images, so branding uploads work in every environment. */
router.post(
  "/v1/branding/upload-image",
  requireAuth,
  upload.single("image"),
  async (req, res): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file provided" });
        return;
      }
      if (isCloudinaryConfigured()) {
        const result = await uploadToCloudinary(req.file.buffer, {
          folder: cldFolder("branding"),
        });
        res.json({ success: true, url: result.secure_url });
        return;
      }
      // No Cloudinary in this environment — inline as a data URL.
      const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
      res.json({ success: true, url: dataUrl });
    } catch (err: any) {
      console.error("[branding/upload-image] upload failed:", err?.message, err);
      res.status(500).json({ error: err?.message ?? "Upload failed" });
    }
  },
);

export default router;
