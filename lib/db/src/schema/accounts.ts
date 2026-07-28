import { pgTable, serial, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const accountsTable = pgTable("accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  account_type: text("account_type").notNull(),
  primary_contact_id: integer("primary_contact_id"),
  secondary_contact_id: integer("secondary_contact_id"),
  account_email: text("account_email"),
  website_url: text("website_url"),
  phone1: text("phone1"),
  phone2: text("phone2"),
  address_line1: text("address_line1"),
  address_suburb: text("address_suburb"),
  address_state: text("address_state"),
  address_postcode: text("address_postcode"),
  address_country: text("address_country"),
  secondary_address_line1: text("secondary_address_line1"),
  secondary_address_suburb: text("secondary_address_suburb"),
  secondary_address_state: text("secondary_address_state"),
  secondary_address_postcode: text("secondary_address_postcode"),
  secondary_address_country: text("secondary_address_country"),
  payment_info_id: integer("payment_info_id"),
  default_commission_id: integer("default_commission_id"),
  default_currency: text("default_currency").default("AUD"),
  parent_account_id: integer("parent_account_id"),
  description: text("description"),
  // Brand/company identity. `logo_url` is a Cloudinary URL — website enrichment
  // re-uploads any logo it finds rather than hot-linking the source site.
  logo_url: text("logo_url"),
  // Korean company registration. `biz_verify_status` is the NTS 사업자등록 상태
  // (Valid | Closed | Suspended | NotFound) recorded at `biz_verified_at`.
  biz_registration_no: text("biz_registration_no"),
  biz_verify_status: text("biz_verify_status"),
  biz_verified_at: timestamp("biz_verified_at", { withTimezone: true }),
  ceo_name: text("ceo_name"),
  // Provenance per column: { "<column>": "manual" | "contact" | "crawl" }.
  // Written when a field is filled from the linked contact or the website
  // crawler, so an admin can tell which values were auto-collected.
  field_sources: jsonb("field_sources").$type<Record<string, string>>(),
  manual_input: boolean("manual_input").notNull().default(false),
  status: text("status").notNull().default("Active"),
  deleted_at: timestamp("deleted_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAccountSchema = createInsertSchema(accountsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accountsTable.$inferSelect;
