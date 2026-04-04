import { pgTable, serial, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const suburbsTable = pgTable("suburbs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  state: text("state"),
  postcode: text("postcode"),
  country_code: text("country_code").notNull(),
  area_name: text("area_name"),
  lat: real("lat"),
  lng: real("lng"),
  status: text("status").notNull().default("Active"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSuburbSchema = createInsertSchema(suburbsTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export type InsertSuburb = z.infer<typeof insertSuburbSchema>;
export type Suburb = typeof suburbsTable.$inferSelect;
