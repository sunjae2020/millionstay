/**
 * Per-instance site mode (white-label, spec §2.4 / development-site variant).
 *
 * A white-label instance that markets a single building/development (sales +
 * rent + owner management) instead of the standard multi-property booking
 * marketplace sets `VITE_SITE_MODE=development` at build time. The guest app
 * then serves the dedicated 4-part development site (Home / Buy / Rent /
 * Management) as its main site, while still mounting the shared booking, search,
 * space-detail and portal routes underneath so the short-term Rent flow works.
 *
 * Unset (primary MillionStay and most instances) → "standard" → behaviour
 * unchanged. In dev, `?dev=1` forces development mode so the new site can be
 * previewed on localhost (`?dev=0` forces it off), mirroring the homestay
 * subdomain's `?homestay=1` override.
 */
export type SiteMode = "standard" | "development";

const ENV_MODE = (import.meta.env.VITE_SITE_MODE ?? "").trim().toLowerCase();

export function getSiteMode(): SiteMode {
  if (typeof window !== "undefined") {
    const forced = new URLSearchParams(window.location.search).get("dev");
    if (forced != null) return forced !== "0" && forced !== "false" ? "development" : "standard";
  }
  return ENV_MODE === "development" ? "development" : "standard";
}

export function isDevelopmentSite(): boolean {
  return getSiteMode() === "development";
}
