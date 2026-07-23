/**
 * Per-instance default display currency (white-label, spec §2.3).
 *
 * Injected at build time via VITE_DEFAULT_CURRENCY. When set (e.g. `KRW` for the
 * MetHeim instance), the guest UI:
 *   1. defaults the display currency to it (instead of the browser-language
 *      heuristic), and
 *   2. treats the instance as single-currency — every price is shown in this
 *      currency (converted from the listing's base currency via live FX), so a
 *      Korean instance never surfaces A$/US$ on a listing card.
 *
 * Unset (primary MillionStay) → empty string → behaviour unchanged (each
 * listing shows its own base currency, with a converted "≈" reference line).
 */
export const DEFAULT_CURRENCY = (import.meta.env.VITE_DEFAULT_CURRENCY ?? "").trim().toUpperCase();

/** True when this instance is pinned to a single display currency. */
export const FORCE_DISPLAY_CURRENCY = DEFAULT_CURRENCY !== "";
