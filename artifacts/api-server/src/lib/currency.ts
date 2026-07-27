/**
 * Tenant-wide default currency.
 *
 * Used as the fallback wherever an amount has no explicit currency (a null
 * `currency` column, an unpriced draft, a GL posting with no source currency…).
 * MillionStay leaves `DEFAULT_CURRENCY` unset → "AUD"; a Korea instance sets
 * `DEFAULT_CURRENCY=KRW` in its config.env so every generated document, invoice,
 * receipt and GL entry defaults to Korean won instead of Australian dollars.
 * Read once at module load — fixed for the life of the process.
 */
export const DEFAULT_CURRENCY: string = (process.env.DEFAULT_CURRENCY || "AUD").toUpperCase();
