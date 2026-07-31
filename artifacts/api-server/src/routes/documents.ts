import { Router } from "express";
import multer from "multer";
import {
  db, invoicesTable, contractsTable, accountsTable, bookingsTable, quotesTable,
  contactsTable, propertiesTable, spacesTable, workOrdersTable, documentsTable,
} from "@workspace/db";
import { and, eq, ilike, isNull, desc } from "drizzle-orm";
import { listSnapshots } from "../lib/documents/freeze";
import { calcRetentionDate } from "../lib/retention";
import { decodeUploadFilename } from "../lib/uploadFilename";
import { logAction } from "../utils/auditLog";
import {
  uploadPrivateToCloudinary, deleteFromCloudinary, fetchPrivateAsset,
  cldFolder, isCloudinaryConfigured,
} from "../utils/cloudinary";

/**
 * Document Hub — unified cross-cutting index over all customer-facing documents
 * (Phase 2). Rather than duplicating storage, this aggregates existing records
 * (invoices, receipts, contracts) into one common shape, each with a link back
 * to its source record and a ready-to-render PDF URL. Quotes plug in here once
 * the `quotes` model lands.
 */
const router = Router();

export interface HubDocument {
  doc_type: "Invoice" | "Receipt" | "Contract" | "Quote";
  source_id: number;
  ref: string;
  status: string;
  amount: number | null;
  currency: string | null;
  party: string | null;
  links: string[];
  date: string | null;
  detail_url: string;
  pdf_url: string;
}

async function accountNameMap(ids: number[]): Promise<Record<number, string>> {
  const map: Record<number, string> = {};
  for (const id of [...new Set(ids)]) {
    const [a] = await db.select({ id: accountsTable.id, name: accountsTable.name })
      .from(accountsTable).where(eq(accountsTable.id, id));
    if (a) map[a.id] = a.name;
  }
  return map;
}

async function bookingRefMap(ids: number[]): Promise<Record<number, string>> {
  const map: Record<number, string> = {};
  for (const id of [...new Set(ids)]) {
    const [b] = await db.select({ id: bookingsTable.id, booking_ref: bookingsTable.booking_ref })
      .from(bookingsTable).where(eq(bookingsTable.id, id));
    if (b) map[b.id] = b.booking_ref;
  }
  return map;
}

