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
import { versionLabel } from "./docFileName";

export interface FreezeArgs {
  entityType: string; // "invoice" | "contract" | "quote"
  entityId: number;
  /** Retention key + classification: tax_invoice | receipt | contract | quote. */
  docType: string;
  ref: string;
  /**
   * 파일명 규칙(docFileName.ts)으로 이미 정해진 이름. 스냅샷은 여기에 사본번호만
   * 덧붙인다 — 주면 `이아람-계약서_20260816-v2.pdf`, 안 주면 종전처럼 ref 기준.
   */
  baseName?: string | null;
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
  const base = (args.baseName ?? args.ref).replace(/\.[A-Za-z0-9]{1,5}$/, "");
  // 파일명 규칙과 같은 표기를 쓴다: 첫 스냅샷은 사본번호 없음, 2판부터 `-v2`.
  // 이름에 이미 사본번호가 붙어 있으면(같은 날 재발행) 그 자리를 스냅샷 버전이
  // 대신한다 — `-v2-v3` 같은 꼬리가 생기지 않게.
  const file_name = `${base.replace(/-v\d{1,3}$/, "")}${versionLabel(version - 1)}.pdf`;
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
