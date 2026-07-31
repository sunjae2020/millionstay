import { Router } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { db, documentsTable, documentIntakeTable } from "@workspace/db";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { calcRetentionDate } from "../lib/retention";
import { decodeUploadFilename } from "../lib/uploadFilename";
import { logAction } from "../utils/auditLog";
import {
  uploadPrivateToCloudinary, deleteFromCloudinary, fetchPrivateAsset,
  cldFolder, isCloudinaryConfigured,
} from "../utils/cloudinary";
import {
  classifyIntakeFile, isScannableMime, INTAKE_DOC_TYPES,
  type IntakeDocType, type IntakeFields,
} from "../lib/documents/intakeScan";
import {
  loadMatchContext, matchDocument, entityExists,
  type MatchCandidate, type MatchContext,
} from "../lib/documents/intakeMatch";

/**
 * Bulk document intake.
 *
 * The per-record upload panel (POST /v1/documents) files one known file against
 * one known record. This is the other half: a folder of existing paperwork with
 * no idea yet of where any of it belongs.
 *
 * The flow is upload → read → match → confirm, and the split matters. Upload is
 * synchronous and does nothing clever, so a 200 means every byte is safely in
 * Cloudinary and indexed. Reading and matching happen afterwards in the
 * background, because a scan is a model call per file and nobody should hold an
 * HTTP request open for fifty of them. Confirmation is a separate, deliberate
 * act by a human — until it happens, the file is parked under
 * `entity_type = 'intake'` and appears on nobody's record.
 */
const router = Router();

/** Where parked files live until they are confirmed onto a real record. */
const INTAKE_ENTITY_TYPE = "intake";
/** `documents.entity_id` is NOT NULL, and a parked file has no entity yet. */
const NO_ENTITY = 0;

const MAX_FILES = 50;
const MAX_FILE_BYTES = 20 * 1024 * 1024;

const intakeUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES },
});

/** Records a reviewer may file an intake item onto. */
const FILEABLE_ENTITIES = new Set(["contract", "contact", "account", "space"]);
/** Entities that are a *person*, and so may hold identity documents. */
const PERSON_ENTITIES = new Set(["contact"]);
/** Identity documents are destroyed at 30 days and must sit on the person. */
const PERSON_ONLY_DOC_TYPES = new Set<string>(["id_document", "visa_document"]);

// ── Background scanning ──────────────────────────────────────────────────────
//
// Runs after the upload response has gone out. Files are re-fetched from
// Cloudinary rather than held in memory: a 50-file batch at the 20 MB limit
// would be a gigabyte of buffers kept alive for the length of the scan.

/** Concurrent scans in flight. Bounded to keep model spend and memory predictable. */
const SCAN_CONCURRENCY = 3;

interface ScanOutcome {
  status: "scanned" | "review" | "failed";
  scan_source: string | null;
  scan_error: string | null;
  detected_doc_type: string | null;
  extracted: IntakeFields | null;
  confidence: number | null;
  suggested_entity_type: string | null;
  suggested_entity_id: number | null;
  match_score: number | null;
  match_reason: string | null;
  candidates: MatchCandidate[] | null;
}

async function scanOne(
  intakeId: string,
  ctx: MatchContext,
  opts: { preferContents?: boolean } = {},
): Promise<ScanOutcome> {
  const [item] = await db.select().from(documentIntakeTable).where(eq(documentIntakeTable.id, intakeId));
  if (!item) throw new Error("Intake item not found");
  const [doc] = await db.select().from(documentsTable).where(eq(documentsTable.id, item.document_id));
  if (!doc) throw new Error("Parked document not found");

  const ext = doc.file_name.includes(".") ? doc.file_name.split(".").pop()! : "";
  const asset = await fetchPrivateAsset(doc.cloudinary_public_id, {
    format: doc.resource_type === "raw" ? "" : ext,
    resourceType: doc.resource_type,
  });

  const scan = await classifyIntakeFile(
    { buffer: asset.buffer, mimetype: doc.mime_type || asset.contentType, fileName: doc.file_name },
    opts,
  );
  const match = matchDocument(scan.doc_type, scan.fields, ctx);

  return {
    // A confident match still goes to `scanned`, not straight onto the record —
    // that status only means "safe to file on one click", never "already filed".
    status: match.confident ? "scanned" : "review",
    scan_source: scan.source,
    scan_error: null,
    detected_doc_type: scan.doc_type,
    extracted: { ...scan.fields, ...(scan.notes ? { notes: scan.notes } : {}) } as IntakeFields,
    confidence: scan.confidence,
    suggested_entity_type: match.best?.entity_type ?? null,
    suggested_entity_id: match.best?.entity_id ?? null,
    match_score: match.best?.score ?? null,
    match_reason: match.best?.reason ?? null,
    candidates: match.candidates,
  };
}