router.get("/v1/documents", async (req, res): Promise<void> => {
  const { q, type } = req.query as Record<string, string>;
  const wantsType = (t: HubDocument["doc_type"]) => !type || type === "_all" || type === t;
  const docs: HubDocument[] = [];

  // ── Invoices + Receipts ──────────────────────────────────────────────
  if (wantsType("Invoice") || wantsType("Receipt")) {
    const invConds: any[] = [isNull(invoicesTable.deleted_at)];
    if (q) invConds.push(ilike(invoicesTable.invoice_ref, `%${q}%`));
    const invoices = await db.select().from(invoicesTable).where(and(...invConds)).orderBy(desc(invoicesTable.id));

    const accIds = invoices.map(i => i.account_id).filter(Boolean) as number[];
    const bkIds = invoices.map(i => i.booking_id).filter(Boolean) as number[];
    const accMap = await accountNameMap(accIds);
    const bkMap = await bookingRefMap(bkIds);

    for (const inv of invoices) {
      const links = [
        inv.booking_id && bkMap[inv.booking_id] ? `Booking ${bkMap[inv.booking_id]}` : null,
      ].filter(Boolean) as string[];
      const party = inv.account_id ? (accMap[inv.account_id] ?? null) : null;

      if (wantsType("Invoice")) {
        docs.push({
          doc_type: "Invoice", source_id: inv.id, ref: inv.invoice_ref, status: inv.status,
          amount: Number(inv.amount), currency: inv.currency, party, links,
          date: (inv.created_at as Date | null)?.toISOString() ?? null,
          detail_url: `/finance/invoices/${inv.id}`,
          pdf_url: `/api/v1/invoices/${inv.id}/pdf`,
        });
      }
      if (wantsType("Receipt") && inv.status === "Paid") {
        docs.push({
          doc_type: "Receipt", source_id: inv.id, ref: inv.invoice_ref, status: "Paid",
          amount: Number(inv.amount), currency: inv.currency, party, links,
          date: (inv.paid_at as Date | null)?.toISOString() ?? (inv.created_at as Date | null)?.toISOString() ?? null,
          detail_url: `/finance/invoices/${inv.id}`,
          pdf_url: `/api/v1/invoices/${inv.id}/receipt/pdf`,
        });
      }
    }
  }

  // ── Contracts ────────────────────────────────────────────────────────
  if (wantsType("Contract")) {
    const cConds: any[] = [isNull(contractsTable.deleted_at)];
    if (q) cConds.push(ilike(contractsTable.contract_ref, `%${q}%`));
    const contracts = await db.select().from(contractsTable).where(and(...cConds)).orderBy(desc(contractsTable.id));

    const accIds = contracts.map(c => c.tenant_account_id).filter(Boolean) as number[];
    const bkIds = contracts.map(c => c.booking_id).filter(Boolean) as number[];
    const accMap = await accountNameMap(accIds);
    const bkMap = await bookingRefMap(bkIds);

    for (const c of contracts) {
      const links = [
        c.booking_id && bkMap[c.booking_id] ? `Booking ${bkMap[c.booking_id]}` : null,
      ].filter(Boolean) as string[];
      docs.push({
        doc_type: "Contract", source_id: c.id, ref: c.contract_ref, status: c.status,
        amount: c.total_rent != null ? Number(c.total_rent) : null, currency: c.currency,
        party: c.tenant_account_id ? (accMap[c.tenant_account_id] ?? null) : null, links,
        date: (c.created_at as Date | null)?.toISOString() ?? null,
        detail_url: `/booking/contracts/${c.id}`,
        pdf_url: `/api/v1/contracts/${c.id}/pdf`,
      });
    }
  }

  // ── Quotes ───────────────────────────────────────────────────────────
  if (wantsType("Quote")) {
    const qConds: any[] = [isNull(quotesTable.deleted_at)];
    if (q) qConds.push(ilike(quotesTable.quote_ref, `%${q}%`));
    const quotes = await db.select().from(quotesTable).where(and(...qConds)).orderBy(desc(quotesTable.id));
    const accMap = await accountNameMap(quotes.map(x => x.account_id).filter(Boolean) as number[]);
    for (const x of quotes) {
      docs.push({
        doc_type: "Quote", source_id: x.id, ref: x.quote_ref, status: x.status,
        amount: Number(x.total), currency: x.currency,
        party: x.account_id ? (accMap[x.account_id] ?? null) : null, links: [],
        date: (x.created_at as Date | null)?.toISOString() ?? null,
        detail_url: `/documents/quotes/${x.id}`,
        pdf_url: `/api/v1/quotes/${x.id}/pdf`,
      });
    }
  }

  docs.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  res.json(docs);
});

/**
 * List frozen (immutable) document snapshots for a record, with short-lived
 * signed download URLs.
 *   GET /v1/document-snapshots?entity_type=invoice&entity_id=123
 */
router.get("/v1/document-snapshots", async (req, res): Promise<void> => {
  const entityType = String(req.query.entity_type ?? "");
  const entityId = Number(req.query.entity_id);
  if (!entityType || !Number.isFinite(entityId)) {
    res.status(400).json({ error: "entity_type and entity_id are required" }); return;
  }
  res.json(await listSnapshots(entityType, entityId));
});

// ── Generic attachments ──────────────────────────────────────────────────────
//
// One upload/list/serve/delete path for every record that needs paperwork filed
// against it (a contract's scanned signed original, a property's title deed, a
// contact's ID scan …). Before this, each route grew its own copy — `contacts`,
// `accounts` and `company-info` each had one and `contracts` had none at all,
// so a signed original had nowhere to live.
//
// Storage stays exactly as the rest of the app does it: bytes go to Cloudinary
// as `authenticated` (never publicly addressable) and `documents` holds the only
// index, so the APP 11 retention purge keeps working untouched. There is no
// per-record folder tree — (entity_type, entity_id, doc_type) *is* the filing
// structure; the Cloudinary folder is only there to keep the console readable.

const attachmentUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

/** Records paperwork may be filed against, and the table each id must exist in. */
const ATTACHABLE_ENTITIES = {
  contract: contractsTable,
  invoice: invoicesTable,
  quote: quotesTable,
  booking: bookingsTable,
  account: accountsTable,
  contact: contactsTable,
  property: propertiesTable,
  space: spacesTable,
  work_order: workOrdersTable,
} as const;

type AttachableEntity = keyof typeof ATTACHABLE_ENTITIES;

/** Entities that are a *person*, and so may hold identity documents. */
const PERSON_ENTITIES = new Set<AttachableEntity>(["contact"]);

