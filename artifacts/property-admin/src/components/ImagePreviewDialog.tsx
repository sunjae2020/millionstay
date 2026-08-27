import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  ImageOff,
  Loader2,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared image viewer. Every place that shows a photo (media library, space /
 * property photo managers, work-order and inspection evidence, CS attachments,
 * listing galleries …) opens this dialog on click instead of a bare
 * `window.open` / `<a target="_blank">`.
 *
 * It shows the file name, size and pixel dimensions, and offers
 * 복사 / 새 탭 / 다운로드 / 삭제 — the delete button only when the caller passes
 * `onDelete`, the copy button only when the URL is a stable public link
 * (`allowCopy`, default true; pass false for signed/expiring private assets).
 */

export interface PreviewImage {
  /** Full-size image URL. */
  url: string;
  /** Optional smaller URL used while the full image loads. */
  thumbnailUrl?: string | null;
  /** File name / caption shown as the dialog title. Falls back to the URL basename. */
  name?: string | null;
  bytes?: number | null;
  width?: number | null;
  height?: number | null;
  /** ISO timestamp, shown in the meta line when present. */
  createdAt?: string | null;
  /** Copying a signed, expiring URL is misleading — pass false for private assets. */
  allowCopy?: boolean;
  /** Provide to show the delete button. Await-ed, so a mutation promise is fine. */
  onDelete?: () => unknown;
}

export interface ImagePreviewConfig {
  images: PreviewImage[];
  index: number;
}

interface Props {
  /** Non-null opens the dialog. */
  config: ImagePreviewConfig | null;
  onClose: () => void;
}

export function formatBytes(bytes?: number | null): string | null {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Basename of a URL, query string and Cloudinary version segment stripped. */
export function fileNameFromUrl(url: string): string {
  try {
    const path = url.startsWith("http") ? new URL(url).pathname : url.split("?")[0]!;
    const base = decodeURIComponent(path.split("/").filter(Boolean).pop() ?? "");
    return base || "image";
  } catch {
    return "image";
  }
}

/**
 * Cloudinary serves any delivery URL as an attachment when `fl_attachment` is
 * injected into the transformation segment — that beats fetch+blob because the
 * CDN sets Content-Disposition itself and no CORS read is needed.
 */
function cloudinaryAttachmentUrl(url: string, filename: string): string | null {
  if (!/res\.cloudinary\.com\//.test(url) || !url.includes("/upload/")) return null;
  const stem = filename.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "_") || "image";
  return url.replace("/upload/", `/upload/fl_attachment:${encodeURIComponent(stem)}/`);
}

/** Download an image to disk, preferring Cloudinary's attachment flag. */
export async function downloadImage(url: string, filename?: string): Promise<void> {
  const name = filename || fileNameFromUrl(url);
  const attachment = cloudinaryAttachmentUrl(url, name);
  if (attachment) {
    const a = document.createElement("a");
    a.href = attachment;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }
  // Non-Cloudinary (data URLs, other CDNs): pull the bytes and save them.
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download failed (${res.status})`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

export function ImagePreviewDialog({ config, onClose }: Props) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [failed, setFailed] = useState(false);
  /** Pixel size read off the <img> when the caller didn't know it. */
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  const images = config?.images ?? [];
  const total = images.length;
  const image = images[index] ?? null;

  useEffect(() => {
    if (config) setIndex(Math.min(Math.max(config.index, 0), Math.max(config.images.length - 1, 0)));
  }, [config]);

  useEffect(() => {
    setNatural(null);
    setFailed(false);
    setCopied(false);
  }, [index, config]);

  const go = useCallback(
    (delta: number) => {
      if (total < 2) return;
      setIndex((i) => (i + delta + total) % total);
    },
    [total],
  );

  useEffect(() => {
    if (!config) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [config, go]);

  if (!image) return null;

  const name = image.name?.trim() || fileNameFromUrl(image.url);
  const width = image.width ?? natural?.w ?? null;
  const height = image.height ?? natural?.h ?? null;
  const size = formatBytes(image.bytes);
  const ext = (fileNameFromUrl(image.url).split(".").pop() ?? "").toUpperCase();
  const meta = [
    width && height ? `${width}×${height}` : null,
    ext && ext.length <= 5 ? ext : null,
    size,
    image.createdAt ? new Date(image.createdAt).toLocaleDateString() : null,
  ].filter(Boolean) as string[];

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(image.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the URL is still visible in the new-tab button */
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadImage(image.url, name);
    } catch {
      window.open(image.url, "_blank", "noopener");
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!image.onDelete) return;
    if (!window.confirm(t("image_preview.confirm_delete"))) return;
    setDeleting(true);
    try {
      await image.onDelete();
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 pr-12 text-left space-y-1">
          <DialogTitle className="truncate text-base" title={name}>
            {name}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {meta.join(" · ")}
            {total > 1 && <span className="ml-2 opacity-70">{index + 1} / {total}</span>}
          </p>
        </DialogHeader>

        <div className="relative flex items-center justify-center bg-slate-900/95 min-h-[45vh] max-h-[70vh]">
          {failed ? (
            <div className="flex flex-col items-center gap-2 py-20 text-slate-300">
              <ImageOff className="h-8 w-8" />
              <p className="text-sm">{t("image_preview.load_error")}</p>
            </div>
          ) : (
            <img
              src={image.url}
              alt={name}
              className="max-h-[70vh] max-w-full object-contain"
              onLoad={(e) => {
                const el = e.currentTarget;
                setNatural({ w: el.naturalWidth, h: el.naturalHeight });
              }}
              onError={() => setFailed(true)}
            />
          )}

          {total > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label={t("image_preview.prev")}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-2 text-white transition-colors hover:bg-black/70"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label={t("image_preview.next")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-2 text-white transition-colors hover:bg-black/70"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t px-5 py-3">
          {image.allowCopy !== false && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={copyUrl}>
              {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? t("image_preview.copied") : t("image_preview.copy_link")}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => window.open(image.url, "_blank", "noopener")}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t("image_preview.open_new_tab")}
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownload} disabled={downloading}>
            {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {t("image_preview.download")}
          </Button>
          {image.onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className={cn("gap-1.5 ml-auto text-red-500 hover:bg-red-50 hover:text-red-700")}
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              {t("image_preview.delete")}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Companion hook — mirrors `useDocumentPreview()`:
 *
 *   const { imagePreview, openImagePreview, closeImagePreview } = useImagePreview();
 *   <img onClick={() => openImagePreview(images, i)} />
 *   <ImagePreviewDialog config={imagePreview} onClose={closeImagePreview} />
 */
export function useImagePreview() {
  const [config, setConfig] = useState<ImagePreviewConfig | null>(null);
  return {
    imagePreview: config,
    openImagePreview: (images: PreviewImage[], index = 0) => {
      if (images.length > 0) setConfig({ images, index });
    },
    closeImagePreview: () => setConfig(null),
  };
}