async function applyOutcome(intakeId: string, outcome: ScanOutcome): Promise<void> {
  await db
    .update(documentIntakeTable)
    .set({ ...outcome, updated_at: new Date() } as never)
    .where(eq(documentIntakeTable.id, intakeId));
}

function failureOutcome(err: unknown): ScanOutcome {
  return {
    status: "failed",
    scan_source: null,
    scan_error: (err as Error)?.message ?? String(err),
    detected_doc_type: null,
    extracted: null,
    confidence: null,
    suggested_entity_type: null,
    suggested_entity_id: null,
    match_score: null,
    match_reason: null,
    candidates: null,
  };
}

/**
 * Read and match a set of parked files, a few at a time.
 *
 * Deliberately never throws to its caller: it is fired without an awaiting
 * request, and a failed scan is a per-item state (`failed`, with the reason
 * shown to the reviewer), not an incident. The file itself is already safe.
 */
async function runScanBatch(intakeIds: string[], opts: { preferContents?: boolean } = {}): Promise<void> {
  let ctx: MatchContext;
  try {
    ctx = await loadMatchContext();
  } catch (err) {
    console.error("[document-intake] could not load match context:", err);
    for (const id of intakeIds) await applyOutcome(id, failureOutcome(err)).catch(() => {});
    return;
  }

  const queue = [...intakeIds];
  const workers = Array.from({ length: Math.min(SCAN_CONCURRENCY, queue.length) }, async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      try {
        await applyOutcome(id, await scanOne(id, ctx, opts));
      } catch (err) {
        console.error(`[document-intake] scan failed (${id}):`, (err as Error)?.message ?? err);
        await applyOutcome(id, failureOutcome(err)).catch(() => {});
      }
    }
  });
  await Promise.all(workers);
}

// ── DTO ──────────────────────────────────────────────────────────────────────

interface IntakeItemDto {
  id: string;
  document_id: string;
  batch_id: string;
  file_name: string;
  status: string;
  scan_source: string | null;
  scan_error: string | null;
  detected_doc_type: string | null;
  extracted: Record<string, unknown> | null;
  confidence: number | null;
  suggested_entity_type: string | null;
  suggested_entity_id: number | null;
  match_score: number | null;
  match_reason: string | null;
  candidates: MatchCandidate[];
  filed_entity_type: string | null;
  filed_entity_id: number | null;
  filed_doc_type: string | null;
  created_at: string | null;
  mime_type: string | null;
  file_size: number | null;
  /** Streams through our own endpoint, so auth is re-checked on every view. */
  file_url: string;
}

function toDto(
  row: typeof documentIntakeTable.$inferSelect,
  doc?: { mime_type: string; file_size: number } | null,
): IntakeItemDto {
  return {
    id: row.id,
    document_id: row.document_id,
    batch_id: row.batch_id,
    file_name: row.file_name,
    status: row.status,
    scan_source: row.scan_source,
    scan_error: row.scan_error,
    detected_doc_type: row.detected_doc_type,
    extracted: (row.extracted as Record<string, unknown> | null) ?? null,
    confidence: row.confidence,
    suggested_entity_type: row.suggested_entity_type,
    suggested_entity_id: row.suggested_entity_id,
    match_score: row.match_score,
    match_reason: row.match_reason,
    candidates: (row.candidates as MatchCandidate[] | null) ?? [],
    filed_entity_type: row.filed_entity_type,
    filed_entity_id: row.filed_entity_id,
    filed_doc_type: row.filed_doc_type,
    created_at: row.created_at?.toISOString() ?? null,
    mime_type: doc?.mime_type ?? null,
    file_size: doc?.file_size ?? null,
    file_url: `/api/v1/documents/${row.document_id}/file`,
  };
}

/**
 * Turn what the classifier read into the filing index the library searches on.
 *
 * This is the payoff for reading the page in the first place: the year comes
 * off the document's own date rather than the day it happened to be scanned,
 * and the tenant name, unit and reference become keywords without anyone
 * typing them again.
 */
