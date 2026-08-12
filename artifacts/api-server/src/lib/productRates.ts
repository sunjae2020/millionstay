/**
 * Rate card for an accommodation product (숙박 패키지).
 *
 * The catalog stores at most two numbers — `weekly_rate` and `price` — and
 * `billing_frequency` says which unit `price` is quoted in (a Metheim 임대료
 * product prices per month; an Australian short-stay product per week). Screens
 * are expected to show all three units (일일 / 주간 / 월간), so the missing ones
 * are derived here, once, instead of each page inventing its own conversion.
 *
 * Conversions use the calendar year, not 4-week months:
 *   monthly = weekly × 52 / 12      daily = monthly × 12 / 365
 * Amounts are rounded to whole units for zero-decimal currencies (KRW, JPY, …)
 * and to cents otherwise, so nothing renders as ₩583333.3333333334.
 *
 * Mirrors property-admin/src/lib/productRates.ts — keep the two in sync.
 */

const ZERO_DECIMAL = new Set(["KRW", "JPY", "THB", "PHP", "VND"]);

export interface ProductRateInput {
  price?: number | string | null;
  weekly_rate?: number | string | null;
  currency?: string | null;
  billing_frequency?: string | null;
}

export interface ProductRates {
  currency: string;
  /** The unit the catalog price was actually entered in. */
  base_unit: "daily" | "weekly" | "monthly";
  daily: number | null;
  weekly: number | null;
  monthly: number | null;
}

function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function round(v: number | null, currency: string): number | null {
  if (v === null) return null;
  return ZERO_DECIMAL.has(currency) ? Math.round(v) : Math.round(v * 100) / 100;
}

export function productRates(p: ProductRateInput): ProductRates {
  const currency = p.currency || "AUD";
  const price = num(p.price);
  const weeklyCol = num(p.weekly_rate);
  const freq = (p.billing_frequency || "").toLowerCase();

  // `price` is quoted in the billing unit; Biweekly products still quote a
  // weekly figure (the fortnightly invoice is 2×), so only Monthly differs.
  const monthlyBased = freq === "monthly";
  const base_unit: ProductRates["base_unit"] = freq === "daily"
    ? "daily"
    : monthlyBased ? "monthly" : "weekly";

  let weekly: number | null = null;
  let monthly: number | null = null;

  if (base_unit === "monthly") {
    monthly = price ?? (weeklyCol !== null ? (weeklyCol * 52) / 12 : null);
    weekly = weeklyCol ?? (monthly !== null ? (monthly * 12) / 52 : null);
  } else if (base_unit === "daily") {
    const daily = price ?? (weeklyCol !== null ? weeklyCol / 7 : null);
    weekly = weeklyCol ?? (daily !== null ? daily * 7 : null);
    monthly = daily !== null ? (daily * 365) / 12 : null;
  } else {
    weekly = weeklyCol ?? price;
    monthly = weekly !== null ? (weekly * 52) / 12 : null;
  }

  const daily = monthly !== null ? (monthly * 12) / 365 : weekly !== null ? weekly / 7 : null;

  return {
    currency,
    base_unit,
    daily: round(daily, currency),
    weekly: round(weekly, currency),
    monthly: round(monthly, currency),
  };
}
