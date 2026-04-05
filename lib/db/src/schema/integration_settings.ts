import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const integrationSettings = pgTable("integration_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull().default(""),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});
