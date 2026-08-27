import { lookup } from "node:dns/promises";
import { getAiClient, isTaskConfigured } from "../ai/client.js";

/**
 * Website enrichment — Account detail/new → "웹사이트에서 가져오기".
 *
 * Fetches a company's public website and asks the model to read the company
 * details off it (name, phone, email, address, 사업자등록번호, 대표자…), plus
 * collects logo candidates from the page metadata.
 *
 * Like the business-card OCR this returns a SUGGESTION only — nothing is
 * written to the database here. The admin reviews every field in the approval
 * dialog and picks what to apply.
 *
 * Fetching a user-supplied URL server-side is an SSRF sink, so every hop is
 * validated against `assertPublicUrl` before a request goes out.
 */

/** Fields the crawler may fill. Keys are `accounts` column names. */
export const ENRICH_FIELDS = [
  "name",
  "account_email",
  "phone1",
  "phone2",
  "address_line1",
  "address_suburb",
  "address_state",
  "address_postcode",
  "address_country",
  "biz_registration_no",
  "ceo_name",
  "description",
] as const;

export type EnrichField = (typeof ENRICH_FIELDS)[number];
export type EnrichFields = Partial<Record<EnrichField, string>>;

export interface EnrichResult {
  /** The URL actually read after normalisation + redirects. */
  source_url: string;
  fields: EnrichFields;
  /** Absolute URLs of possible logos, best guess first. */
  logo_candidates: string[];
  /** 0–1 self-reported confidence in the extraction. */
  confidence: number | null;
  /** Anything found on the site that did not map onto a field. */
  notes: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
}

const FETCH_TIMEOUT_MS = 12_000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;
/** Characters of page text handed to the model. Enough for a footer + about. */
const MAX_TEXT_CHARS = 18_000;

/** Adds a scheme when the admin typed a bare domain, and strips whitespace. */
export function normaliseUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("A website address is required");
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function isPrivateIp(ip: string): boolean {
  // IPv4
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast / reserved
    return false;
  }
  // IPv6
  const v6 = ip.toLowerCase();
  if (v6 === "::" || v6 === "::1") return true;
  if (v6.startsWith("fe80") || v6.startsWith("fc") || v6.startsWith("fd")) return true;
  // IPv4-mapped (::ffff:10.0.0.1)
  const mapped = v6.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped?.[1]) return isPrivateIp(mapped[1]);
  return false;
}

/**
 * Rejects anything that is not a public http(s) address. Throws on failure so
 * the caller cannot accidentally continue with an internal target.
 */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("That website address is not valid");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https addresses can be read");
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("That address is not publicly reachable");
  }
  // A literal IP never reaches DNS — check it directly.
  if (/^[\d.]+$/.test(host) || host.includes(":")) {
    if (isPrivateIp(host)) throw new Error("That address is not publicly reachable");
    return url;
  }
  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new Error("That website could not be found");
  }
  if (!addresses.length) throw new Error("That website could not be found");
  // ALL resolved addresses must be public — a single private answer is enough
  // for a DNS-rebinding style attack to land.
  for (const a of addresses) {
    if (isPrivateIp(a.address)) throw new Error("That address is not publicly reachable");
  }
  return url;
}

/** Fetches HTML with a byte cap, a timeout, and SSRF validation on every hop. */
async function fetchHtml(startUrl: string): Promise<{ html: string; finalUrl: string }> {
  let current = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertPublicUrl(current);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          // Some sites 403 an unknown agent; identify honestly but plainly.
          "User-Agent": "Mozilla/5.0 (compatible; MillionStayBot/1.0; +https://millionstay.com)",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "ko,en;q=0.8",
        },
      });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("The website took too long to respond");
      }
      throw new Error("The website could not be reached");
    }
    clearTimeout(timer);

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error("The website could not be reached");
      current = new URL(location, url).toString();
      continue;
    }
    if (!res.ok) throw new Error(`The website returned an error (HTTP ${res.status})`);

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType && !/text\/html|application\/xhtml|text\/plain/i.test(contentType)) {
      throw new Error("That address is not a web page");
    }

    // Read with a hard byte cap so a huge page cannot exhaust memory.
    const reader = res.body?.getReader();
    if (!reader) throw new Error("The website returned an empty page");
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (total < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.byteLength;
      }
    }
    void reader.cancel().catch(() => {});
    const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    return { html: buf.toString("utf8"), finalUrl: url.toString() };
  }
  throw new Error("The website redirected too many times");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_m, d: string) => String.fromCodePoint(Number(d)));
}

