import { db, workOrdersTable, spacesTable, propertiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { cloudinaryUrl } from "../../utils/cloudinary";

/**
 * 작업지시 사진 워터마크.
 *
 * 현장 사진은 몇 달 뒤 청구·분쟁 근거로 다시 꺼내 본다. 그때 "언제, 어느 매물
 * 어느 호수의 무엇인지"가 파일 밖(원장)에만 있으면 사진 한 장이 떨어져 나온
 * 순간 증거로서 값이 사라진다. 그래서 사진에 아래 한 줄을 얹어 둔다 —
 * 원장에 저장하는 URL 자체가 Cloudinary 워터마크 변환본을 가리키므로 관리자
 * 화면·포털·작업지시서 PDF·다운로드본 어디서 봐도 같은 줄이 찍혀 있다.
 *
 *   YYYY/MM/DD-매물/공간_사진설명
 *   2026/08/21-메트하임 여수/1714호_변기 백시멘트 보수
 *
 * 없는 조각은 구분자와 함께 통째로 빠진다(설명 없으면 `_…`도 없다).
 */

/** 사진 설명이 길어도 이미지 한 줄을 넘지 않게 자른다. */
const MAX_CAPTION = 60;

export interface PhotoWatermarkContext {
  /** 매물(건물)명. */
  property?: string | null;
  /** 공간(호수)명. */
  unit?: string | null;
}

/** 사진을 찍은 날을 세는 타임존 — 문서 발행일과 같은 레버를 쓴다. */
function photoTimeZone(): string {
  return process.env["DOC_TZ"] || process.env["TZ"] || "Asia/Seoul";
}

/** Date → 테넌트 시간대의 `YYYY/MM/DD`. */
export function watermarkDate(when: Date = new Date()): string {
  const d = when instanceof Date && !Number.isNaN(when.getTime()) ? when : new Date();
  // en-CA는 YYYY-MM-DD를 내주므로 타임존 변환을 수동 조립 없이 얻는다.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: photoTimeZone(), year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d).replace(/-/g, "/");
}

/**
 * 매물명에서 괄호로 병기된 **영문**을 뗀다 — `메트하임 여수 (Metheim Yeosu)`
 * → `메트하임 여수`. 사진 위 한 줄은 짧을수록 읽히므로 워터마크에서만 줄이고
 * 원장의 매물명은 그대로 둔다. 괄호 안에 한글이 있으면(`메트하임(여수)`)
 * 이름의 일부라 보고 두며, 떼고 나면 남는 게 없는 영문 전용 매물도 건드리지
 * 않는다.
 */
function shortPlaceName(name: string): string {
  const m = name.match(/^(.*?)\s*[(（]([^()（）]*)[)）]\s*$/u);
  if (!m) return name;
  const [, head = "", inside = ""] = m;
  if (/[가-힣]/u.test(inside)) return name;
  return head.trim() || name;
}

/** `YYYY/MM/DD-매물/공간_사진설명` 한 줄을 만든다. */
export function buildPhotoWatermark(
  ctx: PhotoWatermarkContext,
  caption?: string | null,
  when: Date = new Date(),
): string {
  const clean = (v: unknown): string => String(v ?? "").replace(/\s+/g, " ").trim();
  const property = clean(ctx.property) ? shortPlaceName(clean(ctx.property)) : "";
  const place = [property, clean(ctx.unit)].filter(Boolean).join("/");
  const note = clean(caption).slice(0, MAX_CAPTION);
  return `${watermarkDate(when)}${place ? `-${place}` : ""}${note ? `_${note}` : ""}`;
}

/**
 * 업로드된 사진에 워터마크를 얹은 배포 URL.
 *
 * 폰트는 `Arial`로 요청하지만 Cloudinary가 한글 글리프를 CJK 폰트로 대체해
 * 그린다(실측 확인). 글자 크기와 띠 너비를 **업로드된 실제 가로폭 기준**으로
 * 잡는 게 핵심 — 고정 픽셀로 주면 텍스트가 사진보다 넓어질 때 캔버스가
 * 늘어나 사진 양옆에 회색 여백이 생긴다. `c_fit`이라 긴 설명은 줄바꿈된다.
 */
/**
 * 워터마크 한 줄이 사진 폭을 꽉 채우도록 글자 크기를 고른다.
 *
 * 크게 쓰되 **절대 두 줄로 넘기지 않는다** — Cloudinary `c_fit`은 넘치면
 * 줄바꿈하므로, 넘칠 일이 없도록 글자 크기 쪽을 줄여 맞춘다. 글리프 폭은
 * 볼드 기준 어림치(한글·한자 1em, 공백 0.3em, 나머지 0.58em)로 재고, 어림이
 * 살짝 빗나가도 줄바꿈이 나지 않게 5% 여유를 둔다.
 */
export function watermarkFontSize(imageWidth: number, bandWidth: number, text: string): number {
  let ems = 0;
  for (const ch of text) {
    if (ch === " ") ems += 0.3;
    else if (/[\u1100-\u11FF\u3000-\u303F\u3130-\u318F\uAC00-\uD7AF\u4E00-\u9FFF\uFF00-\uFFEF]/u.test(ch)) ems += 1;
    else ems += 0.58;
  }
  if (ems <= 0) return Math.round(imageWidth / 24);
  const fits = Math.floor((bandWidth * 0.95) / ems);
  // 짧은 문구가 우스꽝스럽게 커지지 않도록 위쪽을, 읽기 어려워지지 않도록
  // 아래쪽을 막는다.
  return Math.min(Math.round(imageWidth / 16), Math.max(14, fits));
}

/**
 * 업로드된 사진에 워터마크를 얹은 배포 URL.
 *
 * 폰트는 `Arial`로 요청하지만 Cloudinary가 한글 글리프를 CJK 폰트로 대체해
 * 그린다(실측 확인). 띠 너비와 글자 크기를 **업로드된 실제 가로폭 기준**으로
 * 잡는 게 핵심 — 고정 픽셀로 주면 텍스트가 사진보다 넓어질 때 캔버스가
 * 늘어나 사진 양옆에 회색 여백이 생긴다.
 */
export function watermarkedPhotoUrl(
  asset: { public_id: string; width?: number | null; version?: number | null; format?: string | null },
  text: string,
): string {
  const width = Number(asset.width) > 0 ? Number(asset.width) : 1600;
  const bandWidth = Math.round(width * 0.96);
  return cloudinaryUrl(asset.public_id, {
    transformation: [
      {
        overlay: { font_family: "Arial", font_size: watermarkFontSize(width, bandWidth, text), font_weight: "bold", text },
        color: "white",
        background: "rgb:00000099",
        crop: "fit",
        width: bandWidth,
      },
      { flags: "layer_apply", gravity: "south", y: Math.max(6, Math.round(width / 120)) },
    ],
    ...(asset.version ? { version: asset.version } : {}),
    // 확장자를 남겨 둔다 — 삭제 시 URL에서 public_id를 되짚는 코드가 이걸 본다.
    ...(asset.format ? { format: asset.format } : {}),
  });
}

/**
 * 작업지시의 매물·공간 이름. 작업지시에 매물이 안 걸려 있으면 호수가 속한
 * 건물로 되짚는다(작업지시서 '건물명' 칸과 같은 규칙).
 */
export async function loadPhotoWatermarkContext(workOrderId: number): Promise<PhotoWatermarkContext> {
  const [wo] = await db
    .select({ property_id: workOrdersTable.property_id, space_id: workOrdersTable.space_id })
    .from(workOrdersTable)
    .where(eq(workOrdersTable.id, workOrderId))
    .limit(1);
  if (!wo) return {};

  let unit: string | null = null;
  let propertyId = wo.property_id ?? null;
  if (wo.space_id) {
    const [space] = await db
      .select({ name: spacesTable.name, property_id: spacesTable.property_id })
      .from(spacesTable)
      .where(eq(spacesTable.id, wo.space_id))
      .limit(1);
    unit = space?.name ?? null;
    propertyId = propertyId ?? space?.property_id ?? null;
  }

  let property: string | null = null;
  if (propertyId) {
    const [row] = await db
      .select({ name: propertiesTable.name })
      .from(propertiesTable)
      .where(eq(propertiesTable.id, propertyId))
      .limit(1);
    property = row?.name ?? null;
  }
  return { property, unit };
}
