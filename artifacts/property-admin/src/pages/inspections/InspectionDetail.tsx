/**
 * 세대점검표 — on-site editor.
 *
 * Built for a phone held in one hand at the unit door: a phase switch (입주/퇴거),
 * collapsible area groups, three-state buttons per row, a defect note and a
 * camera-backed photo upload. Everything saves on change; there is no "save"
 * button to forget on site.
 *
 * A phase locks itself once the tenant has signed it — from then on the row is
 * read-only and the PDF is the record.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Camera, Check, ChevronDown, ChevronRight, Copy, FileText, Link2,
  Eye, EyeOff, Loader2, Mail, Minus, Plus, Trash2, TriangleAlert, Wallet, X,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { DocumentPreviewDialog, useDocumentPreview } from "@/components/DocumentPreviewDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import SignaturePad from "@/components/SignaturePad";
import { apiFetch, apiJson } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/date";

type Phase = "move_in" | "move_out";
type ItemStatus = "ok" | "defect" | "na";

interface InspectionItem {
  id: number;
  group_key: string | null;
  item_code: string | null;
  label: string;
  move_in_status: ItemStatus | null;
  move_in_note: string | null;
  move_out_status: ItemStatus | null;
  move_out_note: string | null;
  hidden: boolean;
  photos: Array<{ id: number; phase: string; file_url: string; thumbnail_url: string | null }>;
  responses: Array<{ decision: string; comment: string | null }>;
}

interface Inspection {
  id: number;
  report_ref: string;
  contract_id: number | null;
  status: string;
  title: string | null;
  title_display: string;
  meta: Record<string, any>;
  sign_token: string | null;
  sign_token_phase: string | null;
  sign_token_expires_at: string | null;
  items: InspectionItem[];
  signatures: Array<{
    id: number; phase: string; role: string; signer_name: string | null;
    signature_image: string; signed_at: string; ip: string | null; content_hash: string | null;
  }>;
  templateView: { key: string; name: string; heading: string; unitTypes: string[]; groups: Array<{ key: string; label: string }>; specialTerms: string[] };
}

const STATUS_CYCLE: Array<{ value: ItemStatus; icon: typeof Check; className: string }> = [
  { value: "ok", icon: Check, className: "bg-green-100 text-green-700 border-green-300" },
  { value: "defect", icon: TriangleAlert, className: "bg-red-100 text-red-700 border-red-300" },
  { value: "na", icon: Minus, className: "bg-gray-100 text-gray-600 border-gray-300" },
];

export default function InspectionDetail() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [phase, setPhase] = useState<Phase>("move_in");
  const { previewConfig, openPreview, closePreview } = useDocumentPreview();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [signOpen, setSignOpen] = useState(false);
  const [signImage, setSignImage] = useState<string | null>(null);
  const [signName, setSignName] = useState("");
  const [linkResult, setLinkResult] = useState<{ url: string; expires_at: string } | null>(null);
  const [recipient, setRecipient] = useState("");
  const [showHidden, setShowHidden] = useState(false);
  const [uploadingItem, setUploadingItem] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<number | null>(null);

  const lang = i18n.language;
  const queryKey = ["inspection", id, lang];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () =>
      (await apiJson<{ data: Inspection }>(`/api/v1/inspections/${id}?lang=${encodeURIComponent(lang)}`)).data,
  });
  const report = data;

  // Default the recipient to the tenant's account email (prefilled at creation).
  useEffect(() => {
    const email = report?.meta?.tenant_email;
    if (email) setRecipient((prev) => prev || email);
  }, [report?.meta?.tenant_email]);

  const refresh = () => qc.invalidateQueries({ queryKey });

  const signedPhases = useMemo(() => {
    const set = new Set<string>();
    for (const s of report?.signatures ?? []) if (s.role === "tenant") set.add(s.phase);
    return set;
  }, [report]);
  const locked = signedPhases.has(phase);

  const groups = useMemo(() => {
    const byKey = new Map<string, InspectionItem[]>();
    for (const item of report?.items ?? []) {
      if (item.hidden && !showHidden) continue;
      const key = item.group_key ?? "other";
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push(item);
    }
    const ordered = (report?.templateView.groups ?? []).map((g) => ({ key: g.key, label: g.label, items: byKey.get(g.key) ?? [] }));
    const extras = [...byKey.entries()]
      .filter(([k]) => !ordered.some((g) => g.key === k))
      .map(([k, items]) => ({ key: k, label: t("inspection.group_other"), items }));
    return [...ordered, ...extras].filter((g) => g.items.length);
  }, [report, t, showHidden]);

  // ── mutations ──────────────────────────────────────────────────────────────
  const patchItem = useMutation({
    mutationFn: async (vars: { itemId: number; patch: Record<string, unknown> }) =>
      apiJson(`/api/v1/inspections/${id}/items/${vars.itemId}`, { method: "PATCH", body: JSON.stringify(vars.patch) }),
    onSuccess: refresh,
    onError: (e: any) => toast({ title: t("inspection.save_failed"), description: e?.message, variant: "destructive" }),
  });

  const patchMeta = useMutation({
    mutationFn: async (meta: Record<string, unknown>) =>
      apiJson(`/api/v1/inspections/${id}`, { method: "PATCH", body: JSON.stringify({ meta }) }),
    onSuccess: refresh,
  });

  const addItem = useMutation({
    mutationFn: async (label: string) =>
      apiJson(`/api/v1/inspections/${id}/items`, { method: "POST", body: JSON.stringify({ label, group_key: "other" }) }),
    onSuccess: () => { setAddOpen(false); setNewLabel(""); refresh(); },
  });

  const removeItem = useMutation({
    mutationFn: async (itemId: number) => apiJson(`/api/v1/inspections/${id}/items/${itemId}`, { method: "DELETE" }),
    onSuccess: refresh,
    onError: (e: any) => toast({ title: t("inspection.delete_failed"), description: e?.message, variant: "destructive" }),
  });

  const removePhoto = useMutation({
    mutationFn: async (photoId: number) => apiJson(`/api/v1/inspections/${id}/photos/${photoId}`, { method: "DELETE" }),
    onSuccess: refresh,
  });

  const signInspector = useMutation({
    mutationFn: async () =>
      apiJson(`/api/v1/inspections/${id}/signatures`, {
        method: "POST",
        body: JSON.stringify({ phase, role: "inspector", signer_name: signName, signature_image: signImage }),
      }),
    onSuccess: () => { setSignOpen(false); setSignImage(null); refresh(); },
    onError: (e: any) => toast({ title: t("inspection.sign_failed"), description: e?.message, variant: "destructive" }),
  });

  const issueLink = useMutation({
    mutationFn: async (sendEmail: boolean) =>
      apiJson<{ data: { url: string; expires_at: string; email: { ok: boolean; error?: string } | null } }>(
        `/api/v1/inspections/${id}/sign-link`,
        { method: "POST", body: JSON.stringify({ phase, send_email: sendEmail, email: recipient }) },
      ),
    onSuccess: (res) => {
      setLinkResult(res.data);
      refresh();
      if (res.data.email?.ok) toast({ title: t("inspection.email_sent", { to: recipient }) });
      else if (res.data.email) {
        toast({
          title: t("inspection.email_failed"),
          description: res.data.email.error === "NO_RECIPIENT" ? t("inspection.email_no_recipient") : res.data.email.error,
          variant: "destructive",
        });
      }
    },
    onError: (e: any) => toast({ title: t("inspection.link_failed"), description: e?.message, variant: "destructive" }),
  });

  const finalize = useMutation({
    mutationFn: async () => apiJson(`/api/v1/inspections/${id}/finalize`, { method: "POST", body: "{}" }),
    onSuccess: refresh,
  });

  async function uploadPhoto(file: File, itemId: number) {
    setUploadingItem(itemId);
    try {
      const form = new FormData();
      form.append("image", file);
      form.append("item_id", String(itemId));
      form.append("phase", phase);
      const res = await apiFetch(`/api/v1/inspections/${id}/photos`, { method: "POST", body: form });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
      }
      refresh();
    } catch (err) {
      toast({ title: t("inspection.upload_failed"), description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setUploadingItem(null);
    }
  }

  // 퇴거 세대 정산 확인서 — issued as a SET with this checklist. Opens the lease's
  // settlement statement, drafting one on first use (the draft snapshots the
  // 보증금 and turns every month already settled out of it into a line). Both
  // documents render through the shared preview modal, never a bare download.
  const settlementDoc = useMutation({
    mutationFn: async () => {
      if (!report?.contract_id) throw new Error("no contract");
      const list = await apiJson<{ data: Array<{ id: number; settlement_ref: string }> }>(
        `/api/v1/contracts/${report.contract_id}/deposit-settlements`,
      );
      const existing = list.data?.[0];
      if (existing) return existing;
      const created = await apiJson<{ data: { id: number; settlement_ref: string } }>(
        `/api/v1/contracts/${report.contract_id}/deposit-settlements`,
        { method: "POST", body: "{}" },
      );
      return created.data;
    },
    onSuccess: (s) => {
      openPreview({
        title: s.settlement_ref,
        filename: `${s.settlement_ref}.pdf`,
        source: { kind: "api", path: `/api/v1/deposit-settlements/${s.id}/document.pdf?lang=${encodeURIComponent(lang)}` },
      });
    },
    onError: (err) => toast({
      title: t("inspection.settlement_failed"),
      description: err instanceof Error ? err.message : undefined,
      variant: "destructive",
    }),
  });

  // Preview the checklist PDF (print / download). Delivery to the tenant goes
  // through the signing link below, not a document email.
  function previewPdf() {
    openPreview({
      title: report?.report_ref ?? t("inspection.tab_title"),
      filename: `${report?.report_ref ?? "inspection"}.pdf`,
      source: { kind: "api", path: `/api/v1/inspections/${id}/document.pdf?lang=${encodeURIComponent(lang)}` },
    });
  }

  const statusOf = (item: InspectionItem): ItemStatus | null =>
    phase === "move_in" ? item.move_in_status : item.move_out_status;
  const noteOf = (item: InspectionItem): string =>
    (phase === "move_in" ? item.move_in_note : item.move_out_note) ?? "";

  function setStatus(item: InspectionItem, value: ItemStatus) {
    const current = statusOf(item);
    patchItem.mutate({ itemId: item.id, patch: { [`${phase}_status`]: current === value ? null : value } });
  }

  const meta = report?.meta ?? {};
  const metaField = (key: string, label: string, placeholder?: string) => (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        defaultValue={meta[key] ?? ""}
        placeholder={placeholder}
        disabled={locked}
        onBlur={(e) => { if (e.target.value !== (meta[key] ?? "")) patchMeta.mutate({ [key]: e.target.value }); }}
      />
    </div>
  );

  const meterField = (side: "in" | "out", key: "electric" | "water" | "gas", label: string) => (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        defaultValue={meta.meters?.[side]?.[key] ?? ""}
        placeholder="kwh"
        disabled={locked}
        onBlur={(e) => {
          const meters = { ...(meta.meters ?? {}) };
          meters[side] = { ...(meters[side] ?? {}), [key]: e.target.value };
          patchMeta.mutate({ meters });
        }}
      />
    </div>
  );

  if (isLoading || !report) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      </Layout>
    );
  }

  const activeItems = report.items.filter((i) => !i.hidden);
  const hiddenCount = report.items.length - activeItems.length;
  const filled = activeItems.filter((i) => statusOf(i)).length;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Button variant="ghost" size="sm" className="-ml-2 mb-1" onClick={() => navigate(report.contract_id ? `/booking/contracts/${report.contract_id}` : "/booking/contracts")}>
              <ArrowLeft className="w-4 h-4 mr-1" /> {t("common.back")}
            </Button>
            <h1 className="text-xl font-semibold truncate">{report.title_display}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {report.report_ref} · <Badge variant="outline">{t(`inspection.status_${report.status}`, report.status)}</Badge>
            </p>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={previewPdf}><FileText className="w-3.5 h-3.5 mr-1" />PDF</Button>
            {report.contract_id && (
              <Button size="sm" variant="outline" onClick={() => settlementDoc.mutate()} disabled={settlementDoc.isPending}>
                {settlementDoc.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Wallet className="w-3.5 h-3.5 mr-1" />}
                {t("inspection.settlement_doc")}
              </Button>
            )}
          </div>
        </div>

        {/* Phase switch */}
        <div className="grid grid-cols-2 gap-2">
          {(["move_in", "move_out"] as Phase[]).map((p) => (
            <button
              key={p}
              onClick={() => setPhase(p)}
              className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                phase === p ? "border-primary bg-primary/5 text-primary" : "border-input text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(`inspection.phase_${p}`)}
              {signedPhases.has(p) && <Check className="inline w-3.5 h-3.5 ml-1.5" />}
            </button>
          ))}
        </div>

        {locked && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {t("inspection.locked_notice")}
          </div>
        )}

        {/* Header fields */}
        <div className="rounded-lg border bg-white p-4 space-y-3">
          <h2 className="text-sm font-medium">{t("inspection.section_header")}</h2>
          <div className="grid grid-cols-2 gap-3">
            {metaField("unit_type", t("inspection.unit_type"), report.templateView.unitTypes.join(" / "))}
            {metaField("unit_no", t("inspection.unit_no"))}
            {metaField("tenant_name", t("inspection.tenant_name"))}
            {metaField("tenant_phone", t("inspection.tenant_phone"), "010-")}
            {metaField("move_in_date", t("inspection.move_in_date"), "YYYY-MM-DD")}
            {metaField("move_out_date", t("inspection.move_out_date"), "YYYY-MM-DD")}
            {/* Quoted on the 퇴거 세대 정산 확인서 ("비밀번호 …로 변경 후 반납"). */}
            {metaField("door_password", t("inspection.door_password"), "1234*")}
          </div>
        </div>

        {/* Meter readings */}
        <div className="rounded-lg border bg-white p-4 space-y-3">
          <h2 className="text-sm font-medium">{t(phase === "move_in" ? "inspection.meters_in" : "inspection.meters_out")}</h2>
          <div className="grid grid-cols-3 gap-3">
            {meterField(phase === "move_in" ? "in" : "out", "electric", t("inspection.meter_electric"))}
            {meterField(phase === "move_in" ? "in" : "out", "water", t("inspection.meter_water"))}
            {meterField(phase === "move_in" ? "in" : "out", "gas", t("inspection.meter_gas"))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {metaField(phase === "move_in" ? "inspector_in" : "inspector_out", t("inspection.inspector_name"))}
            {metaField(phase === "move_in" ? "confirmed_in" : "confirmed_out", t("inspection.confirmed_on"), "YYYY-MM-DD")}
          </div>
        </div>

        {/* Checklist */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">
            {t("inspection.section_checklist")}{" "}
            <span className="text-muted-foreground font-normal">({filled}/{activeItems.length})</span>
          </h2>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowHidden((v) => !v)}>
              {showHidden ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
              {showHidden ? t("inspection.hide_hidden") : t("inspection.show_hidden", { count: hiddenCount })}
            </Button>
            <Button size="sm" variant="outline" disabled={locked} onClick={() => setAddOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" />{t("inspection.add_item")}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {groups.map((group) => {
            const open = openGroups[group.key] ?? true;
            const shown = group.items.filter((i) => !i.hidden);
            const done = shown.filter((i) => statusOf(i)).length;
            const defects = shown.filter((i) => statusOf(i) === "defect").length;
            return (
              <div key={group.key} className="rounded-lg border bg-white overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-gray-50"
                  onClick={() => setOpenGroups((prev) => ({ ...prev, [group.key]: !open }))}
                >
                  <span className="flex items-center gap-2">
                    {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    {group.label}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    {defects > 0 && <Badge className="bg-red-100 text-red-700 hover:bg-red-100">{t("inspection.defects", { count: defects })}</Badge>}
                    {done}/{shown.length}
                  </span>
                </button>

                {open && (
                  <div className="divide-y border-t">
                    {group.items.map((item) => {
                      const status = statusOf(item);
                      const photos = item.photos.filter((p) => p.phase === phase);
                      const dispute = item.responses[0];
                      return (
                        <div key={item.id} className={`px-4 py-3 space-y-2 ${item.hidden ? "bg-gray-50/70" : ""}`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-sm ${item.hidden ? "text-muted-foreground line-through" : ""}`}>
                              {item.label}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              {!item.hidden && STATUS_CYCLE.map(({ value, icon: Icon, className }) => (
                                <button
                                  key={value}
                                  disabled={locked}
                                  onClick={() => setStatus(item, value)}
                                  title={t(`inspection.item_${value}`)}
                                  className={`h-8 w-8 rounded-md border flex items-center justify-center transition-colors disabled:opacity-50 ${
                                    status === value ? className : "border-input text-muted-foreground hover:bg-gray-50"
                                  }`}
                                >
                                  <Icon className="w-4 h-4" />
                                </button>
                              ))}
                              <button
                                disabled={locked}
                                title={item.hidden ? t("inspection.unhide_item") : t("inspection.hide_item")}
                                onClick={() => patchItem.mutate({ itemId: item.id, patch: { hidden: !item.hidden } })}
                                className="h-8 w-8 rounded-md border border-input flex items-center justify-center text-muted-foreground hover:bg-gray-50 disabled:opacity-50"
                              >
                                {item.hidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                              </button>
                              {!item.item_code && !locked && (
                                <button
                                  onClick={() => removeItem.mutate(item.id)}
                                  className="h-8 w-8 rounded-md border border-input flex items-center justify-center text-red-500 hover:bg-red-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Defect note only matters for a defect; photos are
                              available on every row — a photo of an intact
                              fixture at move-in is exactly what settles a
                              dispute at move-out. */}
                          {!item.hidden && status === "defect" && (
                            <Textarea
                              rows={2}
                              defaultValue={noteOf(item)}
                              disabled={locked}
                              placeholder={t("inspection.defect_placeholder")}
                              onBlur={(e) => {
                                if (e.target.value !== noteOf(item)) {
                                  patchItem.mutate({ itemId: item.id, patch: { [`${phase}_note`]: e.target.value } });
                                }
                              }}
                            />
                          )}

                          {!item.hidden && (photos.length > 0 || !locked) && (
                            <div className="flex items-center gap-2 flex-wrap">
                              {photos.map((p) => (
                                <div key={p.id} className="relative">
                                  <a href={p.file_url} target="_blank" rel="noopener noreferrer">
                                    <img src={p.thumbnail_url || p.file_url} alt="" className="h-16 w-16 rounded-md object-cover border" />
                                  </a>
                                  {!locked && (
                                    <button
                                      onClick={() => removePhoto.mutate(p.id)}
                                      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-white border shadow flex items-center justify-center text-red-500"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              ))}
                              {!locked && (
                                <button
                                  onClick={() => { uploadTargetRef.current = item.id; fileInputRef.current?.click(); }}
                                  title={t("inspection.add_photo")}
                                  className="h-16 w-16 rounded-md border border-dashed flex items-center justify-center text-muted-foreground hover:bg-gray-50"
                                >
                                  {uploadingItem === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                                </button>
                              )}
                            </div>
                          )}

                          {!item.hidden && dispute && (
                            <p className={`text-xs ${dispute.decision === "disputed" ? "text-red-600" : "text-green-700"}`}>
                              {t(`inspection.tenant_${dispute.decision}`)}
                              {dispute.comment ? ` — ${dispute.comment}` : ""}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            const itemId = uploadTargetRef.current;
            if (file && itemId) void uploadPhoto(file, itemId);
            e.target.value = "";
          }}
        />

        {/* 비고 */}
        <div className="rounded-lg border bg-white p-4 space-y-2">
          <h2 className="text-sm font-medium">{t("inspection.remarks")}</h2>
          <Textarea
            rows={3}
            defaultValue={meta.remarks ?? ""}
            disabled={locked}
            onBlur={(e) => { if (e.target.value !== (meta.remarks ?? "")) patchMeta.mutate({ remarks: e.target.value }); }}
          />
        </div>

        {/* Signatures */}
        <div className="rounded-lg border bg-white p-4 space-y-3">
          <h2 className="text-sm font-medium">{t("inspection.section_signatures")}</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {(["inspector", "tenant"] as const).map((role) => {
              const sig = report.signatures.find((s) => s.phase === phase && s.role === role);
              return (
                <div key={role} className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground mb-2">{t(`inspection.role_${role}`)}</p>
                  {sig ? (
                    <>
                      <img src={sig.signature_image} alt="" className="h-14 object-contain" />
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {sig.signer_name || "—"} · {new Date(sig.signed_at).toLocaleString()}
                      </p>
                      {/* Recorded server-side at sign time — this is what makes
                          the signature hold up if it is ever questioned. */}
                      <p className="text-[10px] text-muted-foreground/80 mt-0.5">
                        {sig.ip ? `IP ${sig.ip}` : ""}
                        {sig.content_hash ? ` · ${t("inspection.hash")} ${sig.content_hash.slice(0, 12)}` : ""}
                      </p>
                    </>
                  ) : role === "inspector" ? (
                    <Button size="sm" variant="outline" onClick={() => setSignOpen(true)}>{t("inspection.sign_now")}</Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t("inspection.tenant_not_signed")}</p>
                  )}
                </div>
              );
            })}
          </div>

          {!signedPhases.has(phase) && (
            <div className="space-y-2 border-t pt-3">
              <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                <div className="flex-1">
                  <Label className="text-xs">{t("inspection.recipient_email")}</Label>
                  <Input
                    type="email"
                    value={recipient}
                    placeholder={meta.tenant_email || "tenant@example.com"}
                    onChange={(e) => setRecipient(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => issueLink.mutate(true)} disabled={issueLink.isPending}>
                    <Mail className="w-3.5 h-3.5 mr-1" />{t("inspection.send_email")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => issueLink.mutate(false)} disabled={issueLink.isPending}>
                    <Link2 className="w-3.5 h-3.5 mr-1" />{t("inspection.issue_link")}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{t("inspection.sms_soon")}</p>
              {(linkResult || report.sign_token) && (
                <div className="rounded-md bg-gray-50 border px-3 py-2 text-xs space-y-1">
                  <p className="text-muted-foreground">{t("inspection.link_hint")}</p>
                  <div className="flex items-center gap-2">
                    <code className="truncate flex-1">{linkResult?.url ?? `${window.location.origin.replace(/admin\./, "")}/inspection/${report.sign_token}`}</code>
                    <Button
                      size="sm" variant="ghost" className="h-7 px-2"
                      onClick={() => {
                        const url = linkResult?.url ?? `/inspection/${report.sign_token}`;
                        void navigator.clipboard.writeText(url);
                        toast({ title: t("inspection.link_copied") });
                      }}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  {(linkResult?.expires_at ?? report.sign_token_expires_at) && (
                    <p className="text-muted-foreground">
                      {t("inspection.link_expires", { date: formatDate(linkResult?.expires_at ?? report.sign_token_expires_at!) })}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {report.status !== "finalized" && signedPhases.size > 0 && (
            <Button size="sm" variant="outline" onClick={() => finalize.mutate()} disabled={finalize.isPending}>
              {t("inspection.finalize")}
            </Button>
          )}
        </div>

        {/* 특약사항 */}
        <div className="rounded-lg border bg-white p-4">
          <h2 className="text-sm font-medium mb-2">{t("inspection.special_terms")}</h2>
          <ol className="space-y-1.5 text-xs text-muted-foreground list-decimal pl-4">
            {report.templateView.specialTerms.map((term, i) => <li key={i}>{term}</li>)}
          </ol>
        </div>
      </div>

      {/* Add custom item */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("inspection.add_item")}</DialogTitle></DialogHeader>
          <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder={t("inspection.item_label")} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => newLabel.trim() && addItem.mutate(newLabel.trim())} disabled={!newLabel.trim() || addItem.isPending}>
              {t("common.add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inspector signature */}
      <Dialog open={signOpen} onOpenChange={setSignOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("inspection.inspector_sign_title")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">{t("inspection.inspector_name")}</Label>
              <Input value={signName} onChange={(e) => setSignName(e.target.value)} />
            </div>
            <SignaturePad value={signImage} onChange={setSignImage} label={t("inspection.signature")} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => signInspector.mutate()} disabled={!signImage || signInspector.isPending}>
              {t("inspection.save_signature")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DocumentPreviewDialog config={previewConfig} onClose={closePreview} />
    </Layout>
  );
}
