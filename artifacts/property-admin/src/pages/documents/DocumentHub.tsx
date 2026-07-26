import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Eye, FileDown, FileText, Receipt, FileSignature, ExternalLink, Mail } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { DataTable, ACTIONS_KEY, type ColumnDef } from "@/components/ui/data-table";
import { formatDate } from "@/lib/date";

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
  return formatDate(d);
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
  const { t } = useTranslation();
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
        title: t("document_hub.pdf_unavailable", "PDF unavailable"),
        description: err instanceof Error ? err.message : t("document_hub.pdf_generate_failed", "Failed to generate document."),
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  // Email the document (PDF + cover) to its recipient in the selected language.
  const handleEmail = async (doc: HubDocument) => {
    const emailUrl = doc.pdf_url.replace(/\/pdf$/, "/email");
    if (!window.confirm(t("document_hub.email_confirm", "Email this {{type}} to its recipient?", { type: doc.doc_type.toLowerCase() }))) return;
    const key = `${doc.doc_type}:${doc.source_id}:email`;
    setBusy(key);
    try {
      const res = await apiFetch(emailUrl, {
        method: "POST",
        body: JSON.stringify({ lang: docLang }),
        headers: { "Content-Type": "application/json" },
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      toast({ title: t("document_hub.email_sent", "Email sent"), description: t("document_hub.email_sent_desc", "{{type}} emailed to {{recipient}}.", { type: doc.doc_type, recipient: body?.to ?? t("document_hub.recipient", "recipient") }) });
    } catch (err) {
      toast({ title: t("document_hub.email_failed", "Email failed"), description: err instanceof Error ? err.message : t("document_hub.error", "Error"), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const columns: ColumnDef<HubDocument>[] = useMemo(
    () => [
      {
        key: "doc_type",
        header: "common.type",
        cell: (doc) => {
          const meta = TYPE_META[doc.doc_type] ?? TYPE_META.Invoice;
          const Icon = meta.icon;
          return <Badge className={`text-xs gap-1 ${meta.badge}`}><Icon className="h-3 w-3" />{doc.doc_type}</Badge>;
        },
      },
      {
        key: "ref",
        header: "document_hub.reference",
        hideable: false,
        cell: (doc) => (
          <Link href={doc.detail_url} className="text-primary hover:underline font-mono text-xs font-semibold">
            {doc.ref}
          </Link>
        ),
      },
      {
        key: "party",
        header: "document_hub.party",
        cell: (doc) => <span className="text-sm">{doc.party ?? "—"}</span>,
      },
      {
        key: "linked",
        header: "document_hub.linked_to",
        sortAccessor: (doc) => doc.links.join(" · "),
        cell: (doc) => <span className="text-xs text-muted-foreground">{doc.links.length ? doc.links.join(" · ") : "—"}</span>,
      },
      {
        key: "amount",
        header: "common.amount",
        align: "right",
        cell: (doc) => (
          <span className="tabular-nums">
            {doc.amount != null ? `${doc.amount.toLocaleString("en-AU", { minimumFractionDigits: 2 })} ${doc.currency ?? ""}` : "—"}
          </span>
        ),
      },
      {
        key: "status",
        header: "common.status",
        cell: (doc) => <Badge className={`text-xs ${STATUS_COLORS[doc.status] ?? ""}`}>{doc.status}</Badge>,
      },
      {
        key: "date",
        header: "common.date",
        cell: (doc) => <span className="text-xs text-muted-foreground">{fmtDate(doc.date)}</span>,
      },
      {
        key: ACTIONS_KEY,
        header: "",
        hideable: false,
        sortable: false,
        align: "right",
        defaultWidth: 140,
        cell: (doc) => (
          <div className="flex items-center gap-1 justify-end">
            <button className="p-1.5 rounded hover:bg-muted transition-colors disabled:opacity-40"
              title={t("document_hub.preview", "Preview")} disabled={!!busy} onClick={() => handlePdf(doc, "preview")}>
              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button className="p-1.5 rounded hover:bg-muted transition-colors disabled:opacity-40"
              title={t("document_hub.download_pdf", "Download PDF")} disabled={!!busy} onClick={() => handlePdf(doc, "download")}>
              <FileDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button className="p-1.5 rounded hover:bg-muted transition-colors disabled:opacity-40"
              title={t("document_hub.email_lang", "Email ({{lang}})", { lang: docLang.toUpperCase() })} disabled={!!busy} onClick={() => handleEmail(doc)}>
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <Link href={doc.detail_url}>
              <button className="p-1.5 rounded hover:bg-muted transition-colors" title={t("document_hub.open_record", "Open record")}>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </Link>
          </div>
        ),
      },
    ],
    [t, busy, docLang],
  );

  return (
    <Layout>
      <PageHeader
        title={t("document_hub.title", "Documents")}
        subtitle={t("document_hub.subtitle", "{{count}} documents · invoices, receipts & contracts", { count: rows.length })}
      />

      <div className="p-6">
        <div className="flex gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder={t("document_hub.search_placeholder", "Search by reference…")} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-44"><SelectValue placeholder={t("common.type", "Type")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">{t("document_hub.all_types", "All Types")}</SelectItem>
              <SelectItem value="Invoice">{t("document_hub.invoices", "Invoices")}</SelectItem>
              <SelectItem value="Receipt">{t("document_hub.receipts", "Receipts")}</SelectItem>
              <SelectItem value="Quote">{t("document_hub.quotes", "Quotes")}</SelectItem>
              <SelectItem value="Contract">{t("document_hub.contracts", "Contracts")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={docLang} onValueChange={setDocLang}>
            <SelectTrigger className="w-36"><SelectValue placeholder={t("document_hub.language", "Language")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="ko">한국어</SelectItem>
              <SelectItem value="zh">中文</SelectItem>
              <SelectItem value="ja">日本語</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DataTable
          tableKey="document-hub"
          columns={columns}
          data={rows}
          isLoading={isLoading}
          rowKey={(doc) => `${doc.doc_type}-${doc.source_id}`}
          emptyText={t("document_hub.no_documents", "No documents found")}
        />
      </div>
    </Layout>
  );
}
