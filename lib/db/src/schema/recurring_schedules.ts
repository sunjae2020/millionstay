import { pgTable, serial, integer, text, boolean, date, timestamp, numeric, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const recurringSchedulesTable = pgTable("recurring_schedule", {
  id: serial("id").primaryKey(),
  booking_id: integer("booking_id").notNull(),
  contract_id: integer("contract_id"),
  account_id: integer("account_id").notNull(),
  schedule_type: text("schedule_type").notNull().default("Rent"),
  frequency: text("frequency").notNull().default("Biweekly"),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("AUD"),
  gst_included: boolean("gst_included").notNull().default(true),
  start_date: date("start_date").notNull(),
  end_date: date("end_date"),
  next_due_date: date("next_due_date").notNull(),
  last_generated_at: timestamp("last_generated_at", { withTimezone: true }),
  is_active: boolean("is_active").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_recurring_next_due").on(table.next_due_date),
]);

export const insertRecurringScheduleSchema = createInsertSchema(recurringSchedulesTable, {
  booking_id: z.number().int().positive(),
  contract_id: z.number().int().optional().nullable(),
  account_id: z.number().int().positive(),
  amount: z.string(),
  start_date: z.string(),
  end_date: z.string().optional().nullable(),
  next_due_date: z.string(),
}).omit({ id: true, created_at: true, updated_at: true });
