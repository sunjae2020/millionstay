import { pgTable, serial, integer, numeric, text, boolean, timestamp } from "drizzle-orm/pg-core";

// Per-space lease price options: multiple (deposit → monthly rent) tiers for one
// space, with an optional promotional monthly rate. Powers the 임대료 rate-card
// options table on the public rent listing (Metheim 여수). Higher deposit ⇒ lower
// monthly rent; `promo_monthly_rent` ("빨간색") holds the discounted monthly rate,
// kept separate from the standard `monthly_rent`. All additive / display-only —
// this does not feed the short-term booking engine (that stays on
// accommodation_catalog).
export const spaceRentOptionsTable = pgTable("space_rent_options", {
  id: serial("id").primaryKey(),
  space_id: integer("space_id").notNull(),
  deposit_amount: numeric("deposit_amount", { precision: 14, scale: 2, mode: "number" }).notNull(),
  monthly_rent: numeric("monthly_rent", { precision: 14, scale: 2, mode: "number" }).notNull(),
  // Discounted monthly rate ("프로모션"); null = no promotion on this tier.
  promo_monthly_rent: numeric("promo_monthly_rent", { precision: 14, scale: 2, mode: "number" }),
  currency: text("currency").notNull().default("KRW"),
  display_order: integer("display_order").notNull().default(0),
  // The headline tier surfaced as the space's "from" price.
  is_default: boolean("is_default").notNull().default(false),
  deleted_at: timestamp("deleted_at"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type SpaceRentOption = typeof spaceRentOptionsTable.$inferSelect;
export type InsertSpaceRentOption = typeof spaceRentOptionsTable.$inferInsert;
