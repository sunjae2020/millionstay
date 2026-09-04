// Which browser origins this API trusts. Shared by the CORS allow-list (app.ts)
// and by WebAuthn, which must pin `expectedOrigin` to the same set — a passkey
// assertion is only meaningful if the origin that produced it is one of ours.

const isProduction = process.env["NODE_ENV"] === "production";

const ALLOWED_ORIGINS = (process.env["ALLOWED_ORIGINS"] ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Per-instance apex domain. Owner landing sites create arbitrary
// {slug}.<ROOT_DOMAIN> origins, so the apex + all its subdomains are trusted
// over https. Defaults to millionstay.com for the primary instance; white-label
// instances set ROOT_DOMAIN to their own apex (spec §2.1/§2.5).
export const ROOT_DOMAIN = (process.env["ROOT_DOMAIN"] ?? "millionstay.com").trim().toLowerCase();

export function isOriginAllowed(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  try {
    const { hostname, protocol } = new URL(origin);
    // Always allow our own apex + ANY subdomain over https. Authenticated routes
    // are still gated by JWT, so trusting the apex + subdomains here is safe.
    if (protocol === "https:" && (hostname === ROOT_DOMAIN || hostname.endsWith(`.${ROOT_DOMAIN}`))) {
      return true;
    }
    if (isProduction) return false;
    // Dev-only allowances
    if (protocol !== "http:" && protocol !== "https:") return false;
    if (hostname === "localhost" || hostname === "127.0.0.1") return true;
    return false;
  } catch {
    return false;
  }
}
