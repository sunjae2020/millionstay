/**
 * Per-instance application name (white-label).
 *
 * Injected at build time via VITE_APP_NAME; defaults to MillionStay so the
 * primary instance is unaffected. Used directly in components and fed to
 * i18next as the `appName` interpolation variable so translation strings can
 * reference {{appName}} instead of hardcoding a brand.
 */
export const APP_NAME = import.meta.env.VITE_APP_NAME?.trim() || "MillionStay";
