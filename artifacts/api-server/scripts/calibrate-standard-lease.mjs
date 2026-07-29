/**
 * 표준임대차계약서(별지 제24호서식) 좌표 캘리브레이션 도구.
 *
 *   node scripts/calibrate-standard-lease.mjs            # 샘플 값으로 채운 PDF
 *   node scripts/calibrate-standard-lease.mjs --boxes    # 필드 자리에 빨간 상자까지
 *   node scripts/calibrate-standard-lease.mjs --blank    # 값 없이 → 원본과 동일해야 함
 *   node scripts/calibrate-standard-lease.mjs --mapper   # 계약 데이터 → 매퍼를 태운 실제 발급 경로
 *
 * 결과: scripts/out/standard-lease-calibration.pdf
 * 눈으로 볼 때:  pdftoppm -r 150 -png scripts/out/standard-lease-calibration.pdf scripts/out/cal
 *
 * TS 소스를 그대로 쓰려고 esbuild 로 한 번 번들해서 실행한다(런타임 코드와
 * 캘리브레이션이 갈라지지 않게 — 좌표 맵이 곧 프로덕션 좌표 맵이다).
 */
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const outDir = path.join(here, "out");

const args = new Set(process.argv.slice(2));
const blank = args.has("--blank");
const boxes = args.has("--boxes");
const mapper = args.has("--mapper");

/** 계약 데이터 모양 그대로의 샘플 — 실제 발급 경로(매퍼)를 검증한다. */
const CONTRACT_SAMPLE = {
  signed_on: "2026-05-20",
  landlord: {
    name: "㈜에이치케이건설자산관리",
    address: "전남 여수시 좌수영로 101, 102호(연등동, 메트하임 여수)",
    id_no: "135-86-40791",
    phone: "031-926-2281",
  },
  landlord_rental_biz_no: "2026-여수시-임대사업자-11",
  tenant: {
    name: "김샘플",
    address: "전남 여수시 좌수영로 101, 메트하임 810호",
    id_no: "000000-0******",
    phone: "010-0000-0000",
  },
  property_address: "전남 여수시 좌수영로 101 메트하임 1907호",
  housing_type: "apartment",
  area_exclusive_m2: 25.76,
  area_common_residential_m2: 14.388,
  area_common_other_m2: 26.256,
  rental_type: "short_term",
  rental_term_years: 6,
  supply_kind: "built",
  mandatory_start_date: "2026-05-20",
  over_100_units: true,
  senior_lien: false,
  tax_arrears: false,
  guarantee_status: "joined",
  guarantee_amount: 3000000,
  deposit_amount: 3000000,
  monthly_rent: 600000,
  start_date: "2026-05-20",
  end_date: "2027-02-26",
  down_payment: 3000000,
  account_number: "131-022-898360",
  bank_name: "신용협동조합",
  account_holder: "㈜신영부동산신탁",
  late_fee_rate: 12,
};

/** 모든 칸을 채워 넣는 최대치 샘플 — 칸 넘침·정렬을 한눈에 본다. */
const SAMPLE = {
  contract_date_year: "2026", contract_date_month: "7", contract_date_day: "29",

  landlord_name: "에이치케이건설자산관리 주식회사",
  landlord_address: "전라남도 여수시 좌수영로 101",
  landlord_id_no: "135-86-40791",
  landlord_phone: "061-000-0000",
  landlord_rental_biz_no: "여수시 제2026-000호",

  tenant_name: "홍길동",
  tenant_address: "서울특별시 강남구 테헤란로 000, 000동 000호",
  tenant_id_no: "900101-1******",
  tenant_phone: "010-0000-0000",

  broker_office_name: "메트하임공인중개사사무소",
  broker_ceo_name: "김중개",
  broker_office_address: "전라남도 여수시 좌수영로 101, 1층",
  broker_reg_no: "46130-2026-00000",
  broker_phone: "061-000-0000",

  property_address: "전라남도 여수시 좌수영로 101, 메트하임 여수 101동 1101호",
  housing_type_apartment: true,

  area_exclusive: "84.9700", area_common_residential: "25.1200",
  area_common_other: "38.4400", area_total: "148.5300",

  type_long_term: true, type_long_term_10y: true, supply_built: true,
  mandatory_start_year: "2026", mandatory_start_month: "8", mandatory_start_day: "1",
  over_100_units_yes: true,
  ancillary_facilities: "주차장, 경비실, 관리사무소, 커뮤니티시설",

  senior_lien_exists: true,
  senior_lien_kind: "근저당권",
  senior_lien_amount: "1,200,000,000원",
  senior_lien_date: "2024. 3. 15.",
  tax_arrears_none: true,

  guarantee_joined: true,
  guarantee_joined_amount: "50,000,000원",

  deposit_amount_words: "오천만", deposit_amount_figures: "50,000,000",
  rent_amount_words: "구십오만", rent_amount_figures: "950,000",
  term_start_year: "2026", term_start_month: "8", term_start_day: "1",
  term_end_year: "2028", term_end_month: "7", term_end_day: "31",

  down_payment_words: "오백만", down_payment_figures: "5,000,000",
  interim_payment_words: "이천만", interim_payment_figures: "20,000,000",
  interim_payment_year: "2026", interim_payment_month: "7", interim_payment_day: "15",
  balance_words: "이천오백만", balance_figures: "25,000,000",
  balance_year: "2026", balance_month: "8", balance_day: "1",

  account_number: "123-456789-01-234", bank_name: "국민", account_holder: "(주)에이치케이건설자산관리",
  late_fee_rate: "12",

  move_in_start_year: "2026", move_in_start_month: "8", move_in_start_day: "1",
  move_in_end_year: "28", move_in_end_month: "8", move_in_end_day: "31",

  broker_assistant_name: "이보조",

  explain_tenant_name: "홍길동",
  consent_tenant_name: "홍길동",
};

async function main() {
  await mkdir(outDir, { recursive: true });

  // TS 렌더러를 임시 번들로 뽑아 그대로 실행한다.
  const bundle = path.join(outDir, ".renderer.mjs");
  await build({
    entryPoints: [path.join(root, "scripts/lib/mlt-form-entry.ts")],
    outfile: bundle,
    bundle: true,
    platform: "node",
    format: "esm",
    external: ["pdf-lib", "@pdf-lib/fontkit"],
    logLevel: "warning",
    banner: {
      js: "import { fileURLToPath as __f } from 'node:url';import { dirname as __d } from 'node:path';const __dirname = __d(__f(import.meta.url));",
    },
  });

  // 번들은 scripts/out 에 있으므로 자산 경로를 src/lib/documents/forms 로 잡아 준다.
  process.env.FORM_ASSET_DIR = path.join(root, "src/lib/documents/forms");
  const mod = await import(`${bundle}?t=${Date.now()}`);

  const bytes = mapper
    ? await mod.buildMltStandardLeasePdf(CONTRACT_SAMPLE)
    : await mod.fillMltStandardLease(blank ? {} : SAMPLE, { debugBoxes: boxes });
  const out = path.join(outDir, "standard-lease-calibration.pdf");
  await writeFile(out, bytes);
  await rm(bundle, { force: true });
  console.log(`✓ ${out}  (${mapper ? "계약 데이터 매퍼" : blank ? "빈 서식" : "좌표 샘플"}${boxes ? " + 필드 상자" : ""})`);
}

main().catch((err) => { console.error(err); process.exit(1); });
