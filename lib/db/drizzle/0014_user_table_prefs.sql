-- Additive: per-admin-user list-table view preferences (column order / visibility
-- / widths). One row per (user_id, table_key). Applied directly to prod via psql.
-- Additive-only.
CREATE TABLE IF NOT EXISTS "user_table_prefs" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "admin_users"("id") ON DELETE CASCADE,
  "table_key" text NOT NULL,
  "prefs" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_table_prefs_user_table_uq"
  ON "user_table_prefs" ("user_id", "table_key");
