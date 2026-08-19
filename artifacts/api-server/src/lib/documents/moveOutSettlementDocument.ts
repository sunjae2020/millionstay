/**
 * Document Hub — Move-out Settlement Confirmation ("퇴거 세대 정산 확인서")
 *
 * A formal move-out settlement statement, built from a `deposit_settlements`
 * row (+ its deduction/refund items) and the household details (unit, tenant,
 * contract period, deposit, rent). Reproduces the Korean move-out settlement
 * form:
 *
 *   1. 기본 임대차 정보 — 세대호수 / 임차인명 / 계약기간 / 임대료(월) /
 *      임대보증금 / 정산구분(중도퇴거·만기퇴거)
 *   2. 정산 내역 — 순번 / 항목 / 구분(차감(−)·환급(+)) / 금액 / 비고, followed
 *      by the A(정산 합계) · B(임대 보증금) · C(최종 반환 차액 = B + A) rows
 *   3. 보증금 반환 및 퇴거 절차 안내사항 — grouped guidance blocks
 *   그리고 날짜 + 임대인 서명란 with the company seal (도장) overlaid.
 *
 * A line's 구분 comes from the sign of its amount: a POSITIVE amount is a
 * deduction (차감, rendered −) and a NEGATIVE amount is a refund to the tenant
 * (환급, rendered +). That keeps `deposit_deduction_items.amount` as the single
 * signed source of truth — no schema change, and `recomputeTotals()` already
 * nets both directions.
 *
 * Like the other builders it renders inside the shared branded shell
 * (`theme.ts`) so the logo header / footer stay consistent, and its static
 * labels are translated via `i18n.ts`. The section-3 guidance is editable
 * standard copy injected as `noteHtml` from the `pdf.move_out_confirmation`
 * template, falling back to the localized default block.
 */
import {
  renderDocumentShell,
  escapeHtml,
  getCompanyInfo,
  formatDocMoney,
  DOC_TOKENS,
  type CompanyInfo,
} from "./theme";
import { t, formatDocDate, type DocLang } from "./i18n";

export interface MoveOutDeductionLine {
  description: string;
  /** Signed: positive = deducted from the deposit (차감), negative = refunded (환급). */
  amount: string | number;
  remark?: string | null;
  /** Explicit override; otherwise derived from the sign of `amount`. */
  kind?: "deduct" | "refund" | null;
}

/** 정산구분 — an early termination vs a settlement at the end of the term. */
export type MoveOutSettlementType = "early" | "expiry";

export interface MoveOutDocInput {
  settlement_ref: string;
  status: string;
  /** Statement "as of" date — the finalized/proposed/created date. */
  as_of_date: string | Date | null;
  currency: string | null;

  unit: string | null;            // 세대호수 (space name)
  tenant_name: string | null;     // 임차인명
  contract_start: string | null;  // 계약기간 시작
  contract_end: string | null;    // 계약기간 종료
  monthly_rent: string | number | null; // 임대료(월)

  deposit_held: string | number;   // 임대 보증금 (B)
  total_deducted: string | number; // 차감 − 환급 합계 (rendered as A = −total_deducted)
  refund_amount: string | number;  // 최종 반환 차액 (C)

  deductions: MoveOutDeductionLine[];

  /** 정산구분. Null leaves both options unmarked. */
  settlement_type?: MoveOutSettlementType | null;
  /** Overrides the phone number quoted in the default guidance block. */
  contact_phone?: string | null;
  /** Door PIN the unit must be reset to before handover; omitted when unset. */
  door_password?: string | null;
}

function money(amount: string | number | null, currency: string | null): string {
  return formatDocMoney(amount, currency);
}

/** Signed figure: deductions in red with −, refunds in blue with +. */
function signedMoney(amount: number, currency: string | null): string {
  const abs = money(Math.abs(amount), currency);
  if (amount > 0) return `<span class="mo-neg">−${abs}</span>`;
  if (amount < 0) return `<span class="mo-pos">+${abs}</span>`;
  return abs;
}

function lineKind(li: MoveOutDeductionLine): "deduct" | "refund" {
  if (li.kind) return li.kind;
  return Number(li.amount ?? 0) < 0 ? "refund" : "deduct";
}

