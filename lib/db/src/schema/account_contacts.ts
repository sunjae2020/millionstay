import { pgTable, serial, integer, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Account ↔ contact links (many-to-many).
 *
 * `accounts.primary_contact_id` / `secondary_contact_id` stay the source of
 * truth for the two designated slots; this table carries every *additional*
 * person attached to an account (담당자, 회계 담당, 현장 소장 …) and lets one
 * contact belong to several accounts. Both directions of the UI — the account's
 * 연락처 tab and the contact's 계정 tab — read the union of the two.
 */
export const accountContactsTable = pgTable("account_contacts", {
  id: serial("id").primaryKey(),
  account_id: integer("account_id").notNull(),
  contact_id: integer("contact_id").notNull(),
  // Free text so tenants can label the relationship however they work.
  role: text("role"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("account_contacts_pair_idx").on(table.account_id, table.contact_id),
  index("account_contacts_contact_idx").on(table.contact_id),
]);

export const insertAccountContactSchema = createInsertSchema(accountContactsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertAccountContact = z.infer<typeof insertAccountContactSchema>;
export type AccountContact = typeof accountContactsTable.$inferSelect;
