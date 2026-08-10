// SMS 템플릿 공용 유틸 — 길이 계산과 발송 규칙.
//
// 규격 출처: SOLAPI 문자메시지 가이드 (https://solapi.com/guides/sms).
// 한국 SMS 는 이메일과 제약이 다르다. 가장 큰 차이는 **글자 수가 곧 비용**이라는 것.
//
//   SMS  90바이트 이하   (한글 45자)      제목 미지원.        가장 싸다 — 기본 목표.
//   LMS  2,000바이트 이하 (한글 약 1,000자) 제목 지원.          SMS 의 3배 안팎.
//   MMS  2,000바이트 + 이미지(JPG 200KB)                      더 비싸다. 쓰지 않는다.
//
// 바이트 계산(솔라피 명시): **영문·숫자·공백·줄바꿈 1바이트, 한글 1자당 2바이트.**
// 개행이 1바이트라 줄을 나눠도 비용이 크게 늘지 않는다 — 가독성을 위해 나눠 쓴다.
//
// 🚨 **제목을 넣으면 본문이 90바이트 이하라도 LMS 로 자동 전환된다**(솔라피). 그래서
//    SMS 템플릿은 subject 를 null 로 저장한다. 시드에서 subject 를 채우지 말 것.
//
// 🚨 이모지·특수문자는 EUC-KR 로 인코딩되지 않아 LMS 전환 또는 발송 실패를 부른다.
//    아래 hasNonEucKr() 로 걸러낸다.
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

/**
 * EUC-KR 로 인코딩할 수 없는 문자(이모지·특수기호 등)를 찾는다.
 * 국내 사업자는 EUC-KR 계열로 처리하므로, 이런 문자가 있으면 LMS 로 전환되거나
 * 발송이 실패하거나 수신 단말에서 깨진다.
 *
 * 허용: ASCII · 한글(완성형+자모) · 완성형 한자 · 전각 문장부호 일부(，。「」·—) ·
 *       KS X 1001 에 있는 기호(※ ○ △ 등).
 * 실무상 안전한 범위만 통과시키고 나머지는 보고한다 — 과탐이 미탐보다 낫다.
 */
export function hasNonEucKr(text) {
  const bad = [];
  for (const ch of text) {
    const c = ch.codePointAt(0);
    const ok =
      c <= 0x7f ||                          // ASCII
      (c >= 0xac00 && c <= 0xd7a3) ||       // 한글 음절
      (c >= 0x3130 && c <= 0x318f) ||       // 호환 자모
      (c >= 0x4e00 && c <= 0x9fff) ||       // 한자
      (c >= 0x3000 && c <= 0x303f) ||       // CJK 문장부호 「」·
      (c >= 0xff01 && c <= 0xff5e) ||       // 전각 영숫자
      "―–—·※○△□◇●■×℃㎡₩".includes(ch);   // KS X 1001 상용 기호
    if (!ok && !bad.includes(ch)) bad.push(ch);
  }
  return bad;
}

/**
 * 등급 판정. 표본 치환 후 바이트로 잰다.
 * SOLAPI 기준 90바이트 이하 = SMS, 2,000바이트 이하 = LMS.
 */
export function smsGrade(text) {
  const rendered = renderSample(text);
  const bytes = smsBytes(rendered);
  return {
    bytes,
    type: bytes <= 90 ? "SMS" : bytes <= 2000 ? "LMS" : "OVER",
    nonEucKr: hasNonEucKr(rendered),
  };
}
