import { pgTable, serial, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ---------------------------------------------------------------------------
// Owner landing sites — one independent public landing page per owner account,
// served at "{slug}.millionstay.com". A single row per owner account holds the
// branding, SEO and the language-keyed content blob the one-page landing renders.
//
// Search isolation ("only this owner's accommodation") needs NO column here —
// it is derived at query time from properties.owner_account_id = account_id.
// ---------------------------------------------------------------------------

export const ownerSitesTable = pgTable("owner_sites", {
  id: serial("id").primaryKey(),
  // One landing site per owner account.
  account_id: integer("account_id").notNull().unique(), // → accounts.id (owner)
  // Subdomain label, e.g. "harbourview" → harbourview.millionstay.com. Unique.
  slug: text("slug").notNull().unique(),
  // 'draft' hides the site from the public; 'published' makes it live.
  status: text("status").notNull().default("published"),
  // Branding
  logo_url: text("logo_url"),
  primary_color: text("primary_color").notNull().default("#0ea5e9"),
  hero_image_url: text("hero_image_url"),
  // Language-keyed content the landing renders, e.g.
  //   { en: { hero_title, hero_subtitle, about, contact_email, contact_phone },
  //     ko: { ... } }
  // Stored as JSONB so adding a language never needs a migration.
  content: jsonb("content").notNull().default({}),
  // SEO / Open Graph
  seo_title: text("seo_title"),
  seo_description: text("seo_description"),
  og_image_url: text("og_image_url"),
  // Future: owner's own mapped domain (e.g. stay.example.com).
  custom_domain: text("custom_domain"),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertOwnerSiteSchema = createInsertSchema(ownerSitesTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertOwnerSite = z.infer<typeof insertOwnerSiteSchema>;
export type OwnerSite = typeof ownerSitesTable.$inferSelect;

// ---------------------------------------------------------------------------
// Slug rules — shared by the API (PUT /owner/site, slug-available) so the
// subdomain stays a valid, safe DNS label and never collides with a reserved
// hostname the platform already routes (admin, www, api, owner-portal, …).
// ---------------------------------------------------------------------------

// 3–32 chars, lowercase letters/digits/hyphen, no leading/trailing hyphen.
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;

// Hostnames the platform reserves for its own apps / infra. A slug equal to any
// of these must be rejected so it can never shadow a real subdomain.
export const RESERVED_SLUGS = new Set<string>([
  "admin", "www", "app", "api", "owner", "agent", "host", "service-host",
  "owner-portal", "agent-portal", "service-host-portal", "property-admin",
  "static", "assets", "cdn", "mail", "smtp", "ftp", "dev", "staging", "test",
  "public", "dashboard", "portal", "support", "help", "account", "accounts",
  "booking", "bookings", "search", "login", "register", "auth", "blog",
  "millionstay", "status", "docs",
]);

/** Returns null when valid, otherwise a machine-readable reason code. */
export function validateSlug(raw: string): "too_short" | "invalid_format" | "reserved" | null {
  const slug = (raw ?? "").trim().toLowerCase();
  if (slug.length < 3) return "too_short";
  if (!SLUG_PATTERN.test(slug)) return "invalid_format";
  if (RESERVED_SLUGS.has(slug)) return "reserved";
  return null;
}
