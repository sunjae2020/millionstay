#!/usr/bin/env node
// Node 버전 선언 일치 검사.
//
// 2026-09-04 프로덕션 장애의 진짜 원인은 "Node 18" 이 아니라 **아무도 버전을
// 말하지 않았다**는 것이다. 선언이 없으면 빌더가 자기 기본값을 고르고, 그 기본값은
// CI 가 쓰는 버전과 다를 수 있으며, 그 차이는 런타임에만 드러난다.
//
// 그래서 두 곳이 서로 어긋나지 않는지 검사한다.
//   .github/workflows/ci.yml  node-version:            ← 타입체크·빌드가 도는 버전
//   nixpacks.toml             NIXPACKS_NODE_VERSION    ← Railway 가 실행하는 버전
// package.json engines.node 는 하한선이므로 major 가 그 범위 안인지만 본다.
import { readFileSync } from "node:fs";

const fail = (msg) => { console.error(`✗ ${msg}`); process.exitCode = 1; };

const ci = readFileSync(".github/workflows/ci.yml", "utf8");
const ciVersions = [...ci.matchAll(/node-version:\s*['"]?(\d+)/g)].map((m) => m[1]);
if (ciVersions.length === 0) fail("ci.yml 에서 node-version 을 찾지 못했다.");
const uniqueCi = [...new Set(ciVersions)];
if (uniqueCi.length > 1) fail(`ci.yml 안에서 node-version 이 갈린다: ${uniqueCi.join(", ")}`);
const ciMajor = uniqueCi[0];

const nixpacks = readFileSync("nixpacks.toml", "utf8");
const pinned = /NIXPACKS_NODE_VERSION\s*=\s*"(\d+)"/.exec(nixpacks)?.[1];
if (!pinned) {
  fail('nixpacks.toml 에 NIXPACKS_NODE_VERSION 이 없다 — 없으면 nixpacks 가 기본값(구버전)으로 떨어진다.');
} else if (pinned !== ciMajor) {
  fail(`런타임과 CI 의 Node 가 다르다: nixpacks=${pinned}, ci.yml=${ciMajor}. 런타임 전용 버그가 CI 를 통과한다.`);
}

const engines = JSON.parse(readFileSync("package.json", "utf8")).engines?.node;
if (!engines) {
  fail('package.json 에 engines.node 가 없다 — 빌더가 바뀌면 하한선이 사라진다.');
} else {
  const floor = /(\d+)/.exec(engines)?.[1];
  if (floor && ciMajor && Number(ciMajor) < Number(floor)) {
    fail(`ci.yml node ${ciMajor} 가 engines.node "${engines}" 하한선보다 낮다.`);
  }
}

if (!process.exitCode) {
  console.log(`✓ node pin consistent — ci.yml=${ciMajor}, nixpacks=${pinned}, engines="${engines}"`);
}
