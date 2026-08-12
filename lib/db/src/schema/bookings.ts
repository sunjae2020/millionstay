import { pgTable, serial, text, integer, boolean, timestamp, date, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { contractTermEnum, roomTypeEnum, mealPlanEnum } from "./accommodation_options";

export const bookingsTable = pgTable("bookings", {
  id: serial("id").primaryKey(),
  booking_ref: text("booking_ref").notNull().unique(),
  name: text("name"),
  account_id: integer("account_id"),
  contact_id: integer("contact_id"),
  booking_status: text("booking_status").notNull().default("Draft"),
  booking_source: text("booking_source"),
  customer_notes: text("customer_notes"),
  space_id: integer("space_id"),
  check_in_date: date("check_in_date"),
  check_out_date: date("check_out_date"),
  stay_nights: integer("stay_nights"),
  stay_weeks: numeric("stay_weeks", { precision: 6, scale: 2 }),
  agreed_weekly_rate: numeric("agreed_weekly_rate", { precision: 12, scale: 2 }),
  total_rent: numeric("total_rent", { precision: 12, scale: 2 }),
  currency: text("currency").default("AUD"),
  exchange_rate_to_aud: numeric("exchange_rate_to_aud", { precision: 18, scale: 8 }),
  num_guests: integer("num_guests").default(1),
  product_id: integer("product_id"),
  contract_product_id: integer("contract_product_id"),
  agent_account_id: integer("agent_account_id"),
  // ── Unified product classification (homestay / self-board / share) ──
  // A booking carries its own snapshot of the product classification so that
  // homestay ⇄ self-board ⇄ share conversions are just attribute changes on the
  // same row. NULL on legacy short-term bookings created before this column set.
  //   room_type='homestay'                     → homestay (with a host family)
  //   room_type='homestay'  + meal_plan='none' → homestay self-board (no meals)
  //   room_type in (entire_place|house_share|room_share) → share (no host family)
  room_type: roomTypeEnum("room_type"),
  meal_plan: mealPlanEnum("meal_plan"),
  contract_term: contractTermEnum("contract_term"),
  // Host family this booking is placed with (homestay only; NULL for share).
  host_application_id: integer("host_application_id"),
  // Internal ops owner of this booking (담당직원). → users.id
  assigned_staff_user_id: integer("assigned_staff_user_id"),
  // ── 월세 정산 방식 (month-billed stays only) ──────────────────────────────
  // A month-billed stay that starts mid-month owes a part-month (일할) amount
  // for the first period. `rent_due_day` is the day of the month rent falls due
  // (납부일); `prorate_with_next_month` decides whether that part-month amount
  // is carried onto the NEXT month's invoice as one combined charge
  //   (월세 30만 · 15일 입주 → 다음 달 청구서에 15만 + 30만 = 45만)
  // or billed on its own straight away. Mirrors the account-level
  // `consolidated_prorate_enabled` switch, decided per booking.
  rent_due_day: integer("rent_due_day"),
  prorate_with_next_month: boolean("prorate_with_next_month").notNull().default(true),
  // ── 요금 직접 입력 (메뉴얼 선택) ──────────────────────────────────────────
  // Pricing normally mirrors the 숙박 상품 (accommodation_catalog) the booking
  // points at. `manual_pricing` releases that link so an operator can type the
  // agreed terms straight onto the booking — the case for one-off deals that no
  // rate card covers. The three amounts below are the booking's own copy and are
  // only authoritative while `manual_pricing` is TRUE; otherwise they are kept in
  // step with the product's rate card.
  manual_pricing: boolean("manual_pricing").notNull().default(false),
  deposit_amount: numeric("deposit_amount", { precision: 12, scale: 2 }),
  monthly_rent: numeric("monthly_rent", { precision: 12, scale: 2 }),
  // 특약 — free-text special conditions agreed for this stay.
  special_terms: text("special_terms"),
  // 계약일 — the day the contract was signed, distinct from check-in.
  contract_date: date("contract_date"),
  cancellation_reason: text("cancellation_reason"),
  cancelled_at: timestamp("cancelled_at", { withTimezone: true }),
  status: text("status").notNull().default("Active"),
  deleted_at: timestamp("deleted_at"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const bookingDocumentsTable = pgTable("booking_documents", {
  id: serial("id").primaryKey(),
  booking_id: integer("booking_id").notNull(),
  doc_type: text("doc_type"),
  file_name: text("file_name"),
  file_url: text("file_url"),
  verified_status: text("verified_status").notNull().default("Pending"),
  rejection_reason: text("rejection_reason"),
  expiry_date: date("expiry_date"),
  status: text("status").notNull().default("Active"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const bookingServicesTable = pgTable("booking_services", {
  id: serial("id").primaryKey(),
  booking_id: integer("booking_id").notNull(),
  service_id: integer("service_id"),
  name: text("name").notNull(),
  service_type: text("service_type").default("one_time"),
  quantity: integer("quantity").notNull().default(1),
  unit_price: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  total_price: numeric("total_price", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("AUD"),
  exchange_rate_to_aud: numeric("exchange_rate_to_aud", { precision: 18, scale: 8 }),
  billing_trigger: text("billing_trigger").default("at_booking"),
  frequency: text("frequency"),
  notes: text("notes"),
  status: text("status").notNull().default("Active"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBookingSchema = createInsertSchema(bookingsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookingsTable.$inferSelect;

export const insertBookingDocumentSchema = createInsertSchema(bookingDocumentsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertBookingDocument = z.infer<typeof insertBookingDocumentSchema>;
export type BookingDocument = typeof bookingDocumentsTable.$inferSelect;

export const insertBookingServiceSchema = createInsertSchema(bookingServicesTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertBookingService = z.infer<typeof insertBookingServiceSchema>;
export type BookingService = typeof bookingServicesTable.$inferSelect;
