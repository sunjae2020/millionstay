import { pgTable, serial, text, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";

export const csTicketsTable = pgTable("cs_tickets", {
  id: serial("id").primaryKey(),
  ticket_ref: text("ticket_ref").notNull().unique(),
  // Who opened the ticket. 'guest' tickets use guest_user_id; partner-portal
  // tickets (agent/owner/service_host) use partner_user_id. Exactly one is set.
  requester_type: text("requester_type").notNull().default("guest"),
  guest_user_id: integer("guest_user_id"),
  partner_user_id: integer("partner_user_id"),
  booking_id: integer("booking_id"),
  category: text("category").notNull().default("General"),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("Open"),
  priority: text("priority").notNull().default("Normal"),
  assigned_admin_id: integer("assigned_admin_id"),
  // CS auto-translation: language the requester chose to converse in. Every
  // message is stored in its original language plus translations into the set
  // { customer_language, en } so the customer reads their own language and the
  // admin reads English. Defaults to 'en' (no translation needed).
  customer_language: text("customer_language").notNull().default("en"),
  translation_enabled: boolean("translation_enabled").notNull().default(true),
  closed_at: timestamp("closed_at", { withTimezone: true }),
  deleted_at: timestamp("deleted_at"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type CsTicket = typeof csTicketsTable.$inferSelect;
export type InsertCsTicket = typeof csTicketsTable.$inferInsert;

export const csMessagesTable = pgTable("cs_messages", {
  id: serial("id").primaryKey(),
  ticket_id: integer("ticket_id").notNull(),
  sender_type: text("sender_type").notNull(),
  sender_id: integer("sender_id").notNull(),
  // `message` always holds the ORIGINAL text exactly as authored (source of
  // truth). `translations` caches AI translations keyed by language code, e.g.
  // { en: "...", ko: "...", vi: "..." }; render translations[viewerLang] and
  // fall back to `message` when a key is missing.
  message: text("message").notNull(),
  original_lang: text("original_lang"),
  translations: jsonb("translations").$type<Record<string, string>>().notNull().default({}),
  // pending | done | failed | skipped — drives the "translating…" / retry UI.
  translation_status: text("translation_status").notNull().default("skipped"),
  translation_input_tokens: integer("translation_input_tokens"),
  translation_output_tokens: integer("translation_output_tokens"),
  image_urls: text("image_urls"),
  is_internal: integer("is_internal").notNull().default(0),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CsMessage = typeof csMessagesTable.$inferSelect;
export type InsertCsMessage = typeof csMessagesTable.$inferInsert;