/** 1. 기본 임대차 정보 — a 4-column label/value grid. */
function renderInfoTable(d: MoveOutDocInput, lang: DocLang): string {
  const period = (d.contract_start || d.contract_end)
    ? `${formatDocDate(d.contract_start, lang)} ~ ${formatDocDate(d.contract_end, lang)}`
    : "—";
  const mark = (type: MoveOutSettlementType) =>
    d.settlement_type === type ? "✓" : "";
  const settleType = `${escapeHtml(t(lang, "moveout.typeEarly"))}(${mark("early")})&nbsp;/&nbsp;${escapeHtml(
    t(lang, "moveout.typeExpiry"),
  )}(${mark("expiry")})`;
  const rows: Array<[string, string, string, string]> = [
    [t(lang, "moveout.unit"), escapeHtml(d.unit || "—"), t(lang, "moveout.tenantName"), escapeHtml(d.tenant_name || "")],
    [t(lang, "moveout.contractPeriod"), period, t(lang, "moveout.monthlyRent"), d.monthly_rent == null ? "" : money(d.monthly_rent, d.currency)],
    [t(lang, "moveout.deposit"), money(d.deposit_held, d.currency), t(lang, "moveout.settleType"), settleType],
  ];
  return `<table class="mo-info">${rows
    .map(([k1, v1, k2, v2]) => `<tr><th>${k1}</th><td>${v1}</td><th>${k2}</th><td>${v2}</td></tr>`)
    .join("")}</table>`;
}

/**
 * 2. 정산 내역 — the itemised lines plus the A/B/C summary rows, in one table
 * so the form reads exactly like the paper original.
 */
function renderSettlementTable(d: MoveOutDocInput, lang: DocLang): string {
  const cur = d.currency;
  const lines = d.deductions.map((li, i) => {
    const amount = Number(li.amount ?? 0);
    const kind = lineKind(li);
    const kindLabel = kind === "refund" ? t(lang, "moveout.refund") : t(lang, "moveout.deduct");
    const signed = kind === "refund" ? -Math.abs(amount) : Math.abs(amount);
    return `<tr>
        <td class="mo-c">${i + 1}</td>
        <td>${escapeHtml(li.description)}</td>
        <td class="mo-c ${kind === "refund" ? "mo-pos" : "mo-neg"}">${kindLabel}</td>
        <td class="mo-r">${signedMoney(signed, cur)}</td>
        <td>${escapeHtml(li.remark || "")}</td>
      </tr>`;
  });
  const body = lines.length
    ? lines.join("")
    : `<tr><td class="mo-c" colspan="5" style="color:#999;">—</td></tr>`;

  // A = the net settlement: a positive net deduction prints as −(red), a net
  // refund (negative total_deducted) prints as +(blue) — same rule as the lines.
  const totalA = Number(d.total_deducted ?? 0);
  const depositB = Number(d.deposit_held ?? 0);
  const finalC = Number(d.refund_amount ?? 0);

  const sumRow = (key: string, label: string, value: string, remark: string, cls = "") =>
    `<tr class="mo-sum ${cls}">
       <td class="mo-c mo-key">${key}</td>
       <td colspan="2">${label}</td>
       <td class="mo-r">${value}</td>
       <td class="mo-sum-remark">${escapeHtml(remark)}</td>
     </tr>`;

  return `<table class="mo-lines">
      <thead>
        <tr>
          <th class="mo-c" style="width:9%;">${t(lang, "moveout.no")}</th>
          <th style="width:26%;">${t(lang, "moveout.item")}</th>
          <th class="mo-c" style="width:13%;">${t(lang, "moveout.kind")}</th>
          <th class="mo-r" style="width:20%;">${t(lang, "moveout.amountCol")}</th>
          <th style="width:32%;">${t(lang, "moveout.remarkGuide")}</th>
        </tr>
      </thead>
      <tbody>
        ${body}
        ${sumRow("A", t(lang, "moveout.rowA"), signedMoney(totalA, cur), t(lang, "moveout.rowA.remark"))}
        ${sumRow("B", t(lang, "moveout.rowB"), money(depositB, cur), t(lang, "moveout.rowB.remark"))}
        ${sumRow("C", t(lang, "moveout.rowC"), money(finalC, cur), t(lang, "moveout.rowC.remark"), "mo-final")}
      </tbody>
    </table>`;
}

/**
 * 3. 보증금 반환 및 퇴거 절차 안내사항.
 *
 * `values` supplies the data-dependent bits. Passing the `{{var}}` placeholders
 * instead of real values yields the editable TEMPLATE body seeded into
 * `pdf.move_out_confirmation` — so the Studio copy and the built-in fallback are
 * generated from the very same i18n strings and can never drift apart.
 */
