/**
 * Per-instance listing price period (white-label).
 *
 * Injected at build time via VITE_PRICE_UNIT. Controls the "/ period" suffix
 * shown after a listing price on cards. A monthly-rental instance (e.g. MetHeim,
 * 월 단위 임대) sets `month` so cards read "₩500,000 / 월" instead of "/ 주".
 *
 * Values: `week` (default) | `month` | `day`.
 * Unset → `week` → behaviour unchanged for the primary MillionStay instance.
 */
export const PRICE_UNIT = (import.meta.env.VITE_PRICE_UNIT ?? "week").trim().toLowerCase();

/** i18n key for the price-period suffix, resolved from the instance's PRICE_UNIT. */
export const PRICE_UNIT_KEY =
  PRICE_UNIT === "month"
    ? "space.per_month"
    : PRICE_UNIT === "day"
      ? "space.per_day"
      : "space.per_week";