function indexFromScan(item: typeof documentIntakeTable.$inferSelect): {
  doc_date: string | null;
  doc_year: number | null;
  tags: string[];
} {
  const x = (item.extracted ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof x[k] === "string" && x[k] ? (x[k] as string) : null);

  // The document's own date first, its term start second — a lease scanned
  // years later still belongs to the year it was signed.
  const docDate = str("document_date") ?? str("start_date");
  const year = docDate ? Number(docDate.slice(0, 4)) : NaN;

  const tags = [str("party_name"), str("unit_label"), str("building_name"), str("reference")]
    .filter((v): v is string => Boolean(v))
    .map((v) => v.trim().slice(0, 60));

  return {
    doc_date: docDate,
    doc_year: Number.isInteger(year) && year >= 1900 && year <= 2200 ? year : null,
    tags: [...new Set(tags)],
  };
}

/** Attach each item's file metadata in one query rather than one per row. */
async function withDocuments(rows: Array<typeof documentIntakeTable.$inferSelect>): Promise<IntakeItemDto[]> {
  if (!rows.length) return [];
  const docs = await db
    .select({ id: documentsTable.id, mime_type: documentsTable.mime_type, file_size: documentsTable.file_size })
    .from(documentsTable)
    .where(inArray(documentsTable.id, [...new Set(rows.map((r) => r.document_id))]));
  const byId = new Map(docs.map((d) => [d.id, d]));
  return rows.map((r) => toDto(r, byId.get(r.document_id)));
}

// ── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /v1/document-intake  (multipart: files[])
 *
 * Uploads a batch and parks it. Responds as soon as every file is stored;
 * reading and matching continue in the background, so poll the list endpoint (or
 * re-open the page) to watch `status` move off `pending`.
 */
router.post("/v1/document-intake", intakeUpload.array("files", MAX_FILES), async (req, res): Promise<void> => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (!files.length) { res.status(400).json({ error: "At least one file is required" }); return; }
  if (!isCloudinaryConfigured()) { res.status(503).json({ error: "File storage is not configured" }); return; }

  const batchId = randomUUID();
  const userId = (req as any).user?.id ?? null;
  const created: string[] = [];
  const failed: Array<{ file_name: string; error: string }> = [];

  for (const file of files) {
    const fileName = decodeUploadFilename(file.originalname).slice(0, 255);
    try {
      const up = await uploadPrivateToCloudinary(file.buffer, {
        folder: cldFolder(`private/${INTAKE_ENTITY_TYPE}`),
        resource_type: "auto",
      });
      const [doc] = await db.insert(documentsTable).values({
        entity_type: INTAKE_ENTITY_TYPE,
        entity_id: NO_ENTITY,
        // Parked files carry the shortest retention there is. An unreviewed
        // upload has no established purpose, so it must not sit on a 7-year
        // clock — confirming it is what sets the real one.
        doc_type: "other",
        file_name: fileName,
        file_size: file.size,
        mime_type: file.mimetype.slice(0, 100),
        cloudinary_public_id: up.public_id,
        resource_type: up.resource_type,
        uploaded_by: userId,
        uploaded_by_type: "User",
        retention_until: calcRetentionDate("other"),
      } as never).returning();

      const [item] = await db.insert(documentIntakeTable).values({
        document_id: doc.id,
        batch_id: batchId,
        file_name: fileName,
        // A file we cannot read is not a failure — it is parked and waiting for a
        // human, which is what `review` means.
        status: isScannableMime(file.mimetype) ? "pending" : "review",
        scan_error: isScannableMime(file.mimetype)
          ? null
          : `${file.mimetype} cannot be read automatically — classify it by hand.`,
        created_by: userId,
      } as never).returning();

      if (item.status === "pending") created.push(item.id);
    } catch (err) {
      const reason = (err as Error)?.message ?? String(err);
      console.error(`[document-intake] upload failed (${fileName}):`, reason);
      failed.push({ file_name: fileName, error: reason });
    }
  }

  await logAction({
    entityType: "document_intake", entityId: 0, action: "CREATE",
    newValue: { batch_id: batchId, uploaded: files.length - failed.length, failed: failed.length },
  }).catch(() => {});

  res.status(201).json({
    batch_id: batchId,
    uploaded: files.length - failed.length,
    scanning: created.length,
    failed,
  });

  // Fired after the response: the client is not kept waiting on model calls, and
  // a scan failure can no longer turn a successful upload into a 500.
  if (created.length) void runScanBatch(created);
});

/** GET /v1/document-intake?status=&batch_id= — the review queue, newest first. */
router.get("/v1/document-intake", async (req, res): Promise<void> => {
  const { status, batch_id } = req.query as Record<string, string | undefined>;
  const conds = [];
  if (status && status !== "_all") conds.push(eq(documentIntakeTable.status, status));
  if (batch_id) conds.push(eq(documentIntakeTable.batch_id, batch_id));
  const rows = await db
    .select().from(documentIntakeTable)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(documentIntakeTable.created_at));
  res.json(await withDocuments(rows));
});

