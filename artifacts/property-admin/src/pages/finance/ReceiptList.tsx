import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Layout, PageHeader } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download, CheckCircle2 } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { usePagination, TablePagination } from "@/components/ui/TablePagination";
import { format } from "date-fns";

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

function fmtDate(d: string | Date | null) {
  if (!d) return "—";
  try { return format(new Date(d), "dd MMM yyyy"); } catch { return String(d); }
}

function fmtDateTime(d: string | Date | null) {
  if (!d) return "—";
  try { return format(new Date(d), "dd MMM yyyy, HH:mm"); } catch { return String(d); }
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
  const pagination = usePagination(rows);

  return (
    <Layout>
      <PageHeader
        title={t("nav.receipt")}
        subtitle={`${rows.length} ${t("nav.receipt")} · ${t("common.total")} $${totalPaid.toLocaleString("en-AU", { minimumFractionDigits: 2 })}`}
      />

      <div className="p-6">
        <div className="flex gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
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

        <div className="border rounded-lg overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("invoice.col_ref")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("invoice.col_booking")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("invoice.col_account")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("common.description")}</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("invoice.col_amount")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("invoice.col_payment_method")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("invoice.col_payment_date")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wide">{t("invoice.col_status")}</th>
                  <th className="px-4 py-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">{t("common.loading")}</td></tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle2 className="h-8 w-8 text-muted-foreground/40" />
                        <p className="text-muted-foreground">{t("finance.no_receipts") || "No receipts found"}</p>
                      </div>
                    </td>
                  </tr>
                ) : pagination.paginatedItems.map((r: any) => (
                  <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/finance/invoices/${r.id}`}
                        className="text-[#E8621A] hover:underline font-mono text-xs font-semibold">
                        {r.invoice_ref}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {r.booking_ref ? (
                        <Link href={`/booking/bookings/${r.booking_id}`}
                          className="text-blue-600 hover:underline text-xs font-mono">
                          {r.booking_ref}
                        </Link>
                      ) : r.contract_ref ? (
                        <Link href={`/booking/contracts/${r.contract_id}`}
                          className="text-blue-600 hover:underline text-xs font-mono">
                          {r.contract_ref}
                        </Link>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm">{r.account_name ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate" title={r.description}>
                      {r.description ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-green-700">
                      ${Number(r.amount).toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {METHOD_LABELS[r.payment_method] ?? r.payment_method ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDateTime(r.paid_at)}</td>
                    <td className="px-4 py-3">
                      <Badge className={`text-xs ${STATUS_COLORS[r.status] ?? ""}`}>{r.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/finance/invoices/${r.id}`}>
                        <button className="p-1.5 rounded hover:bg-muted transition-colors" title="View receipt">
                          <Download className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <TablePagination {...pagination} />
      </div>
    </Layout>
  );
}
