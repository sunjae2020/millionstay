import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera, ImagePlus, Loader2 } from "lucide-react";
import { downscaleAll } from "@/lib/photo";

/**
 * Take-a-photo / pick-a-photo pair for work-order evidence.
 *
 * `capture="environment"` opens the rear camera straight from the OS on a
 * phone, which is the whole point of running this as a home-screen app: the
 * crew photographs the unit without leaving the job. The second input is the
 * gallery, for shots taken before the app was open. Files are downscaled in the
 * browser first so a dozen photos upload over site 4G.
 */
export function PhotoCapture({
  onFiles,
  disabled = false,
  remaining,
}: {
  onFiles: (files: File[]) => Promise<void> | void;
  disabled?: boolean;
  remaining?: number;
}) {
  const { t } = useTranslation();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handle(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    setBusy(true);
    try {
      const capped = remaining != null ? files.slice(0, Math.max(remaining, 0)) : files;
      if (capped.length) await onFiles(await downscaleAll(capped));
    } finally {
      setBusy(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (galleryRef.current) galleryRef.current.value = "";
    }
  }

  const off = disabled || busy || remaining === 0;
  const btn = "flex-1 h-11 rounded-lg border text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60";

  return (
    <>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={off}
          className={`${btn} border-transparent bg-primary text-white`}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          {t("photos.take", "Take photo")}
        </button>
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          disabled={off}
          className={`${btn} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
        >
          <ImagePlus className="h-4 w-4" />
          {t("photos.choose", "Choose")}
        </button>
      </div>

      {/* Rear camera straight from the OS. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void handle(e.target.files)}
      />
      {/* Existing photos, several at a time. */}
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void handle(e.target.files)}
      />
    </>
  );
}
