/**
 * dbGuard.mjs — DB 쓰기 스크립트 공용 안전장치.
 *
 * 로컬 개발이 실제 운영 Supabase DB를 그대로 바라보는 구조라, 시드·백필·마이그레이션
 * 스크립트가 엉뚱한 인스턴스에 붙는 사고를 막는다. 쓰기 가능한 스크립트는 DB에 붙기
 * 전에 `guardDbInstance()`를 호출한다:
 *
 *   import { guardDbInstance, confirmWrite } from "../../../scripts/lib/dbGuard.mjs";
 *   guardDbInstance();                       // --instance=<name> 플래그 필수
 *   guardDbInstance({ expected: "metheim" }); // 또는 코드에서 직접 선언
 *
 * 규칙:
 *   • DATABASE_URL에서 Supabase 프로젝트 ref를 파싱해 KNOWN_INSTANCES와 대조한다.
 *   • 아는 ref면 호출자가 선언한 인스턴스(--instance= 또는 expected)와 일치해야 한다.
 *   • 모르는 ref는 조용히 통과하지 않는다 — --allow-unknown-db 를 명시해야 한다.
 *   • 진행 전 비밀번호를 가린 접속 대상을 출력한다 (provision-instance.sh 와 동일).
 *
 * `confirmWrite()`는 --apply 플래그가 있어야 true를 돌려준다 — 기본은 dry-run.
 */

/** Supabase project ref → 인스턴스 이름. 새 인스턴스는 여기 한 곳에만 추가한다. */
export const KNOWN_INSTANCES = {
  rdwzpbxrkjlmtwcoiniq: "millionstay",
  dhdjxweuushugqltjael: "metheim",
};

/** 접속 문자열의 비밀번호를 ***로 가린다 (provision-instance.sh의 MASKED와 동일 규칙). */
export function maskDbUrl(url) {
  return String(url ?? "").replace(/(:\/\/[^:@/]*):[^@]*@/, "$1:***@");
}

/**
 * DATABASE_URL에서 Supabase project ref를 뽑아 인스턴스 이름으로 해석한다.
 * ref는 풀러 사용자명(`postgres.<ref>`) 또는 직결 호스트(`db.<ref>.supabase.co`)에 나타난다.
 * @returns {{ ref: string | null, instance: string | null }}
 */
export function resolveInstance(databaseUrl) {
  const url = String(databaseUrl ?? "");
  for (const [ref, instance] of Object.entries(KNOWN_INSTANCES)) {
    if (url.includes(ref)) return { ref, instance };
  }
  const m =
    url.match(/\/\/[^:@/]*?\.([a-z0-9]{15,})(?::[^@]*)?@/) || // postgres.<ref>[:pw]@pooler
    url.match(/@db\.([a-z0-9]{15,})\.supabase\.co/); // direct host
  return { ref: m ? m[1] : null, instance: null };
}

/**
 * 스크립트가 의도한 인스턴스와 DATABASE_URL이 가리키는 인스턴스가 같은지 검증한다.
 * 불일치·미선언·미등록 DB는 여기서 exit(1) — 통과하면 { ref, instance }를 돌려준다.
 *
 * @param {object} [opts]
 * @param {string} [opts.databaseUrl] 기본 process.env.DATABASE_URL — .env 파일에서
 *   직접 읽는 스크립트는 해석된 URL을 넘길 것.
 * @param {string} [opts.expected]    코드에서 직접 선언할 때. 없으면 --instance= 플래그.
 * @param {string[]} [opts.argv]      기본 process.argv.
 */
export function guardDbInstance({
  databaseUrl = process.env.DATABASE_URL,
  expected,
  argv = process.argv,
} = {}) {
  if (!databaseUrl) {
    console.error("✖ DATABASE_URL 이 설정되어 있지 않습니다.");
    process.exit(1);
  }
  const args = argv.slice(2);
  const flagValue = args.find((a) => a.startsWith("--instance="))?.slice("--instance=".length);
  const want = expected ?? flagValue ?? null;
  const allowUnknown = args.includes("--allow-unknown-db");
  const { ref, instance } = resolveInstance(databaseUrl);
  const known = Object.entries(KNOWN_INSTANCES)
    .map(([r, n]) => `${n} (${r})`)
    .join(", ");

  console.log(`→ 대상 DB: ${maskDbUrl(databaseUrl)}`);

  if (!instance) {
    if (!allowUnknown) {
      console.error(`✖ 등록되지 않은 DB입니다 (ref: ${ref ?? "판독 불가"}).`);
      console.error(`  등록된 인스턴스: ${known}`);
      console.error("  새 인스턴스 등이 맞다면 --allow-unknown-db 플래그를 명시해 다시 실행하세요.");
      process.exit(1);
    }
    console.log(`⚠ 등록되지 않은 DB(ref: ${ref ?? "판독 불가"})에 --allow-unknown-db 로 진행합니다.`);
    return { ref, instance: null };
  }

  if (!want) {
    console.error("✖ 이 스크립트는 --instance=<name> 플래그로 대상 인스턴스를 선언해야 합니다.");
    console.error(`  현재 DATABASE_URL 은 '${instance}' 인스턴스(ref: ${ref})를 가리킵니다.`);
    console.error(`  의도한 대상이 맞으면 --instance=${instance} 를 붙여 다시 실행하세요.`);
    process.exit(1);
  }
  if (want !== instance) {
    console.error(
      `✖ 인스턴스 불일치: 스크립트는 '--instance=${want}' 로 선언했지만 ` +
        `DATABASE_URL 은 '${instance}' 인스턴스(ref: ${ref})를 가리킵니다.`,
    );
    console.error("  DATABASE_URL 또는 --instance 값을 맞춘 뒤 다시 실행하세요.");
    process.exit(1);
  }
  console.log(`→ 인스턴스 확인: ${instance} (guard passed)`);
  return { ref, instance };
}

/**
 * 쓰기 확정 여부. --apply 플래그가 있어야 true — 기본은 dry-run.
 * 호출자는 false면 아무것도 쓰지 말아야 한다 (보통 안내 출력 후 종료).
 */
export function confirmWrite({ argv = process.argv, applyFlag = "--apply" } = {}) {
  const apply = argv.slice(2).includes(applyFlag);
  if (!apply) {
    console.log(`→ dry-run 모드입니다 (기본값) — 아무것도 쓰지 않습니다. 실제 적용은 ${applyFlag} 를 붙이세요.`);
  }
  return apply;
}
