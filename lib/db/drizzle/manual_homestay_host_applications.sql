-- Homestay host-family online applications + admin approval workflow.
-- Idempotent / additive — safe to re-run.

CREATE TABLE IF NOT EXISTS "homestay_host_applications" (
  "id" serial PRIMARY KEY NOT NULL,
  "application_ref" text NOT NULL,
  "status" text DEFAULT 'Submitted' NOT NULL,

  "first_name" text NOT NULL,
  "last_name" text NOT NULL,
  "email" text NOT NULL,
  "phone" text,
  "date_of_birth" text,
  "gender" text,
  "nationality" text,
  "cultural_background" text,
  "address" text,
  "suburb" text,
  "heard_about" text,

  "residents" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "smoking_in_home" boolean DEFAULT false NOT NULL,
  "smoke_outside_allowed" boolean DEFAULT false NOT NULL,
  "drink_in_home" boolean DEFAULT false NOT NULL,
  "guest_drink_allowed" boolean DEFAULT false NOT NULL,
  "has_pets" boolean DEFAULT false NOT NULL,
  "pet_types" text,
  "pet_notes" text,
  "building_type" text,
  "home_features" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "rooms" jsonb DEFAULT '[]'::jsonb NOT NULL,

  "pref_student_gender" text,
  "pref_student_age" text,
  "host_under_18" boolean DEFAULT false NOT NULL,
  "packages_offered" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "dietary" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "dietary_notes" text,

  "welcome_message" text,
  "profile_description" text,

  "emergency_contact" jsonb,
  "extra_contact" jsonb,
  "host_referral" jsonb,

  "agreement_accepted" boolean DEFAULT false NOT NULL,
  "agreement_accepted_at" timestamp with time zone,
  "signature_name" text,

  "requested_docs" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "reviewed_by" integer,
  "reviewed_at" timestamp with time zone,
  "approval_notes" text,

  "account_id" integer,
  "partner_user_id" integer,
  "landing_active" boolean DEFAULT false NOT NULL,

  "deleted_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "homestay_host_applications_application_ref_unique" UNIQUE("application_ref")
);

CREATE INDEX IF NOT EXISTS "hha_status_idx" ON "homestay_host_applications" ("status");
CREATE INDEX IF NOT EXISTS "hha_email_idx" ON "homestay_host_applications" ("email");
