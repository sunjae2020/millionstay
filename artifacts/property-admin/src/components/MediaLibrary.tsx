import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload, Copy, Trash2, ImageOff, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { apiFetch, apiJson } from "@/lib/apiFetch";

// Folders exposed in the library — must match the api-server ALLOWED_FOLDERS.
export const MEDIA_FOLDERS = ["content", "spaces", "listings", "branding"] as const;
export type MediaFolder = (typeof MEDIA_FOLDERS)[number];

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

function formatBytes(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const queryKey = ["media", folder];
  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => apiJson<{ resources: MediaResource[]; next_cursor: string | null }>(`/api/v1/media?folder=${folder}`),
  });

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

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={folder} onValueChange={(v) => setFolder(v as MediaFolder)}>
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
          <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span className="ml-1.5">{t("media.upload")}</span>
          </Button>
        </div>
      </div>

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
          {resources.map((r) => (
            <div
              key={r.public_id}
              className={`group relative overflow-hidden rounded-lg border bg-muted ${
                mode === "pick" ? "cursor-pointer hover:ring-2 hover:ring-primary" : ""
              }`}
              onClick={mode === "pick" ? () => onPick?.(r.secure_url) : undefined}
            >
              <img src={r.thumbnail_url} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                {r.width}×{r.height} · {r.format.toUpperCase()} · {formatBytes(r.bytes)}
              </div>
              {mode === "manage" && (
                <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-7 w-7"
                    title={t("media.copy_url")}
                    onClick={() => copyUrl(r.secure_url)}
                  >
                    {copied === r.secure_url ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    size="icon"
                    variant="destructive"
                    className="h-7 w-7"
                    title={t("media.delete")}
                    disabled={deleteMutation.isPending}
                    onClick={() => {
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
