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
  THB: "฿",
  PHP: "₱",
  VND: "₫",
};

/** Currencies conventionally shown with no decimal places. */
const ZERO_DECIMAL = new Set(["KRW", "JPY", "THB", "PHP", "VND"]);

/**
 * Currencies a price may be denominated in when registering a product/service.
 * Kept in sync with the api-server `SUPPORTED_CURRENCIES` list. Used to populate
 * currency <select> dropdowns; render each as its `code`. KRW leads so the
 * tenant default (Metheim → KRW) is first.
 */
export const SUPPORTED_CURRENCIES: { code: string; name: string }[] = [
  { code: "KRW", name: "Korean Won" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "USD", name: "US Dollar" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "MYR", name: "Malaysian Ringgit" },
  { code: "GBP", name: "British Pound" },
  { code: "EUR", name: "Euro" },
  { code: "NZD", name: "New Zealand Dollar" },
  { code: "THB", name: "Thai Baht" },
  { code: "PHP", name: "Philippine Peso" },
  { code: "VND", name: "Vietnamese Dong" },
];

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
