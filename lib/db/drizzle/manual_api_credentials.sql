-- External API credentials for third-party app integration.
-- Issued from property-admin → Settings → API Keys. Idempotent / additive.

CREATE TABLE IF NOT EXISTS "api_credentials" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "key_id" text NOT NULL,
  "secret_hash" text NOT NULL,
  "secret_last4" text,
  "scopes" text DEFAULT '[]' NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "last_used_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "created_by" integer,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "api_credentials_key_id_unique" UNIQUE("key_id")
);
