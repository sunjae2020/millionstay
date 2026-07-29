/**
 * Korean lease agreement (임대차 계약서) — full document builder.
 *
 * Reproduces the layout of the 시행사 (주)HK / 메트하임 여수 임대차 계약서:
 *
 *   ① 임대차 목적물의 부동산 표기   — 소재지·건물명 / 임차할 부분·전용면적·타입 / 용도
 *   ② 계약내용                      — 보증금·계약금·잔금·차임·기간·납부계좌
 *   ③ 계약 체결일 + 체결 문언
 *   ④ 당사자 표                     — 임대인(갑) / 임차인(을)
 *   ⑤ 계약일반조항                  — 제1조~제11조 (editable template body)
 *   ⑥ 별지 (특약사항)               — 부동산의 표식 표 + 특약사항, same PDF
 *
 * ONE standard document serves every unit type: the type-specific detail
 * (타입명, 전용/임대면적, 대지권비율, 호수, 층) is read from the contract's
 * `spaces` row, falling back to its parent type space — which is where Metheim
 * authors the area breakdown for A / A-1 / B / C / D / D-1 / E / E-1.
 *
 * The clause text and 특약사항 are NOT hardcoded here: they come from the
 * editable `pdf.lease_agreement` template (Templates Studio → PDF), split at the
 * `[별지]` marker, so ops can revise wording without a deploy.
 */
import { renderDocumentShell, escapeHtml, getCompanyInfo, type CompanyInfo } from "./theme";
import { formatDocDate, type DocLang } from "./i18n";
import type { ContractPremises } from "./contractDocument";

/** A 납부계좌 line (from `payment_info`). */
export interface LeaseBankAccount {
  /** Row label, e.g. "임대료 납부계좌" / "보증금 납부계좌". */
  label: string;
  bank_name?: string | null;
  account_number?: string | null;
  account_name?: string | null;
}

/** One party of the agreement (임대인 "갑" / 임차인 "을"). */
export interface LeaseParty {
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  /** 사업자등록번호 (landlord) — omitted when blank. */
  business_no?: string | null;
  /** 법인등록번호 (landlord) — omitted when blank. */
  corporate_no?: string | null;
  /** 주민등록번호 (tenant) — omitted when blank. Never derived automatically. */
  resident_no?: string | null;
  /** Drawn signature / seal image, printed in place of the “(인)” 날인 mark. */
  seal_image?: string | null;
}

export interface KoreanLeaseDocInput {
  contract_ref: string;
  /** Document title, e.g. "메트하임 여수 임대차 계약서". */
  title: string;
  premises: ContractPremises | null;
  /** 별지 부동산의 표식 — land/building registry details from the property. */
  registry?: {
    lot_address?: string | null;
    building_use?: string | null;
    building_structure?: string | null;
    land_category?: string | null;
    land_area_m2?: number | null;
    land_right_type?: string | null;
    /** 임대 부분, e.g. "전유부분 전체". */
    leased_portion?: string | null;
  } | null;
  landlord: LeaseParty;
  tenant: LeaseParty;
  currency: string;
  deposit_amount: number | null;
  down_payment: number | null;
  down_payment_date: string | null;
  balance_amount: number | null;
  balance_date: string | null;
  monthly_rent: number | null;
  rent_due_day: number | null;
  start_date: string | null;
  end_date: string | null;
  /** 계약 체결일 — defaults to the contract's creation date. */
  signed_on: string | Date | null;
  accounts: LeaseBankAccount[];
  /** 계약일반조항 본문 (제1조~) — plain text from the editable template. */
  clauses_text: string | null;
  /** 별지 특약사항 본문 — plain text from the editable template, after `[별지]`. */
  annex_text: string | null;
}

