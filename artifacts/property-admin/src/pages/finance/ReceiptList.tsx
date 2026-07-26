import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { formatDate, formatDateTime } from "@/lib/date";
import { DataTable, ACTIONS_KEY, type ColumnDef } from "@/components/ui/data-table";

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

async function fetchReceipts(q?: string, method?: string) {
  const params = new URLSearchParams();
  params.set("status", "Paid");
  if (q) params.set("q", q);
  if (method && method !== "_all") params.set("payment_method", method);
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
  const [q, setQ] = useState("");
  const [methodFilter, setMethodFilter] = useState("_all");

  const { data, isLoading } = useQuery({
    queryKey: ["receipts", q, methodFilter],
    queryFn: () => fetchReceipts(q || undefined, methodFilter),
  });

  const rows: any[] = Array.isArray(data) ? data : [];
  const totalPaid = rows.reduce((sum, r) => sum + (r.amount ?? 0), 0);

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
            ${Number(r.amount).toLocaleString("en-AU", { minimumFractionDigits: 2 })}
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
      {
        key: ACTIONS_KEY,
        header: "",
        hideable: false,
        sortable: false,
        align: "right",
        cell: (r) => (
          <Link href={`/finance/invoices/${r.id}`}>
            <button className="p-1.5 rounded hover:bg-muted transition-colors" title="View receipt">
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </Link>
        ),
      },
    ],
    [t],
  );

  return (
    <Layout>
      <PageHeader
        title={t("nav.receipt")}
        subtitle={`${rows.length} ${t("nav.receipt")} · ${t("common.total")} $${totalPaid.toLocaleString("en-AU", { minimumFractionDigits: 2 })}`}
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
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder={t("invoice.search_placeholder")}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
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
            </div>
          }
        />
      </div>
    </Layout>
  );
}
