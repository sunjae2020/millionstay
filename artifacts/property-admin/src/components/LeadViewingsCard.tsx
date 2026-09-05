/**
 * 방문 예약 — 상담 단계에서 잡는 현장 방문 일정.
 *
 * 계약 전에 세대를 보러 오는 약속이라, 계약에도 예약에도 걸 자리가 없다. 업무
 * (tasks)에 `task_category='Viewing'` 으로 앉히고 문의에 걸어 둔다 — 업무는 이미
 * 담당자·상태·캘린더 연결을 갖고 있으므로 새 표를 파는 것보다 낫다.
 *
 * 지난 방문도 지운 것처럼 감추지 않는다. 몇 번 보러 왔는지가 상담 이력이고,
 * 두 번째 방문에서 계약이 되는 일이 흔하다.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CalendarClock, MapPin, Plus, Check, X, Clock } from "lucide-react";
import { LookupSelect } from "@/components/LookupSelect";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/apiFetch";
import { formatDateTime } from "@/lib/date";

interface Viewing {
  id: number;
  name: string;
  task_status: string;
  scheduled_start_at: string | null;
  scheduled_end_at: string | null;
  space_id: number | null;
  space_name: string | null;
  location: string | null;
  description: string | null;
  assigned_to: string | null;
}

/** `datetime-local` 이 주는 벽시계 값을 그대로 ISO 로 — 브라우저 시간대 기준. */
function toIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const STATUS_TONE: Record<string, string> = {
  Todo: "text-amber-700",
  InProgress: "text-blue-700",
  Done: "text-green-700",
  Cancelled: "text-muted-foreground line-through",
};

export function LeadViewingsCard({ leadId }: { leadId: number }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    scheduled_start_at: "",
    scheduled_end_at: "",
    space_id: null as number | null,
    location: "",
    assigned_to: "",
    description: "",
  });

  const { data: viewings = [], refetch } = useQuery({
    queryKey: ["lead-viewings", leadId],
    queryFn: async (): Promise<Viewing[]> => {
      const res = await apiFetch(`/api/v1/leads/${leadId}/viewings`);
      if (!res.ok) return [];
      return await res.json();
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const start = toIso(form.scheduled_start_at);
      if (!start) throw new Error(t("lead.viewing_need_time"));
      const res = await apiFetch(`/api/v1/leads/${leadId}/viewings`, {
        method: "POST",
        body: JSON.stringify({
          scheduled_start_at: start,
          scheduled_end_at: toIso(form.scheduled_end_at) ?? undefined,
          space_id: form.space_id ?? undefined,
          location: form.location.trim() || undefined,
          assigned_to: form.assigned_to.trim() || undefined,
          description: form.description.trim() || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? t("lead.viewing_error"));
      return body;
    },
    onSuccess: () => {
      setOpen(false);
      setForm({ scheduled_start_at: "", scheduled_end_at: "", space_id: null, location: "", assigned_to: "", description: "" });
      refetch();
      toast({ title: t("lead.viewing_created") });
    },
    onError: (e: any) => toast({ title: t("lead.viewing_error"), description: e.message, variant: "destructive" }),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, task_status }: { id: number; task_status: string }) => {
      const res = await apiFetch(`/api/v1/leads/${leadId}/viewings/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ task_status }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    onSuccess: () => refetch(),
  });

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-primary/10 border-b px-4 py-2 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-primary uppercase tracking-wider inline-flex items-center gap-1.5">
          <CalendarClock className="h-3.5 w-3.5" /> {t("lead.viewing_title")}
        </span>
        <Button type="button" size="sm" variant="outline" className="h-7 gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> {t("lead.viewing_new")}
        </Button>
      </div>

      <div className="p-4">
        {viewings.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("lead.viewing_empty")}</p>
        ) : (
          <ul className="space-y-3">
            {viewings.map((v) => (
              <li key={v.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1.5 text-sm">
                <div className="min-w-0">
                  <p className={`font-medium ${STATUS_TONE[v.task_status] ?? ""}`}>
                    {v.scheduled_start_at ? formatDateTime(v.scheduled_start_at) : v.name}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {t(`lead.viewing_status_${v.task_status}`, v.task_status)}
                    </span>
                  </p>
                  {(v.space_name || v.location) && (
                    <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {[v.space_name, v.location].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {v.assigned_to && (
                    <p className="text-xs text-muted-foreground">{t("lead.viewing_assignee")}: {v.assigned_to}</p>
                  )}
                  {v.description && <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{v.description}</p>}
                </div>
                {v.task_status !== "Done" && v.task_status !== "Cancelled" && (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Button type="button" size="sm" variant="outline" className="h-7 gap-1"
                      onClick={() => setStatus.mutate({ id: v.id, task_status: "Done" })}>
                      <Check className="h-3.5 w-3.5" /> {t("lead.viewing_done")}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 text-red-600"
                      onClick={() => setStatus.mutate({ id: v.id, task_status: "Cancelled" })}>
                      <X className="h-3.5 w-3.5" /> {t("lead.viewing_cancel")}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="text-lg">{t("lead.viewing_new")}</DialogTitle></DialogHeader>
          <div className="grid gap-5 py-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>{t("lead.viewing_start")} *</Label>
                <Input type="datetime-local" value={form.scheduled_start_at}
                  onChange={(e) => setForm((f) => ({ ...f, scheduled_start_at: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("lead.viewing_end")}</Label>
                <Input type="datetime-local" value={form.scheduled_end_at}
                  onChange={(e) => setForm((f) => ({ ...f, scheduled_end_at: e.target.value }))} />
                <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {t("lead.viewing_end_hint")}
                </p>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>{t("lead.viewing_space")}</Label>
              <LookupSelect
                value={form.space_id}
                onChange={(val) => setForm((f) => ({ ...f, space_id: val }))}
                lookupUrl="/api/v1/lookup/spaces"
                placeholder={t("lead.ph_search_spaces")}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>{t("lead.viewing_location")}</Label>
                <Input value={form.location} placeholder={t("lead.viewing_location_ph")}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("lead.viewing_assignee")}</Label>
                <Input value={form.assigned_to}
                  onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>{t("lead.viewing_note")}</Label>
              <Textarea rows={3} value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button disabled={!form.scheduled_start_at || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? t("common.saving") : t("lead.viewing_new")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
