import { pgTable, uuid, text, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";

/**
 * Chat Messages — transcript for an AI chat conversation.
 *
 * `role` is one of 'user' | 'assistant' | 'tool'. For assistant turns that
 * invoke tools, `tool_calls` holds the raw tool_use blocks; for 'tool' rows
 * `tool_name` records which tool produced the result stored in `content`.
 */
export const chatMessagesTable = pgTable(
  "chat_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversation_id: uuid("conversation_id").notNull(),
    role: text("role").notNull(),
    content: text("content").notNull().default(""),
    tool_calls: jsonb("tool_calls"),
    tool_name: text("tool_name"),
    input_tokens: integer("input_tokens"),
    output_tokens: integer("output_tokens"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_chat_messages_conversation").on(t.conversation_id, t.created_at),
  ],
);

export type ChatMessage = typeof chatMessagesTable.$inferSelect;
export type InsertChatMessage = typeof chatMessagesTable.$inferInsert;
