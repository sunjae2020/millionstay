import { pgTable, serial, text, real, integer, numeric, timestamp } from "drizzle-orm/pg-core";

export const promotionsTable = pgTable("promotions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code"),
  term_type: text("term_type").notNull().default("ShortTerm"),
  promotion_type: text("promotion_type").notNull().default("Percentage"),
  discount_percentage: real("discount_percentage"),
  discount_amount: numeric("discount_amount", { precision: 10, scale: 2 }),
  free_nights: integer("free_nights"),
  min_stay_weeks: integer("min_stay_weeks"),
  max_stay_weeks: integer("max_stay_weeks"),
  min_stay_nights: integer("min_stay_nights"),
  max_uses: integer("max_uses"),
  max_uses_per_account: integer("max_uses_per_account"),
  applicable_to: text("applicable_to").default("AllSpaces"),
  billing_frequency: text("billing_frequency").default("Biweekly"),
  valid_from: text("valid_from"),
  valid_to: text("valid_to"),
  description: text("description"),
  terms: text("terms"),
  status: text("status").notNull().default("Draft"),
  deleted_at: timestamp("deleted_at"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Promotion = typeof promotionsTable.$inferSelect;
export type InsertPromotion = typeof promotionsTable.$inferInsert;
