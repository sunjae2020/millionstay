/**
 * Document Hub — Quote document builder (Phase 3)
 *
 * Renders a pre-sale quotation with line items, totals and a validity date,
 * using the shared brand shell so it matches invoices/receipts/contracts.
 */
import { renderDocumentShell, escapeHtml, getCompanyInfo, statusWatermarkColor, formatDocMoney, type CompanyInfo } from "./theme";
import { t, formatDocDate, statusLabel, type DocLang } from "./i18n";
import { CARD_SURCHARGE_PCT } from "./invoiceDocument";

export interface QuoteLine {
  name: string;
  unit_price: string | number;
  quantity: number;
  total_price: string | number;
}

export interface QuoteDocInput {
  quote_ref: string;
  status: string;
  currency: string | null;
  subtotal: string | number | null;
  total: string | number | null;
  valid_until: string | null;
  description: string | null;
  notes: string | null;
  created_at: string | Date | null;
  /** 수신처 계정 id — 파일명에 담당자·상호를 함께 남길 때 쓴다. */
  account_id?: number | null;
  party_name?: string | null;
  party_email?: string | null;
  space_name?: string | null;
  line_items: QuoteLine[];
}

function money(amount: string | number | null, currency: string | null): string {
  return formatDocMoney(amount, currency);
}

function formatDate(value: string | Date | null, lang: DocLang): string {
  return formatDocDate(value, lang);
}

/** `termsHtml` is optional admin-authored standard copy from the editable
 *  `pdf.quote` template, injected below the notes box. */
export function buildQuoteBody(q: QuoteDocInput, lang: DocLang = "en", termsHtml = ""): string {
  const billTo = q.party_name
    ? `${escapeHtml(q.party_name)}${q.party_email ? `<br/>${escapeHtml(q.party_email)}` : ""}`
    : "—";

  const rows = q.line_items.length
    ? q.line_items.map(li => `
        <tr>
          <td>${escapeHtml(li.name)}</td>
          <td class="num">${money(li.unit_price, q.currency)}</td>
          <td class="num">${li.quantity}</td>
          <td class="num">${money(li.total_price, q.currency)}</td>
        </tr>`).join("")
    : `<tr><td colspan="4" style="color:#999;">${escapeHtml(q.description || t(lang, "noItems"))}</td></tr>`;

  return `
    <div class="section" style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
      <div>
        <h3>${t(lang, "quote.heading")}</h3>
        <div class="ref-chip" style="font-size:20px;">${escapeHtml(q.quote_ref)}</div>
        <div style="font-size:13px;color:#777;margin-top:4px;">${t(lang, "prepared")} ${formatDate(q.created_at, lang)}</div>
      </div>
      <span class="badge" style="background:#dbeafe;color:#1d4ed8;">${escapeHtml(statusLabel(lang, q.status || "Draft"))}</span>
    </div>

    <div class="section">
      <h3>${t(lang, "preparedFor")}</h3>
      <div style="font-size:14px;color:#333;">${billTo}</div>
      ${q.space_name ? `<div style="font-size:12px;color:#999;margin-top:8px;">${escapeHtml(q.space_name)}</div>` : ""}
    </div>

    <div class="section">
      <h3>${t(lang, "quoteItems")}</h3>
      <table class="lines">
        <thead>
          <tr><th>${t(lang, "description")}</th><th class="num">${t(lang, "unit")}</th><th class="num">${t(lang, "qty")}</th><th class="num">${t(lang, "amount")}</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <div class="total-box">
      <span>${t(lang, "total")}${q.valid_until ? ` · ${t(lang, "validUntil")} ${formatDate(q.valid_until, lang)}` : ""}</span>
      <span class="amount">${money(q.total, q.currency)}</span>
    </div>

    ${Number(q.total ?? 0) > 0 ? `<div class="section" style="margin-top:20px;">
      <h3>${t(lang, "paymentOptions")}</h3>
      <div class="row"><span class="label">${t(lang, "byBankTransfer")}</span><span class="value">${money(q.total, q.currency)}</span></div>
      <div class="row"><span class="label">${t(lang, "byCard", { pct: String(CARD_SURCHARGE_PCT) })}</span><span class="value">${money(Math.round(Number(q.total ?? 0) * (1 + CARD_SURCHARGE_PCT / 100) * 100) / 100, q.currency)}</span></div>
      <div style="font-size:12px;color:#999;margin-top:8px;">${t(lang, "cardSurchargeNote", { pct: String(CARD_SURCHARGE_PCT) })}</div>
    </div>` : ""}

    ${q.notes?.trim() ? `<div class="info-box"><strong>${t(lang, "notes")}</strong><br/>${escapeHtml(q.notes)}</div>` : ""}

    ${termsHtml.trim() ? `<div class="section" style="margin-top:24px;"><h3>${t(lang, "terms")}</h3><div style="font-size:13px;color:#333;line-height:1.6;">${termsHtml}</div></div>` : ""}
  `;
}

export function buildQuoteHtml(q: QuoteDocInput, company?: CompanyInfo, forPrint = true, lang: DocLang = "en", termsHtml = ""): string {
  const status = q.status || "Draft";
  return renderDocumentShell({
    docType: t(lang, "doctype.quote"),
    bodyHtml: buildQuoteBody(q, lang, termsHtml),
    company: company ?? getCompanyInfo(),
    forPrint,
    watermark: { text: statusLabel(lang, status), color: statusWatermarkColor(status) },
    compact: q.line_items.length <= 1,
  });
}
