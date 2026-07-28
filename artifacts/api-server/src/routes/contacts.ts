import { Router, type IRouter } from "express";
import multer from "multer";
import { eq, ilike, and, or, isNull, inArray, desc, SQL } from "drizzle-orm";
import { db, contactsTable, documentsTable } from "@workspace/db";
import { deletedFilter, makeBulkDelete, makeBulkRestore } from "../lib/softDelete";
import {
  isCloudinaryConfigured,
  uploadToCloudinary,
  uploadPrivateToCloudinary,
  generateSignedUrl,
  deleteFromCloudinary,
  cldFolder,
} from "../utils/cloudinary";
import { calcRetentionDate } from "../lib/retention";
import { scanBusinessCard, isSupportedCardMime } from "../lib/contacts/businessCardOcr";
import {
  ListContactsQueryParams,
  CreateContactBody,
  GetContactParams,
  UpdateContactParams,
  UpdateContactBody,
  DeleteContactParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/v1/contacts", async (req, res): Promise<void> => {
  const parsed = ListContactsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { search, nationality, gender, portal_enabled, status } = parsed.data;
  const conditions: SQL[] = [deletedFilter(contactsTable.deleted_at, req)];
  if (nationality) conditions.push(eq(contactsTable.nationality, nationality));
  if (gender) conditions.push(eq(contactsTable.gender, gender));
  if (portal_enabled !== undefined) conditions.push(eq(contactsTable.portal_enabled, portal_enabled));
  if (status) conditions.push(eq(contactsTable.status, status));
  if (search) {
    conditions.push(or(
      ilike(contactsTable.first_name, `%${search}%`),
      ilike(contactsTable.last_name, `%${search}%`),
      ilike(contactsTable.email, `%${search}%`),
      ilike(contactsTable.mobile_number, `%${search}%`),
    )!);
  }
  const rows = await db.select().from(contactsTable)
    .where(and(...conditions))
    .orderBy(contactsTable.last_name);
  res.json(rows);
});

router.post("/v1/contacts", async (req, res): Promise<void> => {
  const parsed = CreateContactBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(contactsTable).values(parsed.data).returning();
  res.status(201).json(row);
});

// ─────────────────────────────────────────────────────────────────────────────
// Photos & business cards
//
// Two different storage classes on purpose:
//   • Profile photo  → Cloudinary "upload" (public CDN URL) under <root>/avatars,
//     stored on contacts.profile_photo_url because the contact LIST renders it.
//   • Business card  → Cloudinary "authenticated" (signed URLs only) under
//     <root>/private/contacts/<id>, indexed in the `documents` table so it
//     inherits retention dates + the central purge job. The image bytes never
//     get a public URL.
// ─────────────────────────────────────────────────────────────────────────────

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const CARD_DOC_TYPE = { front: "business_card_front", back: "business_card_back" } as const;
type CardSide = keyof typeof CARD_DOC_TYPE;
const CONTACT_ENTITY = "contact";

interface UploadedFile { buffer: Buffer; originalname: string; size: number; mimetype: string }
function filesOf(req: unknown): Record<string, UploadedFile[] | undefined> {
  return ((req as { files?: Record<string, UploadedFile[]> }).files ?? {}) as Record<string, UploadedFile[] | undefined>;
}

// POST /v1/contacts/photo (multipart: image) — upload a profile photo and return
// its URL. Deliberately NOT tied to a contact id so the "new contact" form can
// upload before the record exists; the URL is persisted by the normal create/update.
router.post("/v1/contacts/photo", upload.single("image"), async (req, res): Promise<void> => {
  const file = (req as unknown as { file?: UploadedFile }).file;
  if (!file) { res.status(400).json({ error: "No file provided" }); return; }
  if (!file.mimetype.startsWith("image/")) { res.status(400).json({ error: "Only image files are accepted" }); return; }
  if (!isCloudinaryConfigured()) { res.status(503).json({ error: "Image storage is not configured" }); return; }
  try {
    const result = await uploadToCloudinary(file.buffer, {
      folder: cldFolder("avatars"),
      transformation: [
        { quality: "auto:good", fetch_format: "auto" },
        { width: 800, height: 800, crop: "limit" },
      ],
    });
    res.json({ success: true, url: result.secure_url, public_id: result.public_id });
  } catch (err) {
    console.error("[contacts] profile photo upload failed:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Image upload failed" });
  }
});

