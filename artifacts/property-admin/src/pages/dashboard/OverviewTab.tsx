import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { apiFetch } from "@/lib/apiFetch";
import {
  useListProperties, useListContacts, useListTasks, useListLeads,
  useListBookings, useListWorkOrders,
} from "@workspace/api-client-react";
import {
  BedDouble, LogIn, LogOut, DollarSign, CalendarDays, Building2, Layers,
  Users, TrendingUp, AlertTriangle, Plus, Receipt, Wrench, FileText,
  Activity, ArrowRight, CheckSquare,
} from "lucide-react";
import { KpiCard, DashCard, BRAND, BRAND_SOFT } from "@/components/dashboard/DashboardKit";
import { useBrand } from "@/contexts/ThemeContext";
import { formatMoney } from "@/lib/currency";
import { formatDate } from "@/lib/date";

import { ExportableTable } from "@/components/ui/ExportCsvButton";
const CONTRACT_BADGE: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-600", Sent: "bg-amber-100 text-amber-800",
  Signed: "bg-blue-100 text-blue-800", Active: "bg-green-100 text-green-700",
  Completed: "bg-indigo-100 text-indigo-700", Expired: "bg-gray-100 text-gray-600",
  Terminated: "bg-red-100 text-red-700", Cancelled: "bg-gray-100 text-gray-500",
};

const MOVE_COLORS = { move_in: "#3b82f6", leased: "#22c55e", move_out: "#f97316" } as const;

interface BoardContract {
  id: number; contract_ref: string; tenant_name: string | null;
  start_date: string | null; end_date: string | null; status: string;
}
interface OverviewBoard {
  today: string;
  calendar: {
    start: string; days: number; move_ins: number; move_outs: number;
    rows: { space_id: number; space_name: string; contracts: BoardContract[] }[];
    next_event: { date: string; kind: "move_in" | "move_out"; space_name: string | null; contract_id: number } | null;
  };
  alerts: {
    overdue_invoices: number; overdue_amount: number; awaiting_signature: number;
    expiring_soon: number; expiry_window_days: number; past_end_still_live: number; stale_drafts: number;
  };
  collected_this_month: { amount: number; count: number };
  portfolio: { total_units: number; rented_units: number; vacant_units: number; live_contracts: number };
  recent_contracts: (BoardContract & {
    lease_mode: string | null; space_name: string | null; monthly_rent: number | null;
    rate_amount: number | null; rate_period: string | null; bond_amount: number | null; currency: string | null;
  })[];
  activity: {
    id: number; entity_type: string; entity_id: number; action: string; actor: string;
    created_at: string; label: string | null; new_status: string | null;
  }[];
}

