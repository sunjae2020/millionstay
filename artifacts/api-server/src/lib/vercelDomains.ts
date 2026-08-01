// Automatic per-owner subdomain provisioning on Vercel.
//
// Why per-subdomain instead of a wildcard: a `*.millionstay.com` cert needs
// DNS-01 validation, which Vercel can't automate while DNS lives on Cloudflare.
// But a SPECIFIC domain (e.g. harbourview.millionstay.com) gets an automatic
// HTTP-01 cert — exactly how owner./agent./admin. already work. DNS resolution
// for every slug is already handled by the `A * -> 76.76.21.21` wildcard record,
// so registering the domain on the project is the only step needed for SSL.
//
// Graceful degradation: with no VERCEL_TOKEN the helpers no-op (publishing still
// works; the subdomain just won't be auto-provisioned until the token is set).

const VERCEL_TOKEN = process.env["VERCEL_TOKEN"];
// millionstay-web project + team (overridable via env, sane defaults baked in).
const VERCEL_PROJECT_ID = process.env["VERCEL_PROJECT_ID"] ?? "prj_54Tw0KL1S5LIvecrUi8IHfvqEEuq";
const VERCEL_TEAM_ID = process.env["VERCEL_TEAM_ID"] ?? "team_VD0mxpPcMmO0IXw9XPlwhzyw";
// Per-instance apex for landing-site subdomains ({slug}.<ROOT_DOMAIN>).
// Defaults to millionstay.com; white-label instances override (spec §2.5).
const ROOT_DOMAIN = (process.env["ROOT_DOMAIN"] ?? "millionstay.com").trim().toLowerCase();

export function isVercelConfigured(): boolean {
  return !!VERCEL_TOKEN;
}

function fqdn(slug: string): string {
  return `${slug}.${ROOT_DOMAIN}`;
}

