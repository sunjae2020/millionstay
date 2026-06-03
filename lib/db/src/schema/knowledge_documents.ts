import { pgTable, uuid, text, integer, timestamp, index } from "drizzle-orm/pg-core";

/**
 * Knowledge Documents — source material the AI chat assistant answers from.
 *
 * Admins upload FAQ / policy / info content as raw text or files (PDF/TXT).
 * `content_text` is the extracted plain text the model reads; the original
 * file (if any) is kept on Cloudinary for reference. Active documents are
 * injected into the assistant's cached system prompt.
 */
export const knowledgeDocumentsTable = pgTable(
  "knowledge_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    source_type: text("source_type").notNull().default("text"),
    content_text: text("content_text").notNull().default(""),
    language: text("language"),
    file_url: text("file_url"),
    cloudinary_public_id: text("cloudinary_public_id"),
    status: text("status").notNull().default("active"),
    created_by: integer("created_by"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (t) => [
    index("idx_knowledge_documents_status").on(t.status),
  ],
);

export type KnowledgeDocument = typeof knowledgeDocumentsTable.$inferSelect;
export type InsertKnowledgeDocument = typeof knowledgeDocumentsTable.$inferInsert;
