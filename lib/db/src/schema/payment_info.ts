import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const paymentInfoTable = pgTable("payment_info", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  payment_type: text("payment_type").notNull().default("BankTransfer"),
  bank_name: text("bank_name"),
  swift_code: text("swift_code"),
  bsb_number: text("bsb_number"),
  account_number: text("account_number"),
  account_name: text("account_name"),
  stripe_account_id: text("stripe_account_id"),
  description: text("description"),
  status: text("status").notNull().default("Active"),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPaymentInfoSchema = createInsertSchema(paymentInfoTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertPaymentInfo = z.infer<typeof insertPaymentInfoSchema>;
export type PaymentInfo = typeof paymentInfoTable.$inferSelect;
