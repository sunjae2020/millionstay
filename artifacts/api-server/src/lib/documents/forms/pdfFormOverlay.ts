/**
 * 정부 배포 서식 PDF 위에 값만 얹는 범용 오버레이 렌더러.
 *
 * 원칙: **서식을 재현하지 않는다.** 원본 PDF를 배경으로 그대로 임포트하고
 * 좌표에 텍스트·체크마크·서명 이미지만 그린다. 따라서 글꼴·자간·괘선·여백·
 * 페이지 수가 원본 그 자체이며 "정부 서식과 100% 동일"이 문자 그대로 성립한다.
 * (법령 별지서식은 저작권법 제7조 비보호저작물이라 이 사용에 제약이 없다.)
 *
 * 좌표계 = PDF 사용자 공간(원점 좌하단, 단위 pt).
 *  - text  : `y` 는 **베이스라인**. 원본 라벨의 실제 베이스라인에서 뽑았으므로
 *            같은 줄의 인쇄 글자와 정확히 같은 높이에 앉는다.
 *  - check : 원본의 `□` / `q`(윙딩) 안쪽 중심 x, 해당 줄 베이스라인 y.
 *  - image : 서명·도장 이미지가 들어갈 상자(좌하단 기준).
 *
 * 서식별 좌표 맵은 `*Fields.ts` 에 두고 이 모듈은 그리기만 한다.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type FieldAlign = "left" | "center" | "right";

/** 값을 쓰기 전에 흰색으로 덮을 영역 — 원본의 안내문("○○ 기재")을 지울 때 쓴다. */
export interface ClearBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextField {
  kind: "text";
  page: number;
  /** align=left → 시작 x, center → 중심 x, right → 끝 x. */
  x: number;
  /** 베이스라인 y. */
  y: number;
  size?: number;
  align?: FieldAlign;
  /** 넘치면 이 폭에 맞춰 자동 축소한다(줄바꿈하지 않음 — 서식 칸이 고정폭이므로). */
  maxWidth?: number;
  /** 원본 안내문 위에 쓰는 칸이면 먼저 이 영역을 흰색으로 덮는다. */
  clear?: ClearBox;
}

export interface CheckField {
  kind: "check";
  page: number;
  /** `□` / `q` 안쪽 중심. */
  x: number;
  y: number;
  size?: number;
}

export interface ImageField {
  kind: "image";
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type FormField = TextField | CheckField | ImageField;

/** 한 서식의 원본 자산 식별자. 서식이 개정되면 새 상수를 추가한다. */
export interface FormSpec {
  /** forms/ 아래 배경 PDF 파일명. 개정일을 파일명에 박아 둔다. */
  file: string;
  /** 서식 개정일. 문서 하단 감사 로그·파일명에 쓴다. */
  revision: string;
  /** 근거 법령/고시. */
  legalBasis: string;
  pageCount: number;
  pageWidth: number;
  pageHeight: number;
}

export interface FillOptions {
  /** 체크마크 문자. 원본 서식은 `□` 안에 V 표를 넣는 것이 관행. */
  checkMark?: string;
  /** true 면 모든 필드 자리에 얇은 상자를 그린다(좌표 캘리브레이션 전용). */
  debugBoxes?: boolean;
  /** 이 페이지들만 남긴다(1-based). 첨부 별지를 떼어 낼 때 쓴다. */
  pages?: number[];
}

/**
 * 서식 자산(배경 PDF·한글 폰트) 디렉터리.
 *
 * dev/tsx 에서는 이 파일 옆(src/lib/documents/forms), 번들 후에는 build.mjs 가
 * dist/forms 로 복사한 것을 쓴다. esbuild 배너가 __dirname 을 채워 준다.
 */
export function formAssetDir(): string {
  // 캘리브레이션 스크립트처럼 번들 위치가 다른 경우를 위한 탈출구.
  if (process.env.FORM_ASSET_DIR) return process.env.FORM_ASSET_DIR;
  if (process.env.MLT_FORM_ASSET_DIR) return process.env.MLT_FORM_ASSET_DIR;
  const here = typeof __dirname === "string" ? __dirname : path.dirname(fileURLToPath(import.meta.url));
  // 번들된 dist/index.mjs 에서 실행되면 __dirname === dist → dist/forms
  return here.endsWith(`${path.sep}forms`) ? here : path.join(here, "forms");
}

const assetCache = new Map<string, Promise<Uint8Array>>();

function loadAsset(file: string): Promise<Uint8Array> {
  let hit = assetCache.get(file);
  if (!hit) {
    hit = readFile(path.join(formAssetDir(), file)).then((b) => new Uint8Array(b));
    assetCache.set(file, hit);
  }
  return hit;
}

/** 값이 비어 있어 인쇄하지 않을 필드인지. */
function isBlank(v: unknown): boolean {
  return v === null || v === undefined || v === "" || v === false;
}

/** data: URL 또는 https URL 에서 이미지 바이트를 읽는다. 실패하면 서명 없이 진행. */
async function fetchImageBytes(src: string): Promise<Uint8Array | null> {
  try {
    if (src.startsWith("data:")) {
      const b64 = src.slice(src.indexOf(",") + 1);
      return new Uint8Array(Buffer.from(b64, "base64"));
    }
    if (/^https?:/i.test(src)) {
      const res = await fetch(src);
      if (!res.ok) return null;
      return new Uint8Array(await res.arrayBuffer());
    }
  } catch {
    // 서명 이미지 하나 때문에 계약서 발급이 실패하지 않게 한다.
  }
  return null;
}

/**
 * 값 묶음을 원본 서식에 얹어 PDF 바이트를 만든다.
 * 값을 하나도 넘기지 않으면 빈 서식(원본 그대로)이 나온다 — 회귀 검증용.
 */
export async function fillPdfForm(
  spec: FormSpec,
  fields: Record<string, FormField>,
  values: Record<string, string | number | boolean | null | undefined>,
  opts: FillOptions = {},
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const fontkit = (await import("@pdf-lib/fontkit")).default;
  const [pdfBytes, fontBytes] = await Promise.all([
    loadAsset(spec.file),
    loadAsset("NanumGothic-Regular.ttf"),
  ]);

  const doc = await PDFDocument.load(pdfBytes);
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes, { subset: false });
  // 체크마크는 한글 폰트에 없을 수 있어 표준 폰트로 따로 그린다.
  const symbolFont = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const checkMark = opts.checkMark ?? "V";
  const white = rgb(1, 1, 1);
  const black = rgb(0, 0, 0);

