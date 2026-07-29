import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, FileText } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { formatDate } from "@/lib/date";
import { useBrand } from "@/contexts/ThemeContext";
import { formatMoney } from "@/lib/currency";
import { useDocumentRowActions } from "@/components/DocumentRowActions";

const STATUS_COLORS: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-500",
  Sent: "bg-blue-100 text-blue-700",
  Accepted: "bg-green-100 text-green-700",
  Declined: "bg-red-100 text-red-600",
  Expired: "bg-amber-100 text-amber-700",
  Archived: "bg-gray-100 text-gray-400",
};

function fmtDate(d: string | null) {
  return formatDate(d);
}

async function fetchQuotes(q: string): Promise<any[]> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  const res = await apiFetch(`/api/v1/quotes?${params}`);
  if (!res.ok) throw new Error("Failed to fetch quotes");
  return res.json();
}

export default function QuoteList() {
  const { t } = useTranslation();
  const { currency, currencyPosition } = useBrand();
  const [, navigate] = useLocation();
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({ queryKey: ["quotes", q], queryFn: () => fetchQuotes(q) });
  const rows: any[] = Array.isArray(data) ? data : [];

  const { documentActionsColumn, documentPreview } = useDocumentRowActions<any>((r) => ({
    ref: r.quote_ref,
    typeLabel: t("quote.doc_label", "Quote"),
    pdfPath: `/api/v1/quotes/${r.id}/pdf`,
    emailPath: `/api/v1/quotes/${r.id}/email`,
    detailUrl: `/documents/quotes/${r.id}`,
  }));

  const columns: ColumnDef<any>[] = useMemo(
    () => [
      {
        key: "quote_ref",
        header: "quote.reference",
        hideable: false,
        cell: (r) => (
          <Link href={`/documents/quotes/${r.id}`} className="text-primary hover:underline font-mono text-xs font-semibold">
            {r.quote_ref}
          </Link>
        ),
      },
      {
        key: "account_name",
        header: "quote.party",
        cell: (r) => <span className="text-sm">{r.account_name ?? "—"}</span>,
      },
      {
        key: "total",
        header: "common.total",
        align: "right",
        sortAccessor: (r) => Number(r.total),
        cell: (r) => (
          <span className="tabular-nums">
            {formatMoney(r.total, r.currency ?? currency, currencyPosition)}
          </span>
        ),
      },
      {
        key: "valid_until",
        header: "quote.valid_until",
        cell: (r) => <span className="text-xs text-muted-foreground">{fmtDate(r.valid_until)}</span>,
      },
      {
        key: "status",
        header: "common.status",
        cell: (r) => <Badge className={`text-xs ${STATUS_COLORS[r.status] ?? ""}`}>{r.status}</Badge>,
      },
      documentActionsColumn,
    ],
    [t, currency, currencyPosition, documentActionsColumn],
  );

  return (
    <Layout>
      <PageHeader title={t("quote.title", "Quotes")} subtitle={t("quote.count_quotations", "{{count}} quotations", { count: rows.length })} />
      <div className="p-6">
        <div className="flex gap-3 mb-4 flex-wrap justify-end">
          <Button className="bg-primary hover:bg-[#d4561a] text-white" onClick={() => navigate("/documents/quotes/new")}>
            <Plus className="h-4 w-4 mr-1" /> {t("quote.new_quote", "New Quote")}
          </Button>
        </div>

        <DataTable
          tableKey="quotes"
          columns={columns}
          data={rows}
          isLoading={isLoading}
          rowKey={(r) => r.id}
          emptyText={
            <div className="flex flex-col items-center gap-2 py-6">
              <FileText className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-muted-foreground">{t("quote.empty", "No quotes yet")}</p>
            </div>
          }
          toolbarExtra={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder={t("quote.search_placeholder", "Search by reference…")} value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
            </div>
          }
        />
      </div>

      {documentPreview}
    </Layout>
  );
}
