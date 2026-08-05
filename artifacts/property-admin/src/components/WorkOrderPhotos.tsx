import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch, getStoredToken } from "@/lib/apiFetch";
import { cn } from "@/lib/utils";
import { Camera, ImagePlus, Loader2, Trash2, Upload, X } from "lucide-react";

export interface StagedPhoto {
  file: File;
  kind: "before" | "after";
  caption: string;
  previewUrl: string;
}

interface WorkOrderPhoto {
  id: number;
  work_order_id: number;
  url: string;
  kind: string;
  uploaded_by_type: string;
  caption: string | null;
  created_at: string;
}

/** Uploads staged files to a freshly-created work order. Used by the "new" form. */
export async function uploadStagedPhotos(workOrderId: number, staged: StagedPhoto[]): Promise<void> {
  const token = getStoredToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  for (const p of staged) {
    const fd = new FormData();
    fd.append("images", p.file);
    fd.append("kind", p.kind);
    if (p.caption) fd.append("caption", p.caption);
    await fetch(`/api/v1/work-orders/${workOrderId}/photos`, { method: "POST", headers, body: fd });
  }
}

interface Props {
  /** Existing work order — omit while creating a new one. */
  workOrderId?: number;
  /** Staged photos for the create flow (uploaded right after the work order exists). */
  staged?: StagedPhoto[];
  onStagedChange?: (next: StagedPhoto[]) => void;
}

export function WorkOrderPhotos({ workOrderId, staged, onStagedChange }: Props) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isNew = !workOrderId;

  const [photos, setPhotos] = useState<WorkOrderPhoto[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [kind, setKind] = useState<"before" | "after">("before");
  const [caption, setCaption] = useState("");
  const [pending, setPending] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  async function fetchPhotos() {
    if (!workOrderId) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/v1/work-orders/${workOrderId}/photos`);
      const body = await res.json();
      if (body?.success) setPhotos(body.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void fetchPhotos(); }, [workOrderId]);

  function addFiles(files: File[]) {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;
    if (isNew) {
      onStagedChange?.([
        ...(staged ?? []),
        ...images.map((file) => ({ file, kind, caption, previewUrl: URL.createObjectURL(file) })),
      ]);
    } else {
      setPending((prev) => [...prev, ...images]);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(e.target.files ?? []));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }

  async function handleUpload() {
    if (!workOrderId || pending.length === 0) return;
    setUploading(true); setError(null);
    try {
      const token = getStoredToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const fd = new FormData();
      for (const f of pending) fd.append("images", f);
      fd.append("kind", kind);
      if (caption) fd.append("caption", caption);
      const res = await fetch(`/api/v1/work-orders/${workOrderId}/photos`, { method: "POST", headers, body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? t("workorder.photos_upload_failed", "Upload failed"));
      }
      setPending([]); setCaption("");
      await fetchPhotos();
    } catch (e: any) {
      setError(e?.message ?? t("workorder.photos_upload_failed", "Upload failed"));
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(photoId: number) {
    if (!workOrderId) return;
    if (!confirm(t("workorder.photos_delete_confirm", "Delete this photo?"))) return;
    setDeletingId(photoId);
    try {
      await apiFetch(`/api/v1/work-orders/${workOrderId}/photos/${photoId}`, { method: "DELETE" });
      await fetchPhotos();
    } finally {
      setDeletingId(null);
    }
  }

  function removeStaged(index: number) {
    const next = [...(staged ?? [])];
    const [gone] = next.splice(index, 1);
    if (gone) URL.revokeObjectURL(gone.previewUrl);
    onStagedChange?.(next);
  }

  const kindLabel = (k: string) =>
    k === "before" ? t("workorder.photo_kind_before", "Before") : t("workorder.photo_kind_after", "After");

  return (
    <div className="border rounded-lg bg-white p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <h2 className="text-sm font-semibold uppercase text-primary tracking-wide flex items-center gap-1.5">
          <Camera className="h-4 w-4" /> {t("workorder.section_photos", "Photos")}
        </h2>
        <span className="text-xs text-muted-foreground">
          {isNew ? (staged?.length ?? 0) : photos.length} {t("workorder.photos_unit", "photo(s)")}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <div>
          <Label>{t("workorder.label_photo_kind", "Photo type")}</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as "before" | "after")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="before">{t("workorder.photo_kind_before", "Before")}</SelectItem>
              <SelectItem value="after">{t("workorder.photo_kind_after", "After")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t("workorder.label_photo_caption", "Caption")}</Label>
          <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder={t("workorder.ph_photo_caption", "e.g. Bathroom leak, living room after repair")} />
        </div>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer",
          isDragging ? "border-primary bg-primary/5" : "border-slate-300 hover:border-primary/60 hover:bg-slate-50",
        )}
      >
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
        <ImagePlus className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm font-medium text-slate-700">{t("workorder.photos_dropzone", "Drag & drop photos here, or click to choose")}</p>
        <p className="text-xs text-muted-foreground mt-1">{t("workorder.photos_formats", "JPG, PNG, WEBP · up to 10MB each")}</p>
      </div>

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      {/* Create flow — staged, uploaded as soon as the work order is saved. */}
      {isNew && (staged?.length ?? 0) > 0 && (
        <>
          <p className="text-xs text-muted-foreground mt-4">
            {t("workorder.photos_staged_hint", "These photos are uploaded when you save the work order.")}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-2">
            {(staged ?? []).map((p, i) => (
              <div key={`${p.file.name}-${i}`} className="rounded-lg border overflow-hidden bg-card">
                <div className="relative aspect-[4/3] bg-slate-100">
                  <img src={p.previewUrl} alt={p.caption || p.file.name} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeStaged(i)}
                    className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                    {kindLabel(p.kind)}
                  </span>
                </div>
                {p.caption && <p className="p-2 text-xs text-muted-foreground truncate">{p.caption}</p>}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Existing work order — queued files awaiting upload. */}
      {!isNew && pending.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-primary truncate">{pending.map((f) => f.name).join(", ")}</p>
          <div className="flex items-center gap-2 ml-auto">
            <Button type="button" variant="ghost" size="sm" onClick={() => setPending([])}>{t("common.clear", "Clear")}</Button>
            <Button type="button" size="sm" className="gap-1.5" onClick={handleUpload} disabled={uploading}>
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {t("workorder.photos_upload_n", "Upload {{count}}", { count: pending.length })}
            </Button>
          </div>
        </div>
      )}

      {!isNew && (
        loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading", "Loading…")}
          </div>
        ) : photos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {t("workorder.photos_empty", "No photos yet.")}
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-4">
            {photos.map((p) => (
              <div key={p.id} className="rounded-lg border overflow-hidden bg-card">
                <a href={p.url} target="_blank" rel="noreferrer" className="block relative aspect-[4/3] bg-slate-100">
                  <img src={p.url} alt={p.caption ?? kindLabel(p.kind)} className="w-full h-full object-cover" />
                  <span className={cn(
                    "absolute bottom-1.5 left-1.5 rounded px-1.5 py-0.5 text-[10px] text-white",
                    p.kind === "before" ? "bg-slate-700/80" : "bg-green-700/80",
                  )}>
                    {kindLabel(p.kind)}
                  </span>
                </a>
                <div className="p-2 flex items-center gap-2">
                  <p className="text-xs text-muted-foreground truncate flex-1">{p.caption ?? ""}</p>
                  <Button
                    type="button" size="sm" variant="ghost"
                    className="h-7 px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDelete(p.id)}
                    disabled={deletingId === p.id}
                  >
                    {deletingId === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
