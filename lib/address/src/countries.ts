
/**
 * Country vocabulary for address rendering, shared by the API and every app.
 *
 * `accounts.address_country` is free text and holds a mix of ISO codes ("KR")
 * and names in whichever language the record was kept in ("대한민국",
 * "Australia"). Rendering needs two things from it: which address *order* the
 * country uses, and how to write the country's name in the reader's language.
 *
 * property-admin/src/lib/countries.ts drives the admin dropdown (stored values
 * + legacy aliases); this drives display. Keep the aliases in sync when a
 * country is added.
 */

/** Languages the apps render documents and UI in. */
export type AddressLang = "en" | "ko" | "ja" | "zh" | "th" | "vi";

/** Address ordering convention used by a country's postal service. */
export type AddressOrder = "largest-first" | "smallest-first";

interface CountryEntry {
  /** Canonical stored value (Korean, matching the admin dropdown). */
  canonical: string;
  order: AddressOrder;
  /** Lower-cased spellings that map onto this country. */
  aliases: string[];
  names: Readonly<Record<AddressLang, string>>;
}

/**
 * Only CJK countries (plus Hungary, not served) write addresses largest-unit
 * first. Everything else — including Vietnam and Thailand — runs street first.
 */
const COUNTRIES: readonly CountryEntry[] = [
  { canonical: "대한민국", order: "largest-first",
    aliases: ["kr", "kor", "korea", "south korea", "republic of korea", "한국", "대한민국"],
    names: { en: "South Korea", ko: "대한민국", ja: "韓国", zh: "韩国", th: "เกาหลีใต้", vi: "Hàn Quốc" } },
  { canonical: "일본", order: "largest-first",
    aliases: ["jp", "jpn", "japan", "일본", "日本"],
    names: { en: "Japan", ko: "일본", ja: "日本", zh: "日本", th: "ญี่ปุ่น", vi: "Nhật Bản" } },
  { canonical: "중국", order: "largest-first",
    aliases: ["cn", "chn", "china", "중국", "中国"],
    names: { en: "China", ko: "중국", ja: "中国", zh: "中国", th: "จีน", vi: "Trung Quốc" } },
  { canonical: "대만", order: "largest-first",
    aliases: ["tw", "twn", "taiwan", "대만", "台湾", "台灣"],
    names: { en: "Taiwan", ko: "대만", ja: "台湾", zh: "台湾", th: "ไต้หวัน", vi: "Đài Loan" } },

  { canonical: "호주", order: "smallest-first",
    aliases: ["au", "aus", "australia", "호주"],
    names: { en: "Australia", ko: "호주", ja: "オーストラリア", zh: "澳大利亚", th: "ออสเตรเลีย", vi: "Úc" } },
  { canonical: "태국", order: "smallest-first",
    aliases: ["th", "tha", "thailand", "태국"],
    names: { en: "Thailand", ko: "태국", ja: "タイ", zh: "泰国", th: "ประเทศไทย", vi: "Thái Lan" } },
  { canonical: "베트남", order: "smallest-first",
    aliases: ["vn", "vnm", "vietnam", "viet nam", "베트남"],
    names: { en: "Vietnam", ko: "베트남", ja: "ベトナム", zh: "越南", th: "เวียดนาม", vi: "Việt Nam" } },
  { canonical: "싱가포르", order: "smallest-first",
    aliases: ["sg", "sgp", "singapore", "싱가포르"],
    names: { en: "Singapore", ko: "싱가포르", ja: "シンガポール", zh: "新加坡", th: "สิงคโปร์", vi: "Singapore" } },
  { canonical: "말레이시아", order: "smallest-first",
    aliases: ["my", "mys", "malaysia", "말레이시아"],
    names: { en: "Malaysia", ko: "말레이시아", ja: "マレーシア", zh: "马来西亚", th: "มาเลเซีย", vi: "Malaysia" } },
  { canonical: "필리핀", order: "smallest-first",
    aliases: ["ph", "phl", "philippines", "필리핀"],
    names: { en: "Philippines", ko: "필리핀", ja: "フィリピン", zh: "菲律宾", th: "ฟิลิปปินส์", vi: "Philippines" } },
  { canonical: "인도네시아", order: "smallest-first",
    aliases: ["id", "idn", "indonesia", "인도네시아"],
    names: { en: "Indonesia", ko: "인도네시아", ja: "インドネシア", zh: "印度尼西亚", th: "อินโดนีเซีย", vi: "Indonesia" } },
  { canonical: "미국", order: "smallest-first",
    aliases: ["us", "usa", "united states", "united states of america", "미국"],
    names: { en: "United States", ko: "미국", ja: "アメリカ合衆国", zh: "美国", th: "สหรัฐอเมริกา", vi: "Hoa Kỳ" } },
  { canonical: "캐나다", order: "smallest-first",
    aliases: ["ca", "can", "canada", "캐나다"],
    names: { en: "Canada", ko: "캐나다", ja: "カナダ", zh: "加拿大", th: "แคนาดา", vi: "Canada" } },
  { canonical: "뉴질랜드", order: "smallest-first",
    aliases: ["nz", "nzl", "new zealand", "뉴질랜드"],
    names: { en: "New Zealand", ko: "뉴질랜드", ja: "ニュージーランド", zh: "新西兰", th: "นิวซีแลนด์", vi: "New Zealand" } },
  { canonical: "영국", order: "smallest-first",
    aliases: ["gb", "uk", "gbr", "united kingdom", "great britain", "영국"],
    names: { en: "United Kingdom", ko: "영국", ja: "イギリス", zh: "英国", th: "สหราชอาณาจักร", vi: "Vương quốc Anh" } },
];

const BY_ALIAS = new Map<string, CountryEntry>();
for (const c of COUNTRIES) {
  for (const a of c.aliases) BY_ALIAS.set(a, c);
  for (const n of Object.values(c.names)) BY_ALIAS.set(n.toLowerCase(), c);
}

/** Look up a stored country value; null for blank or unrecognised text. */
function lookup(raw: string | null | undefined): CountryEntry | null {
  const key = (raw ?? "").trim().toLowerCase();
  return key ? BY_ALIAS.get(key) ?? null : null;
}

/**
 * Address ordering for a stored country value. Unknown countries fall back to
 * the Western order, which is what the large majority of the world uses.
 */
export function addressOrderFor(country: string | null | undefined): AddressOrder {
  return lookup(country)?.order ?? "smallest-first";
}

/**
 * The country's name in the reader's language. Unrecognised values are passed
 * through unchanged — a hand-typed country is better shown as typed than
 * dropped.
 */
export function countryName(country: string | null | undefined, lang: AddressLang): string {
  const raw = (country ?? "").trim();
  const entry = lookup(raw);
  return entry ? entry.names[lang] ?? entry.names.en : raw;
}
