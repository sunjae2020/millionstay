// ---------------------------------------------------------------------------
// AI drafts for SEO / GEO prose — and ONLY prose.
//
// Three rules hold this down:
//   1. Draft-only. Nothing here reaches a live page. The output is stored in
//      seo_audits.generated_json and waits for a human to press Approve.
//   2. Never throws. A missing key or a bad response must not fail the audit
//      that asked for it, so every failure path returns {}.
//   3. No invention. The model sees the page's own title and body and is told
//      to write from that alone. It cannot check a price or an address.
// ---------------------------------------------------------------------------

import { getAiClient, isTaskConfigured } from "../ai/client.js";
import { extractBodySignals, type SeoFaqPair, type SeoSubject } from "./scoring.js";

export interface SeoDrafts {
  seo_description?: string;
  geo_answer_summary?: string;
  geo_faq?: SeoFaqPair[];
}

const SYSTEM = [
  "You write metadata for a property-management company's public website.",
  "",
  "You are given one page: its language, title and body text. Write only from",
  "that material. Never invent a fact, figure, price, date, address or claim",
  "that is not present in the body. If the body does not support a field, omit",
  "that field entirely rather than filling it with something plausible.",
  "",
  "Write in the SAME LANGUAGE as the page body.",
  "",
  "Return ONLY a JSON object, no prose around it, with these optional keys:",
  '  "seo_description": 120-165 characters. One sentence a search engine can',
  "      show as the result snippet. No quotation marks, no brand boilerplate.",
  '  "geo_answer_summary": 120-180 words. A self-contained answer an AI search',
  "      engine could quote on its own, without the surrounding page. Lead with",
  "      the direct answer, then the specifics that support it. Plain prose, no",
  "      lists, no headings, no first-person marketing voice.",
  '  "geo_faq": 3-5 objects of { "q", "a" }. Real questions a reader would ask',
  "      about THIS page, each answered in one to three sentences from the body.",
].join("\n");

/** Trim the body so a long page cannot blow out the prompt. */
function bodyExcerpt(subject: SeoSubject): string {
  const signals = extractBodySignals(subject.bodyJson, subject.legacyHtml);
  return signals.text.slice(0, 6000);
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed: unknown = JSON.parse(raw.slice(start, end + 1));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function cleanText(value: unknown, maxChars: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (!text) return undefined;
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

function cleanFaq(value: unknown): SeoFaqPair[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const pairs: SeoFaqPair[] = [];
  for (const entry of value.slice(0, 8)) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const q = cleanText(row["q"], 300);
    const a = cleanText(row["a"], 1200);
    if (q && a) pairs.push({ q, a });
  }
  return pairs.length > 0 ? pairs : undefined;
}

/**
 * Draft the prose fields this page is missing. Fields that already have a value
 * are not redrafted — the point is to fill gaps, not to overwrite an editor.
 * Returns {} when the task is unconfigured, the call fails, or the model
 * returns something we cannot parse.
 */
export async function generateSeoGeoDrafts(subject: SeoSubject): Promise<SeoDrafts> {
  if (!isTaskConfigured("seo_geo_draft")) return {};

  const body = bodyExcerpt(subject);
  const title = subject.seoTitle?.trim() || subject.title?.trim() || subject.slug;
  // Nothing to write from: an empty page would only produce invention.
  if (body.length < 80 && !title) return {};

  const wanted: string[] = [];
  if (!subject.seoDescription?.trim()) wanted.push("seo_description");
  if (!subject.geoAnswerSummary?.trim()) wanted.push("geo_answer_summary");
  if (!Array.isArray(subject.geoFaq) || subject.geoFaq.length < 3) wanted.push("geo_faq");
  if (wanted.length === 0) return {};

  const user = [
    `Language: ${subject.locale}`,
    `Title: ${title}`,
    `Fields to return: ${wanted.join(", ")}`,
    "",
    "Body:",
    body || "(the page has no body text; return only fields the title supports)",
  ].join("\n");

  try {
    const ai = getAiClient("seo_geo_draft");
    const message = await ai.messages.create({
      max_tokens: 2048,
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
    });
    const raw = message.content.map((block) => (block.type === "text" ? block.text : "")).join("");
    const parsed = parseJsonObject(raw);
    if (!parsed) return {};

    const drafts: SeoDrafts = {};
    if (wanted.includes("seo_description")) {
      const value = cleanText(parsed["seo_description"], 320);
      if (value) drafts.seo_description = value;
    }
    if (wanted.includes("geo_answer_summary")) {
      const value = cleanText(parsed["geo_answer_summary"], 3000);
      if (value) drafts.geo_answer_summary = value;
    }
    if (wanted.includes("geo_faq")) {
      const value = cleanFaq(parsed["geo_faq"]);
      if (value) drafts.geo_faq = value;
    }
    return drafts;
  } catch {
    // Draft generation is a convenience. An audit must still complete without it.
    return {};
  }
}
