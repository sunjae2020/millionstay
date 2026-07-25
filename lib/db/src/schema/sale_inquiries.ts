import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Sale-listing INQUIRIES with a privacy gate (vision: "1차 문의는 관리자에서
// 비공개 처리 — 문의자 신상 비공개, 집주인 전달 여부 관리자 결정"). Every public
// inquiry lands here with the enquirer's identity WITHHELD in the admin review
// list by default; an admin explicitly reveals it (audit-logged via revealed_at)
// and then decides whether to forward it on. Status:
//   new → reviewed → forwarded | closed
export const saleInquiriesTable = pgTable("sale_inquiries", {
  id: serial("id").primaryKey(),
  listing_id: integer("listing_id"),        // sale_listings.id (nullable — general /buy inquiries)
  // Enquirer identity — masked in the admin list until revealed.
  name: text("name"),
  email: text("email"),
  phone: text("phone"),
  message: text("message"),
  locale: text("locale"),

  status: text("status").notNull().default("new"), // new | reviewed | forwarded | closed
  revealed_at: timestamp("revealed_at", { withTimezone: true }),   // when an admin unmasked the identity
  revealed_by: integer("revealed_by"),                            // admin users.id
  forwarded_at: timestamp("forwarded_at", { withTimezone: true }), // 집주인/판매팀 전달 결정 시각
  forward_note: text("forward_note"),
  admin_notes: text("admin_notes"),

  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSaleInquirySchema = createInsertSchema(saleInquiriesTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertSaleInquiry = z.infer<typeof insertSaleInquirySchema>;
export type SaleInquiry = typeof saleInquiriesTable.$inferSelect;
