import { getAnthropic, isChatConfigured } from "../chat/anthropic.js";

/**
 * Identity-document reader — Contact detail → "신분증에서 사진 추출".
 *
 * Takes a photo/scan of a passport data page, 주민등록증, 운전면허증, 외국인등록증 or a
 * similar ID and returns two things:
 *   1. the bounding box of the printed portrait, so the profile photo can be
 *      cropped out of it, and
 *   2. the GENERAL identity details only — name, date of birth, gender,
 *      nationality, address.
 *
 * Document numbers are deliberately NOT collected: no 주민등록번호 (not even the
 * masked back digits), no passport number, no licence or alien-registration
 * number, no MRZ. That is enforced twice — the model is told never to emit them,
 * and every returned value is scrubbed against number patterns below before it
 * leaves this module. Korea's PIPA §24-2 bars collecting an RRN without a
 * specific legal basis, and the rest are identifiers we simply have no use for.
 *
 * The ID image itself is never stored: it lives in memory for this call and the
 * portrait crop, and only the cropped portrait is persisted.
 */

/** Model used for ID reading. Vision-capable; override with ID_DOC_OCR_MODEL. */
export function getIdOcrModel(): string {
  return process.env["ID_DOC_OCR_MODEL"] || process.env["CHAT_MODEL"] || "claude-sonnet-4-6";
}

/**
 * Countries offered by the contact form's nationality/country selects. The model
 * must answer with one of these exact strings so the value fits the dropdown —
 * keep in sync with COUNTRIES in property-admin ContactDetail.tsx.
 */
export const ALLOWED_COUNTRIES = [
  "Australia", "China", "South Korea", "Japan", "United States", "United Kingdom",
  "New Zealand", "Singapore", "India", "Canada", "Germany", "France", "Brazil",
  "Hong Kong", "Taiwan", "Vietnam", "Malaysia", "Indonesia", "Thailand",
] as const;

/** General (non-identifying) fields the reader may fill. Keys are `contacts` columns. */
export const ID_FIELDS = [
  "last_name",
  "first_name",
  "date_of_birth",
  "gender",
  "nationality",
  "address_line1",
  "suburb",
  "state",
  "postcode",
  "country",
] as const;

export type IdField = (typeof ID_FIELDS)[number];
export type IdFields = Partial<Record<IdField, string>>;

export type IdDocKind = "passport" | "national_id" | "driver_licence" | "residence_card" | "other" | "none";

export interface PortraitBox {
  /** Left/top of the printed portrait as a fraction (0–1) of image width/height. */
  x: number;
  y: number;
  /** Portrait width/height as a fraction (0–1) of image width/height. */
  w: number;
  h: number;
}

export interface IdDocumentOcrResult {
  isIdDocument: boolean;
  docKind: IdDocKind;
  portrait: PortraitBox | null;
  fields: IdFields;
  confidence: number | null;
  /** Field keys dropped because the value looked like a document/ID number. */
  blocked: string[];
  inputTokens: number | null;
  outputTokens: number | null;
}

const SUPPORTED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function isSupportedIdMime(mimetype: string): boolean {
  return SUPPORTED_MIME.includes(mimetype.toLowerCase());
}

/**
 * Values that look like an identifier we refuse to store. Deliberately broad —
 * a false positive costs one manually typed field, a false negative stores a
 * national ID number.
 */
const FORBIDDEN_VALUE_PATTERNS: RegExp[] = [
  /\d{6}\s*[-–]\s*[\d*•xX]{7}/,       // 주민등록번호 / 외국인등록번호 (masked or not)
  /\b[A-Z]{1,2}\d{7,9}\b/,            // passport numbers (M12345678)
  /\b\d{2}\s*[-–]\s*\d{6}\s*[-–]\s*\d{2}\b/, // 운전면허번호 (11-123456-78)
  /\d{7,}/,                            // any long digit run
  /[A-Z0-9<]{20,}/,                    // MRZ line
];

export function isForbiddenValue(v: string): boolean {
  return FORBIDDEN_VALUE_PATTERNS.some((re) => re.test(v));
}

const GENDER_MAP: Record<string, string> = {
  m: "Male", male: "Male", 남: "Male", 남자: "Male", 男: "Male",
  f: "Female", female: "Female", 여: "Female", 여자: "Female", 女: "Female",
};

