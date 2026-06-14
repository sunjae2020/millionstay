-- Manually-applied migration: editable blog category list.
-- Applied to prod via artifacts/api-server/seed-blog-categories.ts (which also
-- seeds the previously-hardcoded categories). Idempotent.
CREATE TABLE IF NOT EXISTS blog_categories (
  id serial PRIMARY KEY,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blog_categories_name_unique UNIQUE (name)
);

INSERT INTO blog_categories (name, sort_order) VALUES
  ('Tips & Guides', 1),
  ('Student Life', 2),
  ('Melbourne', 3),
  ('Housing', 4),
  ('News', 5),
  ('Lifestyle', 6),
  ('Homestay', 7)
ON CONFLICT (name) DO NOTHING;