/** GET /v1/document-intake/summary — counts per status, for the tab badges. */
router.get("/v1/document-intake/summary", async (_req, res): Promise<void> => {
  const rows = await db.select({ status: documentIntakeTable.status }).from(documentIntakeTable);
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
  res.json({ counts, total: rows.length });
});

/**
 * POST /v1/document-intake/:id/rescan
 *
 * Re-reads one item, always from the contents. The reviewer has already seen and
 * rejected whatever the filename produced, so falling back to it again would
 * return the same wrong answer.
 */
router.post("/v1/document-intake/:id/rescan", async (req, res): Promise<void> => {
  const id = String(req.params["id"] ?? "");
  const [item] = await db.select().from(documentIntakeTable).where(eq(documentIntakeTable.id, id));
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  if (item.status === "filed") { res.status(409).json({ error: "Already filed" }); return; }

  try {
    const ctx = await loadMatchContext();
    const outcome = await scanOne(id, ctx, { preferContents: true });
    await applyOutcome(id, outcome);
    const [updated] = await db.select().from(documentIntakeTable).where(eq(documentIntakeTable.id, id));
    res.json((await withDocuments([updated]))[0]);
  } catch (err) {
    const reason = (err as Error)?.message ?? String(err);
    await applyOutcome(id, failureOutcome(err)).catch(() => {});
    res.status(502).json({ error: `Could not read the document: ${reason}` });
  }
});

/**
 * POST /v1/document-intake/:id/confirm  { entity_type, entity_id, doc_type }
 *
 * The only path that files anything. It moves the parked `documents` row onto
 * its real record and — the part that matters — recalculates `retention_until`
 * from the confirmed doc_type, so the destruction date reflects what the
 * document actually is rather than the placeholder it was parked under.
 */
router.post("/v1/document-intake/:id/confirm", async (req, res): Promise<void> => {
  const id = String(req.params["id"] ?? "");
  const body = (req.body ?? {}) as Record<string, unknown>;

  const [item] = await db.select().from(documentIntakeTable).where(eq(documentIntakeTable.id, id));
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  if (item.status === "filed") { res.status(409).json({ error: "Already filed" }); return; }

  const entityType = String(body["entity_type"] ?? item.suggested_entity_type ?? "");
  const entityId = Number(body["entity_id"] ?? item.suggested_entity_id);
  const docType = String(body["doc_type"] ?? item.detected_doc_type ?? "other");

  if (!FILEABLE_ENTITIES.has(entityType) || !Number.isInteger(entityId) || entityId <= 0) {
    res.status(400).json({ error: "Choose a record to file this document against" }); return;
  }
  if (!INTAKE_DOC_TYPES.includes(docType as IntakeDocType)) {
    res.status(400).json({ error: `Unsupported doc_type: ${docType}` }); return;
  }
  if (PERSON_ONLY_DOC_TYPES.has(docType) && !PERSON_ENTITIES.has(entityType)) {
    // Refused rather than silently re-filed: an identity document is destroyed
    // after 30 days, and filing it on a contract would either have the purge job
    // delete a contract attachment a month later or keep an ID for seven years.
    res.status(400).json({
      error: `${docType} must be filed against the person it identifies, not a ${entityType}.`,
    });
    return;
  }
  if (!(await entityExists(entityType, entityId))) { res.status(404).json({ error: "Record not found" }); return; }

  // The reviewer may override the index the scan proposed; whatever they leave
  // alone falls back to what was read off the page.
  const scanIndex = indexFromScan(item);
  const docDate = typeof body["doc_date"] === "string" ? String(body["doc_date"]) : scanIndex.doc_date;
  const docYear = Number(body["doc_year"]) || scanIndex.doc_year;
  const tags = Array.isArray(body["tags"]) ? (body["tags"] as string[]) : scanIndex.tags;

  await db.update(documentsTable).set({
    entity_type: entityType,
    entity_id: entityId,
    doc_type: docType,
    doc_date: docDate,
    // Falling back to the upload year keeps every filed document reachable from
    // a year filter, even when the page gave no date at all.
    doc_year: docYear ?? new Date().getFullYear(),
    tags,
    retention_until: calcRetentionDate(docType),
    updated_at: new Date(),
  } as never).where(eq(documentsTable.id, item.document_id));

  await db.update(documentIntakeTable).set({
    status: "filed",
    filed_entity_type: entityType,
    filed_entity_id: entityId,
    filed_doc_type: docType,
    filed_at: new Date(),
    filed_by: (req as any).user?.id ?? null,
    updated_at: new Date(),
  }).where(eq(documentIntakeTable.id, id));

  await logAction({
    entityType: `${entityType}_document`, entityId, action: "CREATE",
    newValue: {
      file_name: item.file_name,
      doc_type: docType,
      via: "intake",
      // Kept so a later mis-filing can be told apart from a mis-read.
      suggested: { entity_type: item.suggested_entity_type, entity_id: item.suggested_entity_id },
    },
  }).catch(() => {});

  const [updated] = await db.select().from(documentIntakeTable).where(eq(documentIntakeTable.id, id));
  res.json((await withDocuments([updated]))[0]);
});

