import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const usersTable = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password_hash: text("password_hash").notNull(),
  role: text("role").notNull().default("Admin"),
  first_name: text("first_name").notNull().default(""),
  last_name: text("last_name").notNull().default(""),
  is_active: boolean("is_active").notNull().default(true),
  // ── Profile / HR fields (all optional; added 2026-08 for the Settings →
  // Users admin form). Personal data here is Privacy-Act PII: date_of_birth
  // and the emergency-contact block are redacted in logs and only rendered to
  // SuperAdmins. Business cards are stored as private Cloudinary public_ids
  // (signed URLs on read) — never public URLs — while the profile photo is a
  // public CDN URL because the user LIST renders it.
  phone: text("phone"),
  date_of_birth: text("date_of_birth"),
  postcode: text("postcode"),
  address_line1: text("address_line1"),
  address_detail: text("address_detail"),
  profile_photo_url: text("profile_photo_url"),
  business_card_front_id: text("business_card_front_id"),
  business_card_back_id: text("business_card_back_id"),
  notes: text("notes"),
  department: text("department"),
  // 회계 접근 범위(HQ/지점/팀)의 소속. team_id 만 있으면 팀의 지점을 따른다.
  // `department` 는 표시용 자유 텍스트라 권한 판단에 쓸 수 없어 따로 둔다.
  branch_id: integer("branch_id"),
  team_id: integer("team_id"),
  job_title: text("job_title"),
  employee_no: text("employee_no"),
  joined_on: text("joined_on"),
  emergency_contact_name: text("emergency_contact_name"),
  emergency_contact_relation: text("emergency_contact_relation"),
  emergency_contact_phone: text("emergency_contact_phone"),
  locale: text("locale"),
  status: text("status").notNull().default("active"),
  force_password_change: boolean("force_password_change").notNull().default(false),
  reset_token: text("reset_token"),
  reset_token_expires_at: timestamp("reset_token_expires_at", { withTimezone: true }),
  // Auth: invalidate any access token issued before this timestamp.
  tokens_invalid_after: timestamp("tokens_invalid_after", { withTimezone: true }),
  last_login_at: timestamp("last_login_at", { withTimezone: true }),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type AdminUser = typeof usersTable.$inferSelect;
export type InsertAdminUser = typeof usersTable.$inferInsert;
