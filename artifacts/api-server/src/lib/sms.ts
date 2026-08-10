/**
 * SMS 발송 — SOLAPI (https://solapi.com/developers)
 *
 * 규격 (출처: https://solapi.com/guides/sms):
 *   SMS  90 bytes 이하   제목 미지원
 *   LMS  2,000 bytes 이하 제목 지원
 *   바이트: 영문·숫자·공백·**줄바꿈 1byte**, 한글 1자당 2bytes
 *   ⚠️ 제목을 넣으면 본문이 90 bytes 이하라도 **LMS 로 자동 전환**된다(요금 3배).
 *
 * 이 파일의 `smsBytes` 는 시드 검증기(scripts/lib/email-templates/_sms.mjs)와 **같은
 * 규칙**이어야 한다. 두 곳이 갈리면 "검증은 통과했는데 발송은 LMS" 가 된다.
 *
 * 발송 전 갖춰야 할 것 — docs/SMS_SOLAPI_SETUP.md 참조:
 *   SOLAPI_API_KEY / SOLAPI_API_SECRET   API 인증
 *   SMS_SENDER_NUMBER                    발신번호 (사전등록제, 등록된 번호만 허용)
 *   SMS_AD_OPT_OUT_NUMBER                광고 SMS 무료거부 080 번호 (광고 발송 시 필수)
 */
import { resolveTemplate, renderString } from "./documents/templateEngine.js";
import { inMarketingQuietHours } from "./email.js";

export type SmsType = "SMS" | "LMS";

export interface SmsSendResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
  id?: string;
  type?: SmsType;
  bytes?: number;
}

/** SOLAPI 과금 기준 바이트 수. 한글 2, 그 외(줄바꿈 포함) 1. */
export function smsBytes(text: string): number {
  let n = 0;
  for (const ch of text) n += /[\x00-\x7F]/.test(ch) ? 1 : 2;
  return n;
}

/** 90 bytes 를 넘으면 LMS. 제목이 있으면 길이와 무관하게 LMS. */
export function smsType(text: string, subject?: string | null): SmsType {
  if (subject?.trim()) return "LMS";
  return smsBytes(text) <= 90 ? "SMS" : "LMS";
}

/**
 * EUC-KR 로 보낼 수 없는 문자(이모지 등)를 찾는다. 이런 문자가 있으면 수신 단말에서
 * 깨지거나 발송이 거부된다 — 보내기 전에 걸러야 한다.
 */
export function nonEucKrChars(text: string): string[] {
  const bad: string[] = [];
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    const ok =
      c <= 0x7f ||
      (c >= 0xac00 && c <= 0xd7a3) ||
      (c >= 0x3130 && c <= 0x318f) ||
      (c >= 0x4e00 && c <= 0x9fff) ||
      (c >= 0x3000 && c <= 0x303f) ||
      (c >= 0xff01 && c <= 0xff5e) ||
      "―–—·※○△□◇●■×℃㎡₩".includes(ch);
    if (!ok && !bad.includes(ch)) bad.push(ch);
  }
  return bad;
}

/** 국내 휴대폰 번호를 하이픈 없는 형태로. 국제표기(+82)도 받아 준다. */
export function normalizeKrPhone(raw: string): string | null {
  const d = raw.replace(/[^\d+]/g, "").replace(/^\+?82/, "0");
  return /^01[016789]\d{7,8}$/.test(d) ? d : null;
}

export interface SendSmsOptions {
  to: string;
  /** 템플릿 키(kind='sms'). 지정하면 DB 문안을 쓰고 text 는 무시한다. */
  templateKey?: string;
  /** 템플릿을 쓰지 않을 때의 본문. */
  text?: string;
  vars?: Record<string, unknown>;
  /** 광고성이면 true — (광고) 표기·무료거부번호·야간차단이 적용된다. */
  advertising?: boolean;
  /** 알림톡을 시도하지 않고 SMS 로만 보낸다(내부 직원 알림 등). */
  smsOnly?: boolean;
}

