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
  /** 법인등록번호 (landlord) — 사업자등록번호 옆칸에 인쇄된다. */
  corporate_no?: string | null;
  /**
   * 임대사업자등록번호 (landlord) — 계약에서 고른 임대사업자 등록증의 번호.
   * 등록임대주택이 아니면 "선택 안 함"이 기본이라 대개 비어 있고, 비면 칸만 빈다.
   */
  rental_business_no?: string | null;
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
  /**
   * 별지 특약사항 본문 — 이제 계약서 본문에는 찍히지 않는다. 첨부 문서
   * "별지 특약사항"을 체크했을 때만 뒤에 붙으므로 여기서는 쓰지 않는다.
   * @deprecated 첨부 경로(leaseAttachments)로 옮겨갔다.
   */
  annex_text: string | null;
  /** 제11조(특약사항) 본문 — 이 계약에만 적용되는 특약. 계약일반조항 뒤에 이어진다. */
  special_terms?: string | null;
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
export function leaseDate(value: string | Date | null | undefined, lang: DocLang): string {
  if (value == null || value === "") return "";
  if (lang !== "ko") return formatDocDate(value, lang);
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return formatDocDate(value, lang);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}년 ${mm}월 ${dd}일`;
}

/**
 * Korean documents print the Korean name only — a building recorded as
 * "메트하임 여수 (Metheim Yeosu)" appears as "메트하임 여수". Only a parenthetical
 * that is purely Latin/ASCII is dropped, so "(주)HK" or "여수 (구항)" survive.
 */
export function koreanOnlyName(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .replace(/\s*[（(][^)）]*[)）]/g, (m) => (/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(m) ? m : ""))
    .replace(/\s{2,}/g, " ")
    .trim();
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
  // 표제부도 제목과 같이 한글만 — "메트하임 여수 (Metheim Yeosu)" 의 영문 병기는 뗀다.
  const location = [p?.location, koreanOnlyName(p?.building)].filter(Boolean).join(" ");
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

/**
 * ④ 당사자 — 임대인(갑) / 임차인(을) 를 각각 별도의 표로 낸다.
 *
 * 한 표에 rowspan 으로 두 당사자를 묶으면 "임대인 (갑)" 이 좁은 세로칸에서
 * 줄바꿈되어 괘선 밖으로 밀려 나왔다. 이제 당사자별로 표를 나누고, 구분은 표의
 * 첫 행(머리줄) 안에 넣는다 — 표 밖에 뜨는 글자가 없다.
 */
function renderParty(mark: string, p: LeaseParty, isLandlord: boolean): string {
  const idLabel = isLandlord ? "사업자등록번호" : "주민등록번호";
  const idValue = isLandlord ? p.business_no : p.resident_no;
  // 이메일·임대사업자등록번호는 비어 있으면 빈칸이 아니라 "-" 로 낸다 — 적을 것이
  // 없는 것과 적기를 빠뜨린 것을 서명하는 사람이 구분할 수 있어야 한다.
  const dash = (v: string | null | undefined) => escapeHtml(v?.trim() ? v : "-");
  return `<table style="${TABLE}margin-bottom:10px;">
      <tr>
        <th style="${HEAD}text-align:left;padding:7px 10px;font-size:12.5px;letter-spacing:0.04em;" colspan="4">${escapeHtml(mark)}</th>
      </tr>
      <tr>
        <th style="${HEAD}width:18%;">주 소</th>
        <td style="${CELL}" colspan="3">${escapeHtml(p.address ?? "")}</td>
      </tr>
      <tr>
        <th style="${HEAD}">성 명</th>
        <td style="${CELL}width:32%;">${escapeHtml(p.name ?? "")} ${
          p.seal_image
            ? `<img src="${p.seal_image}" alt="" style="height:34px;vertical-align:middle;margin-left:6px;" />`
            : "(인)"
        }</td>
        <th style="${HEAD}width:16%;">연 락 처</th>
        <td style="${CELL}width:34%;">${escapeHtml(p.phone ?? "")}</td>
      </tr>
      <tr>
        <th style="${HEAD}">${isLandlord ? "이메일" : escapeHtml(idLabel)}</th>
        <td style="${CELL}">${isLandlord ? dash(p.email) : escapeHtml(idValue ?? "")}</td>
        <th style="${HEAD}">${isLandlord ? "법인등록번호" : "이메일"}</th>
        <td style="${CELL}">${isLandlord ? escapeHtml(p.corporate_no ?? "") : dash(p.email)}</td>
      </tr>
      ${isLandlord ? `<tr>
        <th style="${HEAD}">${escapeHtml(idLabel)}</th>
        <td style="${CELL}" colspan="3">${escapeHtml(p.business_no ?? "")}</td>
      </tr>
      <tr>
        <!-- 표는 table-layout:fixed 라 라벨 칸(18%)이 "임대사업자등록번호" 열 글자보다
             좁다. 이 칸만 좌우 여백을 줄여 라벨이 두 줄로 접히지 않게 하고, 값은
             칸을 끝까지 써서 등록번호가 통째로 한 줄에 들어가게 한다. -->
        <th style="${HEAD}padding-left:4px;padding-right:4px;">임대사업자등록번호</th>
        <td style="${CELL}" colspan="3">${dash(p.rental_business_no)}</td>
      </tr>` : ""}
    </table>`;
}

function renderParties(d: KoreanLeaseDocInput): string {
  return `<div style="page-break-inside:avoid;">
      ${renderParty("임대인 (갑)", d.landlord, true)}
      ${renderParty("임차인 (을)", d.tenant, false)}
    </div>`;
}

/**
 * Template bodies are authored as plain text, but the Templates Studio editor
 * saves through a rich-text field — so a body that has been edited there comes
 * back as one `<p>…</p>` blob with every newline collapsed to a space. Escaping
 * that verbatim printed a literal `<p>` and one unreadable wall of text.
 *
 * So: unwrap the HTML back to text first (block tags → newlines, entities
 * decoded, tags dropped) and let `reflowClauses` restore the clause structure.
 */
function htmlToText(input: string): string {
  return input
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, "\n\n")
    .replace(/<\s*li[^>]*>/gi, "\n· ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Rebuild the clause layout of a Korean lease body whose line breaks were lost:
 * every 제N조 heading starts a new paragraph, every (n) / N. item its own line.
 * Text that still has its own newlines is left exactly as authored.
 */
function reflowClauses(text: string): string {
  if (/\n/.test(text.trim())) return text;
  return text
    // 제1조 (…) — blank line before, line break after the heading's closing ).
    .replace(/\s*(제\s*\d+\s*조\s*\([^)]*\))\s*/g, "\n\n$1\n")
    // (1) (2) … sub-items, and "- 다 음 -" style centred markers.
    .replace(/\s+(\(\d+\))\s*/g, "\n$1 ")
    .replace(/\s*(-\s*다\s*음\s*-)\s*/g, "\n\n$1\n\n")
    // 1. 2. … numbered items (각 호 / 특약사항). The lookbehind keeps a date like
    // "2025. 10. 31." in one piece — only a number that does NOT follow another
    // "<숫자>." starts a new line.
    .replace(/(?<![0-9]\.)\s(\d{1,2}\.)\s+(?=\S)/g, "\n$1 ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Clause body (plain text or editor HTML) → escaped, structured paragraphs. */
function renderProse(text: string | null | undefined): string {
  if (!text?.trim()) return "";
  const plain = reflowClauses(/<[a-z/!][^>]*>/i.test(text) ? htmlToText(text) : text);
  return plain
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      // A 제N조 heading leads its own paragraph — print it bold on its own line.
      const m = p.match(/^(제\s*\d+\s*조\s*\([^)]*\))\n?([\s\S]*)$/);
      const head = m
        ? `<strong style="display:block;margin-bottom:2px;">${escapeHtml(m[1])}</strong>`
        : "";
      const body = escapeHtml(m ? m[2].trim() : p);
      return `<p style="margin:0 0 10px;font-size:12px;line-height:1.75;color:#111;white-space:pre-wrap;page-break-inside:avoid;">${head}${body}</p>`;
    })
    .join("");
}

/**
 * 제11조(특약사항)의 내용 — 계약마다 다르므로 템플릿이 아니라 계약에서 온다.
 * 조항 본문이 제11조 제목까지 찍고 끝나고, 그 다음 줄에 이 목록이 이어진다.
 */
function renderSpecialTerms(d: KoreanLeaseDocInput): string {
  if (!d.special_terms?.trim()) return "";
  return `<div style="margin-top:-4px;">${renderProse(d.special_terms)}</div>`;
}

export function buildKoreanLeaseBody(d: KoreanLeaseDocInput, lang: DocLang = "ko"): string {
  return `
    <h1 style="text-align:center;font-size:22px;letter-spacing:0.08em;margin:0 0 18px;">${escapeHtml(d.title)}</h1>
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
    ${renderSpecialTerms(d)}
  `;
}

export function buildKoreanLeaseHtml(
  d: KoreanLeaseDocInput,
  company?: CompanyInfo,
  forPrint = true,
  lang: DocLang = "ko",
): string {
  // 머릿말(서류명 + 사업자등록번호 두 줄, 좁은 여백)은 이제 모든 문서의 기본값이라
  // 여기서 따로 지정할 것이 없다 — renderDocumentShell 참고.
  return renderDocumentShell({
    docType: "임대차 계약서",
    bodyHtml: buildKoreanLeaseBody(d, lang),
    company: company ?? getCompanyInfo(),
    forPrint,
  });
}
