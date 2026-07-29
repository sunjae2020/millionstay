import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, FileText, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocumentPreviewDialog, useDocumentPreview } from "@/components/DocumentPreviewDialog";
import { apiFetch, apiJson } from "@/lib/apiFetch";
import { formatDate } from "@/lib/date";

/**
 * Settings → Organisation → Company documents.
 *
 * The company's own paperwork (business registration certificate, bank passbook
 * copy, seal certificate …) filed against the organisation itself. Files are
 * private on Cloudinary and served through 15-minute signed URLs; the backend
 * restricts every verb to SuperAdmin/Admin.
 *
 * Retention is deliberately permanent — these are corporate records, not
 * personal information, so the APP 11 purge job never touches them and deletion
 * stays a manual act.
 */

interface OrgDocument {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  created_at: string;
  signed_url: string;
}

const ENDPOINT = "/api/v1/company-info/documents";

export function OrgDocuments() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { previewConfig, openPreview, closePreview } = useDocumentPreview();

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: docs, isLoading } = useQuery<OrgDocument[]>({
    queryKey: ["org-documents"],
    queryFn: () => apiJson<OrgDocument[]>(ENDPOINT),
  });

  async function handleUpload(files?: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    const failures: string[] = [];
    try {
      // Uploaded one at a time so a single rejected file does not take the rest
      // of the selection down with it.
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        const res = await apiFetch(ENDPOINT, { method: "POST", body: form });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          failures.push(`${file.name}: ${data?.error ?? res.status}`);
        }
      }
      if (failures.length) setError(failures.join(" / "));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings_org_docs.upload_failed"));
    } finally {
      setUploading(false);
      qc.invalidateQueries({ queryKey: ["org-documents"] });
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm(t("settings_org_docs.confirm_delete"))) return;
    await apiFetch(`${ENDPOINT}/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["org-documents"] });
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">{t("settings_org_docs.description")}</p>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input ref={fileRef} type="file" multiple className="hidden"
          onChange={(e) => void handleUpload(e.target.files)} />
        <Button type="button" variant="outline" size="sm" className="gap-1.5"
          disabled={uploading} onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" />
          {uploading ? t("common.loading") : t("settings_org_docs.upload")}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      <div className="rounded-md border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("settings_org_docs.col_file")}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("settings_org_docs.col_date")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground text-sm">{t("common.loading")}</td></tr>
            ) : !docs?.length ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground text-sm">{t("settings_org_docs.empty")}</td></tr>
            ) : (
              docs.map((d) => (
                <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />{d.file_name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDate(d.created_at)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button type="button"
                      onClick={() => openPreview({
                        title: d.file_name,
                        filename: d.file_name,
                        source: { kind: "url", href: d.signed_url },
                      })}
                      className="text-primary hover:underline inline-flex items-center gap-1 text-xs">
                      <Eye className="h-3.5 w-3.5" /> {t("common.preview", "Preview")}
                    </button>
                    <button type="button" onClick={() => void handleDelete(d.id)}
                      className="ml-3 text-destructive hover:underline inline-flex items-center gap-1 text-xs">
                      <Trash2 className="h-3.5 w-3.5" /> {t("common.remove")}
                    </button>
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
