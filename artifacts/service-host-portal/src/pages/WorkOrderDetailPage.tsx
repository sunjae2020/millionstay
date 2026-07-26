import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useRoute } from "wouter";
import { useTranslation } from "react-i18next";
import { Layout } from "@/components/Layout";
import { apiGet, apiPost, apiFetch, ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/dateFormat";
import {
  ArrowLeft, Wrench, CheckCircle2, Clock, AlertTriangle, Play, Loader2,
  Camera, Trash2, UploadCloud, Save, X,
} from "lucide-react";

type Photo = { id: number; url: string; kind: string; caption: string | null; uploaded_by_type: string };
const MAX_PHOTOS = 20;

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
  const [error, setError] = useState("");
  // Work notes
  const [notes, setNotes] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  // Service-result photos
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [delPhoto, setDelPhoto] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiGet<{ data: WorkOrder[] }>("/v1/service-host/work-orders");
      const found = (res.data ?? []).find((w) => w.id === id) ?? null;
      setWo(found);
      if (found && !notesDirty) setNotes(found.notes ?? "");
    } catch { setWo(null); }
    finally { setLoading(false); }
  }, [id, notesDirty]);

  const loadPhotos = useCallback(async () => {
    try {
      const res = await apiGet<{ data: Photo[] }>(`/v1/service-host/work-orders/${id}/photos`);
      setPhotos(res.data ?? []);
    } catch { /* keep existing */ }
  }, [id]);

  useEffect(() => { void load(); void loadPhotos(); }, [load, loadPhotos]);

  async function act(action: "acknowledge" | "start" | "complete") {
    if (!wo) return;
    setBusy(true);
    try { await apiPost(`/v1/service-host/work-orders/${wo.id}/${action}`); await load(); }
    finally { setBusy(false); }
  }

  async function saveNotes() {
    if (!wo) return;
    setSavingNotes(true);
    setError("");
    try {
      await apiFetch(`/v1/service-host/work-orders/${wo.id}/notes`, {
        method: "PATCH", body: JSON.stringify({ notes }),
      }).then((r) => { if (!r.ok) throw new ApiError(r.status, "SAVE", t("workorders.notes_save_failed", "Failed to save notes")); });
      setNotesDirty(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("workorders.notes_save_failed", "Failed to save notes"));
    } finally { setSavingNotes(false); }
  }

  async function onFile(file: File) {
    if (!wo) return;
    setError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      fd.append("kind", "after");
      const res = await apiFetch(`/v1/service-host/work-orders/${wo.id}/photos`, { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new ApiError(res.status, "UPLOAD", (body as any)?.error?.message ?? t("workorders.photo_upload_failed", "Upload failed"));
      }
      await loadPhotos();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("workorders.photo_upload_failed", "Upload failed"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removePhoto(photoId: number) {
    if (!wo || !window.confirm(t("workorders.photo_delete_confirm", "Delete this photo?"))) return;
    setDelPhoto(photoId);
    try {
      const res = await apiFetch(`/v1/service-host/work-orders/${wo.id}/photos/${photoId}`, { method: "DELETE" });
      if (!res.ok) throw new ApiError(res.status, "DELETE", t("workorders.photo_delete_failed", "Failed to delete"));
      setPhotos((p) => p.filter((x) => x.id !== photoId));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("workorders.photo_delete_failed", "Failed to delete"));
    } finally { setDelPhoto(null); }
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

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <span className="flex-1">{error}</span>
            <button onClick={() => setError("")} aria-label={t("common.dismiss", "Dismiss")}><X className="w-4 h-4" /></button>
          </div>
        )}

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
                <Row label={t("workorders.dispatched", "Dispatched")} value={formatDateTime(wo.dispatched_at)} />
                <Row label={t("workorders.ack_due", "Ack by")} value={formatDateTime(wo.sla_ack_due_at)} />
                <Row label={t("workorders.acknowledged_at", "Acknowledged at")} value={formatDateTime(wo.acknowledged_at)} />
                <Row label={t("workorders.scheduled_at", "Scheduled")} value={wo.scheduled_at ?? "—"} />
                <Row label={t("workorders.reported_at", "Reported")} value={formatDateTime(wo.reported_at)} />
                <Row label={t("workorders.completed_at", "Completed at")} value={formatDateTime(wo.completed_at)} />
                <Row label={t("workorders.cost", "Cost")} value={money(wo.cost, wo.currency)} />
              </dl>
            </div>

            {/* Service-result photos */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Camera className="w-4 h-4 text-primary" /> {t("workorders.photos_title", "Service result photos")}
                  <span className="text-xs font-normal text-muted-foreground">{photos.length}/{MAX_PHOTOS}</span>
                </h2>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading || photos.length >= MAX_PHOTOS}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
                >
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                  {uploading ? t("workorders.photo_uploading", "Uploading…") : t("workorders.photo_add", "Add photo")}
                </button>
              </div>
              {photos.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">{t("workorders.photos_empty", "No photos yet. Upload photos of the completed work.")}</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {photos.map((p) => (
                    <div key={p.id} className="relative group aspect-square rounded-lg overflow-hidden border border-border">
                      <a href={p.url} target="_blank" rel="noopener">
                        <img src={p.url} alt={p.caption ?? t("workorders.photo_alt", "Service photo")} className="w-full h-full object-cover" />
                      </a>
                      <button
                        onClick={() => void removePhoto(p.id)}
                        disabled={delPhoto === p.id}
                        className="absolute top-1 right-1 p-1 rounded-md bg-black/55 text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity disabled:opacity-100"
                        aria-label={t("workorders.photo_delete", "Delete photo")}
                      >
                        {delPhoto === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Work notes */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-2">{t("workorders.notes", "Work notes")}</h2>
              <textarea
                value={notes}
                onChange={(e) => { setNotes(e.target.value); setNotesDirty(true); }}
                rows={4}
                placeholder={t("workorders.notes_placeholder", "Describe the work you carried out…")}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-y focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <div className="flex justify-end mt-2">
                <button
                  onClick={() => void saveNotes()}
                  disabled={savingNotes || !notesDirty}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
                >
                  {savingNotes ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {savingNotes ? t("common.saving", "Saving…") : t("common.save", "Save")}
                </button>
              </div>
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
