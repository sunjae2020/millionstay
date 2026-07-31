import { pgTable, uuid, integer, varchar, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";

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
    // Cloudinary resource_type the asset was stored under. Signed URLs and
    // deletes must use the same value. "image" is Cloudinary's default and what
    // every row predating this column was uploaded as; "raw" covers documents
    // the image pipeline refuses (Office files, archives, oversized PDFs).
    resource_type: varchar("resource_type", { length: 16 }).notNull().default("image"),
    // Document Hub: human reference + version for frozen document snapshots.
    doc_ref: varchar("doc_ref", { length: 64 }),
    version: integer("version"),

    // ── Filing index ──────────────────────────────────────────────────────
    //
    // A document's own identity, as opposed to the file it arrived as. Once
    // there are years of paperwork the filename stops being findable — nobody
    // remembers whether the 2023 lease was scanned as "계약서_최종.pdf" or
    // "scan_0412.pdf" — so the fields people actually search by are stored
    // explicitly rather than parsed back out of the name each time.

    /** Human label. Falls back to the filename when the uploader gives none. */
    title: varchar("title", { length: 255 }),
    /**
     * The date printed on the document — not the upload date. A lease signed in
     * 2023 and scanned today belongs in 2023, and `created_at` cannot say that.
     */
    doc_date: text("doc_date"),
    /**
     * Filing year, indexed. Stored rather than derived from `doc_date` because
     * plenty of paperwork gives a year and nothing more, and because a year
     * filter is the single most common query against this table.
     */
    doc_year: integer("doc_year"),
    /** Free keywords (tenant name, unit, "갱신", "해지"…) as a JSON string array. */
    tags: jsonb("tags"),
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
    // The library screen filters by year and by type, in that order.
    index("idx_documents_year").on(t.doc_year),
    index("idx_documents_year_type").on(t.doc_year, t.doc_type),
  ],
);

export type Document = typeof documentsTable.$inferSelect;
export type InsertDocument = typeof documentsTable.$inferInsert;
