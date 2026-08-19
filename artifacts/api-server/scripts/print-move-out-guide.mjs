/**
 * 퇴거 세대 정산 확인서 3번 안내사항 — 템플릿 본문 생성기.
 *
 * `pdf.move_out_confirmation` 템플릿에 심는 6개 국어 본문을 문서 렌더러와 같은
 * i18n 문자열에서 뽑아낸다. 문구를 고칠 때는 `lib/documents/i18n.ts` 의
 * `moveout.guide.*` 만 고치고 이 스크립트를 다시 돌리면 스튜디오 사본과 코드
 * 기본값이 갈라지지 않는다.
 *
 *   node scripts/print-move-out-guide.mjs            # JSON {locale: html}
 *   node scripts/print-move-out-guide.mjs --sql      # 양 DB 에 넣을 UPSERT SQL
 */
import { build } from "esbuild";
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LOCALES = ["en", "ko", "ja", "zh", "th", "vi"];
const entry = join(tmpdir(), `mo-guide-${process.pid}.ts`);
writeFileSync(entry, `
import { buildMoveOutGuideTemplate } from "${join(process.cwd(), "src/lib/documents/moveOutSettlementDocument")}";
const out: Record<string, string> = {};
for (const l of ${JSON.stringify(LOCALES)}) out[l] = buildMoveOutGuideTemplate(l as any);
console.log(JSON.stringify(out));
`);
const bundle = join(tmpdir(), `mo-guide-${process.pid}.cjs`);
await build({ entryPoints: [entry], bundle: true, platform: "node", format: "cjs", outfile: bundle, logLevel: "error" });
const { execFileSync } = await import("node:child_process");
const bodies = JSON.parse(execFileSync(process.execPath, [bundle], { encoding: "utf8" }));
unlinkSync(entry); unlinkSync(bundle);

if (!process.argv.includes("--sql")) {
  console.log(JSON.stringify(bodies, null, 2));
} else {
  const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
  const rows = LOCALES.map((l) => `  (${q(l)}, ${q(bodies[l])})`).join(",\n");
  console.log(`-- pdf.move_out_confirmation 3번 안내사항 본문 (generated)
WITH tpl AS (SELECT id FROM document_templates WHERE kind='pdf' AND key='pdf.move_out_confirmation'),
     body(locale, html) AS (VALUES
${rows}
     )
INSERT INTO document_template_translations (template_id, locale, body_html)
SELECT tpl.id, body.locale, body.html FROM tpl, body
ON CONFLICT (template_id, locale) DO UPDATE SET body_html = EXCLUDED.body_html;

UPDATE document_templates SET variables_schema = '{"ref":{"type":"string"},"refund_amount":{"type":"string"},"deposit_amount":{"type":"string"},"contact_phone":{"type":"string"},"door_password":{"type":"string"},"unit":{"type":"string"},"tenant_name":{"type":"string"}}'::jsonb
WHERE kind='pdf' AND key='pdf.move_out_confirmation';`);
}
