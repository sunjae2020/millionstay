/**
 * seed-metheim-email-templates.mjs
 *
 * Metheim 인스턴스의 업무 이메일 템플릿 카탈로그를 document_templates /
 * document_template_translations 에 시드한다. 정본 = docs/EMAIL_TEMPLATE_SPEC.md
 *
 * 규칙 (스펙 §1·§2·§3):
 *   - key       `<domain>.<event>` — 점 1개. kind 는 키에 넣지 않는다.
 *   - category  수신자 그룹 slug: common | customer | owner | partner | host | staff | marketing
 *   - locale    ko(원본) / en / ja / zh / th / vi — 6개국어 전부 채운다
 *   - body      셸(renderEmailShell) 안쪽 조각만. <!DOCTYPE>·<style>·색 리터럴·로고·
 *               브랜드명 금지. 셸이 제공하는 클래스(lead/box/btn/muted/kv)를 쓴다.
 *
 * 한국어 본문은 humanize-korean 을 통과한 문안이다 — 영어에서 재기계번역 금지.
 * 회사명·로고·주소·문의처는 렌더 시점에 Settings → Organisation 에서 해석되므로
 * 문안에 절대 넣지 않는다.
 *
 * 멱등: (kind, key) 로 upsert, 로케일은 (template_id, locale) 로 upsert.
 * 기존 문안을 덮어쓰므로 운영자가 Studio 에서 수정한 내용이 있으면 사라진다.
 * → 재실행 전 확인. KEEP_EXISTING=1 이면 이미 있는 키는 건너뛴다.
 *
 * Usage:  DATABASE_URL=<metheim> node scripts/seed-metheim-email-templates.mjs
 *         DATABASE_URL=<metheim> ONLY=common node scripts/seed-metheim-email-templates.mjs
 *         DATABASE_URL=<metheim> DRY_RUN=1 node scripts/seed-metheim-email-templates.mjs
 */
import { COMMON } from "./lib/email-templates/common.mjs";
import { CUSTOMER_APPLICATION } from "./lib/email-templates/customer-application.mjs";
import { CUSTOMER_BOOKING } from "./lib/email-templates/customer-booking.mjs";
import { CUSTOMER_CONTRACT } from "./lib/email-templates/customer-contract.mjs";
import { CUSTOMER_TENANCY } from "./lib/email-templates/customer-tenancy.mjs";
import { CUSTOMER_BILLING } from "./lib/email-templates/customer-billing.mjs";
import { CUSTOMER_CS } from "./lib/email-templates/customer-cs.mjs";
import { CUSTOMER_SERVICE } from "./lib/email-templates/customer-service.mjs";
import { PARTNER_ONBOARDING } from "./lib/email-templates/partner-onboarding.mjs";
import { PARTNER_BUSINESS } from "./lib/email-templates/partner-business.mjs";
import { HOST_ONBOARDING } from "./lib/email-templates/host-onboarding.mjs";
import { HOST_JOBS } from "./lib/email-templates/host-jobs.mjs";
import { OWNER } from "./lib/email-templates/owner.mjs";
import { STAFF_ACCOUNT } from "./lib/email-templates/staff-account.mjs";
import { STAFF_WORK } from "./lib/email-templates/staff-work.mjs";
import { MARKETING } from "./lib/email-templates/marketing.mjs";
import { SMS_CUSTOMER } from "./lib/email-templates/sms-customer.mjs";
import { SMS_PARTNER } from "./lib/email-templates/sms-partner.mjs";
import { smsGrade, renderSample } from "./lib/email-templates/_sms.mjs";

const LOCALES = ["ko", "en", "ja", "zh", "th", "vi"];
/** 이 템플릿이 채워야 하는 로케일. SMS 는 국내 전용이라 ko 만. */
const localesFor = (t) => (t.kind === "sms" ? ["ko"] : LOCALES);

