import { pgTable, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ---------------------------------------------------------------------------
// Branding settings — a single global row per instance holding the runtime,
// admin-editable brand identity (colours, logo/favicon URLs, custom CSS,
// display preferences). This is the persistence layer behind the property-admin
// "Design & Branding" page: the build-time defaults in
// @workspace/design-tokens/brand.css set the initial look; this row overrides
// them at runtime for everyone (shared across admins/devices, unlike the old
// localStorage-only theme).
//
// Instance separation (white-label) is done at the DEPLOYMENT level (each
// instance has its own DB), so there is exactly one branding row here — keyed
// to the fixed SINGLETON_ID. Assets are stored as URLs (Cloudinary), not base64.
// ---------------------------------------------------------------------------

export const BRANDING_SINGLETON_ID = 1;

export const brandingSettingsTable = pgTable("branding_settings", {
  // Always 1 — enforces a single global row (upsert on conflict).
  id: integer("id").primaryKey().default(BRANDING_SINGLETON_ID),

  brand_name: text("brand_name"),

  // Colours are stored as hex (#RRGGBB); the client converts to the
  // `hsl(var(--x))` triplets applied at runtime. Defaults = MillionStay palette.
  primary_color: text("primary_color").notNull().default("#E8621A"), // Million Orange
  secondary_color: text("secondary_color").notNull().default("#16263F"), // Deep Navy
  accent_color: text("accent_color").notNull().default("#FAF5EC"), // Warm Cream
  sidebar_theme: text("sidebar_theme").notNull().default("dark"),

  // Logo / favicon assets — Cloudinary secure URLs (or data URLs when Cloudinary
  // is not configured, e.g. local dev). Dark variants are optional.
  logo_url: text("logo_url"),
  logo_dark_url: text("logo_dark_url"),
  favicon_url: text("favicon_url"),
  favicon_dark_url: text("favicon_dark_url"),

  custom_css: text("custom_css"),
  dark_mode: boolean("dark_mode").notNull().default(false),

  // Display preferences.
  date_format: text("date_format").notNull().default("DD/MM/YYYY"),
  currency: text("currency").notNull().default("AUD"),
  currency_position: text("currency_position").notNull().default("prefix"),

  updated_at: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertBrandingSettingsSchema = createInsertSchema(brandingSettingsTable).omit({
  id: true,
  updated_at: true,
});
export type InsertBrandingSettings = z.infer<typeof insertBrandingSettingsSchema>;
export type BrandingSettings = typeof brandingSettingsTable.$inferSelect;
