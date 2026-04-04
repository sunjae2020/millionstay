import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const spaceOptionsTable = pgTable("space_options", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  display_name: text("display_name"),
  category: text("category"),
  status: text("status").notNull().default("Active"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSpaceOptionSchema = createInsertSchema(spaceOptionsTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export type InsertSpaceOption = z.infer<typeof insertSpaceOptionSchema>;
export type SpaceOption = typeof spaceOptionsTable.$inferSelect;
