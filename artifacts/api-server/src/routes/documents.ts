import { Router } from "express";
import multer from "multer";
import {
  db, invoicesTable, contractsTable, accountsTable, bookingsTable, quotesTable,
  contactsTable, propertiesTable, spacesTable, workOrdersTable, documentsTable,
} from "@workspace/db";
import { and, eq, ilike, inArray, notInArray, isNull, or, sql, desc } from "drizzle-orm";
import { listSnapshots } from "../lib/documents/freeze";
import { calcRetentionDate } from "../lib/retention";
import { CONTRACT_CHECKLIST, evaluateChecklist } from "../lib/documents/checklist";
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
  property_document: {},   // 7y — general property paperwork, title deeds
  id_document: { personOnly: true },   // 30d
  visa_document: { personOnly: true }, // 30d

  // Korean tenancy paperwork. These used to land in `other` and be destroyed
  // after 2 years; each now follows the obligation it evidences (retention.ts).
  brokerage_disclosure: {},  // 7y — 중개대상물 확인·설명서
  lease_report: {},          // 7y — 임대차 신고필증
  property_register: {},     // 7y — 등기부등본
  building_ledger: {},       // 7y — 건축물대장
  settlement_statement: {},  // 5y — 관리비 정산서
  move_in_out_report: {},    // 5y — 입·퇴실 확인서
  repair_record: {},         // 5y — 하자·수선 내역
  bank_account_copy: {},     // 5y — 계좌·통장 사본 (see retention.ts)

  other: {},               // 2y
};

/** Company paperwork is role-gated by its own route and must not leak through here. */
const ORG_ENTITY_TYPE = "organisation";
/** Bulk-upload files parked by the intake flow, not yet filed against a record. */
const INTAKE_ENTITY_TYPE = "intake";

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
  /** Filing index — see the columns' comments in the schema. */
  title: string | null;
  doc_date: string | null;
  doc_year: number | null;
  tags: string[];
  retention_until: string | null;
  created_at: string | null;
  /** Always our own streaming endpoint — see the GET .../file comment. */
  file_url: string;
}

/** Tags are stored as jsonb; tolerate anything that is not a clean string array. */
function readTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((t): t is string => typeof t === "string" && t.trim().length > 0).map((t) => t.trim());
}

/**
 * Normalise submitted tags: trim, drop blanks, de-duplicate case-insensitively,
 * and cap the list. Keywords are typed by hand, so "홍길동", " 홍길동" and
 * "홍길동" pasted twice must not become three different tags.
 */
function parseTags(raw: unknown): string[] {
  const list =
    Array.isArray(raw) ? raw
    : typeof raw === "string" && raw.trim() ? raw.split(",")
    : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") continue;
    const value = item.trim().slice(0, 60);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= 20) break;
  }
  return out;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Wide enough for historic paperwork, narrow enough to catch a typo'd year. */
const MIN_YEAR = 1900;
const MAX_YEAR = 2200;

function parseYear(raw: unknown): number | null {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < MIN_YEAR || n > MAX_YEAR) return null;
  return n;
}

/**
 * Resolve the filing year from whatever the uploader gave.
 *
 * An explicit year wins; otherwise it is taken from the document's own date.
 * The upload date is deliberately NOT a fallback here — the POST handler adds
 * it, but only after this has had its chance, so a document that carries its
 * own date is never filed under the year it happened to be scanned.
 */
function resolveYear(year: unknown, docDate: string | null): number | null {
  return parseYear(year) ?? (docDate ? parseYear(docDate.slice(0, 4)) : null);
}

