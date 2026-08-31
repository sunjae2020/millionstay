import { Router, type IRouter } from "express";
import multer from "multer";
import { eq, ilike, and, or, isNull, inArray, desc, SQL } from "drizzle-orm";
import { db, contactsTable, documentsTable, accountsTable, accountContactsTable } from "@workspace/db";
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
  scanIdDocument,
  isSupportedIdMime,
  portraitCropTransformation,
} from "../lib/contacts/idDocumentOcr";
import { formatFirstName, formatLastName } from "../lib/nameFormat";
import { decodeUploadFilename } from "../lib/uploadFilename";
import {
  ListContactsQueryParams,
  CreateContactBody,
  GetContactParams,
  UpdateContactParams,
  UpdateContactBody,
  DeleteContactParams,
} from "@workspace/api-zod";
import { resolvePartyCode } from "../lib/documents/partyCode";
import { maskResidentNo, maskPassportNo } from "../lib/piiMask";

import { keywordCondition } from "../lib/listSearch";
const router: IRouter = Router();

/**
 * Canonical person-name casing on write (Firstname / LASTNAME). Hangul, Kana and
 * Han are unaffected by case mapping, so this is safe for every script — display
 * order is handled at render time by formatPersonName.
 */
function normalizeNames<T extends { first_name?: string | null; last_name?: string | null }>(data: T): T {
  const out = { ...data };
  if (typeof out.first_name === "string") out.first_name = formatFirstName(out.first_name);
  if (typeof out.last_name === "string") out.last_name = formatLastName(out.last_name);
  return out;
}

router.get("/v1/contacts", async (req, res): Promise<void> => {
  const parsed = ListContactsQueryParams.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { search, nationality, gender, portal_enabled, status } = parsed.data;
  const conditions: SQL[] = [deletedFilter(contactsTable.deleted_at, req)];
  if (nationality) conditions.push(eq(contactsTable.nationality, nationality));
  if (gender) conditions.push(eq(contactsTable.gender, gender));
  if (portal_enabled !== undefined) conditions.push(eq(contactsTable.portal_enabled, portal_enabled));
  if (status) conditions.push(eq(contactsTable.status, status));
  // 이름·이메일·휴대폰에 더해 회사명·직함·사무실 번호·SNS 로도 찾는다(명함에서 넘어온 축).
  if (search) {
    conditions.push(keywordCondition(
      search,
      [
        contactsTable.other_name, contactsTable.email, contactsTable.mobile_number,
        contactsTable.office_number, contactsTable.company_name, contactsTable.job_title,
        contactsTable.department, contactsTable.nationality, contactsTable.sns_id,
      ],
      [],
      // 성·이름을 붙여 쓴 "조수민" 으로도 찾혀야 한다.
      [{ first: contactsTable.first_name, last: contactsTable.last_name }],
    ));
  }
  const rows = await db.select().from(contactsTable)
    .where(and(...conditions))
    // Person lists sort by family name, then given name (see lib/nameFormat.ts).
    .orderBy(contactsTable.last_name, contactsTable.first_name);
  // 고유식별정보(PIPA §24-3): the list never carries raw resident registration /
  // passport numbers — masked display values only. Raw values stay on the
  // detail endpoint, which the edit form and contract issuance actually use.
  res.json(rows.map((r) => ({
    ...r,
    resident_no: maskResidentNo(r.resident_no),
    passport_number: maskPassportNo(r.passport_number),
    has_resident_no: Boolean(r.resident_no?.trim()),
    has_passport_number: Boolean(r.passport_number?.trim()),
  })));
});

