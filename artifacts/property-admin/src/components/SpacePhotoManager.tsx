import { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch, getStoredToken } from "@/lib/apiFetch";
import { ImagePlus, Star, Trash2, Upload, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ImagePreviewDialog, useImagePreview, type PreviewImage } from "@/components/ImagePreviewDialog";
import { filesFromDataTransfer } from "@/components/FileDropZone";
import { CameraButton } from "@/components/CameraButton";

function apiFetchMultipart(path: string, body: FormData): Promise<Response> {
  const token = getStoredToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(path, { method: "POST", headers, body });
}

interface SpaceImage {
  id: number;
  space_id: number;
  file_url: string;
  thumbnail_url: string | null;
  cloudinary_id: string | null;
  caption: string | null;
  is_primary: boolean;
  display_order: number;
  file_size_bytes: number | null;
  mime_type: string | null;
  created_at: string;
}

interface SpacePhotoManagerProps {
  spaceId: number;
}

export function SpacePhotoManager({ spaceId }: SpacePhotoManagerProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { imagePreview, openImagePreview, closeImagePreview } = useImagePreview();
  const pasteArmed = useRef(false);

  const [images, setImages] = useState<SpaceImage[]>([]);
  const [imageSource, setImageSource] = useState<"own" | "parent" | "property">("own");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [captionEdits, setCaptionEdits] = useState<Record<number, string>>({});
  const [savingCaption, setSavingCaption] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [settingPrimaryId, setSettingPrimaryId] = useState<number | null>(null);

  async function fetchImages() {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/v1/spaces/${spaceId}/images`);
      const data = await res.json();
      if (data.success) {
        setImages(data.data);
        setImageSource(data.source ?? "own");
        const edits: Record<number, string> = {};
        for (const img of data.data) edits[img.id] = img.caption ?? "";
        setCaptionEdits(edits);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchImages(); }, [spaceId]);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  /** Drop — a folder of photos is walked so the whole tree is staged at once. */
  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    stageFiles(await filesFromDataTransfer(e.dataTransfer));
  }

  function stageFiles(files: File[]) {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length > 0) setPendingFiles((prev) => [...prev, ...images]);
  }

  // ⌘/Ctrl+V with photos copied in Finder/Explorer, while the pointer is on the
  // drop area — the same gesture the rest of the admin uses.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (!pasteArmed.current || uploading) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input:not([type='file']), textarea, [contenteditable='true']")) return;
      const files = Array.from(e.clipboardData?.files ?? []);
      if (!files.length) return;
      e.preventDefault();
      stageFiles(files);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [uploading]);

  // 현장에서 폰으로 찍어 바로 올린다 — 갤러리를 거치지 않는다.
  function handleCapture(files: File[]) {
    stageFiles(files);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    stageFiles(Array.from(e.target.files ?? []));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleUpload() {
    if (pendingFiles.length === 0) return;
    setUploading(true);
    setUploadProgress(`Uploading ${pendingFiles.length} photo(s)...`);
    try {
      const formData = new FormData();
      for (const file of pendingFiles) formData.append("images", file);
      const res = await apiFetchMultipart(`/api/v1/spaces/${spaceId}/images`, formData);
      if (res.ok) {
        setPendingFiles([]);
        setUploadProgress(null);
        await fetchImages();
      } else {
        const err = await res.json();
        setUploadProgress(`Error: ${err.error ?? "Upload failed"}`);
      }
    } catch (err) {
      setUploadProgress("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSetPrimary(imageId: number) {
    setSettingPrimaryId(imageId);
    try {
      await apiFetch(`/api/v1/spaces/${spaceId}/images/${imageId}/set-primary`, { method: "PATCH" });
      await fetchImages();
    } finally {
      setSettingPrimaryId(null);
    }
  }

  async function handleDelete(imageId: number) {
    if (!confirm("Delete this photo? This cannot be undone.")) return;
    await deleteImage(imageId);
  }

  /** Delete without confirming — the caller already asked. */
  async function deleteImage(imageId: number) {
    setDeletingId(imageId);
    try {
      await apiFetch(`/api/v1/spaces/${spaceId}/images/${imageId}`, { method: "DELETE" });
      await fetchImages();
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSaveCaption(imageId: number) {
    setSavingCaption(imageId);
    try {
      await apiFetch(`/api/v1/spaces/${spaceId}/images/${imageId}`, {
        method: "PUT",
        body: JSON.stringify({ caption: captionEdits[imageId] ?? "" }),
      });
      await fetchImages();
    } finally {
      setSavingCaption(null);
    }
  }

  /** The whole album, so the preview dialog can page through it. */
  function previewImages(): PreviewImage[] {
    return images.map((img) => ({
      url: img.file_url,
      thumbnailUrl: img.thumbnail_url,
      name: img.caption?.trim() || undefined,
      bytes: img.file_size_bytes,
      createdAt: img.created_at,
      ...(isFallback ? {} : { onDelete: () => deleteImage(img.id) }),
    }));
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("space_photos.loading")}
      </div>
    );
  }

  const isFallback = imageSource !== "own";

  return (
    <div className="max-w-4xl space-y-6">
      {isFallback && images.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="mt-0.5 shrink-0 text-amber-500">⚠</span>
          <span>
            {imageSource === "parent"
              ? "이 스페이스에 등록된 사진이 없습니다. 상위(부모) 스페이스의 사진을 표시하고 있습니다."
              : "이 스페이스에 등록된 사진이 없습니다. 동일 Property의 대표 스페이스 사진을 표시하고 있습니다."}
            {" "}아래에서 사진을 업로드하면 이 스페이스 전용으로 저장됩니다.
          </span>
        </div>
      )}

      <div
        onMouseEnter={() => { pasteArmed.current = true; }}
        onMouseLeave={() => { pasteArmed.current = false; }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={(e) => void handleDrop(e)}
        onClick={() => !pendingFiles.length && fileInputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer",
          isDragging ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:border-blue-400 hover:bg-slate-50",
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
        <ImagePlus className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm font-medium text-slate-700">{t("space_photos.dropzone")}</p>
        <p className="text-xs text-muted-foreground mt-1">{t("space_photos.formats")}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {t("file_drop.hint", "Drag files or a folder here, or press ⌘/Ctrl+V to paste them")}
        </p>
      </div>

      {/* 폰에서는 끌어다 놓을 수 없다 — 현장에서는 촬영이 첫 번째 경로다. */}
      <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
        <CameraButton
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-60"
          onCapture={handleCapture}
        />
      </div>

      {pendingFiles.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-800">{t("space_photos.ready_count", { count: pendingFiles.length })}</p>
            <p className="text-xs text-primary mt-0.5">{pendingFiles.map((f) => f.name).join(", ")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-primary" onClick={() => setPendingFiles([])}>
              {t("common.clear")}
            </Button>
            <Button size="sm" className="gap-1.5" onClick={handleUpload} disabled={uploading}>
              {uploading ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" />{uploadProgress}</>
              ) : (
                <><Upload className="h-3.5 w-3.5" />Upload {pendingFiles.length} photo(s)</>
              )}
            </Button>
          </div>
        </div>
      )}

      {uploadProgress && !uploading && (
        <div className="text-sm text-muted-foreground bg-slate-50 border rounded-lg px-4 py-3">
          {uploadProgress}
        </div>
      )}

      {images.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No photos uploaded yet. Drag & drop or click the area above to add photos.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {images.map((image) => (
            <div
              key={image.id}
              className={cn(
                "rounded-xl border overflow-hidden bg-card shadow-sm transition-all",
                image.is_primary && "ring-2 ring-primary",
              )}
            >
              <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                <img
                  src={image.thumbnail_url ?? image.file_url}
                  alt={image.caption ?? "Space photo"}
                  className="w-full h-full object-cover cursor-zoom-in transition-opacity hover:opacity-90"
                  onClick={() => openImagePreview(previewImages(), images.indexOf(image))}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                {image.is_primary && (
                  <div className="absolute top-2 left-2 flex items-center gap-1 bg-primary text-white text-xs font-medium px-2 py-0.5 rounded-full">
                    <Star className="h-3 w-3 fill-white" /> {t("space_photos.primary")}
                  </div>
                )}
              </div>

              {!isFallback && (
                <div className="p-3 space-y-3">
                  <div className="flex gap-1.5">
                    <Input
                      value={captionEdits[image.id] ?? ""}
                      onChange={(e) => setCaptionEdits((prev) => ({ ...prev, [image.id]: e.target.value }))}
                      placeholder={t("space_photos.caption_placeholder")}
                      className="h-8 text-xs"
                    />
                    {captionEdits[image.id] !== (image.caption ?? "") && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 shrink-0"
                        onClick={() => handleSaveCaption(image.id)}
                        disabled={savingCaption === image.id}
                      >
                        {savingCaption === image.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                        }
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {!image.is_primary && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-7 text-xs gap-1"
                        onClick={() => handleSetPrimary(image.id)}
                        disabled={settingPrimaryId === image.id}
                      >
                        {settingPrimaryId === image.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Star className="h-3 w-3" />
                        }
                        Set Primary
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 gap-1 ml-auto"
                      onClick={() => handleDelete(image.id)}
                      disabled={deletingId === image.id}
                    >
                      {deletingId === image.id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Trash2 className="h-3 w-3" />
                      }
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ImagePreviewDialog config={imagePreview} onClose={closeImagePreview} />
    </div>
  );
}
