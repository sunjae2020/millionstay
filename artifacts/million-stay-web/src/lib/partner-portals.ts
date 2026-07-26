// Cross-domain hand-off for the unified partner login on the landing site.
//
// Each partner portal (agent / owner / service_host) is a SEPARATE deployment
// on its own origin, so localStorage is not shared with the landing site. After
// the partner authenticates here we redirect to the correct portal and pass the
// freshly minted token in the URL fragment (#sso=...). The fragment is never
// sent to a server; the portal's AuthProvider reads it on mount, stores it as
// `partner_token`, and strips it from the URL.
//
// Portal bases resolve from per-tenant Vite env (baked at build time by
// scripts/redeploy-tenant-frontends.sh from tenants/<tenant>/config.env). When
// unset — the primary MillionStay build on millionstay.com — the hardcoded
// production subdomains apply.
export type PartnerPortalType = "agent" | "owner" | "service_host";

export const PARTNER_PORTAL_TYPES: PartnerPortalType[] = ["agent", "owner", "service_host"];

const DEFAULT_PORTAL_URLS: Record<PartnerPortalType, string> = {
  agent: "https://agent.millionstay.com",
  owner: "https://owner.millionstay.com",
  service_host: "https://services.millionstay.com",
};

function envPortalUrl(type: PartnerPortalType): string {
  switch (type) {
    case "agent": return (import.meta.env.VITE_AGENT_PORTAL_URL ?? "").trim();
    case "owner": return (import.meta.env.VITE_OWNER_PORTAL_URL ?? "").trim();
    case "service_host": return (import.meta.env.VITE_SERVICE_HOST_PORTAL_URL ?? "").trim();
  }
}

export function isPartnerPortalType(type: string): type is PartnerPortalType {
  return type === "agent" || type === "owner" || type === "service_host";
}

/** Origin (no trailing slash) of a partner portal, or null for an unknown type. */
export function partnerPortalBase(type: string): string | null {
  if (!isPartnerPortalType(type)) return null;
  const base = envPortalUrl(type) || DEFAULT_PORTAL_URLS[type];
  return base ? base.replace(/\/$/, "") : null;
}

/** URL that logs the partner straight into their portal via SSO hand-off. */
export function partnerPortalLoginUrl(type: string, token: string): string | null {
  const base = partnerPortalBase(type);
  return base ? `${base}/#sso=${encodeURIComponent(token)}` : null;
}

/**
 * Public "apply to join" entry for a partner type. Sign-up is application →
 * admin approval (not self-service), so this deep-links to the portal's /apply
 * lead form.
 */
export function partnerApplyUrl(type: PartnerPortalType): string | null {
  const base = partnerPortalBase(type);
  return base ? `${base}/apply` : null;
}