function parseDocDate(raw: unknown): string | null {
  return typeof raw === "string" && ISO_DATE.test(raw.trim()) ? raw.trim() : null;
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
    title: d.title,
    doc_date: d.doc_date,
    doc_year: d.doc_year,
    tags: readTags(d.tags),
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
  const title = String(body["title"] ?? "").trim().slice(0, 255) || null;
  const docDate = parseDocDate(body["doc_date"]);
  const tags = parseTags(body["tags"]);
  // Upload date is the last resort, so a document that states its own date is
  // never filed under the year it was scanned.
  const docYear = resolveYear(body["doc_year"], docDate) ?? new Date().getFullYear();

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
      title,
      doc_date: docDate,
      doc_year: docYear,
      tags,
      uploaded_by: (req as any).user?.id ?? null,
      uploaded_by_type: "User",
      retention_until: calcRetentionDate(docType),
    } as never).returning();
    await logAction({
      entityType: `${entityType}_document`, entityId, action: "CREATE",
      newValue: { file_name: fileName, doc_type: docType, doc_year: docYear, tags },
    }).catch(() => {});
    res.status(201).json({ success: true, document: toDto(row) });
  } catch (err) {
    const reason = (err as any)?.message ?? String(err);
    console.error(`[documents] upload failed (${fileName}):`, reason);
    res.status(500).json({ error: `File upload failed: ${reason}` });
  }
});

// ── Document library ─────────────────────────────────────────────────────────
//
// The per-record panel answers "what is filed on this contract?". This answers
// the other question — "where is the 2023 lease for unit 1503?" — across every
// record at once, by year, by type and by keyword.

/** Records whose name is worth showing next to a document in the library. */
const LABELLED_ENTITIES = {
  contract: { table: contractsTable, column: contractsTable.contract_ref, path: "/booking/contracts" },
  invoice: { table: invoicesTable, column: invoicesTable.invoice_ref, path: "/finance/invoices" },
  quote: { table: quotesTable, column: quotesTable.quote_ref, path: "/documents/quotes" },
  booking: { table: bookingsTable, column: bookingsTable.booking_ref, path: "/booking/bookings" },
  account: { table: accountsTable, column: accountsTable.name, path: "/account/accounts" },
  property: { table: propertiesTable, column: propertiesTable.name, path: "/property/properties" },
  space: { table: spacesTable, column: spacesTable.name, path: "/property/spaces" },
} as const;

/**
 * Look up the display name of every record referenced by a page of documents,
 * one query per entity type rather than one per document.
 *
 * Contacts are handled separately because a person's label is two columns.
 */
async function labelEntities(
  rows: Array<{ entity_type: string; entity_id: number }>,
): Promise<Map<string, string>> {
  const byType = new Map<string, Set<number>>();
  for (const r of rows) {
    if (!byType.has(r.entity_type)) byType.set(r.entity_type, new Set());
    byType.get(r.entity_type)!.add(r.entity_id);
  }

  const labels = new Map<string, string>();
  for (const [type, ids] of byType) {
    const idList = [...ids];
    if (!idList.length) continue;

    if (type === "contact") {
      const found = await db
        .select({ id: contactsTable.id, first: contactsTable.first_name, last: contactsTable.last_name })
        .from(contactsTable)
        .where(inArray(contactsTable.id, idList));
      for (const c of found) labels.set(`contact:${c.id}`, `${c.last}${c.first}`);
      continue;
    }

    const meta = LABELLED_ENTITIES[type as keyof typeof LABELLED_ENTITIES];
    if (!meta) continue;
    const found = await db
      .select({ id: meta.table.id, label: meta.column })
      .from(meta.table)
      .where(inArray(meta.table.id, idList));
    for (const row of found) labels.set(`${type}:${row.id}`, String(row.label ?? ""));
  }
  return labels;
}

/**
 * The unit a document ultimately belongs to.
 *
 * Paperwork is filed against the record it concerns — usually a contract, not a
 * unit — but "everything ever filed for 1503호" is what people actually ask,
 * and that has to survive tenants coming and going. So a contract's document
 * inherits the contract's unit, and a document filed straight onto a space
 * keeps its own.
 *
 * Written as one expression because the row query, the filter and the facet
 * count must all agree on the answer.
 */
