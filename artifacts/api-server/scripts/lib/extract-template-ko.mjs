// 시드 스크립트에서 지정한 키들의 ko 제목/본문을 humanize 입력용 평문으로 뽑는다.
// usage: node extract_ko.mjs <seed.mjs> <out.txt> [key1 key2 ...]   (키 생략 시 전체)
import fs from "node:fs";

const [seedPath, outPath, ...keys] = process.argv.slice(2);
const src = fs.readFileSync(seedPath, "utf8");
const want = keys.length ? new Set(keys) : null;

// body 는 두 형태 — 백틱 조각 연결(shell) 또는 큰따옴표 한 줄(note).
const re = /key: "([a-z_.]+)",[\s\S]*?ko: \{\s*(?:subject: "([^"]*)",\s*)?body:\s*((?:\s*`[^`]*`\s*\+?)+|"[^"]*")/g;
const out = [];
let m;
while ((m = re.exec(src))) {
  const [, key, subject, raw] = m;
  if (want && !want.has(key)) continue;
  const body = raw
    .replace(/^"|"$/g, "")
    .replace(/[`+]/g, " ")
    .replace(/<[^>]+>/g, "\n")
    .split("\n").map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
  out.push(`### ${key}\n제목: ${subject ?? "(없음)"}\n${body}\n`);
}

if (want) {
  const missing = [...want].filter((k) => !out.some((o) => o.startsWith(`### ${k}\n`)));
  if (missing.length) { console.error(`✗ 추출 실패: ${missing.join(", ")}`); process.exit(1); }
}

fs.mkdirSync(outPath.replace(/\/[^/]+$/, ""), { recursive: true });
fs.writeFileSync(outPath, out.join("\n"));
console.log(`${out.length} templates → ${outPath}`);
