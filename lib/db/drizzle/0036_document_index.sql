-- Filing index for uploaded documents.
--
-- Documents are attached per record, which answers "what is on this contract?"
-- but not "where is the 2023 lease for unit 1503?". These columns are what the
-- document library searches on: the document's own title, its own date (not the
-- upload date), its filing year, and free keywords.

ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "title" varchar(255);
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "doc_date" text;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "doc_year" integer;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "tags" jsonb;

CREATE INDEX IF NOT EXISTS "idx_documents_year" ON "documents" ("doc_year");
CREATE INDEX IF NOT EXISTS "idx_documents_year_type" ON "documents" ("doc_year", "doc_type");

-- Backfill: everything already uploaded gets the year it was uploaded in, so
-- existing paperwork is findable by year from day one instead of collecting in
-- an "unfiled" bucket. It is a weaker answer than the date on the page, but for
-- a document scanned when it was signed the two usually agree, and the year is
-- editable afterwards.
UPDATE "documents"
   SET "doc_year" = EXTRACT(YEAR FROM "created_at")::int
 WHERE "doc_year" IS NULL
   AND "created_at" IS NOT NULL;
