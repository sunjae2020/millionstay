/**
 * Document Hub — Contract document builder (Phase 4)
 *
 * Renders a tenancy/accommodation contract as a branded PDF including the key
 * terms, the free-text terms body, and a signature block. Uses the shared
 * document shell so colour/typography stay consistent with all other documents.
 */
import { renderDocumentShell, escapeHtml, getCompanyInfo, formatDocMoney, type CompanyInfo } from "./theme";
import { t, formatDocDate, formatDocDateTime, statusLabel, type DocLang } from "./i18n";
import { al, roleLabel } from "./applicationLabels";

/** A priced add-on service line (from contract_line_items, item_type=Service):
 *  airport pickup, initial settlement, prepaid phone, etc. */
export interface ContractServiceLine {
  name: string;
  quantity: number;
  unit_amount: number;
  total_amount: number;
  /** true when billed on a recurring schedule rather than once up-front. */
  recurring: boolean;
  frequency?: string | null;
  notes?: string | null;
}

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

/**
 * The leased unit as described in a Korean lease agreement's 부동산의 표시 table.
 * Read from the contract's `spaces` row (plus its property) at build time, so a
 * single standard agreement renders correctly for whichever unit type applies
 * (Metheim 여수: A / A-1 / B / C / D / D-1 / E / E-1) without per-type templates.
 * Every field is optional — rows with no value are omitted from the table.
 */
export interface ContractPremises {
  /** Street address of the building (소재지). */
  location?: string | null;
  /** Building / property name (건물명). */
  building?: string | null;
  /** Unit number (호수), e.g. "101". */
  unit_no?: string | null;
  /** Floor (층). */
  floor?: string | null;
  /** Unit type name (타입), e.g. "A-1타입" — from the parent type space. */
  unit_type?: string | null;
  /** Structure / permitted use (구조 · 용도). */
  structure_use?: string | null;
  exclusive_area_m2?: number | null;
  residential_common_area_m2?: number | null;
  supply_area_m2?: number | null;
  other_common_area_m2?: number | null;
  contract_area_m2?: number | null;
  land_share_m2?: number | null;
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
  /** Leased unit detail for the 부동산의 표시 table (Korean lease agreements). */
  premises?: ContractPremises | null;
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
  /** Priced add-on services (airport pickup, settlement, prepaid phone, …). */
  additional_services?: ContractServiceLine[] | null;
  terms_text: string | null;
  /**
   * Annex / special terms (별지 · 특약사항). Rendered on its own page at the end
   * of the SAME PDF so the agreement and its annex stay one file. Callers split
   * this out of the template body at the `[별지]` marker (see ANNEX_MARKER).
   */
  annex_text?: string | null;
  notes: string | null;
  signed_at: string | Date | null;
  created_at: string | Date | null;
  /** Drawn e-signatures to embed (when signed via the signing flow). */
  signatures?: ContractSignature[] | null;
  /** True once signed — switches the static block to the drawn signatures. */
  signed?: boolean;
}

function money(amount: number | null, currency: string | null): string {
  return formatDocMoney(amount, currency);
}

function formatDate(value: string | Date | null, lang: DocLang): string {
  return formatDocDate(value, lang);
}