/* ─────────────────────────────────────────────────────────────────────────
   카카오 알림톡

   알림톡은 SMS 보다 싸고 도달률이 높지만 **사전 심사를 통과한 템플릿**으로만 보낼 수
   있다. 승인 결과로 나오는 `templateId` 는 심사 때마다 달라지고 재심사로 바뀌므로
   코드에 상수로 박지 않는다 — `document_templates.variables_schema.kakao` 에 둔다.
   그러면 배포 없이 Studio·SQL 로 갱신할 수 있다.

     variables_schema = {
       ...변수정의,
       kakao: { templateId: "TX_0001", buttons?: [...] }
     }

   `pfId`(발신프로필)는 채널당 하나라 env 로 둔다.

   ⚠️ 알림톡 본문은 **승인된 템플릿과 글자가 일치**해야 한다. 그래서 DB 문안을 고치면
      심사를 다시 넣어야 하고, 그 전까지는 발송이 거부된다. 문안 수정 시 주의.
   ⚠️ 알림톡은 **정보성만** 허용된다. advertising=true 면 시도하지 않고 SMS 로 간다.
   ───────────────────────────────────────────────────────────────────────── */

interface KakaoMeta {
  templateId?: string;
  buttons?: Array<Record<string, unknown>>;
}

/** {{변수}} → 카카오 #{변수} 치환값 맵. 카카오는 키에 `#{}` 를 포함해 받는다. */
export function kakaoVariables(vars: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars)) out[`#{${k}}`] = String(v ?? "");
  return out;
}

/** 문안의 {{변수}} 를 카카오 템플릿 표기 #{변수} 로. 심사 등록용. */
export function toKakaoTemplate(text: string): string {
  return text.replace(/\{\{(\w+)\}\}/g, "#{$1}");
}

/**
 * 광고 SMS 는 이메일과 규정이 다르다. 수신거부를 **링크가 아니라 무료 080 번호**로
 * 제공해야 하므로(정보통신망법 시행령), 번호가 없으면 아예 보내지 않는다.
 * 조용히 링크로 대체하면 위법이다.
 */
function applyAdvertisingRules(text: string): { text: string } | { error: string } {
  const optOut = (process.env.SMS_AD_OPT_OUT_NUMBER ?? "").trim();
  if (!optOut) {
    return { error: "광고 SMS 무료거부번호(SMS_AD_OPT_OUT_NUMBER)가 없어 발송할 수 없습니다" };
  }
  const prefix = (process.env.MARKETING_AD_PREFIX ?? "(광고)").trim();
  const head = text.startsWith(prefix) ? text : `${prefix} ${text}`;
  return { text: `${head}\n무료거부 ${optOut}` };
}

/**
 * SMS 한 통 발송. 실패해도 throw 하지 않고 결과를 돌려준다 — 호출부가 기록한다.
 *
 * SDK 는 **동적 import** 한다. `solapi` 패키지를 아직 설치하지 않은 환경(현재)에서도
 * 이 모듈을 import 하는 코드가 깨지지 않아야 하고, 설치 여부가 곧 기능 활성화 스위치다.
 */
