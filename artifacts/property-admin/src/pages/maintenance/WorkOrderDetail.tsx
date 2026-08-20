import { useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { formatDate } from "@/lib/date";
import { useBrand } from "@/contexts/ThemeContext";
import { formatMoney } from "@/lib/currency";
import { useForm, Controller } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  useGetWorkOrder,
  useCreateWorkOrder,
  useUpdateWorkOrder,
  useDeleteWorkOrder,
  useStartWorkOrder,
  useReviewWorkOrder,
  useCompleteWorkOrder,
  useCancelWorkOrder,
  getGetWorkOrderQueryKey,
  getListWorkOrdersQueryKey,
} from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { LookupSelect } from "@/components/LookupSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COMMON_WORK_ORDER_CATEGORIES, OTHER_WORK_ORDER_CATEGORIES, canonicalWorkOrderCategory } from "@/lib/workOrderCategories";
import { ArrowLeft, Trash2, Save, Send, ShieldAlert, CheckCircle2, Clock, CalendarClock, Mail, FileText } from "lucide-react";
import { DocumentPreviewDialog, useDocumentPreview } from "@/components/DocumentPreviewDialog";
import { useState } from "react";
import { apiJson } from "@/lib/apiFetch";
import { WorkOrderPhotos, uploadStagedPhotos, type StagedPhoto } from "@/components/WorkOrderPhotos";