// ── Korean amount rendering (금 이천사백만 원정) ────────────────────────────
const DIGITS = ["영", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
const SMALL_UNITS = ["", "십", "백", "천"];
const BIG_UNITS = ["", "만", "억", "조", "경"];

/** Spell a non-negative integer in Sino-Korean numerals (24000000 → 이천사백만). */
export function koreanNumerals(value: number): string {
  const n = Math.floor(Math.abs(value));
  if (n === 0) return "영";
  // Split into 4-digit groups, least significant first, and label each with 만/억/조.
  const groups: string[] = [];
  let rest = n;
  let groupIndex = 0;
  while (rest > 0 && groupIndex < BIG_UNITS.length) {
    const chunk = rest % 10000;
    rest = Math.floor(rest / 10000);
    if (chunk > 0) {
      let text = "";
      for (let pos = 3; pos >= 0; pos--) {
        const digit = Math.floor(chunk / 10 ** pos) % 10;
        if (digit === 0) continue;
        // Contract convention spells the 1 out (일백/일천), as in the source
        // document's "이천일백육십만 원정" — never abbreviated to 백/천.
        text += DIGITS[digit] + SMALL_UNITS[pos];
      }
      groups.unshift(text + BIG_UNITS[groupIndex]);
    }
    groupIndex++;
  }
  return groups.join("");
}

/** "금 이천사백만 원정 (₩24,000,000)" — the standard Korean contract amount form. */
function amountKo(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return "";
  const n = Number(value);
  return `금 ${koreanNumerals(n)} 원정 (₩${n.toLocaleString("ko-KR")})`;
}

/**
 * Dates on a Korean contract are written 2026년 02월 21일, not in the app-wide
 * numeric format — so `ko` documents spell them out and other languages keep the
 * configured format.
 */
function leaseDate(value: string | Date | null | undefined, lang: DocLang): string {
  if (value == null || value === "") return "";
  if (lang !== "ko") return formatDocDate(value, lang);
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return formatDocDate(value, lang);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}년 ${mm}월 ${dd}일`;
}

/** Area with the m² unit; empty when unset or zero. */
function areaText(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value)) || Number(value) === 0) return "";
  return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 })}㎡`;
}

const CELL = "padding:6px 10px;border:1px solid #333;font-size:12px;color:#111;vertical-align:middle;";
const HEAD = `${CELL}background:#F2F2F2;font-weight:700;text-align:center;white-space:nowrap;`;
const TABLE = "width:100%;border-collapse:collapse;margin:8px 0 18px;table-layout:fixed;";

/** `■ 라벨` section heading, matching the source document's bullets. */
function heading(text: string): string {
  return `<div style="font-size:13px;font-weight:700;color:#111;margin:16px 0 4px;">■ ${escapeHtml(text)}</div>`;
}

/** ① 임대차 목적물의 부동산 표기. */
function renderPremisesTable(d: KoreanLeaseDocInput): string {
  const p = d.premises;
  const location = [p?.location, p?.building].filter(Boolean).join(" ");
  // Unit names are usually already written "802호"; only append 호 when absent.
  const unit = p?.unit_no ? (/호\s*$/.test(p.unit_no) ? p.unit_no : `${p.unit_no} 호`) : "";
  const exclusive = areaText(p?.exclusive_area_m2);
  const type = p?.unit_type ?? "";
  return `${heading("임대차 목적물의 부동산 표기")}
    <table style="${TABLE}">
      <tr>
        <th style="${HEAD}width:22%;">소재지 및 건물명</th>
        <td style="${CELL}" colspan="4">${escapeHtml(location)}</td>
      </tr>
      <tr>
        <th style="${HEAD}">임차할 부분</th>
        <td style="${CELL}text-align:center;">${escapeHtml(unit)}</td>
        <th style="${HEAD}width:14%;">전용면적</th>
        <td style="${CELL}text-align:center;width:18%;">${escapeHtml(exclusive)}</td>
        <td style="${CELL}text-align:center;width:16%;font-weight:700;">${escapeHtml(type)}</td>
      </tr>
      <tr>
        <th style="${HEAD}">용 도</th>
        <td style="${CELL}" colspan="4">${escapeHtml(p?.structure_use ?? "")}</td>
      </tr>
    </table>`;
}