const docSpaceId = sql<number | null>`case
  when ${documentsTable.entity_type} = 'space' then ${documentsTable.entity_id}
  when ${documentsTable.entity_type} = 'contract'
    then (select c.space_id from contracts c where c.id = ${documentsTable.entity_id})
  else null
end`;

function detailUrlFor(entityType: string, entityId: number): string | null {
  if (entityType === "contact") return `/account/contacts/${entityId}`;
  const meta = LABELLED_ENTITIES[entityType as keyof typeof LABELLED_ENTITIES];
  return meta ? `${meta.path}/${entityId}` : null;
}

/**
 * GET /v1/documents/library?q=&year=&doc_type=&entity_type=
 *
 * Returns matching documents plus the facet counts the filter chips render
 * from. The facets are computed over everything the *other* filters allow, so
 * the year chips stay accurate while a type filter is applied.
 */
router.get("/v1/documents/library", async (req, res): Promise<void> => {
  const { q, year, doc_type: docTypeFilter, entity_type: entityTypeFilter } =
    req.query as Record<string, string | undefined>;

  // Parked intake files have no record yet and company paperwork is role-gated
  // by its own route — neither belongs in a cross-record library.
  const HIDDEN_ENTITY_TYPES = [ORG_ENTITY_TYPE, INTAKE_ENTITY_TYPE];

  // The keyword is part of both the result query and the facet counts (a facet
  // describes the *other* filters, not itself), so it is kept separate rather
  // than positionally recovered from the condition list.
  const searchCond = q?.trim()
    ? or(
        // Tags are jsonb, so they are matched as text — a substring hit inside
        // the serialised array is exactly the "does any keyword contain this?"
        // the search box promises, without a second index to maintain.
        ilike(documentsTable.file_name, `%${q.trim()}%`),
        ilike(documentsTable.title, `%${q.trim()}%`),
        ilike(documentsTable.doc_ref, `%${q.trim()}%`),
        sql`${documentsTable.tags}::text ILIKE ${`%${q.trim()}%`}`,
      )
    : null;

  const base = [
    isNull(documentsTable.deleted_at),
    notInArray(documentsTable.entity_type, HIDDEN_ENTITY_TYPES),
    ...(searchCond ? [searchCond] : []),
  ];

  const conds = [...base];
  if (docTypeFilter && docTypeFilter !== "_all") conds.push(eq(documentsTable.doc_type, docTypeFilter));
  if (entityTypeFilter && entityTypeFilter !== "_all") conds.push(eq(documentsTable.entity_type, entityTypeFilter));
  const parsedYear = parseYear(year);
  if (year === "_none") conds.push(isNull(documentsTable.doc_year));
  else if (parsedYear) conds.push(eq(documentsTable.doc_year, parsedYear));

  // Still accepted even though the screen has no unit picker: the unit column
  // is derived from the same expression, so narrowing to one unit is free.
  const spaceId = Number(req.query["space_id"]);
  if (Number.isInteger(spaceId) && spaceId > 0) conds.push(sql`${docSpaceId} = ${spaceId}`);

  const rows = await db
    .select({ doc: documentsTable, space_id: docSpaceId })
    .from(documentsTable)
    .where(and(...conds))
    .orderBy(desc(documentsTable.doc_year), desc(documentsTable.created_at))
    .limit(500);

  const docs = rows.map((r) => r.doc);
  const labels = await labelEntities(docs);

  const rowSpaceIds = [...new Set(rows.map((r) => r.space_id).filter((v): v is number => v != null))];
  const rowSpaces = rowSpaceIds.length
    ? await db.select({ id: spacesTable.id, name: spacesTable.name })
        .from(spacesTable).where(inArray(spacesTable.id, rowSpaceIds))
    : [];
  const rowSpaceNames = new Map(rowSpaces.map((sp) => [sp.id, sp.name]));

  // Facets ignore the filter they describe, so selecting 2023 does not reduce
  // the year list to just 2023 and strand the user there.
  const facetConds = base;
  const [years, types, entityTypes] = await Promise.all([
    db.select({ value: documentsTable.doc_year, count: sql<number>`count(*)::int` })
      .from(documentsTable).where(and(...facetConds)).groupBy(documentsTable.doc_year),
    db.select({ value: documentsTable.doc_type, count: sql<number>`count(*)::int` })
      .from(documentsTable).where(and(...facetConds)).groupBy(documentsTable.doc_type),
    db.select({ value: documentsTable.entity_type, count: sql<number>`count(*)::int` })
      .from(documentsTable).where(and(...facetConds)).groupBy(documentsTable.entity_type),
  ]);

  res.json({
    documents: rows.map((r) => ({
      ...toDto(r.doc),
      entity_label: labels.get(`${r.doc.entity_type}:${r.doc.entity_id}`) ?? null,
      detail_url: detailUrlFor(r.doc.entity_type, r.doc.entity_id),
      space_id: r.space_id,
      space_name: r.space_id != null ? (rowSpaceNames.get(r.space_id) ?? null) : null,
    })),
    // Newest year first; documents with no year sort to the end as null.
    facets: {
      years: years
        .map((y) => ({ value: y.value, count: y.count }))
        .sort((a, b) => (b.value ?? 0) - (a.value ?? 0)),
      doc_types: types.sort((a, b) => b.count - a.count),
      entity_types: entityTypes.sort((a, b) => b.count - a.count),
    },
    truncated: docs.length === 500,
  });
});