// POST /v1/contacts/business-card/scan (multipart: front, back?) — store the card
// images privately and read them with the AI OCR. Nothing is written to the
// contact here: the admin approves the extracted fields in the UI first.
router.post(
  "/v1/contacts/business-card/scan",
  upload.fields([{ name: "front", maxCount: 1 }, { name: "back", maxCount: 1 }]),
  async (req, res): Promise<void> => {
    const files = filesOf(req);
    const front = files["front"]?.[0];
    const back = files["back"]?.[0];
    if (!front && !back) { res.status(400).json({ error: "At least one card image is required" }); return; }
    for (const f of [front, back]) {
      if (f && !isSupportedCardMime(f.mimetype)) {
        res.status(400).json({ error: "Card images must be JPEG, PNG, WebP or GIF" });
        return;
      }
    }
    if (!isCloudinaryConfigured()) { res.status(503).json({ error: "Image storage is not configured" }); return; }

    // Upload first so the images survive even if OCR is unavailable or fails —
    // the admin can still keep the card and type the details manually.
    const stored: Partial<Record<CardSide, Record<string, unknown>>> = {};
    try {
      for (const [side, file] of [["front", front], ["back", back]] as Array<[CardSide, UploadedFile | undefined]>) {
        if (!file) continue;
        const up = await uploadPrivateToCloudinary(file.buffer, { folder: cldFolder("private/contacts") });
        stored[side] = {
          public_id: up.public_id,
          file_name: file.originalname.slice(0, 255),
          file_size: file.size,
          mime_type: file.mimetype.slice(0, 100),
          preview_url: generateSignedUrl(up.public_id, 900),
        };
      }
    } catch (err) {
      console.error("[contacts] business card upload failed:", err instanceof Error ? err.message : err);
      res.status(500).json({ error: "Card upload failed" });
      return;
    }

    let ocr: Awaited<ReturnType<typeof scanBusinessCard>> | null = null;
    let ocr_error: string | null = null;
    const ocrFront = front ?? back;
    try {
      if (ocrFront) {
        ocr = await scanBusinessCard(
          { buffer: ocrFront.buffer, mimetype: ocrFront.mimetype },
          front && back ? { buffer: back.buffer, mimetype: back.mimetype } : undefined,
        );
      }
    } catch (err) {
      ocr_error = err instanceof Error ? err.message : "Card OCR failed";
      console.error("[contacts] business card OCR failed:", ocr_error);
    }

    res.json({
      success: true,
      front: stored.front ?? null,
      back: stored.back ?? null,
      fields: ocr?.fields ?? {},
      confidence: ocr?.confidence ?? null,
      notes: ocr?.notes ?? null,
      ocr_error,
    });
  },
);

// POST /v1/contacts/:id/business-card — attach already-scanned card images to a
// contact. Called right after the contact is created/saved. Re-attaching a side
// replaces the previous image for that side.
router.post("/v1/contacts/:id/business-card", async (req, res): Promise<void> => {
  const parsed = GetContactParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [contact] = await db.select().from(contactsTable).where(eq(contactsTable.id, parsed.data.id));
  if (!contact) { res.status(404).json({ error: "Not found" }); return; }

  const body = (req.body ?? {}) as Partial<Record<CardSide, {
    public_id?: string; file_name?: string; file_size?: number; mime_type?: string;
  }>>;
  const currentUser = (req as unknown as { user?: { id?: number } }).user;
  const created: unknown[] = [];

  for (const side of ["front", "back"] as CardSide[]) {
    const card = body[side];
    if (!card?.public_id) continue;
    const docType = CARD_DOC_TYPE[side];

    // Replace: retire any previous image for this side (row + Cloudinary asset).
    const previous = await db.select().from(documentsTable).where(
      and(
        eq(documentsTable.entity_type, CONTACT_ENTITY),
        eq(documentsTable.entity_id, contact.id),
        eq(documentsTable.doc_type, docType),
        isNull(documentsTable.deleted_at),
      ),
    );
    for (const prev of previous) {
      await db.update(documentsTable).set({ deleted_at: new Date() }).where(eq(documentsTable.id, prev.id));
      await deleteFromCloudinary(prev.cloudinary_public_id);
    }

    const [row] = await db.insert(documentsTable).values({
      entity_type: CONTACT_ENTITY,
      entity_id: contact.id,
      doc_type: docType,
      file_name: (card.file_name ?? `${docType}.jpg`).slice(0, 255),
      file_size: Number(card.file_size ?? 0),
      mime_type: (card.mime_type ?? "image/jpeg").slice(0, 100),
      cloudinary_public_id: card.public_id,
      uploaded_by: currentUser?.id ?? null,
      uploaded_by_type: "User",
      retention_until: calcRetentionDate(docType),
    } as never).returning();
    created.push(row);
  }

  if (created.length === 0) { res.status(400).json({ error: "No card images provided" }); return; }
  res.status(201).json({ success: true, documents: created });
});