/** ② 계약내용 — amounts, term and payment accounts. */
function renderTermsTable(d: KoreanLeaseDocInput, lang: DocLang): string {
  const date = (v: string | null) => leaseDate(v, lang);
  const accounts = d.accounts
    .filter((a) => a.bank_name || a.account_number)
    .map((a) => `${escapeHtml(a.label)} : ${escapeHtml(
      [a.bank_name, a.account_number].filter(Boolean).join(" "),
    )}${a.account_name ? ` 예금주 : ${escapeHtml(a.account_name)}` : ""}`)
    .join("<br/>");
  const row = (label: string, value: string) =>
    `<tr><th style="${HEAD}width:22%;">${escapeHtml(label)}</th><td style="${CELL}">${value}</td></tr>`;
  return `${heading("계약내용")}
    <table style="${TABLE}">
      ${row("임대차보증금", escapeHtml(amountKo(d.deposit_amount)))}
      ${d.down_payment != null ? row("계 약 금", `${escapeHtml(amountKo(d.down_payment))}${d.down_payment_date ? `은 ${escapeHtml(date(d.down_payment_date))} 입금한다.` : "은 계약시 입금"}`) : ""}
      ${d.balance_amount != null ? row("잔 금", `${escapeHtml(amountKo(d.balance_amount))}${d.balance_date ? `은 ${escapeHtml(date(d.balance_date))} 입금한다.` : ""}`) : ""}
      ${d.monthly_rent != null ? row("차임(월세)", `${escapeHtml(amountKo(d.monthly_rent))}${d.rent_due_day ? `은 매월 ${d.rent_due_day}일에 입금한다.` : ""}`) : ""}
      ${row("임대차 기간", `${escapeHtml(date(d.start_date))} ~ ${escapeHtml(date(d.end_date))}`)}
      ${accounts ? row("납 부 계 좌", accounts) : ""}
    </table>`;
}

/** ④ 당사자 표 — 임대인(갑) / 임차인(을). */
function renderParties(d: KoreanLeaseDocInput): string {
  const side = (mark: string, p: LeaseParty, isLandlord: boolean) => {
    const idLabel = isLandlord ? "사업자등록번호" : "주민 등록 번호";
    const idValue = isLandlord ? p.business_no : p.resident_no;
    return `
      <tr>
        <th style="${HEAD}width:6%;" rowspan="${isLandlord ? 4 : 3}">${escapeHtml(mark)}</th>
        <th style="${HEAD}width:18%;">주 소</th>
        <td style="${CELL}" colspan="3">${escapeHtml(p.address ?? "")}</td>
      </tr>
      <tr>
        <th style="${HEAD}">성 명</th>
        <td style="${CELL}">${escapeHtml(p.name ?? "")} ${
          p.seal_image
            ? `<img src="${p.seal_image}" alt="" style="height:34px;vertical-align:middle;margin-left:6px;" />`
            : "(인)"
        }</td>
        <th style="${HEAD}width:12%;">전 화</th>
        <td style="${CELL}width:26%;">${escapeHtml(p.phone ?? "")}</td>
      </tr>
      <tr>
        <th style="${HEAD}">${escapeHtml(idLabel)}</th>
        <td style="${CELL}">${escapeHtml(idValue ?? "")}</td>
        <th style="${HEAD}">E-mail</th>
        <td style="${CELL}">${escapeHtml(p.email ?? "")}</td>
      </tr>
      ${isLandlord ? `<tr>
        <th style="${HEAD}">법인 등록 번호</th>
        <td style="${CELL}" colspan="3">${escapeHtml(p.corporate_no ?? "")}</td>
      </tr>` : ""}`;
  };
  return `<table style="${TABLE}">
      ${side("임대인 (갑)", d.landlord, true)}
      ${side("임차인 (을)", d.tenant, false)}
    </table>`;
}

/** Plain-text clause body → escaped paragraphs, blank lines separating them. */
function renderProse(text: string | null | undefined): string {
  if (!text?.trim()) return "";
  return text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 10px;font-size:12px;line-height:1.75;color:#111;white-space:pre-wrap;">${escapeHtml(p.trim())}</p>`)
    .join("");
}

