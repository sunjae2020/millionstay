import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, FileText, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  doc_type: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  created_at: string;
  signed_url: string;
}

// Keys are stored in documents.doc_type (varchar 32); labels are translated.
const DOC_TYPES = [
  "business_registration",
  "bank_passbook",
  "seal_certificate",
  "corporate_register",
  "rental_business_registration",
  "representative_id",
  "other",
] as const;

const ENDPOINT = "/api/v1/company-info/documents";

export function OrgDocuments() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { previewConfig, openPreview, closePreview } = useDocumentPreview();

  const fileRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState<string>("business_registration");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: docs, isLoading } = useQuery<OrgDocument[]>({
    queryKey: ["org-documents"],
    queryFn: () => apiJson<OrgDocument[]>(ENDPOINT),
  });

  function typeLabel(key: string) {
    return t(`settings_org_docs.type_${key}`, key);
  }

  async function handleUpload(file?: File) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("doc_type", docType);
      const res = await apiFetch(ENDPOINT, { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? t("settings_org_docs.upload_failed"));
      qc.invalidateQueries({ queryKey: ["org-documents"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("settings_org_docs.upload_failed"));
    } finally {
      setUploading(false);
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
        <Select value={docType} onValueChange={setDocType}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            {DOC_TYPES.map((k) => (
              <SelectItem key={k} value={k}>{typeLabel(k)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input ref={fileRef} type="file" className="hidden"
          onChange={(e) => void handleUpload(e.target.files?.[0])} />
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
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("settings_org_docs.col_kind")}</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("settings_org_docs.col_date")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm">{t("common.loading")}</td></tr>
            ) : !docs?.length ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground text-sm">{t("settings_org_docs.empty")}</td></tr>
            ) : (
              docs.map((d) => (
                <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />{d.file_name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{typeLabel(d.doc_type)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(d.created_at)}</td>
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
