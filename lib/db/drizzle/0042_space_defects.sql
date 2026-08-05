-- 하자 이력 (space_defects) — per-unit defect history shown on the space detail
-- "하자 이력" tab. 0..N rows per space; 소유자명/호수/TYPE are derived from the
-- parent space at read time, never stored here.
CREATE TABLE IF NOT EXISTS "space_defects" (
  "id"                      serial PRIMARY KEY NOT NULL,
  "space_id"                integer NOT NULL,
  "defect_category"         text NOT NULL DEFAULT '',
  "has_furniture_install"   boolean NOT NULL DEFAULT false,
  "has_registration"        boolean NOT NULL DEFAULT false,
  "has_outdoor_unit_socket" boolean NOT NULL DEFAULT false,
  "has_toilet_fixing_issue" boolean NOT NULL DEFAULT false,
  "detail_item"             text NOT NULL DEFAULT '',
  "description"             text NOT NULL DEFAULT '',
  "progress_status"         text NOT NULL DEFAULT '접수',
  "vendor_name"             text NOT NULL DEFAULT '',
  "photo_urls"              jsonb NOT NULL DEFAULT '[]'::jsonb,
  "status"                  text NOT NULL DEFAULT 'Active',
  "created_at"              timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"              timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "space_defects_space_id_idx" ON "space_defects" ("space_id");
