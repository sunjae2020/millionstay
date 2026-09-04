/**
 * 모바일 사진 첨부 최적화 — 앱 전역.
 *
 * 폰 카메라 원본은 장당 4~12MB다. 현장에서 4G로 몇 장 올리면 업로드가 끝나지
 * 않고, 서버·Cloudinary·청구서 PDF까지 그 무게를 그대로 짊어진다. 그래서 파일
 * 선택 순간에 브라우저에서 줄인 뒤 앱 코드에 넘긴다.
 *
 * 줄이는 대상은 **사진뿐**이다(JPEG/HEIC/HEIF). PNG·SVG·GIF·WebP 는 손대지
 * 않는다 — 로고·파비콘·도장 이미지는 투명도가 살아 있어야 하고, JPEG 로 바꾸면
 * 배경이 흰색으로 채워진다. 폰 카메라 결과물은 전부 JPEG/HEIC 라 이 규칙만으로
 * 촬영 경로는 100% 덮인다.
 */

/** 긴 변 기준 기본 상한. 인쇄·증빙용으로도 충분하고 업로드는 1초대로 떨어진다. */
export const DEFAULT_MAX_EDGE = 1600;
/** 명함·신분증처럼 AI 판독을 태우는 이미지는 글자가 살아야 한다. */
export const OCR_MAX_EDGE = 2400;
const DEFAULT_QUALITY = 0.82;
/** 이보다 작으면 줄여 봐야 얻는 게 없다. */
const SKIP_BELOW_BYTES = 600 * 1024;

const PHOTO_MIME = /^image\/(jpe?g|heic|heif)$/i;
/** 확장자로만 알 수 있는 경우도 있다(안드로이드 일부 기기의 HEIC). */
const PHOTO_EXT = /\.(jpe?g|heic|heif)$/i;

export function isPhotoFile(file: File): boolean {
  return PHOTO_MIME.test(file.type) || (!file.type && PHOTO_EXT.test(file.name));
}

/** 터치 기기 여부 — 촬영 버튼을 보여줄지 판단한다. */
export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
}

export interface DownscaleOptions {
  maxEdge?: number;
  quality?: number;
}

/**
 * 한 장을 줄인다. 디코딩할 수 없거나(브라우저가 HEIC 를 못 읽는 경우) 줄여도
 * 커지면 원본을 그대로 돌려준다 — 최적화 때문에 사진을 잃는 일은 없어야 한다.
 */
export async function downscaleImage(file: File, options: DownscaleOptions = {}): Promise<File> {
  const maxEdge = options.maxEdge ?? DEFAULT_MAX_EDGE;
  const quality = options.quality ?? DEFAULT_QUALITY;
  if (!isPhotoFile(file)) return file;

  try {
    // EXIF 회전은 브라우저가 처리한다(imageOrientation: "from-image").
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const longEdge = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, maxEdge / longEdge);
    if (scale >= 1 && file.size < SKIP_BELOW_BYTES) { bitmap.close?.(); return file; }

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) { bitmap.close?.(); return file; }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob || blob.size >= file.size) return file;
    const base = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  }
}

export async function downscaleAll(files: File[], options: DownscaleOptions = {}): Promise<File[]> {
  return Promise.all(files.map((f) => downscaleImage(f, options)));
}

/* ── 전역 최적화기 ────────────────────────────────────────────────────────
   업로드 지점이 앱마다 수십 군데다. 한 곳씩 고치면 새로 생기는 화면은 또
   빠지므로, 파일 입력의 change 를 문서 단계에서 가로채 사진을 줄인 뒤 앱
   핸들러에 넘긴다. React 는 루트 컨테이너에 리스너를 붙이므로 document 캡처
   단계가 항상 먼저 돈다.

   개별 입력에서 끄려면 `data-no-photo-optimize`, 상한을 바꾸려면
   `data-photo-max-edge="2400"` 를 준다.                                    */

const HANDLED = "__photoOptimized";

function maxEdgeFor(input: HTMLInputElement): number {
  const attr = Number(input.dataset.photoMaxEdge);
  return Number.isFinite(attr) && attr > 0 ? attr : DEFAULT_MAX_EDGE;
}

async function optimizeInput(input: HTMLInputElement): Promise<boolean> {
  const files = Array.from(input.files ?? []);
  if (!files.some(isPhotoFile)) return false;
  const shrunk = await downscaleAll(files, { maxEdge: maxEdgeFor(input) });
  // 한 장도 실제로 줄지 않았으면 파일 목록을 갈아끼우지 않는다.
  if (shrunk.every((f, i) => f === files[i])) return false;
  const dt = new DataTransfer();
  shrunk.forEach((f) => dt.items.add(f));
  input.files = dt.files;
  return true;
}

function onChangeCapture(event: Event): void {
  const input = event.target as HTMLInputElement | null;
  if (!input || input.tagName !== "INPUT" || input.type !== "file") return;
  if (input.dataset.noPhotoOptimize !== undefined) return;
  if ((input as any)[HANDLED]) { (input as any)[HANDLED] = false; return; }
  if (!input.files?.length) return;
  if (!Array.from(input.files).some(isPhotoFile)) return;

  // 앱 핸들러가 원본을 보기 전에 멈춘다. 줄인 뒤 같은 이벤트를 다시 쏜다.
  event.stopImmediatePropagation();
  event.preventDefault();

  void optimizeInput(input).finally(() => {
    (input as any)[HANDLED] = true;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

let installed = false;

/** main.tsx 에서 한 번 호출한다. */
export function installPhotoOptimizer(): void {
  if (installed || typeof document === "undefined") return;
  // DataTransfer 로 FileList 를 만들 수 없는 브라우저에서는 조용히 물러난다.
  try { new DataTransfer(); } catch { return; }
  document.addEventListener("change", onChangeCapture, true);
  installed = true;
}