// GET /v1/contacts/:id/documents — the contact's stored files (business cards and
// anything else filed against the contact), each with a short-lived signed URL.
router.get("/v1/contacts/:id/documents", async (req, res): Promise<void> => {
  const parsed = GetContactParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const rows = await db.select().from(documentsTable).where(
    and(
      eq(documentsTable.entity_type, CONTACT_ENTITY),
      eq(documentsTable.entity_id, parsed.data.id),
      isNull(documentsTable.deleted_at),
    ),
  ).orderBy(desc(documentsTable.created_at));
  const configured = isCloudinaryConfigured();
  res.json({
    success: true,
    documents: rows.map((d) => ({
      id: d.id,
      doc_type: d.doc_type,
      file_name: d.file_name,
      file_size: d.file_size,
      mime_type: d.mime_type,
      retention_until: d.retention_until,
      created_at: d.created_at,
      signed_url: configured && d.cloudinary_public_id ? generateSignedUrl(d.cloudinary_public_id, 900) : null,
    })),
  });
});

// DELETE /v1/contacts/:id/documents/:docId — remove a stored file (row soft-deleted,
// Cloudinary asset destroyed).
router.delete("/v1/contacts/:id/documents/:docId", async (req, res): Promise<void> => {
  const parsed = GetContactParams.safeParse({ id: req.params["id"] });
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const docId = String(req.params["docId"] ?? "");
  const [doc] = await db.select().from(documentsTable).where(
    and(
      eq(documentsTable.id, docId),
      eq(documentsTable.entity_type, CONTACT_ENTITY),
      eq(documentsTable.entity_id, parsed.data.id),
    ),
  );
  if (!doc) { res.status(404).json({ error: "Not found" }); return; }
  await db.update(documentsTable).set({ deleted_at: new Date() }).where(eq(documentsTable.id, doc.id));
  await deleteFromCloudinary(doc.cloudinary_public_id);
  res.status(204).end();
});

router.get("/v1/contacts/:id", async (req, res): Promise<void> => {
  const parsed = GetContactParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.select().from(contactsTable).where(eq(contactsTable.id, parsed.data.id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.put("/v1/contacts/:id", async (req, res): Promise<void> => {
  const paramsParsed = UpdateContactParams.safeParse(req.params);
  if (!paramsParsed.success) { res.status(400).json({ error: paramsParsed.error.message }); return; }
  const bodyParsed = UpdateContactBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const [row] = await db.update(contactsTable)
    .set({ ...bodyParsed.data, updated_at: new Date() })
    .where(eq(contactsTable.id, paramsParsed.data.id))
    .returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

const contactsSoftDelete = {
  table: contactsTable,
  idColumn: contactsTable.id,
  statusKey: "status",
  archivedStatus: "Archived",
  restoredStatus: "Active",
};

router.post("/v1/contacts/bulk-delete", makeBulkDelete(contactsSoftDelete));
router.post("/v1/contacts/bulk-restore", makeBulkRestore(contactsSoftDelete));

router.delete("/v1/contacts/:id", async (req, res): Promise<void> => {
  const parsed = DeleteContactParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const currentUser = (req as any).user;
  const permanent = req.query.permanent === "true";
  if (permanent) {
    if (currentUser?.role !== "SuperAdmin") {
      res.status(403).json({ error: "Only Super Admin can permanently delete records" }); return;
    }
    await db.delete(contactsTable).where(eq(contactsTable.id, parsed.data.id));
  } else {
    await db.update(contactsTable).set({ deleted_at: new Date(), status: "Archived" }).where(eq(contactsTable.id, parsed.data.id));
  }
  res.status(204).end();
});

export default router;
