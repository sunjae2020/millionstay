import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, FileText, FolderUp, Lock, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocumentPreviewDialog, useDocumentPreview } from "@/components/DocumentPreviewDialog";
import { FileDropZone, DIRECTORY_INPUT_PROPS } from "@/components/FileDropZone";
import { apiFetch, apiJson } from "@/lib/apiFetch";
import { formatDate } from "@/lib/date";

import { ExportableTable } from "@/components/ui/ExportCsvButton";
import { CameraButton } from "@/components/CameraButton";
/**
 * Documents filed against one record (contract, property, account …).
 *
 * Reusable on purpose: the panel takes the entity it belongs to, so any detail
 * page can grow a documents tab without another copy of upload/list/preview.
 * It reads the shared `documents` table through /v1/documents, which returns
 * both manual uploads and the immutable snapshots frozen when a document was
 * sent to the customer.
 *
 * The document *type* is never asked of the user — it exists to drive the
 * retention policy, not to be filled in. Uploads take the type that matches the
 * record they are filed against (`defaultDocType`), and callers that have an
 * upload flow of their own (a contract's signed original) pass `hideUpload` and
 * post the file themselves, so a page never grows two upload buttons.
 *
 * Files are streamed back through our own API rather than a Cloudinary URL: the
 * account blocks PDF delivery through the image pipeline, so a signed URL
 * renders blank in the preview modal.
 */

export interface EntityDocument {
  id: string;
  entity_type: string;
  entity_id: number;
  doc_type: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  version: number | null;
  doc_ref: string | null;
  title: string | null;
  doc_date: string | null;
  doc_year: number | null;
  tags: string[];
  retention_until: string | null;
  created_at: string | null;
  file_url: string;
}

export type DocumentEntityType =
  | "contract" | "invoice" | "quote" | "booking" | "account"
  | "contact" | "property" | "space" | "work_order" | "transaction";

interface Props {
  entityType: DocumentEntityType;
  entityId: string | number;
  /**
   * Classification stored with uploads from this panel. It sets the retention
   * period server-side, so it follows the record — a contract's paperwork is
   * kept for the contract's 7 years, not the 2-year default.
   */
  defaultDocType?: string;
  /** Caller owns the upload control (see the contract's execution form). */
  hideUpload?: boolean;
}

/** Query key the panel reads, so an outside uploader can refresh the list. */
export function entityDocumentsKey(entityType: string, entityId: string | number): string[] {
  return ["entity-documents", entityType, String(entityId)];
}

/**
 * Types filed as evidence rather than as working attachments: the signed
 * original a tenancy was executed on, and anything frozen when it was sent.
 * They are removed by the retention policy, not by a person, so the row shows
 * no delete action (the API refuses it too).
 */
const EVIDENCE_DOC_TYPES = new Set(["signed_contract"]);

function isEvidence(doc: EntityDocument): boolean {
  return doc.version != null || EVIDENCE_DOC_TYPES.has(doc.doc_type);
}

