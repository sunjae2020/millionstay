import { Router, type IRouter } from "express";
import multer from "multer";
import { eq, asc, desc } from "drizzle-orm";
import { db, propertiesTable, propertyImagesTable } from "@workspace/db";
import { isCloudinaryConfigured, uploadToCloudinary, deleteFromCloudinary } from "../utils/cloudinary";

const router: IRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

async function getImagesForProperty(propertyId: number) {
  return db
    .select()
    .from(propertyImagesTable)
    .where(eq(propertyImagesTable.property_id, propertyId))
    .orderBy(desc(propertyImagesTable.is_primary), asc(propertyImagesTable.display_order), asc(propertyImagesTable.created_at));
}

router.get("/v1/properties/:id/images", async (req, res): Promise<void> => {
  const propertyId = Number(req.params.id);
  if (!propertyId) { res.status(400).json({ error: "Invalid property id" }); return; }

  const images = await getImagesForProperty(propertyId);
  res.json({ success: true, data: images });
});

router.post("/v1/properties/:id/images", (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: `Upload error: ${err.message}` });
      return;
    }
    next();
  });
}, async (req, res): Promise<void> => {
  const propertyId = Number(req.params.id);
  if (!propertyId) { res.status(400).json({ error: "Invalid property id" }); return; }

  const [property] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, propertyId));
  if (!property) { res.status(404).json({ error: "Property not found" }); return; }

  const files = (req.files as Express.Multer.File[]) ?? [];
  if (files.length === 0) { res.status(400).json({ error: "No files provided" }); return; }

  const existingImages = await db
    .select({ id: propertyImagesTable.id })
    .from(propertyImagesTable)
    .where(eq(propertyImagesTable.property_id, propertyId));
  const hasPrimary = existingImages.length > 0;

  const results = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    const shouldBePrimary = !hasPrimary && i === 0;

    let fileUrl = "";
    let thumbnailUrl: string | null = null;
    let cloudinaryId: string | null = null;

    if (isCloudinaryConfigured()) {
      const uploaded = await uploadToCloudinary(file.buffer, {});
      fileUrl = uploaded.secure_url;
      thumbnailUrl = uploaded.thumbnail_url;
      cloudinaryId = uploaded.public_id;
    } else {
      fileUrl = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
    }

    if (shouldBePrimary) {
      await db.update(propertyImagesTable).set({ is_primary: false }).where(eq(propertyImagesTable.property_id, propertyId));
    }

    const [inserted] = await db.insert(propertyImagesTable).values({
      property_id: propertyId,
      file_url: fileUrl,
      thumbnail_url: thumbnailUrl,
      cloudinary_id: cloudinaryId,
      caption: null,
      is_primary: shouldBePrimary,
      display_order: existingImages.length + i,
      file_size_bytes: file.size,
      mime_type: file.mimetype,
    }).returning();

    results.push(inserted);
  }

  res.status(201).json({ success: true, data: results });
});

router.put("/v1/properties/:id/images/:imageId", async (req, res): Promise<void> => {
  const propertyId = Number(req.params.id);
  const imageId = Number(req.params.imageId);
  if (!propertyId || !imageId) { res.status(400).json({ error: "Invalid ids" }); return; }

  const { caption } = req.body as { caption?: string };

  const [updated] = await db
    .update(propertyImagesTable)
    .set({ caption: caption ?? null })
    .where(eq(propertyImagesTable.id, imageId))
    .returning();

  if (!updated) { res.status(404).json({ error: "Image not found" }); return; }
  res.json({ success: true, data: updated });
});

router.patch("/v1/properties/:id/images/:imageId/set-primary", async (req, res): Promise<void> => {
  const propertyId = Number(req.params.id);
  const imageId = Number(req.params.imageId);
  if (!propertyId || !imageId) { res.status(400).json({ error: "Invalid ids" }); return; }

  await db.update(propertyImagesTable).set({ is_primary: false }).where(eq(propertyImagesTable.property_id, propertyId));
  const [updated] = await db
    .update(propertyImagesTable)
    .set({ is_primary: true })
    .where(eq(propertyImagesTable.id, imageId))
    .returning();

  if (!updated) { res.status(404).json({ error: "Image not found" }); return; }
  res.json({ success: true, data: updated });
});

router.delete("/v1/properties/:id/images/:imageId", async (req, res): Promise<void> => {
  const propertyId = Number(req.params.id);
  const imageId = Number(req.params.imageId);
  if (!propertyId || !imageId) { res.status(400).json({ error: "Invalid ids" }); return; }

  const [image] = await db.select().from(propertyImagesTable).where(eq(propertyImagesTable.id, imageId));
  if (!image) { res.status(404).json({ error: "Image not found" }); return; }

  if (image.cloudinary_id) await deleteFromCloudinary(image.cloudinary_id);

  await db.delete(propertyImagesTable).where(eq(propertyImagesTable.id, imageId));

  if (image.is_primary) {
    const remaining = await db
      .select()
      .from(propertyImagesTable)
      .where(eq(propertyImagesTable.property_id, propertyId))
      .orderBy(asc(propertyImagesTable.display_order))
      .limit(1);
    if (remaining[0]) {
      await db.update(propertyImagesTable).set({ is_primary: true }).where(eq(propertyImagesTable.id, remaining[0].id));
    }
  }

  res.json({ success: true });
});

router.patch("/v1/properties/:id/images/reorder", async (req, res): Promise<void> => {
  const propertyId = Number(req.params.id);
  if (!propertyId) { res.status(400).json({ error: "Invalid property id" }); return; }

  const { order } = req.body as { order?: { id: number; display_order: number }[] };
  if (!Array.isArray(order)) { res.status(400).json({ error: "order array required" }); return; }

  for (const item of order) {
    await db.update(propertyImagesTable)
      .set({ display_order: item.display_order })
      .where(eq(propertyImagesTable.id, item.id));
  }

  res.json({ success: true });
});

export default router;
