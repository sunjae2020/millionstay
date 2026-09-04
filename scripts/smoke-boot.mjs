#!/usr/bin/env node
// api-server BOOT SMOKE TEST — "빌드가 됐다"와 "서버가 뜬다"는 다르다.
//
// 2026-09-04 프로덕션이 전면 중단됐다. `@simplewebauthn/server@14` 가 모듈 로드
// 시점에 `globalThis.crypto.subtle` 을 읽는데 Railway 가 Node 18 로 돌아서
// 부팅 즉시 크래시 루프에 빠졌다. CI 는 green 이었다 — `tsc` 와 esbuild 는
// 타입과 번들만 보고 **프로세스를 띄우지 않기 때문**이다.
//
// 이 스크립트는 번들을 실제로 실행해서 `/api/healthz` 가 응답할 때까지 기다린다.
// import 시점에 터지는 모든 사고(런타임 API 부재, 최상위 await 실패, 순환 참조,
// 라우트 중복 등록)를 여기서 잡는다.
//
// DB 는 붙지 않는다: `/healthz` 는 의존성 검사가 없는 liveness 이고 pg Pool 은
// 첫 쿼리 전까지 접속하지 않는다. DATABASE_URL 은 형식만 맞으면 되는 더미다.
// 부팅 직후 도는 백그라운드 작업(환율 동기화 등)은 DB 를 못 찾아 실패하지만,
// 그걸로 프로세스가 죽으면 안 된다 — 그것 자체가 이 테스트가 확인하는 속성이다.
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = process.env.SMOKE_PORT ?? "8099";
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS ?? 60_000);
const URL_ = `http://127.0.0.1:${PORT}/api/healthz`;

// 부팅 가드를 통과시키기 위한 더미 시크릿. 실제 토큰을 만들지도 검증하지도
// 않는다 — CI 에 진짜 값을 넣지 않기 위해 일부러 자리 표시자를 쓴다.
const SMOKE_SECRETS = Object.fromEntries(
  ["SESSION_SECRET", "JWT_SECRET", "PARTNER_JWT_SECRET", "GUEST_JWT_SECRET"]
    .map((k) => [k, process.env[k] ?? `smoke-${k.toLowerCase()}-not-a-real-secret`]),
);

const child = spawn(process.execPath, ["--enable-source-maps", "dist/index.mjs"], {
  cwd: "artifacts/api-server",
  env: {
    ...process.env,
    PORT,
    // production 으로 띄운다 — 실제로 도는 분기를 그대로 태워야 의미가 있다.
    NODE_ENV: "production",
    // 형식만 유효한 더미. 실제 접속은 일어나지 않는다(첫 쿼리에서만 붙는다).
    DATABASE_URL: process.env.SMOKE_DATABASE_URL ?? "postgresql://smoke:smoke@127.0.0.1:5432/smoke",
    // production 부팅 가드가 요구하는 시크릿들(app.ts REQUIRED_ENV + 세 JWT 스코프).
    // 서명 검증은 하지 않으므로 값 자체는 의미가 없고, "설정돼 있음"만 충족하면 된다.
    ...SMOKE_SECRETS,
  },
  stdio: ["ignore", "pipe", "pipe"],
});

// 서버 로그는 모아만 두고 실패할 때만 뱉는다. 성공한 부팅의 로그(DB 없는
// 환경이라 환율 동기화 등이 시끄럽게 실패한다)는 CI 출력에서 신호를 가린다.
let output = "";
const capture = (chunk) => { output += chunk; };
child.stdout.on("data", capture);
child.stderr.on("data", capture);

let exited = null;
child.on("exit", (code, signal) => { exited = { code, signal }; });

const started = Date.now();
let ok = false;
while (Date.now() - started < TIMEOUT_MS) {
  if (exited) break;                       // 죽었으면 더 기다릴 이유가 없다
  try {
    const res = await fetch(URL_, { signal: AbortSignal.timeout(3_000) });
    if (res.ok) { ok = true; break; }
  } catch {
    // 아직 안 떴다 — 계속 기다린다
  }
  await sleep(500);
}

if (!child.killed && exited === null) child.kill("SIGTERM");

if (ok) {
  console.log(`\n✓ boot smoke passed — ${URL_} answered in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  process.exit(0);
}

console.error(output);
console.error("\n✗ BOOT SMOKE FAILED — the server never answered /api/healthz.");
if (exited) console.error(`  process exited early (code=${exited.code} signal=${exited.signal})`);
else console.error(`  timed out after ${TIMEOUT_MS}ms`);
console.error("  이 실패는 '빌드는 되는데 런타임이 죽는' 부류다. 위 로그의 스택을 볼 것.");
process.exit(1);
