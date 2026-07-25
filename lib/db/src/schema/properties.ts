import { pgTable, serial, text, real, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const propertiesTable = pgTable("properties", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  address2: text("address2"),
  city: text("city"),
  state: text("state"),
  postcode: text("postcode"),
  country_code: text("country_code"),
  lat: real("lat"),
  lng: real("lng"),
  approval_status: text("approval_status").notNull().default("Pending"),
  owner_account_id: integer("owner_account_id"),
  suburb_id: integer("suburb_id"),
  description: text("description"),
  // Per-locale copy for the guest site: { [lang]: { name, description, _source } }
  // where _source is "machine" (AI, unreviewed) or "human" (admin-reviewed).
  translations: jsonb("translations").default({}),
  deleted_at: timestamp("deleted_at"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPropertySchema = createInsertSchema(propertiesTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof propertiesTable.$inferSelect;
