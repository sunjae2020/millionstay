/**
 * Display-masking for government identity numbers.
 *
 * 주민등록번호(Korean resident registration numbers) and passport numbers are
 * "고유식별정보" under Korean PIPA §24-3 (and sensitive PII under APP 11): they
 * may be stored for contract issuance, but a LIST endpoint has no business
 * dumping every customer's number to the browser. These helpers keep just
 * enough of the value for an admin to recognise the record ("901231-1******")
 * while the raw value stays server-side.
 *
 * Raw values remain available ONLY on the single-record detail endpoints
 * (GET /v1/contacts/:id, GET /v1/accounts/:id) which the edit forms and the
 * contract-issuance party cards round-trip, and inside server-side document
 * rendering (routes/contracts.ts reads the DB directly, not these routes).
 *
 * Follow-up (deliberately NOT in this pass): encryption at rest for
 * contacts.resident_no / contacts.passport_number / accounts.resident_no —
 * needs a migration + key management.
 */

/** 000000-0000000 (hyphen optional) → keep birthdate + gender digit. */
const RESIDENT_NO_RE = /^(\d{6}-?\d)\d{6}$/;

/**
 * Mask a 주민등록번호 for display: `901231-1234567` → `901231-1******`.
 * Values that don't match the standard shape are masked down to their first
 * two characters so a malformed entry never leaks more than a well-formed one.
 */
export function maskResidentNo(value: string | null | undefined): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const v = value.trim();
  const m = RESIDENT_NO_RE.exec(v);
  if (m) return `${m[1]}******`;
  return v.slice(0, 2) + "*".repeat(Math.max(v.length - 2, 4));
}

/** Mask a passport number for display: `M12345678` → `M12******`. */
export function maskPassportNo(value: string | null | undefined): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const v = value.trim();
  return v.slice(0, 3) + "*".repeat(Math.max(v.length - 3, 4));
}
