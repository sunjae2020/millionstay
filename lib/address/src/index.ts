import { addressOrderFor, countryName, type AddressLang } from "./countries.js";

export * from "./countries.js";

/**
 * Postal address rendering, shared by the API and every frontend, per UPU S42 (the international addressing standard
 * Korea Post, USPS, Royal Mail and Japan Post all follow):
 *
 *   1. The address body is written the way the **destination country** writes
 *      it — that country's postal service does the final delivery, so its
 *      order is the one that matters. It is never reordered or translated.
 *   2. Only the **country name** is written in the reader's language.
 *
 * So the same Australian address keeps its Western order inside a Korean
 * document, and only "Australia" becomes "호주":
 *
 *   Level 5, 120 Collins St, Melbourne VIC 3000, 호주
 *   대한민국 경기도 안양시 동안구 동안로 35, 109동 901호
 *
 * One deliberate deviation from S42: for CJK countries the country name goes
 * **first**, not on a trailing line. S42's trailing-country rule exists for
 * envelopes; Korean and Japanese business documents write the country at the
 * front so the whole address stays consistently largest-unit-first.
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
  /** Free text as stored: "대한민국", "Australia", "KR"… */
  country?: string | null;
}

const clean = (v: string | null | undefined): string => (v ?? "").trim();

/** Korean spellings that should print the Korean postcode marker. */
const KR_ALIASES = ["kr", "kor", "korea", "south korea", "republic of korea", "한국", "대한민국"];
const JP_ALIASES = ["jp", "jpn", "japan", "일본", "日本"];

/**
 * Postcode as the destination country writes it. The marker belongs to the
 * address's own convention, not the reader's — 〒 is recognised worldwide and
 * (우) is what a Korean address prints.
 */
function postcodeLabel(postcode: string, country: string | null | undefined): string {
  if (!postcode) return "";
  const c = clean(country).toLowerCase();
  if (KR_ALIASES.includes(c)) return `(우) ${postcode}`;
  if (JP_ALIASES.includes(c)) return `〒${postcode}`;
  return postcode;
}

/**
 * Render a single-line postal address. Ordering follows `parts.country`;
 * `lang` only decides which language the country name is written in.
 * Empty parts are dropped; an all-empty address returns "".
 */
export function formatPostalAddress(
  parts: AddressParts,
  lang: AddressLang,
  opts: {
    /**
     * Country to assume for ORDERING when the record has none — pass the
     * issuer's own country, since a blank country almost always means a
     * domestic address. It is never printed: an assumed country has no place
     * on a document, only an assumed layout does.
     */
     orderFallbackCountry?: string | null;
  } = {},
): string {
  const line1 = clean(parts.line1);
  const line2 = clean(parts.line2);
  const suburb = clean(parts.suburb);
  const state = clean(parts.state);
  const postcode = clean(parts.postcode);
  const country = countryName(parts.country, lang);

  const orderCountry = clean(parts.country) || clean(opts.orderFallbackCountry);
  if (addressOrderFor(orderCountry) === "largest-first") {
    // 대한민국 경기도 안양시 동안구 동안로 35, 109동 901호 (우) 14054
    // Space-separated; the street line keeps its own commas, which is exactly
    // how a Korean address is written.
    const head = [country, state, suburb, line1, line2].filter(Boolean).join(" ");
    return [head, postcodeLabel(postcode, orderCountry)].filter(Boolean).join(" ");
  }

  // Level 5, 120 Collins St, Melbourne VIC 3000, 호주
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
 * An address we only hold as one free-text blob is returned untouched —
 * reordering text we cannot parse would do more harm than good.
 */
export function formatAddressBlob(blob: string | null | undefined): string {
  return clean(blob);
}

/**
 * Ordering fallback for a record with no country stored, derived from the
 * language being displayed. The API has a better signal — the issuer's own
 * country — so this is for frontends, which only know the UI language.
 */
export function orderFallbackFromLang(lang: AddressLang): string {
  return { ko: "대한민국", ja: "일본", zh: "중국", en: "", th: "", vi: "" }[lang] ?? "";
}
