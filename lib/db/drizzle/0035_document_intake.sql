-- Document intake staging for bulk-uploaded paperwork.
-- Files land parked (documents.entity_type = 'intake') and are filed onto their
-- real record only after review, so a mis-read never lands a 30-day identity
-- scan on a 7-year contract.

CREATE TABLE IF NOT EXISTS "document_intake" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "document_id" uuid NOT NULL,
  "batch_id" uuid NOT NULL,
  "file_name" varchar(255) NOT NULL,
  "status" varchar(16) NOT NULL DEFAULT 'pending',
  "scan_source" varchar(16),
  "scan_error" text,
  "detected_doc_type" varchar(32),
  "extracted" jsonb,
  "confidence" real,
  "suggested_entity_type" varchar(32),
  "suggested_entity_id" integer,
  "match_score" real,
  "match_reason" text,
  "candidates" jsonb,
  "filed_entity_type" varchar(32),
  "filed_entity_id" integer,
  "filed_doc_type" varchar(32),
  "filed_at" timestamp with time zone,
  "filed_by" integer,
  "created_by" integer,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_document_intake_status" ON "document_intake" ("status");
CREATE INDEX IF NOT EXISTS "idx_document_intake_batch" ON "document_intake" ("batch_id");
CREATE INDEX IF NOT EXISTS "idx_document_intake_document" ON "document_intake" ("document_id");
