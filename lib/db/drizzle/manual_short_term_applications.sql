-- Short-term accommodation applications — public intake + admin ops queue.
-- Mirrors the homestay student-request flow (e-signed at /sign/:token via a
-- contract_signing_requests row with context_type='short_term_app').
-- Idempotent / additive — safe to re-run.

CREATE TABLE IF NOT EXISTS "short_term_applications" (
  "id" serial PRIMARY KEY NOT NULL,
  "request_ref" text NOT NULL,
  "status" text DEFAULT 'Submitted' NOT NULL,

  "account_id" integer,

  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "email" text,
  "phone" text,
  "nationality" text,

  "check_in" text,
  "check_out" text,
  "guests" integer,
  "preferred_area" text,
  "property_type" text,

  "preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,

  "terms_accepted" boolean DEFAULT false NOT NULL,
  "terms_accepted_at" timestamp with time zone,

  "reviewed_by" integer,
  "reviewed_at" timestamp with time zone,
  "notes" text,
  "assigned_staff_user_id" integer,

  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "short_term_applications_request_ref_unique" UNIQUE("request_ref")
);

CREATE INDEX IF NOT EXISTS "sta_status_idx" ON "short_term_applications" ("status");
CREATE INDEX IF NOT EXISTS "sta_email_idx" ON "short_term_applications" ("email");
