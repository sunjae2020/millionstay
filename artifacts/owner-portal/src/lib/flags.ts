/**
 * Per-instance owner-portal feature flags (white-label).
 *
 * Toggled at build time via VITE_* env. Defaults preserve the primary
 * MillionStay behaviour; individual tenants opt out in their config.env.
 */

/**
 * Owner landing-site + inquiries module ("내 사이트" / "Inquiries").
 *
 * MillionStay owners run a public per-owner landing page (owner_sites) that
 * collects booking inquiries. Ledger-based tenants (e.g. Metheim, whose owners
 * are building unit owners, not marketplace hosts) have no use for it, so they
 * set VITE_OWNER_SITE_ENABLED=false to hide the nav entries, routes and the
 * dashboard promo/inquiry widgets.
 */
export const OWNER_SITE_ENABLED = import.meta.env.VITE_OWNER_SITE_ENABLED !== "false";
