/**
 * Tenant-default currency for generated documents.
 *
 * MillionStay leaves `DEFAULT_CURRENCY` unset → "AUD"; a Korea instance sets
 * `DEFAULT_CURRENCY=KRW` in its config.env so every generated document, invoice,
 * receipt, quote and sample fixture whose own currency is blank falls back to
 * the tenant currency instead of the hard-coded AUD. Read once at module load —
 * fixed for the process lifetime.
 */
export const DEFAULT_CURRENCY: string = (process.env.DEFAULT_CURRENCY || "AUD").toUpperCase();
