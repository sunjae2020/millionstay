import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const guestUsersTable = pgTable("guest_users", {
  id: serial("id").primaryKey(),
  account_id: integer("account_id"),
  email: text("email").notNull().unique(),
  password_hash: text("password_hash").notNull(),
  first_name: text("first_name"),
  last_name: text("last_name"),
  phone: text("phone"),
  nationality: text("nationality"),
  date_of_birth: text("date_of_birth"),
  gender: text("gender"),
  // Study / Education info (legacy — retained for data retention, no longer surfaced in the portal)
  university: text("university"),
  department: text("department"),
  student_id: text("student_id"),
  study_year: text("study_year"),
  // Stay / Rental info (Korean 단기·장기 체류)
  company: text("company"),                 // 직장 / 소속
  job_title: text("job_title"),             // 직책
  stay_purpose: text("stay_purpose"),       // 체류 목적 (travel/business/residence/study/other)
  vehicle_plate: text("vehicle_plate"),     // 차량 번호
  parking_required: boolean("parking_required"), // 주차 필요 여부
  // Bank / Payment info
  bank_name: text("bank_name"),
  bank_account_name: text("bank_account_name"),
  bank_bsb: text("bank_bsb"),
  bank_account_number: text("bank_account_number"),
  preferred_payment_method: text("preferred_payment_method"),
  // Profile avatar
  avatar_url: text("avatar_url"),
  avatar_public_id: text("avatar_public_id"),
  is_active: boolean("is_active").notNull().default(true),
  email_verified: boolean("email_verified").notNull().default(false),
  // Auth: invalidate any access token issued before this timestamp.
  tokens_invalid_after: timestamp("tokens_invalid_after", { withTimezone: true }),
  // Soft-delete (privacy / GDPR-style)
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
  // Password reset
  reset_token_hash: text("reset_token_hash"),
  reset_token_expires_at: timestamp("reset_token_expires_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertGuestUserSchema = createInsertSchema(guestUsersTable).omit({
  id: true, created_at: true, updated_at: true,
});

export type InsertGuestUser = z.infer<typeof insertGuestUserSchema>;
export type GuestUser = typeof guestUsersTable.$inferSelect;
