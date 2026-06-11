// Owner landing sites — client helpers for the per-owner public page served at
// {slug}.millionstay.com. Detects the tenant subdomain and talks to the
// /public/sites/:slug endpoints (config, owner-scoped search, inquiry).
import { useQuery } from "@tanstack/react-query";
import { apiFetch, type SpaceSummary, type PublicSpacesParams } from "./guest-api";

const ROOT_DOMAIN = "millionstay.com";

// Mirror of the server-side reserved list — these subdomains belong to the
// platform's own apps/infra and must never be treated as an owner slug.
const RESERVED = new Set<string>([
  "admin", "www", "app", "api", "owner", "agent", "host", "service-host",
  "owner-portal", "agent-portal", "service-host-portal", "property-admin",
  "static", "assets", "cdn", "mail", "smtp", "ftp", "dev", "staging", "test",
  "public", "dashboard", "portal", "support", "help", "account", "accounts",
  "booking", "bookings", "search", "login", "register", "auth", "blog",
  "millionstay", "status", "docs",
]);

/**
 * The owner-site slug for the current request, or null when this is the main
 * site / a reserved subdomain. In dev, `?site=<slug>` forces a slug so the
 * landing can be previewed on localhost.
 */
export function getOwnerSiteSlug(): string | null {
  if (typeof window === "undefined") return null;

  const forced = new URLSearchParams(window.location.search).get("site");
  if (forced) return forced.trim().toLowerCase() || null;

  const host = window.location.hostname;
  if (!host.endsWith("." + ROOT_DOMAIN)) return null;

  const label = host.slice(0, host.length - ROOT_DOMAIN.length - 1).split(".")[0].toLowerCase();
  if (!label || RESERVED.has(label)) return null;
  return label;
}

export interface OwnerSiteContent {
  hero_title?: string;
  hero_subtitle?: string;
  about?: string;
  contact_email?: string;
  contact_phone?: string;
}

export interface OwnerSiteConfig {
  slug: string;
  logo_url: string | null;
  primary_color: string;
  hero_image_url: string | null;
  content: Record<string, OwnerSiteContent>;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
  space_count: number;
}

/** Pick the best content variant for the requested language, with fallbacks. */
export function pickContent(content: Record<string, OwnerSiteContent>, lang: string): OwnerSiteContent {
  if (!content) return {};
  const short = (lang || "en").slice(0, 2);
  return content[short] ?? content["en"] ?? content[Object.keys(content)[0]] ?? {};
}

export function useOwnerSite(slug: string) {
  return useQuery({
    queryKey: ["owner-site", slug],
    queryFn: () => apiFetch<{ success: boolean; data: OwnerSiteConfig }>(`/public/sites/${encodeURIComponent(slug)}`),
    retry: 0,
  });
}

export function useOwnerSiteSpaces(slug: string, params: PublicSpacesParams, enabled = true) {
  return useQuery({
    queryKey: ["owner-site-spaces", slug, params],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (params.space_type) qs.set("space_type", params.space_type);
      if (params.gender_policy) qs.set("gender_policy", params.gender_policy);
      if (params.min_price != null) qs.set("min_price", String(params.min_price));
      if (params.max_price != null) qs.set("max_price", String(params.max_price));
      if (params.start_date) qs.set("start_date", params.start_date);
      if (params.end_date) qs.set("end_date", params.end_date);
      if (params.limit != null) qs.set("limit", String(params.limit));
      if (params.offset != null) qs.set("offset", String(params.offset));
      const q = qs.toString();
      return apiFetch<{ success: boolean; data: SpaceSummary[]; meta?: { total: number } }>(
        `/public/sites/${encodeURIComponent(slug)}/spaces${q ? `?${q}` : ""}`,
      );
    },
    enabled,
  });
}

export interface OwnerInquiry {
  name: string;
  email: string;
  phone?: string;
  message?: string;
}

export function submitOwnerInquiry(slug: string, body: OwnerInquiry) {
  return apiFetch<{ success: boolean; lead_ref: string }>(
    `/public/sites/${encodeURIComponent(slug)}/inquiry`,
    { method: "POST", body: JSON.stringify(body) },
  );
}
