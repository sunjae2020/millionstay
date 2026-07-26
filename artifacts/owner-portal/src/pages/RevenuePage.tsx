import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { apiGet } from "@/lib/api";
import { TablePagination } from "@/components/TablePagination";
import { formatDate } from "@/lib/dateFormat";
import { DollarSign, TrendingUp, Clock, Search } from "lucide-react";

interface Invoice {
  id: number;
  booking_id: number;
  invoice_ref: string;
  due_date: string;
  amount_due: string;
  amount_paid: string;
  status: string;
  currency: string;
  space_name: string;
  property_name: string;
}

interface RevenueData {
  properties: Array<{ id: number; name: string }>;
  total_revenue: number;
  pending_revenue: number;
  invoices: Invoice[];
}

function StatCard({ label, value, icon: Icon, iconCls }: { label: string; value: string; icon: React.ElementType; iconCls: string }) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconCls}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

const INV_STATUS_CLS: Record<string, string> = {
  Paid: "bg-green-100 text-green-700",
  Pending: "bg-yellow-100 text-yellow-700",
  Overdue: "bg-red-100 text-red-700",
  Draft: "bg-gray-100 text-gray-600",
  Void: "bg-gray-100 text-gray-600",
};

const PAGE_SIZE = 25;

export default function RevenuePage() {
  const { t } = useTranslation();
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const sp = new URLSearchParams();
    sp.set("limit", String(pageSize));
    sp.set("offset", String((page - 1) * pageSize));
    if (debouncedSearch) sp.set("q", debouncedSearch);
    apiGet<{ success: boolean; data: RevenueData; meta?: { total?: number } }>(
      `/v1/owner/revenue?${sp.toString()}`,
    )
      .then((d) => {
        if (cancelled) return;
        setData(d.data);
        setTotal(d.meta?.total ?? d.data.invoices.length);
        setError("");
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, pageSize, debouncedSearch]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{t("revenue.title")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("revenue.subtitle")}</p>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-lg border border-destructive/20 mb-4">
          {error}
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-8">
            <StatCard label={t("revenue.total_collected")} value={`$${Number(data.total_revenue ?? 0).toLocaleString()}`} icon={DollarSign} iconCls="bg-primary/10 text-primary" />
            <StatCard label={t("revenue.pending")} value={`$${Number(data.pending_revenue ?? 0).toLocaleString()}`} icon={Clock} iconCls="bg-yellow-50 text-yellow-600" />
            <StatCard label={t("revenue.total_invoices")} value={String(total)} icon={TrendingUp} iconCls="bg-blue-50 text-blue-600" />
          </div>

          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold text-foreground">{t("revenue.invoice_history")}</h2>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("revenue.col_invoice")}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
                />
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("revenue.col_invoice")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("revenue.col_property_space")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("revenue.col_due")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("revenue.col_amount_due")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("revenue.col_amount_paid")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("revenue.col_status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">{t("common.loading")}</td></tr>
                )}
                {!loading && data.invoices.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">{t("revenue.no_invoices")}</td></tr>
                )}
                {data.invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{inv.invoice_ref ?? `#${inv.id}`}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{inv.property_name}</div>
                      <div className="text-xs text-muted-foreground">{inv.space_name}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(inv.due_date)}
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      ${Number(inv.amount_due ?? 0).toLocaleString()} {inv.currency && <span className="text-muted-foreground text-xs">{inv.currency}</span>}
                    </td>
                    <td className="px-4 py-3 font-medium text-green-600">
                      ${Number(inv.amount_paid ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${INV_STATUS_CLS[inv.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {t(`status.${inv.status}`, inv.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <TablePagination
              page={page}
              pageSize={pageSize}
              total={total}
              totalPages={totalPages}
              onPage={setPage}
              onPageSize={setPageSize}
            />
          </div>
        </>
      )}

      {loading && !data && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-card border border-card-border rounded-xl p-6 animate-pulse h-32" />
          ))}
        </div>
      )}
    </Layout>
  );
}
