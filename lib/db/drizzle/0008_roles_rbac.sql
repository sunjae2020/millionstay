-- Additive: data-driven RBAC roles + permission matrix. Seeds the 3 existing
-- system roles so behaviour is unchanged on rollout (SuperAdmin bypasses; Admin
-- writes everything except user/role management; Viewer is read-only).
-- Applied directly to prod via psql. Additive-only.
CREATE TABLE IF NOT EXISTS "roles" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL UNIQUE,
  "description" text,
  "is_system" boolean NOT NULL DEFAULT false,
  "permissions" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Seed system roles (idempotent; leaves existing rows untouched).
INSERT INTO "roles" ("name", "description", "is_system", "permissions") VALUES
  ('SuperAdmin', 'Full access to everything, including user & role management.', true,
   '{"dashboard":"write","bookings":"write","contracts":"write","finance":"write","crm":"write","properties":"write","cs":"write","maintenance":"write","products":"write","promotions":"write","services":"write","documents":"write","content":"write","operations":"write","users":"write","settings":"write"}'::jsonb),
  ('Admin', 'Operational access; cannot manage users or roles.', true,
   '{"dashboard":"write","bookings":"write","contracts":"write","finance":"write","crm":"write","properties":"write","cs":"write","maintenance":"write","products":"write","promotions":"write","services":"write","documents":"write","content":"write","operations":"write","users":"read","settings":"write"}'::jsonb),
  ('Viewer', 'Read-only access to all areas.', true,
   '{"dashboard":"read","bookings":"read","contracts":"read","finance":"read","crm":"read","properties":"read","cs":"read","maintenance":"read","products":"read","promotions":"read","services":"read","documents":"read","content":"read","operations":"read","users":"read","settings":"read"}'::jsonb)
ON CONFLICT ("name") DO NOTHING;