/**
 * Selectable document types. Each key is also the retention policy key in
 * `retention.ts`, so classifying a file is what sets its destruction date.
 *
 * `personOnly` types are the reason this matters: an ID or visa scan is destroyed
 * after 30 days (APP 11), while a contract is kept for 7 years. Filing an ID
 * against the contract instead of against the person would either have the purge
 * job delete a contract attachment a month later, or keep an identity document
 * for seven years. So identity documents belong to the person, and the contract
 * carries only the verification fact.
 */
const UPLOADABLE_DOC_TYPES: Record<string, { personOnly?: boolean }> = {
  contract: {},            // 7y — signed original scans, annexes, addenda
  tax_invoice: {},         // 5y
  receipt: {},             // 5y
  property_document: {},   // 7y — 등기부등본, 건축물대장, title deeds
  id_document: { personOnly: true },   // 30d
  visa_document: { personOnly: true }, // 30d
  other: {},               // 2y
};

/** Company paperwork is role-gated by its own route and must not leak through here. */
const ORG_ENTITY_TYPE = "organisation";

function isAttachable(t: string): t is AttachableEntity {
  return Object.prototype.hasOwnProperty.call(ATTACHABLE_ENTITIES, t);
}

async function entityExists(entityType: AttachableEntity, entityId: number): Promise<boolean> {
  const table = ATTACHABLE_ENTITIES[entityType];
  const [row] = await db.select({ id: table.id }).from(table).where(eq(table.id, entityId)).limit(1);
  return !!row;
}

interface AttachmentDto {
  id: string;
  entity_type: string;
  entity_id: number;
  doc_type: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  /** Set on frozen snapshots of sent documents; null on manual uploads. */
  version: number | null;
  doc_ref: string | null;
  retention_until: string | null;
  created_at: string | null;
  /** Always our own streaming endpoint — see the GET .../file comment. */
  file_url: string;
}

function toDto(d: typeof documentsTable.$inferSelect): AttachmentDto {
  return {
    id: d.id,
    entity_type: d.entity_type,
    entity_id: d.entity_id,
    doc_type: d.doc_type,
    file_name: d.file_name,
    file_size: d.file_size,
    mime_type: d.mime_type,
    version: d.version,
    doc_ref: d.doc_ref,
    retention_until: d.retention_until?.toISOString() ?? null,
    created_at: d.created_at?.toISOString() ?? null,
    file_url: `/api/v1/documents/${d.id}/file`,
  };
}

/**
 * GET /v1/documents/entity/:entityType/:entityId
 *
 * Everything filed against one record — both manual uploads and the frozen
 * snapshots `freezeDocument()` writes when a document is sent — newest first.
 * No signed URLs are handed out: each row carries `file_url` pointing back at
 * our own streaming endpoint, which re-checks auth on every view.
 */
router.get("/v1/documents/entity/:entityType/:entityId", async (req, res): Promise<void> => {
  const entityType = String(req.params["entityType"] ?? "");
  const entityId = Number(req.params["entityId"]);
  if (!isAttachable(entityType) || !Number.isInteger(entityId)) {
    res.status(400).json({ error: "Unsupported entity" }); return;
  }
  const rows = await db.select().from(documentsTable)
    .where(and(
      eq(documentsTable.entity_type, entityType),
      eq(documentsTable.entity_id, entityId),
      isNull(documentsTable.deleted_at),
    ))
    .orderBy(desc(documentsTable.created_at));
  res.json(rows.map(toDto));
});

/**
 * POST /v1/documents  (multipart: file, entity_type, entity_id, doc_type)
 */
