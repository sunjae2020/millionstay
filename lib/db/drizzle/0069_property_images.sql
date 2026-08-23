-- 0069: property_images — 프로퍼티(건물) 단위 사진.
-- space_images와 동일한 구조로, 건물 외관 등 세대에 속하지 않는 사진을 보관한다.
CREATE TABLE IF NOT EXISTS property_images (
  id              serial PRIMARY KEY,
  property_id     integer NOT NULL,
  file_url        varchar(500) NOT NULL,
  thumbnail_url   varchar(500),
  cloudinary_id   varchar(200),
  caption         varchar(300),
  is_primary      boolean NOT NULL DEFAULT false,
  display_order   integer NOT NULL DEFAULT 0,
  file_size_bytes integer,
  mime_type       varchar(100),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS property_images_property_id_idx ON property_images (property_id);
