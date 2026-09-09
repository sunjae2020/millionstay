// 사람 이름을 "입력"하는 화면의 언어별 규칙. 표시·정렬 규칙은 nameFormat.ts.
//
// 한국어 화면에서는
//   · 성 칸을 이름 칸보다 먼저 놓고(성 → 이름),
//   · Mr/Ms 같은 영문 호칭 칸은 아예 감춘다(대응하는 한국어 표기가 없다).
// 테넌트가 아니라 화면 언어로 판단하므로 Metheim(기본 한국어)과 MillionStay가
// 같은 코드로 동작한다.

import { useTranslation } from "react-i18next";

export function isKoreanNameOrder(lang?: string | null): boolean {
  return (lang ?? "").toLowerCase().startsWith("ko");
}

/** 현재 화면 언어가 성 → 이름 순서를 쓰는지. */
export function useKoreanNameOrder(): boolean {
  const { i18n } = useTranslation();
  return isKoreanNameOrder(i18n.language);
}

/**
 * 성·이름 입력 칸을 화면 언어에 맞는 순서로 돌려준다.
 * `const [a, b] = orderNameFields(ko, <이름칸/>, <성칸/>)` 형태로 쓴다.
 */
export function orderNameFields<T>(koreanOrder: boolean, first: T, last: T): [T, T] {
  return koreanOrder ? [last, first] : [first, last];
}
