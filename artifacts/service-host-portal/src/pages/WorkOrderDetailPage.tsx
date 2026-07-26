import { useEffect, useState, useCallback } from "react";
import { Link, useRoute } from "wouter";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { apiGet, apiPost } from "@/lib/api";
import {
  ArrowLeft, Wrench, CheckCircle2, Clock, AlertTriangle, Play, Loader2,
} from "lucide-react";

// Full detail view for a single dispatched work order. Reuses the list
// endpoint (which already returns every column) and picks the row by id, so it
// works against the live API without a dedicated detail endpoint. Partners can
// acknowledge → start → complete straight from here.

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
  completed_at: string | null;
  reported_at: string | null;
  scheduled_at: string | null;
  cost: string | null;
  currency: string | null;
  notes: string | null;
};

const statusStyle: Record<string, string> = {
  Open: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  InProgress: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  Completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  Cancelled: "bg-muted text-muted-foreground",
};
const slaStyle: Record<string, string> = {
  pending_ack: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  acknowledged: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  met: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  breached: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  escalated: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
};

function fmt(s: string | null): string {
  if (!s) return "—";
  try { return new Date(s).toLocaleString(); } catch { return s; }
}
function money(cost: string | null, currency: string | null): string {
  if (!cost) return "—";
  const n = Number(cost) || 0;
  const cur = currency || "KRW";
  try {
    return new Intl.NumberFormat(cur === "KRW" ? "ko-KR" : "en-AU", {
      style: "currency", currency: cur, maximumFractionDigits: cur === "KRW" ? 0 : 2,
    }).format(n);
  } catch { return `${cur} ${n.toLocaleString()}`; }
}

export default function WorkOrderDetailPage() {
  const { t } = useTranslation();
  const [, params] = useRoute("/work-orders/:id");
  const id = Number(params?.id);
  const [wo, setWo] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiGet<{ data: WorkOrder[] }>("/v1/service-host/work-orders");
      setWo((res.data ?? []).find((w) => w.id === id) ?? null);
    } catch { setWo(null); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  async function act(action: "acknowledge" | "start" | "complete") {
    if (!wo) return;
    setBusy(true);
    try { await apiPost(`/v1/service-host/work-orders/${wo.id}/${action}`); await load(); }
    finally { setBusy(false); }
  }

  const needsAck = wo && !wo.acknowledged_at && wo.status !== "Completed" && wo.status !== "Cancelled";

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-5">
        <Link href="/work-orders">
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground cursor-pointer">
            <ArrowLeft className="w-4 h-4" /> {t("workorders.detail_back", "Back to work orders")}
          </span>
        </Link>

        {loading ? (
          <div className="space-y-3">
            <div className="h-24 rounded-xl bg-muted animate-pulse" />
            <div className="h-48 rounded-xl bg-muted animate-pulse" />
          </div>
        ) : !wo ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <AlertTriangle className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">{t("workorders.detail_not_found", "Work order not found")}</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Wrench className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-lg font-bold text-foreground">{wo.title}</h1>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5">{wo.order_ref}</p>
                  </div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${statusStyle[wo.status] ?? "bg-muted text-muted-foreground"}`}>
                  {t(`workorders.status_${wo.status}`, wo.status)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                {wo.category && (
                  <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    {t(`workorders.cat_${wo.category}`, wo.category)}
                  </span>
                )}
                <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                  {t("workorders.priority", "Priority")}: {t(`workorders.priority_${wo.priority}`, wo.priority)}
                </span>
                {wo.sla_status && (
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${slaStyle[wo.sla_status] ?? "bg-muted text-muted-foreground"}`}>
                    SLA: {t(`workorders.sla_${wo.sla_status}`, wo.sla_status)}
                  </span>
                )}
              </div>
            </div>

            {/* Description */}
            {wo.description && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h2 className="text-sm font-semibold text-foreground mb-2">{t("workorders.description", "Description")}</h2>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{wo.description}</p>
              </div>
            )}

            {/* Details grid */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3">{t("workorders.details", "Details")}</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <Row label={t("workorders.dispatched", "Dispatched")} value={fmt(wo.dispatched_at)} />
                <Row label={t("workorders.ack_due", "Ack by")} value={fmt(wo.sla_ack_due_at)} />
                <Row label={t("workorders.acknowledged_at", "Acknowledged at")} value={fmt(wo.acknowledged_at)} />
                <Row label={t("workorders.scheduled_at", "Scheduled")} value={wo.scheduled_at ?? "—"} />
                <Row label={t("workorders.reported_at", "Reported")} value={wo.reported_at ? fmt(wo.reported_at) : "—"} />
                <Row label={t("workorders.completed_at", "Completed at")} value={fmt(wo.completed_at)} />
                <Row label={t("workorders.cost", "Cost")} value={money(wo.cost, wo.currency)} />
              </dl>
              {wo.notes && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-1">{t("workorders.notes", "Notes")}</p>
                  <p className="text-sm text-foreground whitespace-pre-line">{wo.notes}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="bg-card border border-border rounded-xl p-5 flex flex-wrap items-center gap-2">
              {needsAck && (
                <button disabled={busy} onClick={() => act("acknowledge")} className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground disabled:opacity-60 flex items-center gap-1.5">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {t("workorders.btn_acknowledge", "Acknowledge")}
                </button>
              )}
              {wo.acknowledged_at && wo.status === "Open" && (
                <button disabled={busy} onClick={() => act("start")} className="px-4 py-2 rounded-lg text-sm font-medium border border-border disabled:opacity-60 flex items-center gap-1.5">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} {t("workorders.btn_start", "Start job")}
                </button>
              )}
              {wo.status === "InProgress" && (
                <button disabled={busy} onClick={() => act("complete")} className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white disabled:opacity-60 flex items-center gap-1.5">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {t("workorders.btn_complete", "Mark complete")}
                </button>
              )}
              {wo.acknowledged_at && (
                <span className="flex items-center gap-1 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" /> {t("workorders.acknowledged", "Acknowledged")}</span>
              )}
              {wo.sla_status === "breached" && !wo.acknowledged_at && (
                <span className="text-sm text-destructive flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> {t("workorders.overdue", "Overdue — please acknowledge")}</span>
              )}
              {wo.status === "Completed" && (
                <span className="flex items-center gap-1.5 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" /> {t("workorders.status_Completed", "Completed")}</span>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
      <dt className="text-muted-foreground">{label}:</dt>
      <dd className="text-foreground font-medium ml-auto text-right">{value}</dd>
    </div>
  );
}
