// SMS — 파트너·서비스호스트·소유주·직원 (B2B / 내부)
//
// B2C 와 판단 기준이 다르다. 파트너와 호스트는 **현장에 있고 이메일을 못 본다.**
// 특히 서비스 호스트(청소·기사)에게는 SMS 가 주 채널이고 이메일이 보조다.
//
// 🚨 세입자 개인정보를 SMS 에 담지 않는다. 작업 지시는 **세대 호수와 출입 방법까지**만.
//    문자는 전달·캡처가 쉽고 단말에 남는다.
// 🚨 소유주에게 가는 문자에도 임차인을 특정하지 않는다(이메일과 같은 마스킹 원칙).
//
// ⚠️ 정산 금액은 SMS 로 보내되 **계좌번호는 넣지 않는다.** 끝자리만 쓴다.
// 한국어는 humanize-korean 통과본.

export const SMS_PARTNER = [
  // ── 서비스 호스트 (청소·기사·정비) — SMS 주 채널 ─────────────────────────
  {
    key: "sms.job_assigned",
    name: "작업 배정",
    description: "새 작업. 언제·어디서·무엇 세 가지만.",
    vars: { date: { type: "date" }, time_window: { type: "string" }, space_name: { type: "string" }, job_type: { type: "string" }, url: { type: "url" } },
    text: "[{{brand}}] 작업배정 {{date}} {{time_window}}\n{{space_name}} {{job_type}}\n{{url}}",
  },
  {
    key: "sms.job_reminder",
    name: "작업 전일 알림",
    description: "내일 작업. 시간과 장소만.",
    vars: { date: { type: "date" }, time_window: { type: "string" }, space_name: { type: "string" }, address: { type: "string" } },
    text: "[{{brand}}] 내일 작업\n{{date}} {{time_window}}\n{{address}} {{space_name}}",
  },
  {
    key: "sms.job_changed",
    name: "작업 변경",
    description: "일정·장소 변경. 이미 출발했을 수 있어 즉시성이 중요하다.",
    vars: { space_name: { type: "string" }, date: { type: "date" }, time_window: { type: "string" }, url: { type: "url" } },
    text: "[{{brand}}] 작업변경 {{date}} {{time_window}}\n{{space_name}}\n{{url}}",
  },
  {
    key: "sms.job_cancelled",
    name: "작업 취소",
    description: "취소. 헛걸음을 막는 것이 목적이므로 가장 빨리 나가야 한다.",
    vars: { date: { type: "date" }, space_name: { type: "string" }, contact_phone: { type: "string" } },
    text: "[{{brand}}] {{date}} {{space_name}} 작업 취소.\n출발 전이면 연락 주세요 {{contact_phone}}",
  },
  {
    key: "sms.report_required",
    name: "완료 보고 요청",
    description: "보고 누락 시. 정산과 직결됨을 짧게 알린다.",
    vars: { space_name: { type: "string" }, url: { type: "url" } },
    text: "[{{brand}}] {{space_name}} 완료 보고 미등록\n{{url}}\n사진 올려야 정산됩니다",
  },
  {
    key: "sms.host_payout_sent",
    name: "정산금 지급",
    description: "호스트 정산 송금 완료.",
    vars: { period: { type: "string" }, net_amount: { type: "string" }, date: { type: "date" } },
    text: "[{{brand}}] {{period}} 정산금 {{net_amount}}을 {{date}} 송금했습니다.",
  },

  // ── 에이전트 파트너 ──────────────────────────────────────────────────────
  {
    key: "sms.referral_status",
    name: "소개 건 진행 변경",
    description: "파트너가 고객에게 답할 수 있게 하는 최소 정보.",
    vars: { client_name: { type: "string" }, status: { type: "string" }, url: { type: "url" } },
    text: "[{{brand}}] {{client_name}} 건 상태: {{status}}\n상세 {{url}}",
  },
  {
    key: "sms.commission_paid",
    name: "수수료 지급",
    description: "수수료 송금 완료. 계좌는 끝자리만.",
    vars: { period: { type: "string" }, net_amount: { type: "string" }, date: { type: "date" } },
    text: "[{{brand}}] {{period}} 수수료 {{net_amount}}을 {{date}} 송금했습니다.",
  },

  // ── 소유주 ───────────────────────────────────────────────────────────────
  {
    key: "sms.owner_payout_sent",
    name: "소유주 정산금 지급",
    description: "정산 송금 완료. 임차인은 특정하지 않는다.",
    vars: { period: { type: "string" }, net_amount: { type: "string" }, date: { type: "date" } },
    text: "[{{brand}}] {{period}} 정산금 {{net_amount}}을 {{date}} 송금했습니다.",
  },
  {
    key: "sms.owner_approval_request",
    name: "소유주 수선 승인 요청",
    description: "금액이 걸린 결정. 기한이 있으면 SMS 가 맞다.",
    vars: { space_name: { type: "string" }, amount: { type: "string" }, url: { type: "url" } },
    text: "[{{brand}}] {{space_name}} 수선 승인 요청\n견적 {{amount}}\n확인 {{url}}",
  },

  // ── 내부 직원 ────────────────────────────────────────────────────────────
  {
    key: "sms.staff_urgent_ticket",
    name: "긴급 CS 배정",
    description: "누수·정전 등 즉시 대응. 이메일로는 늦는다.",
    vars: { ref: { type: "string" }, space_name: { type: "string" }, url: { type: "url" } },
    text: "[{{brand}}] 긴급 접수 {{ref}}\n{{space_name}}\n즉시 확인 {{url}}",
  },
  {
    key: "sms.staff_system_alert",
    name: "시스템 장애 알림",
    description: "야간·주말 장애. 운영 담당에게.",
    vars: { job_type: { type: "string" }, url: { type: "url" } },
    text: "[{{brand}}] {{job_type}} 실패. 확인 필요\n{{url}}",
  },
];
