import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
} from "recharts";
import { Layout } from "@/components/Layout";
import { apiGet } from "@/lib/api";
import { formatDate } from "@/lib/dateFormat";
import { useAuth } from "@/lib/auth";
import { useDarkMode } from "@/lib/darkMode";
import { FileSignature, DollarSign, TrendingUp, Clock, ArrowRight, PieChart as PieIcon, LineChart as LineIcon } from "lucide-react";

interface DashboardData {
  account_name: string;
  stats: {
    total_bookings: number;
    active_bookings: number;
    total_rent_managed: number;
    estimated_commission_earned: number;
  };
  status_breakdown: Array<{ status: string; count: number }>;
  monthly_trend: Array<{ key: string; label: string; rent: number; commission: number; contracts: number }>;
  recent_bookings: Array<{
    id: number;
    booking_ref: string;
    booking_status: string;
    check_in_date: string;
    check_out_date: string;
    agreed_weekly_rate: string;
    total_rent: string;
  }>;
  commission: {
    commission_type: string;
    commission_rate: number | null;
    commission_amount: number | null;
  } | null;
}

const STATUS_CLS: Record<string, string> = {
  Confirmed: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300",
  Active: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  Draft: "bg-gray-100 text-gray-600 dark:bg-gray-500/15 dark:text-gray-300",
  CheckedOut: "bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300",
  Cancelled: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
};

// Validated categorical palette (dataviz skill — passes CVD in light + dark).
// Identity follows the status entity, never its rank.
const STATUS_COLOR: Record<string, string> = {
  Active: "#E8621A",
  Confirmed: "#2563EB",
  CheckedOut: "#059669",
  Draft: "#7C3AED",
  Cancelled: "#DB2777",
};

const CURRENCY = (import.meta.env.VITE_DEFAULT_CURRENCY as string | undefined) || "";
function fmtMoney(n: number): string {
  const v = Number(n ?? 0);
  if (CURRENCY) {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: CURRENCY, maximumFractionDigits: 0 }).format(v);
    } catch { /* fall through */ }
  }
  return `$${Math.round(v).toLocaleString()}`;
}
function fmtCompact(n: number): string {
  const v = Number(n ?? 0);
  if (CURRENCY) {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: CURRENCY, notation: "compact", maximumFractionDigits: 1 }).format(v);
    } catch { /* fall through */ }
  }
  return `$${Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(v)}`;
}

