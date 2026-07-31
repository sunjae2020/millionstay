import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, FileText, Lock, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocumentPreviewDialog, useDocumentPreview } from "@/components/DocumentPreviewDialog";
import { apiFetch, apiJson } from "@/lib/apiFetch";
import { formatDate } from "@/lib/date";

/**
 * Documents filed against one record (contract, property, account …).
 *
 * Reusable on purpose: the panel takes the entity it belongs to, so any detail
 * page can grow a documents tab without another copy of upload/list/preview.
 * It reads the shared `documents` table through /v1/documents, which returns
 * both manual uploads and the immutable snapshots frozen when a document was
 * sent to the customer — the snapshots are marked and cannot be deleted, since
 * they are the exact bytes the customer received.
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
  retention_until: string | null;
  created_at: string | null;
  file_url: string;
}

interface Props {
  entityType: "contract" | "invoice" | "quote" | "booking" | "account" | "contact" | "property" | "space" | "work_order";
  entityId: string | number;
  /**
   * Document types offered in the upload picker, in order. The classification
   * is what sets the file's retention period server-side, so the caller picks
   * the ones that make sense for its record. Identity documents are only
   * accepted on a person (contact) — the API refuses them elsewhere.
   */
  docTypes?: string[];
}

const DEFAULT_DOC_TYPES = ["contract", "property_document", "other"];

function formatSize(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function EntityDocuments({ entityType, entityId, docTypes = DEFAULT_DOC_TYPES }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { previewConfig, openPreview, closePreview } = useDocumentPreview();

  const fileRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState(docTypes[0] ?? "other");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listPath = `/api/v1/documents/entity/${entityType}/${entityId}`;
  const queryKey = ["entity-documents", entityType, String(entityId)];

  const { data: docs, isLoading } = useQuery<EntityDocument[]>({
    queryKey,
    queryFn: () => apiJson<EntityDocument[]>(listPath),
  });

  async function handleUpload(files?: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    const failures: string[] = [];
    try {
      // One at a time so a single rejected file does not take the rest down.
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        form.append("entity_type", entityType);
        form.append("entity_id", String(entityId));
        form.append("doc_type", docType);
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
      <p className="text-sm text-muted-foreground mb-4">{t("entity_docs.description")}</p>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="h-9 rounded-md border bg-background px-2 text-sm"
        >
          {docTypes.map((dt) => (
            <option key={dt} value={dt}>{t(`entity_docs.type_${dt}`)}</option>
          ))}
        </select>
        <input ref={fileRef} type="file" multiple className="hidden"
          onChange={(e) => void handleUpload(e.target.files)} />
        <Button type="button" variant="outline" size="sm" className="gap-1.5"
          disabled={uploading} onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" />
          {uploading ? t("common.loading") : t("entity_docs.upload")}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      <div className="rounded-md border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("entity_docs.col_file")}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("entity_docs.col_type")}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("entity_docs.col_size")}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("entity_docs.col_date")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">{t("common.loading")}</td></tr>
            ) : !docs?.length ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">{t("entity_docs.empty")}</td></tr>
            ) : (
              docs.map((d) => (
                <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    <span className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      {d.file_name}
                      {d.version != null && (
                        <span className="ml-1 inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          <Lock className="h-3 w-3" />
                          {t("entity_docs.issued_version", { version: d.version })}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {t(`entity_docs.type_${d.doc_type}`, d.doc_type)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatSize(d.file_size)}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{d.created_at ? formatDate(d.created_at) : "—"}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button type="button"
                      onClick={() => openPreview({
                        title: d.file_name,
                        filename: d.file_name,
                        source: { kind: "api", path: d.file_url },
                      })}
                      className="text-primary hover:underline inline-flex items-center gap-1 text-xs">
                      <Eye className="h-3.5 w-3.5" /> {t("common.preview", "Preview")}
                    </button>
                    {/* Issued snapshots are evidence of what was sent — retention removes them, not a person. */}
                    {d.version == null && (
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
        </table>
      </div>

      <DocumentPreviewDialog config={previewConfig} onClose={closePreview} />
    </div>
  );
}
