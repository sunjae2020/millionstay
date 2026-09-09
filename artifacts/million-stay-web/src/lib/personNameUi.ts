// 사람 이름을 "입력"하는 폼의 언어별 칸 순서. 표시·정렬 규칙은 nameFormat.ts.
//
// 한국어 화면에서는 성 칸을 이름 칸보다 먼저 놓는다(성 → 이름). 게스트 웹은
// MillionStay 마켓플레이스도 함께 쓰므로, 단일 건물(Metheim) 인스턴스에서
// 한국어로 볼 때만 적용한다 — property-admin 쪽은 테넌트 구분 없이 언어만
// 본다(거기는 한국어 = Metheim 이다).

import { useTranslation } from "react-i18next";
import { isDevelopmentSite } from "./site-mode";

/** 현재 화면이 성 → 이름 순서를 쓰는지. */
export function useKoreanNameOrder(): boolean {
  const { i18n } = useTranslation();
  return isDevelopmentSite() && (i18n.language ?? "").toLowerCase().startsWith("ko");
}

/**
 * 성·이름 입력 칸을 화면에 맞는 순서로 돌려준다.
 * `{orderNameFields(ko, <이름칸/>, <성칸/>)}` 형태로 쓴다.
 */
export function orderNameFields<T>(koreanOrder: boolean, first: T, last: T): [T, T] {
  return koreanOrder ? [last, first] : [first, last];
}
