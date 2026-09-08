// ---------------------------------------------------------------------------
// Where a CMS page actually lives on the public site.
//
// A page's slug and its public address are not always the same string. The
// Metheim site names its persona pages after the audience (`/for-resident`)
// while the CMS page that fills them is called `resident`, and `/stay-plan`
// is stored as `stayplan`. Publishing the slug as a URL would put addresses in
// sitemap.xml that render the site's not-found screen, which is worse than
// publishing no sitemap at all.
//
// This map is the single source of truth for that translation. The guest site's
// router (artifacts/million-stay-web/src/pages/development/DevRouter.tsx) is
// what it has to agree with; scripts/prerender-share-meta.mjs reads it from the
// API rather than keeping a second copy.
// ---------------------------------------------------------------------------

/** slug → public path, for sites whose routes differ from their slugs. */
const PATH_BY_SITE: Record<string, Record<string, string>> = {
  dev: {
    manage: "/management",
    stayplan: "/stay-plan",
    resident: "/for-resident",
    owner: "/for-owner",
    partner: "/for-partner",
    privacy: "/privacy-policy",
  },
};

/** The public address of one CMS page. Falls back to `/{slug}`. */
export function publicPathForPage(siteKey: string, slug: string): string {
  const clean = (slug ?? "").replace(/^\/+/, "");
  if (!clean || clean === "home") return "/";
  const mapped = PATH_BY_SITE[siteKey]?.[clean];
  if (mapped) return mapped;
  return `/${clean}`;
}
