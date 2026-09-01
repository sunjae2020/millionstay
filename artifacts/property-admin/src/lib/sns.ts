/**
 * 메신저(SNS) 종류 — 연락처와 계정이 함께 쓴다.
 *
 * 값은 DB 에 그대로 저장되는 식별자이므로 번역하지 않는다. 화면 표기는
 * `t("contact.sns_" + value.toLowerCase())` 로 로케일별 이름을 찾는다.
 */
export const SNS_TYPES = [
  "KakaoTalk", "LINE", "WhatsApp", "WeChat", "Telegram", "Instagram", "Facebook", "Other",
] as const;

export type SnsType = (typeof SNS_TYPES)[number];

/** 종류별 입력 힌트 — 아이디 형식이 서로 달라 빈칸을 덜 헷갈리게 한다. */
export const SNS_PLACEHOLDER: Record<string, string> = {
  KakaoTalk: "kakao_id",
  LINE: "line_id",
  WhatsApp: "+82 10 1234 5678",
  WeChat: "wechat_id",
  Telegram: "@telegram",
  Instagram: "@instagram",
  Facebook: "facebook.com/…",
};

/** i18n 키 — SNS_TYPES 의 값을 로케일 이름으로 옮긴다. */
export function snsLabelKey(type: string): string {
  return `contact.sns_${type.toLowerCase()}`;
}
