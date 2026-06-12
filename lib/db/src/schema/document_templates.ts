import { pgTable, serial, text, integer, jsonb, timestamp, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Editable document/email/contract templates (ported from Edubee CRM's
// document_templates, simplified for MillionStay's single-tenant model — no
// tenant_id / auto-fork). Ops edit copy in the admin Templates Studio instead of
// redeploying. Per-locale content lives in document_template_translations.
//
//   kind:  email | contract  (pdf reserved for later)
//   key:   stable slug, e.g. "homestay.approved", "homestay_placement_terms"
//   variables_schema: { var_name: { type, required } } drives the editor sidebar
//                     + sample values for preview/test-send.
export const documentTemplatesTable = pgTable("document_templates", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(),                       // email | contract | pdf
  key: text("key").notNull(),                         // stable slug
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),                         // grouping in the Studio list
  variables_schema: jsonb("variables_schema").notNull().default({}),
  status: text("status").notNull().default("draft"),  // draft | published | archived
  version: integer("version").notNull().default(1),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => [
  unique("ux_document_templates_kind_key").on(t.kind, t.key),
]);

export const insertDocumentTemplateSchema = createInsertSchema(documentTemplatesTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertDocumentTemplate = z.infer<typeof insertDocumentTemplateSchema>;
export type DocumentTemplate = typeof documentTemplatesTable.$inferSelect;