// ─────────────────────────────────────────────────────────────────────────────
// 카탈로그 조립 — 카테고리별 묶음
// ─────────────────────────────────────────────────────────────────────────────
const CATALOGUE = [
  ...COMMON.map((t) => ({ ...t, kind: "email", category: "common" })),
  ...CUSTOMER_APPLICATION.map((t) => ({ ...t, kind: "email", category: "customer" })),
  ...CUSTOMER_BOOKING.map((t) => ({ ...t, kind: "email", category: "customer" })),
  ...CUSTOMER_CONTRACT.map((t) => ({ ...t, kind: "email", category: "customer" })),
  ...CUSTOMER_TENANCY.map((t) => ({ ...t, kind: "email", category: "customer" })),
  ...CUSTOMER_BILLING.map((t) => ({ ...t, kind: "email", category: "customer" })),
  ...CUSTOMER_CS.map((t) => ({ ...t, kind: "email", category: "customer" })),
  ...CUSTOMER_SERVICE.map((t) => ({ ...t, kind: "email", category: "customer" })),
  ...PARTNER_ONBOARDING.map((t) => ({ ...t, kind: "email", category: "partner" })),
  // agent.inventory_update 는 광고성이라 category=marketing 으로 넘겨 셸이
  // (광고) 표기·수신거부를 붙이게 한다(스펙 §6).
  ...PARTNER_BUSINESS.map((t) => ({ ...t, kind: "email",
    category: t.key === "agent.inventory_update" ? "marketing" : "partner" })),
  ...HOST_ONBOARDING.map((t) => ({ ...t, kind: "email", category: "host" })),
  ...HOST_JOBS.map((t) => ({ ...t, kind: "email", category: "host" })),
  ...OWNER.map((t) => ({ ...t, kind: "email", category: "owner" })),
  ...STAFF_ACCOUNT.map((t) => ({ ...t, kind: "email", category: "staff" })),
  ...STAFF_WORK.map((t) => ({ ...t, kind: "email", category: "staff" })),
  ...MARKETING.map((t) => ({ ...t, kind: "email", category: "marketing" })),
  // SMS 는 국내 발송 전용이라 ko 하나만 둔다. 외국인 세입자에게는 같은 사건의
  // 이메일이 6개국어로 나가므로 정보가 닿지 않는 구멍은 없다.
  ...SMS_CUSTOMER.map((t) => ({ ...t, kind: "sms", category: "customer",
    tr: { ko: { subject: null, body: t.text } } })),
  ...SMS_PARTNER.map((t) => ({ ...t, kind: "sms", category: "partner",
    tr: { ko: { subject: null, body: t.text } } })),
];

// ─────────────────────────────────────────────────────────────────────────────
// 시드 실행
// ─────────────────────────────────────────────────────────────────────────────
/**
 * 본문 형식은 두 가지다 — 발송 경로가 다르므로 섞으면 안 된다.
 *
 *   style: "shell" (기본)
 *     renderEmailShell() 카드 안쪽에 그대로 들어가는 HTML 조각.
 *     셸 클래스(lead/box/btn/muted/kv)를 쓴다. 제목 필수.
 *
 *   style: "note"
 *     sendDocumentEmail() 의 고정 커버 안에 **escape 되어** 삽입되는 평문 한두 문장.
 *     HTML 을 쓰면 태그가 글자로 노출된다. 제목은 생략 가능(로케일 기본 제목 사용).
 *     기존 email.invoice / email.receipt / email.contract 가 이 형식이다.
 */
