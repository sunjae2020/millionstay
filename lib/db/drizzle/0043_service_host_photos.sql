-- 서비스 호스트 사진 (service_host_photos) — photos attached directly to a partner
-- from the admin service-host detail "사진" tab. Job photos keep living in
-- booking_service_photos; the tab merges both on read.
CREATE TABLE IF NOT EXISTS "service_host_photos" (
  "id"               serial PRIMARY KEY NOT NULL,
  "service_host_id"  integer NOT NULL,
  "file_url"         text NOT NULL,
  "thumbnail_url"    text,
  "cloudinary_id"    text,
  "caption"          text,
  "uploaded_by_type" text NOT NULL DEFAULT 'admin',
  "uploaded_by_id"   integer,
  "created_at"       timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "service_host_photos_host_id_idx" ON "service_host_photos" ("service_host_id");
