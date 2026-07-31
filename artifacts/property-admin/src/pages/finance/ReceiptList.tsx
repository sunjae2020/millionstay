import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { formatDateTime } from "@/lib/date";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { ALL, SearchBox, DateRangeFilter, FacetSelect, ResetFiltersButton, useListFacets, useYearLabel } from "@/components/list-filters";
import { useBrand } from "@/contexts/ThemeContext";
import { formatMoney } from "@/lib/currency";
import { useDocumentRowActions } from "@/components/DocumentRowActions";

const STATUS_COLORS: Record<string, string> = {
  Paid:  "bg-green-100 text-green-700",
  Sent:  "bg-blue-100 text-blue-700",
  Draft: "bg-gray-100 text-gray-500",
  Void:  "bg-red-100 text-red-600",
};

const METHOD_LABELS: Record<string, string> = {
  bank_transfer: "Bank Transfer",
  card:          "Credit Card",
  cash:          "Cash",
  stripe:        "Stripe",
};

async function fetchReceipts(q?: string, method?: string, year?: string, from?: string, to?: string) {
  const params = new URLSearchParams();
  params.set("status", "Paid");
  if (q) params.set("q", q);
  if (method && method !== "_all") params.set("payment_method", method);
  if (year && year !== ALL) params.set("year", year);
  if (from) params.set("date_from", from);
  if (to) params.set("date_to", to);
  const res = await apiFetch(`/api/v1/invoices?${params}`);
  if (!res.ok) throw new Error("Failed to fetch receipts");
  const data = await res.json();
  return Array.isArray(data) ? data : (data?.data ?? data);
}

function fmtDateTime(d: string | Date | null) {
  return formatDateTime(d);
}

export default function ReceiptList() {
  const { t } = useTranslation();
  const { currency, currencyPosition } = useBrand();
  const [q, setQ] = useState("");
  const [methodFilter, setMethodFilter] = useState(ALL);
  const [year, setYear] = useState(ALL);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const { data: facets } = useListFacets("invoices");
  const yearLabel = useYearLabel();
  const hasFilters = !!q || methodFilter !== ALL || year !== ALL || !!dateFrom || !!dateTo;
  const resetFilters = () => { setQ(""); setMethodFilter(ALL); setYear(ALL); setDateFrom(""); setDateTo(""); };

  const { data, isLoading } = useQuery({
    queryKey: ["receipts", q, methodFilter, year, dateFrom, dateTo],
    queryFn: () => fetchReceipts(q || undefined, methodFilter, year, dateFrom, dateTo),
  });

  const rows: any[] = Array.isArray(data) ? data : [];
  const totalPaid = rows.reduce((sum, r) => sum + (r.amount ?? 0), 0);

  const { documentActionsColumn, documentPreview } = useDocumentRowActions<any>((r) => ({
    ref: r.invoice_ref,
    typeLabel: t("nav.receipt"),
    filename: `${r.invoice_ref}-receipt.pdf`,
    pdfPath: `/api/v1/invoices/${r.id}/receipt/pdf`,
    emailPath: `/api/v1/invoices/${r.id}/receipt/email`,
    detailUrl: `/finance/invoices/${r.id}`,
  }));

  const columns: ColumnDef<any>[] = useMemo(
    () => [
      {
        key: "invoice_ref",
        header: "invoice.col_ref",
        hideable: false,
        cell: (r) => (
          <Link href={`/finance/invoices/${r.id}`}
            className="text-primary hover:underline font-mono text-xs font-semibold">
            {r.invoice_ref}
          </Link>
        ),
      },
      {
        key: "booking",
        header: "invoice.col_booking",
        sortAccessor: (r) => r.booking_ref ?? r.contract_ref ?? null,
        cell: (r) =>
          r.booking_ref ? (
            <Link href={`/booking/bookings/${r.booking_id}`}
              className="text-blue-600 hover:underline text-xs font-mono">
              {r.booking_ref}
            </Link>
          ) : r.contract_ref ? (
            <Link href={`/booking/contracts/${r.contract_id}`}
              className="text-blue-600 hover:underline text-xs font-mono">
              {r.contract_ref}
            </Link>
          ) : "—",
      },
      {
        key: "account_name",
        header: "invoice.col_account",
        cell: (r) => <span className="text-sm">{r.account_name ?? "—"}</span>,
      },
      {
        key: "description",
        header: "common.description",
        cell: (r) => (
          <span className="text-xs text-muted-foreground max-w-[200px] truncate block" title={r.description}>
            {r.description ?? "—"}
          </span>
        ),
      },
      {
        key: "amount",
        header: "invoice.col_amount",
        align: "right",
        sortAccessor: (r) => Number(r.amount),
        cell: (r) => (
          <span className="tabular-nums font-semibold text-green-700">
            {formatMoney(r.amount, r.currency ?? currency, currencyPosition)}
          </span>
        ),
      },
      {
        key: "payment_method",
        header: "invoice.col_payment_method",
        cell: (r) => <span className="text-xs">{METHOD_LABELS[r.payment_method] ?? r.payment_method ?? "—"}</span>,
      },
      {
        key: "paid_at",
        header: "invoice.col_payment_date",
        cell: (r) => <span className="text-xs text-muted-foreground">{fmtDateTime(r.paid_at)}</span>,
      },
      {
        key: "status",
        header: "invoice.col_status",
        cell: (r) => <Badge className={`text-xs ${STATUS_COLORS[r.status] ?? ""}`}>{r.status}</Badge>,
      },
      documentActionsColumn,
    ],
    [t, currency, currencyPosition, documentActionsColumn],
  );

  return (
    <Layout>
      <PageHeader
        title={t("nav.receipt")}
        subtitle={`${rows.length} ${t("nav.receipt")} · ${t("common.total")} ${formatMoney(totalPaid, currency, currencyPosition)}`}
      />

      <div className="p-6">
        <DataTable
          tableKey="receipts"
          columns={columns}
          data={rows}
          isLoading={isLoading}
          rowKey={(r) => r.id}
          emptyText={t("finance.no_receipts") || "No receipts found"}
          toolbarExtra={
            <div className="flex flex-wrap items-center gap-2">
              <SearchBox value={q} onChange={setQ} placeholder={t("invoice.search_placeholder")} />
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger className="w-44"><SelectValue placeholder={t("invoice.label_payment_method")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">{t("common.all")}</SelectItem>
                  <SelectItem value="bank_transfer">{t("invoice.status_paid")}</SelectItem>
                  <SelectItem value="card">{t("invoice.status_paid")}</SelectItem>
                  <SelectItem value="cash">{t("invoice.status_paid")}</SelectItem>
                  <SelectItem value="stripe">{t("invoice.status_paid")}</SelectItem>
                </SelectContent>
              </Select>
              <FacetSelect
                value={year} onChange={setYear} options={facets?.years ?? []}
                allLabel={t("common.all_years")} labelOf={yearLabel} className="w-32"
              />
              <DateRangeFilter from={dateFrom} to={dateTo} onFrom={setDateFrom} onTo={setDateTo} />
              <ResetFiltersButton show={hasFilters} onClick={resetFilters} />
            </div>
          }
        />
      </div>

      {documentPreview}
    </Layout>
  );
}
