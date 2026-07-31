import { getAnthropic, isChatConfigured } from "../chat/anthropic.js";

/**
 * Document intake classification — read a bulk-uploaded file well enough to file it.
 *
 * Two stages, cheapest first:
 *
 *  1. The filename. Paperwork that was already filed by hand usually carries the
 *     answer in its name ("A동_1503호_홍길동_임대차계약서_2024.pdf"). When the
 *     name yields both a document type and something to match on, that is the
 *     whole classification — no model call, no cost.
 *  2. The contents. Scans and phone photos carry nothing in the name, so the
 *     bytes go to the model. PDFs go up as `document` blocks (Claude renders the
 *     pages itself, so a scanned PDF with no text layer works the same as a born-
 *     digital one) and photos as `image` blocks.
 *
 * Nothing here writes to the database or files anything. The result is a
 * suggestion that an admin confirms — same contract as the business-card OCR,
 * and for the same reason: a wrong guess acted on automatically would put a
 * 30-day identity scan on a 7-year contract.
 */

/** Model used to read intake documents. Override with DOCUMENT_INTAKE_MODEL. */
export function getIntakeModel(): string {
  return process.env["DOCUMENT_INTAKE_MODEL"] || "claude-opus-5";
}

/**
 * Document types the classifier may choose. Deliberately the same keys as
 * `UPLOADABLE_DOC_TYPES` in routes/documents.ts, because the chosen type is what
 * sets the retention period when the file is finally filed.
 */
export const INTAKE_DOC_TYPES = [
  "contract",
  "tax_invoice",
  "receipt",
  "property_document",
  "id_document",
  "visa_document",
  "other",
] as const;

export type IntakeDocType = (typeof INTAKE_DOC_TYPES)[number];

export interface IntakeFields {
  /** Tenant / counterparty name as printed. */
  party_name?: string;
  /** Landlord or lessor, when the document names one. */
  counterparty_name?: string;
  /** Unit designation as printed — "1503호", "A-1503", "Unit 12". */
  unit_label?: string;
  /** Building or estate name. */
  building_name?: string;
  /** Full address line, when present. */
  address?: string;
  /** ISO dates (YYYY-MM-DD) where the document gives a full date. */
  start_date?: string;
  end_date?: string;
  document_date?: string;
  /** Amounts as plain digit strings, no separators or currency symbol. */
  deposit_amount?: string;
  monthly_rent?: string;
  /** Any reference number printed on the document (계약번호, invoice no). */
  reference?: string;
}

export interface IntakeScanResult {
  doc_type: IntakeDocType;
  fields: IntakeFields;
  /** 0–1, the model's own confidence in what it read. */
  confidence: number | null;
  notes: string | null;
  source: "filename" | "ai";
  inputTokens: number | null;
  outputTokens: number | null;
}

// ── Stage 1: the filename ────────────────────────────────────────────────────

/**
 * Filename fragment → doc_type. Ordered: the first match wins, so put the
 * specific ahead of the general (임대차계약서 before 계약).
 *
 * Both Korean and English fragments are listed because scanned paperwork in this
 * market is filed under whichever the person doing the filing typed that day.
 */
const NAME_TYPE_RULES: Array<[RegExp, IntakeDocType]> = [
  [/임대차계약|전세계약|월세계약|lease|tenancy/i, "contract"],
  [/등기부|건축물대장|토지대장|title.?deed|register/i, "property_document"],
  [/세금계산서|tax.?invoice/i, "tax_invoice"],
  [/영수증|입금증|receipt/i, "receipt"],
  [/신분증|주민등록증|여권|passport|driver.?licen[cs]e/i, "id_document"],
  [/비자|visa|체류/i, "visa_document"],
  [/계약서|contract|agreement/i, "contract"],
];

/** "1503호", "A-1503", "제1503호" — the unit designation inside a filename. */
const UNIT_PATTERNS: RegExp[] = [
  /제?\s*([A-Za-z]?-?\d{2,5})\s*호/,
  /\b([A-Za-z]-\d{2,5})\b/,
  /\bunit[\s_-]*([A-Za-z]?-?\d{1,5})\b/i,
];

/** A Korean personal name: 2–4 hangul syllables standing on their own. */
const KOREAN_NAME_PATTERN = /(?:^|[_\-\s])([가-힣]{2,4})(?=[_\-\s.]|$)/;

/** Words that look like a name to the pattern above but never are. */
const NAME_STOPWORDS = new Set([
  "계약", "계약서", "임대", "임대차", "전세", "월세", "보증금", "영수증", "세금",
  "신분증", "여권", "비자", "등기부", "대장", "사본", "원본", "첨부", "서류",
  "스캔", "최종", "수정", "확정", "일자", "동호수", "입주", "퇴거",
]);

