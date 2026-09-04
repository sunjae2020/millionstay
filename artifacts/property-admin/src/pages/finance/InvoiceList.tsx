import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, Link } from "wouter";
import { type Invoice } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { DataTable, useServerList, type ColumnDef } from "@/components/ui/data-table";
import { useBrand } from "@/contexts/ThemeContext";
import { formatMoney } from "@/lib/currency";
import { formatDate } from "@/lib/date";
import { useDocumentRowActions } from "@/components/DocumentRowActions";
import { ALL, SearchBox, DateRangeFilter, FacetSelect, ResetFiltersButton, useListFacets, useYearLabel } from "@/components/list-filters";

/** 서버가 정렬할 수 있는 컬럼(api-server routes/invoices.ts 의 INVOICE_SORT 와 1:1). */
const SORTABLE_KEYS = [
  "invoice_ref", "booking_ref", "contract_ref", "account_name", "amount",
  "due_date", "status", "created_at", "updated_at",
];

const statusColors: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-600",
  Sent: "bg-blue-100 text-blue-700",
  Paid: "bg-green-100 text-green-700",
  Void: "bg-red-100 text-red-600",
};

export default function InvoiceList() {
  const { t } = useTranslation();
  const { currency, currencyPosition } = useBrand();
  const [, navigate] = useLocation();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(ALL);
  const [year, setYear] = useState(ALL);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const { data: facets } = useListFacets("invoices", showDeleted);
  const yearLabel = useYearLabel();

  const filters = {
    q: q || undefined,
    status: status === ALL ? undefined : status,
    year: year === ALL ? undefined : year,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    ...(showDeleted ? { deleted: "only" } : {}),
  };

  const hasFilters = !!q || status !== ALL || year !== ALL || !!dateFrom || !!dateTo;
  const resetFilters = () => { setQ(""); setStatus(ALL); setYear(ALL); setDateFrom(""); setDateTo(""); };

  const { rows: invoicesRaw, isLoading, server, invalidate } = useServerList<Invoice>(
    "/api/v1/invoices",
    { filters, sortableKeys: SORTABLE_KEYS, defaultSort: { key: "created_at", dir: "desc" } },
  );

  const { documentActionsColumn, documentPreview } = useDocumentRowActions<Invoice>((inv) => ({
    ref: inv.invoice_ref,
    typeLabel: t("nav.invoice"),
    pdfPath: `/api/v1/invoices/${inv.id}/pdf`,
    emailPath: `/api/v1/invoices/${inv.id}/email`,
    detailUrl: `/finance/invoices/${inv.id}`,
  }));

  const columns: ColumnDef<Invoice>[] = useMemo(
    () => [
      {
        key: "invoice_ref",
        header: "invoice.col_ref",
        hideable: false,
        cell: (inv) => (
          <Link href={`/finance/invoices/${inv.id}`} className="font-medium text-primary hover:underline">
            {inv.invoice_ref}
          </Link>
        ),
      },
      {
        key: "booking_ref",
        header: "invoice.col_booking",
        cell: (inv) => <span className="text-muted-foreground">{inv.booking_ref ?? "—"}</span>,
      },
      {
        key: "contract_ref",
        header: "invoice.col_contract",
        cell: (inv) => <span className="text-muted-foreground">{inv.contract_ref ?? "—"}</span>,
      },
      {
        key: "account_name",
        header: "invoice.col_account",
        cell: (inv) => <span className="text-muted-foreground">{inv.account_name ?? "—"}</span>,
      },
      {
        key: "amount",
        header: "invoice.col_amount",
        align: "right",
        sortAccessor: (inv) => inv.amount,
        cell: (inv) => (
          <span className="font-medium">
            {formatMoney(inv.amount, inv.currency ?? currency, currencyPosition)}
          </span>
        ),
      },
      {
        key: "due_date",
        header: "invoice.col_due_date",
        cell: (inv) => <span className="text-muted-foreground">{formatDate(inv.due_date)}</span>,
      },
      {
        key: "status",
        header: "invoice.col_status",
        cell: (inv) => (
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[inv.status] ?? "bg-gray-100 text-gray-600"}`}>
            {t(`invoice.status_${inv.status.toLowerCase()}`)}
          </span>
        ),
      },
      documentActionsColumn,
    ],
    [t, currency, currencyPosition, documentActionsColumn],
  );

  return (
    <Layout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("nav.invoice")}</h1>
            <p className="text-sm text-muted-foreground">{invoicesRaw.length} {t("common.total")}</p>
          </div>
          <Button onClick={() => navigate("/finance/invoices/new")}>
            <Plus className="h-4 w-4 mr-1" />
            {t("invoice.new")}
          </Button>
        </div>

        <DataTable
          tableKey="invoices"
          columns={columns}
          data={invoicesRaw}
          server={server}
          isLoading={isLoading}
          rowKey={(inv) => inv.id}
          emptyText={t("invoice.no_invoices")}
          selection={{
            enable: true,
            resource: "invoices",
            onChanged: invalidate,
          }}
          showDeleted={showDeleted}
          onToggleShowDeleted={setShowDeleted}
          toolbarExtra={
            <div className="flex flex-wrap items-center gap-2">
              <SearchBox value={q} onChange={setQ} placeholder={t("invoice.search_placeholder")} />
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">{t("invoice.all_statuses")}</SelectItem>
                  <SelectItem value="Draft">{t("invoice.status_draft")}</SelectItem>
                  <SelectItem value="Sent">{t("invoice.status_sent")}</SelectItem>
                  <SelectItem value="Paid">{t("invoice.status_paid")}</SelectItem>
                  <SelectItem value="Void">{t("invoice.status_void")}</SelectItem>
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
