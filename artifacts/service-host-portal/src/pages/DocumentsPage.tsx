import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { apiGet, apiFetch, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/dateFormat";
import { CameraInput } from "@/components/CameraButton";
import {
  FolderOpen, FileText, Image as ImageIcon, Download, Trash2,
  UploadCloud, X, Loader2,
} from "lucide-react";

type Doc = {
  id: string;
  doc_type: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
};

const DOC_TYPES = ["contract", "invoice", "report", "manual", "other"] as const;
type DocType = (typeof DOC_TYPES)[number];

const typeStyle: Record<string, string> = {
  contract: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  invoice: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  report: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  manual: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  other: "bg-muted text-muted-foreground",
};

function fmtSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Doc[] | null>(null);
  const [docType, setDocType] = useState<DocType>("contract");
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiGet<{ data: Doc[] }>("/v1/service-host/documents");
      setRows(res.data ?? []);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("documents.load_failed", "Failed to load documents"));
      setRows([]);
    }
  }, [t]);
  useEffect(() => { void load(); }, [load]);

  async function onFile(file: File) {
    setError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("doc_type", docType);
      const res = await apiFetch("/v1/service-host/documents", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new ApiError(res.status, "UPLOAD", (body as any)?.error?.message ?? t("documents.upload_failed", "Upload failed"));
      }
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("documents.upload_failed", "Upload failed"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function download(doc: Doc) {
    setBusyId(doc.id);
    try {
      const res = await apiGet<{ data: { url: string } }>(`/v1/service-host/documents/${doc.id}/download`);
      if (res.data?.url) window.open(res.data.url, "_blank", "noopener");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("documents.download_failed", "Download failed"));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(doc: Doc) {
    if (!window.confirm(t("documents.delete_confirm", "Delete this document?"))) return;
    setBusyId(doc.id);
    try {
      const res = await apiFetch(`/v1/service-host/documents/${doc.id}`, { method: "DELETE" });
      if (!res.ok) throw new ApiError(res.status, "DELETE", t("documents.delete_failed", "Failed to delete"));
      setRows((r) => (r ?? []).filter((d) => d.id !== doc.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("documents.delete_failed", "Failed to delete"));
    } finally {
      setBusyId(null);
    }
  }

  const isImage = (m: string | null) => !!m && m.startsWith("image/");

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FolderOpen className="w-6 h-6 text-primary" /> {t("documents.title", "Documents")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t("documents.subtitle", "Store and manage your work documents securely.")}</p>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <span className="flex-1">{error}</span>
            <button onClick={() => setError("")} aria-label={t("common.dismiss", "Dismiss")}><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Upload card */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground">{t("documents.category", "Category")}</label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as DocType)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                {DOC_TYPES.map((dt) => (
                  <option key={dt} value={dt}>{t(`documents.type_${dt}`, dt)}</option>
                ))}
              </select>
            </div>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
              />
              {/* 폰에서는 찍는 것이 곧 첨부다. 같은 핸들러로 들어간다. */}
              <CameraInput onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }} multiple={false} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                {uploading ? t("documents.uploading", "Uploading…") : t("documents.upload", "Upload document")}
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">{t("documents.upload_hint", "PDF or image, up to 20 MB. Files are stored securely and visible only to you and admin.")}</p>
        </div>

        {/* List */}
        {rows === null ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <FolderOpen className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">{t("documents.empty", "No documents yet")}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("documents.empty_help", "Upload a document to get started.")}</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl divide-y divide-border">
            {rows.map((d) => (
              <div key={d.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  {isImage(d.mime_type) ? <ImageIcon className="w-4 h-4 text-primary" /> : <FileText className="w-4 h-4 text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{d.file_name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className={`px-1.5 py-0.5 rounded font-medium ${typeStyle[d.doc_type] ?? typeStyle.other}`}>{t(`documents.type_${d.doc_type}`, d.doc_type)}</span>
                    <span>{fmtSize(d.file_size)}</span>
                    <span>·</span>
                    <span>{formatDate(d.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => void download(d)}
                    disabled={busyId === d.id}
                    className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition-colors disabled:opacity-50"
                    aria-label={t("documents.download", "Download")}
                    title={t("documents.download", "Download")}
                  >
                    {busyId === d.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => void remove(d)}
                    disabled={busyId === d.id}
                    className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-muted transition-colors disabled:opacity-50"
                    aria-label={t("documents.delete", "Delete")}
                    title={t("documents.delete", "Delete")}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
