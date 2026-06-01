/**
 * Document Hub — Receipt document builder (Phase 2)
 *
 * A receipt is a paid invoice rendered as a payment confirmation. It reuses the
 * same enriched invoice data and shared brand shell as the invoice document.
 */
import { renderDocumentShell, escapeHtml, getCompanyInfo, type CompanyInfo } from "./theme";
import { t, docLocale, type DocLang } from "./i18n";
import type { InvoiceDocInput } from "./invoiceDocument";

function formatMoney(amount: string | number | null, currency: string | null): string {
  const n = Number(amount ?? 0);
  const ccy = currency || "AUD";
  return `${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${ccy}`;
}

function formatDate(value: string | Date | null, lang: DocLang): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return escapeHtml(String(value));
  return d.toLocaleDateString(docLocale(lang), { year: "numeric", month: "short", day: "numeric" });
}

export function buildReceiptBody(inv: InvoiceDocInput, lang: DocLang = "en"): string {
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
      <div class="row"><span class="label">${t(lang, "for")}</span><span class="value">${escapeHtml(inv.description?.trim() || "Accommodation services")}</span></div>
      <div class="row"><span class="label">${t(lang, "paymentMethod")}</span><span class="value">${escapeHtml(inv.payment_method || "—")}</span></div>
      <div class="row"><span class="label">${t(lang, "paymentDate")}</span><span class="value">${formatDate(inv.paid_at, lang)}</span></div>
    </div>

    <div class="total-box">
      <span>${t(lang, "amountReceived")}</span>
      <span class="amount">${formatMoney(inv.amount, inv.currency)}</span>
    </div>

    <div class="info-box">${t(lang, "receipt.confirm", { ref: escapeHtml(inv.invoice_ref) })}</div>
  `;
}

export function buildReceiptHtml(inv: InvoiceDocInput, company?: CompanyInfo, forPrint = true, lang: DocLang = "en"): string {
  return renderDocumentShell({
    docType: t(lang, "doctype.receipt"),
    bodyHtml: buildReceiptBody(inv, lang),
    company: company ?? getCompanyInfo(),
    forPrint,
  });
}
