/**
 * Service Assignment Brief — masked document for service hosts.
 *
 * When a homestay placement agreement is signed, the assigned service host
 * (airport pickup / initial settlement partner) needs ONLY the information
 * required to perform and bill their own service — NOT the full placement
 * agreement, the student's personal details, the guardian, or any financials
 * beyond their own service fee. This builder renders that minimal, masked brief
 * using the shared branded shell.
 *
 * Privacy: the student is shown by given name + last initial only; no full
 * address or unrelated fees are included. Operational details (pickup location,
 * flight number, etc.) come from the per-service `notes` field that ops control.
 */
import { renderDocumentShell, escapeHtml, getCompanyInfo, formatDocMoney, type CompanyInfo } from "./theme";
import { formatDocDateTime, serviceLabel, normalizeLang, type DocLang } from "./i18n";
import { al } from "./applicationLabels";

export interface ServiceBriefInput {
  placement_ref: string;
  service_type: string;
  scheduled_at: string | Date | null;
  amount: number | null;
  currency: string | null;
  /** Masked student label, e.g. "Minjae K." */
  student_label: string;
  /** Masked host label, e.g. "Smith family" (optional). */
  host_label?: string | null;
  notes?: string | null;
  /** Document language; defaults to the tenant default. */
  lang?: DocLang;
}

/** Human-friendly, localised service type label (shared catalogue in i18n.ts). */
function serviceTypeLabel(raw: string, lang: DocLang): string {
  return serviceLabel(lang, raw);
}

function money(amount: number | null, currency: string | null): string {
  if (amount == null) return "—";
  // Delegate to the shared formatter: correct symbol + decimals per currency,
  // falling back to the tenant DEFAULT_CURRENCY (KRW for Metheim) when blank.
  return formatDocMoney(amount, currency);
}

function formatDateTime(value: string | Date | null, lang: DocLang): string {
  return formatDocDateTime(value, lang, al(lang, "To be scheduled"));
}

export function buildServiceBriefBody(b: ServiceBriefInput): string {
  const lang = b.lang ?? normalizeLang(undefined);
  const L = (k: string) => escapeHtml(al(lang, k));
  return `
    <div class="section" style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
      <div>
        <h3>${L("Service Assignment")}</h3>
        <div class="ref-chip" style="font-size:20px;">${escapeHtml(serviceTypeLabel(b.service_type, lang))}</div>
        <div style="font-size:13px;color:#777;margin-top:4px;">${L("Placement")} ${escapeHtml(b.placement_ref)}</div>
      </div>
      <span class="badge" style="background:#FFF7F0;color:#E8621A;">${L("Service Host")}</span>
    </div>

    <div class="section">
      <h3>${L("Assignment")}</h3>
      <div class="row"><span class="label">${L("Service")}</span><span class="value">${escapeHtml(serviceTypeLabel(b.service_type, lang))}</span></div>
      <div class="row"><span class="label">${L("Scheduled")}</span><span class="value">${formatDateTime(b.scheduled_at, lang)}</span></div>
      <div class="row"><span class="label">${L("Student")}</span><span class="value">${escapeHtml(b.student_label)}</span></div>
      ${b.host_label ? `<div class="row"><span class="label">${L("Host family")}</span><span class="value">${escapeHtml(b.host_label)}</span></div>` : ""}
    </div>

    <div class="total-box">
      <span>${L("Service Fee")}</span>
      <span class="amount">${money(b.amount, b.currency)}</span>
    </div>

    ${b.notes?.trim() ? `<div class="info-box"><strong>${L("Instructions")}</strong><br/>${escapeHtml(b.notes)}</div>` : ""}

    <div class="section" style="margin-top:24px;font-size:11px;color:#999;">
      ${L("service_brief.confidentiality")}
    </div>
  `;
}

export function buildServiceBriefHtml(b: ServiceBriefInput, company?: CompanyInfo, forPrint = true): string {
  return renderDocumentShell({
    docType: al(b.lang ?? normalizeLang(undefined), "Service Brief"),
    bodyHtml: buildServiceBriefBody(b),
    company: company ?? getCompanyInfo(),
    forPrint,
  });
}
