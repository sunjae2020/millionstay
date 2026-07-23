/* Shared currency helpers for property-admin.
 * The tenant's active currency + position come from branding settings
 * (Design & Branding → Format). Use `useBrand()` to read them at runtime. */

const SYMBOL: Record<string, string> = {
  KRW: "₩",
  AUD: "A$",
  USD: "$",
  NZD: "NZ$",
  GBP: "£",
  EUR: "€",
  SGD: "S$",
  MYR: "RM",
  CNY: "¥",
  JPY: "¥",
};

/** Currencies conventionally shown with no decimal places. */
const ZERO_DECIMAL = new Set(["KRW", "JPY"]);

export function currencySymbol(currency: string): string {
  return SYMBOL[currency] ?? currency;
}

/** Format an amount with the tenant's currency symbol and prefix/suffix position. */
export function formatMoney(
  amount: number | string | null | undefined,
  currency = "AUD",
  position: string = "prefix",
): string {
  const n = Number(amount ?? 0);
  const sym = currencySymbol(currency);
  const digits = ZERO_DECIMAL.has(currency) ? 0 : 2;
  const value = n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return position === "suffix" ? `${value}${sym}` : `${sym}${value}`;
}
