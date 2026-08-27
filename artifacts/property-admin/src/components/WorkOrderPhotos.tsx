/**
 * 작업 지시서 사진 — 작업 전 / 작업 후를 따로 올리고 따로 본다.
 *
 * 두 구역은 완전히 분리돼 있다. 한 번의 업로드가 한 **회차(세션)** 라서, 같은
 * 세대를 두 번 방문하면 `작업 전 1차` / `작업 전 2차` 로 나뉘어 남는다. 예전처럼
 * 한 덩어리로 섞여 있으면 "이 사진이 언제 찍힌 건지"를 캡션에 적어 두는 수밖에
 * 없었다.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch, getStoredToken } from "@/lib/apiFetch";
import { formatDateTime } from "@/lib/date";
import { cn } from "@/lib/utils";
import { Camera, ImagePlus, Loader2, Trash2, Upload, X } from "lucide-react";
import { ImagePreviewDialog, useImagePreview, type PreviewImage } from "@/components/ImagePreviewDialog";

export type PhotoKind = "before" | "after";
const KINDS: PhotoKind[] = ["before", "after"];

export interface StagedPhoto {
  file: File;
  kind: PhotoKind;
  caption: string;
  previewUrl: string;
}

interface WorkOrderPhoto {
  id: number;
  work_order_id: number;
  url: string;
  kind: string;
  session_no: number;
  uploaded_by_type: string;
  caption: string | null;
  created_at: string;
}

/**
 * 새 작업 지시서 저장 직후 스테이징된 사진을 올린다. **전/후별로 한 번씩만**
 * 호출한다 — 파일마다 POST 하면 파일 수만큼 회차가 생겨 버린다.
 */
export async function uploadStagedPhotos(workOrderId: number, staged: StagedPhoto[]): Promise<void> {
  const token = getStoredToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  for (const kind of KINDS) {
    const group = staged.filter((p) => p.kind === kind);
    if (group.length === 0) continue;
    const fd = new FormData();
    // 사진 순서와 설명 순서가 짝이 맞아야 워터마크가 엉키지 않는다.
    for (const p of group) fd.append("images", p.file);
    for (const p of group) fd.append("captions", p.caption ?? "");
    fd.append("kind", kind);
    await fetch(`/api/v1/work-orders/${workOrderId}/photos`, { method: "POST", headers, body: fd });
  }
}

interface Props {
  /** 기존 작업 지시서 — 신규 작성 중이면 비운다. */
  workOrderId?: number;
  /** 신규 작성 흐름에서 대기 중인 사진(저장 직후 업로드된다). */
  staged?: StagedPhoto[];
  onStagedChange?: (next: StagedPhoto[]) => void;
}

