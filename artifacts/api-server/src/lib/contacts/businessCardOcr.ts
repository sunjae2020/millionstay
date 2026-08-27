import { getAiClient, isTaskConfigured } from "../ai/client.js";
import { COUNTRY_PROMPT_LIST, normaliseCountry } from "../countries.js";

/**
 * Business-card OCR — Contact detail → 명함.
 *
 * Reads the front (and optionally the back) of a business card and returns the
 * fields it can read, mapped onto `contacts` columns. Cards in this market are
 * routinely bilingual (Korean front / English back), so BOTH sides go into a
 * single call and the model reconciles them into one contact.
 *
 * The result is a SUGGESTION only. Nothing is written to the database here —
 * the admin reviews every field in the approval dialog and picks what to apply.
 */

/** Fields the OCR may fill. Keys are `contacts` column names. */
export const OCR_FIELDS = [
  "first_name",
  "last_name",
  "company_name",
  "job_title",
  "department",
  "email",
  "mobile_number",
  "office_number",
  "website",
  "address_line1",
  "suburb",
  "state",
  "postcode",
  "country",
  "sns_id",
] as const;

export type OcrField = (typeof OCR_FIELDS)[number];
export type OcrFields = Partial<Record<OcrField, string>>;

export interface BusinessCardImage {
  buffer: Buffer;
  mimetype: string;
}

export interface BusinessCardOcrResult {
  fields: OcrFields;
  /** 0–1 self-reported legibility of the card. Surfaced in the review dialog. */
  confidence: number | null;
  /** Anything printed on the card that did not map onto a field (fax, 사업자번호…). */
  notes: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
}

const SUPPORTED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function isSupportedCardMime(mimetype: string): boolean {
  return SUPPORTED_MIME.includes(mimetype.toLowerCase());
}

const SYSTEM_PROMPT =
  `You extract contact details from photographs or scans of business cards for a property-management CRM. ` +
  `The cards are typically Korean, English, or bilingual (one language per side). ` +
  `You are given the FRONT of one card, and sometimes also its BACK — both sides belong to the SAME person, ` +
  `so merge them into one result rather than reporting them separately.\n\n` +
  `Rules:\n` +
  `- Transcribe only what is actually printed on the card. NEVER guess, complete or invent a value. ` +
  `If a field is not on the card, omit the key entirely.\n` +
  `- Names: for a Korean name written without a space (e.g. 홍성진), the FIRST character is the family name ` +
  `(last_name = 홍) and the rest is the given name (first_name = 성진). For a Western name, ` +
  `first_name is the given name and last_name is the family name. If both a Korean and a Latin spelling are ` +
  `printed, prefer the Korean one — the Latin spelling can go in notes.\n` +
  `- job_title is the role printed on the card (대표이사, Sales Manager…). department is the team/division (영업팀…).\n` +
  `- Phone numbers: keep the printed digits and separators, e.g. "010-1234-5678". A number labelled ` +
  `휴대폰/Mobile/M/HP is mobile_number; one labelled Tel/전화/사무실/Office is office_number. ` +
  `A fax number is NOT a phone field — put it in notes.\n` +
  `- Address: put the full street address in address_line1, the city/시·군·구 in suburb, the province/state/도 in state, ` +
  `the postal code in postcode, and the country in country — for country answer with the value on the LEFT of ` +
  `these pairs: ${COUNTRY_PROMPT_LIST}, or omit it if the country is not listed. ` +
  `If the address is a single unsplittable line, put it all in address_line1 and leave the rest out.\n` +
  `- sns_id is a KakaoTalk / WeChat / LINE / WhatsApp ID if one is printed.\n` +
  `- website is the URL as printed (no scheme is fine).\n` +
  `- notes: a short plain-text line for anything printed on the card that does not fit a field ` +
  `(fax, 사업자등록번호, second phone number, slogan). Use null if there is nothing.\n` +
  `- confidence: your honest 0–1 estimate of how legible the card is overall.\n\n` +
  `Respond with ONLY a JSON object of the form ` +
  `{"fields":{"<field>":"<value>"},"confidence":<number>,"notes":"<string or null>"}. ` +
  `The allowed field keys are exactly: ${OCR_FIELDS.join(", ")}. Do not add any other key, and do not wrap the JSON in prose or code fences.`;

/**
 * Run OCR over a business card. Throws when the AI key is missing (mapped to 503
 * by the route) or when the model returns something unparseable.
 */
export async function scanBusinessCard(
  front: BusinessCardImage,
  back?: BusinessCardImage,
): Promise<BusinessCardOcrResult> {
  if (!isTaskConfigured("business_card_ocr")) {
    throw new Error("AI is not configured: set the Anthropic API key in Admin → Settings → Integrations.");
  }
  const ai = getAiClient("business_card_ocr");

  const content: Array<Record<string, unknown>> = [
    { type: "text", text: "FRONT of the card:" },
    {
      type: "image",
      source: { type: "base64", media_type: front.mimetype.toLowerCase(), data: front.buffer.toString("base64") },
    },
  ];
  if (back) {
    content.push(
      { type: "text", text: "BACK of the same card:" },
      {
        type: "image",
        source: { type: "base64", media_type: back.mimetype.toLowerCase(), data: back.buffer.toString("base64") },
      },
    );
  }
  content.push({ type: "text", text: "Extract the contact details as specified." });

  const msg = await ai.messages.create({
    max_tokens: 1024,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: content as never }],
  });

  const raw = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("OCR produced no usable output");
  let parsed: { fields?: Record<string, unknown>; confidence?: unknown; notes?: unknown };
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    throw new Error("OCR produced no usable output");
  }

  // Whitelist the keys — the form only ever offers columns we know about.
  const fields: OcrFields = {};
  for (const key of OCR_FIELDS) {
    const v = parsed.fields?.[key];
    if (typeof v !== "string" || !v.trim()) continue;
    const value = v.trim().slice(0, 255);
    // country must land on a value the admin's dropdown can show.
    if (key === "country") {
      const c = normaliseCountry(value);
      if (c) fields.country = c;
      continue;
    }
    fields[key] = value;
  }

  const confidence =
    typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
      ? Math.min(1, Math.max(0, parsed.confidence))
      : null;

  return {
    fields,
    confidence,
    notes: typeof parsed.notes === "string" && parsed.notes.trim() ? parsed.notes.trim().slice(0, 500) : null,
    inputTokens: msg.usage?.input_tokens ?? null,
    outputTokens: msg.usage?.output_tokens ?? null,
  };
}