/** ⑥ 별지 — 부동산의 표식 + 특약사항, page-broken into the SAME PDF. */
function renderAnnexPage(d: KoreanLeaseDocInput): string {
  if (!d.annex_text?.trim() && !d.registry) return "";
  const r = d.registry;
  const p = d.premises;
  const typeSuffix = p?.unit_type ? ` (${p.unit_type})` : "";
  const lot = [r?.lot_address, p?.unit_no ? (/호\s*$/.test(p.unit_no) ? p.unit_no : `${p.unit_no} 호`) : null].filter(Boolean).join(" ");
  // 대지권비율 = 대지지분 / 토지면적, written as "3519분의 8.762".
  const landRatio =
    r?.land_area_m2 != null && p?.land_share_m2 != null
      ? `${Number(r.land_area_m2)}분의 ${Number(p.land_share_m2)}`
      : "";
  const pair = (l1: string, v1: string, l2: string, v2: string) =>
    v1 || v2
      ? `<tr>
          <th style="${HEAD}width:20%;">${escapeHtml(l1)}</th><td style="${CELL}text-align:center;width:30%;">${escapeHtml(v1)}</td>
          <th style="${HEAD}width:20%;">${escapeHtml(l2)}</th><td style="${CELL}text-align:center;width:30%;">${escapeHtml(v2)}</td>
        </tr>`
      : "";
  const registryTable = r
    ? `<div style="font-size:13px;font-weight:700;margin:16px 0 4px;">◆ 부동산의 표식</div>
       <table style="${TABLE}">
         ${lot ? `<tr><th style="${HEAD}">소 재 지</th><td style="${CELL}" colspan="3">${escapeHtml(lot)}</td></tr>` : ""}
         ${pair("건 물 용 도", r.building_use ?? "", "건 물 구 조", r.building_structure ?? "")}
         ${pair("임 대 면 적", areaText(p?.exclusive_area_m2), "임 대 부 분", r.leased_portion ?? "")}
         ${pair("토 지 지 목", r.land_category ?? "", "토 지 면 적", areaText(r.land_area_m2))}
         ${pair("대지권종류", r.land_right_type ?? "", "대지권비율", landRatio)}
       </table>`
    : "";
  return `<div style="page-break-before:always;break-before:page;">
      <h2 style="text-align:center;font-size:19px;margin:0 0 18px;">${escapeHtml(d.title.replace(/임대차 계약서$/, "월세 계약서 별지"))}${escapeHtml(typeSuffix)}</h2>
      ${registryTable}
      ${d.annex_text?.trim() ? `<div style="font-size:13px;font-weight:700;margin:16px 0 6px;">◆ 특약사항</div>${renderProse(d.annex_text)}` : ""}
      <div style="text-align:right;font-size:14px;font-weight:700;margin-top:36px;">${escapeHtml(d.landlord.name ?? "")}</div>
    </div>`;
}

export function buildKoreanLeaseBody(d: KoreanLeaseDocInput, lang: DocLang = "ko"): string {
  return `
    <h1 style="text-align:center;font-size:22px;letter-spacing:0.08em;margin:0 0 22px;">${escapeHtml(d.title)}</h1>
    ${renderPremisesTable(d)}
    ${renderTermsTable(d, lang)}
    ${heading(`계약 체결일 : ${leaseDate(d.signed_on, lang)}`)}
    <p style="font-size:12px;line-height:1.8;color:#111;margin:12px 0 18px;">
      위 표시재산을 임대차 함에 있어 임대인을 “갑”, 임차인을 “을”이라 하며, “을”은 이 계약서 및 계약일반조항의
      내용을 “갑”으로부터 충분히 설명 받아 숙지하였으며, 자유로운 의사로서 임대차계약을 체결하고, 계약이
      체결되었음을 증명하기 위하여 “갑”, “을” 당사자는 기명날인 후 각 1통씩 보관한다.
    </p>
    ${renderParties(d)}
    ${d.clauses_text?.trim() ? `
      <div style="text-align:center;font-size:15px;font-weight:700;background:#F2F2F2;padding:8px;margin:22px 0 14px;">계약일반조항</div>
      ${renderProse(d.clauses_text)}` : ""}
    ${renderAnnexPage(d)}
  `;
}

export function buildKoreanLeaseHtml(
  d: KoreanLeaseDocInput,
  company?: CompanyInfo,
  forPrint = true,
  lang: DocLang = "ko",
): string {
  return renderDocumentShell({
    docType: "임대차 계약서",
    bodyHtml: buildKoreanLeaseBody(d, lang),
    company: company ?? getCompanyInfo(),
    forPrint,
  });
}
