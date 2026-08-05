-- Account ↔ contact links (many-to-many).
-- accounts.primary_contact_id / secondary_contact_id keep the two designated
-- slots; this table holds every additional person on an account and lets a
-- contact be attached to several accounts. Additive-only.
CREATE TABLE IF NOT EXISTS "account_contacts" (
  "id"         serial PRIMARY KEY NOT NULL,
  "account_id" integer NOT NULL,
  "contact_id" integer NOT NULL,
  "role"       text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "account_contacts_pair_idx"
  ON "account_contacts" ("account_id", "contact_id");
CREATE INDEX IF NOT EXISTS "account_contacts_contact_idx"
  ON "account_contacts" ("contact_id");