// ── Compliance: what is missing, and what is about to expire ─────────────────
//
// Two questions with the same shape — "which tenancies need attention?" — so
// they are answered by one pass over the contracts rather than two screens
// asking the database the same thing twice.

/** Contracts in scope. `Completed` tenancies are history, not a to-do list. */
const COMPLIANCE_STATUSES = ["Active", "Signed", "Draft"];

/** Default expiry horizon. 90 days is roughly the notice period a renewal needs. */
const DEFAULT_EXPIRY_DAYS = 90;

interface ComplianceRow {
  contract_id: number;
  contract_ref: string;
  status: string;
  space_id: number | null;
  space_name: string | null;
  tenant_name: string | null;
  start_date: string | null;
  end_date: string | null;
  /** Negative once the end date has passed. Null when the contract has no end. */
  days_to_expiry: number | null;
  checklist: ReturnType<typeof evaluateChecklist>["lines"];
  missing_required: string[];
  complete: boolean;
  /** A later contract already exists on the same unit — the renewal is done. */
  has_successor: boolean;
  detail_url: string;
}

/**
 * GET /v1/documents/compliance?days=90
 *
 * One row per in-scope contract: which checklist items are filed, which are
 * missing, how long until it expires, and whether a successor tenancy already
 * covers the unit.
 */
