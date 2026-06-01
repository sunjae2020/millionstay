/**
 * Document Hub — Contract document builder (Phase 4)
 *
 * Renders a tenancy/accommodation contract as a branded PDF including the key
 * terms, the free-text terms body, and a signature block. Uses the shared
 * document shell so colour/typography stay consistent with all other documents.
 */
import { renderDocumentShell, escapeHtml, getCompanyInfo, type CompanyInfo } from "./theme";
import { t, docLocale, type DocLang } from "./i18n";

export interface ContractDocInput {
  contract_ref: string;
  status: string;
  tenant_name?: string | null;
  landlord_name?: string | null;
  space_name?: string | null;
  product_name?: string | null;
  booking_ref?: string | null;
  start_date: string | null;
  end_date: string | null;
  weekly_rate: number | null;
  total_rent: number | null;
  bond_amount: number | null;
  advance_amount: number | null;
  currency: string | null;
  terms_text: string | null;
  notes: string | null;
  signed_at: string | Date | null;
  created_at: string | Date | null;
}

function money(amount: number | null, currency: string | null): string {
  if (amount == null) return "—";
  return `${Number(amount).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency || "AUD"}`;
}

function formatDate(value: string | Date | null, lang: DocLang): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return escapeHtml(String(value));
  return d.toLocaleDateString(docLocale(lang), { year: "numeric", month: "short", day: "numeric" });
}

/** Render free-text terms, preserving paragraph breaks, with escaping. */
function renderTerms(text: string | null, lang: DocLang): string {
  if (!text?.trim()) return "";
  const paragraphs = text.split(/\n{2,}/).map(p =>
    `<p style="margin:0 0 12px;font-size:13px;color:#333;white-space:pre-wrap;">${escapeHtml(p.trim())}</p>`,
  );
  return `<div class="section"><h3>${t(lang, "terms")}</h3>${paragraphs.join("")}</div>`;
}

export function buildContractBody(c: ContractDocInput, lang: DocLang = "en"): string {
  const signedSuffix = c.signed_at ? ` · ${t(lang, "signed")} ${formatDate(c.signed_at, lang)}` : "";
  return `
    <div class="section" style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
      <div>
        <h3>${t(lang, "contract.heading")}</h3>
        <div class="ref-chip" style="font-size:20px;">${escapeHtml(c.contract_ref)}</div>
        <div style="font-size:13px;color:#777;margin-top:4px;">${t(lang, "prepared")} ${formatDate(c.created_at, lang)}</div>
      </div>
      <span class="badge" style="background:#FFF7F0;color:#E8621A;">${escapeHtml(c.status || "Draft")}</span>
    </div>

    <div class="section">
      <h3>${t(lang, "parties")}</h3>
      <div class="row"><span class="label">${t(lang, "landlord")}</span><span class="value">${escapeHtml(c.landlord_name || getCompanyInfo().legalName)}</span></div>
      <div class="row"><span class="label">${t(lang, "tenant")}</span><span class="value">${escapeHtml(c.tenant_name || "—")}</span></div>
    </div>

    <div class="section">
      <h3>${t(lang, "premisesTerm")}</h3>
      ${c.space_name ? `<div class="row"><span class="label">${t(lang, "premises")}</span><span class="value">${escapeHtml(c.space_name)}</span></div>` : ""}
      ${c.product_name ? `<div class="row"><span class="label">${t(lang, "product")}</span><span class="value">${escapeHtml(c.product_name)}</span></div>` : ""}
      <div class="row"><span class="label">${t(lang, "startDate")}</span><span class="value">${formatDate(c.start_date, lang)}</span></div>
      <div class="row"><span class="label">${t(lang, "endDate")}</span><span class="value">${formatDate(c.end_date, lang)}</span></div>
    </div>

    <div class="section">
      <h3>${t(lang, "financials")}</h3>
      <div class="row"><span class="label">${t(lang, "weeklyRate")}</span><span class="value">${money(c.weekly_rate, c.currency)}</span></div>
      <div class="row"><span class="label">${t(lang, "totalRent")}</span><span class="value">${money(c.total_rent, c.currency)}</span></div>
      <div class="row"><span class="label">${t(lang, "bond")}</span><span class="value">${money(c.bond_amount, c.currency)}</span></div>
      <div class="row"><span class="label">${t(lang, "advance")}</span><span class="value">${money(c.advance_amount, c.currency)}</span></div>
    </div>

    ${renderTerms(c.terms_text, lang)}

    ${c.notes?.trim() ? `<div class="info-box"><strong>${t(lang, "notes")}</strong><br/>${escapeHtml(c.notes)}</div>` : ""}

    <div class="section" style="margin-top:32px;">
      <h3>${t(lang, "signatures")}</h3>
      <div style="display:flex;gap:32px;margin-top:24px;">
        <div style="flex:1;">
          <div style="border-bottom:1px solid #999;height:40px;"></div>
          <div style="font-size:12px;color:#777;margin-top:6px;">${t(lang, "landlord")}${signedSuffix}</div>
        </div>
        <div style="flex:1;">
          <div style="border-bottom:1px solid #999;height:40px;"></div>
          <div style="font-size:12px;color:#777;margin-top:6px;">${t(lang, "tenant")}${signedSuffix}</div>
        </div>
      </div>
    </div>
  `;
}

export function buildContractHtml(c: ContractDocInput, company?: CompanyInfo, forPrint = true, lang: DocLang = "en"): string {
  return renderDocumentShell({
    docType: t(lang, "doctype.contract"),
    bodyHtml: buildContractBody(c, lang),
    company: company ?? getCompanyInfo(),
    forPrint,
  });
}
