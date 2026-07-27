/**
 * App-wide money formatting for the partner portal.
 *
 * An amount is shown in the currency the record carries; when a record has no
 * currency, it falls back to the tenant's default (`VITE_DEFAULT_CURRENCY`,
 * baked at build time — e.g. `KRW` for Metheim). This mirrors
 * property-admin/src/lib/currency.ts so every surface formats money the same way,
 * and it never hardcodes A$/AUD. Portals have no live FX, so we display the
 * record's own currency (Metheim data is stored in KRW) rather than converting.
 */
const DEFAULT_CURRENCY =
  (import.meta.env.VITE_DEFAULT_CURRENCY ?? "AUD").trim().toUpperCase() || "AUD";

const SYMBOL: Record<string, string> = {
  KRW: "₩", AUD: "A$", USD: "$", NZD: "NZ$", GBP: "£",
  EUR: "€", SGD: "S$", MYR: "RM", CNY: "¥", JPY: "¥",
};

/** Currencies conventionally shown with no decimal places. */
const ZERO_DECIMAL = new Set(["KRW", "JPY"]);

export function currencySymbol(currency: string): string {
  return SYMBOL[currency] ?? currency;
}

/** Format an amount with its currency symbol (record currency, else tenant default). */
export function formatMoney(
  amount: number | string | null | undefined,
  currency?: string | null,
): string {
  const ccy = currency && String(currency).trim()
    ? String(currency).trim().toUpperCase()
    : DEFAULT_CURRENCY;
  const n = Number(amount ?? 0);
  const digits = ZERO_DECIMAL.has(ccy) ? 0 : 2;
  const value = n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${currencySymbol(ccy)}${value}`;
}