function StatCard({ label, value, sub, icon: Icon, iconCls }: { label: string; value: string | number; sub?: string; icon: React.ElementType; iconCls: string }) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-5 lg:p-6">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground mt-1 truncate">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${iconCls}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { darkMode } = useDarkMode();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<{ success: boolean; data: DashboardData }>("/v1/agent/dashboard")
      .then((d) => setData(d.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const axisColor = darkMode ? "#94a3b8" : "#64748b";
  const gridColor = darkMode ? "rgba(148,163,184,0.16)" : "rgba(100,116,139,0.14)";
  const surface = darkMode ? "#1e293b" : "#ffffff";
  const borderCol = darkMode ? "#334155" : "#e2e8f0";

  const trend = (data?.monthly_trend ?? []).map((m) => ({ ...m, rent: Number(m.rent ?? 0), commission: Number(m.commission ?? 0) }));
  const hasTrend = trend.some((m) => m.rent > 0);
  const statusData = data?.status_breakdown ?? [];
  const hasStatus = statusData.length > 0;

  return (
    <Layout>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold text-foreground">
          {t("dashboard.welcome")}{user?.first_name ? `, ${user.first_name}` : ""}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {data ? `${t("dashboard.account_prefix")} ${data.account_name}` : t("dashboard.subtitle_default")}
        </p>
      </div>

      {loading && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card border border-card-border rounded-xl p-6 animate-pulse h-32" />
          ))}
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-lg border border-destructive/20">
          {error}
        </div>
      )}

      {data && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
            <StatCard label={t("dashboard.stat_total_bookings")} value={data.stats.total_bookings} icon={FileSignature} iconCls="bg-primary/10 text-primary" />
            <StatCard label={t("dashboard.stat_active_bookings")} value={data.stats.active_bookings} icon={Clock} iconCls="bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300" />
            <StatCard label={t("dashboard.stat_rent_managed")} value={fmtMoney(data.stats.total_rent_managed)} icon={DollarSign} iconCls="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" />
            <StatCard
              label={t("dashboard.stat_est_commission")}
              value={fmtMoney(data.stats.estimated_commission_earned)}
              sub={data.commission ? (data.commission.commission_type === "Percentage" ? t("dashboard.rate_percent", { rate: data.commission.commission_rate }) : t("dashboard.rate_flat", { amount: data.commission.commission_amount })) : undefined}
              icon={TrendingUp}
              iconCls="bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300"
            />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            {/* Revenue trend — single-series magnitude over time */}
            <div className="bg-card border border-card-border rounded-xl p-5 lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <LineIcon className="w-4 h-4 text-primary" />
                <h2 className="font-semibold text-foreground">{t("dashboard.revenue_trend", "Revenue trend")}</h2>
                <span className="text-xs text-muted-foreground ml-auto">{t("dashboard.last_6_months", "Last 6 months")}</span>
              </div>
              {hasTrend ? (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="rentFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#E8621A" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#E8621A" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: axisColor, fontSize: 12 }} tickLine={false} axisLine={{ stroke: borderCol }} />
                    <YAxis tick={{ fill: axisColor, fontSize: 12 }} tickLine={false} axisLine={false} width={56} tickFormatter={(v) => fmtCompact(Number(v))} />
                    <Tooltip
                      contentStyle={{ background: surface, border: `1px solid ${borderCol}`, borderRadius: 12, fontSize: 12, color: darkMode ? "#e2e8f0" : "#0f172a" }}
                      labelStyle={{ color: axisColor }}
                      formatter={(value: any, name: any) => [fmtMoney(Number(value)), name === "rent" ? t("dashboard.revenue_label", "Revenue") : t("dashboard.commission_label", "Commission")]}
                    />
                    <Area type="monotone" dataKey="rent" name="rent" stroke="#E8621A" strokeWidth={2} fill="url(#rentFill)" dot={{ r: 3, fill: "#E8621A" }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">{t("dashboard.no_data", "No data yet")}</div>
              )}
            </div>

            {/* Contract status — categorical composition */}
            <div className="bg-card border border-card-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <PieIcon className="w-4 h-4 text-primary" />
                <h2 className="font-semibold text-foreground">{t("dashboard.contract_status", "Contract status")}</h2>
              </div>
              {hasStatus ? (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={statusData} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={2} stroke={surface} strokeWidth={2}>
                        {statusData.map((s) => (
                          <Cell key={s.status} fill={STATUS_COLOR[s.status] ?? "#94a3b8"} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: surface, border: `1px solid ${borderCol}`, borderRadius: 12, fontSize: 12, color: darkMode ? "#e2e8f0" : "#0f172a" }}
                        formatter={(value: any, _n: any, p: any) => [value, t(`status.${p?.payload?.status}`, p?.payload?.status)]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-3 space-y-1.5">
                    {statusData.map((s) => (
                      <div key={s.status} className="flex items-center gap-2 text-xs">
                        <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: STATUS_COLOR[s.status] ?? "#94a3b8" }} />
                        <span className="text-muted-foreground flex-1">{t(`status.${s.status}`, s.status)}</span>
                        <span className="font-semibold text-foreground">{s.count}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">{t("dashboard.no_data", "No data yet")}</div>
              )}
            </div>
          </div>

          {/* Recent contracts — management table */}
          <div className="bg-card border border-card-border rounded-xl">
            <div className="flex items-center justify-between p-5 border-b border-card-border">
              <h2 className="font-semibold text-foreground">{t("dashboard.recent_contracts", "Recent contracts")}</h2>
              <Link href="/bookings">
                <span className="text-sm text-primary hover:underline flex items-center gap-1 cursor-pointer">
                  {t("dashboard.view_all")} <ArrowRight className="w-3 h-3" />
                </span>
              </Link>
            </div>
            {data.recent_bookings.length === 0 ? (
              <p className="text-sm text-muted-foreground p-6">{t("dashboard.no_bookings")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-muted-foreground border-b border-card-border">
                      <th className="px-5 py-3 font-medium">{t("dashboard.col_ref", "Reference")}</th>
                      <th className="px-5 py-3 font-medium">{t("dashboard.checkin_label", "Check-in")}</th>
                      <th className="px-5 py-3 font-medium text-right">{t("dashboard.col_total", "Total")}</th>
                      <th className="px-5 py-3 font-medium text-right">{t("dashboard.col_status", "Status")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.recent_bookings.map((b) => (
                      <tr key={b.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-5 py-3">
                          <Link href={`/bookings/${b.id}`}>
                            <span className="font-mono text-xs text-primary hover:underline cursor-pointer">{b.booking_ref ?? `#${b.id}`}</span>
                          </Link>
                        </td>
                        <td className="px-5 py-3 text-muted-foreground">{formatDate(b.check_in_date, t("common.tbd"))}</td>
                        <td className="px-5 py-3 text-right font-medium text-foreground">{fmtMoney(Number(b.total_rent ?? 0))}</td>
                        <td className="px-5 py-3 text-right">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_CLS[b.booking_status] ?? "bg-gray-100 text-gray-600"}`}>
                            {t(`status.${b.booking_status}`, b.booking_status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </Layout>
  );
}