async function vercelFetch(path: string, init: RequestInit): Promise<Response> {
  const sep = path.includes("?") ? "&" : "?";
  // The team can be given as an id (team_…) or as the slug shown by the CLI;
  // Vercel takes them under different query names.
  const scope = VERCEL_TEAM_ID.startsWith("team_")
    ? `teamId=${VERCEL_TEAM_ID}`
    : `slug=${encodeURIComponent(VERCEL_TEAM_ID)}`;
  const url = `https://api.vercel.com${path}${sep}${scope}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    return await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${VERCEL_TOKEN}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Add `{slug}.millionstay.com` to the millionstay-web project so Vercel issues
 * an HTTP-01 cert for it. Idempotent — "already in use by this project" is a
 * success. Never throws (publishing must not fail on a provisioning hiccup).
 */
export async function registerOwnerSubdomain(slug: string): Promise<void> {
  if (!isVercelConfigured()) {
    console.warn(`[vercel] VERCEL_TOKEN not set — skipping domain register for ${fqdn(slug)}`);
    return;
  }
  const name = fqdn(slug);
  try {
    const res = await vercelFetch(`/v10/projects/${VERCEL_PROJECT_ID}/domains`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      console.log(`[vercel] registered domain ${name}`);
      return;
    }
    const body: any = await res.json().catch(() => ({}));
    const code = body?.error?.code;
    if (res.status === 409 || code === "domain_already_in_use" || code === "domain_already_exists") {
      console.log(`[vercel] domain ${name} already registered`);
      return;
    }
    console.error(`[vercel] register failed for ${name}: ${res.status} ${JSON.stringify(body?.error ?? body)}`);
  } catch (err) {
    console.error(`[vercel] register error for ${name}:`, err);
  }
}

/** Remove `{slug}.millionstay.com` from the project (on slug change / unpublish). */
export async function unregisterOwnerSubdomain(slug: string): Promise<void> {
  if (!isVercelConfigured() || !slug) return;
  const name = fqdn(slug);
  try {
    const res = await vercelFetch(`/v9/projects/${VERCEL_PROJECT_ID}/domains/${name}`, { method: "DELETE" });
    if (res.ok || res.status === 404) {
      console.log(`[vercel] removed domain ${name}`);
      return;
    }
    console.error(`[vercel] remove failed for ${name}: ${res.status}`);
  } catch (err) {
    console.error(`[vercel] remove error for ${name}:`, err);
  }
}

/**
 * Reconcile Vercel domains after an owner site is saved. Fire-and-forget:
 * callers should NOT await this on the request path.
 *   - published: ensure the (new) slug is registered
 *   - slug changed: drop the old slug
 *   - unpublished (draft): drop the slug
 */
export async function syncOwnerSubdomain(opts: {
  slug: string;
  status: string;
  previousSlug?: string | null;
  previousStatus?: string | null;
}): Promise<void> {
  const { slug, status, previousSlug } = opts;
  if (previousSlug && previousSlug !== slug) {
    await unregisterOwnerSubdomain(previousSlug);
  }
  if (status === "published") {
    await registerOwnerSubdomain(slug);
  } else if (previousSlug === slug || !previousSlug) {
    // Moved to draft (or created as draft) — make sure it isn't live.
    await unregisterOwnerSubdomain(slug);
  }
}


// ── CMS site domains ───────────────────────────────────────────────────────
//
// Setting a public address on a site (CMS -> Pages -> site settings) registers
// that hostname on the tenant's web project, so Vercel issues its certificate
// automatically instead of someone doing it by hand in the dashboard. Same
// mechanism as the owner subdomains above, but the caller supplies a full
// hostname rather than a slug.
//
// The target project is REQUIRED to be explicit. VERCEL_PROJECT_ID above falls
// back to the millionstay-web project so owner subdomains keep working on the
// primary instance — but silently inheriting that default here would register a
// second tenant's domain on MillionStay's project. So site-domain provisioning
// needs its own env and stays inert (with a clear message) when it is unset.

const SITE_PROJECT_ID = process.env["VERCEL_WEB_PROJECT_ID"] ?? "";

/** Strip scheme/path/port and lowercase — site settings accept a pasted URL. */
export function normaliseHostname(input: string | null | undefined): string {
  if (!input) return "";
  return String(input)
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "")
    .toLowerCase();
}

/**
 * Vercel's own preview hostnames are assigned by the platform and cannot be
 * added as project domains — trying returns 403 and would only produce noise.
 */
export function isPlatformHostname(host: string): boolean {
  return host.endsWith(".vercel.app") || host === "localhost";
}

/** Why site-domain provisioning cannot run right now, or "" when it can. */
function siteProvisioningIssue(): string {
  if (!VERCEL_TOKEN) return "VERCEL_TOKEN not set";
  if (!SITE_PROJECT_ID) return "VERCEL_WEB_PROJECT_ID not set";
  return "";
}

export interface DomainStatus {
  host: string;
  /** "unconfigured" when there is no token/host to check. */
  state: "unconfigured" | "platform" | "verified" | "pending" | "error";
  /** DNS records the operator must add, when Vercel says the domain is pending. */
  records?: { type: string; domain: string; value: string }[];
  message?: string;
}

/** Register `host` on the web project. Idempotent; never throws. */
export async function registerSiteDomain(host: string): Promise<DomainStatus> {
  const name = normaliseHostname(host);
  if (!name) return { host: "", state: "unconfigured" };
  if (isPlatformHostname(name)) return { host: name, state: "platform" };
  const guard = siteProvisioningIssue();
  if (guard) {
    console.warn(`[vercel] ${guard} — skipping domain register for ${name}`);
    return { host: name, state: "unconfigured", message: guard };
  }
  try {
    const res = await vercelFetch(`/v10/projects/${SITE_PROJECT_ID}/domains`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    const body: any = await res.json().catch(() => ({}));
    if (res.ok) {
      console.log(`[vercel] registered site domain ${name}`);
      return await getSiteDomainStatus(name);
    }
    const code = body?.error?.code;
    if (res.status === 409 || code === "domain_already_in_use" || code === "domain_already_exists") {
      return await getSiteDomainStatus(name);
    }
    console.error(`[vercel] site domain register failed for ${name}: ${res.status} ${JSON.stringify(body?.error ?? body)}`);
    return { host: name, state: "error", message: body?.error?.message ?? `HTTP ${res.status}` };
  } catch (err) {
    console.error(`[vercel] site domain register error for ${name}:`, err);
    return { host: name, state: "error", message: err instanceof Error ? err.message : "failed" };
  }
}

/** Remove `host` from the web project (called when the address changes). */
export async function unregisterSiteDomain(host: string): Promise<void> {
  const name = normaliseHostname(host);
  if (!name || isPlatformHostname(name) || siteProvisioningIssue()) return;
  try {
    const res = await vercelFetch(`/v9/projects/${SITE_PROJECT_ID}/domains/${name}`, { method: "DELETE" });
    if (!res.ok && res.status !== 404) {
      console.error(`[vercel] site domain remove failed for ${name}: ${res.status}`);
    }
  } catch (err) {
    console.error(`[vercel] site domain remove error for ${name}:`, err);
  }
}

/**
 * Whether the domain is live, and if not, exactly which DNS record is missing —
 * so the admin can show the operator what to add rather than "not working".
 */
export async function getSiteDomainStatus(host: string): Promise<DomainStatus> {
  const name = normaliseHostname(host);
  if (!name) return { host: "", state: "unconfigured" };
  if (isPlatformHostname(name)) return { host: name, state: "platform" };
  const guard = siteProvisioningIssue();
  if (guard) return { host: name, state: "unconfigured", message: guard };
  try {
    const res = await vercelFetch(`/v9/projects/${SITE_PROJECT_ID}/domains/${name}`, { method: "GET" });
    if (res.status === 404) {
      return { host: name, state: "pending", message: "not registered" };
    }
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { host: name, state: "error", message: body?.error?.message ?? `HTTP ${res.status}` };
    }
    if (body?.verified) return { host: name, state: "verified" };
    const records = Array.isArray(body?.verification)
      ? body.verification.map((v: any) => ({ type: v.type, domain: v.domain, value: v.value }))
      : [];
    return { host: name, state: "pending", records };
  } catch (err) {
    return { host: name, state: "error", message: err instanceof Error ? err.message : "failed" };
  }
}

/** Reconcile after a site's address is edited. Fire-and-forget. */
export async function syncSiteDomain(host: string, previousHost?: string | null): Promise<void> {
  const next = normaliseHostname(host);
  const prev = normaliseHostname(previousHost);
  if (prev && prev !== next) await unregisterSiteDomain(prev);
  if (next) await registerSiteDomain(next);
}
