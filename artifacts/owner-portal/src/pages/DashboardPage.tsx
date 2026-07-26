import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, BarChart,
} from "recharts";
import { Layout } from "@/components/Layout";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { OWNER_SITE_ENABLED } from "@/lib/flags";
import {
  Building2, BookOpen, TrendingUp, ArrowRight, Globe, ExternalLink, Inbox,
  Wallet, PieChart as PieIcon, FileSignature, AlertTriangle, DoorOpen, BarChart3,
} from "lucide-react";
import { formatDate } from "@/lib/dateFormat";
import { InquiryRow, type Inquiry } from "@/pages/InquiriesPage";

interface Property {
  id: number;
  name: string;
  address: string;
  city: string;
  state: string;
  approval_status: string;
}

interface DashboardData {
  account_name: string;
  properties: Property[];
  stats: {
    total_properties: number;
    total_spaces: number;
    active_bookings: number;
    monthly_revenue: number;
  };
  recent_bookings: Array<{
    id: number;
    booking_ref: string;
    booking_status: string;
    space_id: number;
    check_in_date: string;
    agreed_weekly_rate: string;
  }>;
}

interface AnalyticsData {
  revenue_trend: Array<{ month: string; paid: number; pending: number }>;
  occupancy: { occupied: number; total: number; rate: number };
  contracts_by_status: Array<{ status: string; count: number }>;
  invoices_summary: { paid: number; pending: number; overdue: number; paid_count: number; pending_count: number; overdue_count: number };
  spaces_by_status: Array<{ status: string; count: number }>;
  revenue_by_property: Array<{ property: string; paid: number }>;
  currency: string;
}

const CHART = ["hsl(var(--chart-1))", "hsl(var(--chart-3))", "hsl(var(--chart-2))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];
const AXIS = "hsl(var(--muted-foreground))";
const TOOLTIP_STYLE = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  color: "hsl(var(--foreground))",
  fontSize: 12,
};

function money(v: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(v || 0);
  } catch {
    return `${currency} ${Math.round(v || 0).toLocaleString()}`;
  }
}

const STATUS_CLS: Record<string, string> = {
  Confirmed: "bg-green-100 text-green-700",
  Active: "bg-blue-100 text-blue-700",
  Draft: "bg-gray-100 text-gray-600",
  CheckedOut: "bg-purple-100 text-purple-700",
  Cancelled: "bg-red-100 text-red-700",
};

/* ── Stat card ─────────────────────────────────────────── */
function StatCard({ label, value, sub, icon: Icon, iconCls }: { label: string; value: string | number; sub?: string; icon: React.ElementType; iconCls: string }) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-5">
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

/* ── Section card wrapper ──────────────────────────────── */
function Panel({ title, icon: Icon, action, children, className }: { title: string; icon: React.ElementType; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-card border border-card-border rounded-xl flex flex-col ${className ?? ""}`}>
      <div className="flex items-center justify-between p-5 border-b border-card-border">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" /> {title}
        </h2>
        {action}
      </div>
      <div className="p-5 flex-1">{children}</div>
    </div>
  );
}

/** Discovery / status card for the owner's landing site ("내 사이트"). */
function SiteBanner() {
  const { t } = useTranslation();
  const [site, setSite] = useState<{ slug: string; status: string } | null | undefined>(undefined);

  useEffect(() => {
    apiGet<{ success: boolean; data: { slug: string; status: string } | null }>("/v1/owner/site")
      .then((d) => setSite(d.data))
      .catch(() => setSite(null));
  }, []);

  if (site === undefined) return null;
  const url = site?.slug ? `https://${site.slug}.millionstay.com` : null;

  return (
    <div className="mb-8 rounded-xl border border-primary/20 bg-primary/5 p-5 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          <Globe className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          {site ? (
            <>
              <p className="font-medium text-foreground">{t("dashboard.site_live_title", "Your landing site")}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {url && (
                  <a href={url} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline inline-flex items-center gap-1 truncate">
                    {url.replace("https://", "")} <ExternalLink className="w-3 h-3 flex-shrink-0" />
                  </a>
                )}
                {site.status !== "published" && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                    {t("dashboard.site_draft_badge", "Draft")}
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="font-medium text-foreground">{t("dashboard.site_cta_title", "Create your own landing site")}</p>
              <p className="text-sm text-muted-foreground">{t("dashboard.site_cta_sub", "A public page where guests browse and book only your accommodation.")}</p>
            </>
          )}
        </div>
      </div>
      <Link href="/site">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium cursor-pointer hover:opacity-90 transition-opacity whitespace-nowrap">
          {site ? t("dashboard.site_manage", "Manage site") : t("dashboard.site_get_started", "Get started")}
          <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </Link>
    </div>
  );
}

