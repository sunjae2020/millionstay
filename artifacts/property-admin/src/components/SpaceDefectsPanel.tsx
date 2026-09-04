import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { apiFetch, getStoredToken } from "@/lib/apiFetch";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/date";
import { Plus, Pencil, Trash2, ImagePlus, Loader2, X } from "lucide-react";
import { ImagePreviewDialog, useImagePreview, type PreviewImage } from "@/components/ImagePreviewDialog";
import { cn } from "@/lib/utils";

import { ExportableTable } from "@/components/ui/ExportCsvButton";
import { CameraButton } from "@/components/CameraButton";
// 하자 이력 — the per-unit defect register on the space detail page.
// Column order follows the usual defect/snag-register convention:
// identity (derived) → classification → detail → status → responsibility → evidence.

interface SpaceDefect {
  id: number;
  space_id: number;
  defect_category: string;
  has_furniture_install: boolean;
  has_registration: boolean;
  has_outdoor_unit_socket: boolean;
  has_toilet_fixing_issue: boolean;
  detail_item: string;
  description: string;
  progress_status: string;
  vendor_name: string;
  photo_urls: string[] | null;
  created_at: string;
}

interface DefectContext {
  owner_name: string | null;
  unit_name: string | null;
  type_label: string | null;
}

/** The four recurring per-unit defect flags the original ledger marked with an O. */
const FLAG_KEYS = [
  { key: "has_furniture_install", label: "defect.flag_furniture_install" },
  { key: "has_registration", label: "defect.flag_registration" },
  { key: "has_outdoor_unit_socket", label: "defect.flag_outdoor_unit_socket" },
  { key: "has_toilet_fixing_issue", label: "defect.flag_toilet_fixing_issue" },
] as const;

const CATEGORY_SUGGESTIONS = ["시공하자", "마감불량", "설비하자", "가구/가전", "AS", "기타"];
const PROGRESS_STATUSES = ["접수", "진행중", "완료", "보류"];

function progressClass(status: string): string {
  if (status === "완료") return "bg-green-100 text-green-700";
  if (status === "진행중") return "bg-blue-100 text-blue-700";
  if (status === "보류") return "bg-amber-100 text-amber-700";
  return "bg-gray-100 text-gray-700";
}

type DefectForm = {
  defect_category: string;
  has_furniture_install: boolean;
  has_registration: boolean;
  has_outdoor_unit_socket: boolean;
  has_toilet_fixing_issue: boolean;
  detail_item: string;
  description: string;
  progress_status: string;
  vendor_name: string;
};

const EMPTY_FORM: DefectForm = {
  defect_category: "",
  has_furniture_install: false,
  has_registration: false,
  has_outdoor_unit_socket: false,
  has_toilet_fixing_issue: false,
  detail_item: "",
  description: "",
  progress_status: "접수",
  vendor_name: "",
};

function uploadPhoto(spaceId: number, defectId: number, file: File): Promise<Response> {
  const token = getStoredToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const body = new FormData();
  body.append("image", file);
  return fetch(`/api/v1/spaces/${spaceId}/defects/${defectId}/photos`, { method: "POST", headers, body });
}

