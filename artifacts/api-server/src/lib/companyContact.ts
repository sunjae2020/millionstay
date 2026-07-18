/**
 * Per-instance company contact details (white-label, spec §2.2/§2.6).
 *
 * Privacy/DSAR responses must show the *operating company's* contact, not a
 * hardcoded MillionStay address. Falls back to SUPPORT_EMAIL, then to the
 * MillionStay default so the primary instance is unaffected.
 */
export function getPrivacyContactEmail(): string {
  return (
    process.env["PRIVACY_CONTACT_EMAIL"] ??
    process.env["SUPPORT_EMAIL"] ??
    "privacy@millionstay.com"
  );
}
