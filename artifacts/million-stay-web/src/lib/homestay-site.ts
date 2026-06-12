// Homestay subdomain — client helper for the homestay experience served at
// homestay.millionstay.com. Unlike owner sites (one landing per owner slug),
// "homestay" is a single, platform-owned subdomain, so it is treated as a
// reserved label (see RESERVED in ./owner-site) and detected explicitly here.
const ROOT_DOMAIN = "millionstay.com";
const HOMESTAY_LABEL = "homestay";

/**
 * True when the current request is the homestay subdomain
 * (homestay.millionstay.com). In dev, `?homestay=1` forces it so the homestay
 * landing can be previewed on localhost.
 */
export function isHomestaySubdomain(): boolean {
  if (typeof window === "undefined") return false;

  const forced = new URLSearchParams(window.location.search).get("homestay");
  if (forced != null) return forced !== "0" && forced !== "false";

  const host = window.location.hostname;
  if (!host.endsWith("." + ROOT_DOMAIN)) return false;
  const label = host.slice(0, host.length - ROOT_DOMAIN.length - 1).split(".")[0].toLowerCase();
  return label === HOMESTAY_LABEL;
}
