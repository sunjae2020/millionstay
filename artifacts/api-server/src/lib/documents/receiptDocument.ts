/**
 * Document Hub — Receipt document builder (Phase 2)
 *
 * A receipt is a paid invoice rendered as a payment confirmation. It reuses the
 * same enriched invoice data and shared brand shell as the invoice document.
 */
import { renderDocumentShell, escapeHtml, getCompanyInfo, type CompanyInfo } from "./theme";
import type { InvoiceDocInput } from "./invoiceDocument";

function formatMoney(amount: string | number | null, currency: string | null): string {
  const n = Number(amount ?? 0);
  const ccy = currency || "AUD";
  return `${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${ccy}`;
}

function formatDate(value: string | Date | null): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return escapeHtml(String(value));
  return d.toLocaleDateString("en-AU", { year: "numeric", month: "short", day: "numeric" });
}

export function buildReceiptBody(inv: InvoiceDocInput): string {
  const isPaid = inv.status === "Paid";
  const billTo = inv.account_name
    ? `${escapeHtml(inv.account_name)}${inv.account_email ? `<br/>${escapeHtml(inv.account_email)}` : ""}`
    : "—";
  const links = [
    inv.booking_ref ? `Booking ${escapeHtml(inv.booking_ref)}` : null,
    inv.contract_ref ? `Contract ${escapeHtml(inv.contract_ref)}` : null,
  ].filter(Boolean).join(" · ");

  return `
    <div class="section">
      <h3>Receipt</h3>
      <div class="ref-chip" style="font-size:20px;">${escapeHtml(inv.invoice_ref)}</div>
      <div style="font-size:13px;color:#777;margin-top:4px;">
        ${isPaid ? `Payment received ${formatDate(inv.paid_at)}` : "Payment pending"}
      </div>
    </div>

    <div class="section">
      <h3>Received From</h3>
      <div style="font-size:14px;color:#333;">${billTo}</div>
      ${links ? `<div style="font-size:12px;color:#999;margin-top:8px;">${links}</div>` : ""}
    </div>

    <div class="section">
      <div class="row"><span class="label">For</span><span class="value">${escapeHtml(inv.description?.trim() || "Accommodation services")}</span></div>
      <div class="row"><span class="label">Payment Method</span><span class="value">${escapeHtml(inv.payment_method || "—")}</span></div>
      <div class="row"><span class="label">Payment Date</span><span class="value">${formatDate(inv.paid_at)}</span></div>
    </div>

    <div class="total-box">
      <span>Amount Received</span>
      <span class="amount">${formatMoney(inv.amount, inv.currency)}</span>
    </div>

    <div class="info-box">
      This document confirms receipt of the amount shown above against invoice
      <strong>${escapeHtml(inv.invoice_ref)}</strong>. Thank you.
    </div>
  `;
}

export function buildReceiptHtml(inv: InvoiceDocInput, company?: CompanyInfo, forPrint = true): string {
  return renderDocumentShell({
    docType: "Receipt",
    bodyHtml: buildReceiptBody(inv),
    company: company ?? getCompanyInfo(),
    forPrint,
  });
}