/** Every `<meta>` tag as { name|property → content }, lower-cased keys. */
function parseMeta(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const key =
      tag.match(/\b(?:property|name|itemprop)\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase() ?? "";
    const content = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1];
    if (key && content && !out[key]) out[key] = decodeEntities(content).trim();
  }
  return out;
}

/**
 * Logo candidates in priority order: Open Graph image, apple-touch-icon, any
 * declared icon, then an <img> in the header whose markup mentions "logo".
 * Relative URLs are resolved against the page.
 */
export function extractLogoCandidates(html: string, baseUrl: string): string[] {
  const found: string[] = [];
  const push = (value?: string | null) => {
    if (!value) return;
    try {
      const abs = new URL(decodeEntities(value.trim()), baseUrl).toString();
      if (/^https?:/i.test(abs) && !found.includes(abs)) found.push(abs);
    } catch {
      /* ignore unusable src */
    }
  };

  const meta = parseMeta(html);
  push(meta["og:logo"]);
  push(meta["og:image"]);
  push(meta["twitter:image"]);

  const links = html.match(/<link\b[^>]*>/gi) ?? [];
  const byRel = (pattern: RegExp) =>
    links.filter((l) => pattern.test(l.match(/\brel\s*=\s*["']([^"']+)["']/i)?.[1] ?? ""));
  for (const link of [...byRel(/apple-touch-icon/i), ...byRel(/(^|\s)icon(\s|$)|shortcut icon|mask-icon/i)]) {
    push(link.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1]);
  }

  for (const img of html.match(/<img\b[^>]*>/gi) ?? []) {
    if (!/logo|brand|ci[-_]?image/i.test(img)) continue;
    push(img.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1]);
    if (found.length > 8) break;
  }

  return found.slice(0, 8);
}

/** Strips markup and collapses whitespace so the model sees readable copy. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6])\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .split("\n")
    .map((line) => decodeEntities(line).replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_TEXT_CHARS);
}

const SYSTEM_PROMPT =
  `You read a company's public website and extract its business details for a property-management CRM. ` +
  `The sites are typically Korean, English, or bilingual — company details usually sit in the page footer, ` +
  `a 회사소개/About page, or a 오시는길/Contact section.\n\n` +
  `Rules:\n` +
  `- Report only what the page actually states. NEVER guess, complete or invent a value. ` +
  `If a field is not on the page, omit the key entirely.\n` +
  `- name is the company's registered or trading name as written (상호/법인명). Drop marketing taglines.\n` +
  `- account_email is the company's general enquiry address. Prefer info@/contact@ over a personal address.\n` +
  `- phone1 is the main representative number (대표전화), phone2 a secondary one. Keep the printed digits and ` +
  `separators, e.g. "02-1234-5678". A fax number is NOT a phone field — put it in notes.\n` +
  `- Address: the full street address in address_line1, the city/시·군·구 in address_suburb, the ` +
  `province/state/도 in address_state, the postal code in address_postcode, and the country in ` +
  `address_country as a full country NAME in the language the address is written in ` +
  `(대한민국, Australia, 日本 …) — never a two-letter ISO code. If the address is one unsplittable ` +
  `line, put it all in address_line1 and leave the rest out.\n` +
  `- biz_registration_no is the Korean 사업자등록번호 — 10 digits, normally printed as "123-45-67890". ` +
  `Do NOT confuse it with 법인등록번호 (13 digits) or 통신판매업신고번호; those belong in notes.\n` +
  `- ceo_name is the 대표/대표이사/대표자 name.\n` +
  `- description is a neutral one or two sentence summary of what the company does, in the language the ` +
  `site is written in. Do not copy marketing superlatives.\n` +
  `- notes: a short plain-text line for company details that do not fit a field (fax, 법인등록번호, ` +
  `통신판매업신고번호, opening hours, branch addresses). Use null if there is nothing.\n` +
  `- confidence: your honest 0–1 estimate of how clearly the page states these company details. ` +
  `A page with a full footer business registration block is high; a single-page marketing splash is low.\n\n` +
  `Respond with ONLY a JSON object of the form ` +
  `{"fields":{"<field>":"<value>"},"confidence":<number>,"notes":"<string or null>"}. ` +
  `The allowed field keys are exactly: ${ENRICH_FIELDS.join(", ")}. ` +
  `Do not add any other key, and do not wrap the JSON in prose or code fences.`;

/**
 * Read a company website and return the account fields it states. Throws when
 * the AI key is missing (mapped to 503 by the route), when the site cannot be
 * fetched, or when the model returns something unparseable.
 */
