import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const contractTypesTable = pgTable("contract_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  contract_security: text("contract_security").notNull().default("Public"),
  require_passport: boolean("require_passport").notNull().default(false),
  require_visa: boolean("require_visa").notNull().default(false),
  require_enrollment: boolean("require_enrollment").notNull().default(false),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type ContractType = typeof contractTypesTable.$inferSelect;
export type InsertContractType = typeof contractTypesTable.$inferInsert;
