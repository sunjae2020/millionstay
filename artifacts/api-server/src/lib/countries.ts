/**
 * Country values, written in the language the record is kept in.
 *
 * Mirrors property-admin/src/lib/countries.ts — keep the two in sync. Anything
 * the server derives (ID-document reading, business-card OCR) has to emit the
 * SAME canonical value the admin's country dropdown stores, otherwise an
 * auto-filled field lands on a value the select cannot show.
 */
export interface CountryOption {
  /** Stored value. */
  value: string;
  /** Legacy spellings and ISO codes matched onto this option. */
  aliases: string[];
}

export const COUNTRIES: CountryOption[] = [
  { value: "대한민국", aliases: ["KR", "KOR", "Korea", "South Korea", "Republic of Korea", "한국"] },
  { value: "호주", aliases: ["AU", "AUS", "Australia"] },
  { value: "일본", aliases: ["JP", "JPN", "Japan"] },
  { value: "중국", aliases: ["CN", "CHN", "China"] },
  { value: "대만", aliases: ["TW", "TWN", "Taiwan"] },
  { value: "태국", aliases: ["TH", "THA", "Thailand"] },
  { value: "베트남", aliases: ["VN", "VNM", "Vietnam", "Viet Nam"] },
  { value: "싱가포르", aliases: ["SG", "SGP", "Singapore"] },
  { value: "말레이시아", aliases: ["MY", "MYS", "Malaysia"] },
  { value: "필리핀", aliases: ["PH", "PHL", "Philippines"] },
  { value: "인도네시아", aliases: ["ID", "IDN", "Indonesia"] },
  { value: "미국", aliases: ["US", "USA", "United States", "United States of America"] },
  { value: "캐나다", aliases: ["CA", "CAN", "Canada"] },
  { value: "뉴질랜드", aliases: ["NZ", "NZL", "New Zealand"] },
  { value: "영국", aliases: ["GB", "UK", "GBR", "United Kingdom"] },
];

/** Every spelling the model may reasonably produce, for the prompt. */
export const COUNTRY_PROMPT_LIST = COUNTRIES.map(
  (c) => `"${c.value}" (${c.aliases.slice(0, 3).join(" / ")})`,
).join(", ");

/** Maps a value (Korean name, English name or ISO code) onto the stored value. */
export function normaliseCountry(value?: string | null): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  const hit = COUNTRIES.find(
    (c) => c.value === v || c.aliases.some((a) => a.toLowerCase() === v.toLowerCase()),
  );
  return hit?.value ?? null;
}
