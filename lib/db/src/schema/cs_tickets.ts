import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

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
  message: text("message").notNull(),
  image_urls: text("image_urls"),
  is_internal: integer("is_internal").notNull().default(0),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CsMessage = typeof csMessagesTable.$inferSelect;
export type InsertCsMessage = typeof csMessagesTable.$inferInsert;
