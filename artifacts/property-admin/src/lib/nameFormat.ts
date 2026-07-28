// App-wide person-name rules. Mirrors api-server/src/lib/nameFormat.ts — keep the
// two in sync so screens, documents and emails read identically.
//
// Casing (new records are normalized server-side on write; this renders existing
// records consistently too):
//   first name → first letter UPPER, rest lower   ("YUYA"  → "Yuya")
//   last name  → ALL UPPERCASE                     ("Fujii" → "FUJII")
//
// Display order:
//   CJK names   → family name first, no space       (김 + 선재   → "김선재")
//   Latin names → given name first, family in caps  (Sunjae + KIM → "Sunjae KIM")
// Uppercasing is a no-op for Hangul/Kana/Han, so the casing rule is safe for
// every script — only the join order differs.
//
// Person lists sort by family name then given name — use personSortKey.

/** Hangul, Kana or Han characters anywhere in the string. */
const CJK_RE = /[ᄀ-ᇿ぀-ヿ㄰-㆏㐀-䶿一-鿿ꥠ-꥿가-힯豈-﫿]/;

export function hasCjk(s?: string | null): boolean {
  return CJK_RE.test(s ?? "");
}

export function formatFirstName(s?: string | null): string {
  const v = (s ?? "").trim();
  // Capitalise every segment so compound given names survive: "anne-marie" →
  // "Anne-Marie", "mary jane" → "Mary Jane", "o'brien" → "O'Brien".
  return v.toLowerCase().replace(/(^|[\s\-'\u2019])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

export function formatLastName(s?: string | null): string {
  return (s ?? "").trim().toUpperCase();
}

export function formatPersonName(first?: string | null, last?: string | null): string {
  const f = formatFirstName(first);
  const l = formatLastName(last);
  if (!f || !l) return f || l;
  // Korean/Japanese/Chinese names read family-name-first and are written without
  // a separating space (김선재, not 김 선재).
  return hasCjk(f) || hasCjk(l) ? `${l}${f}` : `${f} ${l}`;
}

/** Ordering key for person lists: family name, then given name. */
export function personSortKey(first?: string | null, last?: string | null): string {
  return `${(last ?? "").trim()} ${(first ?? "").trim()}`.trim().toLocaleLowerCase();
}
