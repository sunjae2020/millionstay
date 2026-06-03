import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { apiFetch } from "@/lib/apiFetch";
import { useListWorkOrders, useListSpaces, useListProperties } from "@workspace/api-client-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import {
  Wrench, AlertTriangle, CheckCircle, Clock, Plus, RefreshCw,
  Activity, Home, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { KpiCard, DashCard, Pill } from "@/components/dashboard/DashboardKit";

interface OpsKpis {
  open_count: number;
  in_progress_count: number;
  urgent_count: number;
  completed_this_month: number;
}

interface ActivityLog {
  id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  actor_type: string;
  actor_email: string | null;
  notes: string | null;
  created_at: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  Urgent: "#ef4444",
  High:   "#f59e0b",
  Normal: "#3b82f6",
  Low:    "#94a3b8",
};

const PRIORITY_DOT: Record<string, string> = {
  Urgent: "bg-red-500",
  High:   "bg-amber-500",
  Normal: "bg-blue-500",
  Low:    "bg-gray-400",
};

const STATUS_BADGE: Record<string, string> = {
  Open:        "bg-blue-100 text-blue-700",
  InProgress:  "bg-yellow-100 text-yellow-800",
  Completed:   "bg-green-100 text-green-700",
  Deferred:    "bg-purple-100 text-purple-700",
  Cancelled:   "bg-gray-100 text-gray-500",
};

const HOUSEKEEPING_STATUS: Record<string, { bg: string; text: string; bar: string; labelKey: string; pct: number }> = {
  Active:               { bg: "bg-green-50",  text: "text-green-700",  bar: "bg-green-500",  labelKey: "hk_ready",            pct: 100 },
  Occupied:             { bg: "bg-blue-50",   text: "text-blue-700",   bar: "bg-blue-500",   labelKey: "hk_guest_in",         pct: 100 },
  NeedsCleaning:        { bg: "bg-amber-50",  text: "text-amber-700",  bar: "bg-amber-400",  labelKey: "hk_needs_cleaning",   pct: 0   },
  CleaningInProgress:   { bg: "bg-yellow-50", text: "text-yellow-700", bar: "bg-yellow-400", labelKey: "hk_cleaning_now",     pct: 50  },
  Inspection:           { bg: "bg-purple-50", text: "text-purple-700", bar: "bg-purple-500", labelKey: "hk_awaiting_inspect", pct: 85  },
  MaintenanceBlock:     { bg: "bg-red-50",    text: "text-red-700",    bar: "bg-red-500",    labelKey: "hk_out_of_order",     pct: 100 },
};