function normalizeGender(v: string): string | null {
  return GENDER_MAP[v.trim().toLowerCase()] ?? null;
}

function normalizeCountry(v: string): string | null {
  const needle = v.trim().toLowerCase();
  const hit = ALLOWED_COUNTRIES.find((c) => c.toLowerCase() === needle);
  return hit ?? null;
}

/** ISO date (YYYY-MM-DD) only — the contact form's date inputs expect it. */
function normalizeDate(v: string): string | null {
  const m = /^(\d{4})[-.\/\s]?(\d{1,2})[-.\/\s]?(\d{1,2})\.?$/.exec(v.trim());
  if (!m) return null;
  const [, y, mo, d] = m;
  const month = Number(mo), day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const SYSTEM_PROMPT =
  `You read identity documents for a property-management CRM: passport data pages, Korean 주민등록증, ` +
  `운전면허증, 외국인등록증/residence cards, and similar national ID cards.\n\n` +
  `You do TWO things.\n\n` +
  `(1) Locate the printed portrait photograph. Report it as fractions of the image: ` +
  `"x"/"y" = left/top edge, "w"/"h" = width/height. Cover the printed photo box (head and shoulders) but stay ` +
  `INSIDE it — never include the document's text, border, MRZ lines or background. If there is no portrait, use null.\n\n` +
  `(2) Transcribe ONLY these general details, as printed:\n` +
  `  last_name, first_name — the person's name. For a Korean name written without a space (홍성진), the FIRST ` +
  `character is the family name. Prefer the Korean spelling when both Korean and Latin appear.\n` +
  `  date_of_birth — ISO "YYYY-MM-DD". On a Korean 주민등록증 the birth date is the first six digits ` +
  `(YYMMDD) of the registration number: you may read the DATE from them, but never output the number itself ` +
  `and never output anything after the hyphen. Treat 00–29 as 20xx and 30–99 as 19xx unless the card says otherwise.\n` +
  `  gender — exactly "Male" or "Female", and ONLY when the document explicitly prints a sex/성별 field ` +
  `(e.g. a passport's "Sex M"). NEVER infer gender from the portrait, the person's name, or any digit of an ` +
  `ID number — if no sex field is printed, omit the key.\n` +
  `  nationality, country — must be one of exactly: ${ALLOWED_COUNTRIES.join(", ")}. Omit if the document's ` +
  `country is not in that list. A Korean document with no explicit nationality means "South Korea".\n` +
  `  address_line1, suburb, state, postcode — the registered address, if the document prints one. ` +
  `Put the street address in address_line1, the 시/군/구 in suburb, the 도/province in state.\n\n` +
  `ABSOLUTE PROHIBITION — you must NEVER output, and never include anywhere in your answer:\n` +
  `  • 주민등록번호 / resident registration numbers, including the masked form (900101-1******)\n` +
  `  • passport numbers, driver licence numbers, alien registration numbers, document/serial numbers\n` +
  `  • the machine-readable zone (MRZ) text, issue/expiry dates, issuing authority\n` +
  `These are not wanted and must be omitted entirely. Do not describe them, do not partially mask them.\n\n` +
  `Omit any key you cannot read from the document. Never guess or complete a value.\n\n` +
  `Respond with ONLY this JSON: ` +
  `{"is_id_document":<bool>,"doc_kind":"<passport|national_id|driver_licence|residence_card|other|none>",` +
  `"portrait":{"x":<num>,"y":<num>,"w":<num>,"h":<num>}|null,` +
  `"fields":{"<field>":"<value>"},"confidence":<0-1>}. ` +
  `Allowed field keys are exactly: ${ID_FIELDS.join(", ")}. No other keys, no prose, no code fences.`;

/**
 * Read an ID document. Throws when the AI key is missing (the route maps that to
 * 503) or when the model returns something unparseable.
 */
export async function scanIdDocument(image: { buffer: Buffer; mimetype: string }): Promise<IdDocumentOcrResult> {
  if (!isChatConfigured()) {
    throw new Error("AI is not configured: set the Anthropic API key in Admin → Settings → Integrations.");
  }
  const anthropic = getAnthropic();

  const msg = await anthropic.messages.create({
    model: getIdOcrModel(),
    max_tokens: 1024,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: image.mimetype.toLowerCase(), data: image.buffer.toString("base64") },
        },
        { type: "text", text: "Locate the portrait and transcribe the general details." },
      ] as never,
    }],
  });

  const raw = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("ID reading produced no usable output");
  let parsed: {
    is_id_document?: unknown;
    doc_kind?: unknown;
    portrait?: unknown;
    fields?: Record<string, unknown>;
    confidence?: unknown;
  };
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    throw new Error("ID reading produced no usable output");
  }

  // ── Field whitelist + scrub ────────────────────────────────────────────────
  const fields: IdFields = {};
  const blocked: string[] = [];
  for (const key of ID_FIELDS) {
    const rawValue = parsed.fields?.[key];
    if (typeof rawValue !== "string") continue;
    const value = rawValue.trim().slice(0, 255);
    if (!value) continue;
    if (isForbiddenValue(value)) { blocked.push(key); continue; }
    if (key === "gender") {
      const g = normalizeGender(value);
      if (g) fields.gender = g;
      continue;
    }
    if (key === "nationality" || key === "country") {
      const c = normalizeCountry(value);
      if (c) fields[key] = c;
      continue;
    }
    if (key === "date_of_birth") {
      const d = normalizeDate(value);
      if (d) fields.date_of_birth = d;
      continue;
    }
    fields[key] = value;
  }

  // ── Portrait box ──────────────────────────────────────────────────────────
  let portrait: PortraitBox | null = null;
  const p = parsed.portrait as Record<string, unknown> | null | undefined;
  if (p && ["x", "y", "w", "h"].every((k) => typeof p[k] === "number" && Number.isFinite(p[k]))) {
    const x = Math.min(1, Math.max(0, p["x"] as number));
    const y = Math.min(1, Math.max(0, p["y"] as number));
    const w = Math.min(1 - x, Math.max(0, p["w"] as number));
    const h = Math.min(1 - y, Math.max(0, p["h"] as number));
    // A plausible portrait is a meaningful chunk of the card but not the whole
    // frame — anything outside that is treated as "no portrait found".
    if (w >= 0.05 && h >= 0.05 && w <= 0.9 && h <= 0.98) portrait = { x, y, w, h };
  }

  const docKindRaw = typeof parsed.doc_kind === "string" ? parsed.doc_kind : "other";
  const docKind = (["passport", "national_id", "driver_licence", "residence_card", "other", "none"] as const)
    .find((k) => k === docKindRaw) ?? "other";

  const confidence =
    typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
      ? Math.min(1, Math.max(0, parsed.confidence))
      : null;

  return {
    isIdDocument: parsed.is_id_document !== false && docKind !== "none",
    docKind,
    portrait,
    fields,
    confidence,
    blocked,
    inputTokens: msg.usage?.input_tokens ?? null,
    outputTokens: msg.usage?.output_tokens ?? null,
  };
}

/**
 * Cloudinary *incoming* transformation that keeps only the portrait.
 *
 * Two stages, because a bounding box that overshoots by a few percent drags the
 * document's own text into what becomes a profile photo (observed with a passport
 * MRZ line): first crop to the reported box pulled INSET_RATIO inwards, then let
 * Cloudinary's face detection re-centre within that region. Applied on upload, so
 * Cloudinary stores the cropped portrait only — the full ID is never a stored asset.
 */
const INSET_RATIO = 0.05;

export function portraitCropTransformation(box: PortraitBox): Array<Record<string, unknown>> {
  const insetX = box.w * INSET_RATIO;
  const insetY = box.h * INSET_RATIO;
  return [
    {
      crop: "crop",
      x: `${(box.x + insetX).toFixed(4)}`,
      y: `${(box.y + insetY).toFixed(4)}`,
      width: `${Math.max(0.01, box.w - insetX * 2).toFixed(4)}`,
      height: `${Math.max(0.01, box.h - insetY * 2).toFixed(4)}`,
    },
    { width: 600, height: 600, crop: "thumb", gravity: "face", zoom: 0.75 },
    { quality: "auto:good", fetch_format: "auto" },
  ];
}
