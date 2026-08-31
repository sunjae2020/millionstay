#!/usr/bin/env node
// Fill the Metheim development site's CMS content: the unit-type tables and a
// per-page SEO block, in Korean (the site's default locale).
//
// Every figure here is READ FROM THE DATABASE, not written into this file — the
// eight type masters (spaces 276–283) already hold the real areas, deposits and
// rents, and the unit counts come from counting their children. A sales page
// must never carry a number somebody typed into a script.
//
// SEO copy IS written here: it describes what each page already says, which is
// editorial work rather than data. Other locales are filled afterwards by
// scripts/translate-page-contents.mjs.
//
// Usage:
//   DATABASE_URL=<metheim> node scripts/seed-metheim-page-content.mjs [--apply]

import pg from "pg";
import { guardDbInstance } from "./lib/dbGuard.mjs";

const APPLY = process.argv.includes("--apply");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL must be set (point it at the Metheim database)");
  process.exit(1);
}
// Metheim 전용 콘텐츠 시드 — 대상 인스턴스를 코드에서 못 박는다.
guardDbInstance({ databaseUrl: url, expected: "metheim" });

const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("supabase.") ? { rejectUnauthorized: false } : undefined,
});

const won = (value) => (value == null ? "" : `${Number(value).toLocaleString("ko-KR")}원`);
const sqm = (value) => (value == null ? "" : `${Number(value).toFixed(2)}㎡`);

// ── Per-page SEO (Korean). Written to match what each page actually contains.
const SEO = {
  "dev-home": {
    seo_title: "메트하임 여수 | 여수 원도심 풀옵션 소형 주거",
    seo_description:
      "여수 연등동 도보권 269세대 도시형 생활주택. 분양·임대·위탁관리를 한 곳에서 상담하고, 짐만 들고 바로 입주하세요.",
    seo_keywords: "메트하임, 메트하임 여수, 여수 원룸, 여수 투룸, 연등동 원룸, 여수 도시형생활주택, 여수 신축 임대",
  },
  "dev-about": {
    seo_title: "메트하임 소개 | 여수 밤바다를 담은 도심형 주거",
    seo_description:
      "메트하임 여수의 브랜드 이야기와 지향점. 작지만 답답하지 않은 풀옵션 설계로 1~2인 가구의 도심 생활을 제안합니다.",
    seo_keywords: "메트하임 소개, 메트하임 브랜드, 여수 도시형생활주택, 여수 소형주거",
  },
  "dev-buy": {
    seo_title: "분양 안내 | 메트하임 여수 타입별 면적과 잔여 세대",
    seo_description:
      "A~E-1 8개 타입의 전용·공급·계약 면적과 세대 구성을 확인하고 분양 상담을 신청하세요. 여수 원도심 269세대.",
    seo_keywords: "여수 분양, 메트하임 분양, 여수 도시형생활주택 분양, 여수 원룸 분양, 여수 투룸 분양",
  },
  "dev-rent": {
    seo_title: "임대 안내 | 메트하임 여수 보증금·월세와 공실 현황",
    seo_description:
      "타입별 보증금과 월 임대료를 한눈에 비교하고 지금 입주 가능한 세대를 확인하세요. 단기 체류와 장기 임대 모두 가능합니다.",
    seo_keywords: "여수 임대, 여수 월세, 여수 원룸 월세, 여수 투룸 월세, 메트하임 임대, 여수 단기임대",
  },
  "dev-manage": {
    seo_title: "위탁관리 | 메트하임 여수 임대·관리 대행",
    seo_description:
      "임대 상담부터 입주·유지보수·퇴거 정산까지 한 회사가 맡습니다. 소유하신 세대의 예상 수익을 확인해 보세요.",
    seo_keywords: "여수 위탁관리, 임대관리 대행, 여수 부동산 관리, 메트하임 위탁관리",
  },
  "dev-stayplan": {
    seo_title: "체류 플랜 | 메트하임 여수 단기·장기 이용 안내",
    seo_description: "필요한 기간만큼 고르는 체류 플랜. 가구와 가전이 갖춰진 세대에 짐만 들고 입주하세요.",
    seo_keywords: "여수 단기임대, 여수 한달살기, 여수 장기 숙박, 메트하임 체류",
  },
  "dev-resident": {
    seo_title: "입주자 안내 | 메트하임 여수",
    seo_description: "입주 절차와 생활 편의, 고장 접수 방법까지 입주자가 알아야 할 내용을 정리했습니다.",
    seo_keywords: "메트하임 입주자, 여수 원룸 입주, 입주 절차",
  },
  "dev-owner": {
    seo_title: "소유주 안내 | 메트하임 여수",
    seo_description: "세대를 소유하신 분을 위한 임대 운영과 정산 안내. 매월 관리 내역과 수익을 투명하게 공개합니다.",
    seo_keywords: "메트하임 소유주, 여수 임대수익, 임대 정산",
  },
  "dev-partner": {
    seo_title: "파트너 안내 | 메트하임 여수",
    seo_description: "중개·시공·생활서비스 파트너를 위한 협업 안내와 제휴 문의.",
    seo_keywords: "메트하임 파트너, 여수 부동산 제휴, 임대 파트너",
  },
  "dev-directions": {
    seo_title: "찾아오시는 길 | 메트하임 여수 (전남 여수시 좌수영로 101)",
    seo_description:
      "전남 여수시 좌수영로 101. 대중교통과 주차 안내, 현장 상담 연락처를 확인하세요.",
    seo_keywords: "메트하임 여수 위치, 좌수영로 101, 여수 연등동, 메트하임 찾아오는 길",
  },
  "dev-privacy": {
    seo_title: "개인정보처리방침 | 메트하임 여수",
    seo_description: "메트하임 여수가 수집하는 개인정보의 항목과 이용 목적, 보관 기간과 파기 절차를 안내합니다.",
    seo_keywords: "메트하임 개인정보처리방침",
  },
  "dev-terms": {
    seo_title: "이용약관 | 메트하임 여수",
    seo_description: "메트하임 여수 웹사이트와 상담 서비스 이용에 적용되는 약관입니다.",
    seo_keywords: "메트하임 이용약관",
  },
  "dev-search": {
    seo_title: "세대 찾기 | 메트하임 여수",
    seo_description: "타입과 기간, 예산으로 지금 입주 가능한 세대를 찾아보세요.",
    seo_keywords: "여수 원룸 검색, 여수 세대 찾기, 메트하임 공실",
  },
};

