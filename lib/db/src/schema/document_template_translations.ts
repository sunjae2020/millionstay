import { pgTable, serial, integer, text, jsonb, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Per-locale content for a document_templates row. body_html is authoritative;
// body_json holds the TipTap document (Studio WYSIWYG), body_text is the optional
// plaintext alternative. Resolution falls back requested-locale → en → first.
export const documentTemplateTranslationsTable = pgTable("document_template_translations", {
  id: serial("id").primaryKey(),
  template_id: integer("template_id").notNull(), // document_templates.id
  locale: text("locale").notNull(),              // en | ko | ja | zh | th
  subject: text("subject"),                      // email subject (null for contract)
  body_html: text("body_html"),
  body_json: jsonb("body_json"),
  body_text: text("body_text"),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  unique("ux_doc_template_translations_tpl_locale").on(t.template_id, t.locale),
]);

export const insertDocumentTemplateTranslationSchema = createInsertSchema(documentTemplateTranslationsTable).omit({
  id: true, updated_at: true,
});
export type InsertDocumentTemplateTranslation = z.infer<typeof insertDocumentTemplateTranslationSchema>;
export type DocumentTemplateTranslation = typeof documentTemplateTranslationsTable.$inferSelect;
