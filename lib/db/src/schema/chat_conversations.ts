import { pgTable, uuid, text, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";

/**
 * Chat Conversations — AI customer chat widget (landing page).
 *
 * One row per visitor conversation. Visitors are anonymous and identified by a
 * client-generated `session_id` (stored in the browser). When a visitor leaves
 * their details, the conversation is linked to a generated lead via `lead_id`.
 */
export const chatConversationsTable = pgTable(
  "chat_conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    session_id: text("session_id").notNull(),
    language: text("language"),
    status: text("status").notNull().default("open"),
    lead_id: integer("lead_id"),
    contact_email: text("contact_email"),
    meta: jsonb("meta"),
    last_message_at: timestamp("last_message_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("idx_chat_conversations_session").on(t.session_id),
    index("idx_chat_conversations_created").on(t.created_at),
  ],
);

export type ChatConversation = typeof chatConversationsTable.$inferSelect;
export type InsertChatConversation = typeof chatConversationsTable.$inferInsert;