router.post("/v1/documents", attachmentUpload.single("file"), async (req, res): Promise<void> => {
  const file = req.file;
  const body = (req.body ?? {}) as Record<string, string>;
  const entityType = String(body["entity_type"] ?? "");
  const entityId = Number(body["entity_id"]);
  const docType = String(body["doc_type"] ?? "other");

  if (!file) { res.status(400).json({ error: "A file is required" }); return; }
  if (!isAttachable(entityType) || !Number.isInteger(entityId)) {
    res.status(400).json({ error: "Unsupported entity" }); return;
  }
  const rule = UPLOADABLE_DOC_TYPES[docType];
  if (!rule) { res.status(400).json({ error: `Unsupported doc_type: ${docType}` }); return; }
  if (rule.personOnly && !PERSON_ENTITIES.has(entityType)) {
    // Refused rather than silently re-filed: the uploader picked the wrong
    // record, and accepting it here would put a 30-day retention document on a
    // 7-year record.
    res.status(400).json({
      error: `${docType} must be filed against the person it identifies, not a ${entityType}.`,
    });
    return;
  }
  if (!(await entityExists(entityType, entityId))) { res.status(404).json({ error: "Record not found" }); return; }
  if (!isCloudinaryConfigured()) { res.status(503).json({ error: "File storage is not configured" }); return; }

  const fileName = decodeUploadFilename(file.originalname).slice(0, 255);
  try {
    // resource_type "auto": attachments arrive as PDFs, phone photos, scans and
    // Office files, and Cloudinary's default image pipeline rejects whatever it
    // cannot decode.
    const up = await uploadPrivateToCloudinary(file.buffer, {
      folder: cldFolder(`private/${entityType}`),
      resource_type: "auto",
    });
    const [row] = await db.insert(documentsTable).values({
      entity_type: entityType,
      entity_id: entityId,
      doc_type: docType,
      file_name: fileName,
      file_size: file.size,
      mime_type: file.mimetype.slice(0, 100),
      cloudinary_public_id: up.public_id,
      resource_type: up.resource_type,
      uploaded_by: (req as any).user?.id ?? null,
      uploaded_by_type: "User",
      retention_until: calcRetentionDate(docType),
    } as never).returning();
    await logAction({
      entityType: `${entityType}_document`, entityId, action: "CREATE",
      newValue: { file_name: fileName, doc_type: docType },
    }).catch(() => {});
    res.status(201).json({ success: true, document: toDto(row) });
  } catch (err) {
    const reason = (err as any)?.message ?? String(err);
    console.error(`[documents] upload failed (${fileName}):`, reason);
    res.status(500).json({ error: `File upload failed: ${reason}` });
  }
});

/**
 * GET /v1/documents/:docId/file — stream the bytes.
 *
 * Deliberately not a Cloudinary signed URL: the account blocks PDF delivery
 * through the image pipeline, so a signed delivery URL comes back 401 and the
 * preview modal renders blank. Fetching server-side also keeps the account's
 * api_key off the client and re-checks auth on every single view.
 */
router.get("/v1/documents/:docId/file", async (req, res): Promise<void> => {
  const docId = String(req.params["docId"] ?? "");
  if (!docId) { res.status(400).json({ error: "Invalid request" }); return; }
  const [doc] = await db.select().from(documentsTable)
    .where(and(eq(documentsTable.id, docId), isNull(documentsTable.deleted_at)));
  if (!doc || doc.entity_type === ORG_ENTITY_TYPE) { res.status(404).json({ error: "Not found" }); return; }

  // Raw assets carry their extension inside the public_id; image-pipeline assets
  // need the format passed separately.
  const ext = doc.file_name.includes(".") ? doc.file_name.split(".").pop()! : "";
  const format = doc.resource_type === "raw" ? "" : ext;
  try {
    const asset = await fetchPrivateAsset(doc.cloudinary_public_id, { format, resourceType: doc.resource_type });
    res.setHeader("Content-Type", doc.mime_type || asset.contentType);
    res.setHeader("Content-Length", asset.buffer.length);
    res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(doc.file_name)}`);
    res.setHeader("Cache-Control", "private, no-store");
    res.end(asset.buffer);
  } catch (err) {
    const reason = (err as any)?.message ?? String(err);
    console.error(`[documents] fetch failed (${doc.file_name}):`, reason);
    res.status(502).json({ error: `Could not load the document: ${reason}` });
  }
});

/**
 * DELETE /v1/documents/:docId — soft-delete the row and drop the asset.
 *
 * Frozen snapshots (`version` set) are refused: they are the exact bytes a
 * customer received, and the retention purge is what removes them once their
 * statutory period is up.
 */
router.delete("/v1/documents/:docId", async (req, res): Promise<void> => {
  const docId = String(req.params["docId"] ?? "");
  if (!docId) { res.status(400).json({ error: "Invalid request" }); return; }
  const [doc] = await db.select().from(documentsTable)
    .where(and(eq(documentsTable.id, docId), isNull(documentsTable.deleted_at)));
  if (!doc || doc.entity_type === ORG_ENTITY_TYPE) { res.status(404).json({ error: "Not found" }); return; }
  if (doc.version != null) {
    res.status(409).json({ error: "Issued document snapshots cannot be deleted." }); return;
  }
  await db.update(documentsTable).set({ deleted_at: new Date() }).where(eq(documentsTable.id, doc.id));
  await deleteFromCloudinary(doc.cloudinary_public_id, doc.resource_type);
  await logAction({
    entityType: `${doc.entity_type}_document`, entityId: doc.entity_id, action: "DELETE",
    oldValue: { file_name: doc.file_name, doc_type: doc.doc_type },
  }).catch(() => {});
  res.status(204).end();
});

export default router;
