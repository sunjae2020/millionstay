-- Additive/relaxing: contacts.email becomes nullable.
-- Korean lease records (2026 임대리스트 migration) carry 성함/연락처/주소 but no
-- email address; phone is the contact channel. Dropping NOT NULL avoids seeding
-- fake placeholder addresses that would later be mistaken for real ones.
ALTER TABLE "contacts" ALTER COLUMN "email" DROP NOT NULL;

-- Normalise any legacy empty-string emails to NULL so "has email" checks are honest.
UPDATE "contacts" SET "email" = NULL WHERE "email" = '';
