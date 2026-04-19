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
  other: 365 * 2,
};

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
