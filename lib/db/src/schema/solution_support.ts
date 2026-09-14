/**
 * Solution Support — the desk where THIS product's staff talk to the solution
 * vendor (Edubee / Soholution). The mirror image of `cs_tickets`, which is the
 * desk where our own customers talk to us.
 *
 * Tickets are written here first (so the admin keeps a local, searchable
 * history even when the vendor is unreachable) and then PUSHED to the vendor's
 * federated intake — `POST /api/platform-support/ingest` on the Edubee API,
 * token-gated, de-duplicated on (product, external_ref). `ticket_ref` is the
 * external_ref we send, so re-pushing the same ticket APPENDS a message to the
 * vendor thread instead of opening a second one.
 *
 * The vendor intake is push-only today: there is no read endpoint an external
 * product may call, so `solution_support_messages` holds our side of the
 * conversation and vendor replies are recorded by staff (sender_type
 * 'solution') until a pull channel exists.
 */
import { pgTable, serial, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

/** A reference link attached to a ticket ([{ label, url }]). */
export type SupportLink = { label: string; url: string };
/** An uploaded screenshot/file ([{ name, url, type }]). */
export type SupportAttachment = { name: string; url: string; type?: string };

/** queued → not yet accepted by the vendor; sent → accepted; failed → see push_error. */
export type SupportPushStatus = "queued" | "sent" | "failed";

export const solutionSupportTicketsTable = pgTable("solution_support_tickets", {
  id: serial("id").primaryKey(),
  /** Our own reference — also the `external_ref` the vendor de-dups on. */
  ticket_ref: text("ticket_ref").notNull().unique(),
  // Mirrors the vendor's category vocabulary (usage/billing/feature/collab/bug/other)
  // so the ingest call never has to translate it.
  category: text("category").notNull().default("usage"),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("open"),
  priority: text("priority").notNull().default("normal"),
  /** Language the request was written in; the vendor desk translates to English. */
  language: text("language").notNull().default("ko"),
  links: jsonb("links").$type<SupportLink[]>().notNull().default([]),
  attachments: jsonb("attachments").$type<SupportAttachment[]>().notNull().default([]),
  /** Optional AI-tidied restatement of `description`, sent alongside it. */
  ai_summary: text("ai_summary"),

  requester_admin_id: integer("requester_admin_id"),
  requester_name: text("requester_name"),
  requester_email: text("requester_email"),

  /** The vendor's ticket uuid, returned by the ingest call. */
  external_ticket_id: text("external_ticket_id"),
  push_status: text("push_status").notNull().default("queued"),
  push_error: text("push_error"),
  pushed_at: timestamp("pushed_at", { withTimezone: true }),

  closed_at: timestamp("closed_at", { withTimezone: true }),
  deleted_at: timestamp("deleted_at"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type SolutionSupportTicket = typeof solutionSupportTicketsTable.$inferSelect;
export type InsertSolutionSupportTicket = typeof solutionSupportTicketsTable.$inferInsert;

export const solutionSupportMessagesTable = pgTable("solution_support_messages", {
  id: serial("id").primaryKey(),
  ticket_id: integer("ticket_id").notNull(),
  /** 'admin' — written here and pushed out; 'solution' — a vendor reply logged by staff. */
  sender_type: text("sender_type").notNull().default("admin"),
  sender_id: integer("sender_id"),
  sender_name: text("sender_name"),
  message: text("message").notNull(),
  attachments: jsonb("attachments").$type<SupportAttachment[]>().notNull().default([]),
  /**
   * 공급사 메시지의 원본 id. 회신 수신(outbox pull)의 멱등 키다 — 커서를 잃고
   * 같은 페이지를 다시 받아도 같은 답변이 두 줄로 남지 않는다. 우리가 쓴 글은 NULL.
   */
  external_message_id: text("external_message_id"),
  /** Only 'admin' messages are pushed; 'solution' messages stay local ('sent'). */
  push_status: text("push_status").notNull().default("queued"),
  push_error: text("push_error"),
  pushed_at: timestamp("pushed_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SolutionSupportMessage = typeof solutionSupportMessagesTable.$inferSelect;
export type InsertSolutionSupportMessage = typeof solutionSupportMessagesTable.$inferInsert;