/** Recent landing-site inquiries preview for the dashboard. */
function RecentInquiries() {
  const { t } = useTranslation();
  const [items, setItems] = useState<Inquiry[] | null>(null);

  useEffect(() => {
    apiGet<{ success: boolean; data: Inquiry[] }>("/v1/owner/site/inquiries?limit=5")
      .then((d) => setItems(d.data))
      .catch(() => setItems([]));
  }, []);

  if (!items || items.length === 0) return null;

  return (
    <div className="mt-6 bg-card border border-card-border rounded-xl">
      <div className="flex items-center justify-between p-6 border-b border-card-border">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Inbox className="w-4 h-4 text-primary" /> {t("dashboard.recent_inquiries", "Recent inquiries")}
        </h2>
        <Link href="/inquiries">
          <span className="text-sm text-primary hover:underline flex items-center gap-1 cursor-pointer">
            {t("dashboard.view_all")} <ArrowRight className="w-3 h-3" />
          </span>
        </Link>
      </div>
      <div className="divide-y divide-border">
        {items.map((q) => <InquiryRow key={q.id} q={q} />)}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const [data, setData] = useState<DashboardData | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      apiGet<{ success: boolean; data: DashboardData }>("/v1/owner/dashboard"),
      apiGet<{ success: boolean; data: AnalyticsData }>("/v1/owner/analytics"),
    ])
      .then(([d, a]) => { setData(d.data); setAnalytics(a.data); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const cur = analytics?.currency ?? "KRW";
  const monthLabel = (m: string) => {
    const d = new Date(m + "-01T00:00:00Z");
    return d.toLocaleDateString(i18n.language, { month: "short", timeZone: "UTC" });
  };
  const thisMonthPaid = analytics?.revenue_trend?.at(-1)?.paid ?? 0;

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          {t("dashboard.welcome")}{user?.first_name ? `, ${user.first_name}` : ""}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {data ? `${t("dashboard.account_prefix")} ${data.account_name}` : t("dashboard.subtitle_default")}
        </p>
      </div>

      {OWNER_SITE_ENABLED && <SiteBanner />}

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

      {data && analytics && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
            <StatCard label={t("dashboard.kpi_month_revenue", "This month's revenue")} value={money(thisMonthPaid, cur)} sub={t("dashboard.kpi_paid_invoices", { count: analytics.invoices_summary.paid_count })} icon={Wallet} iconCls="bg-primary/10 text-primary" />
            <StatCard label={t("dashboard.kpi_occupancy", "Occupancy")} value={`${analytics.occupancy.rate}%`} sub={t("dashboard.kpi_occupancy_sub", { occupied: analytics.occupancy.occupied, total: analytics.occupancy.total })} icon={DoorOpen} iconCls="bg-green-50 text-green-600" />
            <StatCard label={t("dashboard.kpi_active_bookings", "Active bookings")} value={data.stats.active_bookings} sub={t("dashboard.stat_spaces_sub", { count: data.stats.total_spaces })} icon={BookOpen} iconCls="bg-blue-50 text-blue-600" />
            <StatCard label={t("dashboard.kpi_overdue", "Overdue")} value={money(analytics.invoices_summary.overdue, cur)} sub={t("dashboard.kpi_overdue_sub", { count: analytics.invoices_summary.overdue_count })} icon={AlertTriangle} iconCls="bg-red-50 text-red-600" />
          </div>

          {/* 수익 (Revenue) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <Panel title={t("dashboard.revenue_trend", "Revenue trend")} icon={TrendingUp} className="lg:col-span-2">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={analytics.revenue_trend} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="month" tickFormatter={monthLabel} tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} width={54}
                      tickFormatter={(v) => new Intl.NumberFormat(i18n.language, { notation: "compact", maximumFractionDigits: 1 }).format(v)} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => money(v, cur)} labelFormatter={monthLabel} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="paid" name={t("dashboard.legend_paid", "Paid")} fill={CHART[0]} radius={[4, 4, 0, 0]} maxBarSize={28} />
                    <Line type="monotone" dataKey="pending" name={t("dashboard.legend_pending", "Outstanding")} stroke={CHART[3]} strokeWidth={2} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title={t("dashboard.revenue_by_property", "Revenue by property")} icon={BarChart3}>
              {analytics.revenue_by_property.length === 0 ? (
                <p className="text-sm text-muted-foreground py-12 text-center">{t("dashboard.no_data", "No data yet")}</p>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.revenue_by_property} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false}
                        tickFormatter={(v) => new Intl.NumberFormat(i18n.language, { notation: "compact", maximumFractionDigits: 1 }).format(v)} />
                      <YAxis type="category" dataKey="property" tick={{ fill: AXIS, fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number) => money(v, cur)} cursor={{ fill: "hsl(var(--muted))" }} />
                      <Bar dataKey="paid" name={t("dashboard.legend_paid", "Paid")} fill={CHART[0]} radius={[0, 4, 4, 0]} maxBarSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>
          </div>

          {/* 관리 (Management) + 계약 (Contracts) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <Panel title={t("dashboard.occupancy_title", "Occupancy")} icon={DoorOpen}>
              <OccupancyDonut occupied={analytics.occupancy.occupied} total={analytics.occupancy.total} rate={analytics.occupancy.rate} />
            </Panel>

            <Panel title={t("dashboard.contracts_title", "Contracts")} icon={FileSignature}>
              <StatusDonut items={analytics.contracts_by_status} emptyLabel={t("dashboard.no_contracts", "No contracts")} />
            </Panel>

            <Panel title={t("dashboard.spaces_status_title", "Spaces by status")} icon={PieIcon}>
              <StatusBars items={analytics.spaces_by_status} emptyLabel={t("dashboard.no_data", "No data yet")} />
            </Panel>
          </div>

          {/* Recent bookings + properties */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card border border-card-border rounded-xl">
              <div className="flex items-center justify-between p-5 border-b border-card-border">
                <h2 className="font-semibold text-foreground flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" />{t("dashboard.recent_bookings")}</h2>
                <Link href="/bookings">
                  <span className="text-sm text-primary hover:underline flex items-center gap-1 cursor-pointer">
                    {t("dashboard.view_all")} <ArrowRight className="w-3 h-3" />
                  </span>
                </Link>
              </div>
              <div className="divide-y divide-border">
                {data.recent_bookings.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-6">{t("dashboard.no_bookings")}</p>
                ) : (
                  data.recent_bookings.map((b) => (
                    <div key={b.id} className="flex items-center justify-between p-4">
                      <div>
                        <p className="text-sm font-medium text-foreground font-mono">{b.booking_ref ?? `#${b.id}`}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t("dashboard.checkin_label")}: {formatDate(b.check_in_date, t("common.tbd"))}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-foreground">{money(Number(b.agreed_weekly_rate ?? 0), cur)}<span className="text-muted-foreground text-xs">/{t("dashboard.per_week", "wk")}</span></p>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_CLS[b.booking_status] ?? "bg-gray-100 text-gray-600"}`}>
                          {t(`status.${b.booking_status}`, b.booking_status)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-card border border-card-border rounded-xl">
              <div className="flex items-center justify-between p-5 border-b border-card-border">
                <h2 className="font-semibold text-foreground flex items-center gap-2"><Building2 className="w-4 h-4 text-primary" />{t("dashboard.my_properties")}</h2>
                <Link href="/properties">
                  <span className="text-sm text-primary hover:underline flex items-center gap-1 cursor-pointer">
                    {t("dashboard.view_all")} <ArrowRight className="w-3 h-3" />
                  </span>
                </Link>
              </div>
              <div className="divide-y divide-border">
                {data.properties.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-6">{t("dashboard.no_properties")}</p>
                ) : (
                  data.properties.map((p) => (
                    <Link key={p.id} href={`/properties/${p.id}`}>
                      <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors cursor-pointer">
                        <div>
                          <p className="text-sm font-medium text-foreground">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{[p.city, p.state].filter(Boolean).join(", ") || p.address}</p>
                        </div>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.approval_status === "Approved" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                          {t(`status.${p.approval_status}`, p.approval_status)}
                        </span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </div>

          {OWNER_SITE_ENABLED && <RecentInquiries />}
        </>
      )}
    </Layout>
  );
}

/* ── Occupancy donut (occupied vs vacant) ──────────────── */
function OccupancyDonut({ occupied, total, rate }: { occupied: number; total: number; rate: number }) {
  const { t } = useTranslation();
  const vacant = Math.max(0, total - occupied);
  const rows = [
    { name: t("dashboard.occupied", "Occupied"), value: occupied, color: CHART[0] },
    { name: t("dashboard.vacant", "Vacant"), value: vacant, color: "hsl(var(--muted))" },
  ];
  if (total === 0) return <p className="text-sm text-muted-foreground py-16 text-center">{t("dashboard.no_data", "No data yet")}</p>;
  return (
    <div className="relative">
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={rows} dataKey="value" innerRadius={58} outerRadius={82} paddingAngle={2} startAngle={90} endAngle={-270}>
              {rows.map((r, i) => <Cell key={i} fill={r.color} stroke="hsl(var(--card))" strokeWidth={2} />)}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ top: "-1.5rem" }}>
        <span className="text-3xl font-bold text-foreground">{rate}%</span>
        <span className="text-xs text-muted-foreground">{occupied}/{total}</span>
      </div>
      <div className="flex justify-center gap-4 mt-2">
        {rows.map((r) => (
          <div key={r.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: r.color }} /> {r.name}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Status donut (contracts) ──────────────────────────── */
function StatusDonut({ items, emptyLabel }: { items: Array<{ status: string; count: number }>; emptyLabel: string }) {
  const { t } = useTranslation();
  const total = items.reduce((s, i) => s + i.count, 0);
  if (total === 0) return <p className="text-sm text-muted-foreground py-16 text-center">{emptyLabel}</p>;
  return (
    <div className="flex items-center gap-4">
      <div className="h-40 w-40 flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={items} dataKey="count" nameKey="status" innerRadius={42} outerRadius={64} paddingAngle={2}>
              {items.map((_, i) => <Cell key={i} fill={CHART[i % CHART.length]} stroke="hsl(var(--card))" strokeWidth={2} />)}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 space-y-1.5 min-w-0">
        {items.map((it, i) => (
          <div key={it.status} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-muted-foreground truncate">
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: CHART[i % CHART.length] }} />
              {t(`status.${it.status}`, it.status)}
            </span>
            <span className="font-medium text-foreground">{it.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Status bars (spaces) ──────────────────────────────── */
function StatusBars({ items, emptyLabel }: { items: Array<{ status: string; count: number }>; emptyLabel: string }) {
  const { t } = useTranslation();
  const total = items.reduce((s, i) => s + i.count, 0);
  if (total === 0) return <p className="text-sm text-muted-foreground py-16 text-center">{emptyLabel}</p>;
  const sorted = [...items].sort((a, b) => b.count - a.count);
  return (
    <div className="space-y-3 py-2">
      {sorted.map((it, i) => (
        <div key={it.status}>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-muted-foreground">{t(`status.${it.status}`, it.status)}</span>
            <span className="font-medium text-foreground">{it.count}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${(it.count / total) * 100}%`, background: CHART[i % CHART.length] }} />
          </div>
        </div>
      ))}
    </div>
  );
}
