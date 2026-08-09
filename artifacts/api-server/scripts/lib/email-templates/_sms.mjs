// SMS 템플릿 공용 유틸 — 길이 계산과 발송 규칙.
//
// 한국 SMS 는 이메일과 제약이 다르다. 가장 큰 차이는 **글자 수가 곧 비용**이라는 것.
//
//   SMS  90바이트 이하   (한글 45자)      — 가장 싸다. 기본 목표.
//   LMS  2,000바이트 이하 (한글 약 1,000자) — SMS 의 3배 안팎.
//   MMS  이미지 포함                       — 더 비싸다. 여기서는 쓰지 않는다.
//
// 국내 사업자는 EUC-KR 기준으로 센다: 한글·완성형 한자 2바이트, ASCII 1바이트.
// 줄바꿈은 개행 1자로 친다.
//
// ⚠️ `{{변수}}` 는 발송 시점에 값으로 치환된다. 리터럴 길이로 재면 실제 발송 문자가
//    LMS 로 넘어가도 모른다. 그래서 각 변수에 **현실적인 최대 표본값**을 정의하고,
//    치환한 뒤의 길이로 판정한다.
//
// ⚠️ 광고성 SMS(정보통신망법 제50조)의 (광고) 표기와 **무료수신거부 번호**는 문안에
//    쓰지 않는다. 발송 코드가 붙인다. 무료거부번호는 이메일과 달리 링크가 아니라
//    080 번호여야 하므로, SMS 광고는 그 번호가 준비되기 전에는 보내면 안 된다.

/** 국내 사업자 과금 기준 바이트 수 (EUC-KR: 한글 2, ASCII 1). */
export function smsBytes(text) {
  let n = 0;
  for (const ch of text) n += /[\x00-\x7F]/.test(ch) ? 1 : 2;
  return n;
}

/**
 * 길이 판정용 표본값. 실제로 들어갈 수 있는 **긴 쪽**을 넣는다 —
 * 짧은 값으로 재면 통과했다가 현장에서 LMS 로 넘어간다.
 */
export const SMS_SAMPLES = {
  recipient: "김민수",
  brand: "메트하임",
  ref: "INV-2026-00123",
  space_name: "101동 1203호",
  address: "전남 여수시 좌수영로 101",
  amount: "1,250,000원",
  due_date: "8월 25일",
  date: "8월 25일(화)",
  time_window: "14시–16시",
  url: "https://mth.kr/a1B2c3",   // 단축 URL 전제
  contact_phone: "061-123-4567",
  code: "384712",
  expiry_minutes: "10",
  days_overdue: "15",
  job_type: "입주청소",
  purpose: "세대 점검",
  access_code: "#1234*",
  partner_company: "행복공인중개사",
  period: "2026년 7월",
  net_amount: "820,000원",
  client_name: "박지연",
  status: "계약 완료",
};

/** {{변수}} 를 표본값으로 치환. 표본이 없으면 변수명 길이로 대체(과소평가 방지). */
export function renderSample(text) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k) => SMS_SAMPLES[k] ?? `[${k}]`);
}

/** SMS 90바이트 초과 여부와 판정 등급. */
export function smsGrade(text) {
  const bytes = smsBytes(renderSample(text));
  return { bytes, type: bytes <= 90 ? "SMS" : bytes <= 2000 ? "LMS" : "OVER" };
}
