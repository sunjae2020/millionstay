/**
 * korean-name.mjs — split a Korean (or romanised) full name into 성/이름.
 *
 * contacts.first_name / last_name are stored separately everywhere in the app;
 * Korean source data (lease lists, spreadsheets) carries one 성함 string.
 * Rule: surname = first syllable, given name = the rest, with the standard
 * two-syllable compound surnames as exceptions. Latin names split on whitespace
 * (first token = surname, matching the KR/CN convention these records use).
 */

// Two-syllable Korean surnames (복성).
const COMPOUND_SURNAMES = [
  "남궁", "황보", "제갈", "선우", "독고", "사공", "서문", "동방", "西門",
  "어금", "망절", "소봉",
];

const HANGUL = /[가-힣]/;

/** @returns {{ last_name: string, first_name: string }} */
export function splitKoreanName(raw) {
  const name = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (!name) return { last_name: "", first_name: "" };

  // Latin / mixed-script (e.g. "ZHANG QIANSHUO") → first token is the surname.
  if (!HANGUL.test(name)) {
    const parts = name.split(" ");
    if (parts.length === 1) return { last_name: "", first_name: parts[0] };
    return { last_name: parts[0], first_name: parts.slice(1).join(" ") };
  }

  // Korean name written with a space ("홍 길동") → respect the author's split.
  if (name.includes(" ")) {
    const [head, ...rest] = name.split(" ");
    if (head.length <= 2 && rest.join("").length >= 1) {
      return { last_name: head, first_name: rest.join(" ") };
    }
  }

  const compound = COMPOUND_SURNAMES.find((s) => name.startsWith(s) && name.length > s.length);
  if (compound) return { last_name: compound, first_name: name.slice(compound.length) };

  // Single-syllable name (rare) → keep it whole as the given name.
  if (name.length < 2) return { last_name: "", first_name: name };

  return { last_name: name.slice(0, 1), first_name: name.slice(1) };
}

/** Display form used by Korean UIs: 성 + 이름, no space. */
export function joinKoreanName(last_name, first_name) {
  return `${last_name ?? ""}${first_name ?? ""}`.trim();
}

// Organisation names must never be split into 성/이름 — they get an account only.
const ORG_MARKERS = [
  "㈜", "(주)", "주식회사", "유한회사", "병원", "의원", "치과", "한의원", "약국",
  "교회", "성당", "사찰", "학교", "대학", "센터", "재단", "법인", "조합", "공단",
  "공사", "사무소", "산업", "건설", "부동산", "관리단", "회사", "협회", "위원회",
  "요양원", "어린이집", "유치원", "연구소", "상사", "기업",
];

export function looksLikeOrganisation(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return false;
  return ORG_MARKERS.some((m) => s.includes(m));
}
