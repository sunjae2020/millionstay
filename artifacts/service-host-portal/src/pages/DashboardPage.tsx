import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/lib/auth";
import { apiGet } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import {
  Briefcase, Clock, CheckCircle2, Wallet, ArrowRight, Calendar, Wrench,
  AlertTriangle, Activity, TrendingUp, ClipboardList,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
} from "recharts";
import { ScheduleCalendar, type CalendarItem } from "@/components/ScheduleCalendar";

import { ExportableTable } from "@/components/ui/ExportCsvButton";
interface DashboardData {
  account_name: string;
  stats: { total_jobs: number; pending_jobs: number; completed_jobs: number; total_earnings: string };
}

type WorkOrder = {
  id: number;
  order_ref: string;
  title: string;
  category: string | null;
  priority: string;
  status: string;
  sla_status: string | null;
  acknowledged_at: string | null;
  dispatched_at: string | null;
  cost: string | null;
  currency: string | null;
};

// Brand-aligned categorical palette (light+dark safe).
const CHART = ["#E8621A", "#2A9D8F", "#C6942E", "#16263F", "#8B5CF6", "#0EA5E9"];
const STATUS_META: Record<string, { label: string; color: string; chip: string }> = {
  Open: { label: "Open", color: "#0EA5E9", chip: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
  InProgress: { label: "In progress", color: "#C6942E", chip: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  Completed: { label: "Completed", color: "#2A9D8F", chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  Cancelled: { label: "Cancelled", color: "#94A3B8", chip: "bg-muted text-muted-foreground" },
};
const AXIS = "#94a3b8";

function money(n: number, currency: string) {
  return formatMoney(n, currency);
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [data, setData] = useState<DashboardData | null>(null);
  const [orders, setOrders] = useState<WorkOrder[] | null>(null);
  const [scheduleItems, setScheduleItems] = useState<CalendarItem[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiGet<{ success: boolean; data: DashboardData }>("/v1/service-host/dashboard")
      .then((r) => { if (r.success) setData(r.data); })
      .catch(() => setError(t("dashboard.load_failed")));
    apiGet<{ success: boolean; data: WorkOrder[] }>("/v1/service-host/work-orders")
      .then((r) => setOrders(r.data ?? []))
      .catch(() => setOrders([]));
    apiGet<{ success: boolean; data: CalendarItem[] }>("/v1/service-host/schedule")
      .then((r) => { if (r.success) setScheduleItems(r.data); })
      .catch(() => {})
      .finally(() => setScheduleLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const agg = useMemo(() => {
    const list = orders ?? [];
    const currency = list.find((o) => o.currency)?.currency ?? "KRW";
    const byStatus = new Map<string, number>();
    const byCategory = new Map<string, { count: number; revenue: number }>();
    let revenue = 0, completed = 0, inProgress = 0, open = 0, needsAck = 0, breached = 0;
    for (const o of list) {
      byStatus.set(o.status, (byStatus.get(o.status) ?? 0) + 1);
      const cat = o.category ?? "other";
      const c = byCategory.get(cat) ?? { count: 0, revenue: 0 };
      const cost = Number(o.cost ?? 0) || 0;
      c.count += 1; c.revenue += cost;
      byCategory.set(cat, c);
      revenue += cost;
      if (o.status === "Completed") completed += 1;
      else if (o.status === "InProgress") inProgress += 1;
      else if (o.status === "Open") open += 1;
      if (!o.acknowledged_at && o.status !== "Completed" && o.status !== "Cancelled") needsAck += 1;
      if (o.sla_status === "breached" || o.sla_status === "escalated") breached += 1;
    }
    const statusData = [...byStatus.entries()].map(([status, count]) => ({
      name: t(`workorders.status_${status}`, STATUS_META[status]?.label ?? status),
      value: count,
      color: STATUS_META[status]?.color ?? "#94A3B8",
    }));
    const categoryData = [...byCategory.entries()]
      .map(([cat, v]) => ({ name: t(`workorders.cat_${cat}`, cat), revenue: v.revenue, count: v.count }))
      .sort((a, b) => b.revenue - a.revenue);
    return { currency, total: list.length, revenue, completed, inProgress, open, needsAck, breached, statusData, categoryData };
  }, [orders, t]);

  const loadingOrders = orders === null;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {t("dashboard.welcome")}, {user?.first_name ?? "—"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">{data?.account_name}</p>
          </div>
          <Link href="/work-orders">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary cursor-pointer hover:underline">
              <Wrench className="w-4 h-4" /> {t("dashboard.manage_orders", "Manage work orders")} <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi icon={ClipboardList} label={t("dashboard.kpi_total_orders", "Total work orders")}
            value={loadingOrders ? "—" : String(agg.total)} accent="from-primary/15 to-primary/5" iconColor="text-primary" />
          <Kpi icon={Activity} label={t("dashboard.kpi_in_progress", "In progress")}
            value={loadingOrders ? "—" : String(agg.inProgress + agg.open)}
            sub={agg.needsAck > 0 ? t("dashboard.kpi_needs_ack", { count: agg.needsAck }) : undefined}
            accent="from-amber-500/15 to-amber-500/5" iconColor="text-amber-600" />
          <Kpi icon={CheckCircle2} label={t("dashboard.kpi_completed", "Completed")}
            value={loadingOrders ? "—" : String(agg.completed)} accent="from-emerald-500/15 to-emerald-500/5" iconColor="text-emerald-600" />
          <Kpi icon={Wallet} label={t("dashboard.kpi_revenue", "Order value")}
            value={loadingOrders ? "—" : money(agg.revenue, agg.currency)} accent="from-teal-500/15 to-teal-500/5" iconColor="text-teal-600" small />
        </div>

        {/* Charts: 수익 (revenue by category) + 관리 (status distribution) */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-foreground text-sm">{t("dashboard.revenue_by_category", "Revenue by category")}</h2>
            </div>
            {loadingOrders ? (
              <div className="h-64 bg-muted rounded-lg animate-pulse" />
            ) : agg.categoryData.length === 0 ? (
              <EmptyChart label={t("dashboard.no_orders", "No work orders yet")} />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={agg.categoryData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={AXIS} strokeOpacity={0.15} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: AXIS, fontSize: 12 }} tickLine={false} axisLine={{ stroke: AXIS, strokeOpacity: 0.2 }} />
                  <YAxis tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false}
                    tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} width={40} />
                  <Tooltip cursor={{ fill: AXIS, fillOpacity: 0.08 }} content={<MoneyTooltip currency={agg.currency} />} />
                  <Bar dataKey="revenue" radius={[6, 6, 0, 0]} maxBarSize={56}>
                    {agg.categoryData.map((_, i) => <Cell key={i} fill={CHART[i % CHART.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Wrench className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-foreground text-sm">{t("dashboard.status_distribution", "Order status")}</h2>
            </div>
            {loadingOrders ? (
              <div className="h-64 bg-muted rounded-lg animate-pulse" />
            ) : agg.statusData.length === 0 ? (
              <EmptyChart label={t("dashboard.no_orders", "No work orders yet")} />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={agg.statusData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                      innerRadius={48} outerRadius={72} paddingAngle={2} stroke="none">
                      {agg.statusData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip content={<CountTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 space-y-1.5">
                  {agg.statusData.map((d) => (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                      <span className="flex-1 text-muted-foreground">{d.name}</span>
                      <span className="font-semibold text-foreground">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 관리 strip: SLA health */}
        <div className="grid grid-cols-3 gap-4">
          <MiniStat label={t("dashboard.sla_on_track", "On track")} value={agg.total - agg.breached - agg.needsAck} color="text-emerald-600" icon={CheckCircle2} loading={loadingOrders} />
          <MiniStat label={t("dashboard.sla_awaiting_ack", "Awaiting ack")} value={agg.needsAck} color="text-amber-600" icon={Clock} loading={loadingOrders} />
          <MiniStat label={t("dashboard.sla_breached", "SLA breached")} value={agg.breached} color="text-destructive" icon={AlertTriangle} loading={loadingOrders} />
        </div>

        {/* Recent work orders table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-foreground text-sm flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary" /> {t("dashboard.recent_orders", "Recent work orders")}
            </h2>
            <Link href="/work-orders">
              <span className="text-xs text-primary flex items-center gap-1 cursor-pointer hover:underline">
                {t("dashboard.view_all", "View all")} <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          </div>
          {loadingOrders ? (
            <div className="p-5 space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-muted rounded-lg animate-pulse" />)}</div>
          ) : (orders?.length ?? 0) === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm">{t("dashboard.no_orders", "No work orders yet")}</div>
          ) : (
            <div className="overflow-x-auto">
              <ExportableTable fileName="service-host-dashboard" className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="px-5 py-2.5 font-medium">{t("dashboard.col_order", "Order")}</th>
                    <th className="px-3 py-2.5 font-medium hidden sm:table-cell">{t("dashboard.col_category", "Category")}</th>
                    <th className="px-3 py-2.5 font-medium">{t("dashboard.col_status", "Status")}</th>
                    <th className="px-5 py-2.5 font-medium text-right">{t("dashboard.col_value", "Value")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(orders ?? []).slice(0, 6).map((o) => (
                    <tr key={o.id} className="hover:bg-muted/40 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-foreground truncate max-w-[240px]">{o.title}</p>
                        <p className="text-xs font-mono text-muted-foreground">{o.order_ref}</p>
                      </td>
                      <td className="px-3 py-3 hidden sm:table-cell">
                        {o.category && <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{t(`workorders.cat_${o.category}`, o.category)}</span>}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_META[o.status]?.chip ?? "bg-muted text-muted-foreground"}`}>
                          {t(`workorders.status_${o.status}`, STATUS_META[o.status]?.label ?? o.status)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-foreground whitespace-nowrap">
                        {o.cost ? money(Number(o.cost), o.currency ?? agg.currency) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </ExportableTable>
            </div>
          )}
        </div>

        {/* Schedule + quick links */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-foreground text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" /> {t("dashboard.schedule_overview")}
              </h2>
              <Link href="/schedule">
                <span className="text-xs text-primary flex items-center gap-1 cursor-pointer hover:underline">
                  {t("dashboard.full_schedule")} <ArrowRight className="w-3 h-3" />
                </span>
              </Link>
            </div>
            {scheduleLoading ? <div className="h-[420px] bg-muted rounded-xl animate-pulse" /> : <ScheduleCalendar items={scheduleItems} compact />}
          </div>
          <div className="space-y-3">
            <h2 className="font-semibold text-foreground text-sm">{t("dashboard.quick_links")}</h2>
            <QuickLink href="/work-orders" icon={Wrench} label={t("nav.work_orders", "Work Orders")} />
            <QuickLink href="/jobs" icon={Briefcase} label={t("dashboard.qlink_jobs")} />
            <QuickLink href="/documents" icon={ClipboardList} label={t("nav.documents", "Documents")} />
            <QuickLink href="/earnings" icon={Wallet} label={t("dashboard.qlink_earnings")} />
          </div>
        </div>
      </div>
    </Layout>
  );
}

function Kpi({ icon: Icon, label, value, sub, accent, iconColor, small }: {
  icon: any; label: string; value: string; sub?: string; accent: string; iconColor: string; small?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden bg-card border border-border rounded-xl p-5 bg-gradient-to-br ${accent}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <p className={`font-bold text-foreground ${small ? "text-xl" : "text-2xl"}`}>{value}</p>
      {sub && <p className="text-[11px] text-amber-600 mt-1">{sub}</p>}
    </div>
  );
}

function MiniStat({ label, value, color, icon: Icon, loading }: { label: string; value: number; color: string; icon: any; loading: boolean }) {
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
      <Icon className={`w-5 h-5 ${color} flex-shrink-0`} />
      <div className="min-w-0">
        <p className="text-lg font-bold text-foreground leading-tight">{loading ? "—" : value}</p>
        <p className="text-xs text-muted-foreground truncate">{label}</p>
      </div>
    </div>
  );
}

function QuickLink({ href, icon: Icon, label }: { href: string; icon: any; label: string }) {
  return (
    <Link href={href}>
      <div className="flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 cursor-pointer hover:bg-muted/50 hover:border-primary/40 transition-colors">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <span className="text-sm font-medium text-foreground flex-1">{label}</span>
        <ArrowRight className="w-4 h-4 text-muted-foreground" />
      </div>
    </Link>
  );
}

function EmptyChart({ label }: { label: string }) {
  return <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">{label}</div>;
}

function MoneyTooltip({ active, payload, currency }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md text-xs">
      <p className="font-medium text-foreground">{p.name}</p>
      <p className="text-muted-foreground">{money(p.revenue, currency)} · {p.count}</p>
    </div>
  );
}
function CountTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md text-xs">
      <p className="font-medium text-foreground">{p.name}: {p.value}</p>
    </div>
  );
}
