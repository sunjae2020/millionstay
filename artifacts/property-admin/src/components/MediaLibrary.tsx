import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload, Copy, Trash2, ImageOff, Check, Download, FolderInput, X } from "lucide-react";
import { FileDropZone } from "@/components/FileDropZone";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch, apiJson } from "@/lib/apiFetch";
import { CameraInput } from "@/components/CameraButton";
import {
  ImagePreviewDialog,
  useImagePreview,
  downloadImage,
  fileNameFromUrl,
  formatBytes,
  type PreviewImage,
} from "@/components/ImagePreviewDialog";

// Folders exposed in the library — must match the api-server ALLOWED_FOLDERS.
export const MEDIA_FOLDERS = ["content", "spaces", "listings", "branding"] as const;
export type MediaTopFolder = (typeof MEDIA_FOLDERS)[number];

// The website bucket is split into sub-folders so marketing assets stay sorted.
// Keep in sync with CONTENT_SUBFOLDERS in api-server/src/routes/media.ts.
export const CONTENT_SUBFOLDERS = [
  "brand",
  "hero",
  "programs",
  "team",
  "gallery",
  "blog",
  "icons",
] as const;
export type ContentSubfolder = (typeof CONTENT_SUBFOLDERS)[number];

/** A browsable folder path, e.g. "spaces" or "content/hero". */
export type MediaFolder = MediaTopFolder | `content/${ContentSubfolder}`;

/** Every folder an asset may be moved into — the same list the API allows. */
export const ALL_MEDIA_FOLDERS: MediaFolder[] = [
  "content",
  ...CONTENT_SUBFOLDERS.map((s) => `content/${s}` as MediaFolder),
  "spaces",
  "listings",
  "branding",
];

export interface MediaResource {
  public_id: string;
  secure_url: string;
  thumbnail_url: string;
  format: string;
  bytes: number;
  width: number;
  height: number;
  created_at: string;
}

/**
 * Reusable media grid. In "manage" mode each tile offers copy-URL and delete;
 * in "pick" mode clicking a tile calls onPick(url). Both modes support folder
 * switching and drag-free file upload into the current folder.
 */