function renderGuide(
  lang: DocLang,
  values: { amount: string; phone: string; pin: string },
): string {
  const groups: Array<{ title: string; lead?: string; bullets: string[] }> = [
    {
      title: t(lang, "moveout.guide.refund.title"),
      lead: t(lang, "moveout.guide.refund.lead", { amount: values.amount }),
      bullets: [
        t(lang, "moveout.guide.refund.docs"),
        t(lang, "moveout.guide.refund.how", { phone: values.phone }),
      ],
    },
    { title: t(lang, "moveout.guide.transfer.title"), bullets: [t(lang, "moveout.guide.transfer.b1"), t(lang, "moveout.guide.transfer.b2")] },
    { title: t(lang, "moveout.guide.utility.title"), bullets: [t(lang, "moveout.guide.utility.b1"), t(lang, "moveout.guide.utility.b2")] },
    { title: t(lang, "moveout.guide.restore.title"), bullets: [t(lang, "moveout.guide.restore.b1Pin", { pin: values.pin })] },
  ];
  return groups
    .map(
      (g) => `<div class="mo-guide-group">
        <div class="mo-guide-title">■ ${escapeHtml(g.title)} :${g.lead ? ` <span class="mo-guide-lead">${escapeHtml(g.lead)}</span>` : ""}</div>
        ${g.bullets.map((b) => `<div class="mo-guide-item">· ${escapeHtml(b)}</div>`).join("")}
      </div>`,
    )
    .join("");
}

/** Built-in guidance used when the template carries no body. */
function renderDefaultGuide(d: MoveOutDocInput, company: CompanyInfo, lang: DocLang): string {
  return renderGuide(lang, {
    amount: money(d.refund_amount, d.currency),
    phone: (d.contact_phone || company.phone || "").trim(),
    pin: (d.door_password || "").trim() || "____",
  });
}

/**
 * The seedable template body for `pdf.move_out_confirmation` — same copy with
 * `{{refund_amount}}` / `{{contact_phone}}` / `{{door_password}}` left as
 * variables for the route to fill. Used by `scripts/print-move-out-guide.mjs`
 * to regenerate the seeded copy; not called at request time.
 */
export function buildMoveOutGuideTemplate(lang: DocLang): string {
  return renderGuide(lang, {
    amount: "{{refund_amount}}",
    phone: "{{contact_phone}}",
    pin: "{{door_password}}",
  });
}

/** Dated issuer block: 발행일 + 임대인 : 회사명 (인) with the seal (도장) overlaid. */
function renderIssuerBlock(d: MoveOutDocInput, company: CompanyInfo, lang: DocLang): string {
  const dateLine = formatDocDate(d.as_of_date, lang);
  const seal = company.stampUrl?.trim()
    ? `<img class="mo-seal" src="${escapeHtml(company.stampUrl)}" alt="" />`
    : "";
  return `<div class="mo-issuer">
      <div class="mo-date">${dateLine}</div>
      <div class="mo-signer">
        <span class="mo-signer-label">${t(lang, "moveout.issuer")} :</span>
        <span class="mo-signer-name">${escapeHtml(company.legalName)}</span>
        <span class="mo-signer-seal">${t(lang, "moveout.sealMark")}</span>
        ${seal}
      </div>
    </div>`;
}

