/**
 * Document Hub — Invoice document builder (Phase 1)
 *
 * Produces the branded HTML for an invoice, shared by the PDF renderer and
 * (future) email sender via the common document shell in `theme.ts`.
 * Static labels are translated via `i18n.ts` when a `lang` is supplied.
 */
import {
  renderDocumentShell,
  escapeHtml,
  getCompanyInfo,
  type CompanyInfo,
} from "./theme";
import { t, docLocale, type DocLang } from "./i18n";

/** Enriched invoice shape as returned by `enrichInvoices()` in routes/invoices.ts. */
export interface InvoiceDocInput {
  invoice_ref: string;
  status: string;
  amount: string | number | null;
  currency: string | null;
  due_date: string | null;
  paid_at: string | Date | null;
  payment_method: string | null;
  description: string | null;
  notes: string | null;
  created_at: string | Date | null;
  account_name?: string | null;
  account_email?: string | null;
  account_address?: string | null;
  booking_ref?: string | null;
  contract_ref?: string | null;
}

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  Draft: { bg: "#f3f4f6", fg: "#4b5563" },
  Sent: { bg: "#dbeafe", fg: "#1d4ed8" },
  Paid: { bg: "#dcfce7", fg: "#15803d" },
  Void: { bg: "#fee2e2", fg: "#b91c1c" },
  Archived: { bg: "#f3f4f6", fg: "#6b7280" },
};

function formatMoney(amount: string | number | null, currency: string | null): string {
  const n = Number(amount ?? 0);
  const ccy = currency || "AUD";
  const formatted = n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${formatted} ${ccy}`;
}

function formatDate(value: string | Date | null, lang: DocLang): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return escapeHtml(String(value));
  return d.toLocaleDateString(docLocale(lang), { year: "numeric", month: "short", day: "numeric" });
}

/** Build the inner body HTML for an invoice (no shell). */
export function buildInvoiceBody(inv: InvoiceDocInput, lang: DocLang = "en"): string {
  const status = inv.status || "Draft";
  const style = STATUS_STYLE[status] ?? STATUS_STYLE.Draft;
  const billTo = inv.account_name
    ? `${escapeHtml(inv.account_name)}${inv.account_email ? `<br/>${escapeHtml(inv.account_email)}` : ""}${inv.account_address ? `<br/>${escapeHtml(inv.account_address)}` : ""}`
    : "—";

  const links = [
    inv.booking_ref ? `${escapeHtml(inv.booking_ref)}` : null,
    inv.contract_ref ? `${escapeHtml(inv.contract_ref)}` : null,
  ].filter(Boolean).join(" · ");

  const lineDesc = inv.description?.trim() || "Accommodation services";

  return `
    <div class="section" style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
      <div>
        <h3>${t(lang, "invoice.heading")}</h3>
        <div class="ref-chip" style="font-size:20px;">${escapeHtml(inv.invoice_ref)}</div>
        <div style="font-size:13px;color:#777;margin-top:4px;">${t(lang, "issued")} ${formatDate(inv.created_at, lang)}</div>
      </div>
      <span class="badge" style="background:${style.bg};color:${style.fg};">${escapeHtml(status)}</span>
    </div>

    <div class="section">
      <h3>${t(lang, "billTo")}</h3>
      <div style="font-size:14px;color:#333;">${billTo}</div>
      ${links ? `<div style="font-size:12px;color:#999;margin-top:8px;">${links}</div>` : ""}
    </div>

    <div class="section">
      <h3>${t(lang, "details")}</h3>
      <table class="lines">
        <thead>
          <tr><th>${t(lang, "description")}</th><th class="num">${t(lang, "amount")}</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>${escapeHtml(lineDesc)}</td>
            <td class="num">${formatMoney(inv.amount, inv.currency)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="section">
      <div class="row"><span class="label">${t(lang, "dueDate")}</span><span class="value">${formatDate(inv.due_date, lang)}</span></div>
      ${status === "Paid" ? `
      <div class="row"><span class="label">${t(lang, "paid")}</span><span class="value">${formatDate(inv.paid_at, lang)}${inv.payment_method ? ` · ${escapeHtml(inv.payment_method)}` : ""}</span></div>
      ` : ""}
    </div>

    <div class="total-box">
      <span>${status === "Paid" ? t(lang, "amountPaid") : t(lang, "amountDue")}</span>
      <span class="amount">${formatMoney(inv.amount, inv.currency)}</span>
    </div>

    ${inv.notes?.trim() ? `<div class="info-box"><strong>${t(lang, "notes")}</strong><br/>${escapeHtml(inv.notes)}</div>` : ""}
  `;
}

/** Build the full standalone HTML document for an invoice. */
export function buildInvoiceHtml(inv: InvoiceDocInput, company?: CompanyInfo, forPrint = true, lang: DocLang = "en"): string {
  return renderDocumentShell({
    docType: t(lang, "doctype.invoice"),
    bodyHtml: buildInvoiceBody(inv, lang),
    company: company ?? getCompanyInfo(),
    forPrint,
  });
}
