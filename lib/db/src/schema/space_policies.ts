import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const spacePoliciesTable = pgTable("space_policies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  same_gender: boolean("same_gender").notNull().default(false),
  lady_only: boolean("lady_only").notNull().default(false),
  no_pet: boolean("no_pet").notNull().default(false),
  no_smoking: boolean("no_smoking").notNull().default(false),
  meal_option: boolean("meal_option").notNull().default(false),
  minimum_age: integer("minimum_age"),
  status: text("status").notNull().default("Active"),
  deleted_at: timestamp("deleted_at"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSpacePolicySchema = createInsertSchema(spacePoliciesTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export type InsertSpacePolicy = z.infer<typeof insertSpacePolicySchema>;
export type SpacePolicy = typeof spacePoliciesTable.$inferSelect;