export async function sendSms(opts: SendSmsOptions): Promise<SmsSendResult> {
  const to = normalizeKrPhone(opts.to);
  if (!to) return { ok: false, error: `발신 불가한 번호 형식: ${opts.to}` };

  // 1. 본문 확보 — 템플릿 우선. 카카오 메타도 여기서 함께 읽는다.
  let body = opts.text ?? "";
  let kakao: KakaoMeta | null = null;
  if (opts.templateKey) {
    const tpl = await resolveTemplate({ kind: "sms", key: opts.templateKey, locale: "ko" });
    if (!tpl?.bodyHtml?.trim()) {
      return { ok: false, error: `SMS 템플릿 없음 또는 미발행: ${opts.templateKey}` };
    }
    body = tpl.bodyHtml;
    const meta = (tpl.variablesSchema as Record<string, unknown>)?.kakao;
    if (meta && typeof meta === "object") kakao = meta as KakaoMeta;
  }
  body = renderString(body, opts.vars ?? {});
  if (!body.trim()) return { ok: false, error: "본문이 비었습니다" };

  // 2. 광고성 규칙 (야간 차단은 이메일과 같은 창을 쓴다).
  if (opts.advertising) {
    const quiet = inMarketingQuietHours();
    if (quiet.blocked) {
      return { ok: false, skipped: true, error: `광고 발송 제한 시간 (${quiet.window})` };
    }
    const ad = applyAdvertisingRules(body);
    if ("error" in ad) return { ok: false, skipped: true, error: ad.error };
    body = ad.text;
  }

  // 3. 인코딩 점검 — 깨진 문자를 보내느니 안 보낸다.
  const bad = nonEucKrChars(body);
  if (bad.length) {
    return { ok: false, error: `SMS 로 보낼 수 없는 문자: ${bad.join(" ")}` };
  }

  const type = smsType(body);
  const bytes = smsBytes(body);

  // 4. 설정 확인.
  const apiKey = (process.env.SOLAPI_API_KEY ?? "").trim();
  const apiSecret = (process.env.SOLAPI_API_SECRET ?? "").trim();
  const from = normalizeKrPhone(process.env.SMS_SENDER_NUMBER ?? "");
  if (!apiKey || !apiSecret || !from) {
    console.log(`[sms] 미설정 — 발송 건너뜀 (${type} ${bytes}B → ${to})`);
    return { ok: false, skipped: true, error: "SMS 미설정", type, bytes };
  }

  // 5. 알림톡을 쓸 수 있으면 붙인다. 조건이 하나라도 빠지면 조용히 SMS 로 간다 —
  //    알림톡은 최적화지 필수 경로가 아니므로, 설정 미비로 발송이 멈추면 안 된다.
  const pfId = (process.env.KAKAO_PF_ID ?? "").trim();
  const useKakao = !opts.smsOnly && !opts.advertising && !!pfId && !!kakao?.templateId;
  const kakaoOptions = useKakao
    ? {
        pfId,
        templateId: kakao!.templateId!,
        variables: kakaoVariables(opts.vars ?? {}),
        // false = 알림톡 실패 시 같은 text 로 SMS 대체발송. 이 값이 대체발송 스위치다.
        disableSms: false,
        ...(kakao!.buttons?.length ? { buttons: kakao!.buttons } : {}),
      }
    : undefined;
  const channel = useKakao ? "알림톡" : type;

  // 6. 발송. `send()` 는 메시지 배열을 받고 그룹 응답을 돌려준다(SDK 6.x).
  //    제목(subject)은 넣지 않는다 — 넣으면 90B 이하라도 LMS 로 전환된다.
  try {
    const { SolapiMessageService } = await import("solapi");
    const svc = new SolapiMessageService(apiKey, apiSecret);
    const res = await svc.send([
      { to, from, text: body, ...(kakaoOptions ? { kakaoOptions } : {}) },
    ] as never);

    // 그룹 단위 응답이라 개별 실패가 카운트로 온다. 실패가 있으면 성공으로 보고하지 않는다.
    const failed = Number(res?.groupInfo?.count?.registeredFailed ?? 0);
    const groupId = res?.groupInfo?.groupId;
    if (failed > 0) {
      const detail = res?.failedMessageList?.[0];
      const msg = detail
        ? `${detail.statusCode ?? ""} ${detail.statusMessage ?? ""}`.trim()
        : `${failed}건 등록 실패`;
      console.error(`[sms] 발송 실패 (${channel}) → ${to}: ${msg}`);
      return { ok: false, error: msg, type, bytes };
    }

    console.log(`[sms] 발송 ${channel} ${bytes}B → ${to} (${groupId ?? "no-group"})`);
    return { ok: true, id: groupId, type, bytes };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "발송 실패";
    console.error(`[sms] 발송 실패 → ${to}: ${msg}`);
    return { ok: false, error: msg, type, bytes };
  }
}

/** 잔액 조회 — 발송 실패가 잔액 부족인지 가르는 데 쓴다. 미설정이면 null. */
export async function smsBalance(): Promise<number | null> {
  const apiKey = (process.env.SOLAPI_API_KEY ?? "").trim();
  const apiSecret = (process.env.SOLAPI_API_SECRET ?? "").trim();
  if (!apiKey || !apiSecret) return null;
  try {
    const { SolapiMessageService } = await import("solapi");
    const res = await new SolapiMessageService(apiKey, apiSecret).getBalance();
    return Number(res?.balance ?? 0);
  } catch (err) {
    console.error("[sms] 잔액 조회 실패:", err instanceof Error ? err.message : err);
    return null;
  }
}