/** ISO instant → the "YYYY-MM-DDTHH:mm" a datetime-local input expects (local tz). */
function toLocalInput(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local value → ISO instant for the API (empty → null). */
function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const statusColors: Record<string, string> = {
  Open: "bg-blue-100 text-blue-700",
  InProgress: "bg-yellow-100 text-yellow-700",
  PendingReview: "bg-purple-100 text-purple-700",
  Completed: "bg-green-100 text-green-700",
  Cancelled: "bg-gray-100 text-gray-600",
};

interface FormData {
  property_id: number | null;
  space_id: number | null;
  title: string;
  description: string;
  priority: string;
  category: string;
  assigned_contact_id: number | null;
  reported_at: string;
  scheduled_at: string;
  cost: string;
  notes: string;
  // 방문 약속 — 인스펙션/현장 방문의 시간·담당·출입
  inspection_type: string;
  scheduled_start_at: string; // datetime-local ("YYYY-MM-DDTHH:mm")
  scheduled_end_at: string;
  assigned_user_id: number | null;
  attendee_contact_id: number | null;
  location_note: string;
  access_method: string;
}

export default function WorkOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { t, i18n } = useTranslation();
  const { currency, currencyPosition } = useBrand();
  const { previewConfig, openPreview, closePreview } = useDocumentPreview();
  const isNew = !id || id === "new";

  const { data: wo, refetch } = useGetWorkOrder(Number(id), {
    query: { enabled: !isNew, queryKey: getGetWorkOrderQueryKey(Number(id)) },
  });

  // Opened from a space's 하자보수 tab as /maintenance/work-orders/new?space_id=N —
  // prefill the space (and its property) so the unit is never mis-keyed.
  const prefillSpaceId = isNew ? Number(new URLSearchParams(window.location.search).get("space_id")) || null : null;
  const { data: prefillSpace } = useQuery<any>({
    queryKey: ["wo-prefill-space", prefillSpaceId],
    queryFn: () => apiJson(`/api/v1/spaces/${prefillSpaceId}`),
    enabled: !!prefillSpaceId,
  });

  const { register, handleSubmit, reset, control, setValue } = useForm<FormData>({
    defaultValues: {
      property_id: null, space_id: null, title: "", description: "",
      priority: "Normal", category: "", assigned_contact_id: null,
      reported_at: "", scheduled_at: "", cost: "", notes: "",
      inspection_type: "", scheduled_start_at: "", scheduled_end_at: "",
      assigned_user_id: null, attendee_contact_id: null, location_note: "", access_method: "",
    },
  });

  useEffect(() => {
    if (!prefillSpace) return;
    setValue("space_id", prefillSpace.id ?? prefillSpaceId);
    if (prefillSpace.property_id) setValue("property_id", prefillSpace.property_id);
  }, [prefillSpace, prefillSpaceId, setValue]);

  useEffect(() => {
    if (wo) {
      reset({
        property_id: wo.property_id ?? null,
        space_id: wo.space_id ?? null,
        title: wo.title ?? "",
        description: wo.description ?? "",
        priority: wo.priority ?? "Normal",
        category: canonicalWorkOrderCategory(wo.category) ?? "",
        assigned_contact_id: wo.assigned_contact_id ?? null,
        reported_at: wo.reported_at ?? "",
        scheduled_at: wo.scheduled_at ?? "",
        cost: wo.cost != null ? String(wo.cost) : "",
        notes: wo.notes ?? "",
        inspection_type: (wo as any).inspection_type ?? "",
        scheduled_start_at: toLocalInput((wo as any).scheduled_start_at),
        scheduled_end_at: toLocalInput((wo as any).scheduled_end_at),
        assigned_user_id: (wo as any).assigned_user_id ?? null,
        attendee_contact_id: (wo as any).attendee_contact_id ?? null,
        location_note: (wo as any).location_note ?? "",
        access_method: (wo as any).access_method ?? "",
      });
    }
  }, [wo, reset]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListWorkOrdersQueryKey() });
    if (!isNew) qc.invalidateQueries({ queryKey: getGetWorkOrderQueryKey(Number(id)) });
  };

  // 신규 등록 화면에서 고른 사진은 작업지시가 생기기 전이라 로컬에 담아뒀다가 저장 직후 올린다.
  const [stagedPhotos, setStagedPhotos] = useState<StagedPhoto[]>([]);

  const createMutation = useCreateWorkOrder({
    mutation: {
      onSuccess: async (d) => {
        if (stagedPhotos.length > 0) {
          try { await uploadStagedPhotos(Number(d.id), stagedPhotos); } catch { /* 사진 실패로 작업지시 생성을 되돌리지는 않는다 */ }
          stagedPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
          setStagedPhotos([]);
        }
        invalidate();
        navigate(`/maintenance/work-orders/${d.id}`);
      },
    },
  });
  const updateMutation = useUpdateWorkOrder({ mutation: { onSuccess: () => { invalidate(); refetch(); } } });
  const startMutation = useStartWorkOrder({ mutation: { onSuccess: () => { invalidate(); refetch(); } } });
  const reviewMutation = useReviewWorkOrder({ mutation: { onSuccess: () => { invalidate(); refetch(); } } });
  const completeMutation = useCompleteWorkOrder({ mutation: { onSuccess: () => { invalidate(); refetch(); } } });
  const cancelMutation = useCancelWorkOrder({ mutation: { onSuccess: () => { invalidate(); refetch(); } } });
  const deleteMutation = useDeleteWorkOrder({ mutation: { onSuccess: () => { invalidate(); navigate("/maintenance/work-orders"); } } });

  const buildPayload = (data: FormData) => ({
    property_id: data.property_id ?? null,
    space_id: data.space_id ?? null,
    title: data.title,
    description: data.description || null,
    priority: data.priority || "Normal",
    category: data.category || null,
    assigned_contact_id: data.assigned_contact_id ?? null,
    reported_at: data.reported_at || null,
    scheduled_at: data.scheduled_at || null,
    cost: data.cost ? Number(data.cost) : null,
    notes: data.notes || null,
    inspection_type: data.inspection_type || null,
    scheduled_start_at: fromLocalInput(data.scheduled_start_at),
    scheduled_end_at: fromLocalInput(data.scheduled_end_at),
    assigned_user_id: data.assigned_user_id ?? null,
    attendee_contact_id: data.attendee_contact_id ?? null,
    location_note: data.location_note || null,
    access_method: data.access_method || null,
  });

  const onSubmit = (data: FormData) => {
    if (isNew) createMutation.mutate({ data: buildPayload(data) });
    else updateMutation.mutate({ id: Number(id), data: buildPayload(data) });
  };

  const [dispatching, setDispatching] = useState(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const dispatch = async (force = false) => {
    setDispatching(true); setDispatchError(null);
    try {
      await apiJson(`/api/v1/work-orders/${id}/dispatch`, { method: "POST", body: JSON.stringify({ force }) });
      invalidate(); refetch();
    } catch (e: any) {
      setDispatchError(e?.message ?? t('workorder.dispatch_failed', 'Dispatch failed — no matching partner'));
    } finally {
      setDispatching(false);
    }
  };

  const [sendingConfirm, setSendingConfirm] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const sendConfirmation = async () => {
    setSendingConfirm(true); setConfirmMsg(null);
    try {
      const r = await apiJson<{ data?: { to?: string } }>(`/api/v1/work-orders/${id}/send-confirmation`, {
        method: "POST", body: JSON.stringify({}),
      });
      setConfirmMsg({ ok: true, text: t('workorder.confirmation_ok', 'Confirmation sent to {{to}}', { to: r?.data?.to ?? "" }) });
      invalidate(); refetch();
    } catch (e: any) {
      setConfirmMsg({ ok: false, text: e?.message ?? t('workorder.confirmation_failed', 'Could not send the confirmation email.') });
    } finally {
      setSendingConfirm(false);
    }
  };

  const status = wo?.status ?? "Open";

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      Open: t('workorder.status_open'),
      InProgress: t('workorder.status_in_progress'),
      PendingReview: t('workorder.status_pending_review'),
      Completed: t('workorder.status_completed'),
      Cancelled: t('workorder.status_cancelled'),
    };
    return map[s] ?? s;
  };

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              {isNew ? t('workorder.new') : wo?.order_ref ?? t('nav.work_order')}
            </h1>
            {!isNew && wo && <p className="text-sm text-muted-foreground">{wo.title}</p>}
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => navigate("/maintenance/work-orders")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> {t('common.back')}
            </Button>
            {!isNew && (
              <Button
                variant="outline"
                onClick={() =>
                  openPreview({
                    title: wo?.order_ref ?? t('workorder.btn_document', 'Work order PDF'),
                    filename: `${wo?.order_ref ?? "work-order"}.pdf`,
                    source: { kind: "api", path: `/api/v1/work-orders/${id}/document.pdf?lang=${encodeURIComponent(i18n.language)}` },
                  })
                }
              >
                <FileText className="h-4 w-4 mr-1" /> {t('workorder.btn_document', 'Work order PDF')}
              </Button>
            )}
            {!isNew && (
              <Button variant="destructive" onClick={() => deleteMutation.mutate({ id: Number(id) })}>
                <Trash2 className="h-4 w-4 mr-1" /> {t('common.delete')}
              </Button>
            )}
            <Button onClick={handleSubmit(onSubmit)}>
              <Save className="h-4 w-4 mr-1" /> {t('common.save')}
            </Button>
          </div>
        </div>

        {/* FSM Actions */}
        {!isNew && (
          <div className="border rounded-lg bg-white p-4 mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">{t('workorder.label_status')}:</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[status] ?? "bg-gray-100 text-gray-600"}`}>
                {statusLabel(status)}
              </span>
            </div>
            <div className="flex gap-2 ml-auto">
              {status === "Open" && (
                <Button variant="default" onClick={() => startMutation.mutate({ id: Number(id) })}>
                  {t('workorder.btn_start')}
                </Button>
              )}
              {status === "InProgress" && (
                <Button variant="default" className="bg-purple-600 hover:bg-purple-700" onClick={() => reviewMutation.mutate({ id: Number(id) })}>
                  {t('workorder.btn_review', 'Submit for Review')}
                </Button>
              )}
              {status === "PendingReview" && (
                <Button variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => completeMutation.mutate({ id: Number(id), data: {} })}>
                  {t('workorder.btn_complete')}
                </Button>
              )}
              {(status === "Open" || status === "InProgress") && (
                <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => cancelMutation.mutate({ id: Number(id), data: {} })}>
                  {t('common.cancel')}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Partner Dispatch & SLA */}
        {!isNew && (() => {
          const w = wo as any;
          const slaStyle: Record<string, string> = {
            pending_ack: "bg-blue-100 text-blue-700",
            acknowledged: "bg-amber-100 text-amber-700",
            met: "bg-green-100 text-green-700",
            breached: "bg-red-100 text-red-700",
            escalated: "bg-red-100 text-red-700",
          };
          const canDispatch = status === "Open" || status === "InProgress";
          return (
            <div className="border rounded-lg bg-white p-4 mb-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-sm font-semibold uppercase text-primary tracking-wide flex items-center gap-1.5">
                  <Send className="h-4 w-4" /> {t('workorder.section_dispatch', 'Partner Dispatch & SLA')}
                </h2>
                {canDispatch && (
                  <Button size="sm" variant={w?.service_host_id ? "outline" : "default"} disabled={dispatching} onClick={() => dispatch(!!w?.service_host_id)}>
                    <Send className="h-3.5 w-3.5 mr-1" />
                    {w?.service_host_id ? t('workorder.btn_redispatch', 'Re-dispatch') : t('workorder.btn_dispatch', 'Dispatch to partner')}
                  </Button>
                )}
              </div>
              {dispatchError && <p className="text-xs text-red-600 mt-2 flex items-center gap-1"><ShieldAlert className="h-3.5 w-3.5" />{dispatchError}</p>}
              {w?.service_host_id ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">{t('workorder.label_partner', 'Partner')}</p><p className="font-medium">{w.service_host_name ?? `#${w.service_host_id}`}</p></div>
                  <div><p className="text-xs text-muted-foreground">SLA</p>
                    {w.sla_status ? <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${slaStyle[w.sla_status] ?? "bg-gray-100 text-gray-600"}`}>{w.sla_status}</span> : <span className="text-muted-foreground">—</span>}
                  </div>
                  <div><p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{t('workorder.label_ack_due', 'Ack due')}</p><p className="font-medium">{w.sla_ack_due_at ? formatDate(w.sla_ack_due_at) : "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />{t('workorder.label_acknowledged', 'Acknowledged')}</p><p className="font-medium">{w.acknowledged_at ? formatDate(w.acknowledged_at) : "—"}</p></div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-2">{t('workorder.not_dispatched', 'Not dispatched to a partner. Set a category matching a partner specialty and dispatch.')}</p>
              )}
            </div>
          );
        })()}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Details */}
          <div className="border rounded-lg bg-white p-4 sm:p-6">
            <h2 className="text-sm font-semibold uppercase text-primary tracking-wide mb-4">{t('workorder.section_details')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>{t('workorder.label_title')} *</Label>
                <Input placeholder={t('workorder.ph_title')} {...register("title")} />
              </div>
              <div>
                <Label>{t('workorder.label_priority')}</Label>
                <Controller name="priority" control={control} render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Low">{t('workorder.priority_low')}</SelectItem>
                      <SelectItem value="Normal">{t('workorder.priority_normal')}</SelectItem>
                      <SelectItem value="High">{t('workorder.priority_high')}</SelectItem>
                      <SelectItem value="Urgent">{t('workorder.priority_urgent')}</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
              <div>
                <Label>{t('workorder.label_category')}</Label>
                <Controller name="category" control={control} render={({ field }) => (
                  <Select value={field.value || "_none"} onValueChange={(v) => field.onChange(v === "_none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder={t('workorder.category_placeholder')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— {t('common.none')} —</SelectItem>
                      {/* 자주 쓰는 항목이 위, 드물게 쓰는 항목은 아래 그룹으로. 분류표는 @workspace/api-zod 정본. */}
                      <SelectGroup>
                        <SelectLabel>{t('workorder.category_group_common')}</SelectLabel>
                        {COMMON_WORK_ORDER_CATEGORIES.map(c => (
                          <SelectItem key={c.value} value={c.value}>{t(c.labelKey as any)}</SelectItem>
                        ))}
                      </SelectGroup>
                      <SelectGroup>
                        <SelectLabel>{t('workorder.category_group_other')}</SelectLabel>
                        {OTHER_WORK_ORDER_CATEGORIES.map(c => (
                          <SelectItem key={c.value} value={c.value}>{t(c.labelKey as any)}</SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )} />
              </div>
              <div className="col-span-2">
                <Label>{t('workorder.label_description')}</Label>
                <Textarea rows={3} placeholder={t('workorder.ph_description')} {...register("description")} />
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="border rounded-lg bg-white p-4 sm:p-6">
            <h2 className="text-sm font-semibold uppercase text-primary tracking-wide mb-4">{t('workorder.section_location', 'Location')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>{t('workorder.label_property')}</Label>
                <Controller name="property_id" control={control} render={({ field }) => (
                  <LookupSelect
                    lookupUrl="/api/v1/lookup/properties"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={t('workorder.ph_property_search')}
                    displayValue={(wo as any)?.property_name ?? null}
                  />
                )} />
              </div>
              <div>
                <Label>{t('workorder.label_space')}</Label>
                <Controller name="space_id" control={control} render={({ field }) => (
                  <LookupSelect
                    lookupUrl="/api/v1/lookup/spaces"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={t('workorder.ph_space_search')}
                    displayValue={(wo as any)?.space_name ?? prefillSpace?.name ?? null}
                  />
                )} />
              </div>
            </div>
          </div>

          {/* Schedule */}
          <div className="border rounded-lg bg-white p-4 sm:p-6">
            <h2 className="text-sm font-semibold uppercase text-primary tracking-wide mb-4">{t('workorder.section_schedule', 'Schedule & Assignment')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>{t('workorder.label_reported_date', 'Reported Date')}</Label>
                <Controller name="reported_at" control={control} render={({ field }) => (
                  <DateInput value={field.value ?? ""} onChange={field.onChange} />
                )} />
              </div>
              <div>
                <Label>{t('workorder.label_scheduled_date', 'Scheduled Date')}</Label>
                <Controller name="scheduled_at" control={control} render={({ field }) => (
                  <DateInput value={field.value ?? ""} onChange={field.onChange} />
                )} />
              </div>
              <div>
                <Label>{t('workorder.label_assigned')}</Label>
                <Controller name="assigned_contact_id" control={control} render={({ field }) => (
                  <LookupSelect
                    lookupUrl="/api/v1/lookup/contacts"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={t('workorder.ph_contact_search')}
                    displayValue={(wo as any)?.assigned_contact_name ?? null}
                  />
                )} />
              </div>
              <div>
                <Label>{t('workorder.label_cost')} ({currency})</Label>
                <Input type="number" step="0.01" placeholder="0.00" {...register("cost")} />
              </div>
            </div>
          </div>

          {/* 방문 약속 — 인스펙션 일정·담당·출입 (업무 캘린더에 표시된다) */}
          <div className="border rounded-lg bg-white p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
              <h2 className="text-sm font-semibold uppercase text-primary tracking-wide flex items-center gap-1.5">
                <CalendarClock className="h-4 w-4" /> {t('workorder.section_appointment', 'Appointment')}
              </h2>
              {!isNew && (
                <div className="flex items-center gap-2">
                  {(wo as any)?.confirmation_sent_at && (
                    <span className="text-xs text-muted-foreground">
                      {t('workorder.confirmation_sent', 'Confirmation sent')} {formatDate((wo as any).confirmation_sent_at)}
                    </span>
                  )}
                  <Button type="button" size="sm" variant="outline" disabled={sendingConfirm} onClick={sendConfirmation}>
                    <Mail className="h-3.5 w-3.5 mr-1" />
                    {(wo as any)?.confirmation_sent_at
                      ? t('workorder.btn_resend_confirmation', 'Resend confirmation')
                      : t('workorder.btn_send_confirmation', 'Send confirmation + .ics')}
                  </Button>
                </div>
              )}
            </div>
            {confirmMsg && <p className={`text-xs mb-3 ${confirmMsg.ok ? "text-green-600" : "text-red-600"}`}>{confirmMsg.text}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>{t('workorder.label_inspection_type', 'Inspection type')}</Label>
                <Controller name="inspection_type" control={control} render={({ field }) => (
                  <Select value={field.value || "_none"} onValueChange={(v) => field.onChange(v === "_none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder={t('workorder.ph_inspection_type', 'Not an inspection')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— {t('common.none')} —</SelectItem>
                      <SelectItem value="move_in">{t('workorder.inspection_move_in', 'Move-in inspection')}</SelectItem>
                      <SelectItem value="move_out">{t('workorder.inspection_move_out', 'Move-out inspection')}</SelectItem>
                      <SelectItem value="routine">{t('workorder.inspection_routine', 'Routine inspection')}</SelectItem>
                      <SelectItem value="pre_listing">{t('workorder.inspection_pre_listing', 'Pre-listing inspection')}</SelectItem>
                      <SelectItem value="defect_check">{t('workorder.inspection_defect_check', 'Defect check')}</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
              <div>
                <Label>{t('workorder.label_access_method', 'Access')}</Label>
                <Controller name="access_method" control={control} render={({ field }) => (
                  <Select value={field.value || "_none"} onValueChange={(v) => field.onChange(v === "_none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder={t('workorder.ph_access_method', 'How do we get in?')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">— {t('common.none')} —</SelectItem>
                      <SelectItem value="tenant_present">{t('workorder.access_tenant_present', 'Tenant present')}</SelectItem>
                      <SelectItem value="vacant_key">{t('workorder.access_vacant_key', 'Vacant — office key')}</SelectItem>
                      <SelectItem value="lockbox">{t('workorder.access_lockbox', 'Lockbox / door code')}</SelectItem>
                      <SelectItem value="agent">{t('workorder.access_agent', 'Agent opens')}</SelectItem>
                      <SelectItem value="other">{t('workorder.access_other', 'Other')}</SelectItem>
                    </SelectContent>
                  </Select>
                )} />
              </div>
              <div>
                <Label>{t('workorder.label_start_at', 'Starts at')}</Label>
                <Input type="datetime-local" {...register("scheduled_start_at")} />
              </div>
              <div>
                <Label>{t('workorder.label_end_at', 'Ends at')}</Label>
                <Input type="datetime-local" {...register("scheduled_end_at")} />
                <p className="text-xs text-muted-foreground mt-1">{t('workorder.end_hint', 'Blank = 1 hour visit.')}</p>
              </div>
              <div>
                <Label>{t('workorder.label_assigned_user', 'Staff in charge')}</Label>
                <Controller name="assigned_user_id" control={control} render={({ field }) => (
                  <LookupSelect
                    lookupUrl="/api/v1/lookup/admin-users"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={t('workorder.ph_user_search', 'Search staff…')}
                    displayValue={(wo as any)?.assigned_user_name ?? null}
                  />
                )} />
              </div>
              <div>
                <Label>{t('workorder.label_attendee', 'Met on site by')}</Label>
                <Controller name="attendee_contact_id" control={control} render={({ field }) => (
                  <LookupSelect
                    lookupUrl="/api/v1/lookup/contacts"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={t('workorder.ph_contact_search')}
                    displayValue={(wo as any)?.attendee_contact_name ?? null}
                  />
                )} />
                <p className="text-xs text-muted-foreground mt-1">{t('workorder.attendee_hint', 'The confirmation email goes to this contact.')}</p>
              </div>
              <div className="col-span-1 sm:col-span-2">
                <Label>{t('workorder.label_location_note', 'Meeting point / access notes')}</Label>
                <Input placeholder={t('workorder.ph_location_note', 'e.g. Lobby, B1 parking, door code 1234')} {...register("location_note")} />
              </div>
            </div>
          </div>

          {/* Completion info (read-only) */}
          {wo?.completed_at && (
            <div className="border rounded-lg bg-green-50 p-6">
              <h2 className="text-sm font-semibold uppercase text-green-600 tracking-wide mb-2">{t('workorder.section_completed', 'Completed')}</h2>
              <p className="text-sm text-green-700">
                {t('workorder.completed_on', 'Completed on')} {formatDate(wo.completed_at)}
                {wo.cost != null && ` — ${t('workorder.final_cost', 'Final cost')}: ${formatMoney(wo.cost, currency, currencyPosition)}`}
              </p>
            </div>
          )}

          {/* 사진 — 요청/완료 증빙 (신규는 저장 시 함께 업로드) */}
          <WorkOrderPhotos
            workOrderId={isNew ? undefined : Number(id)}
            staged={stagedPhotos}
            onStagedChange={setStagedPhotos}
          />

          {/* Notes */}
          <div className="border rounded-lg bg-white p-4 sm:p-6">
            <h2 className="text-sm font-semibold uppercase text-primary tracking-wide mb-4">{t('common.notes')}</h2>
            <Textarea rows={3} placeholder={t('workorder.ph_notes')} {...register("notes")} />
          </div>
        </form>
      </div>
      <DocumentPreviewDialog config={previewConfig} onClose={closePreview} />
    </Layout>
  );
}
