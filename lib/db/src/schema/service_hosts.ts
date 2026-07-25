import { pgTable, serial, text, integer, boolean, timestamp, date, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const serviceHostsTable = pgTable("service_hosts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  account_id: integer("account_id"),
  contract_product_id: integer("contract_product_id"),
  from_date: date("from_date"),
  to_date: date("to_date"),
  in_call: boolean("in_call").default(false),
  out_call: boolean("out_call").default(false),
  business_start_hour: integer("business_start_hour"),
  business_end_hour: integer("business_end_hour"),
  description: text("description"),
  // Trades this partner handles, for work-order auto-dispatch (Phase 3), e.g.
  // ["plumbing","electrical","cleaning"]. Matched case-insensitively against a
  // work_order's category. Empty → not auto-dispatchable.
  specialties: jsonb("specialties").notNull().default([]),
  status: text("status").notNull().default("Active"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertServiceHostSchema = createInsertSchema(serviceHostsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertServiceHost = z.infer<typeof insertServiceHostSchema>;
export type ServiceHost = typeof serviceHostsTable.$inferSelect;