export function SpaceDefectsPanel({ spaceId }: { spaceId: number }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<DefectForm>(EMPTY_FORM);
  const [uploadingFor, setUploadingFor] = useState<number | null>(null);
  const [pendingPhotoFor, setPendingPhotoFor] = useState<number | null>(null);
  const { imagePreview, openImagePreview, closeImagePreview } = useImagePreview();

  const queryKey = ["space-defects", spaceId];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const r = await apiFetch(`/api/v1/spaces/${spaceId}/defects`);
      return r.json();
    },
    enabled: !!spaceId,
  });

  const defects: SpaceDefect[] = data?.data ?? [];
  const context: DefectContext = data?.context ?? { owner_name: null, unit_name: null, type_label: null };
  const invalidate = () => qc.invalidateQueries({ queryKey });

  const saveMutation = useMutation({
    mutationFn: async (payload: DefectForm & { id: number | null }) => {
      const { id, ...body } = payload;
      const url = id
        ? `/api/v1/spaces/${spaceId}/defects/${id}`
        : `/api/v1/spaces/${spaceId}/defects`;
      const r = await apiFetch(url, {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? "Save failed");
      return r.json();
    },
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      toast({ title: t("common.saved", "저장되었습니다") });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiFetch(`/api/v1/spaces/${spaceId}/defects/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Delete failed");
      return r.json();
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast({ title: e.message, variant: "destructive" }),
  });

  const removePhotoMutation = useMutation({
    mutationFn: async ({ id, url }: { id: number; url: string }) => {
      const r = await apiFetch(`/api/v1/spaces/${spaceId}/defects/${id}/photos`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!r.ok) throw new Error("Delete failed");
      return r.json();
    },
    onSuccess: invalidate,
  });

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(d: SpaceDefect) {
    setEditingId(d.id);
    setForm({
      defect_category: d.defect_category ?? "",
      has_furniture_install: !!d.has_furniture_install,
      has_registration: !!d.has_registration,
      has_outdoor_unit_socket: !!d.has_outdoor_unit_socket,
      has_toilet_fixing_issue: !!d.has_toilet_fixing_issue,
      detail_item: d.detail_item ?? "",
      description: d.description ?? "",
      progress_status: d.progress_status || "접수",
      vendor_name: d.vendor_name ?? "",
    });
    setDialogOpen(true);
  }

  function pickPhoto(defectId: number) {
    setPendingPhotoFor(defectId);
    fileInputRef.current?.click();
  }

  // 촬영 버튼은 대상 하자를 이미 알고 넘긴다 — 갤러리 경로처럼 상태에 기대지 않는다.
  async function uploadFiles(defectId: number, files: File[]) {
    if (!files.length) return;
    setUploadingFor(defectId);
    try {
      for (const file of files) {
        const r = await uploadPhoto(spaceId, defectId, file);
        if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error ?? "Upload failed");
      }
      invalidate();
    } catch (e) {
      toast({ title: (e as Error).message, variant: "destructive" });
    } finally {
      setUploadingFor(null);
      setPendingPhotoFor(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleFiles(files: FileList | null) {
    const defectId = pendingPhotoFor;
    if (!files?.length || !defectId) return;
    await uploadFiles(defectId, Array.from(files));
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <div className="flex justify-between items-start gap-4 flex-wrap">
        <div>
          <h4 className="font-medium text-sm">{t("defect.title")}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">{t("defect.desc")}</p>
        </div>
        <Button size="sm" variant="outline" onClick={openAdd}>
          <Plus className="w-3.5 h-3.5 mr-1" /> {t("defect.btn_add")}
        </Button>
      </div>

      {/* Identity strip — 소유자명 / 호수 / TYPE, derived from the unit master. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-lg border bg-muted/30 p-4">
        {[
          { label: t("defect.col_owner_name"), value: context.owner_name },
          { label: t("defect.col_unit_no"), value: context.unit_name },
          { label: t("defect.col_type"), value: context.type_label },
        ].map((f) => (
          <div key={f.label} className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{f.label}</span>
            <span className="text-sm font-medium">{f.value || "—"}</span>
          </div>
        ))}
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <ExportableTable fileName="space-defects-panel" className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              {[
                t("defect.col_category"),
                t("defect.col_flags"),
                t("defect.col_detail_item"),
                t("defect.col_description"),
                t("defect.col_progress_status"),
                t("defect.col_vendor_name"),
                t("defect.col_photos"),
                t("defect.col_registered_on"),
                "",
              ].map((h, hi) => (
                <th key={hi} className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="text-center py-10 text-muted-foreground">{t("common.loading")}</td></tr>
            ) : !defects.length ? (
              <tr><td colSpan={9} className="text-center py-10 text-muted-foreground">{t("defect.empty")}</td></tr>
            ) : defects.map((d) => {
              const photos = d.photo_urls ?? [];
              return (
                <tr key={d.id} className="border-b hover:bg-muted/40 align-top">
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{d.defect_category || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {FLAG_KEYS.filter((f) => (d as unknown as Record<string, boolean>)[f.key]).map((f) => (
                        <Badge key={f.key} variant="secondary" className="text-[11px] font-normal">{t(f.label)}</Badge>
                      ))}
                      {!FLAG_KEYS.some((f) => (d as unknown as Record<string, boolean>)[f.key]) && (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">{d.detail_item || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground max-w-md whitespace-pre-wrap">{d.description || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", progressClass(d.progress_status))}>
                      {d.progress_status || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{d.vendor_name || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {photos.map((url) => (
                        <button
                          key={url}
                          type="button"
                          onClick={() =>
                            openImagePreview(
                              photos.map<PreviewImage>((u) => ({
                                url: u,
                                onDelete: () => removePhotoMutation.mutateAsync({ id: d.id, url: u }),
                              })),
                              photos.indexOf(url),
                            )
                          }
                          className="h-10 w-10 rounded border overflow-hidden hover:ring-2 hover:ring-primary/40"
                        >
                          <img src={url} alt="" className="h-full w-full object-cover" />
                        </button>
                      ))}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        disabled={uploadingFor === d.id}
                        onClick={() => pickPhoto(d.id)}
                        title={t("defect.btn_add_photo")}
                      >
                        {uploadingFor === d.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <ImagePlus className="w-3.5 h-3.5" />}
                      </Button>
                      <CameraButton
                        disabled={uploadingFor === d.id}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent disabled:opacity-60"
                        label=""
                        onCapture={(files) => uploadFiles(d.id, files)}
                      />
                    </div>
                    {photos.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {photos.map((url) => (
                          <button
                            key={`rm-${url}`}
                            type="button"
                            className="text-[10px] text-muted-foreground hover:text-destructive inline-flex items-center gap-0.5"
                            onClick={() => removePhotoMutation.mutate({ id: d.id, url })}
                          >
                            <X className="w-2.5 h-2.5" /> {t("common.delete")}
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{d.created_at ? formatDate(d.created_at) : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(d)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                        onClick={() => deleteMutation.mutate(d.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </ExportableTable>
      </div>

      {/* Add / edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? t("defect.dialog_edit") : t("defect.dialog_add")}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("defect.col_category")}</Label>
              <Input
                list="space-defect-categories"
                value={form.defect_category}
                onChange={(e) => setForm({ ...form, defect_category: e.target.value })}
                placeholder={t("defect.placeholder_category")}
              />
              <datalist id="space-defect-categories">
                {CATEGORY_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("defect.col_progress_status")}</Label>
              <Input
                list="space-defect-statuses"
                value={form.progress_status}
                onChange={(e) => setForm({ ...form, progress_status: e.target.value })}
              />
              <datalist id="space-defect-statuses">
                {PROGRESS_STATUSES.map((s) => <option key={s} value={s} />)}
              </datalist>
            </div>

            <div className="sm:col-span-2 flex flex-col gap-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("defect.col_flags")}</Label>
              <div className="flex flex-wrap gap-4">
                {FLAG_KEYS.map((f) => (
                  <label key={f.key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={form[f.key]}
                      onCheckedChange={(v) => setForm({ ...form, [f.key]: v === true })}
                    />
                    {t(f.label)}
                  </label>
                ))}
              </div>
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("defect.col_detail_item")}</Label>
              <Input
                value={form.detail_item}
                onChange={(e) => setForm({ ...form, detail_item: e.target.value })}
                placeholder={t("defect.placeholder_detail_item")}
              />
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("defect.col_description")}</Label>
              <Textarea
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t("defect.placeholder_description")}
              />
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("defect.col_vendor_name")}</Label>
              <Input
                value={form.vendor_name}
                onChange={(e) => setForm({ ...form, vendor_name: e.target.value })}
                placeholder={t("defect.placeholder_vendor_name")}
              />
            </div>

            <p className="sm:col-span-2 text-xs text-muted-foreground">{t("defect.photo_hint")}</p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button
              onClick={() => saveMutation.mutate({ ...form, id: editingId })}
              disabled={saveMutation.isPending || (!form.defect_category.trim() && !form.detail_item.trim())}
            >
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo lightbox — shared viewer (name / size / dimensions + copy, download, delete). */}
      <ImagePreviewDialog config={imagePreview} onClose={closeImagePreview} />
    </div>
  );
}

export default SpaceDefectsPanel;
