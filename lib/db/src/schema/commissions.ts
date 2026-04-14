import { pgTable, serial, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const commissionsTable = pgTable("commissions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  commission_type: text("commission_type").notNull().default("Percentage"),
  commission_rate: real("commission_rate"),
  commission_amount: real("commission_amount"),
  description: text("description"),
  status: text("status").notNull().default("Active"),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCommissionSchema = createInsertSchema(commissionsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertCommission = z.infer<typeof insertCommissionSchema>;
export type Commission = typeof commissionsTable.$inferSelect;
