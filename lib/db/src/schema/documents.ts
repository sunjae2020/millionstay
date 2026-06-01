import { pgTable, uuid, integer, varchar, timestamp, index } from "drizzle-orm/pg-core";

/**
 * Documents — Sprint B-2
 *
 * Unified table for sensitive uploaded files (passport scans, signed contracts,
 * tax invoices, receipts) so that retention policies (Australian APP 11) can be
 * enforced centrally.
 *
 * Public marketing assets (e.g. space images) intentionally remain in their
 * original tables on permanent CDN URLs — they are not "personal information"
 * and have indefinite retention for SEO/CDN caching.
 */
export const documentsTable = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    entity_type: varchar("entity_type", { length: 32 }).notNull(),
    entity_id: integer("entity_id").notNull(),
    doc_type: varchar("doc_type", { length: 32 }).notNull(),
    file_name: varchar("file_name", { length: 255 }).notNull(),
    file_size: integer("file_size").notNull(),
    mime_type: varchar("mime_type", { length: 100 }).notNull(),
    cloudinary_public_id: varchar("cloudinary_public_id", { length: 255 }).notNull(),
    // Document Hub: human reference + version for frozen document snapshots.
    doc_ref: varchar("doc_ref", { length: 64 }),
    version: integer("version"),
    uploaded_by: integer("uploaded_by"),
    uploaded_by_type: varchar("uploaded_by_type", { length: 16 }),
    retention_until: timestamp("retention_until", { withTimezone: true }).notNull(),
    deleted_at: timestamp("deleted_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_documents_entity").on(t.entity_type, t.entity_id),
    index("idx_documents_doctype").on(t.doc_type),
    index("idx_documents_retention").on(t.retention_until),
  ],
);

export type Document = typeof documentsTable.$inferSelect;
export type InsertDocument = typeof documentsTable.$inferInsert;
