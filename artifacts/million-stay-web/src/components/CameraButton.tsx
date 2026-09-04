import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Camera } from "lucide-react";

/**
 * "촬영" — 폰에서 갤러리를 거치지 않고 후면 카메라를 바로 연다.
 *
 * `capture="environment"` 가 붙은 입력은 OS 카메라를 곧장 띄운다. 데스크톱에는
 * 의미가 없어 터치 기기에서만 렌더한다(`showOnDesktop` 으로 강제 가능).
 * 고른 파일은 전역 최적화기가 이미 줄인 상태로 넘어온다(lib/photo.ts).
 */
export function CameraButton({
  onCapture,
  disabled,
  className,
  label,
  maxEdge,
  showOnDesktop = false,
}: {
  onCapture: (files: File[]) => void | Promise<void>;
  disabled?: boolean;
  className?: string;
  label?: string;
  /** 명함·신분증처럼 판독을 태우는 이미지는 더 큰 상한을 준다. */
  maxEdge?: number;
  showOnDesktop?: boolean;
}) {
  const { t } = useTranslation();
  const ref = useRef<HTMLInputElement>(null);
  const coarse = typeof window !== "undefined"
    && (window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window);
  if (!coarse && !showOnDesktop) return null;

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => ref.current?.click()}
        className={className ?? "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"}
      >
        <Camera className="h-3.5 w-3.5" />
        {label ?? t("photos.take", "Take photo")}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        {...(maxEdge ? { "data-photo-max-edge": String(maxEdge) } : {})}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) void onCapture(files);
          if (ref.current) ref.current.value = "";
        }}
      />
    </>
  );
}


/**
 * 기존 `onChange={handleFileChange}` 핸들러를 그대로 재사용하는 촬영 입력.
 *
 * 이미 파일 입력 하나로 돌아가는 화면(첨부 라벨, 아이콘 버튼)에 촬영 경로만
 * 얹을 때 쓴다 — 핸들러를 리팩터링하지 않아도 되고, 고른 파일은 전역
 * 최적화기가 줄인 뒤 같은 핸들러로 들어간다.
 */
export function CameraInput({
  onChange,
  disabled,
  className,
  label,
  multiple = true,
  maxEdge,
}: {
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
  multiple?: boolean;
  maxEdge?: number;
}) {
  const { t } = useTranslation();
  const coarse = typeof window !== "undefined"
    && (window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window);
  if (!coarse) return null;

  return (
    <label className={className ?? "flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-primary"}>
      <Camera className="h-4 w-4" />
      {label ?? t("photos.take", "Take photo")}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        multiple={multiple}
        disabled={disabled}
        className="hidden"
        {...(maxEdge ? { "data-photo-max-edge": String(maxEdge) } : {})}
        onChange={onChange}
      />
    </label>
  );
}
