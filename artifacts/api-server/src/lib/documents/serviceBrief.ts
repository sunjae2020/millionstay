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
import { formatDocDateTime } from "./i18n";

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
}

/** Human-friendly service type label. */
function serviceTypeLabel(raw: string): string {
  const map: Record<string, string> = {
    airport_pickup: "Airport pickup",
    initial_settlement: "Initial settlement",
  };
  return map[raw] ?? raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function money(amount: number | null, currency: string | null): string {
  if (amount == null) return "—";
  // Use the shared per-currency formatter (₩450,000 / A$1,234.56) so the brief
  // matches every other document and respects the tenant default currency.
  return formatDocMoney(amount, currency);
}

function formatDateTime(value: string | Date | null): string {
  return formatDocDateTime(value, "en", "To be scheduled");
}

export function buildServiceBriefBody(b: ServiceBriefInput): string {
  return `
    <div class="section" style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
      <div>
        <h3>Service Assignment</h3>
        <div class="ref-chip" style="font-size:20px;">${escapeHtml(serviceTypeLabel(b.service_type))}</div>
        <div style="font-size:13px;color:#777;margin-top:4px;">Placement ${escapeHtml(b.placement_ref)}</div>
      </div>
      <span class="badge" style="background:#FFF7F0;color:#E8621A;">Service Host</span>
    </div>

    <div class="section">
      <h3>Assignment</h3>
      <div class="row"><span class="label">Service</span><span class="value">${escapeHtml(serviceTypeLabel(b.service_type))}</span></div>
      <div class="row"><span class="label">Scheduled</span><span class="value">${formatDateTime(b.scheduled_at)}</span></div>
      <div class="row"><span class="label">Student</span><span class="value">${escapeHtml(b.student_label)}</span></div>
      ${b.host_label ? `<div class="row"><span class="label">Host family</span><span class="value">${escapeHtml(b.host_label)}</span></div>` : ""}
    </div>

    <div class="total-box">
      <span>Service Fee</span>
      <span class="amount">${money(b.amount, b.currency)}</span>
    </div>

    ${b.notes?.trim() ? `<div class="info-box"><strong>Instructions</strong><br/>${escapeHtml(b.notes)}</div>` : ""}

    <div class="section" style="margin-top:24px;font-size:11px;color:#999;">
      This brief contains only the information required to perform and bill this
      service. Please treat the student's details as confidential and handle them
      in line with MillionStay's Privacy Policy.
    </div>
  `;
}

export function buildServiceBriefHtml(b: ServiceBriefInput, company?: CompanyInfo, forPrint = true): string {
  return renderDocumentShell({
    docType: "Service Brief",
    bodyHtml: buildServiceBriefBody(b),
    company: company ?? getCompanyInfo(),
    forPrint,
  });
}
