import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useDisplayCurrency, formatCurrencyAmount } from "@/contexts/DisplayCurrencyContext";
import { DEFAULT_CURRENCY } from "@/lib/defaultCurrency";

// Multi-currency reference display for a single-currency (white-label) instance.
// The listing price is quoted — and paid — in the instance base currency (Metheim
// → KRW, the 기준금액). To help international buyers, we ALSO show the same amount
// converted into the site's other languages' currencies (USD/JPY/CNY/THB/VND) as
// a non-binding reference, with a note that payment is in the base currency.
//
// It never converts free-text price labels — it only renders when a structured
// numeric `amount` (in the base currency) is available and FX rates are loaded,
// so it degrades to nothing on instances/listings without rate data.

// Comparison currencies, mirroring the site's supported languages (base excluded):
//   en → USD, ja → JPY, zh → CNY, th → THB, vi → VND   (ko → KRW is the base).
const COMPARISON_CURRENCIES = ["USD", "JPY", "CNY", "THB", "VND"];

export function PriceFxBreakdown({
  amount,
  baseCurrency = DEFAULT_CURRENCY || "KRW",
  showNote = true,
  className = "",
}: {
  amount: number | null | undefined;
  baseCurrency?: string;
  showNote?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const { convertPrice, rates } = useDisplayCurrency();
  const base = (baseCurrency || "KRW").toUpperCase();

  const converted = useMemo(() => {
    if (amount == null || !Number.isFinite(amount) || amount <= 0) return [];
    return COMPARISON_CURRENCIES.filter((c) => c !== base)
      .map((c) => {
        const v = convertPrice(amount, base, c);
        return v != null && Number.isFinite(v) ? { code: c, text: formatCurrencyAmount(v, c) } : null;
      })
      .filter((x): x is { code: string; text: string } => x !== null);
    // `rates` in deps so the list re-computes once FX rates load in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, base, convertPrice, rates]);

  if (converted.length === 0) return null;

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-500">
        {converted.map((c) => (
          <span key={c.code} className="whitespace-nowrap">
            ≈ {c.text}
          </span>
        ))}
      </div>
      {showNote && (
        <p className="mt-1.5 text-xs leading-relaxed text-gray-400">
          {t("dev.listing.fx_note")}
        </p>
      )}
    </div>
  );
}
