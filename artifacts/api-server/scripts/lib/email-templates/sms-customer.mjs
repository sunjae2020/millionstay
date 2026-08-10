// SMS — 고객·세입자 (B2C)
//
// **모든 이메일을 SMS 로 옮기지 않는다.** SMS 는 비싸고, 방해가 되고, 길이가 짧다.
// 아래 기준을 넘는 것만 SMS 로 보낸다:
//   ① 시간이 걸린 것 — 오늘·내일 안에 사람이 움직여야 하는 일
//   ② 이메일을 안 볼 상황 — 이동 중, 현장 도착 직전
//   ③ 돈이 걸린 것 — 납부 기한, 연체
//   ④ 본인 확인 — 인증번호
// 리포트·만족도·소식지는 SMS 로 보내지 않는다. 이메일이 맞다.
//
// 🚨 SMS 에 담지 않는 것:
//   - 출입 비밀번호 이외의 개인정보(주민번호·계좌·카드)
//   - 긴 URL — 단축 링크만. 원본 URL 을 넣으면 그것만으로 SMS 를 넘긴다.
//   - (광고) 표기·수신거부 번호 — 광고성 건은 발송 코드가 붙인다.
//
// ⚠️ 발신번호는 사전등록제(전기통신사업법)다. 등록된 번호로만 나간다.
// ⚠️ 국내 실무에서는 카카오 알림톡이 SMS 보다 싸고 도달률이 높다. 알림톡을 붙이면
//    같은 문안을 템플릿 심사에 올리고, 실패 시 SMS 로 대체 발송하는 구성이 된다.
// 한국어는 humanize-korean 통과본.

export const SMS_CUSTOMER = [
  {
    key: "sms.auth_code",
    name: "인증번호",
    description: "본인 확인 6자리. 다른 안내를 붙이지 않는다 — 인증번호만 있는 문자가 가장 안전하다.",
    vars: { code: { type: "string", required: true }, expiry_minutes: { type: "number" } },
    text: "[{{brand}}] 인증번호 {{code}}\n{{expiry_minutes}}분 내 입력해 주세요. 타인에게 알려주지 마세요.",
  },
  {
    key: "sms.booking_confirmed",
    name: "예약 확정",
    description: "예약이 잡혔을 때. 상세는 링크로.",
    vars: { space_name: { type: "string" }, date: { type: "date" }, url: { type: "url" } },
    text: "[{{brand}}] 예약이 확정되었습니다.\n{{space_name}} / {{date}}\n상세 {{url}}",
  },
  {
    key: "sms.checkin_guide",
    name: "입실 안내",
    description: "입실 당일. 출입 방법이 핵심이라 SMS 가 이메일보다 낫다.",
    vars: { space_name: { type: "string" }, address: { type: "string" }, access_code: { type: "string" }, contact_phone: { type: "string" } },
    text: "[{{brand}}] 입실 안내\n{{address}} {{space_name}}\n출입 {{access_code}}\n문의 {{contact_phone}}",
  },
  {
    key: "sms.rent_due",
    name: "납부 기한 안내",
    description: "기한 며칠 전. 금액과 날짜만.",
    vars: { amount: { type: "string" }, due_date: { type: "date" }, url: { type: "url" } },
    text: "[{{brand}}] {{due_date}}까지 {{amount}} 납부 부탁드립니다.\n청구서 {{url}}",
  },
  {
    key: "sms.rent_overdue",
    name: "연체 안내",
    description: "연체 발생. 독촉 수위는 이메일이 담당하고 SMS 는 사실만 알린다.",
    vars: { amount: { type: "string" }, days_overdue: { type: "number" }, contact_phone: { type: "string" } },
    text: "[{{brand}}] {{amount}}이 {{days_overdue}}일째 미납입니다.\n확인 부탁드립니다. 문의 {{contact_phone}}",
  },
  {
    key: "sms.payment_received",
    name: "입금 확인",
    description: "입금 확인. 안심시키는 용도라 짧을수록 좋다.",
    vars: { amount: { type: "string" }, date: { type: "date" } },
    text: "[{{brand}}] {{amount}} 입금 확인했습니다. ({{date}})\n감사합니다.",
  },
  {
    key: "sms.appointment_reminder",
    name: "방문 전일 알림",
    description: "약속 하루 전. 시간·장소만.",
    vars: { purpose: { type: "string" }, date: { type: "date" }, time_window: { type: "string" }, contact_phone: { type: "string" } },
    text: "[{{brand}}] 내일 {{purpose}} 예정입니다.\n{{date}} {{time_window}}\n변경 {{contact_phone}}",
  },
  {
    key: "sms.inspection_notice",
    name: "세대 점검 방문 통지",
    description: "세대 안에 들어가는 방문은 사전 통지가 원칙. SMS 로도 남긴다.",
    vars: { space_name: { type: "string" }, date: { type: "date" }, time_window: { type: "string" }, contact_phone: { type: "string" } },
    text: "[{{brand}}] {{space_name}} 점검 방문 예정\n{{date}} {{time_window}}\n조정 {{contact_phone}}",
  },
  {
    key: "sms.signature_request",
    name: "서명 요청",
    description: "전자서명 링크. 링크가 본문의 전부다.",
    vars: { url: { type: "url" }, due_date: { type: "date" } },
    text: "[{{brand}}] 계약서 서명을 부탁드립니다.\n{{url}}\n{{due_date}}까지 유효합니다.",
  },
  {
    key: "sms.defect_registered",
    name: "하자 접수 확인",
    description: "신고가 들어갔음을 즉시 알린다. 접수만 알려도 불안이 크게 준다.",
    vars: { ref: { type: "string" }, date: { type: "date" } },
    text: "[{{brand}}] 하자 신고를 접수했습니다. ({{ref}})\n{{date}} 방문 예정입니다.",
  },
  {
    key: "sms.maintenance_notice",
    name: "단수·정전 공지",
    description: "생활에 직접 영향. 이메일만으로는 늦는다.",
    vars: { date: { type: "date" }, time_window: { type: "string" }, purpose: { type: "string" } },
    text: "[{{brand}}] {{date}} {{time_window}} {{purpose}} 예정입니다.\n미리 준비 부탁드립니다.",
  },
  {
    key: "sms.moveout_settlement",
    name: "보증금 정산 완료",
    description: "돈이 걸린 확인. 금액과 입금 예정만.",
    vars: { amount: { type: "string" }, date: { type: "date" }, url: { type: "url" } },
    text: "[{{brand}}] 보증금 {{amount}} 정산 완료.\n{{date}} 입금 예정\n{{url}}",
  },
];
