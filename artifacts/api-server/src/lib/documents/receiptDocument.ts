/**
 * Document Hub — Receipt document builder (Phase 2)
 *
 * A receipt is a paid invoice rendered as a payment confirmation. It reuses the
 * same enriched invoice data and shared brand shell as the invoice document.
 */
import { renderDocumentShell, escapeHtml, getCompanyInfo, statusWatermarkColor, formatDocMoney, type CompanyInfo } from "./theme";
import { t, formatDocDate, statusLabel, type DocLang } from "./i18n";
import type { InvoiceDocInput } from "./invoiceDocument";

function formatMoney(amount: string | number | null, currency: string | null): string {
  return formatDocMoney(amount, currency);
}

function formatDate(value: string | Date | null, lang: DocLang): string {
  return formatDocDate(value, lang);
}

function formatQty(value: string | number): string {
  const n = Number(value ?? 0);
  return Number.isInteger(n) ? String(n) : n.toLocaleString("en-AU", { maximumFractionDigits: 2 });
}

/** Itemised "what was paid for" block, when line items exist. */
function renderItemsTable(inv: InvoiceDocInput, lang: DocLang): string {
  const items = inv.line_items ?? [];
  const rows = items.map(li => `
          <tr>
            <td>${escapeHtml(li.label)}${li.description?.trim() ? `<div style="font-size:12px;color:#999;">${escapeHtml(li.description)}</div>` : ""}</td>
            <td class="num">${escapeHtml(formatQty(li.quantity))}</td>
            <td class="num">${formatMoney(li.unit_amount, inv.currency)}</td>
            <td class="num">${formatMoney(li.total_amount, inv.currency)}</td>
          </tr>`).join("");
  return `
      <table class="lines">
        <thead>
          <tr><th>${t(lang, "description")}</th><th class="num">${t(lang, "qty")}</th><th class="num">${t(lang, "unit")}</th><th class="num">${t(lang, "amount")}</th></tr>
        </thead>
        <tbody>${rows}
          <tr>
            <td colspan="3" class="num"><strong>${t(lang, "total")}</strong></td>
            <td class="num"><strong>${formatMoney(inv.amount, inv.currency)}</strong></td>
          </tr>
        </tbody>
      </table>`;
}

/** Build the inner body HTML for a receipt (no shell).
 *  `termsHtml` is optional admin-authored standard copy (footer note) from the
 *  editable `pdf.receipt` template, injected below the confirmation box. */
export function buildReceiptBody(inv: InvoiceDocInput, lang: DocLang = "en", termsHtml = ""): string {
  const isPaid = inv.status === "Paid";
  const billTo = inv.account_name
    ? `${escapeHtml(inv.account_name)}${inv.account_email ? `<br/>${escapeHtml(inv.account_email)}` : ""}`
    : "—";
  const links = [
    inv.booking_ref ? `${escapeHtml(inv.booking_ref)}` : null,
    inv.contract_ref ? `${escapeHtml(inv.contract_ref)}` : null,
  ].filter(Boolean).join(" · ");

  return `
    <div class="section">
      <h3>${t(lang, "receipt.heading")}</h3>
      <div class="ref-chip" style="font-size:20px;">${escapeHtml(inv.invoice_ref)}</div>
      <div style="font-size:13px;color:#777;margin-top:4px;">
        ${isPaid ? `${t(lang, "paymentReceived")} ${formatDate(inv.paid_at, lang)}` : t(lang, "paymentPending")}
      </div>
    </div>

    <div class="section">
      <h3>${t(lang, "receivedFrom")}</h3>
      <div style="font-size:14px;color:#333;">${billTo}</div>
      ${links ? `<div style="font-size:12px;color:#999;margin-top:8px;">${links}</div>` : ""}
    </div>

    <div class="section">
      ${(inv.line_items?.length ?? 0) > 0
        ? renderItemsTable(inv, lang)
        : `<div class="row"><span class="label">${t(lang, "for")}</span><span class="value">${escapeHtml(inv.description?.trim() || "Accommodation services")}</span></div>`}
      <div class="row"><span class="label">${t(lang, "paymentMethod")}</span><span class="value">${escapeHtml(inv.payment_method || "—")}</span></div>
      <div class="row"><span class="label">${t(lang, "paymentDate")}</span><span class="value">${formatDate(inv.paid_at, lang)}</span></div>
    </div>

    <div class="total-box">
      <span>${t(lang, "amountReceived")}</span>
      <span class="amount">${formatMoney(inv.amount, inv.currency)}</span>
    </div>

    <div class="info-box">${t(lang, "receipt.confirm", { ref: escapeHtml(inv.invoice_ref) })}</div>

    ${termsHtml.trim() ? `<div class="section" style="margin-top:24px;"><h3>${t(lang, "terms")}</h3><div style="font-size:13px;color:#333;line-height:1.6;">${termsHtml}</div></div>` : ""}
  `;
}

export function buildReceiptHtml(inv: InvoiceDocInput, company?: CompanyInfo, forPrint = true, lang: DocLang = "en", termsHtml = ""): string {
  const status = inv.status || "Draft";
  return renderDocumentShell({
    docType: t(lang, "doctype.receipt"),
    bodyHtml: buildReceiptBody(inv, lang, termsHtml),
    company: company ?? getCompanyInfo(),
    forPrint,
    watermark: { text: statusLabel(lang, status), color: statusWatermarkColor(status) },
    compact: (inv.line_items?.length ?? 0) <= 1,
  });
}
