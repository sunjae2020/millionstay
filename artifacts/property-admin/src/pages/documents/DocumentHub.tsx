import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Eye, FileDown, FileText, Receipt, FileSignature, ExternalLink } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { usePagination, TablePagination } from "@/components/ui/TablePagination";
import { format } from "date-fns";

interface HubDocument {
  doc_type: "Invoice" | "Receipt" | "Contract";
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

const TYPE_META: Record<string, { icon: typeof FileText; badge: string }> = {
  Invoice:  { icon: FileText,      badge: "bg-orange-100 text-orange-700" },
  Receipt:  { icon: Receipt,       badge: "bg-green-100 text-green-700" },
  Contract: { icon: FileSignature, badge: "bg-purple-100 text-purple-700" },
  Quote:    { icon: FileText,      badge: "bg-blue-100 text-blue-700" },
};

const STATUS_COLORS: Record<string, string> = {
  Paid: "bg-green-100 text-green-700",
  Sent: "bg-blue-100 text-blue-700",
  Draft: "bg-gray-100 text-gray-500",
  Void: "bg-red-100 text-red-600",
  Signed: "bg-green-100 text-green-700",
  Active: "bg-green-100 text-green-700",
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  try { return format(new Date(d), "dd MMM yyyy"); } catch { return d; }
}

async function fetchDocuments(q: string, type: string): Promise<HubDocument[]> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (type && type !== "_all") params.set("type", type);
  const res = await apiFetch(`/api/v1/documents?${params}`);
  if (!res.ok) throw new Error("Failed to fetch documents");
  return res.json();
}

export default function DocumentHub() {
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [type, setType] = useState("_all");
  const [docLang, setDocLang] = useState("en");
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["documents", q, type],
    queryFn: () => fetchDocuments(q, type),
  });

  const rows: HubDocument[] = Array.isArray(data) ? data : [];
  const pagination = usePagination(rows);

  // Render the document's PDF, then download it or open an HTML preview tab.
  const handlePdf = async (doc: HubDocument, mode: "download" | "preview") => {
    const key = `${doc.doc_type}:${doc.source_id}:${mode}`;
    setBusy(key);
    try {
      const params = new URLSearchParams();
      if (mode === "preview") params.set("format", "html");
      if (docLang !== "en") params.set("lang", docLang);
      const qs = params.toString();
      const path = qs ? `${doc.pdf_url}?${qs}` : doc.pdf_url;
      const res = await apiFetch(path);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const url = URL.createObjectURL(await res.blob());
      if (mode === "preview") {
        window.open(url, "_blank", "noopener,noreferrer");
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = `${doc.ref}${doc.doc_type === "Receipt" ? "-receipt" : ""}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      toast({
        title: "PDF unavailable",
        description: err instanceof Error ? err.message : "Failed to generate document.",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Layout>
      <PageHeader
        title="Documents"
        subtitle={`${rows.length} document${rows.length === 1 ? "" : "s"} · invoices, receipts & contracts`}
      />

      <div className="p-6">
        <div className="flex gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search by reference…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Types</SelectItem>
              <SelectItem value="Invoice">Invoices</SelectItem>
              <SelectItem value="Receipt">Receipts</SelectItem>
              <SelectItem value="Quote">Quotes</SelectItem>
              <SelectItem value="Contract">Contracts</SelectItem>
            </SelectContent>
          </Select>
          <Select value={docLang} onValueChange={setDocLang}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Language" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="ko">한국어</SelectItem>
              <SelectItem value="zh">中文</SelectItem>
              <SelectItem value="ja">日本語</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="border rounded-lg overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Reference</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Party</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Linked To</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Amount</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">Date</th>
                  <th className="px-4 py-3 w-32"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">No documents found</td></tr>
                ) : pagination.paginatedItems.map((doc: HubDocument) => {
                  const meta = TYPE_META[doc.doc_type] ?? TYPE_META.Invoice;
                  const Icon = meta.icon;
                  return (
                    <tr key={`${doc.doc_type}-${doc.source_id}`} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <Badge className={`text-xs gap-1 ${meta.badge}`}><Icon className="h-3 w-3" />{doc.doc_type}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={doc.detail_url} className="text-[#E8621A] hover:underline font-mono text-xs font-semibold">
                          {doc.ref}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm">{doc.party ?? "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{doc.links.length ? doc.links.join(" · ") : "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {doc.amount != null ? `${doc.amount.toLocaleString("en-AU", { minimumFractionDigits: 2 })} ${doc.currency ?? ""}` : "—"}
                      </td>
                      <td className="px-4 py-3"><Badge className={`text-xs ${STATUS_COLORS[doc.status] ?? ""}`}>{doc.status}</Badge></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(doc.date)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button className="p-1.5 rounded hover:bg-muted transition-colors disabled:opacity-40"
                            title="Preview" disabled={!!busy} onClick={() => handlePdf(doc, "preview")}>
                            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                          <button className="p-1.5 rounded hover:bg-muted transition-colors disabled:opacity-40"
                            title="Download PDF" disabled={!!busy} onClick={() => handlePdf(doc, "download")}>
                            <FileDown className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                          <Link href={doc.detail_url}>
                            <button className="p-1.5 rounded hover:bg-muted transition-colors" title="Open record">
                              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <TablePagination {...pagination} />
      </div>
    </Layout>
  );
}
