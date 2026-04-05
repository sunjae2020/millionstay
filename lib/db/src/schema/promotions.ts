import { pgTable, serial, text, real, integer, timestamp } from "drizzle-orm/pg-core";

export const promotionsTable = pgTable("promotions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code"),
  promotion_type: text("promotion_type").notNull().default("Percentage"),
  discount_percentage: real("discount_percentage"),
  discount_amount: real("discount_amount"),
  free_nights: integer("free_nights"),
  valid_from: text("valid_from"),
  valid_to: text("valid_to"),
  min_stay_nights: integer("min_stay_nights"),
  max_uses: integer("max_uses"),
  max_uses_per_account: integer("max_uses_per_account"),
  applicable_to: text("applicable_to").default("AllSpaces"),
  description: text("description"),
  terms: text("terms"),
  status: text("status").notNull().default("Draft"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Promotion = typeof promotionsTable.$inferSelect;
export type InsertPromotion = typeof promotionsTable.$inferInsert;
