import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { apiGet } from "@/lib/api";
import { TablePagination } from "@/components/TablePagination";
import { formatDate } from "@/lib/dateFormat";
import { FileText, Download, Search, FileSignature, ReceiptText, FileArchive, Loader2 } from "lucide-react";

interface OwnerDocument {
  id: string;
  entity_type: string;
  entity_id: number;
  doc_type: string;
  doc_ref: string | null;
  version: number | null;
  file_name: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

const PAGE_SIZE = 25;

function formatSize(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const DOC_TYPE_CLS: Record<string, string> = {
  contract: "bg-blue-100 text-blue-700",
  invoice: "bg-green-100 text-green-700",
  receipt: "bg-emerald-100 text-emerald-700",
  quote: "bg-purple-100 text-purple-700",
  passport: "bg-amber-100 text-amber-700",
};

function DocTypeIcon({ type }: { type: string }) {
  if (type === "contract" || type === "tenancy" || type === "placement") return <FileSignature className="w-4 h-4" />;
  if (type === "invoice" || type === "receipt" || type === "quote") return <ReceiptText className="w-4 h-4" />;
  return <FileArchive className="w-4 h-4" />;
}

export default function DocumentsPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<OwnerDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const sp = new URLSearchParams();
    sp.set("limit", String(pageSize));
    sp.set("offset", String((page - 1) * pageSize));
    if (debouncedSearch) sp.set("q", debouncedSearch);
    apiGet<{ success: boolean; data: OwnerDocument[]; meta?: { total?: number } }>(`/v1/owner/documents?${sp.toString()}`)
      .then((d) => {
        if (cancelled) return;
        setRows(d.data);
        setTotal(d.meta?.total ?? d.data.length);
        setError("");
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, pageSize, debouncedSearch]);

  const download = async (doc: OwnerDocument) => {
    setDownloading(doc.id);
    try {
      const r = await apiGet<{ success: boolean; data: { url: string } }>(`/v1/owner/documents/${doc.id}/download`);
      if (r.data?.url) window.open(r.data.url, "_blank", "noopener");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDownloading(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{t("documents.title", "Documents")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("documents.subtitle", "Contracts, invoices and records your operator has shared with you.")}</p>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-lg border border-destructive/20 mb-4">{error}</div>
      )}

      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-foreground flex items-center gap-2"><FileText className="w-4 h-4 text-primary" />{t("documents.all", "All documents")}</h2>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("documents.search", "Search files")}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("documents.col_name", "Document")}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("documents.col_type", "Type")}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("documents.col_ref", "Reference")}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("documents.col_size", "Size")}</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("documents.col_date", "Date")}</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">{t("documents.col_action", "")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">{t("common.loading")}</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  {t("documents.empty", "No documents yet")}
                </td></tr>
              )}
              {rows.map((doc) => (
                <tr key={doc.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground flex-shrink-0">
                        <DocTypeIcon type={doc.doc_type} />
                      </span>
                      <span className="font-medium text-foreground truncate max-w-[16rem]">{doc.file_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${DOC_TYPE_CLS[doc.doc_type] ?? "bg-gray-100 text-gray-600"}`}>
                      {t(`documents.type.${doc.doc_type}`, doc.doc_type)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {doc.doc_ref ?? "—"}{doc.version ? ` v${doc.version}` : ""}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatSize(doc.file_size)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(doc.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => download(doc)}
                      disabled={downloading === doc.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      {downloading === doc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      {t("documents.download", "Download")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={page}
          pageSize={pageSize}
          total={total}
          totalPages={totalPages}
          onPage={setPage}
          onPageSize={setPageSize}
        />
      </div>
    </Layout>
  );
}