function docTypeFromName(name: string): IntakeDocType | null {
  for (const [rx, type] of NAME_TYPE_RULES) if (rx.test(name)) return type;
  return null;
}

function unitFromName(name: string): string | undefined {
  for (const rx of UNIT_PATTERNS) {
    const m = rx.exec(name);
    if (m?.[1]) return m[1].toUpperCase();
  }
  return undefined;
}

function personNameFromName(name: string): string | undefined {
  // Strip the extension and the type keywords first, so "임대차계약서" can't be
  // mistaken for a person.
  const stem = name.replace(/\.[A-Za-z0-9]{1,5}$/, "");
  let rest = stem;
  for (const [rx] of NAME_TYPE_RULES) rest = rest.replace(rx, " ");
  const m = KOREAN_NAME_PATTERN.exec(rest);
  const candidate = m?.[1];
  if (!candidate || NAME_STOPWORDS.has(candidate)) return undefined;
  return candidate;
}

/** A 4-digit year in a plausible range, used only as a weak date hint. */
function yearFromName(name: string): string | undefined {
  const m = /\b(19[89]\d|20[0-4]\d)\b/.exec(name);
  return m?.[1];
}

/**
 * Read what the filename alone can tell us.
 *
 * Returns null unless the name yields a document type AND something to match a
 * record on — a type with nothing to match against is not worth skipping the
 * content read for.
 */
export function scanFileName(fileName: string): IntakeScanResult | null {
  const docType = docTypeFromName(fileName);
  if (!docType) return null;

  const fields: IntakeFields = {};
  const unit = unitFromName(fileName);
  const party = personNameFromName(fileName);
  const year = yearFromName(fileName);
  if (unit) fields.unit_label = unit;
  if (party) fields.party_name = party;
  if (year) fields.document_date = `${year}-01-01`;

  if (!unit && !party) return null;

  return {
    doc_type: docType,
    fields,
    // Not a model estimate — a fixed value saying "the naming convention was
    // followed", which is weaker evidence than actually reading the page.
    confidence: 0.6,
    notes: null,
    source: "filename",
    inputTokens: null,
    outputTokens: null,
  };
}

// ── Stage 2: the contents ────────────────────────────────────────────────────

const SUPPORTED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function isScannableMime(mimetype: string): boolean {
  const m = mimetype.toLowerCase();
  return m === "application/pdf" || SUPPORTED_IMAGE_MIME.includes(m);
}

const SYSTEM_PROMPT =
  `You classify scanned property-management paperwork for a Korean property manager and read the few ` +
  `fields needed to file each document against the right record. Documents are typically Korean, ` +
  `sometimes English, and are usually photographs or scans of paper — expect stamps, handwriting, ` +
  `skew and poor contrast.\n\n` +
  `Rules:\n` +
  `- Transcribe only what is actually on the page. NEVER guess, complete or invent a value. Omit any ` +
  `field you cannot read. An omitted field is correct; a plausible-looking invented one is not.\n` +
  `- doc_type must be exactly one of: ${INTAKE_DOC_TYPES.join(", ")}. Use "contract" for a lease or ` +
  `tenancy agreement and its annexes/addenda (임대차계약서, 전세·월세 계약서, 별지). Use ` +
  `"property_document" for registry and building records (등기부등본, 건축물대장, 토지대장). Use ` +
  `"tax_invoice" for 세금계산서, "receipt" for 영수증/입금증. Use "id_document" for an identity ` +
  `document (주민등록증, 운전면허증, 여권) and "visa_document" for a visa or residence permit. ` +
  `Use "other" when nothing fits — do not force a match.\n` +
  `- party_name is the tenant / 임차인 (the person or company renting). counterparty_name is the ` +
  `landlord / 임대인. For a Korean name written without a space (홍길동), keep it exactly as printed.\n` +
  `- unit_label is the unit designation as printed ("1503호", "A-1503", "Unit 12"). building_name is ` +
  `the building or estate name. address is the full address line if one is printed.\n` +
  `- Dates: emit YYYY-MM-DD, and ONLY when the page gives a full year, month and day. A Korean date ` +
  `like "2024년 3월 15일" is "2024-03-15". start_date/end_date are the lease term (계약기간); ` +
  `document_date is the date the document itself was made (작성일/계약일).\n` +
  `- Amounts: digits only, no commas, no currency symbol. "보증금 일억원 (₩100,000,000)" is ` +
  `"100000000". deposit_amount is 보증금, monthly_rent is 월세/차임.\n` +
  `- reference is any document or contract number printed on the page.\n` +
  `- confidence: your honest 0–1 estimate of how legible the document is and how sure you are of the ` +
  `classification. Use a low value freely — a low-confidence result gets human review, which is the ` +
  `correct outcome for an unreadable scan.\n` +
  `- notes: one short plain-text line for anything a filing clerk would want to know that has no field ` +
  `(e.g. "renewal of an earlier lease", "page 2 of 3 only", "handwritten amendment to the rent"). ` +
  `Use null if there is nothing.\n\n` +
  `Respond with ONLY a JSON object of the form ` +
  `{"doc_type":"<type>","fields":{"<field>":"<value>"},"confidence":<number>,"notes":"<string or null>"}. ` +
  `The allowed field keys are exactly: party_name, counterparty_name, unit_label, building_name, ` +
  `address, start_date, end_date, document_date, deposit_amount, monthly_rent, reference. ` +
  `Do not add any other key, and do not wrap the JSON in prose or code fences.`;

