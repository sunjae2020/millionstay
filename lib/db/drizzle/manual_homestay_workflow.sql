-- Homestay workflow — student requests, placements, payments, agent commission,
-- service-partner jobs, e-signature, and host availability.
-- See docs/proposals/HOMESTAY_WORKFLOW.md §6.
-- Idempotent / additive — safe to re-run. Money columns are numeric → strings.

-- ── Student placement requests (customer-side intake) ─────────────────────────
CREATE TABLE IF NOT EXISTS "homestay_student_requests" (
  "id" serial PRIMARY KEY NOT NULL,
  "request_ref" text NOT NULL,
  "status" text DEFAULT 'Submitted' NOT NULL,

  "account_id" integer,
  "agent_account_id" integer,
  "submitted_by" text DEFAULT 'student' NOT NULL,

  "student_first_name" text NOT NULL,
  "student_last_name" text NOT NULL,
  "student_email" text,
  "student_phone" text,
  "date_of_birth" text,
  "is_minor" boolean DEFAULT false NOT NULL,
  "gender" text,
  "nationality" text,

  "guardian_name" text,
  "guardian_email" text,
  "guardian_phone" text,
  "guardian_relationship" text,
  "guardian_consent_at" timestamp with time zone,

  "preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,

  "terms_accepted" boolean DEFAULT false NOT NULL,
  "terms_accepted_at" timestamp with time zone,

  "reviewed_by" integer,
  "reviewed_at" timestamp with time zone,
  "notes" text,

  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "homestay_student_requests_request_ref_unique" UNIQUE("request_ref")
);
CREATE INDEX IF NOT EXISTS "hsr_status_idx" ON "homestay_student_requests" ("status");
CREATE INDEX IF NOT EXISTS "hsr_account_idx" ON "homestay_student_requests" ("account_id");
CREATE INDEX IF NOT EXISTS "hsr_agent_idx" ON "homestay_student_requests" ("agent_account_id");

-- ── Placements (host ↔ student match) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "homestay_placements" (
  "id" serial PRIMARY KEY NOT NULL,
  "placement_ref" text NOT NULL,
  "host_application_id" integer NOT NULL,
  "student_request_id" integer NOT NULL,
  "agent_account_id" integer,
  "status" text DEFAULT 'Proposed' NOT NULL,

  "move_in_date" text,
  "move_out_date" text,

  "placement_fee" numeric(10, 2) DEFAULT '0' NOT NULL,
  "deposit" numeric(10, 2) DEFAULT '0' NOT NULL,
  "monthly_fee" numeric(10, 2) DEFAULT '0' NOT NULL,
  "currency" text DEFAULT 'AUD' NOT NULL,

  "stripe_customer_id" text,
  "stripe_subscription_id" text,

  "proposed_at" timestamp with time zone,
  "host_accepted_at" timestamp with time zone,
  "confirmed_at" timestamp with time zone,

  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "homestay_placements_placement_ref_unique" UNIQUE("placement_ref")
);
CREATE INDEX IF NOT EXISTS "hp_host_app_idx" ON "homestay_placements" ("host_application_id");
CREATE INDEX IF NOT EXISTS "hp_student_req_idx" ON "homestay_placements" ("student_request_id");
CREATE INDEX IF NOT EXISTS "hp_agent_idx" ON "homestay_placements" ("agent_account_id");
CREATE INDEX IF NOT EXISTS "hp_status_idx" ON "homestay_placements" ("status");

