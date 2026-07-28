/**
 * Country values, written in the language the record is kept in.
 *
 * `accounts.address_country` is free text and had drifted into a mix of ISO
 * codes ("KR") and English names ("Australia"). Korean-market records are now
 * stored in Korean ("대한민국") so the value reads the same in the admin, in
 * generated documents and in a raw database dump — no lookup table needed to
 * understand a row.
 *
 * The list is a convenience, not a constraint: the field still accepts free
 * text for anywhere not listed.
 */
export interface CountryOption {
  /** Stored value. */
  value: string;
  /** Legacy spellings migrated/matched onto this option. */
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

/**
 * Maps a stored value onto a known option. Lets a row saved as "KR" before the
 * migration still select correctly in the dropdown.
 */
export function normaliseCountry(value?: string | null): string {
  const v = (value ?? "").trim();
  if (!v) return "";
  const hit = COUNTRIES.find(
    (c) => c.value === v || c.aliases.some((a) => a.toLowerCase() === v.toLowerCase()),
  );
  return hit?.value ?? v;
}

/**
 * Default country for new records. Per-instance so the Korean instance does not
 * impose 대한민국 on the Australian one; unset keeps the previous default.
 */
export function defaultCountry(): string {
  return (import.meta.env["VITE_DEFAULT_COUNTRY"] as string | undefined)?.trim() || "Australia";
}