function formatSize(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function EntityDocuments({ entityType, entityId, defaultDocType = "other", hideUpload }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { previewConfig, openPreview, closePreview } = useDocumentPreview();

  const fileRef = useRef<HTMLInputElement>(null);
  // Filing index captured at upload time, so the document library can find this
  // file by year and keyword later. The year defaults to now because an optional
  // field left blank on every upload indexes nothing — and it is the year on the
  // document that matters, so it stays editable.
  const folderRef = useRef<HTMLInputElement>(null);
  const [docYear, setDocYear] = useState<string>(String(new Date().getFullYear()));
  const [tagInput, setTagInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listPath = `/api/v1/documents/entity/${entityType}/${entityId}`;
  const queryKey = entityDocumentsKey(entityType, entityId);

  const { data: docs, isLoading } = useQuery<EntityDocument[]>({
    queryKey,
    queryFn: () => apiJson<EntityDocument[]>(listPath),
  });

  async function handleUpload(input?: FileList | File[] | null) {
    const files = (input ? Array.from(input) : []).filter((f) => f.size > 0);
    if (!files.length) return;
    setUploading(true);
    setError(null);
    const failures: string[] = [];
    try {
      // One at a time so a single rejected file does not take the rest down.
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        form.append("entity_type", entityType);
        form.append("entity_id", String(entityId));
        form.append("doc_type", defaultDocType);
        if (docYear.trim()) form.append("doc_year", docYear.trim());
        if (tagInput.trim()) form.append("tags", tagInput.trim());
        const res = await apiFetch("/api/v1/documents", { method: "POST", body: form });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          failures.push(`${file.name}: ${data?.error ?? res.status}`);
        }
      }
      if (failures.length) setError(failures.join(" / "));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("entity_docs.upload_failed"));
    } finally {
      setUploading(false);
      qc.invalidateQueries({ queryKey });
      if (fileRef.current) fileRef.current.value = "";
      if (folderRef.current) folderRef.current.value = "";
    }
  }

  async function handleDelete(doc: EntityDocument) {
    if (!window.confirm(t("entity_docs.confirm_delete"))) return;
    const res = await apiFetch(`/api/v1/documents/${doc.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? String(res.status));
    }
    qc.invalidateQueries({ queryKey });
  }

  return (
    <div>
      {!hideUpload && (
        <>
          <p className="text-sm text-muted-foreground mb-4">{t("entity_docs.description")}</p>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              type="number"
              value={docYear}
              onChange={(e) => setDocYear(e.target.value)}
              placeholder={t("entity_docs.year_placeholder", "Year")}
              title={t("entity_docs.year_hint", "The year printed on the document, not today's date.")}
              className="h-9 w-24 rounded-md border bg-background px-2 text-sm"
            />
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder={t("entity_docs.tags_placeholder", "Keywords (comma separated)")}
              className="h-9 w-56 rounded-md border bg-background px-2 text-sm"
            />
            <input ref={fileRef} type="file" multiple className="hidden"
              onChange={(e) => void handleUpload(e.target.files)} />
            <input ref={folderRef} type="file" multiple className="hidden"
              {...DIRECTORY_INPUT_PROPS}
              onChange={(e) => void handleUpload(e.target.files)} />
            <Button type="button" variant="outline" size="sm" className="gap-1.5"
              disabled={uploading} onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" />
              {uploading ? t("common.loading") : t("entity_docs.upload")}
            </Button>
            <Button type="button" variant="outline" size="sm" className="gap-1.5"
              disabled={uploading} onClick={() => folderRef.current?.click()}>
              <FolderUp className="h-4 w-4" />
              {t("file_drop.upload_folder", "Upload folder")}
            </Button>
            {/* 영수증·증빙은 대개 종이다. 폰에서는 찍는 것이 곧 첨부다. */}
            <CameraButton
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-60"
              onCapture={(files) => void handleUpload(files)}
            />
          </div>
        </>
      )}
      {error && <p className="mb-3 text-xs text-destructive">{error}</p>}

      {/* Dropping a folder of scans onto the list is the fastest way to file a
          record's paperwork; the panel keeps its own per-file POST loop. */}
      <FileDropZone
        onFiles={(files) => void handleUpload(files)}
        disabled={hideUpload}
        busy={uploading}
        hideHint={hideUpload}
      >
      <div className="rounded-lg border bg-white overflow-x-auto">
        <ExportableTable fileName="entity-documents" className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("entity_docs.col_file")}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("entity_docs.col_year", "Year")}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("entity_docs.col_tags", "Keywords")}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("entity_docs.col_size")}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("entity_docs.col_date")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">{t("common.loading")}</td></tr>
            ) : !docs?.length ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">{t("entity_docs.empty")}</td></tr>
            ) : (
              docs.map((d) => (
                <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    <span className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      {d.file_name}
                      {/* The only classification worth surfacing: this file is
                          evidence, which is why it has no delete action. */}
                      {isEvidence(d) && (
                        <span className="ml-1 inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground whitespace-nowrap">
                          <Lock className="h-3 w-3" />
                          {d.version != null
                            ? t("entity_docs.issued_version", { version: d.version })
                            : t("entity_docs.signed_original")}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{d.doc_year ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {d.tags?.length ? (
                      <span className="flex flex-wrap gap-1">
                        {d.tags.map((tag) => (
                          <span key={tag} className="rounded bg-muted px-1.5 py-0.5 text-[11px]">{tag}</span>
                        ))}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatSize(d.file_size)}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{d.created_at ? formatDate(d.created_at) : "—"}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button type="button"
                      onClick={() => openPreview({
                        title: d.file_name,
                        filename: d.file_name,
                        // Uploads are not all PDFs — the dialog needs the type
                        // to know whether it can render it inline at all.
                        mimeType: d.mime_type,
                        source: { kind: "api", path: d.file_url },
                      })}
                      className="text-primary hover:underline inline-flex items-center gap-1 text-xs">
                      <Eye className="h-3.5 w-3.5" /> {t("common.preview", "Preview")}
                    </button>
                    {!isEvidence(d) && (
                      <button type="button" onClick={() => void handleDelete(d)}
                        className="ml-3 text-destructive hover:underline inline-flex items-center gap-1 text-xs">
                        <Trash2 className="h-3.5 w-3.5" /> {t("common.remove")}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </ExportableTable>
      </div>
      </FileDropZone>

      <DocumentPreviewDialog config={previewConfig} onClose={closePreview} />
    </div>
  );
}
