/**
 * set-kakao-template-id.mjs
 *
 * 심사 통과한 카카오 알림톡 `templateId` 를 SMS 템플릿에 연결한다.
 * templateId 는 재심사로 바뀌므로 코드에 박지 않고 DB(variables_schema.kakao)에 둔다 —
 * 이 스크립트로 넣으면 배포 없이 알림톡이 켜진다.
 *
 * 값을 넣기 전까지 sendSms() 는 알림톡을 시도하지 않고 SMS 로만 나간다. 즉 이 작업은
 * 언제 해도 안전하고, 되돌리려면 --clear 로 지우면 SMS 로 돌아간다.
 *
 * Usage:
 *   DATABASE_URL=… node scripts/set-kakao-template-id.mjs sms.booking_confirmed TX_0001
 *   DATABASE_URL=… node scripts/set-kakao-template-id.mjs sms.rent_due TX_0002 --button "청구서 보기"
 *   DATABASE_URL=… node scripts/set-kakao-template-id.mjs sms.booking_confirmed --clear
 *   DATABASE_URL=… node scripts/set-kakao-template-id.mjs --list
 */
import pg from "pg";

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const optval = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const positional = args.filter((a, i) =>
  !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--") && args[i - 1] !== "--clear" && args[i - 1] !== "--list"));

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL 이 필요합니다"); process.exit(1); }

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });

try {
  if (flag("--list")) {
    const { rows } = await pool.query(
      `select key, name, variables_schema->'kakao'->>'templateId' as template_id
         from document_templates where kind='sms' order by key`);
    console.log("SMS 템플릿 ↔ 알림톡 매핑\n");
    for (const r of rows) {
      console.log(`  ${(r.template_id ?? "—(SMS 전용)").padEnd(16)} ${r.key.padEnd(30)} ${r.name}`);
    }
    const linked = rows.filter((r) => r.template_id).length;
    console.log(`\n${linked}/${rows.length} 연결됨`);
    process.exit(0);
  }

  const [key, templateId] = positional;
  if (!key) { console.error("템플릿 키가 필요합니다 (예: sms.booking_confirmed)"); process.exit(1); }

  const { rows: [tpl] } = await pool.query(
    "select id, name, variables_schema from document_templates where kind='sms' and key=$1", [key]);
  if (!tpl) { console.error(`SMS 템플릿 없음: ${key}`); process.exit(1); }

  const schema = { ...(tpl.variables_schema ?? {}) };

  if (flag("--clear")) {
    delete schema.kakao;
    await pool.query("update document_templates set variables_schema=$1, updated_at=now() where id=$2",
      [JSON.stringify(schema), tpl.id]);
    console.log(`✓ ${key} — 알림톡 연결 해제. 이제 SMS 로만 발송됩니다.`);
    process.exit(0);
  }

  if (!templateId) { console.error("templateId 가 필요합니다"); process.exit(1); }

  const buttonName = optval("--button");
  schema.kakao = {
    templateId,
    ...(buttonName ? { buttons: [{ buttonType: "WL", buttonName, linkMo: "#{url}" }] } : {}),
  };

  await pool.query("update document_templates set variables_schema=$1, updated_at=now() where id=$2",
    [JSON.stringify(schema), tpl.id]);
  console.log(`✓ ${key} (${tpl.name}) → 알림톡 ${templateId}${buttonName ? ` + 버튼 "${buttonName}"` : ""}`);
  console.log("  KAKAO_PF_ID 가 설정돼 있으면 다음 발송부터 알림톡으로 나갑니다.");
} finally {
  await pool.end();
}