export async function enrichFromWebsite(inputUrl: string): Promise<EnrichResult> {
  if (!isTaskConfigured("website_enrich")) {
    throw new Error("AI is not configured: set the Anthropic API key in Admin → Settings → Integrations.");
  }
  const { html, finalUrl } = await fetchHtml(normaliseUrl(inputUrl));
  const logo_candidates = extractLogoCandidates(html, finalUrl);
  const text = htmlToText(html);
  if (text.length < 40) throw new Error("That page has no readable text to work from");

  const meta = parseMeta(html);
  const metaSummary = ["og:site_name", "og:title", "description", "og:description", "author"]
    .map((k) => (meta[k] ? `${k}: ${meta[k]}` : null))
    .filter(Boolean)
    .join("\n");

  const ai = getAiClient("website_enrich");
  const msg = await ai.messages.create({
    max_tokens: 1024,
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content:
          `Website: ${finalUrl}\n` +
          (metaSummary ? `\nPage metadata:\n${metaSummary}\n` : "") +
          `\nPage text:\n${text}\n\nExtract the company details as specified.`,
      },
    ],
  });

  const raw = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("The site produced no usable company details");
  let parsed: { fields?: Record<string, unknown>; confidence?: unknown; notes?: unknown };
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    throw new Error("The site produced no usable company details");
  }

  // Whitelist the keys — the form only ever offers columns we know about.
  const fields: EnrichFields = {};
  for (const key of ENRICH_FIELDS) {
    const v = parsed.fields?.[key];
    if (typeof v === "string" && v.trim()) fields[key] = v.trim().slice(0, 500);
  }

  const confidence =
    typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
      ? Math.min(1, Math.max(0, parsed.confidence))
      : null;

  return {
    source_url: finalUrl,
    fields,
    logo_candidates,
    confidence,
    notes: typeof parsed.notes === "string" && parsed.notes.trim() ? parsed.notes.trim().slice(0, 500) : null,
    inputTokens: msg.usage?.input_tokens ?? null,
    outputTokens: msg.usage?.output_tokens ?? null,
  };
}

/**
 * Downloads one of the logo candidates so it can be re-uploaded to Cloudinary.
 * Hot-linking the source site would break the moment they redeploy.
 */
export async function downloadImage(rawUrl: string): Promise<{ buffer: Buffer; mimetype: string }> {
  const url = await assertPublicUrl(rawUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MillionStayBot/1.0; +https://millionstay.com)" },
    });
    if (!res.ok) throw new Error(`The image could not be downloaded (HTTP ${res.status})`);
    const mimetype = (res.headers.get("content-type") ?? "").split(";")[0]?.trim() || "image/png";
    if (!/^image\//i.test(mimetype) && !/svg/i.test(mimetype)) {
      throw new Error("That link is not an image");
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > 5 * 1024 * 1024) throw new Error("That image is too large");
    if (!buffer.byteLength) throw new Error("That image is empty");
    return { buffer, mimetype };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw new Error("The image took too long to download");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
