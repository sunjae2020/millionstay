import { getAnthropic, getCsTranslateModel, isChatConfigured } from "./anthropic.js";

/**
 * CS message auto-translation.
 *
 * A CS ticket is conducted in the requester's chosen language (`customer_language`)
 * while admins read/write English. Every message is stored once in its original
 * language (`cs_messages.message`) and translated into the set
 * `{ customer_language, en }` so the customer always reads their own language and
 * the admin always has an English copy. Translations are persisted in
 * `cs_messages.translations` (keyed by language code) — they are NOT re-computed
 * on read.
 *
 * This runs on a cheap model (Haiku by default, see getCsTranslateModel) because
 * the workload is high-volume and simple. The whole job is a single API call:
 * one source string → a JSON object of { lang: translation } for every target.
 */

// Per-language tone/preservation guidance. Mirrors LANG_INFO in
// routes/translations.ts so script-, marketing- and CS-translation stay
// consistent in register.
const LANG_INFO: Record<string, { name: string; style: string }> = {
  en: { name: "English", style: "Use clear, polite, professional English." },
  ko: { name: "Korean", style: "Use polite formal Korean (합쇼체)." },
  zh: { name: "Simplified Chinese", style: "Use formal Simplified Chinese." },
  ja: { name: "Japanese", style: "Use polite formal Japanese (です/ます体)." },
  th: { name: "Thai", style: "Use formal, polite Thai." },
  vi: { name: "Vietnamese", style: "Use formal Vietnamese." },
};

export function langDisplayName(code: string): string {
  return LANG_INFO[code]?.name ?? code;
}

/**
 * Given the source language and the languages the ticket needs, return the set
 * of target languages to translate INTO — i.e. { customer_language, en } minus
 * the original language (and anything we don't know how to translate).
 */
export function targetLangsFor(originalLang: string, customerLanguage: string): string[] {
  const wanted = new Set<string>(["en", customerLanguage]);
  wanted.delete(originalLang);
  return [...wanted].filter((l) => l in LANG_INFO);
}

export interface TranslateResult {
  translations: Record<string, string>;
  inputTokens: number | null;
  outputTokens: number | null;
}

/**
 * Translate one CS message into several target languages in a single call.
 * Throws on misconfiguration (no API key) or API failure — callers persist a
 * `translation_status` of 'failed' and surface a retry affordance. Returns an
 * empty translation map (no-op) when there are no target languages.
 */
export async function translateMessage(
  text: string,
  originalLang: string,
  targetLangs: string[],
): Promise<TranslateResult> {
  if (targetLangs.length === 0 || !text.trim()) {
    return { translations: {}, inputTokens: null, outputTokens: null };
  }
  if (!isChatConfigured()) {
    throw new Error("AI translation is not configured: set ANTHROPIC_API_KEY.");
  }

  const anthropic = getAnthropic();
  const sourceName = langDisplayName(originalLang);
  const targetSpec = targetLangs
    .map((l) => `"${l}" (${LANG_INFO[l]?.name ?? l}${LANG_INFO[l]?.style ? ` — ${LANG_INFO[l]?.style}` : ""})`)
    .join(", ");

  const system =
    `You are a professional translator handling customer-support messages for MillionStay / Million Homestay, ` +
    `a student accommodation and homestay platform in Melbourne, Australia. ` +
    `The message is written in ${sourceName}. Translate its full meaning faithfully and naturally, in a polite, helpful support tone. ` +
    `Keep the brand names "MillionStay" and "Million Homestay" in English. Keep Australian suburb, city and university names in English. ` +
    `Keep ticket references (e.g. CS-2026-0001), booking references, URLs, email addresses, amounts, dates and numbers EXACTLY as written. ` +
    `Preserve line breaks and punctuation. Do not add greetings, signatures, notes or commentary that are not in the source. ` +
    `You must produce a translation for each of these target languages: ${targetSpec}. ` +
    `Respond with ONLY a JSON object whose keys are the target language codes (${targetLangs.map((l) => `"${l}"`).join(", ")}) ` +
    `and whose values are the translated message text. Do not add, drop or rename keys.`;

  const msg = await anthropic.messages.create({
    model: getCsTranslateModel(),
    max_tokens: 4096,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: text }],
  });

  const raw = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const jsonStr = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
  const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

  const translations: Record<string, string> = {};
  for (const lang of targetLangs) {
    const v = parsed[lang];
    if (typeof v === "string" && v.trim()) translations[lang] = v.trim();
  }
  if (Object.keys(translations).length === 0) {
    throw new Error("Translation produced no usable output");
  }

  return {
    translations,
    inputTokens: msg.usage?.input_tokens ?? null,
    outputTokens: msg.usage?.output_tokens ?? null,
  };
}
