import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { apiGet } from "@/lib/api";
import { TablePagination } from "@/components/TablePagination";
import { formatDate } from "@/lib/dateFormat";
import { DollarSign, TrendingUp, Clock, CheckCircle, Search } from "lucide-react";

interface CommissionApiData {
  account_name: string;
  commission: {
    id: number;
    commission_type: string;
    commission_rate: number | null;
    commission_amount: number | null;
  } | null;
  total_earned: number;
  paid_count: number;
  pending_count: number;
  breakdown: Array<{
    booking_ref: string;
    booking_status: string;
    check_in_date: string;
    check_out_date: string;
    rent_amount: number;
    commission_earned: number;
  }>;
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

const PAGE_SIZE = 25;

export default function CommissionPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<CommissionApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [total, setTotal] = useState(0);

  // Debounce search; reset to first page when it changes.
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
    apiGet<{ success: boolean; data: CommissionApiData; meta?: { total?: number } }>(
      `/v1/agent/commission?${sp.toString()}`,
    )
      .then((d) => {
        if (cancelled) return;
        setData(d.data);
        setTotal(d.meta?.total ?? d.data.breakdown.length);
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
        <h1 className="text-2xl font-bold text-foreground">{t("commission.title")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("commission.subtitle")}</p>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-lg border border-destructive/20 mb-4">
          {error}
        </div>
      )}

      {data && (
        <>
          {data.commission && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6 flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-primary" />
              <div>
                <span className="text-sm font-medium text-foreground">{t("commission.your_rate_prefix")} </span>
                <span className="text-sm text-primary font-semibold">
                  {data.commission.commission_type === "Percentage"
                    ? t("commission.rate_percent", { rate: data.commission.commission_rate })
                    : t("commission.rate_flat", { amount: data.commission.commission_amount })}
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-8">
            <StatCard label={t("commission.stat_total_earned")} value={`$${Number(data.total_earned ?? 0).toLocaleString()}`} icon={DollarSign} iconCls="bg-primary/10 text-primary" />
            <StatCard label={t("commission.stat_all_bookings")} value={String(data.paid_count + data.pending_count)} icon={TrendingUp} iconCls="bg-blue-50 text-blue-600" />
            <StatCard label={t("commission.stat_paid")} value={String(data.paid_count)} icon={CheckCircle} iconCls="bg-green-50 text-green-600" />
            <StatCard label={t("commission.stat_pending")} value={String(data.pending_count)} icon={Clock} iconCls="bg-yellow-50 text-yellow-600" />
          </div>

          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold text-foreground">{t("commission.breakdown")}</h2>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("commission.col_ref")}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
                />
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("commission.col_ref")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("commission.col_checkin")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("commission.col_checkout")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("commission.col_rent")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("commission.col_commission")}</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">{t("commission.col_status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">{t("common.loading")}</td></tr>
                )}
                {!loading && data.breakdown.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">{t("commission.no_data")}</td></tr>
                )}
                {data.breakdown.map((row, i) => (
                  <tr key={i} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.booking_ref}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(row.check_in_date)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(row.check_out_date, t("common.ongoing"))}
                    </td>
                    <td className="px-4 py-3 text-foreground">${Number(row.rent_amount ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-3 font-semibold text-foreground">${Number(row.commission_earned ?? 0).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${["Active", "CheckedOut"].includes(row.booking_status) ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                        {t(`status.${row.booking_status}`, row.booking_status)}
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
