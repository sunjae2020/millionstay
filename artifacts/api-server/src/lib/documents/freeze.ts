/**
 * Document Hub — version freezing (immutable PDF snapshots)
 *
 * When a document is sent/emailed (or explicitly finalised), we render its PDF
 * and store an immutable copy in the `documents` table (Cloudinary authenticated
 * upload + legal retention via `calcRetentionDate`). Each freeze increments a
 * per-(entity, doc_type) version number, so the exact bytes that went to the
 * customer are preserved even if the underlying record later changes.
 *
 * Best-effort: if Cloudinary is not configured, freezing is skipped (returns
 * null) rather than failing the surrounding send/finalise flow.
 */
import { db, documentsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { isCloudinaryConfigured, uploadPrivateToCloudinary, generateSignedUrl } from "../../utils/cloudinary";
import { calcRetentionDate } from "../retention";

export interface FreezeArgs {
  entityType: string; // "invoice" | "contract" | "quote"
  entityId: number;
  /** Retention key + classification: tax_invoice | receipt | contract | quote. */
  docType: string;
  ref: string;
  pdf: Buffer;
  uploadedBy?: number | null;
}

export interface FrozenSnapshot {
  id: string;
  version: number;
  public_id: string;
  file_name: string;
}

/** Render-independent: persist an immutable snapshot of an already-rendered PDF. */
export async function freezeDocument(args: FreezeArgs): Promise<FrozenSnapshot | null> {
  if (!isCloudinaryConfigured()) {
    console.log(`[freeze] Cloudinary not configured — skipping snapshot for ${args.ref}`);
    return null;
  }

  // Next version = max existing version for this (entity, doc_type) + 1.
  const existing = await db.select({ version: documentsTable.version })
    .from(documentsTable)
    .where(and(
      eq(documentsTable.entity_type, args.entityType),
      eq(documentsTable.entity_id, args.entityId),
      eq(documentsTable.doc_type, args.docType),
    ));
  const version = existing.reduce((m, r) => Math.max(m, r.version ?? 0), 0) + 1;

  const up = await uploadPrivateToCloudinary(args.pdf, { format: "pdf" });
  const file_name = `${args.ref}-v${version}.pdf`;
  const [row] = await db.insert(documentsTable).values({
    entity_type: args.entityType,
    entity_id: args.entityId,
    doc_type: args.docType,
    doc_ref: args.ref,
    version,
    file_name,
    file_size: args.pdf.length,
    mime_type: "application/pdf",
    cloudinary_public_id: up.public_id,
    uploaded_by: args.uploadedBy ?? null,
    uploaded_by_type: "User",
    retention_until: calcRetentionDate(args.docType),
  }).returning();

  return { id: row.id, version, public_id: up.public_id, file_name };
}

/** Map an entity type to the retention/classification doc_type for snapshots. */
export function snapshotDocType(entityType: "invoice" | "contract" | "quote", kind?: "receipt"): string {
  if (kind === "receipt") return "receipt";
  return { invoice: "tax_invoice", contract: "contract", quote: "quote" }[entityType];
}

export interface SnapshotListItem {
  id: string;
  version: number | null;
  doc_type: string;
  file_name: string;
  file_size: number;
  created_at: Date | null;
  retention_until: Date | null;
  download_url: string | null;
}

/** List frozen snapshots for an entity (newest first) with signed download URLs. */
export async function listSnapshots(entityType: string, entityId: number): Promise<SnapshotListItem[]> {
  const rows = await db.select().from(documentsTable)
    .where(and(eq(documentsTable.entity_type, entityType), eq(documentsTable.entity_id, entityId)));
  return rows
    .filter(r => !r.deleted_at)
    .sort((a, b) => (b.version ?? 0) - (a.version ?? 0))
    .map(r => ({
      id: r.id,
      version: r.version,
      doc_type: r.doc_type,
      file_name: r.file_name,
      file_size: r.file_size,
      created_at: r.created_at,
      retention_until: r.retention_until,
      download_url: isCloudinaryConfigured() ? generateSignedUrl(r.cloudinary_public_id, 900) : null,
    }));
}
