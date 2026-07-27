import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, Link } from "wouter";
import {
  useListInvoices,
  getListInvoicesQueryKey,
  type ListInvoicesParams,
  type Invoice,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { DataTable, type ColumnDef } from "@/components/ui/data-table";
import { useBrand } from "@/contexts/ThemeContext";
import { formatMoney } from "@/lib/currency";
import { formatDate } from "@/lib/date";

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
  const [status, setStatus] = useState("_all");
  const [showDeleted, setShowDeleted] = useState(false);
  const qc = useQueryClient();

  const params: ListInvoicesParams & { deleted?: string } = {
    q: q || undefined,
    status: status === "_all" ? undefined : status,
    ...(showDeleted ? { deleted: "only" } : {}),
  };

  const { data: invoicesRaw = [], isLoading } = useListInvoices(params, {
    query: { queryKey: getListInvoicesQueryKey(params) },
  });

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
    ],
    [t, currency, currencyPosition],
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
          isLoading={isLoading}
          rowKey={(inv) => inv.id}
          emptyText={t("invoice.no_invoices")}
          selection={{
            enable: true,
            resource: "invoices",
            onChanged: () => qc.invalidateQueries({ queryKey: getListInvoicesQueryKey() }),
          }}
          showDeleted={showDeleted}
          onToggleShowDeleted={setShowDeleted}
          toolbarExtra={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-56">
                <Input
                  placeholder={t("invoice.search_placeholder")}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="pl-4"
                />
              </div>
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
            </div>
          }
        />
      </div>
    </Layout>
  );
}