/**
 * POST /v1/document-intake/confirm-batch  { batch_id }
 *
 * Files every confidently-matched item in a batch on its own suggestion.
 * Items in `review` are left alone by design — bulk-accepting the ones the
 * matcher was unsure about is exactly the mistake this whole flow exists to
 * prevent.
 */
router.post("/v1/document-intake/confirm-batch", async (req, res): Promise<void> => {
  const batchId = String((req.body ?? {})["batch_id"] ?? "");
  if (!batchId) { res.status(400).json({ error: "batch_id is required" }); return; }

  const rows = await db.select().from(documentIntakeTable).where(and(
    eq(documentIntakeTable.batch_id, batchId),
    eq(documentIntakeTable.status, "scanned"),
  ));

  const userId = (req as any).user?.id ?? null;
  let filed = 0;
  const skipped: Array<{ id: string; file_name: string; reason: string }> = [];

  for (const item of rows) {
    const entityType = item.suggested_entity_type ?? "";
    const entityId = item.suggested_entity_id ?? 0;
    const docType = item.detected_doc_type ?? "other";
    if (!FILEABLE_ENTITIES.has(entityType) || entityId <= 0) {
      skipped.push({ id: item.id, file_name: item.file_name, reason: "no suggested record" }); continue;
    }
    if (PERSON_ONLY_DOC_TYPES.has(docType) && !PERSON_ENTITIES.has(entityType)) {
      skipped.push({ id: item.id, file_name: item.file_name, reason: "identity document needs a person" }); continue;
    }
    if (!(await entityExists(entityType, entityId))) {
      skipped.push({ id: item.id, file_name: item.file_name, reason: "record no longer exists" }); continue;
    }

    const idx = indexFromScan(item);
    await db.update(documentsTable).set({
      entity_type: entityType,
      entity_id: entityId,
      doc_type: docType,
      doc_date: idx.doc_date,
      doc_year: idx.doc_year ?? new Date().getFullYear(),
      tags: idx.tags,
      retention_until: calcRetentionDate(docType),
      updated_at: new Date(),
    } as never).where(eq(documentsTable.id, item.document_id));

    await db.update(documentIntakeTable).set({
      status: "filed",
      filed_entity_type: entityType,
      filed_entity_id: entityId,
      filed_doc_type: docType,
      filed_at: new Date(),
      filed_by: userId,
      updated_at: new Date(),
    }).where(eq(documentIntakeTable.id, item.id));
    filed++;
  }

  await logAction({
    entityType: "document_intake", entityId: 0, action: "UPDATE",
    newValue: { batch_id: batchId, filed, skipped: skipped.length },
  }).catch(() => {});

  res.json({ filed, skipped });
});

/**
 * DELETE /v1/document-intake/:id — discard a parked file and drop the asset.
 *
 * Only ever touches parked files: once filed, an attachment is removed through
 * the documents endpoint like any other, which is where the snapshot and
 * retention rules live.
 */
router.delete("/v1/document-intake/:id", async (req, res): Promise<void> => {
  const id = String(req.params["id"] ?? "");
  const [item] = await db.select().from(documentIntakeTable).where(eq(documentIntakeTable.id, id));
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  if (item.status === "filed") {
    res.status(409).json({ error: "Filed documents are removed from the record they belong to." }); return;
  }

  const [doc] = await db.select().from(documentsTable)
    .where(and(eq(documentsTable.id, item.document_id), isNull(documentsTable.deleted_at)));
  if (doc) {
    await db.update(documentsTable).set({ deleted_at: new Date() }).where(eq(documentsTable.id, doc.id));
    await deleteFromCloudinary(doc.cloudinary_public_id, doc.resource_type).catch(() => {});
  }
  await db.update(documentIntakeTable)
    .set({ status: "discarded", updated_at: new Date() })
    .where(eq(documentIntakeTable.id, id));

  await logAction({
    entityType: "document_intake", entityId: 0, action: "DELETE",
    oldValue: { file_name: item.file_name, batch_id: item.batch_id },
  }).catch(() => {});

  res.status(204).end();
});

export default router;
