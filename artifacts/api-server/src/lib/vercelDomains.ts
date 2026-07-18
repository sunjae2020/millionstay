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
  const url = `https://api.vercel.com${path}${sep}teamId=${VERCEL_TEAM_ID}`;
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
