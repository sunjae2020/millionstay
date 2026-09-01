/**
 * sms-preflight.mjs — 문자 개통 점검.
 *
 * "왜 문자가 안 나가지" 를 배포 없이, 발송 없이 답한다. 확인하는 것은 네 가지다:
 *
 *   1. 인증 정보  SOLAPI_API_KEY / SECRET — 잔액 조회로 검증한다(무료).
 *   2. 발신번호    사전등록제라 등록된 번호가 아니면 발송이 통째로 거부된다.
 *   3. 잔액        선불이다. 0 이면 조용히 전부 실패한다.
 *   4. 문안·알림톡 SMS 템플릿 24종이 발행됐는지, 알림톡 templateId 가 몇 개 붙었는지.
 *
 * 값은 **DB(integration_settings) → 환경변수** 순서로 읽는다. 관리자 화면(통합 설정)
 * 에서 넣은 키가 정본이고 Railway 변수는 그 폴백이라, 실제 서버가 보는 값과 같은
 * 순서로 봐야 점검이 거짓말을 하지 않는다.
 *
 * Usage:
 *   DATABASE_URL=… node scripts/sms-preflight.mjs
 *   DATABASE_URL=… node scripts/sms-preflight.mjs --send 01012345678   # 실제 1통 발송
 */
import pg from "pg";

const args = process.argv.slice(2);
const sendTo = (() => { const i = args.indexOf("--send"); return i >= 0 ? args[i + 1] : null; })();

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL 이 필요합니다"); process.exit(1); }
const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

const ok = (s) => `\x1b[32m✓\x1b[0m ${s}`;
const bad = (s) => `\x1b[31m✗\x1b[0m ${s}`;
const warn = (s) => `\x1b[33m•\x1b[0m ${s}`;

/** 서버와 같은 순서로 설정값을 읽는다: DB 우선, 없으면 환경변수. */
async function settings(keys) {
  const out = {};
  for (const k of keys) out[k] = (process.env[k] ?? "").trim();
  try {
    const { rows } = await pool.query(
      "select key, value from integration_settings where key = any($1)", [keys]);
    for (const r of rows) if (r.value?.trim()) out[r.key] = r.value.trim();
  } catch {
    // integration_settings 가 아직 없는 인스턴스 — 환경변수만으로 판단한다.
  }
  return out;
}

/** lib/sms.ts 의 normalizeKrSender 와 같은 규칙(발신번호는 유선·대표번호도 허용). */
function normalizeSender(raw) {
  const d = String(raw ?? "").replace(/[^\d+]/g, "").replace(/^\+?82/, "0");
  if (/^0\d{8,10}$/.test(d)) return d;
  if (/^1[5-9]\d{6}$/.test(d)) return d;
  return null;
}

const KEYS = ["SOLAPI_API_KEY", "SOLAPI_API_SECRET", "SMS_SENDER_NUMBER", "SMS_AD_OPT_OUT_NUMBER", "KAKAO_PF_ID"];
const cfg = await settings(KEYS);
let blocking = 0;

console.log("\n문자 개통 점검 (SOLAPI)\n" + "─".repeat(46));

// 1. 인증 정보
if (cfg.SOLAPI_API_KEY && cfg.SOLAPI_API_SECRET) {
  console.log(ok(`API 키    ${cfg.SOLAPI_API_KEY.slice(0, 6)}…`));
} else {
  blocking++;
  console.log(bad("API 키    없음 — solapi.com 콘솔에서 발급 후 관리자 통합 설정 또는 Railway 변수에 등록"));
}

// 2. 발신번호
const sender = normalizeSender(cfg.SMS_SENDER_NUMBER);
if (sender) console.log(ok(`발신번호  ${sender} (콘솔에 사전등록된 번호여야 합니다)`));
else if (cfg.SMS_SENDER_NUMBER) { blocking++; console.log(bad(`발신번호  "${cfg.SMS_SENDER_NUMBER}" 는 국내 발신번호 형식이 아닙니다`)); }
else { blocking++; console.log(bad("발신번호  없음 — 사전등록(전기통신사업법) 승인 후 SMS_SENDER_NUMBER 설정")); }