const client = await pool.connect();
try {
  // ── Real unit-type figures, straight from the type masters ──────────────
  const { rows: types } = await client.query(`
    SELECT p.name, p.custom_type_name,
           p.exclusive_area_m2, p.supply_area_m2, p.contract_area_m2,
           p.monthly_rent, p.deposit_amount,
           count(s.id)::int AS units
      FROM spaces p LEFT JOIN spaces s ON s.parent_space_id = p.id
     WHERE p.id BETWEEN 276 AND 283
     GROUP BY p.id, p.name, p.custom_type_name, p.exclusive_area_m2,
              p.supply_area_m2, p.contract_area_m2, p.monthly_rent, p.deposit_amount
     ORDER BY p.id`);

  if (types.length === 0) {
    console.error("no unit-type masters found — nothing to seed");
    process.exit(1);
  }

  const totalUnits = types.reduce((sum, row) => sum + row.units, 0);
  console.log(`unit types: ${types.length}, units: ${totalUnits}`);

  const buyFields = {};
  const rentFields = {};
  types.forEach((row, index) => {
    const n = index + 1;
    buyFields[`type_${n}_name`] = row.name;
    buyFields[`type_${n}_kind`] = row.custom_type_name ?? "";
    buyFields[`type_${n}_exclusive`] = sqm(row.exclusive_area_m2);
    buyFields[`type_${n}_supply`] = sqm(row.supply_area_m2);
    buyFields[`type_${n}_contract`] = sqm(row.contract_area_m2);
    buyFields[`type_${n}_units`] = String(row.units);

    rentFields[`type_${n}_name`] = row.name;
    rentFields[`type_${n}_kind`] = row.custom_type_name ?? "";
    rentFields[`type_${n}_exclusive`] = sqm(row.exclusive_area_m2);
    rentFields[`type_${n}_supply`] = sqm(row.supply_area_m2);
    rentFields[`type_${n}_deposit`] = won(row.deposit_amount);
    rentFields[`type_${n}_rent`] = won(row.monthly_rent);
  });

  const contentByPage = { "dev-buy": buyFields, "dev-rent": rentFields };

  console.log("\nunit-type table (from the database):");
  for (const row of types) {
    console.log(
      `  ${row.name.padEnd(8)} ${(row.custom_type_name ?? "").padEnd(4)} ` +
        `전용 ${sqm(row.exclusive_area_m2).padStart(8)}  공급 ${sqm(row.supply_area_m2).padStart(8)}  ` +
        `보증금 ${won(row.deposit_amount).padStart(12)}  월세 ${won(row.monthly_rent).padStart(10)}  ${row.units}세대`,
    );
  }
  console.log(`\nSEO pages: ${Object.keys(SEO).length}`);

  if (!APPLY) {
    console.log("\ndry run — pass --apply to write");
    process.exit(0);
  }

  let written = 0;
  for (const [pageKey, seo] of Object.entries(SEO)) {
    const extra = contentByPage[pageKey] ?? {};
    // Merge into the existing content rather than replacing it: an editor's
    // own copy on this page must survive a re-run.
    await client.query(
      `INSERT INTO page_contents (page_key, language, content, seo_title, seo_description, seo_keywords)
            VALUES ($1, 'ko', $2::jsonb, $3, $4, $5)
       ON CONFLICT (page_key, language) DO UPDATE
          SET content = page_contents.content || $2::jsonb,
              seo_title = $3, seo_description = $4, seo_keywords = $5,
              updated_at = now()`,
      [pageKey, JSON.stringify(extra), seo.seo_title, seo.seo_description, seo.seo_keywords],
    );
    written += 1;
  }
  console.log(`\napplied — ${written} pages`);
} catch (err) {
  console.error("failed:", err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
