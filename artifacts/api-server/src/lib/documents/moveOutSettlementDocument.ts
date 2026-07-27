/**
 * Document Hub — Move-out Confirmation ("퇴거 세대 확인서") document builder
 *
 * A formal move-out household confirmation / deposit-settlement statement, built
 * from a `deposit_settlements` row (+ its deduction items) and the booking's
 * household details (unit, tenant, contract period, deposit, rent). Reproduces
 * the Korean move-out settlement statement layout: a household-info block, an
 * itemised deduction table (순번 / 항목 / 금액 / 비고), the A/B/C totals and a
 * dated issuer block that carries the company seal (도장) when one is configured.
 *
 * Like the other document builders it renders inside the shared branded shell
 * (`theme.ts`) so the logo header / footer stay consistent, and its static
 * labels are translated via `i18n.ts`. Editable standard copy (the residence-
 * transfer notice) is injected as `noteHtml` from the `pdf.move_out_confirmation`
 * template, falling back to the localized default.
 */
import {
  renderDocumentShell,
  escapeHtml,
  getCompanyInfo,
  formatDocMoney,
  type CompanyInfo,
} from "./theme";
import { t, formatDocDate, type DocLang } from "./i18n";

export interface MoveOutDeductionLine {
  description: string;
  /** Positive amount deducted from the deposit; rendered as a negative figure. */
  amount: string | number;
  remark?: string | null;
}

export interface MoveOutDocInput {
  settlement_ref: string;
  status: string;
  /** Statement "as of" date — the finalized/proposed/created date. */
  as_of_date: string | Date | null;
  currency: string | null;

  unit: string | null;            // 세대호수 (space name)
  tenant_name: string | null;     // 임차인
  contract_start: string | null;  // 계약기간 시작
  contract_end: string | null;    // 계약기간 종료
  monthly_rent: string | number | null; // 임대료

  deposit_held: string | number;   // 보증금 (B)
  total_deducted: string | number; // 합계 (A) — rendered negative
  refund_amount: string | number;  // 차액 (C = B − A)

  deductions: MoveOutDeductionLine[];
}

function money(amount: string | number | null, currency: string | null): string {
  return formatDocMoney(amount, currency);
}

/** A deducted amount, shown as a negative figure in red like the reference doc. */
function negMoney(amount: string | number | null, currency: string | null): string {
  const n = Number(amount ?? 0);
  if (!Number.isFinite(n) || n === 0) return money(0, currency);
  return `−${money(Math.abs(n), currency)}`;
}

/** Household info rows (세대호수 / 임차인 / 계약기간 / 보증금 / 임대료). */
function renderInfoTable(d: MoveOutDocInput, lang: DocLang): string {
  const period = (d.contract_start || d.contract_end)
    ? `${formatDocDate(d.contract_start, lang)} ~ ${formatDocDate(d.contract_end, lang)}`
    : "—";
  const rows: Array<[string, string]> = [
    [t(lang, "moveout.unit"), escapeHtml(d.unit || "—")],
    [t(lang, "tenant"), escapeHtml(d.tenant_name || "—")],
    [t(lang, "moveout.contractPeriod"), period],
    [t(lang, "bond"), money(d.deposit_held, d.currency)],
    [t(lang, "rent"), money(d.monthly_rent, d.currency)],
  ];
  return `<table class="mo-info">${rows
    .map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`)
    .join("")}</table>`;
}

/** Itemised deduction table (순번 / 항목 / 금액 / 비고). */
function renderDeductionsTable(d: MoveOutDocInput, lang: DocLang): string {
  const rows = d.deductions.length
    ? d.deductions
        .map(
          (li, i) => `<tr>
            <td class="mo-c">${i + 1}</td>
            <td>${escapeHtml(li.description)}</td>
            <td class="mo-r mo-neg">${negMoney(li.amount, d.currency)}</td>
            <td>${escapeHtml(li.remark || "")}</td>
          </tr>`,
        )
        .join("")
    : `<tr><td class="mo-c" colspan="4" style="color:#999;">—</td></tr>`;
  return `<table class="mo-lines">
      <thead>
        <tr>
          <th class="mo-c" style="width:12%;">${t(lang, "moveout.no")}</th>
          <th style="width:36%;">${t(lang, "moveout.item")}</th>
          <th class="mo-r" style="width:26%;">${t(lang, "amount")}</th>
          <th style="width:26%;">${t(lang, "moveout.remark")}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

