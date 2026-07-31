/**
 * Document retention policy — Sprint B-2
 *
 * Calculates the retention_until date for sensitive documents based on Australian
 * legal requirements:
 *   - Tax invoices / receipts: 5 years (ATO)
 *   - Contracts / leases: 7 years (state tenancy laws)
 *   - ID/visa documents: 30 days (APP 11 — destroy after purpose fulfilled)
 *   - Other: 2 years (default)
 */
export const RETENTION_DAYS: Record<string, number> = {
  tax_invoice: 365 * 5,
  contract: 365 * 7,
  receipt: 365 * 5,
  id_document: 30,
  visa_document: 30,
  // Business cards are business contact details deliberately handed over, kept
  // for the life of the commercial relationship rather than destroyed at 30 days
  // like identity documents.
  business_card_front: 365 * 5,
  business_card_back: 365 * 5,
  // Property paperwork (등기부등본, 건축물대장, title deeds, strata certificates)
  // evidences the tenancy it was relied on for, so it follows the contract's
  // 7-year term rather than the 2-year default.
  property_document: 365 * 7,
  other: 365 * 2,
};

/**
 * Corporate paperwork (business registration certificate, bank passbook copy,
 * company seal certificate, property title deeds …) is company record-keeping,
 * not personal information — APP 11 destruction does not apply and the business
 * must be able to produce it for the life of the entity. Stored with a
 * far-future retention date so the purge job never touches it; deletion stays a
 * deliberate manual act.
 */
export const PERMANENT_RETENTION_YEARS = 100;

export function permanentRetentionDate(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setFullYear(d.getFullYear() + PERMANENT_RETENTION_YEARS);
  return d;
}

export function calcRetentionDate(docType: string, from: Date = new Date()): Date {
  const days = RETENTION_DAYS[docType] ?? RETENTION_DAYS["other"];
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}

export function isExpired(retentionUntil: Date | string): boolean {
  const dt = typeof retentionUntil === "string" ? new Date(retentionUntil) : retentionUntil;
  return dt.getTime() < Date.now();
}
