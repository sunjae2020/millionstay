import { pgTable, pgEnum, serial, text, integer, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ---------------------------------------------------------------------------
// Accommodation classification enums
//
// These are CLOSED sets that describe how a short-stay accommodation product is
// classified. They are modelled as Postgres enums (single source of truth for
// the app + DB). Homestay-specific dimensions (meal_plan, guest_age) only carry
// meaning when room_type = 'homestay'; for every other room type they stay NULL.
//
//   contract_term : how long / what kind of contract the stay is under
//   room_type     : the physical sharing arrangement of the space
//   meal_plan     : homestay meal coverage (homestay only)
//   guest_age     : homestay guest age band (homestay only)
//
// Add-on services (airport pickup, SIM, etc.) are an OPEN, priced catalogue and
// therefore live in the admin-managed `addon_services` TABLE below — not an enum.
// ---------------------------------------------------------------------------

export const contractTermEnum = pgEnum("contract_term", [
  "short_term", // 단기  — 1 night ~ 4 weeks
  "mid_term",   // 중기  — 1 ~ 6 months
  "long_term",  // 장기  — 6 months ~ 1 year+
]);

export const roomTypeEnum = pgEnum("room_type", [
  "room_share",   // 룸 쉐어   — a single room shared by 2+ guests
  "house_share",  // 하우스 쉐어 — private room, shared common areas
  "entire_place", // 전체 렌트  — whole unit, no sharing
  "homestay",     // 홈스테이   — live with host, private room (default)
]);

export const mealPlanEnum = pgEnum("meal_plan", [
  "none",          // 미제공
  "partial_board", // 부분 제공 — weekday 2 meals (breakfast, dinner), weekend/holiday 3 meals
  "full_board",    // 풀보드   — 7 days × 3 meals
]);

export const guestAgeEnum = pgEnum("guest_age", [
  "adult", // 성인       — over 18
  "minor", // 미성년자(Under 18) — 18 or under
]);

// Canonical option-value lists (handy for seeding, validation and UI loops).
export const CONTRACT_TERMS = contractTermEnum.enumValues;
export const ROOM_TYPES = roomTypeEnum.enumValues;
export const MEAL_PLANS = mealPlanEnum.enumValues;
export const GUEST_AGES = guestAgeEnum.enumValues;

// ---------------------------------------------------------------------------
// Add-on services catalogue (table) — services sold ON TOP OF the accommodation:
// airport pickup/drop-off, initial settlement support, extra linen, prepaid SIM…
// Admin-managed (CRUD) so new add-ons can be introduced without a code change.
// ---------------------------------------------------------------------------

export const addonServicesTable = pgTable("addon_services", {
  id: serial("id").primaryKey(),
  // Stable machine code, e.g. "airport_pickup". Used by code/i18n; unique.
  code: text("code").notNull().unique(),
  name: text("name").notNull(), // human label, e.g. "Airport Pickup"
  description: text("description"),
  // Grouping for the UI: transport | living | supplies | telecom | other
  category: text("category").notNull().default("other"),
  base_price: numeric("base_price", { precision: 12, scale: 2, mode: "number" }),
  currency: text("currency").notNull().default("AUD"),
  // Pricing unit: per_booking | per_trip | per_week | per_item | per_month
  unit: text("unit").notNull().default("per_booking"),
  is_active: boolean("is_active").notNull().default(true),
  sort_order: integer("sort_order").notNull().default(0),
  deleted_at: timestamp("deleted_at"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

// Junction: which add-on services are attached to a given accommodation product,
// with an optional price override and a flag for "bundled / already included".
export const accommodationAddonsTable = pgTable("accommodation_addons", {
  id: serial("id").primaryKey(),
  accommodation_id: integer("accommodation_id").notNull(), // → accommodation_catalog.id
  addon_service_id: integer("addon_service_id").notNull(), // → addon_services.id
  price_override: numeric("price_override", { precision: 12, scale: 2, mode: "number" }),
  is_included: boolean("is_included").notNull().default(false), // true = bundled, no extra charge
  sort_order: integer("sort_order").notNull().default(0),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAddonServiceSchema = createInsertSchema(addonServicesTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertAddonService = z.infer<typeof insertAddonServiceSchema>;
export type AddonService = typeof addonServicesTable.$inferSelect;

export type AccommodationAddon = typeof accommodationAddonsTable.$inferSelect;
export type InsertAccommodationAddon = typeof accommodationAddonsTable.$inferInsert;

// Convenience union types for the closed enums.
export type ContractTerm = (typeof CONTRACT_TERMS)[number];
export type RoomType = (typeof ROOM_TYPES)[number];
export type MealPlan = (typeof MEAL_PLANS)[number];
export type GuestAge = (typeof GUEST_AGES)[number];