  for (const [key, field] of Object.entries(fields)) {
    const page = pages[field.page - 1];
    if (!page) continue;

    if (opts.debugBoxes) {
      const w = field.kind === "image" ? field.width : field.kind === "text" ? field.maxWidth ?? 40 : 10;
      const h = field.kind === "image" ? field.height : 10;
      const x =
        field.kind === "text" && field.align === "right" ? field.x - w
        : field.kind === "text" && field.align === "center" ? field.x - w / 2
        : field.x - (field.kind === "check" ? 5 : 0);
      page.drawRectangle({
        x, y: field.kind === "image" ? field.y : field.y - 2,
        width: w, height: h,
        borderColor: rgb(1, 0, 0), borderWidth: 0.3,
      });
    }

    const raw = values[key];
    if (isBlank(raw)) continue;

    if (field.kind === "check") {
      const size = field.size ?? 9;
      const w = symbolFont.widthOfTextAtSize(checkMark, size);
      page.drawText(checkMark, { x: field.x - w / 2, y: field.y, size, font: symbolFont, color: black });
      continue;
    }

    if (field.kind === "image") {
      const src = String(raw);
      const bytes = await fetchImageBytes(src);
      if (!bytes) continue;
      let img;
      try {
        img = src.includes("image/jpeg") || /\.jpe?g($|\?)/i.test(src)
          ? await doc.embedJpg(bytes)
          : await doc.embedPng(bytes);
      } catch {
        continue;
      }
      // 비율을 유지한 채 박스 안에 맞춘다.
      const scale = Math.min(field.width / img.width, field.height / img.height);
      page.drawImage(img, {
        x: field.x + (field.width - img.width * scale) / 2,
        y: field.y + (field.height - img.height * scale) / 2,
        width: img.width * scale,
        height: img.height * scale,
      });
      continue;
    }

    if (field.clear) {
      page.drawRectangle({ ...field.clear, color: white, borderWidth: 0 });
    }

    const text = String(raw);
    let size = field.size ?? 9.5;
    if (field.maxWidth) {
      // 칸 폭이 고정이므로 줄바꿈 대신 축소한다(최소 6pt).
      while (size > 6 && font.widthOfTextAtSize(text, size) > field.maxWidth) size -= 0.25;
    }
    const width = font.widthOfTextAtSize(text, size);
    const x = field.align === "right" ? field.x - width
      : field.align === "center" ? field.x - width / 2
      : field.x;
    page.drawText(text, { x, y: field.y, size, font, color: black });
  }

  if (opts.pages?.length) {
    const keep = new Set(opts.pages.map((p) => p - 1));
    for (let i = doc.getPageCount() - 1; i >= 0; i--) if (!keep.has(i)) doc.removePage(i);
  }

  return doc.save();
}
