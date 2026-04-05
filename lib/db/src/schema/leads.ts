import { pgTable, serial, text, integer, boolean, timestamp, date, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const leadsTable = pgTable("leads", {
  id: serial("id").primaryKey(),
  lead_ref: text("lead_ref").notNull().unique(),
  first_name: text("first_name").notNull(),
  last_name: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  nationality: text("nationality"),
  lead_source: text("lead_source"),
  lead_status: text("lead_status").notNull().default("New"),
  inquiry_type: text("inquiry_type"),
  message: text("message"),
  preferred_space_type: text("preferred_space_type"),
  preferred_check_in_date: date("preferred_check_in_date"),
  preferred_duration_weeks: integer("preferred_duration_weeks"),
  preferred_suburb_id: integer("preferred_suburb_id"),
  budget_min: numeric("budget_min", { precision: 12, scale: 2 }),
  budget_max: numeric("budget_max", { precision: 12, scale: 2 }),
  budget_currency: text("budget_currency").default("AUD"),
  converted_booking_id: integer("converted_booking_id"),
  converted_at: timestamp("converted_at", { withTimezone: true }),
  assigned_to: text("assigned_to"),
  description: text("description"),
  manual_input: boolean("manual_input").notNull().default(false),
  status: text("status").notNull().default("Active"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertLeadSchema = createInsertSchema(leadsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leadsTable.$inferSelect;
