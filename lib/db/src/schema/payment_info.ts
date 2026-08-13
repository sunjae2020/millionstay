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
  // 이 계좌를 기본으로 쓰는 계약서 서식 — 'general' | 'housing_standard' | 'mlt_standard'.
  // 계약을 만들 때 그 서식이 선택되면 임대료·보증금 계좌가 이 계좌로 채워지고,
  // 계약별로 다른 계좌를 골라 덮어쓸 수 있다. 회사마다 서식별 수납 계좌가 달라서
  // 코드에 계좌를 박지 않고 설정에서 지정하게 둔다.
  default_for_lease_form: text("default_for_lease_form"),
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