function isoAddDays(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 7일 입주·퇴거 캘린더 — 이번 주에 입주일·종료일이 있는 세대만 행으로 올린다. */
function MoveCalendar({ board }: { board: OverviewBoard | null }) {
  const { t, i18n } = useTranslation();
  if (!board) return <p className="text-sm text-muted-foreground text-center py-8">{t("dash_overview.loading")}</p>;
  const { calendar } = board;
  const dates = Array.from({ length: calendar.days }, (_, i) => isoAddDays(calendar.start, i));
  const rows = calendar.rows.slice(0, 10);

  function cellFor(contracts: BoardContract[], ds: string) {
    for (const c of contracts) {
      if (c.start_date === ds) return { kind: "move_in" as const, c };
      if (c.end_date === ds && c.status !== "Terminated") return { kind: "move_out" as const, c };
    }
    for (const c of contracts) {
      if ((c.start_date ?? "0000-01-01") <= ds && (c.end_date ?? "9999-12-31") >= ds) return { kind: "leased" as const, c };
    }
    return null;
  }

  const legend = (
    <div className="flex flex-wrap items-center gap-3 pt-3 mt-1 border-t">
      {(["move_in", "leased", "move_out"] as const).map((k) => (
        <div key={k} className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: MOVE_COLORS[k] }} />
          <span className="text-[10px] text-muted-foreground">{t(`dash_overview.cal_${k}`)}</span>
        </div>
      ))}
      <span className="ml-auto text-[11px] text-muted-foreground">
        {t("dash_overview.cal_summary", { in: calendar.move_ins, out: calendar.move_outs })}
      </span>
    </div>
  );

  if (rows.length === 0) {
    const next = calendar.next_event;
    return (
      <div>
        <div className="text-center py-8 space-y-2">
          <p className="text-sm text-muted-foreground">{t("dash_overview.cal_empty")}</p>
          {next && (
            <Link href={`/booking/contracts/${next.contract_id}`} className="inline-block text-xs text-primary hover:underline">
              {t(next.kind === "move_in" ? "dash_overview.cal_next_move_in" : "dash_overview.cal_next_move_out", {
                date: formatDate(next.date), space: next.space_name ?? "—",
              })} →
            </Link>
          )}
        </div>
        {legend}
      </div>
    );
  }

  return (
    <div className="overflow-auto">
      <div className="min-w-max">
        <div className="flex border-b">
          <div className="w-40 shrink-0 px-2 py-1.5 text-[11px] font-semibold text-muted-foreground">{t("dash_overview.col_unit_tenant")}</div>
          {dates.map((ds) => {
            const d = new Date(ds + "T00:00:00Z");
            return (
              <div key={ds} className={`w-14 shrink-0 text-center py-1.5 text-[11px] ${ds === board.today ? "text-primary font-bold" : "text-muted-foreground"}`}>
                <div>{d.getUTCDate()}</div>
                <div className="text-[9px]">{d.toLocaleDateString(i18n.language, { weekday: "short", timeZone: "UTC" })}</div>
              </div>
            );
          })}
        </div>
        {rows.map((row) => {
          const tenant = row.contracts.map(c => c.tenant_name).filter(Boolean).join(" → ");
          return (
            <div key={row.space_id} className="flex border-b last:border-b-0 hover:bg-muted/30">
              <div className="w-40 shrink-0 px-2 py-1.5 min-w-0">
                <div className="text-[11px] font-medium truncate">{row.space_name}</div>
                {tenant && <div className="text-[10px] text-muted-foreground truncate">{tenant}</div>}
              </div>
              {dates.map((ds) => {
                const cell = cellFor(row.contracts, ds);
                return (
                  <div key={ds} className="w-14 shrink-0 h-9 p-0.5">
                    {cell && (
                      <Link href={`/booking/contracts/${cell.c.id}`}>
                        <div
                          className="h-full w-full rounded-sm opacity-85 hover:opacity-100 transition-opacity flex items-center justify-center text-[9px] font-semibold text-white"
                          style={{ backgroundColor: MOVE_COLORS[cell.kind] }}
                          title={`${cell.c.contract_ref}${cell.c.tenant_name ? ` · ${cell.c.tenant_name}` : ""}`}
                        >
                          {cell.kind !== "leased" && t(`dash_overview.cal_${cell.kind}_short`)}
                        </div>
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
        {calendar.rows.length > rows.length && (
          <Link href="/dashboard?tab=reservations" className="block px-2 py-2 text-[11px] text-primary hover:underline">
            {t("dash_overview.cal_more", { count: calendar.rows.length - rows.length })} →
          </Link>
        )}
      </div>
      {legend}
    </div>
  );
}

function activityEmoji(action: string) {
  if (action.includes("PAYMENT")) return "💳";
  if (action.includes("DOC_ISSUE")) return "📄";
  if (action.includes("CHECK")) return "🔑";
  if (action.includes("CREAT")) return "➕";
  if (action.includes("UPDAT") || action.includes("STATUS")) return "✏️";
  if (action.includes("DELET") || action.includes("CANCEL")) return "🗑️";
  if (action.includes("SEND") || action.includes("EMAIL")) return "📧";
  return "📋";
}

function MiniStat({ icon: Icon, label, value, href }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: React.ReactNode; href: string;
}) {
  return (
    <Link href={href} className="bg-card rounded-xl border p-3 flex items-center gap-3 hover:shadow-sm hover:border-primary/40 transition-all">
      <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: BRAND_SOFT, color: BRAND }}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-lg font-bold leading-none">{value ?? "—"}</div>
        <div className="text-[11px] text-muted-foreground mt-1 truncate">{label}</div>
      </div>
    </Link>
  );
}

const ENTITY_HREF: Record<string, (id: number) => string> = {
  contract: (id) => `/booking/contracts/${id}`,
  invoice: (id) => `/finance/invoices/${id}`,
  space: (id) => `/property/spaces/${id}`,
  account: (id) => `/account/accounts/${id}`,
  work_order: (id) => `/maintenance/work-orders/${id}`,
  booking: (id) => `/booking/bookings/${id}`,
};

const QUICK_ACTION_CLS = "flex items-center gap-2 rounded-lg border p-2.5 text-xs font-semibold text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all";

export default function OverviewTab() {
  const { t, i18n } = useTranslation();
  const { currency, currencyPosition } = useBrand();
  const fmtMoney = (n: number) => formatMoney(n, currency, currencyPosition);
  const { data: properties } = useListProperties();
  const { data: contacts } = useListContacts();
  const { data: tasks } = useListTasks({});
  const { data: leads } = useListLeads({});
  const { data: bookings } = useListBookings({});
  const { data: workOrders } = useListWorkOrders({});

  const [contractCounts, setContractCounts] = useState<{ new_contracts: number; ended_contracts: number; rented_units: number; total_units: number; lease_rate_pct: number } | null>(null);
  useEffect(() => {
    apiFetch("/api/v1/dashboard/overview/contract-counts")
      .then(r => r.json())
      .then(d => setContractCounts(typeof d?.new_contracts === "number" ? d : null))
      .catch(() => {});
  }, []);

  const [board, setBoard] = useState<OverviewBoard | null>(null);
  useEffect(() => {
    apiFetch("/api/v1/dashboard/overview/board")
      .then(r => r.json())
      .then(d => setBoard(d?.calendar ? d : null))
      .catch(() => {});
  }, []);

  const today = board?.today ?? new Date().toISOString().slice(0, 10);

  const urgentWO = workOrders?.filter(w => w.priority === "Urgent" && w.status !== "Completed" && w.status !== "Cancelled").length ?? 0;
  const overdueTasks = tasks?.filter(t => t.due_date && t.due_date < today && t.task_status !== "Done").length ?? 0;
  const pendingApprovals = bookings?.filter(b => b.booking_status === "PendingApproval").length ?? 0;
  const pendingProperties = properties?.filter(p => p.approval_status === "Pending").length ?? 0;
  const al = board?.alerts;

  const alerts = [
    al && al.overdue_invoices > 0 && { tone: "red" as const, text: t("dash_overview.alert_overdue_invoices", { count: al.overdue_invoices, amount: fmtMoney(al.overdue_amount) }), href: "/finance/invoices" },
    al && al.past_end_still_live > 0 && { tone: "red" as const, text: t("dash_overview.alert_past_end_contracts", { count: al.past_end_still_live }), href: "/booking/contracts" },
    urgentWO > 0 && { tone: "red" as const, text: t("dash_overview.alert_urgent_work_orders", { count: urgentWO }), href: "/maintenance/work-orders" },
    al && al.expiring_soon > 0 && { tone: "amber" as const, text: t("dash_overview.alert_expiring_contracts", { count: al.expiring_soon, days: al.expiry_window_days }), href: "/dashboard?tab=reservations" },
    al && al.awaiting_signature > 0 && { tone: "amber" as const, text: t("dash_overview.alert_awaiting_signature", { count: al.awaiting_signature }), href: "/booking/contracts" },
    al && al.stale_drafts > 0 && { tone: "amber" as const, text: t("dash_overview.alert_stale_drafts", { count: al.stale_drafts }), href: "/booking/contracts" },
    pendingApprovals > 0 && { tone: "amber" as const, text: t("dash_overview.alert_pending_approvals", { count: pendingApprovals }), href: "/booking/bookings" },
    pendingProperties > 0 && { tone: "amber" as const, text: t("dash_overview.alert_pending_properties", { count: pendingProperties }), href: "/property/properties" },
    overdueTasks > 0 && { tone: "amber" as const, text: t("dash_overview.alert_overdue_tasks", { count: overdueTasks }), href: "/account/tasks" },
  ].filter(Boolean) as { tone: "red" | "amber"; text: string; href: string }[];

  function relTime(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.round(diff / 60000);
    if (mins < 1) return t("dash_overview.time_just_now");
    if (mins < 60) return t("dash_overview.time_minutes_ago", { count: mins });
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return t("dash_overview.time_hours_ago", { count: hrs });
    return t("dash_overview.time_days_ago", { count: Math.round(hrs / 24) });
  }

  function rentLabel(c: OverviewBoard["recent_contracts"][number]) {
    const cur = c.currency ?? currency;
    if (c.monthly_rent) return `${formatMoney(c.monthly_rent, cur, currencyPosition)}${t("dash_overview.per_month")}`;
    if (c.rate_amount) return `${formatMoney(c.rate_amount, cur, currencyPosition)} / ${t(`dash_overview.period_${c.rate_period ?? "weekly"}`, { defaultValue: c.rate_period ?? "" })}`;
    return "—";
  }

  const collected = board?.collected_this_month;
  const monthLabel = new Date(today + "T00:00:00Z").toLocaleDateString(i18n.language, { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="space-y-6">
      {/* Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          icon={BedDouble} accent="brand" label={t("dash_overview.kpi_occupancy")}
          value={contractCounts ? `${contractCounts.lease_rate_pct}%` : "—"}
          sublabel={t("dash_overview.kpi_occupancy_sub", { active: contractCounts?.rented_units ?? 0, total: contractCounts?.total_units ?? 0 })}
          progress={contractCounts?.lease_rate_pct ?? 0}
        />
        <KpiCard
          icon={LogIn} accent="green" label={t("dash_overview.kpi_new_contracts")}
          value={contractCounts?.new_contracts ?? "—"} sublabel={t("dash_overview.kpi_new_contracts_sub")}
        />
        <KpiCard
          icon={LogOut} accent="blue" label={t("dash_overview.kpi_ended_contracts")}
          value={contractCounts?.ended_contracts ?? "—"} sublabel={t("dash_overview.kpi_ended_contracts_sub")}
        />
        <KpiCard
          icon={DollarSign} accent="purple" label={t("dash_overview.kpi_collected_this_month")}
          value={collected ? fmtMoney(collected.amount) : "—"}
          sublabel={collected ? t("dash_overview.kpi_collected_sub", { month: monthLabel, count: collected.count }) : monthLabel}
        />
      </div>

      {/* Calendar + Quick actions/Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DashCard
          className="lg:col-span-2"
          title={t("dash_overview.move_calendar_title")}
          icon={CalendarDays}
          action={<Link href="/dashboard?tab=reservations" className="text-xs text-primary hover:underline">{t("dash_overview.open_lease_status")} →</Link>}
        >
          <MoveCalendar board={board} />
        </DashCard>

        <div className="space-y-4">
          <DashCard title={t("dash_overview.quick_actions")}>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/booking/contracts/new" className={QUICK_ACTION_CLS}>
                <Plus className="h-4 w-4" /> {t("dash_overview.action_new_contract")}
              </Link>
              <Link href="/finance/invoices/new" className={QUICK_ACTION_CLS}>
                <Receipt className="h-4 w-4" /> {t("dash_overview.action_invoice")}
              </Link>
              <Link href="/property/spaces" className={QUICK_ACTION_CLS}>
                <Layers className="h-4 w-4" /> {t("dash_overview.action_units")}
              </Link>
              <Link href="/maintenance/work-orders/new" className={QUICK_ACTION_CLS}>
                <Wrench className="h-4 w-4" /> {t("dash_overview.action_work_order")}
              </Link>
            </div>
          </DashCard>

          <DashCard title={t("dash_overview.alerts")} icon={AlertTriangle}>
            {alerts.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 text-center">{t("dash_overview.alerts_all_clear")}</p>
            ) : (
              <div className="space-y-2">
                {alerts.map((a, i) => (
                  <Link
                    key={i}
                    href={a.href}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${
                      a.tone === "red"
                        ? "bg-red-50 border-red-200 text-red-800 hover:bg-red-100 dark:bg-red-500/10 dark:border-red-500/20 dark:text-red-300"
                        : "bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-300"
                    }`}
                  >
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1">{a.text}</span>
                    <ArrowRight className="h-3 w-3 shrink-0 opacity-60" />
                  </Link>
                ))}
              </div>
            )}
          </DashCard>
        </div>
      </div>

      {/* Recent contracts + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DashCard
          className="lg:col-span-2"
          title={t("dash_overview.recent_contracts")}
          icon={FileText}
          bodyClass="p-0"
          action={<Link href="/booking/contracts" className="text-xs text-primary hover:underline">{t("dash_overview.view_all")} →</Link>}
        >
          <div className="overflow-auto">
            <ExportableTable fileName="overview-recent-contracts" className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  {[
                    t("dash_overview.col_contract_ref"),
                    t("dash_overview.col_tenant"),
                    t("dash_overview.col_unit"),
                    t("dash_overview.col_lease_period"),
                    t("dash_overview.col_rent"),
                    t("dash_overview.col_deposit"),
                    t("common.status"),
                  ].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {!board ? (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">{t("dash_overview.loading")}</td></tr>
                ) : board.recent_contracts.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">{t("dash_overview.no_contracts_yet")}</td></tr>
                ) : board.recent_contracts.map(c => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono font-medium whitespace-nowrap">
                      <Link href={`/booking/contracts/${c.id}`} className="hover:text-primary">{c.contract_ref}</Link>
                    </td>
                    <td className="px-3 py-2">{c.tenant_name ?? "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{c.space_name ?? "—"}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(c.start_date)} ~ {c.end_date ? formatDate(c.end_date) : ""}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{rentLabel(c)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{c.bond_amount ? formatMoney(c.bond_amount, c.currency ?? currency, currencyPosition) : "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${CONTRACT_BADGE[c.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {t(`contract.status_${c.status.toLowerCase()}`, { defaultValue: c.status })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </ExportableTable>
          </div>
        </DashCard>

        <DashCard title={t("dash_overview.activity_feed")} icon={Activity} bodyClass="p-0">
          <div className="divide-y max-h-[340px] overflow-auto">
            {!board || board.activity.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">{t("dash_overview.no_recent_activity")}</p>
            ) : board.activity.map(log => {
              const entity = t(`dash_overview.ent_${log.entity_type}`, { defaultValue: log.entity_type.replace(/_/g, " ") });
              const action = t(`dash_overview.act_${log.action.toLowerCase()}`, { defaultValue: log.action.replace(/_/g, " ").toLowerCase() });
              const status = log.new_status ? t(`contract.status_${log.new_status.toLowerCase()}`, { defaultValue: log.new_status }) : null;
              const href = ENTITY_HREF[log.entity_type]?.(log.entity_id);
              const target = log.label ?? `#${log.entity_id}`;
              return (
                <div key={log.id} className="flex items-start gap-3 px-4 py-2.5">
                  <span className="text-base mt-0.5 shrink-0">{activityEmoji(log.action)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs">
                      <span className="font-medium">{entity} {action}</span>
                      {status && <span className="text-muted-foreground"> → {status}</span>}
                    </p>
                    <p className="text-[11px] truncate">
                      {href ? <Link href={href} className="text-primary hover:underline">{target}</Link> : <span className="text-muted-foreground">{target}</span>}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{log.actor} · {relTime(log.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </DashCard>
      </div>

      {/* Portfolio mini-stats */}
      <div>
        <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">{t("dash_overview.portfolio")}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <MiniStat icon={Building2} label={t("dash_overview.stat_properties")} value={properties?.length} href="/property/properties" />
          <MiniStat icon={Layers} label={t("dash_overview.stat_total_units")} value={board?.portfolio.total_units} href="/property/spaces" />
          <MiniStat icon={TrendingUp} label={t("dash_overview.stat_rented_units")} value={board?.portfolio.rented_units} href="/dashboard?tab=floor_board" />
          <MiniStat icon={BedDouble} label={t("dash_overview.stat_vacant_units")} value={board?.portfolio.vacant_units} href="/dashboard?tab=floor_board" />
          <MiniStat icon={FileText} label={t("dash_overview.stat_live_contracts")} value={board?.portfolio.live_contracts} href="/booking/contracts" />
          <MiniStat icon={Users} label={t("dash_overview.stat_contacts")} value={contacts?.length} href="/account/contacts" />
          <MiniStat icon={CheckSquare} label={t("dash_overview.stat_open_tasks")} value={tasks?.filter(t => t.task_status !== "Done").length} href="/account/tasks" />
          <MiniStat icon={TrendingUp} label={t("dash_overview.stat_leads")} value={leads?.length} href="/account/leads" />
        </div>
      </div>
    </div>
  );
}
