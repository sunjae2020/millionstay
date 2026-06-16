/**
 * Document Hub — Contract document builder (Phase 4)
 *
 * Renders a tenancy/accommodation contract as a branded PDF including the key
 * terms, the free-text terms body, and a signature block. Uses the shared
 * document shell so colour/typography stay consistent with all other documents.
 */
import { renderDocumentShell, escapeHtml, getCompanyInfo, type CompanyInfo } from "./theme";
import { t, docLocale, type DocLang } from "./i18n";

/** A captured drawn signature (from contract_signing_requests.signatures). */
export interface ContractSignature {
  role: string;
  name: string;
  email?: string | null;
  signatureImage?: string | null;
  serverSignedAt?: string | null;
  ip?: string | null;
  consentText?: string | null;
}

export interface ContractDocInput {
  contract_ref: string;
  status: string;
  tenant_name?: string | null;
  tenant_email?: string | null;
  tenant_address?: string | null;
  landlord_name?: string | null;
  landlord_email?: string | null;
  landlord_address?: string | null;
  space_name?: string | null;
  product_name?: string | null;
  booking_ref?: string | null;
  start_date: string | null;
  end_date: string | null;
  effective_date?: string | null;
  expiry_date?: string | null;
  /** Rent billing frequency (Monthly | Weekly | Biweekly) from the product. */
  billing_frequency?: string | null;
  weekly_rate: number | null;
  total_rent: number | null;
  bond_amount: number | null;
  advance_amount: number | null;
  currency: string | null;
  terms_text: string | null;
  notes: string | null;
  signed_at: string | Date | null;
  created_at: string | Date | null;
  /** Drawn e-signatures to embed (when signed via the signing flow). */
  signatures?: ContractSignature[] | null;
  /** True once signed — switches the static block to the drawn signatures. */
  signed?: boolean;
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

function formatDateTime(value: string | null | undefined, lang: DocLang): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return escapeHtml(String(value));
  return d.toLocaleString(docLocale(lang), { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * Drawn-signature block (mirrors applicationPdf renderSignatureBlock). Used when
 * the contract was signed via the e-signature flow; otherwise the static
 * landlord/tenant ruled-line block is rendered.
 */
function renderDrawnSignatures(c: ContractDocInput, lang: DocLang): string {
  const sigs = c.signatures ?? [];
  if (!sigs.length) return "";
  const cards = sigs.map((s) => {
    const roleLabel = escapeHtml(s.role.charAt(0).toUpperCase() + s.role.slice(1));
    const sigArea = c.signed && s.signatureImage
      ? `<img src="${s.signatureImage}" alt="Signature of ${escapeHtml(s.name)}" style="max-height:64px;max-width:100%;display:block;" />`
      : `<div style="border-bottom:1px solid #999;height:48px;"></div>
         <div style="font-size:11px;color:#bbb;margin-top:4px;">Pending signature</div>`;
    const meta = c.signed && s.signatureImage
      ? `<div style="font-size:11px;color:#777;margin-top:8px;line-height:1.6;">
           <strong style="color:#555;">${escapeHtml(s.name)}</strong> · ${roleLabel}<br/>
           ${s.email ? `${escapeHtml(s.email)}<br/>` : ""}
           ${t(lang, "signed")} ${formatDateTime(s.serverSignedAt, lang)}${s.ip ? ` · IP ${escapeHtml(s.ip)}` : ""}<br/>
           <span style="color:#999;">${escapeHtml(s.consentText ?? "Consent recorded electronically.")}</span>
         </div>`
      : `<div style="font-size:11px;color:#777;margin-top:8px;">
           <strong style="color:#555;">${escapeHtml(s.name)}</strong> · ${roleLabel}
         </div>`;
    return `<div style="flex:1 1 240px;min-width:220px;padding:14px;border:1px solid #f0f0f0;border-radius:10px;">
      ${sigArea}${meta}
    </div>`;
  });
  return `<div class="section" style="margin-top:32px;">
    <h3>${t(lang, "signatures")}</h3>
    <div style="display:flex;flex-wrap:wrap;gap:16px;margin-top:12px;">${cards.join("")}</div>
  </div>`;
}

/** Render free-text terms, preserving paragraph breaks, with escaping. */
function renderTerms(text: string | null, lang: DocLang): string {
  if (!text?.trim()) return "";
  const paragraphs = text.split(/\n{2,}/).map(p =>
    `<p style="margin:0 0 12px;font-size:13px;color:#333;white-space:pre-wrap;">${escapeHtml(p.trim())}</p>`,
  );
  return `<div class="section"><h3>${t(lang, "terms")}</h3>${paragraphs.join("")}</div>`;
}

/** Map a product billing frequency to a localised label. */
function freqLabel(freq: string | null | undefined, lang: DocLang): string {
  const f = (freq ?? "").toLowerCase();
  if (f === "monthly") return t(lang, "freq.monthly");
  if (f === "weekly") return t(lang, "freq.weekly");
  if (f === "biweekly" || f === "fortnightly") return t(lang, "freq.fortnightly");
  return freq ? escapeHtml(freq) : "";
}

export function buildContractBody(c: ContractDocInput, lang: DocLang = "en"): string {
  const row = (label: string, value: string) =>
    `<div class="row"><span class="label">${label}</span><span class="value">${value}</span></div>`;
  const signedSuffix = c.signed_at ? ` · ${t(lang, "signed")} ${formatDate(c.signed_at, lang)}` : "";

  // Fees split: bond + advance are payable up front; rent recurs.
  const bond = Number(c.bond_amount ?? 0);
  const advance = Number(c.advance_amount ?? 0);
  const initialTotal = bond + advance;
  const cycle = freqLabel(c.billing_frequency, lang);
  const hasOngoing = c.weekly_rate != null || c.total_rent != null;

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
      <h3>${t(lang, "tenant")}</h3>
      ${row(t(lang, "name"), escapeHtml(c.tenant_name || "—"))}
      ${c.tenant_email ? row(t(lang, "email"), escapeHtml(c.tenant_email)) : ""}
      ${c.tenant_address ? row(t(lang, "address"), escapeHtml(c.tenant_address)) : ""}
    </div>

    <div class="section">
      <h3>${t(lang, "landlord")}</h3>
      ${row(t(lang, "name"), escapeHtml(c.landlord_name || getCompanyInfo().legalName))}
      ${c.landlord_email ? row(t(lang, "email"), escapeHtml(c.landlord_email)) : ""}
      ${c.landlord_address ? row(t(lang, "address"), escapeHtml(c.landlord_address)) : ""}
    </div>

    <div class="section">
      <h3>${t(lang, "premisesTerm")}</h3>
      ${c.space_name ? row(t(lang, "premises"), escapeHtml(c.space_name)) : ""}
      ${c.product_name ? row(t(lang, "product"), escapeHtml(c.product_name)) : ""}
      ${row(t(lang, "startDate"), formatDate(c.start_date, lang))}
      ${row(t(lang, "endDate"), formatDate(c.end_date, lang))}
      ${c.effective_date ? row(t(lang, "effectiveDate"), formatDate(c.effective_date, lang)) : ""}
      ${c.expiry_date ? row(t(lang, "expiryDate"), formatDate(c.expiry_date, lang)) : ""}
    </div>

    <div class="section">
      <h3>${t(lang, "feesInitial")}</h3>
      ${bond > 0 ? row(`· ${t(lang, "bond")}`, money(c.bond_amount, c.currency)) : ""}
      ${advance > 0 ? row(`· ${t(lang, "advance")}`, money(c.advance_amount, c.currency)) : ""}
      ${row(t(lang, "totalDueNow"), money(initialTotal, c.currency))}
    </div>

    ${hasOngoing ? `<div class="section">
      <h3>${t(lang, "feesOngoing")}</h3>
      ${c.weekly_rate != null ? row(t(lang, "weeklyRate"), money(c.weekly_rate, c.currency)) : ""}
      ${cycle ? row(t(lang, "billingCycle"), cycle) : ""}
      ${c.total_rent != null ? row(t(lang, "totalRent"), money(c.total_rent, c.currency)) : ""}
    </div>` : ""}

    ${renderTerms(c.terms_text, lang)}

    ${c.notes?.trim() ? `<div class="info-box"><strong>${t(lang, "notes")}</strong><br/>${escapeHtml(c.notes)}</div>` : ""}

    ${c.signatures?.length
      ? renderDrawnSignatures(c, lang)
      : `<div class="section" style="margin-top:32px;">
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
    </div>`}
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