const FIELD_KEYS: Array<keyof IntakeFields> = [
  "party_name", "counterparty_name", "unit_label", "building_name", "address",
  "start_date", "end_date", "document_date", "deposit_amount", "monthly_rent", "reference",
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_KEYS = new Set(["start_date", "end_date", "document_date"]);
const AMOUNT_KEYS = new Set(["deposit_amount", "monthly_rent"]);

export interface IntakeFile {
  buffer: Buffer;
  mimetype: string;
  fileName: string;
}

/**
 * Read a document's contents. Throws when the AI key is missing (mapped to 503
 * by the route) or when the model returns something unparseable — in both cases
 * the file stays parked in intake for a manual read.
 */
export async function scanDocument(file: IntakeFile): Promise<IntakeScanResult> {
  if (!isChatConfigured()) {
    throw new Error("AI is not configured: set the Anthropic API key in Admin → Settings → Integrations.");
  }
  if (!isScannableMime(file.mimetype)) {
    throw new Error(`Cannot read ${file.mimetype} — only PDFs and photos can be classified automatically.`);
  }
  const anthropic = getAnthropic();
  const mime = file.mimetype.toLowerCase();
  const data = file.buffer.toString("base64");

  const content: Array<Record<string, unknown>> =
    mime === "application/pdf"
      ? [{ type: "document", source: { type: "base64", media_type: "application/pdf", data } }]
      : [{ type: "image", source: { type: "base64", media_type: mime, data } }];

  // The filename is given as a hint, not as an answer: it is often the only
  // legible thing about a bad scan, but it is also often wrong, so the model is
  // told to prefer the page.
  content.push({
    type: "text",
    text:
      `The uploaded file is named "${file.fileName}". Treat the name as a weak hint only — ` +
      `the document itself always wins where the two disagree. Classify the document and extract the fields.`,
  });

  const msg = await anthropic.messages.create({
    model: getIntakeModel(),
    max_tokens: 1024,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: content as never }],
  });

  if (msg.stop_reason === "refusal") {
    throw new Error("The document could not be read (declined by the model's safety filters).");
  }

  const raw = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The document scan produced no usable output");
  let parsed: { doc_type?: unknown; fields?: Record<string, unknown>; confidence?: unknown; notes?: unknown };
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    throw new Error("The document scan produced no usable output");
  }

  const docType = INTAKE_DOC_TYPES.includes(parsed.doc_type as IntakeDocType)
    ? (parsed.doc_type as IntakeDocType)
    : "other";

  // Whitelist the keys and sanity-check the two formats the matcher relies on.
  // A malformed date or a comma-separated amount would silently break matching,
  // so drop it rather than carry it forward looking valid.
  const fields: IntakeFields = {};
  for (const key of FIELD_KEYS) {
    const v = parsed.fields?.[key];
    if (typeof v !== "string" || !v.trim()) continue;
    const value = v.trim().slice(0, 255);
    if (DATE_KEYS.has(key) && !ISO_DATE.test(value)) continue;
    if (AMOUNT_KEYS.has(key)) {
      const digits = value.replace(/[,\s₩원]/g, "");
      if (!/^\d+$/.test(digits)) continue;
      fields[key] = digits;
      continue;
    }
    fields[key] = value;
  }

  const confidence =
    typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
      ? Math.min(1, Math.max(0, parsed.confidence))
      : null;

  return {
    doc_type: docType,
    fields,
    confidence,
    notes: typeof parsed.notes === "string" && parsed.notes.trim() ? parsed.notes.trim().slice(0, 500) : null,
    source: "ai",
    inputTokens: msg.usage?.input_tokens ?? null,
    outputTokens: msg.usage?.output_tokens ?? null,
  };
}

/**
 * Classify one file: filename first, contents only when the name is not enough.
 *
 * `preferContents` forces the content read even when the filename parsed — used
 * by the re-scan action, where the reviewer has already seen the filename result
 * and rejected it.
 */
export async function classifyIntakeFile(
  file: IntakeFile,
  opts: { preferContents?: boolean } = {},
): Promise<IntakeScanResult> {
  if (!opts.preferContents) {
    const byName = scanFileName(file.fileName);
    if (byName) return byName;
  }
  return scanDocument(file);
}