/** Scoped CSS for the move-out statement (injected into the doc body). */
const MOVE_OUT_STYLE = `<style>
  /* Sized to land the whole statement on ONE A4 page: the settlement table and
     the section-3 guidance carry the smallest type, since they are the two
     blocks that grow with the data. */
  .mo-title { text-align:center; margin:0 0 4px; }
  .mo-title h1 { font-size:21px; font-weight:800; letter-spacing:0.02em; margin:0; }
  .mo-asof { text-align:right; font-size:11.5px; color:${DOC_TOKENS.inkMuted}; font-style:italic; margin:0 0 12px; }
  .mo-sec { margin:0 0 12px; }
  .mo-sec-title { font-size:12px; font-weight:800; color:${DOC_TOKENS.brand}; margin:0 0 5px; }
  table.mo-info, table.mo-lines { width:100%; border-collapse:collapse; }
  table.mo-info { font-size:11.5px; }
  table.mo-lines { font-size:11px; }
  table.mo-info th, table.mo-info td { border:1px solid #bfbfbf; padding:5px 8px; }
  table.mo-lines th, table.mo-lines td { border:1px solid #bfbfbf; padding:4px 7px; }
  table.mo-info th { width:17%; background:#f2f2f4; text-align:center; font-weight:700; color:#222; }
  table.mo-info td { width:33%; text-align:center; }
  table.mo-lines thead th { background:${DOC_TOKENS.brand}; color:#fff; font-weight:700; text-align:center; }
  .mo-c { text-align:center; }
  .mo-r { text-align:right; font-variant-numeric:tabular-nums; }
  .mo-neg { color:#c0392b; font-weight:700; }
  .mo-pos { color:#1f6fb2; font-weight:700; }
  tr.mo-sum td { background:#fafafb; font-weight:700; }
  tr.mo-sum td.mo-key { background:#f2f2f4; font-weight:800; text-align:center; }
  tr.mo-sum td.mo-sum-remark { font-weight:400; font-size:10px; color:#333; }
  tr.mo-final td { background:#fff6e6; font-size:12px; font-weight:800; }
  tr.mo-final td.mo-sum-remark { font-weight:400; font-size:10px; }
  .mo-guide-group { margin:0 0 6px; }
  .mo-guide-title { font-size:10.5px; font-weight:800; color:${DOC_TOKENS.brand}; margin:0 0 2px; }
  .mo-guide-lead { font-weight:800; }
  .mo-guide-item { font-size:9.5px; color:#333; line-height:1.5; padding-left:11px; }
  .mo-issuer { text-align:center; margin-top:18px; }
  .mo-date { font-size:13px; color:#222; margin-bottom:10px; }
  .mo-signer { position:relative; display:inline-block; padding:2px 8px; }
  .mo-signer-label { font-size:15px; font-weight:800; letter-spacing:0.3em; margin-right:4px; }
  .mo-signer-name { font-size:16px; font-weight:800; letter-spacing:0.03em; }
  .mo-signer-seal { font-size:13px; margin-left:8px; color:#555; }
  .mo-seal { position:absolute; right:-10px; top:50%; transform:translateY(-50%); width:54px; height:54px; object-fit:contain; opacity:0.9; }
  /* One page, always: never let a block split across a page break. */
  .mo-sec, .mo-issuer, .mo-guide-group { page-break-inside:avoid; break-inside:avoid; }

  /* Long settlements (10+ lines) shrink one more step rather than spilling onto
     a second sheet — the form is meant to be handed over as a single page. */
  .mo-dense table.mo-lines { font-size:9.5px; }
  .mo-dense table.mo-lines th, .mo-dense table.mo-lines td { padding:2.5px 6px; }
  .mo-dense tr.mo-final td { font-size:10.5px; }
  .mo-dense tr.mo-sum td.mo-sum-remark, .mo-dense tr.mo-final td.mo-sum-remark { font-size:9px; }
  .mo-dense table.mo-info { font-size:10.5px; }
  .mo-dense table.mo-info th, .mo-dense table.mo-info td { padding:3.5px 7px; }
  .mo-dense .mo-guide-item { font-size:8.5px; line-height:1.4; }
  .mo-dense .mo-guide-title { font-size:9.5px; }
  .mo-dense .mo-guide-group { margin-bottom:4px; }
  .mo-dense .mo-sec { margin-bottom:9px; }
  .mo-dense .mo-issuer { margin-top:12px; }
</style>`;

/** Build the inner body HTML for a move-out settlement confirmation (no shell). */
export function buildMoveOutSettlementBody(
  d: MoveOutDocInput,
  company: CompanyInfo,
  lang: DocLang = "en",
  noteHtml = "",
): string {
  const asOf = formatDocDate(d.as_of_date, lang);
  const guide = noteHtml.trim() || renderDefaultGuide(d, company, lang);
  // Past ~9 settlement lines the page runs out of room; shrink a step instead of
  // breaking the statement across two sheets.
  const dense = d.deductions.length > 9;
  return `${MOVE_OUT_STYLE}
    <div class="mo-doc${dense ? " mo-dense" : ""}">
    <div class="mo-title">
      <h1>${t(lang, "moveout.heading")}</h1>
    </div>
    <div class="mo-asof">${t(lang, "moveout.asOfLabel")}: ${asOf} · <span class="ref-chip">${escapeHtml(d.settlement_ref)}</span></div>

    <div class="mo-sec">
      <div class="mo-sec-title">1. ${t(lang, "moveout.sec1")}</div>
      ${renderInfoTable(d, lang)}
    </div>

    <div class="mo-sec">
      <div class="mo-sec-title">2. ${t(lang, "moveout.sec2")}</div>
      ${renderSettlementTable(d, lang)}
    </div>

    <div class="mo-sec">
      <div class="mo-sec-title">3. ${t(lang, "moveout.sec3")}</div>
      ${guide}
    </div>

    ${renderIssuerBlock(d, company, lang)}
    </div>
  `;
}

/** Build the full standalone HTML document for a move-out settlement confirmation. */
export function buildMoveOutSettlementHtml(
  d: MoveOutDocInput,
  company?: CompanyInfo,
  forPrint = true,
  lang: DocLang = "en",
  noteHtml = "",
): string {
  const co = company ?? getCompanyInfo();
  return renderDocumentShell({
    docType: t(lang, "doctype.move_out"),
    bodyHtml: buildMoveOutSettlementBody(d, co, lang, noteHtml),
    company: co,
    forPrint,
  });
}
