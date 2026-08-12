import { useTranslation } from "react-i18next";
import { LookupSelect, type LookupSelectProps, type LookupItem } from "@/components/LookupSelect";
import { formatMoney } from "@/lib/currency";

interface Rates {
  currency: string;
  base_unit: "daily" | "weekly" | "monthly";
  daily: number | null;
  weekly: number | null;
  monthly: number | null;
}

function str(item: LookupItem, key: string): string | null {
  const v = item[key];
  return typeof v === "string" && v.trim() ? v : null;
}

function num(item: LookupItem, key: string): number | null {
  const v = item[key];
  return typeof v === "number" ? v : null;
}

/**
 * 숙박 상품 picker.
 *
 * Rate-card products share names by design — Metheim 여수 has a dozen rows all
 * called "보증금 1000만원", one per 세대/타입, and the plain one-line lookup made
 * them indistinguishable. Each row therefore shows the whole commercial shape:
 * 공간 · 월세(기준 단위 강조) · 보증금 · 유형/기간 태그 · 설명.
 *
 * A drop-in replacement for LookupSelect against `/api/v1/lookup/products`.
 */
export function ProductLookupSelect(props: Omit<LookupSelectProps, "formatLabel" | "renderItem">) {
  const { t } = useTranslation();

  const ratesOf = (item: LookupItem): Rates | null => {
    const r = item["rates"];
    return r && typeof r === "object" ? (r as Rates) : null;
  };

  const unitLabel: Record<Rates["base_unit"], string> = {
    daily: t("product_lookup.per_day"),
    weekly: t("product_lookup.per_week"),
    monthly: t("product_lookup.per_month"),
  };

  // The closed field stays a single line: 이름 · 공간 · 기준요금.
  const formatLabel = (item: LookupItem) => {
    const name = str(item, "name");
    if (!name) return item.display;
    const rates = ratesOf(item);
    const base = rates ? rates[rates.base_unit] : null;
    return [
      name,
      str(item, "space_name"),
      base != null && rates ? `${formatMoney(base, rates.currency)}${unitLabel[rates.base_unit]}` : null,
    ].filter(Boolean).join(" · ");
  };

  const renderItem = (item: LookupItem) => {
    const name = str(item, "name");
    // An older API build returns display only — fall back rather than blank out.
    if (!name) return item.display;
    const rates = ratesOf(item);
    const deposit = num(item, "deposit_amount");
    const minPeriod = num(item, "min_contract_period");
    const minUnit = str(item, "min_contract_period_unit");
    const tags = [str(item, "space_type"), str(item, "product_tag"), str(item, "room_type"), str(item, "contract_term")].filter(Boolean);
    const inactive = (str(item, "status") ?? "Active") !== "Active";

    const rateChips = rates
      ? ([["monthly", t("product_lookup.monthly")], ["weekly", t("product_lookup.weekly")], ["daily", t("product_lookup.daily")]] as const)
          .filter(([unit]) => rates[unit] != null)
          .map(([unit, label]) => ({
            key: unit,
            label,
            value: formatMoney(rates[unit], rates.currency),
            base: rates.base_unit === unit,
          }))
      : [];

    return (
      <div className="space-y-1">
        <div className="flex items-start justify-between gap-2">
          <span className="font-medium">{name}</span>
          <span className="flex flex-wrap justify-end gap-1">
            {str(item, "space_name") && (
              <span className="bg-primary/10 text-primary text-[11px] px-1.5 py-0.5 rounded">{str(item, "space_name")}</span>
            )}
            {tags.map((tag) => (
              <span key={tag} className="bg-muted text-muted-foreground text-[11px] px-1.5 py-0.5 rounded">{tag}</span>
            ))}
            {inactive && (
              <span className="bg-amber-100 text-amber-700 text-[11px] px-1.5 py-0.5 rounded">{t("product_lookup.inactive")}</span>
            )}
          </span>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {rateChips.map((c) => (
            <span key={c.key} className={c.base ? "text-foreground font-medium" : undefined}>
              {c.label} {c.value}
            </span>
          ))}
          {deposit != null && deposit > 0 && (
            <span>{t("product_lookup.deposit")} {formatMoney(deposit, rates?.currency ?? "KRW")}</span>
          )}
          {minPeriod != null && minPeriod > 0 && (
            <span>
              {t("product_lookup.min_term", {
                count: minPeriod,
                unit: t(minUnit === "days" ? "product.unit_days" : minUnit === "months" ? "product.unit_months" : "product.unit_weeks"),
              })}
            </span>
          )}
        </div>
        {str(item, "item_description") && (
          <p className="text-xs text-muted-foreground line-clamp-2">{str(item, "item_description")}</p>
        )}
      </div>
    );
  };

  return <LookupSelect {...props} formatLabel={formatLabel} renderItem={renderItem} dialogClassName="max-w-xl" />;
}

export default ProductLookupSelect;
