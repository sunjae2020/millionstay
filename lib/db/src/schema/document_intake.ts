import { pgTable, uuid, integer, varchar, text, real, timestamp, jsonb, index } from "drizzle-orm/pg-core";

/**
 * Document intake — the staging area for bulk-uploaded paperwork.
 *
 * Existing tenant files arrive in bulk (a folder of scans, years of contracts)
 * and have to end up filed against the right record. Filing them one at a time
 * through the per-record upload panel does not scale, and uploading them
 * straight to a guessed record is worse: a misfiled identity scan gets a
 * contract's 7-year retention instead of 30 days.
 *
 * So a bulk upload lands here first. The bytes go to Cloudinary and a
 * `documents` row is created immediately (so nothing is ever held in memory or
 * lost), but parked under `entity_type = 'intake'` — not yet filed against
 * anything. Each parked file gets one row in this table carrying what the
 * classifier read out of it and which contract it most likely belongs to.
 * An admin reviews and confirms, and only then does the `documents` row get its
 * real entity and its retention date.
 *
 * The intake row is kept after filing rather than deleted: it is the record of
 * what the classifier proposed and what a human actually chose, which is the
 * only way to tell a mis-filing from a mis-read later on.
 */
export const documentIntakeTable = pgTable(
  "document_intake",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** The parked `documents` row holding the bytes. */
    document_id: uuid("document_id").notNull(),
    /** Batch this file arrived in, so one upload can be reviewed as a unit. */
    batch_id: uuid("batch_id").notNull(),
    file_name: varchar("file_name", { length: 255 }).notNull(),

    /**
     * pending   — uploaded, not read yet
     * scanned   — read, and confident enough to file on one click
     * review    — read, but the match is ambiguous or missing
     * failed    — the read itself errored (the file is still parked and safe)
     * filed     — confirmed and moved onto its record
     * discarded — rejected by the reviewer; the asset is gone
     */
    status: varchar("status", { length: 16 }).notNull().default("pending"),

    /** "filename" when the naming convention alone was enough, "ai" when the contents were read. */
    scan_source: varchar("scan_source", { length: 16 }),
    scan_error: text("scan_error"),

    /** Document type the classifier settled on — a key of UPLOADABLE_DOC_TYPES. */
    detected_doc_type: varchar("detected_doc_type", { length: 32 }),
    /** Everything read out of the document: tenant name, unit, dates, amounts. */
    extracted: jsonb("extracted"),
    /** 0–1, the classifier's own confidence in what it read. */
    confidence: real("confidence"),

    /** Where this should be filed, once confirmed. */
    suggested_entity_type: varchar("suggested_entity_type", { length: 32 }),
    suggested_entity_id: integer("suggested_entity_id"),
    /** 0–1 match strength, and the human-readable reason behind it. */
    match_score: real("match_score"),
    match_reason: text("match_reason"),
    /** Runner-up matches, so the reviewer can pick without searching. */
    candidates: jsonb("candidates"),

    filed_entity_type: varchar("filed_entity_type", { length: 32 }),
    filed_entity_id: integer("filed_entity_id"),
    filed_doc_type: varchar("filed_doc_type", { length: 32 }),
    filed_at: timestamp("filed_at", { withTimezone: true }),
    filed_by: integer("filed_by"),

    created_by: integer("created_by"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_document_intake_status").on(t.status),
    index("idx_document_intake_batch").on(t.batch_id),
    index("idx_document_intake_document").on(t.document_id),
  ],
);

export type DocumentIntakeItem = typeof documentIntakeTable.$inferSelect;
export type InsertDocumentIntakeItem = typeof documentIntakeTable.$inferInsert;
