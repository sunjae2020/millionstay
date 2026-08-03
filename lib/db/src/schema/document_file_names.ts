import { pgTable, serial, integer, varchar, date, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Issued-document file names.
 *
 * Every document the system issues (contract, invoice, receipt, quote,
 * inspection report, settlement …) is named by one rule:
 *
 *     <3자리 코드>-<이름>_<YYYYMMDD><순번>
 *     CTR-김용식_20260803A.pdf
 *
 * The suffix letter runs A…Z, then A1…Z1 … A9…Z9 — 260 documents per person
 * per day, which is what "당일 중복 발행 시 순차 증가" means in practice.
 *
 * The name has to be *stable*: a PDF is re-rendered on every preview and every
 * download, and the same invoice must not come back as `…A` once and `…B` the
 * next minute. So the allocation is recorded here the first time a document is
 * issued and simply read back afterwards.
 *
 * Two unique keys carry the rule:
 *  - (entity_type, entity_id, doc_code, variant) — one name per document, ever.
 *  - (party_key, issue_date, seq)                — one letter per person-day.
 *    Concurrent issues collide here and the loser retries with the next seq,
 *    which is what keeps the sequence gapless under parallel requests.
 */
export const documentFileNamesTable = pgTable(
  "document_file_names",
  {
    id: serial("id").primaryKey(),
    /** Three-letter document code — CTR, INV, RCP, QUO, INS, STL … */
    doc_code: varchar("doc_code", { length: 8 }).notNull(),
    /** Record the document was issued from ("invoice", "contract", …). */
    entity_type: varchar("entity_type", { length: 32 }).notNull(),
    entity_id: integer("entity_id").notNull(),
    /**
     * Distinguishes documents issued from the *same* record — a receipt and its
     * invoice, a signed contract and its draft. Empty string when there is only
     * one document of that code per record (never null, so the unique index
     * bites).
     */
    variant: varchar("variant", { length: 32 }).notNull().default(""),
    /** Normalised party name the sequence is counted against. */
    party_key: varchar("party_key", { length: 128 }).notNull(),
    /** Party name as printed in the filename. */
    party_name: varchar("party_name", { length: 128 }).notNull(),
    /** 발생년월일 — the document's own date, not the render time. */
    issue_date: date("issue_date").notNull(),
    /** 0-based position in the A…Z9 run. */
    seq: integer("seq").notNull(),
    /** The resolved base name, without the extension. */
    file_name: varchar("file_name", { length: 255 }).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [
    uniqueIndex("uq_docfilenames_entity").on(t.entity_type, t.entity_id, t.doc_code, t.variant),
    uniqueIndex("uq_docfilenames_party_day_seq").on(t.party_key, t.issue_date, t.seq),
    index("idx_docfilenames_name").on(t.file_name),
  ],
);

export type DocumentFileName = typeof documentFileNamesTable.$inferSelect;
