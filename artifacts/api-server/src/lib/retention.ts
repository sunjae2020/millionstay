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
  // 날인한 원본 스캔 — 계약 그 자체의 증빙이므로 계약과 같은 7년.
  signed_contract: 365 * 7,
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

  // ── Korean tenancy paperwork ──────────────────────────────────────────
  //
  // Before these existed everything below landed in `other` and was destroyed
  // after 2 years — well inside the period the document is still evidence for.
  // Each one follows the obligation it evidences, not the file it arrived as.

  /** 중개대상물 확인·설명서 — issued with the lease, so it keeps the lease's term. */
  brokerage_disclosure: 365 * 7,
  /** 임대차 신고필증 — proof the tenancy was reported; outlives the tenancy. */
  lease_report: 365 * 7,
  /** 등기부등본 — the ownership the tenancy was signed against. */
  property_register: 365 * 7,
  /** 건축물대장 — as above, for the building itself. */
  building_ledger: 365 * 7,

  /** 관리비 정산서 — a financial record, so it matches invoices and receipts. */
  settlement_statement: 365 * 5,
  /** 입·퇴실 확인서 — the evidence a deposit dispute turns on. */
  move_in_out_report: 365 * 5,
  /** 하자·수선 내역 — defect liability runs for years after the work. */
  repair_record: 365 * 5,

  /**
   * 계좌·통장 사본 — financial personal information, kept only because the
   * deposit is refunded to it at the end of the tenancy.
   *
   * The right rule is "destroy once the deposit is returned", which this
   * day-based policy cannot express, so it is set to outlast a renewed lease
   * instead. Shortening it would delete the account details before the refund
   * they exist for and force us to collect them a second time — a worse privacy
   * outcome than keeping them. Revisit if a per-contract expiry lands.
   */
  bank_account_copy: 365 * 5,

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