/** A/B/C totals grid: 합계 A / 보증금 B / 차액 C (B−A). */
function renderTotals(d: MoveOutDocInput, lang: DocLang): string {
  return `<table class="mo-totals">
      <tr><th>${t(lang, "moveout.totalA")}</th><td class="mo-r mo-neg">${negMoney(d.total_deducted, d.currency)}</td></tr>
      <tr><th>${t(lang, "moveout.depositB")}</th><td class="mo-r">${money(d.deposit_held, d.currency)}</td></tr>
      <tr class="mo-diff"><th>${t(lang, "moveout.diffC")}</th><td class="mo-r">${money(d.refund_amount, d.currency)}</td></tr>
    </table>`;
}

/** Dated issuer block with the company name and seal (도장) overlaid. */
function renderIssuerBlock(d: MoveOutDocInput, company: CompanyInfo, lang: DocLang): string {
  const dateLine = formatDocDate(d.as_of_date, lang);
  const seal = company.stampUrl?.trim()
    ? `<img class="mo-seal" src="${escapeHtml(company.stampUrl)}" alt="" />`
    : "";
  return `<div class="mo-issuer">
      <div class="mo-date">${dateLine}</div>
      <div class="mo-signer">
        <span class="mo-signer-name">${escapeHtml(company.legalName)}</span>
        ${seal}
      </div>
    </div>`;
}

/** Scoped CSS for the move-out statement tables (injected into the doc body). */
const MOVE_OUT_STYLE = `<style>
  .mo-title { text-align:center; margin:0 0 20px; }
  .mo-title h1 { font-size:22px; font-weight:800; letter-spacing:0.02em; margin:0; }
  .mo-title .mo-asof { font-size:13px; color:#666; margin-top:4px; }
  table.mo-info, table.mo-lines, table.mo-totals { width:100%; border-collapse:collapse; margin:0 0 18px; font-size:13.5px; }
  table.mo-info th, table.mo-info td,
  table.mo-lines th, table.mo-lines td,
  table.mo-totals th, table.mo-totals td { border:1px solid #d9d9d9; padding:9px 12px; }
  table.mo-info th { width:26%; background:#f5f5f7; text-align:left; font-weight:600; color:#333; }
  table.mo-lines th { background:#f5f5f7; font-weight:700; color:#333; text-align:left; }
  table.mo-totals th { background:#f5f5f7; width:60%; text-align:left; font-weight:700; }
  .mo-c { text-align:center; }
  .mo-r { text-align:right; font-variant-numeric:tabular-nums; }
  .mo-neg { color:#c0392b; }
  table.mo-totals tr.mo-diff th, table.mo-totals tr.mo-diff td { font-weight:800; font-size:15px; background:#fbfbfc; }
  .mo-note { font-size:12.5px; color:#444; margin:16px 0 8px; line-height:1.6; }
  .mo-issuer { text-align:center; margin-top:34px; }
  .mo-date { font-size:14px; color:#222; margin-bottom:14px; }
  .mo-signer { position:relative; display:inline-block; padding:4px 8px; }
  .mo-signer-name { font-size:17px; font-weight:800; letter-spacing:0.03em; }
  .mo-seal { position:absolute; right:-58px; top:50%; transform:translateY(-50%); width:64px; height:64px; object-fit:contain; }
</style>`;

/** Build the inner body HTML for a move-out confirmation (no shell). */
export function buildMoveOutSettlementBody(
  d: MoveOutDocInput,
  company: CompanyInfo,
  lang: DocLang = "en",
  noteHtml = "",
): string {
  const asOf = formatDocDate(d.as_of_date, lang);
  const note = noteHtml.trim() || escapeHtml(t(lang, "moveout.transferNote"));
  return `${MOVE_OUT_STYLE}
    <div class="mo-title">
      <h1>${t(lang, "moveout.heading")}</h1>
      <div class="mo-asof">${t(lang, "moveout.asOf", { date: asOf })} · <span class="ref-chip">${escapeHtml(d.settlement_ref)}</span></div>
    </div>

    <div class="section">
      <h3>${t(lang, "moveout.household")}</h3>
      ${renderInfoTable(d, lang)}
    </div>

    <div class="section">
      <h3>${t(lang, "moveout.settlement")}</h3>
      ${renderDeductionsTable(d, lang)}
      ${renderTotals(d, lang)}
    </div>

    <div class="mo-note">${note}</div>

    ${renderIssuerBlock(d, company, lang)}
  `;
}

/** Build the full standalone HTML document for a move-out confirmation. */
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