export function MediaGrid({
  mode,
  onPick,
  initialFolder = "content",
}: {
  mode: "manage" | "pick";
  onPick?: (url: string) => void;
  initialFolder?: MediaFolder;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [folder, setFolder] = useState<MediaFolder>(initialFolder);
  const topFolder = (folder.split("/")[0] ?? "content") as MediaTopFolder;
  const subFolder = folder.startsWith("content/") ? (folder.slice("content/".length) as ContentSubfolder) : null;
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState<null | "delete" | "download" | "move">(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { imagePreview, openImagePreview, closeImagePreview } = useImagePreview();

  const queryKey = ["media", folder];
  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () =>
      apiJson<{ resources: MediaResource[]; next_cursor: string | null }>(
        `/api/v1/media?folder=${encodeURIComponent(folder)}`,
      ),
  });

  // Folder switch clears the selection — the ids no longer belong to the list.
  useEffect(() => setSelected([]), [folder]);

  const deleteMutation = useMutation({
    mutationFn: (publicId: string) =>
      apiFetch("/api/v1/media", { method: "DELETE", body: JSON.stringify({ public_id: publicId }) }).then((r) => {
        if (!r.ok) throw new Error("delete failed");
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: t("media.toast_deleted") });
    },
    onError: () =>
      toast({ variant: "destructive", title: t("media.toast_delete_failed_title"), description: t("media.toast_delete_failed_desc") }),
  });

  const handleUpload = async (input: FileList | File[] | null) => {
    // Dropped folders arrive flattened, so anything that is not an image (a
    // stray .DS_Store, a PDF) is dropped before it reaches Cloudinary.
    const files = (input ? Array.from(input) : []).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("image", file);
        fd.append("folder", folder);
        const res = await apiFetch("/api/v1/media/upload", { method: "POST", body: fd });
        if (!res.ok) throw new Error("upload failed");
      }
      qc.invalidateQueries({ queryKey });
      toast({ title: t("media.toast_uploaded") });
    } catch {
      toast({ variant: "destructive", title: t("media.toast_upload_failed_title"), description: t("media.toast_upload_failed_desc") });
    } finally {
      setUploading(false);
    }
  };

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      window.setTimeout(() => setCopied((c) => (c === url ? null : c)), 1500);
    } catch {
      toast({ variant: "destructive", title: t("media.toast_copy_failed") });
    }
  };

  const resources = data?.resources ?? [];
  const selectedSet = new Set(selected);
  const allSelected = resources.length > 0 && selected.length === resources.length;

  const toggleOne = (publicId: string) =>
    setSelected((prev) => (prev.includes(publicId) ? prev.filter((id) => id !== publicId) : [...prev, publicId]));
  const toggleAll = () => setSelected(allSelected ? [] : resources.map((r) => r.public_id));

  const folderLabel = (f: MediaFolder) =>
    f.startsWith("content/")
      ? `${t("media.folder_content")} / ${t(`media.subfolder_${f.slice("content/".length)}`)}`
      : t(`media.folder_${f}`);

  const previewList = (): PreviewImage[] =>
    resources.map((r) => ({
      url: r.secure_url,
      thumbnailUrl: r.thumbnail_url,
      name: fileNameFromUrl(r.public_id) + (r.format ? `.${r.format}` : ""),
      bytes: r.bytes,
      width: r.width,
      height: r.height,
      createdAt: r.created_at,
      onDelete: async () => {
        await deleteMutation.mutateAsync(r.public_id);
        setSelected((prev) => prev.filter((id) => id !== r.public_id));
      },
    }));

  const bulkDelete = async () => {
    if (!window.confirm(t("media.confirm_bulk_delete", { count: selected.length }))) return;
    setBulkBusy("delete");
    try {
      const res = await apiFetch("/api/v1/media/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ public_ids: selected }),
      });
      if (!res.ok) throw new Error("bulk delete failed");
      const out = (await res.json()) as { deleted: number; failed: string[] };
      setSelected([]);
      qc.invalidateQueries({ queryKey });
      toast({
        title: t("media.toast_bulk_deleted", { count: out.deleted }),
        ...(out.failed?.length ? { description: t("media.toast_bulk_partial", { count: out.failed.length }) } : {}),
      });
    } catch {
      toast({ variant: "destructive", title: t("media.toast_delete_failed_title"), description: t("media.toast_delete_failed_desc") });
    } finally {
      setBulkBusy(null);
    }
  };

  const bulkDownload = async () => {
    setBulkBusy("download");
    try {
      for (const r of resources.filter((x) => selectedSet.has(x.public_id))) {
        await downloadImage(r.secure_url, `${fileNameFromUrl(r.public_id)}.${r.format}`);
        // Browsers throttle a burst of downloads; a short gap keeps them all.
        await new Promise((resolve) => window.setTimeout(resolve, 350));
      }
    } catch {
      toast({ variant: "destructive", title: t("media.toast_download_failed") });
    } finally {
      setBulkBusy(null);
    }
  };

  const bulkMove = async (target: string) => {
    setBulkBusy("move");
    try {
      const res = await apiFetch("/api/v1/media/move", {
        method: "POST",
        body: JSON.stringify({ public_ids: selected, folder: target }),
      });
      if (!res.ok) throw new Error("move failed");
      const out = (await res.json()) as { moved: unknown[]; failed: string[] };
      setSelected([]);
      qc.invalidateQueries({ queryKey: ["media"] });
      toast({
        title: t("media.toast_moved", { count: out.moved.length, folder: folderLabel(target as MediaFolder) }),
        ...(out.failed?.length ? { description: t("media.toast_bulk_partial", { count: out.failed.length }) } : {}),
      });
    } catch {
      toast({ variant: "destructive", title: t("media.toast_move_failed") });
    } finally {
      setBulkBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={topFolder} onValueChange={(v) => setFolder(v as MediaFolder)}>
          <TabsList>
            {MEDIA_FOLDERS.map((f) => (
              <TabsTrigger key={f} value={f}>
                {t(`media.folder_${f}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              handleUpload(e.target.files);
              e.target.value = "";
            }}
          />
          {/* 폰에서는 찍는 것이 곧 첨부다. 같은 핸들러로 들어간다. */}
          <CameraInput onChange={(e) => {
              handleUpload(e.target.files);
              e.target.value = "";
            }} />
          <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span className="ml-1.5">{t("media.upload")}</span>
          </Button>
        </div>
      </div>

      {topFolder === "content" && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setFolder("content")}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              subFolder === null
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            {t("media.subfolder_all")}
          </button>
          {CONTENT_SUBFOLDERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFolder(`content/${s}`)}
              title={t(`media.subfolder_${s}_hint`)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                subFolder === s
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              {t(`media.subfolder_${s}`)}
            </button>
          ))}
        </div>
      )}

      {mode === "manage" && resources.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label={t("media.select_all")} />
            {t("media.select_all")}
          </label>
          {selected.length > 0 && (
            <>
              <span className="text-xs font-medium">{t("media.selected_count", { count: selected.length })}</span>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={bulkDownload} disabled={!!bulkBusy}>
                  {bulkBusy === "download" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                  {t("media.bulk_download")}
                </Button>
                <Select value="" onValueChange={bulkMove} disabled={!!bulkBusy}>
                  <SelectTrigger className="h-8 w-[190px] text-xs">
                    <span className="flex items-center gap-1.5">
                      {bulkBusy === "move" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderInput className="h-3.5 w-3.5" />}
                      <SelectValue placeholder={t("media.bulk_move")} />
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_MEDIA_FOLDERS.filter((f) => f !== folder).map((f) => (
                      <SelectItem key={f} value={f} className="text-xs">
                        {folderLabel(f)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="destructive" className="gap-1.5" onClick={bulkDelete} disabled={!!bulkBusy}>
                  {bulkBusy === "delete" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  {t("media.bulk_delete")}
                </Button>
                <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setSelected([])} disabled={!!bulkBusy}>
                  <X className="h-3.5 w-3.5" />
                  {t("media.clear_selection")}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      <FileDropZone onFiles={(files) => void handleUpload(files)} busy={uploading}>
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/3] w-full rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive py-8 text-center">{t("media.load_error")}</p>
      ) : resources.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
          <ImageOff className="h-8 w-8" />
          <p className="text-sm">{t("media.empty")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {resources.map((r, i) => (
            <div
              key={r.public_id}
              className={`group relative overflow-hidden rounded-lg border bg-muted cursor-pointer ${
                mode === "pick" ? "hover:ring-2 hover:ring-primary" : ""
              } ${selectedSet.has(r.public_id) ? "ring-2 ring-primary" : ""}`}
              onClick={
                mode === "pick"
                  ? () => onPick?.(r.secure_url)
                  : () => openImagePreview(previewList(), i)
              }
            >
              <img src={r.thumbnail_url} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                {[`${r.width}×${r.height}`, r.format.toUpperCase(), formatBytes(r.bytes)].filter(Boolean).join(" · ")}
              </div>
              {mode === "manage" && (
                <div
                  className={`absolute left-1.5 top-1.5 rounded bg-white/90 p-0.5 shadow-sm transition-opacity ${
                    selectedSet.has(r.public_id) ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={selectedSet.has(r.public_id)}
                    onCheckedChange={() => toggleOne(r.public_id)}
                    aria-label={t("media.select")}
                  />
                </div>
              )}
              {mode === "manage" && (
                <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-7 w-7"
                    title={t("media.copy_url")}
                    onClick={(e) => {
                      e.stopPropagation();
                      copyUrl(r.secure_url);
                    }}
                  >
                    {copied === r.secure_url ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="destructive"
                    className="h-7 w-7"
                    title={t("media.delete")}
                    disabled={deleteMutation.isPending}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(t("media.confirm_delete"))) deleteMutation.mutate(r.public_id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
              {mode === "pick" && (
                <div className="absolute inset-0 flex items-center justify-center bg-primary/0 opacity-0 transition group-hover:bg-primary/15 group-hover:opacity-100">
                  <span className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">
                    {t("media.select")}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      </FileDropZone>

      <ImagePreviewDialog config={imagePreview} onClose={closeImagePreview} />
    </div>
  );
}

/** Modal wrapper around MediaGrid in pick mode, for reuse from image fields. */
export function MediaPickerDialog({
  open,
  onOpenChange,
  onPick,
  initialFolder = "content",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (url: string) => void;
  initialFolder?: MediaFolder;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t("media.picker_title")}</DialogTitle>
          <DialogDescription>{t("media.picker_desc")}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto pr-1">
          <MediaGrid
            mode="pick"
            initialFolder={initialFolder}
            onPick={(url) => {
              onPick(url);
              onOpenChange(false);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
