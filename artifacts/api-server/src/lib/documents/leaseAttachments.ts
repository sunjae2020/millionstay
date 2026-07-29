/**
 * 임대차 계약서 첨부 문서 — 계약서 뒤에 붙는 별지·동의서·확인서 묶음.
 *
 * 주택임대차표준계약서(법무부)와 일반 임대차계약서 양쪽에서 같은 첨부를 쓴다.
 * 어떤 첨부를 붙일지는 계약 상세의 체크박스(contracts.doc_attachments)로 고르고,
 * 발급 시 계약서 PDF 뒤에 이 순서대로 합쳐진다.
 *
 * 문서별 성격
 *  - special_terms  별지 특약사항 — 부동산의 표식 + 특약 조항. 물건별로 늘 다르다.
 *  - deposit_consent 보증금 동의서 — 기존 호실 보증금을 새 계약으로 승계할 때.
 *  - trust_confirmation 임차인 확인서 — 신탁부동산이라 수탁자가 임대인이 아님을 확인.
 *  - guarantee_undertaking 임차인 확약서 — 등록 전 임대주택 임대보증금보증 가입용
 *    (주택도시보증공사 별지 제104호서식, 2023. 9. 25. 신설).
 *
 * 서식이 법정 별지인 확약서도 문구는 원문 그대로 옮겼다 — 임의로 줄이지 말 것.
 */
import { renderDocumentShell, escapeHtml, getCompanyInfo, type CompanyInfo } from "./theme";

/** 첨부 문서 종류 — 계약 상세의 체크박스 키와 1:1. */
export const LEASE_ATTACHMENT_KINDS = [
  "special_terms",
  "deposit_consent",
  "trust_confirmation",
  "guarantee_undertaking",
  "renewal_refusal",
] as const;
export type LeaseAttachmentKind = (typeof LEASE_ATTACHMENT_KINDS)[number];

/** 첨부 목록의 표시 이름 — 어드민 체크박스 라벨과 PDF 제목에 함께 쓴다. */
export const LEASE_ATTACHMENT_TITLES: Record<LeaseAttachmentKind, string> = {
  special_terms: "별지 특약사항",
  deposit_consent: "보증금 동의서",
  trust_confirmation: "임차인 확인서 (신탁부동산)",
  guarantee_undertaking: "임차인 확약서 (임대보증금보증 가입용)",
  renewal_refusal: "계약갱신 거절통지서 (별지2)",
};

export interface LeaseAttachmentParty {
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  birth_date?: string | null;
}

export interface LeaseAttachmentInput {
  /** 문서 머리에 쓰는 물건 표기. */
  premises_address?: string | null;
  building_name?: string | null;
  unit_no?: string | null;
  /** 별지 부동산의 표식. */
  registry?: {
    lot_address?: string | null;
    building_use?: string | null;
    building_structure?: string | null;
    leased_area_m2?: number | null;
    leased_portion?: string | null;
    land_category?: string | null;
    land_area_m2?: number | null;
    land_right_type?: string | null;
    land_share_m2?: number | null;
  } | null;
  unit_type?: string | null;

  landlord: LeaseAttachmentParty;
  tenant: LeaseAttachmentParty;
  /** 신탁 수탁자 — 임차인 확인서에 쓴다. */
  trustee_name?: string | null;

  start_date?: string | null;
  end_date?: string | null;
  deposit_amount?: number | null;
  monthly_rent?: number | null;
  signed_on?: string | null;

  /** 별지 특약사항 본문 — 줄바꿈으로 구분한 조항 목록. */
  special_terms?: string | null;
  /** 보증금 동의서의 동의 사항 본문. */
  deposit_consent_note?: string | null;
}

// ── 표 스타일 (koreanLeaseDocument 와 같은 톤) ──────────────────────────────
const CELL = "padding:7px 10px;border:1px solid #333;font-size:12px;color:#111;vertical-align:middle;";
const HEAD = `${CELL}background:#F2F2F2;font-weight:700;text-align:center;white-space:nowrap;`;
const TABLE = "width:100%;border-collapse:collapse;margin:10px 0 18px;table-layout:fixed;";
const PARA = "font-size:12px;line-height:1.8;color:#111;margin:0 0 10px;";

function money(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return "";
  return `금 ${Number(value).toLocaleString("ko-KR")}원정 (₩${Number(value).toLocaleString("ko-KR")})`;
}

function koDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, "0")}월 ${String(d.getDate()).padStart(2, "0")}일`;
}

function areaText(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value)) || Number(value) === 0) return "";
  return `${Number(value).toLocaleString("ko-KR", { maximumFractionDigits: 3 })}㎡`;
}

/** 물건 한 줄 표기 — "전남 여수시 좌수영로 101, 메트하임 1907호". */
function premisesLine(d: LeaseAttachmentInput): string {
  return [d.premises_address, d.building_name, d.unit_no].filter(Boolean).join(" ");
}

function title(text: string): string {
  return `<h1 style="text-align:center;font-size:21px;letter-spacing:0.06em;margin:0 0 26px;">${escapeHtml(text)}</h1>`;
}

/** 서명란 — "동의자 : 홍길동 (인)". */
function signatureLine(label: string, name: string | null | undefined): string {
  return `<div style="text-align:right;font-size:13px;margin-top:34px;">
      ${escapeHtml(label)} : <span style="display:inline-block;min-width:120px;text-align:center;font-weight:700;">${escapeHtml(name ?? "")}</span>
      <span style="margin-left:6px;">(서명 또는 인)</span>
    </div>`;
}

/** 문서 하단의 작성일. */
function dateLine(value: string | null | undefined): string {
  return `<div style="text-align:center;font-size:13px;margin-top:30px;">${escapeHtml(koDate(value))}</div>`;
}

// ── 1. 별지 특약사항 ────────────────────────────────────────────────────────
function renderSpecialTerms(d: LeaseAttachmentInput): string {
  const r = d.registry;
  const landRatio =
    r?.land_area_m2 != null && r?.land_share_m2 != null
      ? `${Number(r.land_area_m2).toLocaleString("ko-KR")}분의 ${Number(r.land_share_m2).toLocaleString("ko-KR")}`
      : "";
  const pair = (l1: string, v1: string, l2: string, v2: string) =>
    v1 || v2
      ? `<tr>
          <th style="${HEAD}width:18%;">${escapeHtml(l1)}</th><td style="${CELL}text-align:center;width:32%;">${escapeHtml(v1)}</td>
          <th style="${HEAD}width:18%;">${escapeHtml(l2)}</th><td style="${CELL}text-align:center;width:32%;">${escapeHtml(v2)}</td>
        </tr>`
      : "";
  const terms = (d.special_terms ?? "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  return `
    ${title(`${[d.building_name, "계약서 별지"].filter(Boolean).join(" ")}${d.unit_type ? ` (${d.unit_type})` : ""}`.trim() || "계약서 별지")}
    <div style="font-size:13px;font-weight:700;margin:0 0 4px;">◆ 부동산의 표식</div>
    <table style="${TABLE}">
      <tr><th style="${HEAD}">소 재 지</th><td style="${CELL}" colspan="3">${escapeHtml(premisesLine(d) || r?.lot_address || "")}</td></tr>
      ${pair("건 물 용 도", r?.building_use ?? "", "건 물 구 조", r?.building_structure ?? "")}
      ${pair("임 대 면 적", areaText(r?.leased_area_m2), "임 대 부 분", r?.leased_portion ?? "")}
      ${pair("토 지 지 목", r?.land_category ?? "", "토 지 면 적", areaText(r?.land_area_m2))}
      ${pair("대지권종류", r?.land_right_type ?? "", "대지권비율", landRatio)}
    </table>
    <div style="font-size:13px;font-weight:700;margin:18px 0 8px;">◆ 특약사항</div>
    ${
      terms.length
        ? `<ol style="margin:0;padding-left:20px;">${terms
            .map((line) => `<li style="${PARA}">${escapeHtml(line.replace(/^\d+[.)]\s*/, ""))}</li>`)
            .join("")}</ol>`
        : `<p style="${PARA}color:#666;">특약사항이 등록되지 않았습니다.</p>`
    }
    <div style="text-align:right;font-size:14px;font-weight:700;margin-top:40px;">${escapeHtml(d.landlord.name ?? "")}</div>`;
}

// ── 2. 보증금 동의서 ────────────────────────────────────────────────────────
function renderDepositConsent(d: LeaseAttachmentInput): string {
  return `
    ${title("보증금 동의서")}
    <table style="${TABLE}">
      <tr><th style="${HEAD}width:20%;">소 재 지</th><td style="${CELL}">${escapeHtml(premisesLine(d))}</td></tr>
      <tr><th style="${HEAD}">계약기간</th><td style="${CELL}">${escapeHtml(koDate(d.start_date))} ~ ${escapeHtml(koDate(d.end_date))}</td></tr>
      <tr><th style="${HEAD}">보 증 금</th><td style="${CELL}">${escapeHtml(money(d.deposit_amount))}</td></tr>
      <tr>
        <th style="${HEAD}">동의사항</th>
        <td style="${CELL}height:150px;vertical-align:top;padding-top:12px;">
          <div style="${PARA}white-space:pre-wrap;">${escapeHtml(d.deposit_consent_note ?? "")}</div>
        </td>
      </tr>
    </table>
    ${dateLine(d.signed_on)}
    ${signatureLine("동의자", d.tenant.name)}
    ${d.trustee_name ? `<div style="font-size:13px;font-weight:700;margin-top:26px;">${escapeHtml(d.trustee_name)} 귀하</div>` : ""}`;
}

// ── 3. 임차인 확인서 (신탁부동산) ───────────────────────────────────────────
function renderTrustConfirmation(d: LeaseAttachmentInput): string {
  const clauses = [
    "임차인은 본건 부동산이 수탁자에게 신탁중인 부동산으로 우선수익권이 존재함을 인지하고 확인함.",
    "수탁자는 본건 부동산에 대한 수탁자로서 임대차에 동의할 뿐이고 임대차계약상 임대인의 지위에 있지 아니하다.",
    "수탁자는 신탁기간 중 신탁계약에 따른 소유권 관리업무에 대해서만 책임을 질 뿐 그 외 임대차계약상 임대인으로서의 어떠한 의무도 부담하지 아니한다.",
    "본건 부동산의 보존, 관리 및 운영, 제반 임대차 관련업무(임대차보증금 반환, 임대료 수납, 비용상환 등)에 대해서는 임대인(위탁자)이 그 책임을 부담한다.",
    "임차인은 상기 1호, 2호, 3호에 대해 이의 없이 인정하고 임대차보증금반환, 비용상환 등 임대차계약과 관련하여 수탁자에게 어떠한 청구도 하지 아니한다.",
    "임대차계약기간 종료 시 임대인은 임대차보증금을 차질 없이 임차인에게 반환하며 임차인은 본건 부동산을 자진하여 임대인에게 명도한다.",
    "본건 부동산에 진행중인 소송 및 보전처분 현황은 아래와 같고, 추후 아래 소송 및 보전처분과 관련하여 분쟁이 발생하게 될 경우 임차인은 수탁자에게 이의를 제기할 수 없고 수탁자는 면책된다.",
  ];
  return `
    ${title("임차인 확인서")}
    <table style="${TABLE}">
      <tr><th style="${HEAD}width:24%;">임대차 목적물</th><td style="${CELL}">${escapeHtml(premisesLine(d))}</td></tr>
      <tr><th style="${HEAD}">임대인(위탁자)</th><td style="${CELL}">${escapeHtml(d.landlord.name ?? "")}</td></tr>
      <tr><th style="${HEAD}">임 차 인</th><td style="${CELL}">${escapeHtml(d.tenant.name ?? "")}</td></tr>
      <tr><th style="${HEAD}">수 탁 자</th><td style="${CELL}">${escapeHtml(d.trustee_name ?? "")}</td></tr>
      <tr><th style="${HEAD}">임대차 계약기간</th><td style="${CELL}">${escapeHtml(koDate(d.start_date))} ~ ${escapeHtml(koDate(d.end_date))}</td></tr>
      <tr><th style="${HEAD}">임차 보증금</th><td style="${CELL}">${escapeHtml(money(d.deposit_amount))}</td></tr>
      <tr><th style="${HEAD}">월 임대료</th><td style="${CELL}">${escapeHtml(money(d.monthly_rent))}</td></tr>
    </table>
    <p style="${PARA}">임차인은 다음 사항을 동의하며 신탁부동산에 대한 임대차계약을 체결한다.</p>
    <div style="text-align:center;font-size:12px;font-weight:700;margin:8px 0 10px;">- 다 음 -</div>
    <ol style="margin:0;padding-left:20px;">
      ${clauses.map((c) => `<li style="${PARA}">${escapeHtml(c)}</li>`).join("")}
    </ol>
    <table style="${TABLE}">
      <tr><th style="${HEAD}width:50%;">유 형</th><th style="${HEAD}">청구금액</th></tr>
      <tr><td style="${CELL}text-align:center;" colspan="2">해당없음</td></tr>
    </table>
    ${dateLine(d.signed_on)}
    ${signatureLine("임차인", d.tenant.name)}
    ${d.trustee_name ? `<div style="font-size:13px;font-weight:700;margin-top:26px;">${escapeHtml(d.trustee_name)}</div>` : ""}`;
}

// ── 4. 임차인 확약서 (주택도시보증공사 별지 제104호서식) ────────────────────
function renderGuaranteeUndertaking(d: LeaseAttachmentInput): string {
  const clauses = [
    "본인은 해당 확약서를 제출하더라도 주택도시보증공사(이하 ‘공사’라고 합니다)의 보증심사를 통해 보증요건 등이 맞지 않을 경우 보증가입이 거절될 수 있음을 확인합니다.",
    "본인은 임대인이 보증서 발급일로부터 1개월 이내에 보증대상 주택에 대한 임대사업자 등록을 하지 않을 경우 보증서의 효력이 발생하지 않음을 확인합니다.",
    "본인은 보증서가 발급되더라도 보증대상 주택에 대한 임대사업자 등록 전 압류·가압류·가처분 등 권리침해가 발생하거나, 저당권 등 담보권 설정금액 또는 임대보증금이 증가한 경우 보증서의 효력이 발생하지 않음을 확인합니다.",
    "본인은 보증서가 발급되더라도 주택임대차보호법상 대항력 및 우선변제권을 확보하지 못할 경우 보증서의 효력이 발생하지 않을 수 있음을 확인합니다.",
  ];
  return `
    <div style="font-size:11px;color:#333;margin:0 0 6px;">[별지서식 제104호] (제107조 관련) &lt;신설 2023. 9. 25.&gt;</div>
    ${title("임차인 확약서")}
    <div style="text-align:center;font-size:12px;margin:-18px 0 20px;">(등록 전 임대주택에 대한 임대보증금보증 가입용)</div>
    <table style="${TABLE}">
      <!-- 첫 행이 colspan 이라 table-layout:fixed 가 폭을 반씩 나눠 라벨이 잘린다 → colgroup 으로 고정. -->
      <colgroup><col style="width:9%;" /><col style="width:23%;" /><col /></colgroup>
      <tr><th style="${HEAD}" colspan="2">임 대 인</th><td style="${CELL}">${escapeHtml(d.landlord.name ?? "")}</td></tr>
      <tr>
        <th style="${HEAD}" rowspan="3">임대차<br/>내용</th>
        <th style="${HEAD}">임차목적물 주소</th>
        <td style="${CELL}">${escapeHtml(premisesLine(d))}</td>
      </tr>
      <tr><th style="${HEAD}">임대차 계약기간</th><td style="${CELL}">${escapeHtml(koDate(d.start_date))} ~ ${escapeHtml(koDate(d.end_date))}</td></tr>
      <tr><th style="${HEAD}">임대보증금</th><td style="${CELL}">${escapeHtml(money(d.deposit_amount))}</td></tr>
    </table>
    <ol style="margin:0;padding-left:20px;">
      ${clauses.map((c) => `<li style="${PARA}">${escapeHtml(c)}</li>`).join("")}
    </ol>
    <p style="${PARA}margin-top:14px;">본인은 상기 내용에 대해 정확히 숙지하였으며 위의 내용에 대해 일절 이의를 제기하지 않을 것을 확약합니다.</p>
    ${dateLine(d.signed_on)}
    <table style="${TABLE}margin-top:24px;">
      <tr><th style="${HEAD}width:22%;">임차인 성명</th><td style="${CELL}">${escapeHtml(d.tenant.name ?? "")} <span style="margin-left:8px;">(서명 또는 인)</span></td></tr>
      <tr><th style="${HEAD}">생년월일</th><td style="${CELL}">${escapeHtml(d.tenant.birth_date ?? "")}</td></tr>
      <tr><th style="${HEAD}">전화번호</th><td style="${CELL}">${escapeHtml(d.tenant.phone ?? "")}</td></tr>
    </table>
    <div style="font-size:11px;color:#333;margin-top:10px;line-height:1.7;">
      첨부 1. 인감증명서 또는 본인서명사실확인서(임대차계약과 동일한 날인일 경우 생략)<br/>
      &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;2. 임대차계약서 사본
    </div>
    <div style="font-size:14px;font-weight:700;margin-top:30px;">주택도시보증공사 귀중</div>`;
}

const RENDERERS: Record<Exclude<LeaseAttachmentKind, "renewal_refusal">, (d: LeaseAttachmentInput) => string> = {
  special_terms: renderSpecialTerms,
  deposit_consent: renderDepositConsent,
  trust_confirmation: renderTrustConfirmation,
  guarantee_undertaking: renderGuaranteeUndertaking,
};

/** HTML 로 렌더링되는 첨부(= 계약갱신 거절통지서를 뺀 나머지). */
export function isHtmlAttachment(kind: LeaseAttachmentKind): kind is Exclude<LeaseAttachmentKind, "renewal_refusal"> {
  return kind !== "renewal_refusal";
}

/**
 * 선택된 첨부들을 한 HTML 문서로 묶는다(문서마다 새 쪽에서 시작).
 * 하나도 선택되지 않았으면 null — 호출부가 첨부 없이 진행하면 된다.
 */
export function buildLeaseAttachmentsHtml(
  kinds: LeaseAttachmentKind[],
  input: LeaseAttachmentInput,
  company?: CompanyInfo,
  forPrint = true,
): string | null {
  const html = kinds
    .filter(isHtmlAttachment)
    .map((kind, index) => {
      const body = RENDERERS[kind](input);
      return index === 0 ? body : `<div style="page-break-before:always;break-before:page;">${body}</div>`;
    })
    .join("");
  if (!html) return null;
  return renderDocumentShell({
    docType: "임대차 계약 첨부서류",
    bodyHtml: html,
    company: company ?? getCompanyInfo(),
    forPrint,
  });
}