// 3. 광고 수신거부 번호 (거래성 발송은 없어도 나간다)
if (cfg.SMS_AD_OPT_OUT_NUMBER) console.log(ok(`080 거부  ${cfg.SMS_AD_OPT_OUT_NUMBER}`));
else console.log(warn("080 거부  없음 — 광고성 SMS 만 막힙니다(거래성은 정상 발송)"));

// 4. 알림톡
if (cfg.KAKAO_PF_ID) console.log(ok(`알림톡    발신프로필 연결됨`));
else console.log(warn("알림톡    미연결 — SMS 로만 나갑니다(발송이 멈추지는 않습니다)"));

// 5. 잔액 — 인증 정보가 맞는지 무료로 확인하는 유일한 방법이다.
let balance = null;
if (cfg.SOLAPI_API_KEY && cfg.SOLAPI_API_SECRET) {
  try {
    const { SolapiMessageService } = await import("solapi");
    const svc = new SolapiMessageService(cfg.SOLAPI_API_KEY, cfg.SOLAPI_API_SECRET);
    balance = Number((await svc.getBalance())?.balance ?? 0);
    if (balance > 0) console.log(ok(`잔액      ${balance.toLocaleString()}원`));
    else { blocking++; console.log(bad("잔액      0원 — 충전하지 않으면 전 건 실패합니다")); }
  } catch (err) {
    blocking++;
    console.log(bad(`잔액      조회 실패 — ${err?.message ?? err} (키·시크릿을 확인하세요)`));
  }
}

// 6. 문안과 알림톡 매핑
try {
  const { rows } = await pool.query(
    `select key, status, variables_schema->'kakao'->>'templateId' as tid
       from document_templates where kind='sms' order by key`);
  const published = rows.filter((r) => r.status === "published").length;
  const linked = rows.filter((r) => r.tid).length;
  console.log(rows.length ? ok(`문안      ${published}/${rows.length} 발행됨`) : bad("문안      없음 — seed-metheim-email-templates.mjs 를 먼저 실행하세요"));
  if (!rows.length) blocking++;
  console.log(linked ? ok(`알림톡 매핑 ${linked}/${rows.length} 연결됨`) : warn(`알림톡 매핑 0/${rows.length} — 심사 통과 후 set-kakao-template-id.mjs 로 연결`));
} catch (err) {
  console.log(bad(`문안      조회 실패 — ${err.message}`));
}

console.log("─".repeat(46));
console.log(blocking === 0
  ? ok("발송 가능 상태입니다.")
  : bad(`${blocking}건이 발송을 막고 있습니다. docs/SMS_SOLAPI_SETUP.md 를 보세요.`));

// 7. 실제 한 통 (요청했을 때만)
if (sendTo) {
  if (blocking > 0) {
    console.log("\n막힌 항목이 있어 테스트 발송을 건너뜁니다.");
  } else {
    const { SolapiMessageService } = await import("solapi");
    const svc = new SolapiMessageService(cfg.SOLAPI_API_KEY, cfg.SOLAPI_API_SECRET);
    const res = await svc.send([{ to: sendTo.replace(/[^\d]/g, ""), from: sender, text: "문자 발송 테스트입니다. 이 문자를 받으셨다면 개통이 끝났습니다." }]);
    const failed = Number(res?.groupInfo?.count?.registeredFailed ?? 0);
    console.log(failed
      ? bad(`발송 실패 — ${res?.failedMessageList?.[0]?.statusMessage ?? `${failed}건`}`)
      : ok(`발송 완료 → ${sendTo} (group ${res?.groupInfo?.groupId})`));
  }
}

await pool.end();
process.exit(blocking === 0 ? 0 : 1);
