import { pgTable, serial, text, integer, real, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { contractTermEnum, roomTypeEnum, mealPlanEnum, guestAgeEnum } from "./accommodation_options";

export const accommodationCatalogTable = pgTable("accommodation_catalog", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  item_description: text("item_description"),
  product_group_id: integer("product_group_id"),
  product_type_id: integer("product_type_id"),
  space_id: integer("space_id"),
  price: numeric("price", { precision: 12, scale: 2, mode: "number" }),
  weekly_rate: numeric("weekly_rate", { precision: 12, scale: 2, mode: "number" }),
  currency: text("currency").notNull().default("AUD"),
  product_tag: text("product_tag"),
  gst_included: boolean("gst_included").notNull().default(false),
  promotion_id: integer("promotion_id"),
  commission_id: integer("commission_id"),
  product_source_account_id: integer("product_source_account_id"),
  product_provider_account_id: integer("product_provider_account_id"),
  min_contract_period: integer("min_contract_period"),
  min_contract_period_unit: text("min_contract_period_unit"),
  max_stay_weeks: integer("max_stay_weeks"),
  billing_frequency: text("billing_frequency").default("Biweekly"),
  term_type: text("term_type"),
  // Short-stay classification (see accommodation_options.ts). All nullable/additive.
  contract_term: contractTermEnum("contract_term"),
  room_type: roomTypeEnum("room_type"),
  meal_plan: mealPlanEnum("meal_plan"),   // homestay only
  guest_age: guestAgeEnum("guest_age"),   // homestay only
  bond_amount: numeric("bond_amount", { precision: 12, scale: 2, mode: "number" }),
  bond_weeks: real("bond_weeks").default(4),
  advance_weeks: real("advance_weeks").default(2),
  admin_fee: numeric("admin_fee", { precision: 12, scale: 2, mode: "number" }),
  cleaning_fee: numeric("cleaning_fee", { precision: 12, scale: 2, mode: "number" }),
  includes_wifi: boolean("includes_wifi").notNull().default(false),
  includes_parking: boolean("includes_parking").notNull().default(false),
  includes_utilities: boolean("includes_utilities").notNull().default(false),
  includes_meals: boolean("includes_meals").notNull().default(false),
  includes_laundry: boolean("includes_laundry").notNull().default(false),
  includes_cleaning: boolean("includes_cleaning").notNull().default(false),
  extra_inclusions: text("extra_inclusions"),
  display_on_booking_page: boolean("display_on_booking_page").notNull().default(true),
  display_on_invoice: boolean("display_on_invoice").notNull().default(true),
  status: text("status").notNull().default("Active"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type AccommodationCatalog = typeof accommodationCatalogTable.$inferSelect;
export type InsertAccommodationCatalog = typeof accommodationCatalogTable.$inferInsert;