export default function OperationsTab() {
  const [kpis, setKpis] = useState<OpsKpis | null>(null);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [propFilter, setPropFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const { toast } = useToast();
  const { t } = useTranslation();

  const { data: workOrders, refetch: refetchWO } = useListWorkOrders({});
  const { data: spaces } = useListSpaces();
  const { data: properties } = useListProperties();

  const loadKpis = useCallback(() => {
    apiFetch("/api/v1/operations/summary/kpis").then(r => r.json()).then(setKpis).catch(() => {});
    apiFetch("/api/v1/operations/activity-log?limit=20").then(r => r.json()).then(d => setActivityLog(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  useEffect(() => { loadKpis(); }, [loadKpis]);

  const filteredWO = (workOrders ?? []).filter(wo => {
    const matchProp = propFilter === "all" || String(wo.property_id) === propFilter;
    const matchStatus = statusFilter === "all" || wo.status === statusFilter;
    return matchProp && matchStatus;
  });

  const priorityCounts = (workOrders ?? []).reduce((acc, wo) => {
    const p = wo.priority ?? "Normal";
    acc[p] = (acc[p] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const donutData = Object.entries(priorityCounts).map(([name, value]) => ({ name, value }));

  async function handleWOAction(id: number, action: "start" | "complete" | "cancel") {
    try {
      const r = await apiFetch(`/api/v1/work-orders/${id}/${action}`, { method: "POST" });
      if (!r.ok) {
        const e = await r.json();
        toast({ title: t("dash_operations.toast_error"), description: e.error ?? t("dash_operations.toast_failed"), variant: "destructive" });
      } else {
        toast({ title: t("dash_operations.toast_updated"), description: t("dash_operations.toast_wo_updated") });
        refetchWO();
        loadKpis();
      }
    } catch {
      toast({ title: t("dash_operations.toast_error"), description: t("dash_operations.toast_network_error"), variant: "destructive" });
    }
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function activityIcon(action: string) {
    if (action.includes("CHECK")) return "🔑";
    if (action.includes("CREAT")) return "➕";
    if (action.includes("UPDAT") || action.includes("STATUS")) return "✏️";
    if (action.includes("DELET") || action.includes("CANCEL")) return "🗑️";
    return "📋";
  }

  const propOptions = properties ?? [];
  const activeSpaces = (spaces ?? []).filter(s => s.status === "Active");
  const filteredSpaces = propFilter === "all"
    ? activeSpaces
    : activeSpaces.filter(s => String(s.property_id) === propFilter);

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { refetchWO(); loadKpis(); }}>
          <RefreshCw className="h-3.5 w-3.5" /> {t("common.refresh")}
        </Button>
        <Link href="/maintenance/work-orders/new">
          <Button size="sm" className="gap-1.5 bg-[#E8621A] hover:bg-[#d4541a] text-white">
            <Plus className="h-4 w-4" /> {t("dash_operations.new_work_order")}
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label={t("dash_operations.open_workorders")} value={kpis?.open_count ?? "—"} icon={Wrench} accent="blue" sublabel={t("dash_operations.kpi_open_sub")} />
        <KpiCard label={t("dash_operations.in_progress_workorders")} value={kpis?.in_progress_count ?? "—"} icon={Clock} accent="amber" sublabel={t("dash_operations.kpi_in_progress_sub")} />
        <KpiCard label={t("dash_operations.urgent_issues")} value={kpis?.urgent_count ?? "—"} icon={AlertTriangle} accent={kpis?.urgent_count ? "red" : "slate"} sublabel={t("dash_operations.kpi_urgent_sub")} trend={kpis?.urgent_count ? t("dash_operations.trend_now") : undefined} trendType="down" />
        <KpiCard label={t("dash_operations.completed_this_month")} value={kpis?.completed_this_month ?? "—"} icon={CheckCircle} accent="green" sublabel={t("dash_operations.kpi_completed_sub")} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DashCard
          className="lg:col-span-2"
          title={t("dash_operations.work_orders")}
          icon={Wrench}
          bodyClass="p-0"
          action={
            <div className="flex gap-2">
              <Select value={propFilter} onValueChange={setPropFilter}>
                <SelectTrigger className="h-7 w-[130px] text-xs"><SelectValue placeholder={t("dash_operations.all_properties")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">{t("dash_operations.all_properties")}</SelectItem>
                  {propOptions.map(p => <SelectItem key={p.id} value={String(p.id)} className="text-xs">{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-7 w-[110px] text-xs"><SelectValue placeholder={t("dash_operations.all_statuses")} /></SelectTrigger>
                <SelectContent>
                  {["all", "Open", "InProgress", "Completed", "Deferred", "Cancelled"].map(s => (
                    <SelectItem key={s} value={s} className="text-xs">{s === "all" ? t("dash_operations.all_statuses") : t(`dash_operations.status_${s.toLowerCase()}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
        >
          <div className="divide-y max-h-80 overflow-auto">
            {filteredWO.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">{t("dash_operations.no_workorders")}</div>
            ) : filteredWO.map(wo => (
              <div key={wo.id} className="px-4 py-3 flex items-start gap-3 hover:bg-muted/30">
                <div className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${PRIORITY_DOT[wo.priority ?? "Normal"] ?? "bg-gray-400"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{wo.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {wo.order_ref} · {wo.priority ?? "Normal"} · {wo.category ?? "General"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Pill className={STATUS_BADGE[wo.status] ?? "bg-gray-100 text-gray-600"}>{t(`dash_operations.status_${wo.status.toLowerCase()}`)}</Pill>
                  <div className="flex gap-1">
                    {wo.status === "Open" && (
                      <button onClick={() => handleWOAction(wo.id, "start")} className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200">{t("dash_operations.action_start")}</button>
                    )}
                    {wo.status === "InProgress" && (
                      <button onClick={() => handleWOAction(wo.id, "complete")} className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200">{t("dash_operations.action_complete")}</button>
                    )}
                    {["Open", "InProgress"].includes(wo.status) && (
                      <button onClick={() => handleWOAction(wo.id, "cancel")} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200">{t("common.cancel")}</button>
                    )}
                    <Link href={`/maintenance/work-orders/${wo.id}`} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200">{t("common.view")}</Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-2 border-t">
            <Link href="/maintenance/work-orders" className="text-xs text-[#E8621A] hover:underline">{t("dash_operations.view_all_work_orders")} →</Link>
          </div>
        </DashCard>

        <DashCard title={t("dash_operations.priority_distribution")}>
          {donutData.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">{t("dash_operations.no_workorders")}</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} paddingAngle={2}>
                  {donutData.map((entry, i) => (
                    <Cell key={i} fill={PRIORITY_COLORS[entry.name] ?? "#94a3b8"} />
                  ))}
                </Pie>
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="mt-2 space-y-1.5">
            {Object.entries(priorityCounts).map(([p, cnt]) => (
              <div key={p} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PRIORITY_COLORS[p] ?? "#94a3b8" }} />
                  <span>{t(`dash_operations.priority_${p.toLowerCase()}`)}</span>
                </div>
                <span className="font-medium">{cnt}</span>
              </div>
            ))}
          </div>
        </DashCard>
      </div>

      <DashCard
        title={t("dash_operations.housekeeping_room_status")}
        icon={Home}
        bodyClass="p-0"
        action={
          <Select value={propFilter} onValueChange={setPropFilter}>
            <SelectTrigger className="h-7 w-[150px] text-xs"><SelectValue placeholder={t("dash_operations.all_properties")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">{t("dash_operations.all_properties")}</SelectItem>
              {propOptions.map(p => <SelectItem key={p.id} value={String(p.id)} className="text-xs">{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      >
        {filteredSpaces.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">{t("dash_operations.no_active_spaces")}</div>
        ) : (
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {filteredSpaces.map(space => {
              const hkStatus = HOUSEKEEPING_STATUS[space.status] ?? HOUSEKEEPING_STATUS.Active!;
              const propName = properties?.find(p => p.id === space.property_id)?.name;
              return (
                <div key={space.id} className={`rounded-lg border p-3 ${hkStatus.bg}`}>
                  <p className={`text-xs font-semibold truncate ${hkStatus.text}`}>{space.name}</p>
                  {propName && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{propName}</p>}
                  <div className="mt-2 h-1.5 rounded-full bg-white/50 overflow-hidden">
                    <div className={`h-full rounded-full ${hkStatus.bar}`} style={{ width: `${hkStatus.pct}%` }} />
                  </div>
                  <p className={`text-[10px] mt-1.5 font-medium ${hkStatus.text}`}>{t(`dash_operations.${hkStatus.labelKey}`)}</p>
                </div>
              );
            })}
          </div>
        )}
      </DashCard>

      <DashCard
        title={t("dash_operations.system_activity_log")}
        icon={Activity}
        bodyClass="p-0"
        action={
          <button onClick={loadKpis} className="text-xs text-[#E8621A] hover:underline flex items-center gap-1">
            <RefreshCw className="h-3 w-3" /> {t("common.refresh")}
          </button>
        }
      >
        <div className="divide-y max-h-80 overflow-auto">
          {activityLog.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">{t("dash_operations.no_activity_logged")}</div>
          ) : activityLog.map(log => (
            <div key={log.id} className="px-4 py-2.5 flex items-start gap-3">
              <span className="text-base mt-0.5 shrink-0">{activityIcon(log.action)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium">{log.actor_email ?? log.actor_type}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{log.action}</span>
                  <span className="text-[10px] bg-muted rounded px-1 py-0.5">{log.entity_type} #{log.entity_id}</span>
                </div>
                {log.notes && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{log.notes}</p>}
              </div>
              <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">{formatTime(log.created_at)}</span>
            </div>
          ))}
        </div>
      </DashCard>
    </div>
  );
}