function validate(rows) {
  const problems = [];
  const seen = new Set();
  const BANNED = /<!DOCTYPE|<style|#[0-9a-fA-F]{6}\b|MillionStay|Metheim|<img/i;
  const SHELL_CLASSES = /class="(lead|box|label|ref|amount|btn|muted|kv|k)"/g;
  const ALLOWED_TAGS = /<\/?(p|b|strong|em|ul|ol|li|a|br|h2|table|tr|td|div)\b/gi;

  for (const t of rows) {
    const id = `${t.kind}/${t.key}`;
    const style = t.style ?? "shell";
    if (seen.has(id)) problems.push(`${id}: 중복 키`);
    seen.add(id);
    if (!/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/.test(t.key)) {
      problems.push(`${id}: 키가 <domain>.<event> 형식이 아님`);
    }
    for (const loc of localesFor(t)) {
      const tr = t.tr[loc];
      if (!tr?.body?.trim()) { problems.push(`${id}: ${loc} 본문 누락`); continue; }
      if (t.kind !== "sms" && style === "shell" && !tr.subject?.trim()) {
        problems.push(`${id}: ${loc} 제목 누락 (shell 형식은 제목 필수)`);
      }
      if (BANNED.test(tr.body)) {
        problems.push(`${id}: ${loc} 본문에 셸이 소유해야 할 요소(DOCTYPE/style/색/로고/브랜드명)가 있음`);
      }
      // 문자 체계 검사 — 다국어를 연달아 쓰다 보면 옆 로케일의 글자가 섞여 들어간다.
      // 실제로 ja/zh 본문에 키릴 문자가 들어간 적이 있다(особые, материалы).
      // 반드시 유니코드 스크립트 속성으로 볼 것: [ㄱ-힝] 같은 코드포인트 범위는
      // 한자·가나까지 삼켜 전 로케일 오탐을 낸다. 한자(Han)는 ja·zh 공용이라 제외.
      const text = (tr.subject ?? "") + tr.body;
      const OWNED = [
        ["ko", /\p{Script=Hangul}/u, "한글"],
        ["ja", /[\p{Script=Hiragana}\p{Script=Katakana}]/u, "가나"],
        ["th", /\p{Script=Thai}/u, "타이 문자"],
      ];
      for (const [owner, re, label] of OWNED) {
        if (loc !== owner && re.test(text)) problems.push(`${id}: ${loc} 본문에 ${label} 혼입`);
      }
      const cyrillic = text.match(/\p{Script=Cyrillic}+/gu);
      if (cyrillic) problems.push(`${id}: ${loc} 키릴 문자 혼입 — ${[...new Set(cyrillic)].join(", ")}`);
      // ── SMS 전용 검증 ───────────────────────────────────────────────
      if (t.kind === "sms") {
        // 길이는 곧 비용이다. {{변수}} 리터럴이 아니라 **표본값을 치환한 뒤** 잰다 —
        // 그러지 않으면 실제 발송분이 LMS 로 넘어가도 통과한다.
        const { bytes, type } = smsGrade(tr.body);
        if (type === "OVER") {
          problems.push(`${id}: SMS 본문이 ${bytes}바이트 — LMS 한도(2000) 초과`);
        } else if (type === "LMS" && !t.allowLms) {
          problems.push(
            `${id}: 표본 치환 시 ${bytes}바이트로 LMS(요금 3배)다. 줄이거나 allowLms:true 로 의도를 밝혀라.
` +
            `      → ${renderSample(tr.body).replace(/\n/g, " / ")}`);
        }
        if (/<[a-z/]/i.test(tr.body)) problems.push(`${id}: SMS 에 HTML 태그가 있음`);
        // (광고)·수신거부는 발송 코드가 붙인다. 문안에 있으면 이중 표기가 된다.
        if (/\(광고\)|무료거부|수신거부/.test(tr.body)) {
          problems.push(`${id}: (광고)·수신거부 문구는 발송 코드가 붙인다 — 문안에서 제거`);
        }
        // 문자는 전달·캡처가 쉽다. 금융정보를 넣지 않는다.
        if (/계좌번호|카드번호|주민(등록)?번호/.test(tr.body)) {
          problems.push(`${id}: SMS 에 금융·신원 정보를 담지 않는다`);
        }
        // 원본 URL 은 그것만으로 SMS 한도를 먹는다.
        if (/https?:\/\/(?!\{\{)/.test(tr.body)) {
          problems.push(`${id}: SMS 에 리터럴 URL 이 있음 — 단축 링크 변수를 쓸 것`);
        }
        continue;  // 아래 이메일 전용 검사는 건너뛴다
      }
      if (style === "note" && /<[a-z/]/i.test(tr.body)) {
        problems.push(`${id}: ${loc} note 형식에 HTML 태그가 있음 — 커버에 escape 되어 태그가 그대로 보인다`);
      }
      if (style === "shell") {
        const stray = tr.body.replace(ALLOWED_TAGS, "").match(/<[a-z][a-z0-9]*/gi);
        if (stray) problems.push(`${id}: ${loc} 허용되지 않은 태그 ${[...new Set(stray)].join(", ")}`);
        // 셸이 제공하지 않는 class 를 쓰면 스타일이 먹지 않는다.
        const classes = [...tr.body.matchAll(/class="([^"]+)"/g)].map((m) => m[1]);
        const bad = classes.filter((c) => !/^(lead|box|label|ref|amount|btn|muted|kv|k)$/.test(c));
        if (bad.length) problems.push(`${id}: ${loc} 셸에 없는 class ${[...new Set(bad)].join(", ")}`);
      }
    }
    void SHELL_CLASSES;
  }
  return problems;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url && !process.env.DRY_RUN) throw new Error("DATABASE_URL 이 필요합니다");

  const only = process.env.ONLY?.trim();
  const rows = only ? CATALOGUE.filter((t) => t.category === only) : CATALOGUE;
  if (rows.length === 0) throw new Error(`대상 템플릿이 없습니다 (ONLY=${only})`);

  const problems = validate(rows);
  if (problems.length) {
    console.error("✗ 검증 실패:");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  const nSms = rows.filter((t) => t.kind === "sms").length;
  console.log(`✓ 검증 통과 — 이메일 ${rows.length - nSms}종 × ${LOCALES.length}개 로케일 + SMS ${nSms}종(ko)`);

  if (process.env.DRY_RUN) {
    for (const t of rows) console.log(`  [dry] ${t.category.padEnd(9)} ${t.kind}/${t.key}`);
    return;
  }

  // pg 는 여기서 처음 필요하다 — DRY_RUN 검증은 DB 드라이버 없이도 돌아야 한다.
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  const keepExisting = !!process.env.KEEP_EXISTING;
  let created = 0, updated = 0, skipped = 0;

  try {
    for (const t of rows) {
      if (keepExisting) {
        const { rowCount } = await pool.query(
          "SELECT 1 FROM document_templates WHERE kind=$1 AND key=$2", [t.kind, t.key]);
        if (rowCount) { skipped++; console.log(`· ${t.kind}/${t.key} — 이미 존재, 건너뜀`); continue; }
      }

      const { rows: [tpl] } = await pool.query(
        `INSERT INTO document_templates (kind, key, name, description, category, variables_schema, status, version)
         VALUES ($1,$2,$3,$4,$5,$6,'published',1)
         ON CONFLICT (kind, key) DO UPDATE SET
           name=EXCLUDED.name, description=EXCLUDED.description, category=EXCLUDED.category,
           variables_schema=EXCLUDED.variables_schema, status='published', updated_at=NOW()
         RETURNING id, (xmax = 0) AS inserted`,
        [t.kind, t.key, t.name, t.description, t.category, JSON.stringify(t.vars)]);

      for (const loc of localesFor(t)) {
        const { subject, body } = t.tr[loc];
        await pool.query(
          `INSERT INTO document_template_translations (template_id, locale, subject, body_html)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (template_id, locale) DO UPDATE SET
             subject=EXCLUDED.subject, body_html=EXCLUDED.body_html, updated_at=NOW()`,
          [tpl.id, loc, subject, body]);
      }

      tpl.inserted ? created++ : updated++;
      console.log(`✓ ${t.category.padEnd(9)} ${t.kind}/${t.key} (#${tpl.id}) — ${localesFor(t).length} 로케일`);
    }
    console.log(`\n완료 — 신규 ${created} · 갱신 ${updated} · 건너뜀 ${skipped}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