-- ── Placement payments (upfront + monthly) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS "homestay_placement_payments" (
  "id" serial PRIMARY KEY NOT NULL,
  "placement_id" integer NOT NULL,
  "kind" text NOT NULL,
  "amount" numeric(10, 2) DEFAULT '0' NOT NULL,
  "currency" text DEFAULT 'AUD' NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,

  "invoice_id" integer,
  "stripe_payment_intent_id" text,
  "stripe_invoice_id" text,

  "period_start" text,
  "period_end" text,
  "paid_at" timestamp with time zone,

  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "hpp_placement_idx" ON "homestay_placement_payments" ("placement_id");
CREATE INDEX IF NOT EXISTS "hpp_status_idx" ON "homestay_placement_payments" ("status");

-- ── Agent commission plans (per-company; fixed + % stackable) ─────────────────
CREATE TABLE IF NOT EXISTS "homestay_commission_plans" (
  "id" serial PRIMARY KEY NOT NULL,
  "account_id" integer NOT NULL,
  "name" text,
  "fixed_referral_fee" numeric(10, 2) DEFAULT '0' NOT NULL,
  "percentage_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
  "stack" boolean DEFAULT true NOT NULL,
  "status" text DEFAULT 'Active' NOT NULL,

  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "hcp_account_idx" ON "homestay_commission_plans" ("account_id");

-- ── Agent commission ledger (per-placement accrual + payout) ──────────────────
CREATE TABLE IF NOT EXISTS "agent_commission_ledger" (
  "id" serial PRIMARY KEY NOT NULL,
  "placement_id" integer NOT NULL,
  "agent_account_id" integer NOT NULL,
  "plan_id" integer,

  "base_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
  "fixed_component" numeric(10, 2) DEFAULT '0' NOT NULL,
  "percentage_component" numeric(10, 2) DEFAULT '0' NOT NULL,
  "amount" numeric(10, 2) DEFAULT '0' NOT NULL,
  "currency" text DEFAULT 'AUD' NOT NULL,

  "status" text DEFAULT 'Pending' NOT NULL,
  "approved_at" timestamp with time zone,
  "paid_at" timestamp with time zone,
  "notes" text,

  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "acl_placement_idx" ON "agent_commission_ledger" ("placement_id");
CREATE INDEX IF NOT EXISTS "acl_agent_idx" ON "agent_commission_ledger" ("agent_account_id");
CREATE INDEX IF NOT EXISTS "acl_status_idx" ON "agent_commission_ledger" ("status");

-- ── Placement services (airport pickup / settlement — masked from student/agent)
CREATE TABLE IF NOT EXISTS "homestay_placement_services" (
  "id" serial PRIMARY KEY NOT NULL,
  "placement_id" integer NOT NULL,
  "service_id" integer,
  "service_type" text NOT NULL,
  "status" text DEFAULT 'Pending' NOT NULL,
  "scheduled_at" timestamp with time zone,
  "price" numeric(10, 2) DEFAULT '0' NOT NULL,
  "currency" text DEFAULT 'AUD' NOT NULL,
  "notes" text,

  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "hps_placement_idx" ON "homestay_placement_services" ("placement_id");
CREATE INDEX IF NOT EXISTS "hps_service_idx" ON "homestay_placement_services" ("service_id");

-- ── Contract signing requests (e-signature, ported from Edubee CRM) ───────────
CREATE TABLE IF NOT EXISTS "contract_signing_requests" (
  "id" serial PRIMARY KEY NOT NULL,
  "token" text NOT NULL,
  "context_type" text NOT NULL,
  "context_id" integer NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "expires_at" timestamp with time zone,

  "signers" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "signatures" jsonb DEFAULT '[]'::jsonb NOT NULL,

  "pdf_url" text,
  "pdf_generated_at" timestamp with time zone,
  "audit_trail" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "signed_at" timestamp with time zone,

  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "contract_signing_requests_token_unique" UNIQUE("token")
);
CREATE INDEX IF NOT EXISTS "csr_context_idx" ON "contract_signing_requests" ("context_type", "context_id");

-- ── Host availability (capacity/occupancy for matching) ───────────────────────
CREATE TABLE IF NOT EXISTS "homestay_host_availability" (
  "id" serial PRIMARY KEY NOT NULL,
  "host_application_id" integer NOT NULL,
  "capacity" integer DEFAULT 1 NOT NULL,
  "occupied" integer DEFAULT 0 NOT NULL,
  "notes" text,

  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "homestay_host_availability_host_application_id_unique" UNIQUE("host_application_id")
);