router.post("/v1/contacts", async (req, res): Promise<void> => {
  const parsed = CreateContactBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.insert(contactsTable).values(normalizeNames(parsed.data)).returning();
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

// POST /v1/contacts/photo/discard { public_id } — throw away an avatar the admin
// did not accept (e.g. cancelled the ID-scan approval dialog). Scoped to the
// avatars folder so it can never be used to delete other assets.
router.post("/v1/contacts/photo/discard", async (req, res): Promise<void> => {
  const publicId = String((req.body as { public_id?: string })?.public_id ?? "");
  if (!publicId.startsWith(`${cldFolder("avatars")}/`)) {
    res.status(400).json({ error: "Not an avatar asset" });
    return;
  }
  await deleteFromCloudinary(publicId);
  res.status(204).end();
});

// POST /v1/contacts/id-document/scan (multipart: image) — read an ID document
// (passport / 주민등록증 / 운전면허증 / 외국인등록증), crop the printed portrait out of
// it into a profile photo, and return the GENERAL details for the admin to approve.
//
// Privacy, by design:
//   • The ID image is NEVER stored. It exists in this request's memory only; the
//     single Cloudinary upload carries an *incoming* transformation, so the only
//     asset that ever lands in storage is the cropped portrait.
//   • No document numbers are collected — see lib/contacts/idDocumentOcr.ts. The
//     model is instructed never to emit them and every value is scrubbed again here.
router.post("/v1/contacts/id-document/scan", upload.single("image"), async (req, res): Promise<void> => {
  const file = (req as unknown as { file?: UploadedFile }).file;
  if (!file) { res.status(400).json({ error: "No file provided" }); return; }
  if (!isSupportedIdMime(file.mimetype)) {
    res.status(400).json({ error: "ID images must be JPEG, PNG, WebP or GIF" });
    return;
  }
  if (!isCloudinaryConfigured()) { res.status(503).json({ error: "Image storage is not configured" }); return; }

  let scan: Awaited<ReturnType<typeof scanIdDocument>>;
  try {
    scan = await scanIdDocument({ buffer: file.buffer, mimetype: file.mimetype });
  } catch (err) {
    const message = err instanceof Error ? err.message : "ID reading failed";
    console.error("[contacts] id document scan failed:", message);
    // Missing AI key is a configuration problem, not a bad request.
    res.status(message.includes("AI is not configured") ? 503 : 502).json({ error: message });
    return;
  }

  if (!scan.isIdDocument) {
    res.status(422).json({ error: "This image does not look like an identity document", doc_kind: scan.docKind });
    return;
  }

  let photo: { url: string; public_id: string } | null = null;
  if (scan.portrait) {
    try {
      const uploaded = await uploadToCloudinary(file.buffer, {
        folder: cldFolder("avatars"),
        transformation: portraitCropTransformation(scan.portrait),
      });
      photo = { url: uploaded.secure_url, public_id: uploaded.public_id };
    } catch (err) {
      console.error("[contacts] portrait crop upload failed:", err instanceof Error ? err.message : err);
    }
  }

  res.json({
    success: true,
    doc_kind: scan.docKind,
    confidence: scan.confidence,
    photo,
    fields: scan.fields,
    // Field names dropped because the value looked like an ID/document number.
    blocked: scan.blocked,
  });
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
          file_name: decodeUploadFilename(file.originalname).slice(0, 255),
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

// ─────────────────────────────────────────────────────────────────────────────
// Accounts a contact belongs to (the 계정 tab, mirror of the account's 연락처 tab)
//
// Two sources, same as the account side: the primary/secondary slots on the
// account row, plus the account_contacts links. `link` says how to unlink.
// ─────────────────────────────────────────────────────────────────────────────

async function loadContactAccounts(contactId: number) {
  const [slotRows, linkRows] = await Promise.all([
    db.select().from(accountsTable).where(and(
      or(eq(accountsTable.primary_contact_id, contactId), eq(accountsTable.secondary_contact_id, contactId))!,
      isNull(accountsTable.deleted_at),
    )),
    db.select({ role: accountContactsTable.role, account: accountsTable })
      .from(accountContactsTable)
      .innerJoin(accountsTable, eq(accountsTable.id, accountContactsTable.account_id))
      .where(and(eq(accountContactsTable.contact_id, contactId), isNull(accountsTable.deleted_at)))
      .orderBy(accountContactsTable.id),
  ]);

  const shape = (a: typeof accountsTable.$inferSelect, role: string, link: "slot" | "link") => ({
    id: a.id,
    name: a.name,
    account_type: a.account_type,
    status: a.status,
    account_email: a.account_email,
    account_phone: a.phone1,
    role,
    link,
  });

  const out = slotRows.map((a) =>
    shape(a, a.primary_contact_id === contactId ? "Primary" : "Secondary", "slot"));
  const seen = new Set(out.map((a) => a.id));
  for (const row of linkRows) {
    if (seen.has(row.account.id)) continue;
    out.push(shape(row.account, row.role || "Member", "link"));
  }
  return out;
}

router.get("/v1/contacts/:id/accounts", async (req, res): Promise<void> => {
  const parsed = GetContactParams.safeParse({ id: req.params["id"] });
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  res.json(await loadContactAccounts(parsed.data.id));
});

// POST /v1/contacts/:id/accounts { account_id, role?, as_slot? } — link this
// contact to an existing account from the contact side.
router.post("/v1/contacts/:id/accounts", async (req, res): Promise<void> => {
  const parsed = GetContactParams.safeParse({ id: req.params["id"] });
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const contactId = parsed.data.id;
  const [contact] = await db.select({ id: contactsTable.id }).from(contactsTable)
    .where(and(eq(contactsTable.id, contactId), isNull(contactsTable.deleted_at)));
  if (!contact) { res.status(404).json({ error: "Not found" }); return; }

  const accountId = Number(req.body?.account_id) || 0;
  if (!accountId) { res.status(400).json({ error: "account_id is required" }); return; }
  const [account] = await db.select({ id: accountsTable.id }).from(accountsTable)
    .where(and(eq(accountsTable.id, accountId), isNull(accountsTable.deleted_at)));
  if (!account) { res.status(404).json({ error: "Account not found" }); return; }

  const asSlot = req.body?.as_slot as "primary" | "secondary" | undefined;
  const role = typeof req.body?.role === "string" ? req.body.role.trim() : "";

  if (asSlot === "primary" || asSlot === "secondary") {
    await db.update(accountsTable)
      .set(asSlot === "primary" ? { primary_contact_id: contactId } : { secondary_contact_id: contactId })
      .where(eq(accountsTable.id, accountId));
    await db.delete(accountContactsTable)
      .where(and(eq(accountContactsTable.account_id, accountId), eq(accountContactsTable.contact_id, contactId)));
  } else {
    await db.insert(accountContactsTable)
      .values({ account_id: accountId, contact_id: contactId, role: role || null })
      .onConflictDoUpdate({
        target: [accountContactsTable.account_id, accountContactsTable.contact_id],
        set: { role: role || null },
      });
  }
  res.status(201).json({ accounts: await loadContactAccounts(contactId) });
});

// DELETE /v1/contacts/:id/accounts/:accountId — unlink only; neither record is
// deleted.
router.delete("/v1/contacts/:id/accounts/:accountId", async (req, res): Promise<void> => {
  const parsed = GetContactParams.safeParse({ id: req.params["id"] });
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const contactId = parsed.data.id;
  const accountId = Number(req.params["accountId"]) || 0;
  if (!accountId) { res.status(400).json({ error: "Invalid account id" }); return; }

  const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, accountId));
  if (account) {
    const patch: Record<string, null> = {};
    if (account.primary_contact_id === contactId) patch["primary_contact_id"] = null;
    if (account.secondary_contact_id === contactId) patch["secondary_contact_id"] = null;
    if (Object.keys(patch).length) {
      await db.update(accountsTable).set(patch).where(eq(accountsTable.id, accountId));
    }
  }
  await db.delete(accountContactsTable)
    .where(and(eq(accountContactsTable.account_id, accountId), eq(accountContactsTable.contact_id, contactId)));

  res.json({ accounts: await loadContactAccounts(contactId) });
});

router.get("/v1/contacts/:id", async (req, res): Promise<void> => {
  const parsed = GetContactParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [row] = await db.select().from(contactsTable).where(eq(contactsTable.id, parsed.data.id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  // 고객 ID — 없으면 상세를 여는 이 순간 채번한다 (partyCode.ts).
  const party_code = await resolvePartyCode({ entityType: "contact", entityId: row.id });
  res.json({ ...row, party_code });
});

router.put("/v1/contacts/:id", async (req, res): Promise<void> => {
  const paramsParsed = UpdateContactParams.safeParse(req.params);
  if (!paramsParsed.success) { res.status(400).json({ error: paramsParsed.error.message }); return; }
  const bodyParsed = UpdateContactBody.safeParse(req.body);
  if (!bodyParsed.success) { res.status(400).json({ error: bodyParsed.error.message }); return; }
  const [row] = await db.update(contactsTable)
    .set({ ...normalizeNames(bodyParsed.data), updated_at: new Date() })
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
