import { Router, type IRouter } from "express";
import multer from "multer";
import { eq, asc, desc } from "drizzle-orm";
import { db, spacesTable } from "@workspace/db";
import { spaceImagesTable } from "@workspace/db";
import { isCloudinaryConfigured, uploadToCloudinary, deleteFromCloudinary } from "../utils/cloudinary";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.get("/v1/spaces/:id/images", async (req, res): Promise<void> => {
  const spaceId = Number(req.params.id);
  if (!spaceId) { res.status(400).json({ error: "Invalid space id" }); return; }

  const images = await db
    .select()
    .from(spaceImagesTable)
    .where(eq(spaceImagesTable.space_id, spaceId))
    .orderBy(desc(spaceImagesTable.is_primary), asc(spaceImagesTable.display_order), asc(spaceImagesTable.created_at));

  res.json({ success: true, data: images });
});

router.post("/v1/spaces/:id/images", upload.array("images", 20), async (req, res): Promise<void> => {
  const spaceId = Number(req.params.id);
  if (!spaceId) { res.status(400).json({ error: "Invalid space id" }); return; }

  const [space] = await db.select().from(spacesTable).where(eq(spacesTable.id, spaceId));
  if (!space) { res.status(404).json({ error: "Space not found" }); return; }

  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) { res.status(400).json({ error: "No files provided" }); return; }

  const existingImages = await db
    .select({ id: spaceImagesTable.id })
    .from(spaceImagesTable)
    .where(eq(spaceImagesTable.space_id, spaceId));
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
      fileUrl = `data:${file.mimetype};base64,${file.buffer.toString("base64").slice(0, 100)}...`;
    }

    if (shouldBePrimary) {
      await db.update(spaceImagesTable).set({ is_primary: false }).where(eq(spaceImagesTable.space_id, spaceId));
    }

    const [inserted] = await db.insert(spaceImagesTable).values({
      space_id: spaceId,
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

router.put("/v1/spaces/:id/images/:imageId", async (req, res): Promise<void> => {
  const spaceId = Number(req.params.id);
  const imageId = Number(req.params.imageId);
  if (!spaceId || !imageId) { res.status(400).json({ error: "Invalid ids" }); return; }

  const { caption } = req.body as { caption?: string };

  const [updated] = await db
    .update(spaceImagesTable)
    .set({ caption: caption ?? null })
    .where(eq(spaceImagesTable.id, imageId))
    .returning();

  if (!updated) { res.status(404).json({ error: "Image not found" }); return; }
  res.json({ success: true, data: updated });
});

router.patch("/v1/spaces/:id/images/:imageId/set-primary", async (req, res): Promise<void> => {
  const spaceId = Number(req.params.id);
  const imageId = Number(req.params.imageId);
  if (!spaceId || !imageId) { res.status(400).json({ error: "Invalid ids" }); return; }

  await db.update(spaceImagesTable).set({ is_primary: false }).where(eq(spaceImagesTable.space_id, spaceId));
  const [updated] = await db
    .update(spaceImagesTable)
    .set({ is_primary: true })
    .where(eq(spaceImagesTable.id, imageId))
    .returning();

  if (!updated) { res.status(404).json({ error: "Image not found" }); return; }
  res.json({ success: true, data: updated });
});

router.delete("/v1/spaces/:id/images/:imageId", async (req, res): Promise<void> => {
  const spaceId = Number(req.params.id);
  const imageId = Number(req.params.imageId);
  if (!spaceId || !imageId) { res.status(400).json({ error: "Invalid ids" }); return; }

  const [image] = await db.select().from(spaceImagesTable).where(eq(spaceImagesTable.id, imageId));
  if (!image) { res.status(404).json({ error: "Image not found" }); return; }

  if (image.cloudinary_id) await deleteFromCloudinary(image.cloudinary_id);

  await db.delete(spaceImagesTable).where(eq(spaceImagesTable.id, imageId));

  if (image.is_primary) {
    const remaining = await db
      .select()
      .from(spaceImagesTable)
      .where(eq(spaceImagesTable.space_id, spaceId))
      .orderBy(asc(spaceImagesTable.display_order))
      .limit(1);
    if (remaining[0]) {
      await db.update(spaceImagesTable).set({ is_primary: true }).where(eq(spaceImagesTable.id, remaining[0].id));
    }
  }

  res.json({ success: true });
});

router.patch("/v1/spaces/:id/images/reorder", async (req, res): Promise<void> => {
  const spaceId = Number(req.params.id);
  if (!spaceId) { res.status(400).json({ error: "Invalid space id" }); return; }

  const { order } = req.body as { order?: { id: number; display_order: number }[] };
  if (!Array.isArray(order)) { res.status(400).json({ error: "order array required" }); return; }

  for (const item of order) {
    await db.update(spaceImagesTable)
      .set({ display_order: item.display_order })
      .where(eq(spaceImagesTable.id, item.id));
  }

  res.json({ success: true });
});

export default router;
