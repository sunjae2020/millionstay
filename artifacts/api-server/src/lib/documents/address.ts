import type { DocLang } from "./i18n.js";

/**
 * Postal address ordering differs by language, and a document that mixes the
 * two reads as a translation mistake to whoever receives it.
 *
 * Western order runs small → large and separates with commas:
 *   `동안로 35, 109동 901호, 안양시 동안구, 경기도 14054, 대한민국`
 *
 * CJK order runs large → small and separates with spaces, keeping any commas
 * that belong *inside* the street line:
 *   `대한민국 경기도 안양시 동안구 동안로 35, 109동 901호`
 *
 * The postcode is appended in the form each language actually writes it —
 * `(우) 14054` in Korean, `〒154-0004` in Japanese — rather than being wedged
 * next to the province the way an Australian address does it.
 */
export interface AddressParts {
  /** Street / road-name line, plus unit or building detail. */
  line1?: string | null;
  line2?: string | null;
  /** City / district — 시·군·구, 市区町村. */
  suburb?: string | null;
  /** State / province — 도, 都道府県, 省. */
  state?: string | null;
  postcode?: string | null;
  country?: string | null;
}

/** Languages whose addresses run country → … → street. */
const CJK_ORDER: ReadonlySet<string> = new Set(["ko", "ja", "zh"]);

/** True when addresses for this document language read largest-unit first. */
export function usesLargestFirstAddress(lang: DocLang): boolean {
  return CJK_ORDER.has(lang);
}

const clean = (v: string | null | undefined): string => (v ?? "").trim();

/** Postcode as the language writes it, or "" when there is none. */
function postcodeLabel(postcode: string, lang: DocLang): string {
  if (!postcode) return "";
  if (lang === "ko") return `(우) ${postcode}`;
  if (lang === "ja") return `〒${postcode}`;
  return postcode;
}

/**
 * Render a single-line postal address in the given document language.
 * Empty parts are dropped; an all-empty address returns "".
 */
export function formatPostalAddress(parts: AddressParts, lang: DocLang): string {
  const line1 = clean(parts.line1);
  const line2 = clean(parts.line2);
  const suburb = clean(parts.suburb);
  const state = clean(parts.state);
  const postcode = clean(parts.postcode);
  const country = clean(parts.country);

  if (usesLargestFirstAddress(lang)) {
    // Largest unit first, space-separated. The street line keeps its own commas
    // (`동안로 35, 109동 901호`), which is exactly how Koreans write it.
    const head = [country, state, suburb, line1, line2].filter(Boolean).join(" ");
    const pc = postcodeLabel(postcode, lang);
    return [head, pc].filter(Boolean).join(" ");
  }

  // Western: street → city → state+postcode → country, comma-separated.
  return [
    line1,
    line2,
    suburb,
    [state, postcode].filter(Boolean).join(" ").trim() || null,
    country,
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * Same ordering rules for an address whose parts were never captured
 * separately — a single free-text blob is returned untouched, because
 * re-ordering text we cannot parse would do more harm than good.
 */
export function formatAddressBlob(blob: string | null | undefined): string {
  return clean(blob);
}