router.get("/v1/documents/compliance", async (req, res): Promise<void> => {
  const days = Number(req.query["days"]);
  const horizon = Number.isInteger(days) && days > 0 && days <= 730 ? days : DEFAULT_EXPIRY_DAYS;

  const contracts = await db
    .select({
      id: contractsTable.id,
      contract_ref: contractsTable.contract_ref,
      status: contractsTable.status,
      space_id: contractsTable.space_id,
      tenant_account_id: contractsTable.tenant_account_id,
      start_date: contractsTable.start_date,
      end_date: contractsTable.end_date,
    })
    .from(contractsTable)
    .where(and(
      isNull(contractsTable.deleted_at),
      inArray(contractsTable.status, COMPLIANCE_STATUSES),
    ));

  if (!contracts.length) {
    res.json({ rows: [], horizon_days: horizon, checklist: CONTRACT_CHECKLIST });
    return;
  }

  // Everything filed against these contracts, in one query rather than one per
  // contract — the N+1 shape this codebase has been bitten by before.
  const filed = await db
    .select({ entity_id: documentsTable.entity_id, doc_type: documentsTable.doc_type })
    .from(documentsTable)
    .where(and(
      eq(documentsTable.entity_type, "contract"),
      isNull(documentsTable.deleted_at),
      inArray(documentsTable.entity_id, contracts.map((c) => c.id)),
    ));
  const typesByContract = new Map<number, Set<string>>();
  for (const row of filed) {
    if (!typesByContract.has(row.entity_id)) typesByContract.set(row.entity_id, new Set());
    typesByContract.get(row.entity_id)!.add(row.doc_type);
  }

  const spaceIds = [...new Set(contracts.map((c) => c.space_id).filter((v): v is number => v != null))];
  const spaces = spaceIds.length
    ? await db.select({ id: spacesTable.id, name: spacesTable.name })
        .from(spacesTable).where(inArray(spacesTable.id, spaceIds))
    : [];
  const spaceNames = new Map(spaces.map((s) => [s.id, s.name]));

  const accountIds = [...new Set(contracts.map((c) => c.tenant_account_id).filter((v): v is number => v != null))];
  const accounts = accountIds.length
    ? await db.select({ id: accountsTable.id, name: accountsTable.name })
        .from(accountsTable).where(inArray(accountsTable.id, accountIds))
    : [];
  const accountNames = new Map(accounts.map((a) => [a.id, a.name]));

  // A renewal is "done" when another contract on the same unit starts at or
  // after this one ends. Checking the unit rather than the tenant is deliberate:
  // a new tenant moving in also means this tenancy needs no renewal chasing.
  const bySpace = new Map<number, Array<{ start: string | null }>>();
  for (const c of contracts) {
    if (c.space_id == null) continue;
    if (!bySpace.has(c.space_id)) bySpace.set(c.space_id, []);
    bySpace.get(c.space_id)!.push({ start: c.start_date });
  }

  // Compare dates as YYYY-MM-DD strings — the columns are text, and lexical
  // order is chronological in that format.
  const today = new Date().toISOString().slice(0, 10);
  const MS_PER_DAY = 86_400_000;

  const rows: ComplianceRow[] = contracts.map((c) => {
    const evaluated = evaluateChecklist(typesByContract.get(c.id) ?? []);
    const daysToExpiry = c.end_date
      ? Math.round((Date.parse(`${c.end_date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / MS_PER_DAY)
      : null;
    const successors = c.space_id != null ? (bySpace.get(c.space_id) ?? []) : [];
    const hasSuccessor = Boolean(
      c.end_date && successors.some((s) => s.start != null && s.start >= c.end_date!),
    );

    return {
      contract_id: c.id,
      contract_ref: c.contract_ref,
      status: c.status,
      space_id: c.space_id,
      space_name: c.space_id != null ? (spaceNames.get(c.space_id) ?? null) : null,
      tenant_name: c.tenant_account_id != null ? (accountNames.get(c.tenant_account_id) ?? null) : null,
      start_date: c.start_date,
      end_date: c.end_date,
      days_to_expiry: Number.isFinite(daysToExpiry as number) ? daysToExpiry : null,
      checklist: evaluated.lines,
      missing_required: evaluated.missingRequired,
      complete: evaluated.complete,
      has_successor: hasSuccessor,
      detail_url: `/booking/contracts/${c.id}`,
    };
  });

  rows.sort((a, b) => (a.days_to_expiry ?? Infinity) - (b.days_to_expiry ?? Infinity));

  res.json({
    rows,
    horizon_days: horizon,
    checklist: CONTRACT_CHECKLIST,
    summary: {
      total: rows.length,
      incomplete: rows.filter((r) => !r.complete).length,
      // Already past its end date and nothing has replaced it.
      expired: rows.filter((r) => r.days_to_expiry != null && r.days_to_expiry < 0 && !r.has_successor).length,
      expiring: rows.filter((r) =>
        r.days_to_expiry != null && r.days_to_expiry >= 0 && r.days_to_expiry <= horizon && !r.has_successor).length,
    },
  });
});

/**
 * PATCH /v1/documents/:docId — correct a document's filing index.
 *
 * Only the index is editable: title, date, year, keywords and type. The bytes,
 * the record it is filed against and the retention clock are not — moving a
 * document between records or changing what it legally is are different
 * operations with different consequences, not a metadata edit.
 *
 * The one exception is `doc_type`, which *does* move the retention date,
 * so it is recalculated here rather than left stale.
 */
router.patch("/v1/documents/:docId", async (req, res): Promise<void> => {
  const docId = String(req.params["docId"] ?? "");
  const body = (req.body ?? {}) as Record<string, unknown>;
  const [doc] = await db.select().from(documentsTable)
    .where(and(eq(documentsTable.id, docId), isNull(documentsTable.deleted_at)));
  if (!doc || doc.entity_type === ORG_ENTITY_TYPE) { res.status(404).json({ error: "Not found" }); return; }

  const patch: Record<string, unknown> = { updated_at: new Date() };

  if ("title" in body) {
    const title = String(body["title"] ?? "").trim().slice(0, 255);
    patch["title"] = title || null;
  }
  if ("doc_date" in body) patch["doc_date"] = parseDocDate(body["doc_date"]);
  if ("tags" in body) patch["tags"] = parseTags(body["tags"]);
  if ("doc_year" in body) {
    // Clearing the year is allowed — "we don't know" is a real answer, and
    // those documents get their own facet rather than a wrong year.
    patch["doc_year"] = resolveYear(body["doc_year"], parseDocDate(body["doc_date"] ?? doc.doc_date));
  }
  if ("doc_type" in body) {
    const nextType = String(body["doc_type"] ?? "");
    const rule = UPLOADABLE_DOC_TYPES[nextType];
    if (!rule) { res.status(400).json({ error: `Unsupported doc_type: ${nextType}` }); return; }
    if (rule.personOnly && !PERSON_ENTITIES.has(doc.entity_type as AttachableEntity)) {
      res.status(400).json({
        error: `${nextType} must be filed against the person it identifies, not a ${doc.entity_type}.`,
      });
      return;
    }
    patch["doc_type"] = nextType;
    patch["retention_until"] = calcRetentionDate(nextType);
  }

  const [updated] = await db.update(documentsTable).set(patch as never)
    .where(eq(documentsTable.id, docId)).returning();

  await logAction({
    entityType: `${doc.entity_type}_document`, entityId: doc.entity_id, action: "UPDATE",
    oldValue: { doc_type: doc.doc_type, doc_year: doc.doc_year, title: doc.title, tags: readTags(doc.tags) },
    newValue: { doc_type: updated.doc_type, doc_year: updated.doc_year, title: updated.title, tags: readTags(updated.tags) },
  }).catch(() => {});

  res.json(toDto(updated));
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

/** Evidence types nobody may delete by hand — see the DELETE handler. */
const EVIDENCE_DOC_TYPES = new Set(["signed_contract"]);

/**
 * DELETE /v1/documents/:docId — soft-delete the row and drop the asset.
 *
 * Refused for evidence: frozen snapshots (`version` set) are the exact bytes a
 * customer received, and a `signed_contract` scan is the original a tenancy was
 * executed on. Both are removed by the retention policy once their statutory
 * period is up, never by a click.
 */
router.delete("/v1/documents/:docId", async (req, res): Promise<void> => {
  const docId = String(req.params["docId"] ?? "");
  if (!docId) { res.status(400).json({ error: "Invalid request" }); return; }
  const [doc] = await db.select().from(documentsTable)
    .where(and(eq(documentsTable.id, docId), isNull(documentsTable.deleted_at)));
  if (!doc || doc.entity_type === ORG_ENTITY_TYPE) { res.status(404).json({ error: "Not found" }); return; }
  if (doc.version != null || EVIDENCE_DOC_TYPES.has(doc.doc_type)) {
    res.status(409).json({ error: "Issued and signed documents cannot be deleted." }); return;
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