function formatDateTime(value: string | null | undefined, lang: DocLang): string {
  return formatDocDateTime(value, lang);
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
    const role = escapeHtml(roleLabel(lang, s.role));
    const sigArea = c.signed && s.signatureImage
      ? `<img src="${s.signatureImage}" alt="Signature of ${escapeHtml(s.name)}" style="max-height:64px;max-width:100%;display:block;" />`
      : `<div style="border-bottom:1px solid #999;height:48px;"></div>
         <div style="font-size:11px;color:#bbb;margin-top:4px;">${escapeHtml(al(lang, "Pending signature"))}</div>`;
    const meta = c.signed && s.signatureImage
      ? `<div style="font-size:11px;color:#777;margin-top:8px;line-height:1.6;">
           <strong style="color:#555;">${escapeHtml(s.name)}</strong> · ${role}<br/>
           ${s.email ? `${escapeHtml(s.email)}<br/>` : ""}
           ${t(lang, "signed")} ${formatDateTime(s.serverSignedAt, lang)}${s.ip ? ` · IP ${escapeHtml(s.ip)}` : ""}<br/>
           <span style="color:#999;">${escapeHtml(s.consentText ?? "Consent recorded electronically.")}</span>
         </div>`
      : `<div style="font-size:11px;color:#777;margin-top:8px;">
           <strong style="color:#555;">${escapeHtml(s.name)}</strong> · ${role}
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

/**
 * Marker that splits a template body into the agreement clauses and its annex.
 * Everything after the first occurrence becomes the 별지 page of the same PDF.
 */
export const ANNEX_MARKER = "[별지]";

/** Split a template body at ANNEX_MARKER into { terms, annex }. */
export function splitAnnex(body: string | null | undefined): { terms: string | null; annex: string | null } {
  if (!body?.trim()) return { terms: null, annex: null };
  const at = body.indexOf(ANNEX_MARKER);
  if (at < 0) return { terms: body, annex: null };
  return {
    terms: body.slice(0, at).trim() || null,
    annex: body.slice(at + ANNEX_MARKER.length).trim() || null,
  };
}

/** Format an area in m² with the Korean 평 equivalent (1평 = 3.3058 m²). */
function area(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const m2 = Number(value);
  if (m2 === 0) return null;
  const pyeong = m2 / 3.305785;
  return `${m2.toLocaleString(undefined, { maximumFractionDigits: 3 })} m² (${pyeong.toFixed(2)}평)`;
}

/**
 * 부동산의 표시 — the leased unit described from its `spaces` row. Only rows with
 * a value are printed, so a unit missing (say) 대지지분 simply omits that line.
 */
function renderPremises(c: ContractDocInput, lang: DocLang): string {
  const p = c.premises;
  if (!p) return "";
  const rows: Array<[string, string | null]> = [
    [t(lang, "location"), p.location ?? null],
    [t(lang, "building"), p.building ?? null],
    [t(lang, "unitNo"), p.unit_no ?? null],
    [t(lang, "floor"), p.floor ?? null],
    [t(lang, "unitType"), p.unit_type ?? null],
    [t(lang, "structureUse"), p.structure_use ?? null],
    [t(lang, "areaExclusive"), area(p.exclusive_area_m2)],
    [t(lang, "areaResidentialCommon"), area(p.residential_common_area_m2)],
    [t(lang, "areaSupply"), area(p.supply_area_m2)],
    [t(lang, "areaOtherCommon"), area(p.other_common_area_m2)],
    [t(lang, "areaContract"), area(p.contract_area_m2)],
    [t(lang, "areaLandShare"), area(p.land_share_m2)],
  ].filter((r): r is [string, string] => r[1] != null && String(r[1]).trim() !== "");
  if (!rows.length) return "";
  const body = rows.map(([label, value]) =>
    `<tr><th style="text-align:left;width:34%;padding:7px 10px;background:#FAFAFA;border:1px solid #EEE;font-size:12px;color:#666;font-weight:600;">${escapeHtml(label)}</th>
         <td style="padding:7px 10px;border:1px solid #EEE;font-size:13px;color:#333;">${escapeHtml(String(value))}</td></tr>`,
  ).join("");
  return `<div class="section">
      <h3>${t(lang, "propertyDescription")}</h3>
      <table style="width:100%;border-collapse:collapse;margin-top:10px;">${body}</table>
    </div>`;
}

/**
 * 별지 (특약사항) — rendered on a fresh page at the end of the same document, so
 * the agreement and its annex are delivered as one PDF rather than two files.
 */
function renderAnnex(text: string | null | undefined, lang: DocLang): string {
  if (!text?.trim()) return "";
  const paragraphs = text.split(/\n{2,}/).map(p =>
    `<p style="margin:0 0 12px;font-size:13px;color:#333;white-space:pre-wrap;">${escapeHtml(p.trim())}</p>`,
  ).join("");
  return `<div class="section" style="page-break-before:always;break-before:page;margin-top:24px;">
      <h3>${t(lang, "annex")}</h3>${paragraphs}
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

/** Render the priced add-on services as an itemised table (qty/unit/total),
 *  tagging each row as recurring or one-off. Empty string when none. */
function renderAdditionalServices(c: ContractDocInput, lang: DocLang, brand: string): string {
  const svcs = (c.additional_services ?? []).filter((s) => s && (Number(s.total_amount) !== 0 || Number(s.unit_amount) !== 0 || s.name));
  if (!svcs.length) return "";
  const subtotal = svcs.reduce((sum, s) => sum + Number(s.total_amount ?? 0), 0);
  const rows = svcs.map((s) => {
    const tag = `<span style="display:inline-block;margin-left:8px;padding:1px 8px;border-radius:999px;font-size:10px;font-weight:700;letter-spacing:0.04em;background:#FFF7F0;color:${brand};">${
      s.recurring ? `${t(lang, "recurring")}${s.frequency?.trim() ? ` · ${escapeHtml(s.frequency)}` : ""}` : t(lang, "oneOff")
    }</span>`;
    return `
          <tr>
            <td>${escapeHtml(s.name)}${tag}${s.notes?.trim() ? `<div style="font-size:12px;color:#999;">${escapeHtml(s.notes)}</div>` : ""}</td>
            <td class="num">${Number(s.quantity ?? 1)}</td>
            <td class="num">${money(Number(s.unit_amount ?? 0), c.currency)}</td>
            <td class="num">${money(Number(s.total_amount ?? 0), c.currency)}</td>
          </tr>`;
  }).join("");
  return `
    <div class="section">
      <h3>${t(lang, "additionalServices")}</h3>
      <table class="lines">
        <thead>
          <tr><th>${t(lang, "description")}</th><th class="num">${t(lang, "qty")}</th><th class="num">${t(lang, "unit")}</th><th class="num">${t(lang, "amount")}</th></tr>
        </thead>
        <tbody>${rows}
          <tr>
            <td colspan="3" class="num"><strong>${t(lang, "servicesSubtotal")}</strong></td>
            <td class="num"><strong>${money(subtotal, c.currency)}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>`;
}

/** Map a product billing frequency to a localised label. */
function freqLabel(freq: string | null | undefined, lang: DocLang): string {
  const f = (freq ?? "").toLowerCase();
  if (f === "monthly") return t(lang, "freq.monthly");
  if (f === "weekly") return t(lang, "freq.weekly");
  if (f === "biweekly" || f === "fortnightly") return t(lang, "freq.fortnightly");
  return freq ? escapeHtml(freq) : "";
}

export function buildContractBody(c: ContractDocInput, lang: DocLang = "en", company?: CompanyInfo): string {
  // Per-tenant brand color for inline accents (status badge, service tags),
  // falling back to the default orange so the primary AU instance is unchanged.
  const brand = company?.brandColor || "#E8621A";
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
      <span class="badge" style="background:#FFF7F0;color:${brand};">${escapeHtml(statusLabel(lang, c.status || "Draft"))}</span>
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

    ${renderPremises(c, lang)}

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

    ${renderAdditionalServices(c, lang, brand)}

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

    ${renderAnnex(c.annex_text, lang)}
  `;
}

export function buildContractHtml(c: ContractDocInput, company?: CompanyInfo, forPrint = true, lang: DocLang = "en"): string {
  const resolvedCompany = company ?? getCompanyInfo();
  return renderDocumentShell({
    docType: t(lang, "doctype.contract"),
    bodyHtml: buildContractBody(c, lang, resolvedCompany),
    company: resolvedCompany,
    forPrint,
  });
}
