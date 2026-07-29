import { pgTable, serial, text, integer, real, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const contractsTable = pgTable("contracts", {
  id: serial("id").primaryKey(),
  contract_ref: text("contract_ref").notNull().unique(),
  booking_id: integer("booking_id"),
  product_id: integer("product_id"),
  contract_product_id: integer("contract_product_id"),
  tenant_account_id: integer("tenant_account_id"),
  landlord_account_id: integer("landlord_account_id"),
  space_id: integer("space_id"),
  start_date: text("start_date"),
  end_date: text("end_date"),
  weekly_rate: numeric("weekly_rate", { precision: 12, scale: 2, mode: "number" }),
  total_rent: numeric("total_rent", { precision: 12, scale: 2, mode: "number" }),
  bond_amount: numeric("bond_amount", { precision: 12, scale: 2, mode: "number" }),
  // 월세 — promo-adjusted monthly rent auto-filled from the linked 숙박상품 tier.
  monthly_rent: numeric("monthly_rent", { precision: 12, scale: 2, mode: "number" }),
  advance_amount: numeric("advance_amount", { precision: 12, scale: 2, mode: "number" }),
  // Korean-lease payment structure (계약서 구분 / 계약금·잔금·보증금·월세)
  contract_category: text("contract_category"),
  down_payment: numeric("down_payment", { precision: 12, scale: 2, mode: "number" }),
  down_payment_date: text("down_payment_date"),
  balance_amount: numeric("balance_amount", { precision: 12, scale: 2, mode: "number" }),
  balance_date: text("balance_date"),
  rent_due_day: integer("rent_due_day"),
  currency: text("currency").notNull().default("AUD"),
  exchange_rate_to_aud: numeric("exchange_rate_to_aud", { precision: 18, scale: 8 }),
  status: text("status").notNull().default("Draft"),
  deleted_at: timestamp("deleted_at"),
  sent_at: timestamp("sent_at", { withTimezone: true }),
  signed_at: timestamp("signed_at", { withTimezone: true }),
  effective_date: text("effective_date"),
  expiry_date: text("expiry_date"),
  termination_reason: text("termination_reason"),
  document_url: text("document_url"),
  // 발급할 계약서 서식: housing_standard(법무부 주택임대차표준계약서) /
  // mlt_standard(민간임대주택 표준임대차계약서) / general(자사 일반 임대차계약서).
  lease_form: text("lease_form"),
  // 계약서 뒤에 붙일 첨부 문서 키 목록(JSON 배열). leaseAttachments.ts 의 종류와 1:1.
  doc_attachments: text("doc_attachments"),
  terms_text: text("terms_text"),
  notes: text("notes"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertContractSchema = createInsertSchema(contractsTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export type InsertContract = z.infer<typeof insertContractSchema>;
export type Contract = typeof contractsTable.$inferSelect;