export function WorkOrderPhotos({ workOrderId, staged, onStagedChange }: Props) {
  const { t } = useTranslation();
  const isNew = !workOrderId;

  const [photos, setPhotos] = useState<WorkOrderPhoto[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [deletingId, setDeletingId] = useState<number | null>(null);

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

  async function handleDelete(photoId: number) {
    if (!confirm(t("workorder.photos_delete_confirm", "Delete this photo?"))) return;
    await deletePhoto(photoId);
  }

  /** Delete without confirming — the caller already asked. */
  async function deletePhoto(photoId: number) {
    if (!workOrderId) return;
    setDeletingId(photoId);
    try {
      await apiFetch(`/api/v1/work-orders/${workOrderId}/photos/${photoId}`, { method: "DELETE" });
      await fetchPhotos();
    } finally {
      setDeletingId(null);
    }
  }

  const total = isNew ? (staged?.length ?? 0) : photos.length;

  return (
    <div className="border rounded-lg bg-white p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <h2 className="text-sm font-semibold uppercase text-primary tracking-wide flex items-center gap-1.5">
          <Camera className="h-4 w-4" /> {t("workorder.section_photos", "Photos")}
        </h2>
        <span className="text-xs text-muted-foreground">
          {total} {t("workorder.photos_unit", "photo(s)")}
        </span>
      </div>

      <div className="space-y-6">
        {KINDS.map((kind) => (
          <PhotoKindSection
            key={kind}
            kind={kind}
            workOrderId={workOrderId}
            photos={photos.filter((p) => p.kind === kind)}
            loading={loading}
            staged={staged}
            onStagedChange={onStagedChange}
            onUploaded={fetchPhotos}
            onDelete={handleDelete}
            onDeleteConfirmed={deletePhoto}
            deletingId={deletingId}
          />
        ))}
      </div>
    </div>
  );
}

/** 한 구역(작업 전 또는 작업 후) — 자체 업로드 영역 + 회차별 갤러리. */
function PhotoKindSection({
  kind, workOrderId, photos, loading, staged, onStagedChange, onUploaded, onDelete, onDeleteConfirmed, deletingId,
}: {
  kind: PhotoKind;
  workOrderId?: number;
  photos: WorkOrderPhoto[];
  loading: boolean;
  staged?: StagedPhoto[];
  onStagedChange?: (next: StagedPhoto[]) => void;
  onUploaded: () => Promise<void>;
  onDelete: (photoId: number) => void;
  /** Delete without a confirm prompt — the image preview dialog asks its own. */
  onDeleteConfirmed: (photoId: number) => Promise<void> | void;
  deletingId: number | null;
}) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { imagePreview, openImagePreview, closeImagePreview } = useImagePreview();
  const isNew = !workOrderId;

  const [caption, setCaption] = useState("");
  const [pending, setPending] = useState<Array<{ file: File; caption: string; previewUrl: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const stagedHere = (staged ?? []).filter((p) => p.kind === kind);

  const title = kind === "before"
    ? t("workorder.photo_kind_before", "Before")
    : t("workorder.photo_kind_after", "After");

  // 회차별로 접어 둔다. 한 번의 업로드가 한 회차이므로 시각은 첫 사진 기준.
  const sessions = useMemo(() => {
    const map = new Map<number, WorkOrderPhoto[]>();
    for (const p of photos) {
      const list = map.get(p.session_no) ?? [];
      list.push(p);
      map.set(p.session_no, list);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [photos]);

  /** Every photo in this section, session order — so the viewer can page through. */
  function previewPhotos(): PreviewImage[] {
    return sessions.flatMap(([, group]) =>
      group.map((p) => ({
        url: p.url,
        name: p.caption?.trim() || undefined,
        createdAt: p.created_at,
        onDelete: () => onDeleteConfirmed(p.id),
      })),
    );
  }

  /** Index of a photo inside the flattened session order. */
  function previewIndex(photo: WorkOrderPhoto): number {
    return sessions.flatMap(([, group]) => group).findIndex((p) => p.id === photo.id);
  }

  function addFiles(files: File[]) {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;
    if (isNew) {
      onStagedChange?.([
        ...(staged ?? []),
        ...images.map((file) => ({ file, kind, caption, previewUrl: URL.createObjectURL(file) })),
      ]);
    } else {
      setPending((prev) => [...prev, ...images.map((file) => ({ file, caption, previewUrl: URL.createObjectURL(file) }))]);
    }
  }

  async function handleUpload() {
    if (!workOrderId || pending.length === 0) return;
    setUploading(true); setError(null);
    try {
      const token = getStoredToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      // 이 묶음 전체가 한 회차로 들어간다(서버가 다음 번호를 매긴다).
      const fd = new FormData();
      for (const p of pending) fd.append("images", p.file);
      for (const p of pending) fd.append("captions", p.caption ?? "");
      fd.append("kind", kind);
      if (caption) fd.append("caption", caption);
      const res = await fetch(`/api/v1/work-orders/${workOrderId}/photos`, { method: "POST", headers, body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? t("workorder.photos_upload_failed", "Upload failed"));
      }
      pending.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      setPending([]); setCaption("");
      await onUploaded();
    } catch (e: any) {
      setError(e?.message ?? t("workorder.photos_upload_failed", "Upload failed"));
    } finally {
      setUploading(false);
    }
  }

  function removeStaged(target: StagedPhoto) {
    const next = (staged ?? []).filter((p) => p !== target);
    URL.revokeObjectURL(target.previewUrl);
    onStagedChange?.(next);
  }

  const count = isNew ? stagedHere.length : photos.length;

  return (
    <section className="rounded-lg border bg-slate-50/60 p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", kind === "before" ? "bg-slate-500" : "bg-green-600")} />
          {title}
        </h3>
        <span className="text-xs text-muted-foreground">
          {isNew
            ? `${count} ${t("workorder.photos_unit", "photo(s)")}`
            : t("workorder.photos_sessions_count", "{{sessions}} session(s) · {{count}} photo(s)", { sessions: sessions.length, count })}
        </span>
      </div>

      <Input
        className="mb-2 bg-white"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder={t("workorder.ph_photo_session_caption", "Default note for photos added next (optional)")}
      />

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); addFiles(Array.from(e.dataTransfer.files)); }}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-xl p-4 text-center transition-colors cursor-pointer bg-white",
          isDragging ? "border-primary bg-primary/5" : "border-slate-300 hover:border-primary/60 hover:bg-slate-50",
        )}
      >
        <input
          ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => { addFiles(Array.from(e.target.files ?? [])); if (fileInputRef.current) fileInputRef.current.value = ""; }}
        />
        <ImagePlus className="h-6 w-6 mx-auto mb-1.5 text-muted-foreground" />
        <p className="text-sm font-medium text-slate-700">
          {t("workorder.photos_dropzone_kind", "Add {{kind}} photos — drag & drop or click", { kind: title })}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isNew
            ? t("workorder.photos_formats", "JPG, PNG, WEBP · up to 10MB each")
            : t("workorder.photos_session_hint", "Each upload is saved as its own session.")}
        </p>
      </div>

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      {/* 신규 작성 — 저장과 함께 올라간다. */}
      {isNew && stagedHere.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground mt-3">
            {t("workorder.photos_staged_hint", "These photos are uploaded when you save the work order.")}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-2">
            {stagedHere.map((p, i) => (
              <div key={`${p.file.name}-${i}`} className="rounded-lg border overflow-hidden bg-card">
                <div className="relative aspect-[4/3] bg-slate-100">
                  <img src={p.previewUrl} alt={p.caption || p.file.name} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeStaged(p)}
                    className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <Input
                  className="border-0 border-t rounded-none text-xs h-9"
                  value={p.caption}
                  onChange={(e) => onStagedChange?.((staged ?? []).map((q) => (q === p ? { ...q, caption: e.target.value } : q)))}
                  placeholder={t("workorder.ph_photo_caption", "Photo note (e.g. toilet re-cemented)")}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {/* 기존 작업 지시서 — 업로드 대기열. 사진마다 설명을 달아 올린다. */}
      {!isNew && pending.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3 space-y-3">
          <p className="text-xs text-primary">
            {t("workorder.photos_caption_hint", "The date, property/unit and this note are burned onto each photo as a watermark.")}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pending.map((p, i) => (
              <div key={`${p.file.name}-${i}`} className="rounded-lg border bg-white overflow-hidden">
                <div className="relative aspect-[4/3] bg-slate-100">
                  <img src={p.previewUrl} alt={p.file.name} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => { URL.revokeObjectURL(p.previewUrl); setPending((prev) => prev.filter((_, j) => j !== i)); }}
                    className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <Input
                  className="border-0 border-t rounded-none text-xs h-9"
                  value={p.caption}
                  onChange={(e) => setPending((prev) => prev.map((q, j) => (j === i ? { ...q, caption: e.target.value } : q)))}
                  placeholder={t("workorder.ph_photo_caption", "Photo note (e.g. toilet re-cemented)")}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => { pending.forEach((p) => URL.revokeObjectURL(p.previewUrl)); setPending([]); }}>{t("common.clear", "Clear")}</Button>
            <Button type="button" size="sm" className="gap-1.5" onClick={handleUpload} disabled={uploading}>
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {t("workorder.photos_upload_as_session", "Upload as session {{n}}", { n: sessions.length + 1 })}
            </Button>
          </div>
        </div>
      )}

      {!isNew && (
        loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading", "Loading…")}
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t("workorder.photos_empty_kind", "No {{kind}} photos yet.", { kind: title })}
          </p>
        ) : (
          <div className="mt-3 space-y-4">
            {sessions.map(([no, group]) => (
              <div key={no}>
                <div className="flex items-baseline gap-2 mb-1.5">
                  <span className="text-xs font-medium text-slate-700">
                    {t("workorder.photo_session_no", "Session {{n}}", { n: no })}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {group[0]?.created_at ? formatDateTime(group[0].created_at) : ""}
                  </span>
                  {group[0]?.caption && (
                    <span className="text-[11px] text-muted-foreground truncate">· {group[0].caption}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {group.map((p) => (
                    <div key={p.id} className="rounded-lg border overflow-hidden bg-card">
                      <button
                        type="button"
                        onClick={() => openImagePreview(previewPhotos(), previewIndex(p))}
                        className="block w-full relative aspect-[4/3] bg-slate-100 cursor-zoom-in"
                      >
                        <img src={p.url} alt={p.caption ?? title} className="w-full h-full object-cover" />
                      </button>
                      <div className="p-2 flex items-center gap-2">
                        <p className="text-xs text-muted-foreground truncate flex-1">{p.caption ?? ""}</p>
                        <Button
                          type="button" size="sm" variant="ghost"
                          className="h-7 px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => onDelete(p.id)}
                          disabled={deletingId === p.id}
                        >
                          {deletingId === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      <ImagePreviewDialog config={imagePreview} onClose={closeImagePreview} />
    </section>
  );
}
