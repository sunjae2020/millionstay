import { pgTable, serial, text, integer, numeric, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// 분양(pre-sale) / 판매(sale) property listings for the single-building
// "development" site (MetHeim). Admin-managed board: each row is one unit/model
// posted on /buy, opening a detail page with its own inquiry form. Structural
// fields are locale-independent; per-locale copy (title/subtitle/location/
// price_label/description) lives in `translations` keyed by language code.
export const saleListingsTable = pgTable("sale_listings", {
  id: serial("id").primaryKey(),
  category: text("category").notNull().default("presale"), // "presale" (분양) | "sale" (판매)
  status: text("status").notNull().default("available"),   // available | reserved | sold
  cover_image: text("cover_image"),
  gallery: jsonb("gallery").default([]),                    // string[] of image URLs
  area_m2: numeric("area_m2", { precision: 10, scale: 2 }), // 전용면적 — Drizzle returns string
  bedrooms: integer("bedrooms"),
  bathrooms: integer("bathrooms"),
  price_amount: numeric("price_amount", { precision: 14, scale: 2 }), // optional structured price
  sort_order: integer("sort_order").notNull().default(0),
  published: boolean("published").notNull().default(false),
  // { [lang]: { title, subtitle, location, price_label, description } }
  translations: jsonb("translations").default({}),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSaleListingSchema = createInsertSchema(saleListingsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertSaleListing = z.infer<typeof insertSaleListingSchema>;
export type SaleListing = typeof saleListingsTable.$inferSelect;
