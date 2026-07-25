import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { apiGet, apiPost } from "@/lib/api";
import { Wrench, CheckCircle2, Clock, AlertTriangle, Play } from "lucide-react";

// Partner-facing dispatched maintenance work orders (Phase 3). Consumes the
// service-host work-order endpoints. Partners acknowledge (stopping the SLA
// clock), then start and complete their assigned jobs. They never see other
// partners' jobs or the tenant's contact details.

type WorkOrder = {
  id: number;
  order_ref: string;
  title: string;
  description: string | null;
  category: string | null;
  priority: string;
  status: string;
  dispatched_at: string | null;
  acknowledged_at: string | null;
  sla_ack_due_at: string | null;
  sla_status: string | null;
};

const statusStyle: Record<string, string> = {
  Open: "bg-blue-100 text-blue-700",
  InProgress: "bg-yellow-100 text-yellow-700",
  Completed: "bg-green-100 text-green-700",
  Cancelled: "bg-gray-100 text-gray-600",
};
const slaStyle: Record<string, string> = {
  pending_ack: "bg-blue-100 text-blue-700",
  acknowledged: "bg-amber-100 text-amber-700",
  met: "bg-green-100 text-green-700",
  breached: "bg-red-100 text-red-700",
  escalated: "bg-red-100 text-red-700",
};

function fmt(s: string | null): string {
  if (!s) return "—";
  try { return new Date(s).toLocaleString(); } catch { return s; }
}

export default function WorkOrdersPage() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<WorkOrder[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiGet<{ data: WorkOrder[] }>("/api/v1/service-host/work-orders");
      setRows(res.data ?? []);
    } catch { setRows([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function act(id: number, action: "acknowledge" | "start" | "complete") {
    setBusy(id);
    try { await apiPost(`/api/v1/service-host/work-orders/${id}/${action}`); await load(); }
    finally { setBusy(null); }
  }

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <h1 className="text-xl font-bold flex items-center gap-2 mb-4">
          <Wrench className="h-5 w-5 text-primary" /> {t("workorders.title", "Work Orders")}
        </h1>

        {rows === null ? (
          <p className="text-muted-foreground">{t("common.loading", "Loading…")}</p>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border bg-white p-8 text-center text-muted-foreground">
            {t("workorders.empty", "No work orders assigned to you yet.")}
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((w) => {
              const needsAck = !w.acknowledged_at && w.status !== "Completed" && w.status !== "Cancelled";
              return (
                <div key={w.id} className="rounded-xl border bg-white overflow-hidden">
                  <div className="px-4 py-3 border-b bg-gray-50 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{w.title}</span>
                      <span className="text-xs font-mono text-muted-foreground">{w.order_ref}</span>
                      {w.category && <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{w.category}</span>}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusStyle[w.status] ?? "bg-gray-100 text-gray-600"}`}>{w.status}</span>
                  </div>
                  <div className="p-4 space-y-3">
                    {w.description && <p className="text-sm text-gray-600">{w.description}</p>}
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {t("workorders.ack_due", "Ack by")}: {fmt(w.sla_ack_due_at)}</span>
                      {w.sla_status && <span>SLA: <span className={`px-1.5 py-0.5 rounded ${slaStyle[w.sla_status] ?? ""}`}>{w.sla_status}</span></span>}
                      {w.acknowledged_at && <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="h-3 w-3" /> {t("workorders.acknowledged", "Acknowledged")}</span>}
                    </div>
                    <div className="flex gap-2 pt-1">
                      {needsAck && (
                        <button disabled={busy === w.id} onClick={() => act(w.id, "acknowledge")} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-primary text-white disabled:opacity-60 flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5" /> {t("workorders.btn_acknowledge", "Acknowledge")}
                        </button>
                      )}
                      {w.acknowledged_at && w.status === "Open" && (
                        <button disabled={busy === w.id} onClick={() => act(w.id, "start")} className="px-3 py-1.5 rounded-lg text-sm font-medium border disabled:opacity-60 flex items-center gap-1.5">
                          <Play className="h-3.5 w-3.5" /> {t("workorders.btn_start", "Start job")}
                        </button>
                      )}
                      {w.status === "InProgress" && (
                        <button disabled={busy === w.id} onClick={() => act(w.id, "complete")} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white disabled:opacity-60 flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5" /> {t("workorders.btn_complete", "Mark complete")}
                        </button>
                      )}
                      {w.sla_status === "breached" && !w.acknowledged_at && (
                        <span className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> {t("workorders.overdue", "Overdue — please acknowledge")}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
