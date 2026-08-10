/**
 * gen-kakao-templates.mjs
 *
 * SMS 문안(kind='sms')에서 **카카오 알림톡 템플릿 심사 등록용 목록**을 생성한다.
 * 손으로 옮겨 적지 않는다 — SMS 문안을 고치면 이 목록도 다시 뽑아 심사에 반영한다.
 *
 * 변환 규칙:
 *   {{변수}} → #{변수}      카카오 템플릿 변수 표기
 *   `[{{brand}}]` 접두는 **유지**한다. 알림톡은 채널명이 상단에 뜨지만, 알림톡 실패 시
 *   같은 text 가 SMS 로 대체발송되므로(disableSms:false) 접두가 없으면 SMS 쪽이 어색해진다.
 *
 * 제외 대상:
 *   - 내부 직원용(staff_*) — 알림톡은 고객·파트너 채널이다. 직원 알림은 SMS·슬랙이 맞다.
 *   - 광고성 — 알림톡은 정보성만 허용된다(광고는 친구톡).
 *
 * Usage: node scripts/gen-kakao-templates.mjs > ../../docs/KAKAO_ALIMTALK_TEMPLATES.md
 */
import { SMS_CUSTOMER } from "./lib/email-templates/sms-customer.mjs";
import { SMS_PARTNER } from "./lib/email-templates/sms-partner.mjs";
import { renderSample } from "./lib/email-templates/_sms.mjs";

/** 알림톡 심사에 올리지 않을 키와 그 이유. */
const EXCLUDE = {
  "sms.staff_urgent_ticket": "내부 직원용 — 고객 채널로 보낼 대상이 아니다",
  "sms.staff_system_alert": "내부 직원용 — 장애 알림은 SMS·슬랙이 맞다",
};

/** 심사에서 걸릴 만한 것을 미리 표시한다. 반려는 되돌리는 데 며칠이 든다. */
const REVIEW_RISK = {
  "sms.rent_overdue":
    "미납 독촉으로 읽히면 반려될 수 있다. **임대차 계약에 따른 납부 안내**라는 발송 근거를 심사 시 함께 제출할 것",
  "sms.auth_code":
    "인증번호는 별도 카테고리(인증)로 등록해야 하는 경우가 있다. 심사 화면에서 유형을 확인할 것",
  "sms.moveout_settlement":
    "금액 정산 안내다. 계약 종료에 따른 정산임을 설명에 적을 것",
};

/** 링크 변수가 있으면 웹링크 버튼을 제안한다. 버튼 유형은 SDK 기준 WL. */
function suggestButton(text, key) {
  if (!/\{\{url\}\}/.test(text)) return null;
  const label =
    /signature/.test(key) ? "서명하기"
    : /report_required/.test(key) ? "사진 등록"
    : /approval/.test(key) ? "확인하기"
    : /settlement|payout|commission/.test(key) ? "내역 보기"
    : "자세히 보기";
  return { buttonType: "WL", buttonName: label, linkMo: "#{url}" };
}

const toKakao = (t) => t.replace(/\{\{(\w+)\}\}/g, "#{$1}");
const varsOf = (t) => [...new Set([...t.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))];

function section(title, list, note) {
  const out = [`## ${title}`, ""];
  if (note) out.push(note, "");
  for (const t of list) {
    const excluded = EXCLUDE[t.key];
    out.push(`### ${t.name}`, "");
    out.push(`| | |`, `|---|---|`);
    out.push(`| 템플릿 코드 | \`${t.key}\` |`);
    out.push(`| 용도 | ${t.description} |`);
    if (excluded) {
      out.push(`| **심사 제외** | ${excluded} |`, "");
      continue;
    }
    const vars = varsOf(t.text);
    out.push(`| 변수 | ${vars.map((v) => `\`#{${v}}\``).join(" · ")} |`);
    const btn = suggestButton(t.text, t.key);
    if (btn) out.push(`| 버튼 제안 | \`${btn.buttonType}\` **${btn.buttonName}** → \`${btn.linkMo}\` |`);
    if (REVIEW_RISK[t.key]) out.push(`| ⚠️ 심사 유의 | ${REVIEW_RISK[t.key]} |`);
    out.push("", "**등록할 내용** (그대로 복사)", "", "```", toKakao(t.text), "```", "");
    out.push("<details><summary>치환 예시</summary>", "", "```", renderSample(t.text), "```", "</details>", "");
  }
  return out.join("\n");
}

const submitted = [...SMS_CUSTOMER, ...SMS_PARTNER].filter((t) => !EXCLUDE[t.key]);

console.log(`# 카카오 알림톡 템플릿 심사 등록 목록

> **생성물이다. 손으로 고치지 말 것.**
> \`node scripts/gen-kakao-templates.mjs > docs/KAKAO_ALIMTALK_TEMPLATES.md\` 로 다시 뽑는다.
> SMS 문안(\`scripts/lib/email-templates/sms-*.mjs\`)이 정본이고 이 문서는 그 파생이다.

## 등록 전에 확인할 것

1. **카카오톡 채널**을 먼저 개설한다 (business.kakao.com, 사업자등록증 필요).
2. Solapi 콘솔에서 채널을 연동해 **\`pfId\`(발신프로필 키)** 를 받는다.
3. 아래 템플릿을 하나씩 등록한다. 심사는 영업일 1~3일.
4. 승인되면 **\`templateId\`** 가 나온다 — 이 문서의 템플릿 코드와 짝지어 기록해 둔다.
   코드가 그 매핑을 읽어 발송한다.

## 규칙

- 변수는 \`#{변수명}\` 형식이다. SMS 문안의 \`{{변수}}\` 를 자동 변환했다.
- **변수만으로 이루어진 문장은 반려된다.** 아래 문안은 전부 고정 문구를 포함한다.
- 알림톡은 **정보성만** 허용된다. 광고성(\`marketing.*\`)은 등록 대상이 아니며 친구톡 또는 SMS 로 보낸다.
- \`[#{brand}]\` 접두는 **유지한다.** 알림톡은 채널명이 상단에 뜨지만, 알림톡이 실패하면
  같은 문구가 SMS 로 대체발송되므로(\`disableSms: false\`) 접두가 없으면 SMS 쪽이 어색해진다.
- 알림톡 본문 한도는 1,000자로 여유가 크다. SMS 90바이트에 맞춘 문안이라 길이는 문제되지 않는다.

**등록 대상 ${submitted.length}종** (전체 ${SMS_CUSTOMER.length + SMS_PARTNER.length}종 중 ${Object.keys(EXCLUDE).length}종 제외)

---

${section("B2C — 고객·세입자", SMS_CUSTOMER)}
---

${section("B2B — 파트너·서비스호스트·소유주", SMS_PARTNER)}
---

## 승인 후 기록표

승인된 \`templateId\` 를 여기에 적어 두면 코드 매핑에 그대로 쓴다.

| 템플릿 코드 | templateId | 승인일 | 비고 |
|---|---|---|---|
${submitted.map((t) => `| \`${t.key}\` | | | |`).join("\n")}
`);
